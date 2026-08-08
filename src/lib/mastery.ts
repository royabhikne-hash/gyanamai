// Client-side display helpers for the Understanding / Effort tracking system.
// Understanding = evidence quality. Effort = work done. Never blended.

export type Confidence = "low" | "medium" | "high";
export type MasteryTrend = "improving" | "declining" | "stable" | "unknown";

export interface TopicMasteryRow {
  id: string;
  subject: string;
  topic: string;
  mastery_score: number;
  understanding_score: number | null;
  attempt_count: number;
  confidence: Confidence | null;
  trend: string | null;
  last_practiced: string;
  mcq_count?: number | null;
  test_count?: number | null;
  chatbot_count?: number | null;
}

const DECAY_DAYS = 14;
const MAX_DECAY = 15;

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Untouched topics quietly fade — we surface a revision nudge instead of pretending nothing changed. */
export function applyDecay(score: number, lastPracticed: string) {
  const days = daysSince(lastPracticed);
  if (days < DECAY_DAYS) return { score: Math.round(score), decayed: false, days };
  const blocks = Math.floor(days / DECAY_DAYS);
  const penalty = Math.min(MAX_DECAY, blocks * 5);
  return { score: Math.max(0, Math.round(score - penalty)), decayed: true, days };
}

export function confidenceOf(row: TopicMasteryRow): Confidence {
  if (row.confidence) return row.confidence;
  return row.attempt_count >= 8 ? "high" : row.attempt_count >= 3 ? "medium" : "low";
}

export function confidenceLabel(row: TopicMasteryRow): string {
  const c = confidenceOf(row);
  if (c === "low") return "Limited data — keep practicing";
  if (c === "medium") return `Based on ${row.attempt_count} answers`;
  return `High confidence · ${row.attempt_count} answers`;
}

export function evidenceComposition(row: TopicMasteryRow): string {
  const parts: string[] = [];
  if (row.test_count) parts.push(`${row.test_count} test`);
  if (row.mcq_count) parts.push(`${row.mcq_count} MCQ`);
  if (row.chatbot_count) parts.push(`${row.chatbot_count} tutor check`);
  return parts.join(" + ");
}

export function trendOf(row: TopicMasteryRow): MasteryTrend {
  const t = (row.trend || "unknown") as MasteryTrend;
  if (row.attempt_count < 3) return "unknown";
  return ["improving", "declining", "stable"].includes(t) ? t : "unknown";
}

export interface UnderstandingView {
  score: number;
  showScore: boolean;
  confidence: Confidence;
  confidenceLabel: string;
  composition: string;
  trend: MasteryTrend;
  trendLabel: string;
  decayed: boolean;
  daysIdle: number;
}

export function understandingView(row: TopicMasteryRow): UnderstandingView {
  const raw = row.understanding_score ?? row.mastery_score ?? 0;
  const { score, decayed, days } = applyDecay(raw, row.last_practiced);
  const trend = trendOf(row);
  return {
    score,
    showScore: confidenceOf(row) !== "low",
    confidence: confidenceOf(row),
    confidenceLabel: confidenceLabel(row),
    composition: evidenceComposition(row),
    trend,
    trendLabel:
      trend === "unknown"
        ? "Not enough data yet"
        : trend === "improving"
        ? "Improving"
        : trend === "declining"
        ? "Declining"
        : "Stable",
    decayed,
    daysIdle: days,
  };
}

// ===== Effort score (no accuracy anywhere in here) =====
export interface EffortInputs {
  studyMinutes: number;
  activeDays: number;
  chaptersCovered: number;
  examTasksCompleted: number;
  examTasksTotal: number;
}

export function calculateEffort(i: EffortInputs): number {
  const time = Math.min(100, (i.studyMinutes / 420) * 100);
  const consistency = Math.min(100, (i.activeDays / 7) * 100);
  const chapters = Math.min(100, (i.chaptersCovered / 3) * 100);
  const tasks = i.examTasksTotal > 0 ? Math.min(100, (i.examTasksCompleted / i.examTasksTotal) * 100) : 0;
  const parts = i.examTasksTotal > 0 ? [time, consistency, chapters, tasks] : [time, consistency, chapters];
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

// ===== Effort x Understanding matrix =====
export type MatrixCell = "on_track" | "needs_teaching" | "coasting" | "at_risk" | "unknown";

export interface MatrixResult {
  cell: MatrixCell;
  label: string;
  detail: string;
  tone: "success" | "warning" | "danger" | "muted";
}

export function classifyMatrix(
  understanding: number,
  effort: number,
  confidence: Confidence,
): MatrixResult {
  if (confidence === "low") {
    return {
      cell: "unknown",
      label: "Building a picture",
      detail: "Not enough practice yet to judge understanding.",
      tone: "muted",
    };
  }
  const highU = understanding >= 60;
  const highE = effort >= 50;
  if (highU && highE)
    return { cell: "on_track", label: "On Track", detail: "Working hard and understanding it.", tone: "success" };
  if (!highU && highE)
    return { cell: "needs_teaching", label: "Needs Teaching Help", detail: "Working hard, not clicking yet.", tone: "warning" };
  if (highU && !highE)
    return { cell: "coasting", label: "Coasting", detail: "Understands it, but effort is dropping.", tone: "warning" };
  return { cell: "at_risk", label: "At Risk", detail: "Low effort and low understanding — flag both.", tone: "danger" };
}
