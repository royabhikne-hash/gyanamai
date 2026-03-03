import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("parent_access_tokens")
      .select("student_id, is_active")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData || !tokenData.is_active) {
      return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentId = tokenData.student_id;

    // Update last accessed
    await supabase
      .from("parent_access_tokens")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("token", token);

    // Get student info (no sensitive data)
    const { data: student } = await supabase
      .from("students")
      .select("full_name, class, board, school_id, district, state")
      .eq("id", studentId)
      .single();

    if (!student) {
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get school name
    let schoolName = "";
    if (student.school_id) {
      const { data: school } = await supabase
        .from("schools")
        .select("name")
        .eq("id", student.school_id)
        .single();
      schoolName = school?.name || "";
    }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Study sessions this week
    const { data: weekSessions } = await supabase
      .from("study_sessions")
      .select("time_spent, subject, created_at")
      .eq("student_id", studentId)
      .gte("created_at", weekStart.toISOString());

    // Study sessions this month
    const { data: monthSessions } = await supabase
      .from("study_sessions")
      .select("time_spent, subject, created_at")
      .eq("student_id", studentId)
      .gte("created_at", monthStart.toISOString());

    // MCQ attempts
    const { data: mcqAttempts } = await supabase
      .from("mcq_attempts")
      .select("accuracy_percentage, subject, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(50);

    // Weekly tests
    const { data: weeklyTests } = await supabase
      .from("weekly_tests")
      .select("accuracy_percentage, strong_subjects, weak_subjects, created_at, subjects_tested")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Calculate stats
    const weeklyMinutes = weekSessions?.reduce((a, s) => a + (s.time_spent || 0), 0) || 0;
    const monthlyMinutes = monthSessions?.reduce((a, s) => a + (s.time_spent || 0), 0) || 0;

    const weekSubjects = new Set(weekSessions?.map(s => s.subject).filter(Boolean));
    const allSubjects = new Set([
      ...(weekSessions?.map(s => s.subject).filter(Boolean) || []),
      ...(mcqAttempts?.map(a => a.subject).filter(Boolean) || []),
    ]);

    const totalMcqs = mcqAttempts?.length || 0;
    const avgMcqAccuracy = totalMcqs > 0
      ? Math.round((mcqAttempts!.reduce((a, m) => a + Number(m.accuracy_percentage), 0)) / totalMcqs)
      : 0;

    // Days active this week
    const activeDays = new Set(
      weekSessions?.map(s => new Date(s.created_at).toDateString())
    ).size;

    // Progress trend - compare this week avg to last week
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const { data: lastWeekSessions } = await supabase
      .from("study_sessions")
      .select("time_spent")
      .eq("student_id", studentId)
      .gte("created_at", lastWeekStart.toISOString())
      .lt("created_at", weekStart.toISOString());

    const lastWeekMinutes = lastWeekSessions?.reduce((a, s) => a + (s.time_spent || 0), 0) || 0;
    let progressTrend: "up" | "down" | "stable" = "stable";
    if (weeklyMinutes > lastWeekMinutes * 1.1) progressTrend = "up";
    else if (weeklyMinutes < lastWeekMinutes * 0.9) progressTrend = "down";

    // Strong/weak subjects from latest weekly test
    const latestTest = weeklyTests?.[0];
    const strongSubjects = latestTest?.strong_subjects || [];
    const weakSubjects = latestTest?.weak_subjects || [];

    return new Response(JSON.stringify({
      student: {
        name: student.full_name,
        class: student.class,
        board: student.board,
        school: schoolName,
        district: student.district,
      },
      stats: {
        weeklyStudyMinutes: weeklyMinutes,
        monthlyStudyMinutes: monthlyMinutes,
        subjectsStudied: [...allSubjects],
        totalMcqsAttempted: totalMcqs,
        avgMcqAccuracy,
        weeklyTestScores: weeklyTests?.map(t => ({
          accuracy: Number(t.accuracy_percentage),
          date: t.created_at,
          subjects: t.subjects_tested,
        })) || [],
        strongSubjects,
        weakSubjects,
        daysActiveThisWeek: activeDays,
        progressTrend,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Parent dashboard error:", error);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
