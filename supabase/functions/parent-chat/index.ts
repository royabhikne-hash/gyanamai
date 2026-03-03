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
    const { token, message, chatHistory } = await req.json();

    if (!token || !message) {
      return new Response(JSON.stringify({ error: "Token and message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI service is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate parent token
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

    // Fetch student profile
    const { data: student } = await supabase
      .from("students")
      .select("full_name, class, board, school_id, district")
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
      const { data: school } = await supabase.from("schools").select("name").eq("id", student.school_id).single();
      schoolName = school?.name || "";
    }

    // Fetch comprehensive student data for AI context
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Parallel data fetch
    const [sessionsRes, mcqRes, weeklyTestsRes, quizRes, weekSessionsRes] = await Promise.all([
      supabase.from("study_sessions")
        .select("topic, subject, understanding_level, weak_areas, strong_areas, time_spent, created_at, improvement_score")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("mcq_attempts")
        .select("accuracy_percentage, subject, correct_count, total_questions, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("weekly_tests")
        .select("accuracy_percentage, strong_subjects, weak_subjects, subjects_tested, created_at, improvement_suggestion")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("quiz_attempts")
        .select("accuracy_percentage, correct_count, total_questions, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("study_sessions")
        .select("time_spent, subject, created_at")
        .eq("student_id", studentId)
        .gte("created_at", weekStart.toISOString()),
    ]);

    const sessions = sessionsRes.data || [];
    const mcqs = mcqRes.data || [];
    const weeklyTests = weeklyTestsRes.data || [];
    const quizzes = quizRes.data || [];
    const weekSessions = weekSessionsRes.data || [];

    // Aggregate data
    const totalStudyMinutes = sessions.reduce((a, s) => a + (s.time_spent || 0), 0);
    const weeklyMinutes = weekSessions.reduce((a, s) => a + (s.time_spent || 0), 0);
    const activeDaysThisWeek = new Set(weekSessions.map(s => new Date(s.created_at).toDateString())).size;
    const subjectsStudied = [...new Set(sessions.map(s => s.subject).filter(Boolean))];
    const weakAreas = [...new Set(sessions.flatMap(s => s.weak_areas || []))].slice(0, 8);
    const strongAreas = [...new Set(sessions.flatMap(s => s.strong_areas || []))].slice(0, 8);
    const avgMcqAccuracy = mcqs.length > 0
      ? Math.round(mcqs.reduce((a, m) => a + Number(m.accuracy_percentage), 0) / mcqs.length)
      : 0;
    const avgQuizAccuracy = quizzes.length > 0
      ? Math.round(quizzes.reduce((a, q) => a + (q.accuracy_percentage || 0), 0) / quizzes.length)
      : 0;
    const latestTest = weeklyTests[0];
    const recentTopics = [...new Set(sessions.slice(0, 10).map(s => s.topic))].slice(0, 8);

    // Build AI context
    const studentDataContext = `
STUDENT PROFILE:
- Name: ${student.full_name}
- Class: ${student.class}
- Board: ${student.board}
- School: ${schoolName || "Not specified"}
- District: ${student.district}

STUDY STATISTICS:
- Total study sessions (last 30): ${sessions.length}
- Total study time: ${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m
- This week study time: ${Math.floor(weeklyMinutes / 60)}h ${weeklyMinutes % 60}m
- Days active this week: ${activeDaysThisWeek}/7
- Subjects studied: ${subjectsStudied.join(", ") || "None yet"}
- Recent topics: ${recentTopics.join(", ") || "None yet"}

PERFORMANCE:
- MCQ attempts: ${mcqs.length}, Average accuracy: ${avgMcqAccuracy}%
- Quiz attempts: ${quizzes.length}, Average accuracy: ${avgQuizAccuracy}%
- Latest weekly test: ${latestTest ? `${latestTest.accuracy_percentage}% (${latestTest.subjects_tested?.join(", ")})` : "Not taken yet"}
- Strong areas: ${strongAreas.join(", ") || "Not identified yet"}
- Weak areas: ${weakAreas.join(", ") || "Not identified yet"}
- Strong subjects: ${latestTest?.strong_subjects?.join(", ") || "Not identified"}
- Weak subjects: ${latestTest?.weak_subjects?.join(", ") || "Not identified"}
${latestTest?.improvement_suggestion ? `- AI suggestion: ${latestTest.improvement_suggestion}` : ""}
`;

     const systemPrompt = `You are Study Buddy AI's Parent Assistant. You help parents understand their child's academic progress.

${studentDataContext}

RULES:
1. You are talking to the PARENT of ${student.full_name}. Be respectful, warm, and professional.
2. Answer questions about the child's study habits, performance, strengths, and weaknesses based on the data above.
3. Give practical, actionable advice to parents on how to support their child.
4. Keep responses concise (80-120 words), clear, and encouraging.
5. Do NOT share chat conversations or private study content - only statistics and performance data.
6. NEVER use markdown formatting (no *, #, backtick). Plain text only.
7. Be encouraging but honest. If performance is low, suggest specific steps.
8. Always address the parent warmly, e.g., "Your child..." or "${student.full_name}..."

LANGUAGE RULES (VERY IMPORTANT):
- Your DEFAULT language is English. Always reply in simple English unless the parent writes in Hindi/Hinglish.
- If the parent writes in Hindi or Hinglish, THEN switch to Hinglish (Roman script Hindi-English mix).
- Detect the language of each message and match it naturally.
- For Hinglish responses, use warm tone like: "Aapke bachche ne is hafte..." 
- Never use Devanagari script. Always use Roman/English script for Hindi words.`;


    // Build messages
    const aiMessages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add chat history (last 6 messages)
    if (chatHistory && Array.isArray(chatHistory)) {
      const recent = chatHistory.slice(-6);
      for (const msg of recent) {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    aiMessages.push({ role: "user", content: message });

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("AI gateway error:", resp.status, errText);

      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${resp.status}`);
    }

    const data = await resp.json();
    const aiResponse = data?.choices?.[0]?.message?.content;

    if (typeof aiResponse !== "string" || aiResponse.trim().length === 0) {
      throw new Error("Empty AI response");
    }

    return new Response(JSON.stringify({ response: aiResponse.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Parent chat error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Something went wrong",
      response: "Sorry, I could not process your question right now. Please try again.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
