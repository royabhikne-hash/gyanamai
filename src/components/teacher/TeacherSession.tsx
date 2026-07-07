import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Check, RefreshCw, BookOpen, Brain, ClipboardList, PencilLine, Zap, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { DailyPlan, PlanStep } from "./TeacherHome";

const stepIcon: Record<PlanStep["type"], any> = {
  revision: RefreshCw,
  teach: BookOpen,
  mcq: Brain,
  notebook: PencilLine,
  homework_review: ClipboardList,
  flashcards: Zap,
};

const routeForStep = (s: PlanStep): string | null => {
  if (s.type === "mcq") return "/mcq-practice";
  if (s.type === "teach" || s.type === "revision" || s.type === "homework_review") return "/study";
  if (s.type === "flashcards") return "/study-blaster";
  return null;
};

const TeacherSession = ({
  plan,
  studentId,
  onExit,
  onPlanUpdate,
}: {
  plan: DailyPlan;
  studentId: string;
  onExit: () => void;
  onPlanUpdate: (p: DailyPlan) => void;
}) => {
  const navigate = useNavigate();
  const firstPending = plan.steps.findIndex((_, i) => !plan.completed_steps.includes(i));
  const [idx, setIdx] = useState(firstPending === -1 ? 0 : firstPending);

  const step = plan.steps[idx];
  const Icon = stepIcon[step.type] ?? BookOpen;
  const done = plan.completed_steps.includes(idx);

  const markDone = async () => {
    const nextDone = Array.from(new Set([...(plan.completed_steps ?? []), idx]));
    const nextStatus = nextDone.length >= plan.steps.length ? "completed" : "in_progress";
    const { data } = await supabase
      .from("daily_plans")
      .update({ completed_steps: nextDone, status: nextStatus })
      .eq("id", plan.id)
      .select()
      .single();
    if (data) onPlanUpdate(data as unknown as DailyPlan);

    // fire-and-forget observation
    supabase.from("student_observations").insert({
      student_id: studentId,
      source: "teacher_session",
      session_length_minutes: step.minutes,
      time_of_day: new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : new Date().getHours() < 21 ? "evening" : "night",
      meta: { step_type: step.type, topic: step.topic, subject: step.subject },
    });

    if (idx < plan.steps.length - 1) setIdx(idx + 1);
  };

  const openTool = () => {
    const r = routeForStep(step);
    if (r) navigate(`${r}?topic=${encodeURIComponent(step.topic)}${step.subject ? `&subject=${encodeURIComponent(step.subject)}` : ""}`);
  };

  return (
    <section aria-labelledby="teacher-session-title" className="rounded-3xl border border-border/60 bg-background overflow-hidden shadow-sm">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label="Back to plan" className="min-h-11 min-w-11">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <p className="text-[11px] text-muted-foreground flex-1">
          Step {idx + 1} of {plan.steps.length}
        </p>
        <div className="flex gap-1">
          {plan.steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-primary" : plan.completed_steps.includes(i) ? "w-3 bg-primary/70" : "w-3 bg-border"}`}
            />
          ))}
        </div>
      </header>

      <div className="p-6 sm:p-8">
        <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-4">
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-[11px] font-medium tracking-wide uppercase text-primary/80 mb-1">
          {step.type.replace("_", " ")} · {step.minutes} min
        </p>
        <h2 id="teacher-session-title" className="text-2xl font-bold text-foreground font-display leading-tight">
          {step.topic}
        </h2>
        {step.subject && <p className="text-sm text-muted-foreground mt-1">Subject: {step.subject}</p>}
        {step.reason && (
          <Card className="p-4 mt-5 bg-primary/5 border-primary/20">
            <p className="text-sm text-foreground leading-relaxed">{step.reason}</p>
          </Card>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          {routeForStep(step) && (
            <Button onClick={openTool} size="lg" className="rounded-2xl min-h-11 flex-1">
              Open <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          )}
          <Button
            onClick={markDone}
            size="lg"
            variant={done ? "secondary" : "outline"}
            className="rounded-2xl min-h-11 flex-1"
          >
            <Check className="w-4 h-4 mr-1.5" />
            {done ? "Marked done" : "Mark done & continue"}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TeacherSession;