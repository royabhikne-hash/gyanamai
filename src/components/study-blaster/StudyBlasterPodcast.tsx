import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mic, Loader2, Play, Pause, SkipForward, SkipBack, Square,
  Download, Sparkles, GraduationCap, User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Turn {
  speaker: "teacher" | "student";
  text: string;
}

interface PodcastScript {
  title: string;
  turns: Turn[];
  teacherName?: string;
  studentName?: string;
}

interface Props {
  projectId: string;
  hasSources: boolean;
}

const StudyBlasterPodcast = ({ projectId, hasSources }: Props) => {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [script, setScript] = useState<PodcastScript | null>(null);
  const [exchanges, setExchanges] = useState<number>(20);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [recording, setRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const stoppedRef = useRef(false);
  const indexRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Load TTS voices
  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis?.getVoices?.() || [];
      if (v.length) setVoices(v);
    };
    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      try { window.speechSynthesis?.cancel(); } catch (_) {}
    };
  }, []);

  const { femaleVoice, maleVoice } = useMemo(() => {
    // Prefer Indian English voices, then Hindi (en-IN / hi-IN), then any English
    const indian = voices.filter(v => /(en[-_]IN|hi[-_]IN)/i.test(v.lang));
    const en = voices.filter(v => /^en/i.test(v.lang));
    const pool = indian.length ? indian : (en.length ? en : voices);

    const findBy = (list: SpeechSynthesisVoice[], ...needles: string[]) =>
      list.find(v => needles.some(n => v.name.toLowerCase().includes(n)));

    // Indian female voice names across platforms (Google, Microsoft, Apple)
    const female =
      findBy(pool, "heera", "swara", "kalpana", "priya", "veena", "aditi", "raveena", "neerja", "isha", "lekha", "shruti", "google हिन्दी", "google india", "female") ||
      findBy(voices, "heera", "swara", "priya", "veena", "aditi", "raveena", "neerja", "isha", "lekha", "shruti") ||
      pool[0] || voices[0];

    // Indian male voice names
    const male =
      findBy(pool, "hemant", "ravi", "rishi", "kabir", "prabhat", "madhur", "google इंडिया", "male") ||
      findBy(voices, "hemant", "ravi", "rishi", "kabir", "prabhat", "madhur") ||
      pool.find(v => v !== female) || pool[1] || voices[1] || voices[0];

    return { femaleVoice: female, maleVoice: male };
  }, [voices]);

  const handleGenerate = async () => {
    if (!hasSources) {
      toast({ title: "Add sources first", description: "Upload PDFs or notes before generating a podcast.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setScript(null);
    setActiveIndex(-1);
    setDownloadUrl(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-blaster`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({ action: "generate_podcast", projectId, exchanges }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to generate");
      if (!data.script?.turns?.length) throw new Error("Empty podcast script");
      setScript(data.script);
      toast({ title: "Podcast ready! 🎙️", description: `${data.script.turns.length} dialogue turns generated.` });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const speakTurn = (turn: Turn): Promise<void> => {
    return new Promise((resolve) => {
      if (stoppedRef.current) { resolve(); return; }
      const u = new SpeechSynthesisUtterance(turn.text);
      const v = turn.speaker === "teacher" ? femaleVoice : maleVoice;
      if (v) u.voice = v;
      u.lang = v?.lang || "en-IN";
      u.rate = turn.speaker === "teacher" ? 0.95 : 1.02;
      u.pitch = turn.speaker === "teacher" ? 1.1 : 0.9;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  };

  const playFrom = async (start: number) => {
    if (!script) return;
    stoppedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);
    for (let i = start; i < script.turns.length; i++) {
      if (stoppedRef.current) break;
      indexRef.current = i;
      setActiveIndex(i);
      await speakTurn(script.turns[i]);
    }
    setIsPlaying(false);
    if (!stoppedRef.current) setActiveIndex(-1);
  };

  const handlePlay = () => {
    if (!script) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }
    const start = activeIndex >= 0 ? activeIndex : 0;
    playFrom(start);
  };

  const handlePause = () => {
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    stoppedRef.current = true;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setActiveIndex(-1);
  };

  const handleNext = () => {
    if (!script) return;
    handleStop();
    const next = Math.min(indexRef.current + 1, script.turns.length - 1);
    setTimeout(() => playFrom(next), 100);
  };

  const handlePrev = () => {
    if (!script) return;
    handleStop();
    const prev = Math.max(indexRef.current - 1, 0);
    setTimeout(() => playFrom(prev), 100);
  };

  // Recording: capture tab/system audio via getDisplayMedia (with audio) — most reliable cross-browser
  // way to record speechSynthesis output. Fallback: instruct user.
  const handleRecordAndDownload = async () => {
    if (!script) return;
    if (recording) return;
    setDownloadUrl(null);

    try {
      // @ts-ignore
      const stream: MediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(t => t.stop());
        toast({
          title: "Audio share needed",
          description: "When the share dialog opens, please tick 'Share audio' (Chrome/Edge on desktop). Mobile browsers don't support audio recording — use the Play button instead.",
          variant: "destructive",
        });
        return;
      }

      const audioOnly = new MediaStream(audioTracks);
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(audioOnly, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        toast({ title: "Recording ready ✓", description: "Click Download to save the podcast." });
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      toast({ title: "Recording...", description: "Podcast will play and record. Don't close the tab." });
      await playFrom(0);
      // small tail buffer
      setTimeout(() => {
        try { recorder.state !== "inactive" && recorder.stop(); } catch (_) {}
      }, 800);
    } catch (err: any) {
      setRecording(false);
      toast({
        title: "Recording not available",
        description: err?.message || "Your browser blocked screen/audio capture. Use the Play button to listen instead.",
        variant: "destructive",
      });
    }
  };

  const downloadTranscript = () => {
    if (!script) return;
    const tName = script.teacherName || "Teacher";
    const sName = script.studentName || "Student";
    const text = script.turns
      .map(t => `${t.speaker === "teacher" ? tName : sName}: ${t.text}`)
      .join("\n\n");
    const blob = new Blob([`${script.title}\n\n${text}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.title.replace(/[^a-z0-9]+/gi, "_")}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Generator card */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-primary/10 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Mic className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-sm sm:text-base">AI Study Podcast</h3>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              {script?.teacherName && script?.studentName
                ? `${script.teacherName} (teacher) & ${script.studentName} (student) explain & debate your notes.`
                : "A teacher & student duo explain & debate your notes in conversation. Hosts change every time!"}
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-foreground">
              Length: <span className="text-primary">{exchanges} exchanges</span>
            </label>
            <span className="text-[10px] text-muted-foreground">
              ~{Math.round(exchanges * 0.5)} min
            </span>
          </div>
          <Slider
            value={[exchanges]}
            onValueChange={(v) => setExchanges(v[0])}
            min={6}
            max={50}
            step={2}
            disabled={generating}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Short</span><span>Medium</span><span>Long</span>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || !hasSources}
          className="w-full gap-2 rounded-xl"
          size="lg"
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating podcast script...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> {script ? "Regenerate Podcast" : "Generate Podcast"}</>
          )}
        </Button>
      </div>

      {/* Player */}
      {script && (
        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-primary/10 space-y-4">
          <div>
            <h4 className="font-bold text-foreground text-sm sm:text-base truncate">🎙️ {script.title}</h4>
            <p className="text-[11px] text-muted-foreground">
              {script.turns.length} turns • Voices:{" "}
              <span className="text-foreground">{femaleVoice?.name || "default female"}</span> &{" "}
              <span className="text-foreground">{maleVoice?.name || "default male"}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon" variant="outline" onClick={handlePrev} disabled={!script || activeIndex <= 0} className="rounded-xl">
              <SkipBack className="w-4 h-4" />
            </Button>
            {isPlaying ? (
              <Button onClick={handlePause} className="gap-2 rounded-xl flex-1 sm:flex-none" size="lg">
                <Pause className="w-4 h-4" /> Pause
              </Button>
            ) : (
              <Button onClick={handlePlay} className="gap-2 rounded-xl flex-1 sm:flex-none" size="lg">
                <Play className="w-4 h-4" /> {isPaused ? "Resume" : activeIndex >= 0 && activeIndex < script.turns.length - 1 ? "Continue" : "Play"}
              </Button>
            )}
            <Button size="icon" variant="outline" onClick={handleStop} disabled={!isPlaying && !isPaused && activeIndex < 0} className="rounded-xl">
              <Square className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleNext} disabled={!script || activeIndex >= script.turns.length - 1} className="rounded-xl">
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={handleRecordAndDownload}
              disabled={recording || isPlaying}
              variant="secondary"
              className="gap-2 rounded-xl flex-1"
              size="sm"
            >
              {recording ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Recording...</>
              ) : (
                <><Mic className="w-3.5 h-3.5" /> Record audio (desktop)</>
              )}
            </Button>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={`${script.title.replace(/[^a-z0-9]+/gi, "_")}_podcast.webm`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-foreground px-3 py-2 text-xs font-medium hover:opacity-90"
              >
                <Download className="w-3.5 h-3.5" /> Download MP3
              </a>
            )}
            <Button
              onClick={downloadTranscript}
              variant="outline"
              className="gap-2 rounded-xl"
              size="sm"
            >
              <Download className="w-3.5 h-3.5" /> Transcript
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            💡 Audio recording uses your browser's screen-share (with audio). On Chrome/Edge desktop, tick "Share tab audio" in the prompt. On mobile, just use Play to listen — the transcript is always downloadable.
          </p>

          {/* Transcript live view */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {script.turns.map((turn, i) => {
              const isActive = i === activeIndex;
              const isTeacher = turn.speaker === "teacher";
              return (
                <button
                  key={i}
                  onClick={() => { handleStop(); setTimeout(() => playFrom(i), 100); }}
                  className={`w-full text-left flex gap-2.5 p-3 rounded-xl border transition-all ${
                    isActive
                      ? "bg-primary/10 border-primary/40 shadow-sm scale-[1.01]"
                      : "bg-background/50 border-border/40 hover:bg-background/80"
                  }`}
                >
                  <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${
                    isTeacher ? "bg-pink-500/15 text-pink-600" : "bg-blue-500/15 text-blue-600"
                  }`}>
                    {isTeacher ? <GraduationCap className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-semibold ${isTeacher ? "text-pink-600" : "text-blue-600"}`}>
                      {isTeacher ? (script?.teacherName || "Teacher") : (script?.studentName || "Student")}
                      {isActive && <span className="ml-2 inline-flex items-center gap-1 text-[9px] text-primary animate-pulse">● Speaking</span>}
                    </p>
                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed mt-0.5">{turn.text}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!script && !generating && (
        <div className="text-center py-8 glass-card rounded-2xl">
          <Mic className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">
            {hasSources ? "Click Generate to create your AI podcast" : "Add sources first, then generate a podcast"}
          </p>
        </div>
      )}
    </div>
  );
};

export default StudyBlasterPodcast;