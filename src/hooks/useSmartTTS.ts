import { useCallback, useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNativeTTS, type ActiveEngine } from './useNativeTTS';

/**
 * Unified TTS Hook - Simple 2-tier system with generation tracking
 * 
 * Pro Plan + chars remaining → Premium Speechify TTS
 * If premium fails or quota exhausted → Web Speech API (free, no limit)
 * Basic Plan → Web Speech API directly (no limit)
 * 
 * CRITICAL FIX: Uses a generation counter to prevent old audio event handlers
 * from interfering with new speak calls (prevents web TTS fallback bug).
 */

export interface SmartTTSOptions {
  text: string;
  voiceId?: string;
  speed?: number;
  language?: string;
}

export interface TTSUsageInfo {
  plan: 'basic' | 'pro';
  ttsUsed: number;
  ttsLimit: number;
  ttsRemaining: number;
  canUsePremium: boolean;
  usingPremium: boolean;
}

interface SmartTTSState {
  isSpeaking: boolean;
  isLoading: boolean;
  error: string | null;
  currentVoiceId: string;
  usageInfo: TTSUsageInfo | null;
  activeEngine: 'premium' | 'web' | 'none';
}

export interface SpeechifyVoice {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  gender: 'male' | 'female' | 'neutral';
  description?: string;
}

export const SPEECHIFY_VOICES: SpeechifyVoice[] = [
  { id: 'henry', name: 'Henry 🇮🇳', language: 'Hindi/English (India)', languageCode: 'hi-IN', gender: 'male', description: 'Indian male voice, Hindi/Hinglish ke liye best' },
  { id: 'natasha', name: 'Natasha 🇮🇳', language: 'Hindi/English (India)', languageCode: 'hi-IN', gender: 'female', description: 'Indian female voice, natural Hindi pronunciation' },
];

const clientAudioCache = new Map<string, string>();

export const useSmartTTS = (studentId: string | null) => {
  const [state, setState] = useState<SmartTTSState>({
    isSpeaking: false,
    isLoading: false,
    error: null,
    currentVoiceId: 'henry',
    usageInfo: null,
    activeEngine: 'none',
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Generation counter - increments on every new speak() call
  // Old audio handlers check this to avoid updating state for stale calls
  const generationRef = useRef(0);
  // Refs to avoid stale closures
  const usageInfoRef = useRef<TTSUsageInfo | null>(null);
  const voiceIdRef = useRef('henry');

  // Web Speech TTS (fallback / basic plan)
  const nativeTTS = useNativeTTS();

  // Keep refs in sync
  useEffect(() => { usageInfoRef.current = state.usageInfo; }, [state.usageInfo]);
  useEffect(() => { voiceIdRef.current = state.currentVoiceId; }, [state.currentVoiceId]);

  // Fetch subscription status
  const fetchUsageInfo = useCallback(async () => {
    if (!studentId) return;
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'get_subscription', studentId },
      });
      if (error || data?.error) {
        setState(prev => ({
          ...prev,
          usageInfo: { plan: 'basic', ttsUsed: 0, ttsLimit: 150000, ttsRemaining: 150000, canUsePremium: false, usingPremium: false },
        }));
        return;
      }
      const sub = data?.subscription;
      const plan = sub?.plan || 'basic';
      const ttsUsed = sub?.tts_used ?? 0;
      const ttsLimit = sub?.tts_limit ?? (plan === 'pro' ? 90000 : 0);
      const isActive = sub?.is_active ?? true;
      const isExpired = sub?.end_date && new Date(sub.end_date) < new Date();
      const canUsePremium = plan === 'pro' && isActive && !isExpired && ttsUsed < ttsLimit;

      setState(prev => ({
        ...prev,
        usageInfo: { plan, ttsUsed, ttsLimit, ttsRemaining: Math.max(0, ttsLimit - ttsUsed), canUsePremium, usingPremium: canUsePremium },
      }));
    } catch (err) {
      console.error('TTS: Error fetching usage info', err);
    }
  }, [studentId]);

  useEffect(() => { fetchUsageInfo(); }, [fetchUsageInfo]);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      // Remove all event listeners BEFORE stopping to prevent stale handlers
      const audio = audioRef.current;
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      audio.pause();
      audio.src = '';
      audio.load();
      audioRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    // Increment generation so any in-flight async operations know they're stale
    generationRef.current++;
    cleanupAudio();
    nativeTTS.stop();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setState(prev => ({ ...prev, isSpeaking: false, isLoading: false, activeEngine: 'none' }));
  }, [cleanupAudio, nativeTTS]);

  // Speak using Premium TTS (Speechify)
  const speakPremium = useCallback(async (options: SmartTTSOptions, generation: number): Promise<boolean> => {
    const { text, voiceId = voiceIdRef.current, speed = 1.0 } = options;

    const cacheKey = `${voiceId}:${text.substring(0, 200)}`;
    const cachedAudio = clientAudioCache.get(cacheKey);
    if (cachedAudio && cachedAudio.includes('audio_data')) {
      clientAudioCache.delete(cacheKey);
    }

    try {
      let audioDataUrl: string;

      // Check if this generation is still current
      if (generationRef.current !== generation) {
        console.log('TTS: Premium call cancelled (new generation)');
        return false;
      }

      const validCachedAudio = clientAudioCache.get(cacheKey);
      if (validCachedAudio) {
        console.log('TTS: Using client cache (Premium)');
        audioDataUrl = validCachedAudio;
      } else {
        abortControllerRef.current = new AbortController();
        console.log('TTS: Calling Premium TTS...');

        const { data, error } = await supabase.functions.invoke('text-to-speech', {
          body: { text, voiceId, speed, language: 'hi-IN', studentId },
        });

        // Check generation again after async call
        if (generationRef.current !== generation) {
          console.log('TTS: Premium response discarded (new generation)');
          return false;
        }

        if (error) throw new Error(error.message || 'TTS request failed');

        if (data?.error === 'FALLBACK_TO_WEB_TTS') {
          console.log('TTS: Server says fallback -', data.reason);
          if (data?.usageInfo) {
            setState(prev => ({
              ...prev,
              usageInfo: { ...prev.usageInfo!, ...data.usageInfo, usingPremium: false },
            }));
          }
          return false;
        }

        if (data?.error) throw new Error(data.error);
        if (!data?.audio) throw new Error('No audio data received');

        audioDataUrl = `data:audio/mp3;base64,${data.audio}`;

        if (data?.usageInfo) {
          setState(prev => ({
            ...prev,
            usageInfo: {
              ...prev.usageInfo!,
              ttsUsed: data.usageInfo.ttsUsed,
              ttsRemaining: data.usageInfo.ttsRemaining,
              canUsePremium: data.usageInfo.canUsePremium,
            },
          }));
        }

        if (clientAudioCache.size > 50) {
          const firstKey = clientAudioCache.keys().next().value;
          if (firstKey) clientAudioCache.delete(firstKey);
        }
        clientAudioCache.set(cacheKey, audioDataUrl);
        console.log(`TTS Premium: ${data.audioSize || 'unknown'} bytes, cached: ${data.cached}`);
      }

      // Final generation check before playing
      if (generationRef.current !== generation) {
        console.log('TTS: Playback cancelled (new generation)');
        return false;
      }

      const audio = new Audio(audioDataUrl);
      audioRef.current = audio;
      audio.playbackRate = Math.max(0.5, Math.min(2.0, speed));

      return new Promise((resolve) => {
        // Guard all handlers with generation check
        audio.onplay = () => {
          if (generationRef.current !== generation) return;
          setState(prev => ({ ...prev, isSpeaking: true, isLoading: false, activeEngine: 'premium' }));
        };
        audio.onended = () => {
          if (generationRef.current !== generation) return;
          setState(prev => ({ ...prev, isSpeaking: false, activeEngine: 'none' }));
          cleanupAudio();
          resolve(true);
        };
        audio.onerror = () => {
          if (generationRef.current !== generation) { resolve(false); return; }
          setState(prev => ({ ...prev, isSpeaking: false, isLoading: false, activeEngine: 'none' }));
          cleanupAudio();
          resolve(false);
        };
        audio.play().catch(() => resolve(false));
      });
    } catch (error: any) {
      console.error('Premium TTS Error:', error);
      return false;
    }
  }, [studentId, cleanupAudio]);

  // Speak using Web Speech API (no limit)
  const speakWeb = useCallback(async (options: SmartTTSOptions, generation: number): Promise<boolean> => {
    const { text, speed = 0.9 } = options;

    // Check generation before starting
    if (generationRef.current !== generation) return false;

    console.log('TTS: Using Web Speech API');
    cleanupAudio();

    setState(prev => ({ ...prev, isSpeaking: true, isLoading: false, activeEngine: 'web' }));

    try {
      const result = await nativeTTS.speak({
        text,
        rate: speed,
        pitch: 1.0,
        volume: 1.0,
      });

      // Only update state if this generation is still current
      if (generationRef.current !== generation) return false;

      if (!result.success) {
        setState(prev => ({ ...prev, activeEngine: 'none' }));
      }

      return result.success;
    } catch (error) {
      console.error('TTS Web Error:', error);
      if (generationRef.current === generation) {
        setState(prev => ({ ...prev, activeEngine: 'none' }));
      }
      return false;
    }
  }, [nativeTTS, cleanupAudio]);

  // Main speak function
  const speak = useCallback(async (options: SmartTTSOptions): Promise<void> => {
    const { text } = options;
    if (!text || text.trim().length === 0) return;

    // Stop current playback and increment generation
    stop();
    const currentGeneration = generationRef.current;

    setState(prev => ({ ...prev, isLoading: true, error: null, activeEngine: 'none' }));

    const textLength = text.length;
    // Use ref to get latest usageInfo (avoids stale closure)
    const usageInfo = usageInfoRef.current;

    // Pro plan with remaining chars → try Premium first
    let tryPremium = false;
    if (studentId && usageInfo?.plan === 'pro' && usageInfo.canUsePremium && usageInfo.ttsRemaining >= textLength) {
      tryPremium = true;
      console.log(`TTS: Trying Premium (${usageInfo.ttsRemaining} chars remaining) [gen=${currentGeneration}]`);
    }

    let success = false;

    // STEP 1: Try Premium if eligible
    if (tryPremium) {
      success = await speakPremium(options, currentGeneration);
      // Check if a newer generation started while we were waiting
      if (generationRef.current !== currentGeneration) {
        console.log(`TTS: Generation changed during premium (${currentGeneration} → ${generationRef.current}), aborting`);
        return;
      }
      if (success) return;
      console.log('TTS: Premium failed, falling back to Web Speech...');
    }

    // Check generation again before fallback
    if (generationRef.current !== currentGeneration) {
      console.log(`TTS: Generation changed, skipping web fallback`);
      return;
    }

    // STEP 2: Web Speech API (no limit)
    success = await speakWeb(options, currentGeneration);

    if (generationRef.current !== currentGeneration) return;

    if (!success) {
      const errorMsg = 'Voice playback failed. Try again!';
      console.error(`TTS: ❌ ${errorMsg}`);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSpeaking: false,
        error: errorMsg,
        activeEngine: 'none',
      }));
    }
  }, [studentId, stop, speakPremium, speakWeb]);

  const setVoice = useCallback((voiceId: string) => {
    setState(prev => ({ ...prev, currentVoiceId: voiceId }));
  }, []);

  const previewVoice = useCallback(async (voiceId: string) => {
    const previewText = "नमस्ते! मैं आपका Study Buddy हूं।";
    await speak({ text: previewText, voiceId, language: 'hi-IN' });
  }, [speak]);

  const refreshUsageInfo = useCallback(() => { fetchUsageInfo(); }, [fetchUsageInfo]);

  const getStatusMessage = useCallback((): string | null => {
    if (!state.usageInfo) return null;
    const { plan, ttsRemaining, canUsePremium } = state.usageInfo;
    if (plan === 'basic') return 'Using Web Voice (Basic Plan)';
    if (plan === 'pro' && !canUsePremium) return '⚠️ Voice limit reached - Using Web Voice';
    if (plan === 'pro' && ttsRemaining < 10000) return `⚠️ Low voice quota: ${Math.round(ttsRemaining / 1000)}K chars left`;
    return null;
  }, [state.usageInfo]);

  const getEngineBadge = useCallback((): { label: string; style: 'premium' | 'web' | 'none' } => {
    switch (state.activeEngine) {
      case 'premium': return { label: '✨ Premium', style: 'premium' };
      case 'web': return { label: '🌐 Web Voice', style: 'web' };
      default: return { label: '', style: 'none' };
    }
  }, [state.activeEngine]);

  // Sync ONLY isSpeaking from web TTS — never override activeEngine here
  // The activeEngine is managed exclusively within speak/speakPremium/speakWeb via generation tracking
  useEffect(() => {
    if (nativeTTS.isSpeaking) {
      setState(prev => ({ ...prev, isSpeaking: true }));
    } else if (!audioRef.current) {
      // Only set isSpeaking false if no premium audio is playing either
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  }, [nativeTTS.isSpeaking]);

  return {
    speak,
    stop,
    isSpeaking: state.isSpeaking || nativeTTS.isSpeaking,
    isLoading: state.isLoading,
    error: state.error,
    isSupported: true,
    currentVoiceId: state.currentVoiceId,
    setVoice,
    voices: SPEECHIFY_VOICES,
    previewVoice,
    usageInfo: state.usageInfo,
    refreshUsageInfo,
    getStatusMessage,
    getEngineBadge,
    isPremiumActive: state.activeEngine === 'premium',
    isAndroidNative: false,
    activeEngine: state.activeEngine,
  };
};

export default useSmartTTS;
