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

    // ---- Database Cost Estimation ----
    // Get table row counts for cost estimation
    const tableQueries = [
      "students", "study_sessions", "chat_messages", "quiz_attempts",
      "mcq_attempts", "weekly_tests", "daily_usage", "subscriptions",
      "exam_prep_sessions", "exam_prep_messages", "exam_prep_materials",
      "ai_usage_log", "ranking_history", "achievements", "rank_notifications",
      "chapter_progress", "parent_reports", "session_tokens", "ai_rate_limits",
      "schools", "coaching_centers", "upgrade_requests", "parent_access_tokens",
      "exam_prep_invites", "exam_prep_usage", "login_attempts",
    ];

    const tableSizes: { name: string; rows: number; estimatedSizeMB: number }[] = [];
    let totalDbRows = 0;

    for (const table of tableQueries) {
      try {
        const { count } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        const rows = count || 0;
        totalDbRows += rows;
        // Estimate: ~0.5KB per row average
        const estimatedSizeMB = Math.round((rows * 0.5) / 1024 * 100) / 100;
        tableSizes.push({ name: table, rows, estimatedSizeMB });
      } catch {
        tableSizes.push({ name: table, rows: 0, estimatedSizeMB: 0 });
      }
    }

    // Sort by rows descending
    tableSizes.sort((a, b) => b.rows - a.rows);

    const totalDbSizeMB = Math.round(tableSizes.reduce((s, t) => s + t.estimatedSizeMB, 0) * 100) / 100;
    
    // Supabase pricing: Free tier = 500MB, Pro = $25/mo for 8GB
    // Estimated DB cost based on size
    const dbCostPerGBMonth = 0.125; // $0.125/GB/month after free tier (Pro plan)
    const dbSizeGB = totalDbSizeMB / 1024;
    const freeGBAllowance = 0.5; // 500MB free
    const chargeableGB = Math.max(0, dbSizeGB - freeGBAllowance);
    const monthlyDbCostUSD = chargeableGB * dbCostPerGBMonth;
    const monthlyDbCostINR = Math.round(monthlyDbCostUSD * 83 * 100) / 100;

    // Storage bucket sizes
    let storageSizeMB = 0;
    try {
      const { data: studentPhotos } = await supabase.storage.from("student-photos").list("", { limit: 1000 });
      const { data: examMaterials } = await supabase.storage.from("exam-prep-materials").list("", { limit: 1000 });
      const photoCount = studentPhotos?.length || 0;
      const materialCount = examMaterials?.length || 0;
      // Average: photos ~200KB, materials ~500KB
      storageSizeMB = Math.round(((photoCount * 0.2) + (materialCount * 0.5)) * 100) / 100;
    } catch {}

    const storageCostPerGBMonth = 0.021; // $0.021/GB/month
    const storageSizeGB = storageSizeMB / 1024;
    const storageFreeGB = 1; // 1GB free
    const chargeableStorageGB = Math.max(0, storageSizeGB - storageFreeGB);
    const monthlyStorageCostINR = Math.round(chargeableStorageGB * storageCostPerGBMonth * 83 * 100) / 100;

    // Edge function invocations cost
    const edgeFnInvocations = totalRequests; // AI requests ≈ edge fn invocations for this period
    const edgeFnFreeTier = 500000; // 500K free/month
    const chargeableInvocations = Math.max(0, edgeFnInvocations - edgeFnFreeTier);
    const edgeFnCostPerMillion = 2; // $2/million
    const monthlyEdgeFnCostINR = Math.round((chargeableInvocations / 1000000) * edgeFnCostPerMillion * 83 * 100) / 100;

    // Platform base cost (Supabase Pro plan)
    const platformBaseCostINR = 2075; // $25 × ₹83

    const dbCosts = {
      tables: tableSizes.slice(0, 15), // Top 15 tables
      totalRows: totalDbRows,
      totalDbSizeMB,
      storageSizeMB,
      monthlyEstimate: {
        platformBase: platformBaseCostINR,
        database: monthlyDbCostINR,
        storage: monthlyStorageCostINR,
        edgeFunctions: monthlyEdgeFnCostINR,
        aiCost: Math.round(totalCost * (30 / Math.max(1, period === "today" ? 1 : period === "week" ? 7 : 30)) * 100) / 100,
        total: 0,
      },
    };
    dbCosts.monthlyEstimate.total = Math.round(
      (dbCosts.monthlyEstimate.platformBase + dbCosts.monthlyEstimate.database +
       dbCosts.monthlyEstimate.storage + dbCosts.monthlyEstimate.edgeFunctions +
       dbCosts.monthlyEstimate.aiCost) * 100
    ) / 100;

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
        dbCosts,
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
