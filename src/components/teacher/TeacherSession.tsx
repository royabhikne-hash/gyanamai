import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Check, RefreshCw, BookOpen, Brain, ClipboardList, PencilLine, Zap, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { DailyPlan, PlanStep } from "./TeacherHome";
import { doneReactions, finalReactions, refuseSkipLines, pickLine } from "./teacherVoice";

const stepIcon: Record<PlanStep["type"], any> = {
  revision: RefreshCw,
  teach: BookOpen,
  mcq: Brain,
  notebook: PencilLine,
  homework_review: ClipboardList,
  flashcards: Zap,
};

// Teacher-voice: never expose tool names.
const stepLabel: Record<PlanStep["type"], string> = {
  revision: "Quick recap",
  teach: "New lesson",
  mcq: "Let's practice",
  notebook: "Write it down",
  homework_review: "Homework check",
  flashcards: "Memory check",
};

const stepCta: Record<PlanStep["type"], string> = {
  revision: "Start recap",
  teach: "Begin lesson",
  mcq: "Let's practice",
  notebook: "Open notebook",
  homework_review: "Show me your work",
  flashcards: "Quick memory check",
};

const routeForStep = (s: PlanStep): string | null => {
  if (s.type === "mcq") return "/mcq-practice";
  if (s.type === "teach" || s.type === "revision" || s.type === "homework_review") return "/study";
  if (s.type === "flashcards") return "/study-blaster";
  if (s.type === "notebook") return "/study";
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
  const isLast = idx >= plan.steps.length - 1;
  const allDone = plan.completed_steps.length >= plan.steps.length;

  // Teacher's live reaction between steps ("Hmm — nicely done.").
  const [reaction, setReaction] = useState<string | null>(null);
  // Pushback if student tries to exit mid-session without finishing.
  const [pushback, setPushback] = useState<string | null>(null);

  // Phase 3: proactively surface next tool. We do NOT auto-navigate (would rip
  // the student out of the session context); we highlight the primary CTA and
  // pre-warm a soft hint after 1s of viewing the step.
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => {
    setHintVisible(false);
    const t = setTimeout(() => setHintVisible(true), 1200);
    return () => clearTimeout(t);
  }, [idx]);

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

    // Teacher reacts, briefly. Feels alive; not just "next".
    const line = isLast || nextDone.length >= plan.steps.length
      ? pickLine(finalReactions)
      : pickLine(doneReactions);
    setReaction(line);
    // Advance to the next step after the reaction sits for ~1.4s.
    if (idx < plan.steps.length - 1) {
      setTimeout(() => {
        setReaction(null);
        setIdx(idx + 1);
      }, 1400);
    } else {
      setTimeout(() => setReaction(null), 4000);
    }
  };

  const openTool = () => {
    const r = routeForStep(step);
    if (r) navigate(`${r}?topic=${encodeURIComponent(step.topic)}${step.subject ? `&subject=${encodeURIComponent(step.subject)}` : ""}`);
  };

  const handleExit = () => {
    // Teacher pushes back if student leaves before finishing — but only once.
    const completed = plan.completed_steps.length;
    if (!allDone && !pushback && Math.random() < 0.7 && completed < plan.steps.length) {
      setPushback(pickLine(refuseSkipLines));
      return;
    }
    onExit();
  };

  return (
    <section aria-labelledby="teacher-session-title" className="rounded-3xl border border-border/60 bg-background overflow-hidden shadow-sm">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
        <Button variant="ghost" size="icon" onClick={handleExit} aria-label="Back" className="min-h-11 min-w-11">
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

      {pushback && (
        <div className="px-4 sm:px-6 pt-4">
          <Card className="p-3 border-primary/30 bg-primary/5 animate-fade-in">
            <p className="text-sm text-foreground leading-relaxed">{pushback}</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => setPushback(null)} className="rounded-xl">
                Okay, I'll stay
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setPushback(null); onExit(); }} className="rounded-xl">
                Leave anyway
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="p-6 sm:p-8">
        <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-4">
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-[11px] font-medium tracking-wide uppercase text-primary/80 mb-1">
          {stepLabel[step.type] ?? "Session"} · {step.minutes} min
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

        {reaction && (
          <Card className="p-4 mt-4 border-primary/30 bg-primary/10 animate-fade-in">
            <p className="text-sm text-foreground font-medium leading-relaxed">{reaction}</p>
          </Card>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          {routeForStep(step) && (
            <Button
              onClick={openTool}
              size="lg"
              className={`rounded-2xl min-h-11 flex-1 transition-transform ${hintVisible ? "ring-2 ring-primary/40 scale-[1.02]" : ""}`}
            >
              {stepCta[step.type] ?? "Continue with me"} <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          )}
          <Button
            onClick={markDone}
            size="lg"
            variant={done ? "secondary" : "outline"}
            className="rounded-2xl min-h-11 flex-1"
          >
            <Check className="w-4 h-4 mr-1.5" />
            {done ? "Nicely done" : isLast ? "Finish for today" : "Done — next"}
          </Button>
        </div>

        {allDone && (
          <Card className="p-4 mt-5 bg-primary/5 border-primary/20">
            <p className="text-sm text-foreground leading-relaxed">
              Today's work is complete. I noticed where you hesitated — I'll adjust tomorrow's session for that. Enjoy your evening.
            </p>
          </Card>
        )}
      </div>
    </section>
  );
};

export default TeacherSession;