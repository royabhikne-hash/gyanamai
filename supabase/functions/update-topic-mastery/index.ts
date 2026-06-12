import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { studentId, source, sessionData, testData } = await req.json();

    if (!studentId) {
      return new Response(JSON.stringify({ error: "studentId required" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const topicUpdates: { subject: string; topic: string; score: number }[] = [];

    if (source === "study_session" && sessionData) {
      const subject = sessionData.subject || sessionData.topic || "General";
      
      // Strong areas get high scores
      if (sessionData.strongAreas && Array.isArray(sessionData.strongAreas)) {
        for (const topic of sessionData.strongAreas) {
          if (topic && topic.trim()) {
            topicUpdates.push({ subject, topic: topic.trim(), score: 80 });
          }
        }
      }
      
      // Weak areas get low scores
      if (sessionData.weakAreas && Array.isArray(sessionData.weakAreas)) {
        for (const topic of sessionData.weakAreas) {
          if (topic && topic.trim()) {
            topicUpdates.push({ subject, topic: topic.trim(), score: 30 });
          }
        }
      }

      // Understanding level maps to topic score
      const understandingMap: Record<string, number> = {
        weak: 25, average: 50, good: 70, excellent: 90,
      };
      const topicName = sessionData.topic || "General Study";
      if (topicName !== "General Study") {
        topicUpdates.push({
          subject,
          topic: topicName,
          score: understandingMap[sessionData.understandingLevel] || 50,
        });
      }
    }

    if (source === "weekly_test" && testData) {
      // Process per-subject results
      if (testData.subjectResults && typeof testData.subjectResults === "object") {
        for (const [subject, data] of Object.entries(testData.subjectResults as Record<string, { correct: number; total: number }>)) {
          const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 50;
          topicUpdates.push({ subject, topic: `${subject} (Weekly Test)`, score: accuracy });
        }
      }
      
      // Weak subjects
      if (testData.weakSubjects && Array.isArray(testData.weakSubjects)) {
        for (const sub of testData.weakSubjects) {
          topicUpdates.push({ subject: sub, topic: sub, score: 30 });
        }
      }
      
      // Strong subjects
      if (testData.strongSubjects && Array.isArray(testData.strongSubjects)) {
        for (const sub of testData.strongSubjects) {
          topicUpdates.push({ subject: sub, topic: sub, score: 85 });
        }
      }
    }

    if (source === "quiz" && sessionData) {
      const subject = sessionData.subject || sessionData.topic || "General";
      const score = sessionData.accuracy || 50;
      topicUpdates.push({ subject, topic: sessionData.topic || subject, score });
    }

    // Upsert each topic mastery record
    for (const update of topicUpdates) {
      // Get existing record
      const { data: existing } = await supabase
        .from("topic_mastery")
        .select("*")
        .eq("student_id", studentId)
        .eq("subject", update.subject)
        .eq("topic", update.topic)
        .maybeSingle();

      if (existing) {
        // Calculate new score as weighted average (old 40%, new 60%)
        const newScore = Math.round(existing.mastery_score * 0.4 + update.score * 0.6);
        
        // Update score history (keep last 5)
        const history = Array.isArray(existing.score_history) ? existing.score_history : [];
        history.push({ score: update.score, date: new Date().toISOString() });
        const trimmedHistory = history.slice(-5);

        // Calculate trend from history
        let trend = "stable";
        if (trimmedHistory.length >= 2) {
          const recent = trimmedHistory.slice(-2);
          const diff = (recent[1] as any).score - (recent[0] as any).score;
          if (diff > 5) trend = "improving";
          else if (diff < -5) trend = "declining";
        }

        await supabase
          .from("topic_mastery")
          .update({
            mastery_score: newScore,
            attempt_count: existing.attempt_count + 1,
            last_practiced: new Date().toISOString(),
            trend,
            score_history: trimmedHistory,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        // Insert new record
        await supabase.from("topic_mastery").insert({
          student_id: studentId,
          subject: update.subject,
          topic: update.topic,
          mastery_score: update.score,
          attempt_count: 1,
          last_practiced: new Date().toISOString(),
          trend: "stable",
          score_history: [{ score: update.score, date: new Date().toISOString() }],
        });
      }
    }

    return new Response(JSON.stringify({ success: true, updated: topicUpdates.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in update-topic-mastery:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
