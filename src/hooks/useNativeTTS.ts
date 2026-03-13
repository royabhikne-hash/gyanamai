import { useCallback, useEffect, useState, useRef } from 'react';

interface TTSOptions {
  text: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
}

/**
 * Web Speech TTS Hook - Simple Web Speech API only
 * 
 * No character limit. No Android Native TTS.
 * Just browser speechSynthesis with chunking for long text.
 */

export type ActiveEngine = 'web' | 'none';

export const useNativeTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<ActiveEngine>('none');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef(0);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          console.log('TTS: Web Speech loaded', voices.length, 'voices');
          setAvailableVoices(voices);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      // Retry for late-loading voices
      [300, 800, 1500, 3000].forEach(delay =>
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
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  const sanitizeText = useCallback((text: string): string => {
    return text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const splitIntoChunks = useCallback((text: string, maxLength: number = 180): string[] => {
    if (text.length <= maxLength) return [text];
    // Split on Hindi purna viram, period, exclamation, question mark, or comma for smaller chunks
    const sentences = text.split(/(?<=[।.!?,;])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxLength) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        // If a single sentence is too long, split by words
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

    // Female name patterns to exclude when looking for male voices
    const femalePatterns = ['female', 'swara', 'lekha', 'aditi', 'priya', 'neerja', 'sunita', 'kavya', 'woman'];

    const isMaleVoice = (name: string) => {
      const n = name.toLowerCase();
      return !femalePatterns.some(p => n.includes(p));
    };

    // Priority 1: English-India male voice (best for Hinglish content)
    const enInMale = voices.find(v => {
      const n = v.name.toLowerCase();
      return v.lang === 'en-IN' && isMaleVoice(n) && (n.includes('ravi') || n.includes('male') || n.includes('google'));
    });
    if (enInMale) return enInMale;

    // Priority 2: Any en-IN male
    const enInAny = voices.find(v => v.lang === 'en-IN' && isMaleVoice(v.name));
    if (enInAny) return enInAny;

    // Priority 3: Hindi male voice
    const hindiMaleNames = [
      'google हिन्दी', 'google hindi', 'madhur', 'hemant', 'prabhat',
      'microsoft madhur', 'samsung hindi male', 'hindi male', 'hindi india male', 'male hindi', 'vani'
    ];
    const hindiMaleVoice = voices.find(v => {
      const n = v.name.toLowerCase();
      const isHindi = v.lang === 'hi-IN' || v.lang.startsWith('hi');
      const isMale = hindiMaleNames.some(name => n.includes(name)) || isMaleVoice(n);
      return isHindi && isMale;
    });
    if (hindiMaleVoice) return hindiMaleVoice;

    // Priority 4: Any Hindi voice
    const hindiVoice = voices.find(v => v.lang === 'hi-IN');
    if (hindiVoice) return hindiVoice;

    // Priority 5: English male voice
    const englishMale = voices.find(v => v.lang.startsWith('en') && isMaleVoice(v.name));
    if (englishMale) return englishMale;

    // Priority 6: Any English voice
    const english = voices.find(v => v.lang.startsWith('en'));
    if (english) return english;

    return voices[0] || null;
  }, [availableVoices]);

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

      // Safety timeout - very generous to avoid cutting speech
      const safetyTimeout = setTimeout(() => {
        console.warn('TTS: chunk safety timeout fired');
        settle({ completed: true, stoppedEarly: false });
      }, Math.max(60000, text.length * 300));

      // Watchdog: detect if engine silently stopped (wait 1.5s of silence before declaring done)
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
            // Engine has been silent for 1.5s - it's done or stuck
            settle({ completed: true, stoppedEarly: false });
          }
        } else {
          silentSince = 0; // Reset - engine is speaking
        }
      }, 400);

      utterance.onend = () => {
        settle({ completed: true, stoppedEarly: false });
      };

      utterance.onerror = (event) => {
        if (event.error === 'interrupted' || event.error === 'canceled') {
          settle({ completed: true, stoppedEarly: false });
          return;
        }
        // On Android WebView, 'not-allowed' often fires on first attempt
        // Don't treat it as fatal - let retry logic handle it
        console.warn('TTS Web chunk error:', event.error);
        settle({ completed: false, stoppedEarly: false, error: event.error });
      };

      try {
        window.speechSynthesis.speak(utterance);
        
        // Android WebView fix: check if speech actually started after 2s
        setTimeout(() => {
          if (!settled && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
            console.warn('TTS: Speech never started, resolving chunk');
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

    // Ensure engine is clean before starting
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

    console.log(`TTS Web: Starting ${chunks.length} chunks, voice: ${voice?.name || 'default'}`);
    setActiveEngine('web');

    // Detect mobile - heartbeat causes MORE problems on Android WebView
    const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // Only use heartbeat on desktop Chrome (where the 15s timeout bug exists)
    if (!isMobile) {
      heartbeatRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          setTimeout(() => window.speechSynthesis.resume(), 50);
        }
      }, 5000);
    }

    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    let anyChunkSpoke = false;

    for (let i = 0; i < chunks.length; i++) {
      if (isCancelledRef.current) break;
      currentChunkIndexRef.current = i;
      const chunkText = chunks[i];

      let result = await speakChunkWeb(chunkText, voice, rate, pitch, volume);

      if (!result.completed || result.error) {
        consecutiveFailures++;
        console.warn(`TTS: Chunk ${i} failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${result.error}`);
        
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error('TTS: Too many consecutive failures, stopping');
          break;
        }

        // Reset engine completely and retry
        window.speechSynthesis.cancel();
        await new Promise(r => setTimeout(r, 300 + consecutiveFailures * 200));
        
        if (!isCancelledRef.current) {
          result = await speakChunkWeb(chunkText, voice, rate, pitch, volume);
          if (result.completed && !result.error) {
            consecutiveFailures = 0;
            anyChunkSpoke = true;
          } else {
            window.speechSynthesis.cancel();
            await new Promise(r => setTimeout(r, 800));
            if (!isCancelledRef.current) {
              const finalRetry = await speakChunkWeb(chunkText, voice, rate, pitch, volume);
              if (finalRetry.completed && !finalRetry.error) {
                consecutiveFailures = 0;
                anyChunkSpoke = true;
              }
            }
          }
        }
      } else {
        consecutiveFailures = 0;
        anyChunkSpoke = true;
      }

      // NO delay between chunks - speak continuously
      // The onend event already fired, so the engine is ready
    }

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    return anyChunkSpoke || chunks.length === 0;
  }, [getBestVoice, splitIntoChunks, speakChunkWeb]);

  const stop = useCallback(() => {
    isCancelledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
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

  // ============= MAIN SPEAK FUNCTION =============
  const speak = useCallback((options: TTSOptions): Promise<{ success: boolean; engine: ActiveEngine; error?: string }> => {
    const { text, rate = 0.9, pitch = 1.0, volume = 1.0, voiceName } = options;

    return (async () => {
      if (!isSupported) {
        return { success: false, engine: 'none' as ActiveEngine, error: 'TTS not supported on this device' };
      }

      const cleanText = sanitizeText(text);
      if (!cleanText) {
        return { success: true, engine: 'none' as ActiveEngine };
      }

      // Cancel any ongoing speech
      stop();
      isCancelledRef.current = false;
      
      // Give engine time to fully reset - critical on Android WebView
      await new Promise(r => setTimeout(r, 150));

      setIsSpeaking(true);

      try {
        const webSuccess = await tryWebSpeech(cleanText, rate, pitch, volume, voiceName || selectedVoiceName);
        if (webSuccess && !isCancelledRef.current) {
          return { success: true, engine: 'web' as ActiveEngine };
        }

        console.error('TTS: ❌ Web Speech failed');
        setActiveEngine('none');
        return {
          success: false,
          engine: 'none' as ActiveEngine,
          error: 'Voice not available on this device'
        };
      } finally {
        if (!isCancelledRef.current) {
          setIsSpeaking(false);
        }
        utteranceRef.current = null;
      }
    })();
  }, [isSupported, sanitizeText, selectedVoiceName, tryWebSpeech, stop]);

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
    isNative: false,
    availableVoices,
    sanitizeText,
    selectedVoiceName,
    setSelectedVoiceName,
    getHindiVoices,
    useAndroidNative: false,
    activeEngine,
  };
};

export default useNativeTTS;
