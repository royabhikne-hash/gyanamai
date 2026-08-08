import { TrendingUp, TrendingDown, Minus, HelpCircle, AlarmClock } from "lucide-react";
import { TopicMasteryRow, understandingView } from "@/lib/mastery";

interface Props {
  topics: TopicMasteryRow[];
  limit?: number;
  title?: string;
}

const barColor = (score: number) =>
  score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";

const TopicUnderstandingList = ({ topics, limit = 12, title = "Understanding by Topic" }: Props) => {
  if (topics.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{topics.length} topics tracked</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Driven by tests and MCQs. Tutor chat counts only a little.
      </p>
      <div className="space-y-4">
        {topics.slice(0, limit).map((tm) => {
          const v = understandingView(tm);
          return (
            <div key={tm.id} className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium truncate">{tm.topic}</span>
                {v.trend === "improving" && <TrendingUp className="w-3 h-3 text-green-500 shrink-0" />}
                {v.trend === "declining" && <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />}
                {v.trend === "stable" && <Minus className="w-3 h-3 text-muted-foreground shrink-0" />}
                {v.trend === "unknown" && <HelpCircle className="w-3 h-3 text-muted-foreground shrink-0" />}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor(v.score)} ${v.showScore ? "" : "opacity-40"}`}
                    style={{ width: `${v.score}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-semibold tabular-nums w-11 text-right ${
                    v.showScore ? "" : "text-muted-foreground italic"
                  }`}
                >
                  {v.showScore ? `${v.score}%` : "~"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {tm.subject} · {v.confidenceLabel}
                {v.composition ? ` (${v.composition})` : ""}
              </p>
              {v.trend === "unknown" && (
                <p className="text-[11px] text-muted-foreground">Trend: not enough data yet</p>
              )}
              {v.decayed && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                  <AlarmClock className="w-3 h-3" /> Needs revision — untouched for {v.daysIdle} days
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TopicUnderstandingList;
