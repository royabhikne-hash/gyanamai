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

interface ChatMessage {
  role: string;
  content: string;
}

// In-memory rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, maxRequests = 10, windowMs = 300000): boolean {
  const now = Date.now();
  const key = `quiz:${userId}`;
  const limit = rateLimits.get(key);
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxRequests) return false;
  limit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, topic, studentLevel, weakAreas, strongAreas, studentId, quizMode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service is not configured");
    }

    // Rate limit check (10 quizzes per 5 minutes)
    if (studentId && !checkRateLimit(studentId)) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please wait before generating another quiz.",
          success: false
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating quiz for topic:", topic, "mode:", quizMode || "standard");

    // Build context from chat messages
    const chatContext = messages
      ?.filter((m: ChatMessage) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m: ChatMessage) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(-4000);

    const weakAreasText = weakAreas?.length > 0 ? weakAreas.join(", ") : "None identified";
    const strongAreasText = strongAreas?.length > 0 ? strongAreas.join(", ") : "None identified";

    const MODEL = "google/gemini-3-flash-preview";

    // Per-subject comprehensive quiz: 10 MCQs, 3 short, 1 long
    if (quizMode === "per_subject") {
      const systemPrompt = `You are an exam paper setter for Indian school students. Generate a comprehensive quiz for the subject "${topic}".

CRITICAL RULES:
1. ALL questions MUST be about "${topic}" ONLY - nothing else
2. Questions should be based on what was discussed in the study session
3. Use simple, clear English
4. Make questions exam-relevant for CBSE/ICSE/Bihar Board students

QUESTION STRUCTURE (EXACTLY):
- 10 MCQ questions (4 options each, one correct)
- 3 Short Answer questions (2-3 line answers expected)
- 1 Long Answer question (detailed 5-8 line answer expected)

TOTAL: 14 questions

ADAPTIVE DIFFICULTY based on student level "${studentLevel || 'average'}":
- Weak areas to focus on: ${weakAreasText}
- Strong areas: ${strongAreasText}

STUDY SESSION CONTEXT:
${chatContext || `General study session about ${topic}`}

OUTPUT FORMAT (strictly valid JSON, no markdown):
{
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Exact correct option text",
      "explanation": "Brief explanation",
      "difficulty": "easy|medium|hard",
      "topic": "${topic}"
    },
    {
      "id": 11,
      "type": "short_answer",
      "question": "Short answer question?",
      "correct_answer": "Expected answer in 2-3 lines",
      "acceptable_answers": ["alt answer 1", "alt answer 2"],
      "explanation": "Why this is the answer",
      "difficulty": "medium",
      "topic": "${topic}"
    },
    {
      "id": 14,
      "type": "long_answer",
      "question": "Detailed question requiring elaborate answer?",
      "correct_answer": "Detailed model answer in 5-8 lines",
      "key_concept": "Core concept being tested",
      "explanation": "Key points to cover",
      "difficulty": "hard",
      "topic": "${topic}"
    }
  ],
  "total_questions": 14
}`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate a comprehensive quiz for "${topic}" with exactly 10 MCQs, 3 short answer, and 1 long answer question. Base questions on the study session content provided.` }
          ],
          max_tokens: 5000,
        }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("AI gateway error:", resp.status, errorText);
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded.", success: false }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw new Error(`AI service error: ${resp.status}`);
      }

      const data = await resp.json();
      let aiResponse = data?.choices?.[0]?.message?.content;

      if (typeof aiResponse !== "string" || aiResponse.trim().length === 0) {
        throw new Error("No response from AI");
      }

      if (studentId && data?.usage) {
        logAIUsage(studentId, "generate_subject_quiz", MODEL, data.usage);
      }

      let quizData;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          quizData = JSON.parse(jsonMatch[0]);
          if (quizData.questions && Array.isArray(quizData.questions)) {
            quizData.questions = quizData.questions.map((q: any, idx: number) => ({
              ...q,
              id: idx + 1,
              topic: q.topic || topic || "General Study"
            }));
            quizData.total_questions = quizData.questions.length;
          }
        } else {
          throw new Error("No JSON found");
        }
      } catch (e) {
        console.error("Failed to parse quiz JSON:", e);
        // Minimal fallback
        quizData = {
          questions: [
            { id: 1, type: "mcq", question: `What is the most fundamental concept in ${topic}?`, options: ["Basics", "Advanced Theory", "Applications", "All of these"], correct_answer: "All of these", explanation: "All aspects are important!", difficulty: "easy", topic },
          ],
          total_questions: 1
        };
      }

      return new Response(
        JSON.stringify({ success: true, quiz: quizData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Standard quiz mode (existing behavior)
    const messageCount = messages?.length || 0;
    let questionCount = 10;
    if (messageCount >= 15) questionCount = 15;
    else if (messageCount >= 10) questionCount = 12;
    else if (messageCount >= 5) questionCount = 10;
    else questionCount = 8;

    const systemPrompt = `You are an adaptive quiz generator for Indian students studying "${topic || 'General Study'}".

CRITICAL RULES:
1. Generate EXACTLY ${questionCount} questions
2. ALL questions MUST be about "${topic || 'General Study'}" ONLY
3. DO NOT include questions from other subjects
4. Questions should be based on what was discussed in the study session
5. Use simple, clear English
6. Number questions from 1 to ${questionCount} correctly

ADAPTIVE DIFFICULTY:
- Student level: ${studentLevel || 'average'}
- Focus MORE on weak areas: ${weakAreasText}
- Build confidence with strong areas: ${strongAreasText}

QUESTION DISTRIBUTION:
- 40% Easy, 40% Medium, 20% Hard
- MCQ 70%, True/False 30%

OUTPUT FORMAT (strictly JSON):
{
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "Question about ${topic}?",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "Exact correct option",
      "explanation": "Brief explanation",
      "difficulty": "easy",
      "topic": "${topic}"
    },
    {
      "id": 2,
      "type": "true_false",
      "question": "Statement about ${topic}?",
      "options": ["True", "False"],
      "correct_answer": "True",
      "explanation": "Why",
      "difficulty": "medium",
      "topic": "${topic}"
    }
  ],
  "total_questions": ${questionCount}
}

STUDY SESSION CONTEXT:
${chatContext || `General study session about ${topic || "various topics"}`}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate exactly ${questionCount} adaptive quiz questions for "${topic || 'General Study'}". Student level: ${studentLevel || 'average'}. Create questions ONLY from the study session content provided.` }
        ],
        max_tokens: 3500,
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("AI gateway error:", resp.status, errorText);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded.", success: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted.", success: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI service error: ${resp.status}`);
    }

    const data = await resp.json();
    let aiResponse = data?.choices?.[0]?.message?.content;

    if (typeof aiResponse !== "string" || aiResponse.trim().length === 0) {
      throw new Error("No response from AI");
    }

    if (studentId && data?.usage) {
      logAIUsage(studentId, "generate_quiz", MODEL, data.usage);
    }

    let quizData;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        quizData = JSON.parse(jsonMatch[0]);
        if (quizData.questions && Array.isArray(quizData.questions)) {
          quizData.questions = quizData.questions.map((q: any, idx: number) => ({
            ...q,
            id: idx + 1,
            topic: q.topic || topic || "General Study"
          }));
          quizData.total_questions = quizData.questions.length;
        }
      } else {
        throw new Error("No JSON found");
      }
    } catch (e) {
      console.error("Failed to parse quiz JSON:", e);
      quizData = {
        questions: [
          { id: 1, type: "mcq", question: `What is the most important concept in ${topic || "this session"}?`, options: ["Basics", "Advanced", "Theory", "Practice"], correct_answer: "Basics", explanation: "Start with basics.", difficulty: "easy", topic: topic || "General" },
          { id: 2, type: "true_false", question: "Regular practice improves understanding?", options: ["True", "False"], correct_answer: "True", explanation: "Practice is key!", difficulty: "easy", topic: topic || "General" },
        ],
        total_questions: 2
      };
    }

    return new Response(
      JSON.stringify({ success: true, quiz: quizData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Quiz generation error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An error occurred",
        success: false
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
