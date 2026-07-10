// Client wrapper for the TeacherBrain edge function.
// Every reaction, refusal, or interruption goes through this — never Math.random().

import { supabase } from "@/integrations/supabase/client";

export type BrainAction =
  | "daily_recall"
  | "should_refuse_replan"
  | "should_refuse_exit"
  | "react_to_answer"
  | "step_reaction";

export type BrainDecision = {
  decision: "allow" | "refuse" | "react";
  reason: string;
  evidence: string[];
  speech: string;
};

export async function askBrain(
  studentId: string,
  action: BrainAction,
  payload: Record<string, unknown> = {},
  language = "en",
): Promise<BrainDecision> {
  try {
    const { data, error } = await supabase.functions.invoke("teacher-brain", {
      body: { student_id: studentId, action, payload },
      headers: { "x-lang": language },
    });
    if (error || !data) throw error ?? new Error("no data");
    return data as BrainDecision;
  } catch {
    // Silent-allow fallback — the teacher never blocks the student due to an outage.
    return { decision: "allow", reason: "client_error", evidence: [], speech: "" };
  }
}