import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function logAIUsage(studentId: string, action: string, model: string, usage: any) {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    const costINR = ((inputTokens * 0.0000001 + outputTokens * 0.0000004) * 85);
    sb.from("ai_usage_log").insert({
      student_id: studentId, action, model,
      input_tokens: inputTokens, output_tokens: outputTokens,
      estimated_cost_inr: Math.round(costINR * 10000) / 10000,
    }).then(() => {}).catch((e: any) => console.error("Usage log error:", e));
  } catch (e) { console.error("Usage log setup error:", e); }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, studentId, subject, numQuestions, subjects } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("AI service is not configured");
    }

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get student profile
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, board, class, full_name, stream")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_mcq") {
      // Validate inputs
      const validQuestionCounts = [10, 15, 20];
      const questionCount = validQuestionCounts.includes(numQuestions) ? numQuestions : 10;

      const prompt = `Generate exactly ${questionCount} multiple choice questions for ${student.board} Class ${student.class} ${subject} level moderate difficulty. 

RULES:
- Follow official ${student.board} board exam pattern and style
- Each question must have exactly 4 options (A, B, C, D)
- Provide the correct answer letter and a short 1-2 sentence explanation
- Avoid repetition of concepts
- Mix easy (30%), medium (50%), and hard (20%) questions
- Cover different topics within ${subject}

Return ONLY a valid JSON array with this exact format, no other text:
[
  {
    "question": "Question text here?",
    "optionA": "Option A text",
    "optionB": "Option B text", 
    "optionC": "Option C text",
    "optionD": "Option D text",
    "correctAnswer": "A",
    "explanation": "Brief explanation why this is correct."
  }
]`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an expert MCQ question generator for Indian school board exams. Generate questions that match the exact style and difficulty of official board exams. Return ONLY valid JSON, no markdown, no code blocks." },
            { role: "user", content: prompt },
          ],
          max_tokens: 4000,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (resp.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI service error: ${resp.status}`);
      }

      const data = await resp.json();
      let content = data?.choices?.[0]?.message?.content || "";

      // Log usage
      if (studentId && data?.usage) logAIUsage(studentId, "generate_mcq", "google/gemini-3-flash-preview", data.usage);
      
      // Clean markdown code blocks if present
      content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      
      let questions;
      try {
        questions = JSON.parse(content);
      } catch {
        console.error("Failed to parse MCQ response:", content);
        throw new Error("Failed to generate questions. Please try again.");
      }

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("No questions generated. Please try again.");
      }

      return new Response(JSON.stringify({ questions, student: { board: student.board, class: student.class } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_weekly_test") {
      // Check if student already took a test this week
      const now = new Date();
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);

      const { data: existingTest } = await supabase
        .from("weekly_tests")
        .select("id")
        .eq("student_id", studentId)
        .gte("created_at", weekStart.toISOString())
        .limit(1);

      if (existingTest && existingTest.length > 0) {
        return new Response(JSON.stringify({ error: "You already took this week's test.", alreadyTaken: true }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get subjects & topics studied this week from study_sessions and mcq_attempts
      const { data: sessions } = await supabase
        .from("study_sessions")
        .select("subject, topic, weak_areas, strong_areas")
        .eq("student_id", studentId)
        .gte("created_at", weekStart.toISOString());

      const { data: mcqAttempts } = await supabase
        .from("mcq_attempts")
        .select("subject")
        .eq("student_id", studentId)
        .gte("created_at", weekStart.toISOString());

      // Get previous weak topics from older weekly tests
      const { data: prevTests } = await supabase
        .from("weekly_tests")
        .select("weak_subjects")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(3);

      const studiedSubjects = new Set<string>();
      const studiedTopics = new Set<string>();
      const weakTopics = new Set<string>();
      
      sessions?.forEach(s => {
        if (s.subject) studiedSubjects.add(s.subject);
        if (s.topic && s.topic !== "General Study") studiedTopics.add(s.topic);
        (s.weak_areas || []).forEach((w: string) => weakTopics.add(w));
      });
      mcqAttempts?.forEach(a => studiedSubjects.add(a.subject));
      
      // Add previously weak subjects
      prevTests?.forEach(t => {
        (t.weak_subjects || []).forEach((w: string) => weakTopics.add(w));
      });

      const testSubjects = subjects?.length > 0 ? subjects : [...studiedSubjects];
      
      if (testSubjects.length === 0) {
        return new Response(JSON.stringify({ error: "No subjects studied this week. Study first, then take the weekly test." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Adaptive test: 70% current week topics, 30% previously weak topics
      const totalQuestions = Math.min(40, Math.max(25, testSubjects.length * 10));
      const currentTopicQuestions = Math.round(totalQuestions * 0.7);
      const weakTopicQuestions = totalQuestions - currentTopicQuestions;
      
      const weakTopicsList = [...weakTopics].filter(w => !testSubjects.includes(w)).slice(0, 5);
      const topicsList = [...studiedTopics].slice(0, 10);

      const subjectList = testSubjects.join(", ");
      const weakList = weakTopicsList.length > 0 ? weakTopicsList.join(", ") : "None";
      const topicsContext = topicsList.length > 0 ? topicsList.join(", ") : subjectList;
      
      const prompt = `Generate exactly ${totalQuestions} multiple choice questions for ${student.board} Class ${student.class}.

ADAPTIVE TEST STRUCTURE:
- ${currentTopicQuestions} questions (70%) from THIS WEEK's studied topics: ${topicsContext}
- ${weakTopicQuestions} questions (30%) from PREVIOUSLY WEAK areas: ${weakList}
- Subjects covered: ${subjectList}

DIFFICULTY DISTRIBUTION:
- Easy (30%): Basic recall & understanding
- Medium (50%): Application & analysis
- Hard (20%): Higher-order thinking

RULES:
- Follow official ${student.board} board exam pattern
- Each question must have 4 options (A, B, C, D) 
- Include the subject name for each question
- Mark difficulty level for each question
- This is a weekly adaptive assessment test

Return ONLY a valid JSON array:
[
  {
    "subject": "Subject name",
    "question": "Question text?",
    "optionA": "Option A",
    "optionB": "Option B",
    "optionC": "Option C", 
    "optionD": "Option D",
    "correctAnswer": "A",
    "explanation": "Brief explanation.",
    "difficulty": "easy|medium|hard",
    "isWeakTopic": false
  }
]`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an expert exam paper setter for Indian school boards. Generate a balanced weekly assessment. Return ONLY valid JSON, no markdown." },
            { role: "user", content: prompt },
          ],
          max_tokens: 8000,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI service error: ${resp.status}`);
      }

      const data = await resp.json();
      let content = data?.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      let questions;
      try {
        questions = JSON.parse(content);
      } catch {
        console.error("Failed to parse weekly test response:", content);
        throw new Error("Failed to generate weekly test. Please try again.");
      }

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      return new Response(JSON.stringify({ 
        questions, 
        subjects: testSubjects,
        weekStart: weekStart.toISOString().split("T")[0],
        weekEnd: weekEnd.toISOString().split("T")[0],
        totalQuestions: questions.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_weekly_test_available") {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);

      // Check last test
      const { data: lastTest } = await supabase
        .from("weekly_tests")
        .select("id, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastTestDate = lastTest?.[0]?.created_at ? new Date(lastTest[0].created_at) : null;
      const daysSinceLastTest = lastTestDate ? Math.floor((now.getTime() - lastTestDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;

      // Check if already taken this week
      const { data: thisWeekTest } = await supabase
        .from("weekly_tests")
        .select("id")
        .eq("student_id", studentId)
        .gte("created_at", weekStart.toISOString())
        .limit(1);

      const alreadyTakenThisWeek = thisWeekTest && thisWeekTest.length > 0;

      // Get studied subjects this week
      const { data: sessions } = await supabase
        .from("study_sessions")
        .select("subject, topic")
        .eq("student_id", studentId)
        .gte("created_at", weekStart.toISOString());

      const { data: mcqAttempts } = await supabase
        .from("mcq_attempts")
        .select("subject")
        .eq("student_id", studentId)
        .gte("created_at", weekStart.toISOString());

      const studiedSubjects = new Set<string>();
      sessions?.forEach(s => {
        if (s.subject) studiedSubjects.add(s.subject);
      });
      mcqAttempts?.forEach(a => studiedSubjects.add(a.subject));

      return new Response(JSON.stringify({
        available: daysSinceLastTest >= 7 && !alreadyTakenThisWeek && studiedSubjects.size > 0,
        alreadyTakenThisWeek,
        daysSinceLastTest,
        studiedSubjects: [...studiedSubjects],
        hasStudied: studiedSubjects.size > 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Generate MCQ error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
