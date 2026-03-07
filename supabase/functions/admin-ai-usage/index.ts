import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_token, period } = await req.json();

    // Validate admin session
    const { data: session } = await supabase
      .from("session_tokens")
      .select("user_id, user_type, expires_at, is_revoked")
      .eq("token", session_token)
      .maybeSingle();

    if (!session || session.is_revoked || new Date(session.expires_at) < new Date() || session.user_type !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Date filter
    const now = new Date();
    let dateFilter: string;
    if (period === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = weekAgo.toISOString();
    } else if (period === "today") {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      dateFilter = todayStart.toISOString();
    } else {
      // Default: month
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = monthAgo.toISOString();
    }

    // Get aggregated usage by action
    const { data: actionStats } = await supabase
      .from("ai_usage_log")
      .select("action, input_tokens, output_tokens, estimated_cost_inr, created_at")
      .gte("created_at", dateFilter);

    // Aggregate by action
    const actionAgg: Record<string, { count: number; input_tokens: number; output_tokens: number; cost: number }> = {};
    let totalCost = 0;
    let totalRequests = 0;

    for (const row of actionStats || []) {
      if (!actionAgg[row.action]) {
        actionAgg[row.action] = { count: 0, input_tokens: 0, output_tokens: 0, cost: 0 };
      }
      actionAgg[row.action].count++;
      actionAgg[row.action].input_tokens += row.input_tokens || 0;
      actionAgg[row.action].output_tokens += row.output_tokens || 0;
      actionAgg[row.action].cost += Number(row.estimated_cost_inr) || 0;
      totalCost += Number(row.estimated_cost_inr) || 0;
      totalRequests++;
    }

    // Get per-student usage (top 20)
    const studentAgg: Record<string, { count: number; cost: number; student_id: string }> = {};
    for (const row of actionStats || []) {
      // We need student data - fetch separately
    }

    // Get per-student breakdown
    const { data: studentUsage } = await supabase.rpc("get_ai_usage_summary" as any, {}) as any;

    // Fallback: manual aggregation from raw data
    const { data: rawUsage } = await supabase
      .from("ai_usage_log")
      .select("student_id, action, estimated_cost_inr, input_tokens, output_tokens")
      .gte("created_at", dateFilter);

    const perStudent: Record<string, { count: number; cost: number; actions: Record<string, number> }> = {};
    for (const row of rawUsage || []) {
      if (!perStudent[row.student_id]) {
        perStudent[row.student_id] = { count: 0, cost: 0, actions: {} };
      }
      perStudent[row.student_id].count++;
      perStudent[row.student_id].cost += Number(row.estimated_cost_inr) || 0;
      perStudent[row.student_id].actions[row.action] = (perStudent[row.student_id].actions[row.action] || 0) + 1;
    }

    // Get student names for top users
    const topStudentIds = Object.entries(perStudent)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 20)
      .map(([id]) => id);

    let studentNames: Record<string, string> = {};
    if (topStudentIds.length > 0) {
      const { data: students } = await supabase
        .from("students")
        .select("id, full_name, class")
        .in("id", topStudentIds);

      for (const s of students || []) {
        studentNames[s.id] = `${s.full_name} (${s.class})`;
      }
    }

    const topStudents = topStudentIds.map(id => ({
      id,
      name: studentNames[id] || "Unknown",
      totalRequests: perStudent[id].count,
      totalCost: Math.round(perStudent[id].cost * 100) / 100,
      actions: perStudent[id].actions,
    }));

    // Daily trend (last 7 days)
    const dailyTrend: { date: string; count: number; cost: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayData = (actionStats || []).filter(r => r.created_at.startsWith(dateStr));
      dailyTrend.push({
        date: dateStr,
        count: dayData.length,
        cost: Math.round(dayData.reduce((s, r) => s + (Number(r.estimated_cost_inr) || 0), 0) * 100) / 100,
      });
    }

    // Cost rates info
    const costRates = {
      "study_chat": { perRequest: 0.08, description: "Study Chat (Gemini 3 Flash)" },
      "generate_quiz": { perRequest: 0.12, description: "Quiz Generation" },
      "generate_mcq": { perRequest: 0.10, description: "MCQ Practice" },
      "analyze_answer": { perRequest: 0.05, description: "Answer Analysis" },
      "exam_prep_chat": { perRequest: 0.10, description: "Exam Prep Chat" },
      "exam_prep_extract": { perRequest: 0.15, description: "PDF Extraction" },
      "text_to_speech": { perRequest: 0.02, description: "Text-to-Speech (Speechify)" },
    };

    // Get total unique students
    const uniqueStudents = new Set((rawUsage || []).map(r => r.student_id)).size;

    return new Response(
      JSON.stringify({
        summary: {
          totalRequests,
          totalCost: Math.round(totalCost * 100) / 100,
          uniqueStudents,
          avgCostPerStudent: uniqueStudents > 0 ? Math.round((totalCost / uniqueStudents) * 100) / 100 : 0,
          avgCostPerRequest: totalRequests > 0 ? Math.round((totalCost / totalRequests) * 10000) / 10000 : 0,
        },
        actionBreakdown: Object.entries(actionAgg).map(([action, stats]) => ({
          action,
          label: (costRates as any)[action]?.description || action,
          ...stats,
          cost: Math.round(stats.cost * 100) / 100,
        })),
        topStudents,
        dailyTrend,
        costRates,
        period: period || "month",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin AI usage error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
