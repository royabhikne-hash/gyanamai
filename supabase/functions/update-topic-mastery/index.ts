import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Evidence,
  EvidenceSource,
  normalizeDifficulty,
  recompute,
} from "../_shared/mastery.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface IncomingEvidence {
  subject: string;
  topic: string;
  source: EvidenceSource;
  correct: number; // 0..1
  difficulty?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const jwt = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(jwt);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: studentRow } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", claimsData.claims.sub)
      .maybeSingle();
    if (!studentRow?.id) return json({ error: "Student profile not found" }, 403);
    const studentId = studentRow.id;

    const body = await req.json();
    const { source, sessionData, testData, questionResults } = body ?? {};

    const incoming: IncomingEvidence[] = [];

    // ---- 1. Per-question evidence (weekly test / MCQ practice) ----
    if (Array.isArray(questionResults)) {
      for (const q of questionResults) {
        const subject = String(q.subject || "General").trim();
        const topic = String(q.topic || subject).trim();
        if (!topic) continue;
        incoming.push({
          subject,
          topic,
          source: source === "weekly_test" ? "weekly_test" : "mcq",
          correct: q.correct ? 1 : 0,
          difficulty: normalizeDifficulty(q.difficulty),
        });
      }
    }

    // ---- 2. Chatbot / study session judgments (low reliability) ----
    if ((source === "study_session" || source === "quiz") && sessionData) {
      const subject = String(sessionData.subject || sessionData.topic || "General").trim();
      const understandingMap: Record<string, number> = {
        weak: 0.2, average: 0.5, good: 0.75, excellent: 0.95,
      };

      for (const topic of sessionData.strongAreas ?? []) {
        if (topic?.trim()) {
          incoming.push({ subject, topic: topic.trim(), source: "chatbot_check", correct: 0.8, difficulty: "medium" });
        }
      }
      for (const topic of sessionData.weakAreas ?? []) {
        if (topic?.trim()) {
          incoming.push({ subject, topic: topic.trim(), source: "chatbot_check", correct: 0.25, difficulty: "medium" });
        }
      }

      const topicName = sessionData.topic;
      if (topicName && topicName !== "General Study") {
        if (source === "quiz" && typeof sessionData.accuracy === "number") {
          // A real quiz is objective evidence, not a chatbot judgment.
          incoming.push({ subject, topic: topicName, source: "mcq", correct: sessionData.accuracy / 100, difficulty: "medium" });
        } else {
          incoming.push({
            subject,
            topic: topicName,
            source: "chatbot_check",
            correct: understandingMap[sessionData.understandingLevel] ?? 0.5,
            difficulty: "medium",
          });
        }
      }
    }

    // ---- 3. Weekly test subject-level fallback (when no per-question topics) ----
    if (source === "weekly_test" && testData && !Array.isArray(questionResults)) {
      const results = testData.subjectResults as Record<string, { correct: number; total: number }> | undefined;
      for (const [subject, data] of Object.entries(results ?? {})) {
        if (!data?.total) continue;
        for (let i = 0; i < data.total; i++) {
          incoming.push({
            subject,
            topic: subject,
            source: "weekly_test",
            correct: i < data.correct ? 1 : 0,
            difficulty: "medium",
          });
        }
      }
    }

    if (incoming.length === 0) return json({ success: true, updated: 0 });

    // Group by subject+topic so one call = one recompute per topic
    const grouped = new Map<string, IncomingEvidence[]>();
    for (const ev of incoming) {
      const key = `${ev.subject}||${ev.topic}`;
      grouped.set(key, [...(grouped.get(key) ?? []), ev]);
    }

    const now = new Date().toISOString();
    let updated = 0;

    for (const [key, items] of grouped) {
      const [subject, topic] = key.split("||");

      const { data: existing } = await supabase
        .from("topic_mastery")
        .select("*")
        .eq("student_id", studentId)
        .eq("subject", subject)
        .eq("topic", topic)
        .maybeSingle();

      const prior: Evidence[] = Array.isArray(existing?.evidence) ? (existing!.evidence as Evidence[]) : [];
      const fresh: Evidence[] = items.map((i) => ({
        source: i.source,
        correct: i.correct,
        difficulty: normalizeDifficulty(i.difficulty),
        at: now,
      }));
      const evidence = [...prior, ...fresh].slice(-20);
      const totalAttempts = (existing?.attempt_count ?? 0) + fresh.length;

      const state = recompute(evidence, totalAttempts);

      const counts = {
        mcq_count: (existing?.mcq_count ?? 0) + fresh.filter((f) => f.source === "mcq").length,
        test_count: (existing?.test_count ?? 0) + fresh.filter((f) => f.source === "weekly_test").length,
        chatbot_count: (existing?.chatbot_count ?? 0) + fresh.filter((f) => f.source === "chatbot_check").length,
      };
      const hasTest = fresh.some((f) => f.source === "weekly_test");

      const payload = {
        student_id: studentId,
        subject,
        topic,
        understanding_score: state.understanding,
        mastery_score: state.understanding, // kept for backward compatibility
        alpha: state.alpha,
        beta: state.beta,
        evidence: evidence as unknown as Record<string, unknown>[],
        attempt_count: totalAttempts,
        confidence: state.confidence,
        trend: state.trend,
        last_practiced: now,
        last_test_at: hasTest ? now : existing?.last_test_at ?? null,
        score_history: [...(Array.isArray(existing?.score_history) ? existing!.score_history : []), { score: state.understanding, date: now }].slice(-5),
        updated_at: now,
        ...counts,
      };

      if (existing) {
        await supabase.from("topic_mastery").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("topic_mastery").insert(payload);
      }
      updated++;
    }

    return json({ success: true, updated });
  } catch (error) {
    console.error("Error in update-topic-mastery:", error);
    return json({ error: (error as Error).message });
  }
});
