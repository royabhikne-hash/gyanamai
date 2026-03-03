import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnalyzeRequest {
  question: string;
  correctAnswer: string;
  studentAnswer: string;
  topic: string;
  questionType: string;
  studentId?: string;
}

// In-memory rate limiting - optimized for 5k users
const rateLimits = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

function checkRateLimit(userId: string, maxRequests = 30, windowMs = 60000): boolean {
  const now = Date.now();
  
  // Periodic cleanup
  if (now - lastCleanup > 300000) {
    for (const [key, val] of rateLimits) {
      if (now > val.resetAt) rateLimits.delete(key);
    }
    lastCleanup = now;
  }
  
  const key = `analyze:${userId}`;
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
    const { question, correctAnswer, studentAnswer, topic, questionType, studentId }: AnalyzeRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service is not configured");
    }

    // Rate limit check
    if (studentId && !checkRateLimit(studentId)) {
      // On rate limit, do simple string matching
      const isCorrect = studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
      return new Response(
        JSON.stringify({ 
          isCorrect, 
          confidence: 100, 
          reasoning: isCorrect ? "Answer matches" : "Answer doesn't match",
          feedback: isCorrect ? "Sahi jawab!" : "Galat jawab",
          fallback: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analyzing answer for topic:", topic);

    // For MCQ and True/False, do simple matching without AI
    if (questionType === "mcq" || questionType === "true_false") {
      const normalizedStudent = studentAnswer.toLowerCase().trim();
      const normalizedCorrect = correctAnswer.toLowerCase().trim();
      const isCorrect = normalizedStudent === normalizedCorrect || 
                       normalizedStudent.includes(normalizedCorrect) ||
                       normalizedCorrect.includes(normalizedStudent);
      
      return new Response(
        JSON.stringify({
          isCorrect,
          confidence: 100,
          reasoning: isCorrect ? "Answer matches the correct option" : "Answer does not match",
          feedback: isCorrect ? "Sahi jawab! 🎉" : "Galat jawab, koi baat nahi!",
          keyConceptMatched: isCorrect,
          partialCredit: isCorrect ? 100 : 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For short answers, use AI analysis with fast model
    const systemPrompt = `You are an answer analyzer for Indian students. Determine if the student's answer is CORRECT.

RULES:
1. Focus on MEANING, not exact wording
2. Accept synonyms, paraphrasing, Hindi-English mixing
3. Accept partial answers if key concept is understood
4. Be lenient with spelling mistakes

OUTPUT FORMAT (JSON only):
{"isCorrect":true|false,"confidence":0-100,"feedback":"Short Hinglish feedback"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Question: ${question}\nCorrect: ${correctAnswer}\nStudent: ${studentAnswer}` }
        ],
        max_tokens: 200,
      }),
    });

    if (!resp.ok) {
      console.error("AI gateway error:", resp.status);
      // Fallback to simple matching
      const isCorrect = studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
      return new Response(
        JSON.stringify({ 
          isCorrect, 
          confidence: 80, 
          feedback: isCorrect ? "Sahi jawab!" : "Galat jawab",
          fallback: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    let aiResponse = data?.choices?.[0]?.message?.content;

    if (typeof aiResponse !== "string" || aiResponse.trim().length === 0) {
      const isCorrect = studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
      return new Response(
        JSON.stringify({ 
          isCorrect, 
          confidence: 80, 
          feedback: isCorrect ? "Sahi jawab!" : "Galat jawab"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON from response
    let analysisResult;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (e) {
      const isCorrect = studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
      analysisResult = {
        isCorrect,
        confidence: 80,
        feedback: isCorrect ? "Sahi jawab!" : "Koi baat nahi, next time better!",
      };
    }

    console.log("Analysis result:", analysisResult);

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Answer analysis error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        isCorrect: false,
        confidence: 0,
        feedback: "Could not analyze answer"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});