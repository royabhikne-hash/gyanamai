import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Play, RefreshCw, BookOpen, Brain, ClipboardList, PencilLine, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import TeacherSession from "./TeacherSession";
import { thinkingLines, proactiveNote, pickLine } from "./teacherVoice";
import { askBrain } from "@/lib/teacherBrain";

export type PlanStep = {
  type: "revision" | "teach" | "mcq" | "notebook" | "homework_review" | "flashcards";
  subject?: string;
  topic: string;
  minutes: number;
  reason?: string;
};

export type DailyPlan = {
  id: string;
  greeting: string;
  recap: string;
  steps: PlanStep[];
  total_minutes: number;
  completed_steps: number[];
  status: string;
};

const stepIcon: Record<PlanStep["type"], any> = {
  revision: RefreshCw,
  teach: BookOpen,
  mcq: Brain,
  notebook: PencilLine,
  homework_review: ClipboardList,
  flashcards: Zap,
};

// Teacher-voice labels — student never sees tool names.
const stepLabel: Record<PlanStep["type"], string> = {
  revision: "Quick recap",
  teach: "New lesson",
  mcq: "Let's practice",
  notebook: "Write it down",
  homework_review: "Homework check",
  flashcards: "Memory check",
};

const TeacherHome = ({ studentId, studentName }: { studentId: string; studentName: string }) => {
  const { language } = useLanguage();
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  // Behavior layer: teacher "thinks" before revealing anything.
  const [thinking, setThinking] = useState(true);
  const [thinkingLine] = useState(() => pickLine(thinkingLines));
  const [dots, setDots] = useState("");
  const [refuseMsg, setRefuseMsg] = useState<string | null>(null);
  const [recallMsg, setRecallMsg] = useState<string | null>(null);
  const revealedOnce = useRef(false);

  const loadPlan = async (force = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-plan", {
        body: { student_id: studentId, force },
        headers: { "x-lang": language },
      });
      if (!error && data?.plan) setPlan(data.plan as DailyPlan);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) loadPlan(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Ask the brain for ONE specific recall line (references real past mistakes).
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    askBrain(studentId, "daily_recall", {}, language).then((d) => {
      if (!cancelled && d.speech) setRecallMsg(d.speech);
    });
    return () => { cancelled = true; };
  }, [studentId, language]);

  // Animated typing dots while the teacher "thinks".
  useEffect(() => {
    if (!thinking) return;
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 400);
    return () => clearInterval(t);
  }, [thinking]);

  // Reveal the plan only after (a) data is loaded and (b) at least ~2.4s
  // of "thinking" — but only the first time in this session.
  useEffect(() => {
    if (!plan || revealedOnce.current) return;
    const t = setTimeout(() => {
      setThinking(false);
      revealedOnce.current = true;
    }, 2400);
    return () => clearTimeout(t);
  }, [plan]);

  const hasStarted = !!plan && (plan.completed_steps?.length ?? 0) > 0;
  const allDone = !!plan && (plan.completed_steps?.length ?? 0) >= plan.steps.length;
  const note = plan ? proactiveNote({ name: studentName.split(" ")[0], hasStarted, allDone }) : "";

  const handleRethink = async () => {
    // Reason-based refusal — no RNG. Brain looks at plan state, homework, mistakes.
    const d = await askBrain(studentId, "should_refuse_replan", {}, language);
    if (d.decision === "refuse") {
      setRefuseMsg(d.speech || "Let's not change today's plan yet.");
      setTimeout(() => setRefuseMsg(null), 7000);
      return;
    }
    setThinking(true);
    revealedOnce.current = false;
    loadPlan(true);
  };

  if ((loading && !plan) || thinking) {
    return (
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-8 min-h-[220px] flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <p className="text-[11px] font-medium tracking-wide uppercase text-primary/80 mb-1">Your Teacher</p>
          <p className="text-base sm:text-lg font-medium text-foreground leading-relaxed">
            {thinkingLine}
            <span className="text-primary inline-block w-6 text-left">{dots}</span>
          </p>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  if (running) {
    return (
      <TeacherSession
        plan={plan}
        studentId={studentId}
        onExit={() => { setRunning(false); loadPlan(false); }}
        onPlanUpdate={(p) => setPlan(p)}
      />
    );
  }

  return (
    <section aria-labelledby="teacher-home-title" className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/8 via-background to-background p-5 sm:p-7 shadow-sm">
      <header className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium tracking-wide uppercase text-primary/80">Your Teacher</p>
          <h1 id="teacher-home-title" className="text-lg sm:text-xl font-bold text-foreground font-display leading-tight">
            {plan.greeting || `Good to see you, ${studentName}.`}
          </h1>
          {plan.recap && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{plan.recap}</p>}
          {recallMsg && (
            <p className="text-[13px] text-foreground/85 mt-2 leading-relaxed animate-fade-in border-l-2 border-primary/50 pl-3">
              {recallMsg}
            </p>
          )}
          {note && (
            <p className="text-[13px] text-primary/90 mt-2 leading-relaxed animate-fade-in">
              {note}
            </p>
          )}
        </div>
      </header>

      <p className="text-sm text-foreground/80 mt-4 mb-2 italic">
        Today we'll do this together —
      </p>
      <ol className="space-y-2" aria-label="Today's session">
        {plan.steps.map((s, i) => {
          const Icon = stepIcon[s.type] ?? BookOpen;
          const done = plan.completed_steps.includes(i);
          return (
            <li key={i}>
              <Card className={`p-3 flex items-center gap-3 border-border/50 ${done ? "opacity-60" : ""}`}>
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.topic}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {s.subject ? `${s.subject} · ` : ""}{s.minutes} min · {stepLabel[s.type] ?? "Session"}
                  </p>
                </div>
                {done && <span className="text-[10px] font-semibold text-primary">Done</span>}
              </Card>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-[12px] text-muted-foreground italic leading-relaxed border-l-2 border-primary/40 pl-3">
        You don't have to figure out what to study next. That's my job.
      </p>

      {refuseMsg && (
        <Card className="mt-4 p-3 border-primary/30 bg-primary/5 animate-fade-in">
          <p className="text-sm text-foreground leading-relaxed">{refuseMsg}</p>
        </Card>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-muted-foreground">Time together today</p>
          <p className="text-sm font-bold text-foreground">{plan.total_minutes} min</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleRethink} aria-label="Rethink today">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="lg" onClick={() => setRunning(true)} className="rounded-2xl min-h-11">
            <Play className="w-4 h-4 mr-1.5" />
            Let's begin
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TeacherHome;