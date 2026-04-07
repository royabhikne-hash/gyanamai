import { useCallback, useEffect, useState, useRef } from 'react';
import { 
  isAndroidNativeTTSAvailable, 
  speakWithAndroidNative, 
  stopAndroidNativeTTS,
  isAndroidEnvironment,
  sanitizeForTTS,
  splitForNativeTTS,
  detectLanguage
} from '@/lib/androidTTSBridge';

interface TTSOptions {
  text: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
}

/**
 * Native TTS Hook - Android Native TTS first, Web Speech API fallback
 * 
 * Priority:
 * 1. Capacitor TTS plugin (@capacitor-community/text-to-speech)
 * 2. Android Native bridge (AndroidTTS JS interface)
 * 3. Web Speech API (browser speechSynthesis)
 */

export type ActiveEngine = 'native' | 'web' | 'none';

// Capacitor TTS plugin check
let capacitorTTS: any = null;
const loadCapacitorTTS = async () => {
  try {
    const mod = await import('@capacitor-community/text-to-speech');
    capacitorTTS = mod.TextToSpeech;
    return true;
  } catch {
    return false;
  }
};

export const useNativeTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<ActiveEngine>('none');
  const [useAndroidNative, setUseAndroidNative] = useState(false);
  const [hasCapacitorTTS, setHasCapacitorTTS] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef(0);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    // Check Capacitor TTS first
    loadCapacitorTTS().then(available => {
      if (available) {
        setHasCapacitorTTS(true);
        setIsSupported(true);
        console.log('TTS: Capacitor TTS plugin available');
      }
    });

    // Check Android native bridge
    if (isAndroidNativeTTSAvailable()) {
      setUseAndroidNative(true);
      setIsSupported(true);
      console.log('TTS: Android native bridge available');
    }

    // Web Speech API fallback
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          setAvailableVoices(voices);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      [300, 800, 1500].forEach(delay =>
        setTimeout(() => {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) setAvailableVoices(prev => prev.length === 0 ? voices : prev);
        }, delay)
      );
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopAndroidNativeTTS();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  const sanitizeText = useCallback((text: string): string => {
    return sanitizeForTTS(text);
  }, []);

  const splitIntoChunks = useCallback((text: string, maxLength: number = 180): string[] => {
    if (text.length <= maxLength) return [text];
    const sentences = text.split(/(?<=[।.!?,;])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxLength) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        if (sentence.length > maxLength) {
          const words = sentence.split(/\s+/);
          let wordChunk = '';
          for (const word of words) {
            if (wordChunk.length + word.length + 1 <= maxLength) {
              wordChunk += (wordChunk ? ' ' : '') + word;
            } else {
              if (wordChunk) chunks.push(wordChunk);
              wordChunk = word;
            }
          }
          if (wordChunk) currentChunk = wordChunk;
          else currentChunk = '';
        } else {
          currentChunk = sentence;
        }
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks.filter(c => c.trim().length > 0);
  }, []);

  const getBestVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = availableVoices.length > 0
      ? availableVoices
      : (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []);
    if (voices.length === 0) return null;

    const femalePatterns = ['female', 'swara', 'lekha', 'aditi', 'priya', 'neerja', 'sunita', 'kavya', 'woman'];
    const isMaleVoice = (name: string) => {
      const n = name.toLowerCase();
      return !femalePatterns.some(p => n.includes(p));
    };

    const enInMale = voices.find(v => {
      const n = v.name.toLowerCase();
      return v.lang === 'en-IN' && isMaleVoice(n) && (n.includes('ravi') || n.includes('male') || n.includes('google'));
    });
    if (enInMale) return enInMale;

    const enInAny = voices.find(v => v.lang === 'en-IN' && isMaleVoice(v.name));
    if (enInAny) return enInAny;

    const hindiMaleNames = [
      'google हिन्दी', 'google hindi', 'madhur', 'hemant', 'prabhat',
      'microsoft madhur', 'hindi male', 'male hindi'
    ];
    const hindiMaleVoice = voices.find(v => {
      const n = v.name.toLowerCase();
      const isHindi = v.lang === 'hi-IN' || v.lang.startsWith('hi');
      const isMale = hindiMaleNames.some(name => n.includes(name)) || isMaleVoice(n);
      return isHindi && isMale;
    });
    if (hindiMaleVoice) return hindiMaleVoice;

    const hindiVoice = voices.find(v => v.lang === 'hi-IN');
    if (hindiVoice) return hindiVoice;

    const englishMale = voices.find(v => v.lang.startsWith('en') && isMaleVoice(v.name));
    if (englishMale) return englishMale;

    return voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
  }, [availableVoices]);

  // Capacitor TTS speak
  const speakCapacitor = useCallback(async (text: string, rate: number, lang: string): Promise<boolean> => {
    if (!capacitorTTS) return false;
    try {
      await capacitorTTS.speak({
        text,
        lang: lang || 'hi-IN',
        rate: Math.max(0.5, Math.min(2.0, rate)),
        pitch: 1.0,
        volume: 1.0,
        category: 'playback',
      });
      return true;
    } catch (e) {
      console.error('Capacitor TTS error:', e);
      return false;
    }
  }, []);

  // Android Native TTS speak
  const speakAndroidNative = useCallback(async (text: string, rate: number): Promise<boolean> => {
    if (!isAndroidNativeTTSAvailable()) return false;
    const chunks = splitForNativeTTS(text, 1500);
    for (const chunk of chunks) {
      if (isCancelledRef.current) return false;
      const result = await speakWithAndroidNative(chunk, rate);
      if (!result.success) return false;
    }
    return true;
  }, []);

  const speakChunkWeb = useCallback((
    text: string,
    voice: SpeechSynthesisVoice | null,
    rate: number,
    pitch: number,
    volume: number,
  ): Promise<{ completed: boolean; stoppedEarly: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (isCancelledRef.current) {
        resolve({ completed: false, stoppedEarly: false });
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'hi-IN';
      }
      utterance.rate = Math.max(0.1, Math.min(10, rate));
      utterance.pitch = Math.max(0, Math.min(2, pitch));
      utterance.volume = Math.max(0, Math.min(1, volume));

      let settled = false;
      const settle = (result: { completed: boolean; stoppedEarly: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimeout);
        clearInterval(resumeWatchdog);
        resolve(result);
      };

      const safetyTimeout = setTimeout(() => {
        settle({ completed: true, stoppedEarly: false });
      }, Math.max(60000, text.length * 300));

      let silentSince = 0;
      const resumeWatchdog = setInterval(() => {
        if (settled || isCancelledRef.current) {
          clearInterval(resumeWatchdog);
          return;
        }
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          if (silentSince === 0) {
            silentSince = Date.now();
          } else if (Date.now() - silentSince > 1500) {
            settle({ completed: true, stoppedEarly: false });
          }
        } else {
          silentSince = 0;
        }
      }, 400);

      utterance.onend = () => settle({ completed: true, stoppedEarly: false });
      utterance.onerror = (event) => {
        if (event.error === 'interrupted' || event.error === 'canceled') {
          settle({ completed: true, stoppedEarly: false });
          return;
        }
        settle({ completed: false, stoppedEarly: false, error: event.error });
      };

      try {
        window.speechSynthesis.speak(utterance);
        setTimeout(() => {
          if (!settled && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
            settle({ completed: false, stoppedEarly: true, error: 'never-started' });
          }
        }, 2000);
      } catch (e) {
        settle({ completed: false, stoppedEarly: false, error: String(e) });
      }
    });
  }, []);

  const tryWebSpeech = useCallback(async (
    cleanText: string, rate: number, pitch: number, volume: number, voiceName?: string | null
  ): Promise<boolean> => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;

    window.speechSynthesis.cancel();
    await new Promise(r => setTimeout(r, 200));

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      await new Promise(r => setTimeout(r, 500));
      window.speechSynthesis.getVoices();
      await new Promise(r => setTimeout(r, 300));
    }

    let voice: SpeechSynthesisVoice | null = null;
    if (voiceName) {
      voice = (voices.length > 0 ? voices : window.speechSynthesis.getVoices()).find(v => v.name === voiceName) || null;
    }
    if (!voice) voice = getBestVoice();

    const chunks = splitIntoChunks(cleanText, 150);
    chunksRef.current = chunks;
    currentChunkIndexRef.current = 0;

    setActiveEngine('web');

    const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) {
      heartbeatRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          setTimeout(() => window.speechSynthesis.resume(), 50);
        }
      }, 5000);
    }

    let consecutiveFailures = 0;
    let anyChunkSpoke = false;

    for (let i = 0; i < chunks.length; i++) {
      if (isCancelledRef.current) break;
      currentChunkIndexRef.current = i;

      let result = await speakChunkWeb(chunks[i], voice, rate, pitch, volume);

      if (!result.completed || result.error) {
        consecutiveFailures++;
        if (consecutiveFailures >= 5) break;

        window.speechSynthesis.cancel();
        await new Promise(r => setTimeout(r, 300 + consecutiveFailures * 200));

        if (!isCancelledRef.current) {
          result = await speakChunkWeb(chunks[i], voice, rate, pitch, volume);
          if (result.completed && !result.error) {
            consecutiveFailures = 0;
            anyChunkSpoke = true;
          }
        }
      } else {
        consecutiveFailures = 0;
        anyChunkSpoke = true;
      }
    }

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    return anyChunkSpoke || chunks.length === 0;
  }, [getBestVoice, splitIntoChunks, speakChunkWeb]);

  const stop = useCallback(() => {
    isCancelledRef.current = true;
    // Stop all engines
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopAndroidNativeTTS();
    if (capacitorTTS) {
      try { capacitorTTS.stop(); } catch {}
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    utteranceRef.current = null;
    chunksRef.current = [];
    currentChunkIndexRef.current = 0;
    setIsSpeaking(false);
    setActiveEngine('none');
  }, []);

  // Main speak function with priority: Capacitor > Android Native > Web Speech
  const speak = useCallback((options: TTSOptions): Promise<{ success: boolean; engine: ActiveEngine; error?: string }> => {
    const { text, rate = 0.9, pitch = 1.0, volume = 1.0, voiceName } = options;

    return (async () => {
      if (!isSupported) {
        return { success: false, engine: 'none' as ActiveEngine, error: 'TTS not supported' };
      }

      const cleanText = sanitizeText(text);
      if (!cleanText) {
        return { success: true, engine: 'none' as ActiveEngine };
      }

      stop();
      isCancelledRef.current = false;
      await new Promise(r => setTimeout(r, 100));

      setIsSpeaking(true);

      try {
        // Priority 1: Capacitor TTS (best for native apps)
        if (hasCapacitorTTS) {
          const lang = detectLanguage(cleanText);
          const success = await speakCapacitor(cleanText, rate, lang);
          if (success && !isCancelledRef.current) {
            setActiveEngine('native');
            return { success: true, engine: 'native' as ActiveEngine };
          }
        }

        // Priority 2: Android Native Bridge
        if (useAndroidNative || isAndroidNativeTTSAvailable()) {
          const success = await speakAndroidNative(cleanText, rate);
          if (success && !isCancelledRef.current) {
            setActiveEngine('native');
            return { success: true, engine: 'native' as ActiveEngine };
          }
        }

        // Priority 3: Web Speech API
        const webSuccess = await tryWebSpeech(cleanText, rate, pitch, volume, voiceName || selectedVoiceName);
        if (webSuccess && !isCancelledRef.current) {
          return { success: true, engine: 'web' as ActiveEngine };
        }

        setActiveEngine('none');
        return { success: false, engine: 'none' as ActiveEngine, error: 'Voice not available' };
      } finally {
        if (!isCancelledRef.current) {
          setIsSpeaking(false);
        }
        utteranceRef.current = null;
      }
    })();
  }, [isSupported, hasCapacitorTTS, useAndroidNative, sanitizeText, selectedVoiceName, tryWebSpeech, stop, speakCapacitor, speakAndroidNative]);

  const getHindiVoices = useCallback((): SpeechSynthesisVoice[] => {
    const voices = availableVoices.length > 0
      ? availableVoices
      : (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []);
    return voices.filter(v =>
      v.lang.startsWith('hi') || v.lang === 'en-IN' || v.lang.startsWith('en')
    );
  }, [availableVoices]);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
    isNative: hasCapacitorTTS || useAndroidNative,
    availableVoices,
    sanitizeText,
    selectedVoiceName,
    setSelectedVoiceName,
    getHindiVoices,
    useAndroidNative: hasCapacitorTTS || useAndroidNative,
    activeEngine,
  };
};

export default useNativeTTS;
