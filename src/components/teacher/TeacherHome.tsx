import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Play, RefreshCw, BookOpen, Brain, ClipboardList, PencilLine, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import TeacherSession from "./TeacherSession";

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

const TeacherHome = ({ studentId, studentName }: { studentId: string; studentName: string }) => {
  const { language } = useLanguage();
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

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

  if (loading && !plan) {
    return (
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-6 min-h-[220px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
          <p className="text-[11px] font-medium tracking-wide uppercase text-primary/80">Your AI Tutor</p>
          <h1 id="teacher-home-title" className="text-lg sm:text-xl font-bold text-foreground font-display leading-tight">
            {plan.greeting || `Hi ${studentName}, ready to learn?`}
          </h1>
          {plan.recap && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{plan.recap}</p>}
        </div>
      </header>

      <ol className="space-y-2 mt-4" aria-label="Today's study plan">
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
                    {s.subject ? `${s.subject} · ` : ""}{s.minutes} min · {s.type.replace("_", " ")}
                  </p>
                </div>
                {done && <span className="text-[10px] font-semibold text-primary">Done</span>}
              </Card>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-muted-foreground">Total today</p>
          <p className="text-sm font-bold text-foreground">{plan.total_minutes} min</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => loadPlan(true)} aria-label="Regenerate plan">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="lg" onClick={() => setRunning(true)} className="rounded-2xl min-h-11">
            <Play className="w-4 h-4 mr-1.5" />
            Start learning
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TeacherHome;