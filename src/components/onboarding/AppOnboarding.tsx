import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  MessageSquareText,
  Zap,
  ClipboardList,
  BarChart3,
  Trophy,
  MessageCircleHeart,
  ChevronRight,
  ChevronLeft,
  Check,
} from "lucide-react";

interface Slide {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
  accent: string; // tailwind gradient classes for the icon plate
}

const SLIDES: Slide[] = [
  {
    icon: <Sparkles className="w-7 h-7" />,
    eyebrow: "Welcome",
    title: "Namaste! This is Gyanam AI.",
    body:
      "Your personal AI study partner built for Indian students of Classes 6–12. A quick 60-second tour before you start.",
    accent: "from-primary/30 to-primary/10",
  },
  {
    icon: <MessageSquareText className="w-7 h-7" />,
    eyebrow: "Feature 1",
    title: "Study Chat — Ask anything, anytime",
    body:
      "A 24/7 AI tutor that explains NCERT concepts step-by-step in simple English (or Hindi if you ask). Every reply ends with a Quick Recap and a Check-Your-Understanding question so learning actually sticks.",
    bullets: [
      "Doubt-solving in seconds",
      "Worked examples for maths & science",
      "Voice replies for on-the-go learning",
    ],
    accent: "from-blue-400/30 to-blue-500/10",
  },
  {
    icon: <Zap className="w-7 h-7" />,
    eyebrow: "Feature 2",
    title: "Study Blaster — Learn from YOUR notes",
    body:
      "Upload your PDF, DOCX or paste a YouTube link. The AI reads it, teaches only from that material, generates MCQ practice, and can even turn it into a two-voice podcast for revision.",
    bullets: [
      "PDF / DOCX / YouTube sources",
      "Grounded answers — no hallucinations",
      "Auto-quizzes + audio podcast",
    ],
    accent: "from-yellow-400/30 to-orange-500/10",
  },
  {
    icon: <ClipboardList className="w-7 h-7" />,
    eyebrow: "Feature 3",
    title: "Exam Prep — Full-syllabus plan",
    body:
      "Upload your complete syllabus PDF. The AI extracts every chapter, ranks importance by board pattern, and builds a day-by-day priority plan so you know exactly what to study today.",
    bullets: [
      "Auto chapter + weightage detection",
      "Personalised daily study plan",
      "Virtual exam mode with report",
    ],
    accent: "from-purple-400/30 to-fuchsia-500/10",
  },
  {
    icon: <BarChart3 className="w-7 h-7" />,
    eyebrow: "Your Score",
    title: "WPS — Weekly Performance Score",
    body:
      "A single 0–100 number that shows how well you studied this week. It updates every week and is calculated from 4 equal pillars (25% each):",
    bullets: [
      "⏱ Study Time — target 7 hrs/week",
      "📚 Topics Completed — target 3 chapters/week",
      "🎯 MCQ Accuracy — average of the week's quizzes",
      "📅 Consistency — unique days you studied out of 7",
    ],
    accent: "from-emerald-400/30 to-teal-500/10",
  },
  {
    icon: <Check className="w-7 h-7" />,
    eyebrow: "How WPS unlocks",
    title: "The Weekly Test",
    body:
      "Once a week, Gyanam auto-generates a short MCQ test from the topics you studied. Finish it and your WPS for that week is locked in — plus you'll get a list of weak subjects to focus on next.",
    bullets: [
      "Auto-created from your study history",
      "10–15 questions, ~10 minutes",
      "Reveals weak topics + updates WPS",
    ],
    accent: "from-rose-400/30 to-pink-500/10",
  },
  {
    icon: <Trophy className="w-7 h-7" />,
    eyebrow: "Feature 5",
    title: "Rankings & Rewards",
    body:
      "Compete healthily on your school and district leaderboards. Weekly ranks, streaks and achievement badges keep the motivation high.",
    accent: "from-amber-400/30 to-yellow-500/10",
  },
  {
    icon: <MessageCircleHeart className="w-7 h-7" />,
    eyebrow: "Feature 6",
    title: "Parents stay in the loop",
    body:
      "Every week your parents get a clean PDF report on WhatsApp — WPS, strengths, weak topics and time studied. Full transparency, zero nagging.",
    accent: "from-green-400/30 to-emerald-500/10",
  },
  {
    icon: <Sparkles className="w-7 h-7" />,
    eyebrow: "You're set",
    title: "Let's start learning ✨",
    body:
      "Open Study Chat for a doubt, Study Blaster for your notes, or Exam Prep for a plan. Study a little every day — the WPS will take care of the rest.",
    accent: "from-primary/30 to-primary/10",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

const ONBOARDING_KEY = "gyanam_onboarding_v1_done";

export const hasSeenOnboarding = () => {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return true;
  }
};

export const markOnboardingSeen = () => {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // ignore
  }
};

const AppOnboarding = ({ open, onClose }: Props) => {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  const finish = () => {
    markOnboardingSeen();
    onClose();
  };

  const next = () => {
    if (isLast) finish();
    else setIdx((i) => Math.min(SLIDES.length - 1, i + 1));
  };
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) finish();
      }}
    >
      <DialogContent className="p-0 gap-0 max-w-md w-[calc(100vw-1.5rem)] rounded-3xl overflow-hidden border border-border/60 bg-background">
        {/* Skip */}
        <div className="flex items-center justify-between px-5 pt-5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {slide.eyebrow}
          </span>
          <button
            onClick={finish}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Icon plate */}
        <div className="px-5 pt-5">
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${slide.accent} border border-border/50 flex items-center justify-center text-foreground shadow-sm`}
          >
            {slide.icon}
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pt-4 pb-5">
          <h2 className="text-[20px] leading-tight font-bold font-display text-foreground">
            {slide.title}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            {slide.body}
          </p>

          {slide.bullets && (
            <ul className="mt-4 space-y-2">
              {slide.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 text-[13.5px] text-foreground/90"
                >
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Progress dots */}
        <div className="px-5">
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === idx
                    ? "w-6 bg-primary"
                    : i < idx
                    ? "w-3 bg-primary/50"
                    : "w-3 bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 mt-2 border-t border-border/60 bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={idx === 0}
            className="disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <span className="text-[11px] font-medium text-muted-foreground">
            {idx + 1} / {SLIDES.length}
          </span>
          <Button size="sm" onClick={next} className="min-w-[92px]">
            {isLast ? "Let's go" : "Next"}
            {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppOnboarding;