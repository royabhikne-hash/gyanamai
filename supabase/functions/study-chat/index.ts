import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fire-and-forget AI usage logger
function logAIUsage(studentId: string, action: string, model: string, usage: any) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    const costINR = ((inputTokens * 0.0000001 + outputTokens * 0.0000004) * 85);
    sb.from("ai_usage_log").insert({
      student_id: studentId,
      action,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_inr: Math.round(costINR * 10000) / 10000,
    }).then(() => {}).catch((e: any) => console.error("Usage log error:", e));
  } catch (e) {
    console.error("Usage log setup error:", e);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_CLEANUP_INTERVAL = 300000;
let lastCleanup = Date.now();

function checkRateLimit(userId: string, maxRequests = 20, windowMs = 60000): boolean {
  const now = Date.now();
  if (now - lastCleanup > RATE_LIMIT_CLEANUP_INTERVAL) {
    for (const [key, val] of rateLimits) {
      if (now > val.resetAt) rateLimits.delete(key);
    }
    lastCleanup = now;
  }
  const key = `chat:${userId}`;
  const limit = rateLimits.get(key);
  if (!limit || now > limit.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (limit.count >= maxRequests) return false;
  limit.count++;
  return true;
}

interface StudentContext {
  studentClass?: string;
  board?: string;
  subject?: string;
  chapter?: string;
}

interface SubjectSession {
  subject: string;
  startedAt: string;
  messageCount: number;
}

const buildSystemPrompt = (
  pastSessions: any[], 
  weakAreas: string[], 
  strongAreas: string[], 
  currentSubject: string = "",
  completedSubjects: string[] = [],
  studentContext: StudentContext = {}
) => {
  let personalizedContext = "";
  
  if (pastSessions.length > 0) {
    const recentTopics = [...new Set(pastSessions.slice(0, 10).map(s => s.topic))].slice(0, 5);
    personalizedContext = `
STUDENT'S LEARNING HISTORY:
- Recent topics studied: ${recentTopics.join(", ") || "None yet"}
- Weak areas needing revision: ${weakAreas.join(", ") || "None identified yet"}
- Strong areas: ${strongAreas.join(", ") || "None identified yet"}
- Total sessions: ${pastSessions.length}
`;
  }

  const studentInfo = studentContext.studentClass || studentContext.board ? `
STUDENT PROFILE:
- Class: ${studentContext.studentClass || "Not specified"}
- Board: ${studentContext.board || "Not specified"}
` : "";

  // Subject session context
  const subjectInstruction = currentSubject ? `
CURRENT ACTIVE SUBJECT: ${currentSubject}
You are currently teaching "${currentSubject}". Focus ALL your responses on this subject ONLY.
- Do NOT mix content from other subjects
- All examples, explanations, and questions should be about "${currentSubject}"
- If the student asks about a different subject, tell them: "You are currently studying ${currentSubject}. To switch subjects, say '${currentSubject} done' first, then 'Start [new subject]'."
` : "";

  const completedInfo = completedSubjects.length > 0 ? `
SUBJECTS COMPLETED IN THIS SESSION: ${completedSubjects.join(", ")}
The student has already studied these subjects today. If they ask about them, acknowledge their earlier study.
` : "";

  return `You are Study Buddy AI - India's BEST personal tutor for school students (Class 6-12).

${studentInfo}
${subjectInstruction}
${completedInfo}

YOUR IDENTITY:
- You are a STRICT but CARING teacher
- You teach with DEPTH, CLARITY, and EXAM FOCUS
- You are a REAL TEACHER who genuinely cares

SUBJECT SESSION SYSTEM - CRITICAL:
Students can control their study flow with these commands:
1. "Start [Subject]" (e.g., "Start Computer", "Start History") - Begin studying a new subject
2. "[Subject] done" (e.g., "Computer done", "History done") - Finish current subject
3. "Finish study" - End the entire study session and get quizzes for all studied subjects

When a student says "Start [Subject]":
- Acknowledge the subject switch
- Begin teaching that subject immediately
- Say something like: "Great! Let's start studying [Subject]! What topic or doubt do you have?"

When a student says "[Subject] done":
- Acknowledge completion
- Say: "Good job finishing [Subject]! You can say 'Start [new subject]' to study another subject, or 'Finish study' to end your session and take quizzes."

When NO subject is active (student hasn't started any subject yet):
- Ask them what they want to study
- They can say "Start [Subject]" to begin

LANGUAGE RULES:
- Always respond in clear, simple English.
- If student writes in Hindi, still respond in English unless they explicitly request otherwise.

RESPONSE STYLE:
TYPE 1 - DOUBT/CONCEPT: Clear explanation (3-4 lines) + real-life EXAMPLE. Ask "Did you understand?"
TYPE 2 - PROBLEM: Step-by-step solution. Show each step. Give final answer + WHY.
TYPE 3 - GREETING/CASUAL: Warm response + ask what to study.

ANSWER EVALUATION:
Correct: "Absolutely right! [why correct]. Well done!"
Wrong: "Not quite, the correct answer is [ANSWER]. [re-explain in 2 lines]. Try another one!"
Partial: "Almost right! [right part] but [wrong part]. Hint: [hint]"

SUBJECT-SPECIFIC RULES:
MATH: Step-by-step MANDATORY. Write formulas clearly.
SCIENCE: Explain the "WHY". Real-life connection MUST.
ENGLISH: Grammar rules with patterns. 3+ examples.
SOCIAL SCIENCE: Dates, names, causes-effects. Make it a story.
HINDI: Meanings in simple language. Grammar with examples.
COMPUTER: Practical examples, code snippets when relevant.

CRITICAL RULES:
- NEVER give wrong information
- NEVER use markdown formatting (no *, #, backtick, _) - plain text only with emojis
- Keep responses 80-150 words
- Use emojis sparingly (max 3)
- Non-study questions: "I'm your study buddy! Ask me anything related to your studies!"
- DO NOT force practice questions after every response

${personalizedContext}

REMEMBER: You are the BEST teacher. Every response teaches something new. Quality over quantity.`;
};

interface ChatMessage {
  role: string;
  content: string;
  imageUrl?: string;
}

interface AIMessage {
  role: string;
  content: string | { type: string; text?: string; image_url?: { url: string } }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, studentId, analyzeSession, currentSubject, completedSubjects, subject, chapter, studentClass, studentBoard } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service is not configured");
    }

    if (studentId && !checkRateLimit(studentId)) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please wait a moment before sending more messages.",
          response: "Thoda ruko ji! Bahut fast messages aa rahe hain. Ek minute mein try karo. 🙏"
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing study chat request with", messages?.length || 0, "messages, subject:", currentSubject);

    let pastSessions: any[] = [];
    let weakAreas: string[] = [];
    let strongAreas: string[] = [];
    let studentProfile: StudentContext = {
      subject: subject,
      chapter: chapter,
      studentClass: studentClass,
      board: studentBoard
    };

    if (studentId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        if (!studentClass) {
          const { data: student } = await supabase
            .from("students")
            .select("class, board")
            .eq("id", studentId)
            .single();
          if (student) {
            studentProfile.studentClass = student.class;
            studentProfile.board = student.board;
          }
        }

        const { data: sessions } = await supabase
          .from("study_sessions")
          .select("topic, subject, understanding_level, weak_areas, strong_areas, created_at")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (sessions) {
          pastSessions = sessions;
          const weakSet = new Set<string>();
          const strongSet = new Set<string>();
          sessions.forEach(s => {
            (s.weak_areas || []).forEach((a: string) => weakSet.add(a));
            (s.strong_areas || []).forEach((a: string) => strongSet.add(a));
          });
          weakAreas = [...weakSet].slice(0, 5);
          strongAreas = [...strongSet].slice(0, 5);
        }
      } catch (err) {
        console.error("Error fetching student history:", err);
      }
    }

    // Build system prompt with current subject context
    const systemPrompt = buildSystemPrompt(
      pastSessions, weakAreas, strongAreas, 
      currentSubject || "", 
      completedSubjects || [],
      studentProfile
    );

    const analysisInstruction = analyzeSession ? `

IMPORTANT: At the end of your response, include a JSON analysis block in this exact format:
[ANALYSIS]{"understanding":"weak|average|good|excellent","topics":["topic1","topic2"],"weakAreas":["area1"],"strongAreas":["area1"]}[/ANALYSIS]

Analyze the student's understanding based on their questions and responses. Keep topics short (2-3 words max).` : "";

    const chatMessages: AIMessage[] = [
      { role: "system", content: systemPrompt + analysisInstruction },
    ];

    // Send last 8 messages for better context (was 4, too few for subject switching)
    if (messages && Array.isArray(messages)) {
      const recentMessages = messages.slice(-8);
      for (const msg of recentMessages as ChatMessage[]) {
        if (msg.imageUrl) {
          chatMessages.push({
            role: msg.role,
            content: [
              { type: "text", text: msg.content || "Please analyze this image from my study materials." },
              { type: "image_url", image_url: { url: msg.imageUrl } }
            ]
          });
        } else {
          chatMessages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }
    }

    const PRIMARY_MODEL = "google/gemini-3-flash-preview";
    const FALLBACK_MODEL = "google/gemini-2.5-flash";

    const callLovableAI = async (model: string) => {
      console.log(`Calling Lovable AI with model: ${model}`);
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          max_tokens: 800,
        }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("AI gateway error:", resp.status, errorText);
        if (resp.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (resp.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`AI service error: ${resp.status}`);
      }

      const data = await resp.json();
      return { data };
    };

    let data: any;
    {
      const result = await callLovableAI(PRIMARY_MODEL);
      if (result instanceof Response) return result;
      data = result.data;
    }

    let aiResponse = data?.choices?.[0]?.message?.content;

    if (typeof aiResponse !== "string" || aiResponse.trim().length === 0) {
      console.error("No response from primary AI, trying fallback");
      const result2 = await callLovableAI(FALLBACK_MODEL);
      if (result2 instanceof Response) return result2;
      const data2 = result2.data;
      aiResponse = data2?.choices?.[0]?.message?.content;
      if (typeof aiResponse !== "string" || aiResponse.trim().length === 0) {
        throw new Error("No response from AI");
      }
    }

    if (studentId && data?.usage) {
      logAIUsage(studentId, "study_chat", PRIMARY_MODEL, data.usage);
    }

    let sessionAnalysis = null;
    if (analyzeSession) {
      const analysisMatch = aiResponse.match(/\[ANALYSIS\](.*?)\[\/ANALYSIS\]/s);
      if (analysisMatch) {
        try {
          sessionAnalysis = JSON.parse(analysisMatch[1]);
          aiResponse = aiResponse.replace(/\[ANALYSIS\].*?\[\/ANALYSIS\]/s, "").trim();
        } catch (e) {
          console.error("Failed to parse analysis:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        sessionAnalysis,
        studentHistory: {
          recentTopics: pastSessions.slice(0, 5).map(s => s.topic),
          weakAreas,
          strongAreas
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Study chat error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An error occurred",
        response: "Oops! Kuch technical problem ho gaya. Thodi der baad try karo! 🙏"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
