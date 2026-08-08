// Gyanam evidence-based mastery engine.
// Understanding = objective evidence (tests/MCQs heavily, chatbot lightly).
// Never blended with effort.

export type EvidenceSource = "weekly_test" | "mcq" | "chatbot_check";
export type Difficulty = "easy" | "medium" | "hard";

export interface Evidence {
  source: EvidenceSource;
  /** 0..1 correctness for this evidence item */
  correct: number;
  difficulty: Difficulty;
  at: string;
}

/** How much we trust each signal source. */
export const SOURCE_RELIABILITY: Record<EvidenceSource, number> = {
  weekly_test: 1.0,
  mcq: 0.85,
  chatbot_check: 0.25,
};

export const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 0.7,
  medium: 1.0,
  hard: 1.4,
};

/** Recency weights for the rolling window (newest first). */
const RECENCY = [1.0, 0.8, 0.6, 0.45, 0.35];
const WINDOW = 5;
const GUESS_RATE = 0.25; // 4-option MCQ

export function normalizeDifficulty(d: unknown): Difficulty {
  const v = String(d || "").toLowerCase();
  return v === "easy" || v === "hard" ? v : "medium";
}

/** Guess-correction: a single lucky MCQ should barely move the estimate. */
function guessCorrect(source: EvidenceSource, correct: number): number {
  if (source === "chatbot_check") return Math.max(0, Math.min(1, correct));
  const adjusted = (correct - GUESS_RATE) / (1 - GUESS_RATE);
  return Math.max(0, Math.min(1, adjusted));
}

export interface MasteryState {
  understanding: number; // 0-100
  alpha: number;
  beta: number;
  evidence: Evidence[];
  attemptCount: number;
  confidence: "low" | "medium" | "high";
  trend: "improving" | "declining" | "stable" | "unknown";
}

/**
 * Recompute the Bayesian estimate from the rolling window of recent evidence.
 * Prior of alpha=beta=2 keeps single data points near 50% (slip/guess tolerant).
 */
export function recompute(allEvidence: Evidence[], totalAttempts: number): MasteryState {
  const evidence = allEvidence.slice(-WINDOW);
  let alpha = 2;
  let beta = 2;

  // newest = index 0 of reversed list
  const newestFirst = [...evidence].reverse();
  newestFirst.forEach((e, i) => {
    const w =
      (RECENCY[i] ?? 0.3) *
      SOURCE_RELIABILITY[e.source] *
      DIFFICULTY_WEIGHT[normalizeDifficulty(e.difficulty)];
    const p = guessCorrect(e.source, e.correct);
    alpha += w * p;
    beta += w * (1 - p);
  });

  const understanding = Math.round((alpha / (alpha + beta)) * 100);

  const confidence: MasteryState["confidence"] =
    totalAttempts >= 8 ? "high" : totalAttempts >= 3 ? "medium" : "low";

  let trend: MasteryState["trend"] = "unknown";
  if (evidence.length >= 3) {
    const recent = evidence.slice(-2);
    const prior = evidence.slice(0, -2);
    const avg = (xs: Evidence[]) => xs.reduce((a, b) => a + b.correct, 0) / xs.length;
    const diff = avg(recent) - avg(prior);
    trend = diff > 0.1 ? "improving" : diff < -0.1 ? "declining" : "stable";
  }

  return { understanding, alpha, beta, evidence, attemptCount: totalAttempts, confidence, trend };
}
