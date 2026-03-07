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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_MODEL = "google/gemini-3-flash-preview";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: student } = await supabase
      .from("students")
      .select("id, full_name, class, board")
      .eq("user_id", user.id)
      .single();

    if (!student) {
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("student_id", student.id)
      .single();

    const plan = sub?.plan || "starter";
    const body = await req.json();
    const { action } = body;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    switch (action) {
      case "check_access": {
        const limits: Record<string, number> = { pro: 15, basic: 8, starter: 4 };
        const monthlyLimit = limits[plan] || 4;
        const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
        const { data: usage } = await supabase
          .from("exam_prep_usage")
          .select("sessions_used")
          .eq("student_id", student.id)
          .eq("usage_month", currentMonth)
          .single();

        const sessionsUsed = usage?.sessions_used || 0;
        return new Response(JSON.stringify({
          hasAccess: true, plan, monthlyLimit, sessionsUsed,
          sessionsRemaining: Math.max(0, monthlyLimit - sessionsUsed),
          studentName: student.full_name, studentId: student.id,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "create_session": {
        const { examName, examDate, targetScore, topicFamiliarity, mood } = body;
        const limits: Record<string, number> = { pro: 15, basic: 8, starter: 4 };
        const monthlyLimit = limits[plan] || 4;
        const currentMonth = new Date().toISOString().slice(0, 7) + "-01";

        const { data: usage } = await supabase
          .from("exam_prep_usage")
          .select("sessions_used")
          .eq("student_id", student.id)
          .eq("usage_month", currentMonth)
          .single();

        const sessionsUsed = usage?.sessions_used || 0;
        if (sessionsUsed >= monthlyLimit) {
          return new Response(JSON.stringify({ error: "Monthly limit reached", limit: monthlyLimit }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: session, error: sessErr } = await supabase
          .from("exam_prep_sessions")
          .insert({
            student_id: student.id, exam_name: examName || "",
            exam_date: examDate || null, target_score: targetScore || null,
            topic_familiarity: topicFamiliarity || "new", mood: mood || "neutral",
            onboarding_completed: true,
          })
          .select().single();

        if (sessErr) throw sessErr;

        await supabase.from("exam_prep_usage").upsert({
          student_id: student.id, usage_month: currentMonth,
          sessions_used: sessionsUsed + 1,
        }, { onConflict: "student_id,usage_month" });

        return new Response(JSON.stringify({ session }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "extract_content": {
        const { sessionId, fileUrl, fileName } = body;
        if (!lovableApiKey) throw new Error("AI not configured");

        const { data: fileData } = await supabase.storage
          .from("exam-prep-materials").download(fileUrl);

        let textContent = "";
        if (fileData) textContent = await fileData.text();

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              { role: "system", content: "You are an educational content analyzer. Extract key topics, concepts, and create a structured study plan from the provided material. Return JSON with: { topics: [{ name, description, difficulty }], summary: string, estimatedStudyHours: number }" },
              { role: "user", content: `Extract key topics from this educational material (filename: ${fileName}):\n\n${textContent.substring(0, 15000)}` },
            ],
            temperature: 0.3,
          }),
        });

        let extracted = { topics: [], summary: "Content extracted successfully", estimatedStudyHours: 5 };
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          try {
            const content = aiData.choices?.[0]?.message?.content || "";
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
          } catch {}
        } else {
          const errText = await aiResponse.text();
          console.error("AI extract error:", aiResponse.status, errText.substring(0, 500));
        }

        await supabase.from("exam_prep_materials").update({
          extracted_content: textContent.substring(0, 50000),
          extracted_topics: extracted.topics, processing_status: "completed",
        }).eq("session_id", sessionId).eq("file_name", fileName);

        await supabase.from("exam_prep_sessions")
          .update({ extracted_topics: extracted.topics }).eq("id", sessionId);

        return new Response(JSON.stringify({ extracted }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "chat": {
        const { sessionId, message, history } = body;
        if (!lovableApiKey) throw new Error("AI not configured");

        const { data: session } = await supabase
          .from("exam_prep_sessions").select("*").eq("id", sessionId).single();

        const { data: materials } = await supabase
          .from("exam_prep_materials").select("extracted_content, extracted_topics")
          .eq("session_id", sessionId);

        const context = materials?.map((m: any) => m.extracted_content).join("\n").substring(0, 10000) || "";
        const topics = session?.extracted_topics || [];

        const topicsList = topics.length > 0
          ? topics.map((t: any) => `- ${t.name || t}: ${t.description || ''} (difficulty: ${t.difficulty || 'medium'})`).join('\n')
          : 'No specific topics extracted yet';

        const systemPrompt = `You are a smart, friendly AI exam prep tutor for ${student.full_name} (Class ${student.class}, ${student.board} board).

Student Profile:
- Topic familiarity: ${session?.topic_familiarity || "new"}
- Current mood: ${session?.mood || "neutral"}
- Exam: ${session?.exam_name || "General"}
${session?.exam_date ? `- Exam date: ${session.exam_date}` : ""}
${session?.target_score ? `- Target score: ${session.target_score}` : ""}

Topics from their uploaded study materials:
${topicsList}

Relevant material content:
${context}

CRITICAL Instructions:
- NEVER use markdown formatting like **, ##, *, etc. Write plain text only. Use numbered lists (1. 2. 3.) or dashes for lists.
- When the student uploads study material, you MUST ask specific, targeted questions about the KEY CONCEPTS from those materials.
- Proactively quiz the student on important topics from their materials
- Adapt your teaching style based on the student's familiarity and mood
- If mood is "stressed" or "low_energy", be extra encouraging and break things down simply
- If mood is "ready" or "curious", challenge them with harder questions
- Be conversational, supportive, and engaging
- Always relate explanations directly to their uploaded study materials
- Keep responses focused, clear, and not too long
- After explaining a concept, follow up with a question to check understanding`;

        const messages = [
          { role: "system", content: systemPrompt },
          ...(history || []).slice(-10),
          { role: "user", content: message },
        ];

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: AI_MODEL, messages, temperature: 0.7 }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error("AI API error:", aiResponse.status, errText.substring(0, 500));
          if (aiResponse.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw new Error(`AI API error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const reply = aiData.choices?.[0]?.message?.content || "I'm having trouble responding right now. Please try again.";

        // Log usage
        if (aiData?.usage) logAIUsage(student.id, "exam_prep_chat", AI_MODEL, aiData.usage);

        await supabase.from("exam_prep_messages").insert([
          { session_id: sessionId, role: "user", content: message },
          { session_id: sessionId, role: "assistant", content: reply },
        ]);

        return new Response(JSON.stringify({ reply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "generate_virtual_exam": {
        const { sessionId } = body;
        if (!lovableApiKey) throw new Error("AI not configured");

        const { data: session } = await supabase
          .from("exam_prep_sessions").select("*").eq("id", sessionId).single();

        const { data: materials } = await supabase
          .from("exam_prep_materials").select("extracted_content, extracted_topics")
          .eq("session_id", sessionId);

        const context = materials?.map((m: any) => m.extracted_content).join("\n").substring(0, 12000) || "";
        const topics = session?.extracted_topics || [];

        const examPrompt = `You are an exam paper setter for Class ${student.class} (${student.board} board).
Based on the following study material content, generate a virtual exam paper.

Study Material Topics: ${JSON.stringify(topics)}
Study Material Content: ${context}
Exam Name: ${session?.exam_name || "General Exam"}

Generate a balanced exam with the following structure:
- 5 MCQ questions (1 mark each) - with 4 options (A, B, C, D) and correct answer
- 3 Short Answer questions (2-3 marks each) - with model answers  
- 2 Long Answer questions (5 marks each) - with model answers

Total marks: 5 + 9 + 10 = ~24 marks

ALL questions MUST be based on the study material provided. Do not ask questions outside the material.

Return ONLY valid JSON in this exact format:
{
  "examTitle": "string",
  "totalMarks": number,
  "totalQuestions": 10,
  "timeLimit": 30,
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "string",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctAnswer": "A",
      "marks": 1,
      "topic": "string",
      "explanation": "string"
    },
    {
      "id": 6,
      "type": "short_answer",
      "question": "string",
      "modelAnswer": "string",
      "marks": 3,
      "topic": "string",
      "keyPoints": ["point1", "point2"]
    },
    {
      "id": 9,
      "type": "long_answer", 
      "question": "string",
      "modelAnswer": "string",
      "marks": 5,
      "topic": "string",
      "keyPoints": ["point1", "point2", "point3"]
    }
  ]
}`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              { role: "system", content: "You are an expert exam paper setter. Return ONLY valid JSON, no markdown, no code blocks." },
              { role: "user", content: examPrompt },
            ],
            temperature: 0.4,
            max_tokens: 6000,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error("Virtual exam generation error:", aiResponse.status, errText.substring(0, 500));
          throw new Error(`AI API error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        // Log usage
        if (aiData?.usage) logAIUsage(student.id, "exam_prep_exam", AI_MODEL, aiData.usage);
        
        let exam = null;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) exam = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Failed to parse exam JSON:", e);
          throw new Error("Failed to generate exam questions");
        }

        return new Response(JSON.stringify({ exam }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "evaluate_virtual_exam": {
        const { sessionId, examData, answers } = body;
        if (!lovableApiKey) throw new Error("AI not configured");

        const evalPrompt = `You are an expert exam evaluator for Class ${student.class} (${student.board} board).

Here is the exam paper with questions and the student's answers. Evaluate each answer carefully.

Exam Questions and Student Answers:
${examData.questions.map((q: any, i: number) => {
  const answer = answers[i];
  if (q.type === "mcq") {
    return `Q${q.id}. [MCQ, ${q.marks} mark] ${q.question}\nOptions: ${q.options.join(', ')}\nCorrect Answer: ${q.correctAnswer}\nStudent's Answer: ${answer || "Not attempted"}\n`;
  } else {
    return `Q${q.id}. [${q.type === "short_answer" ? "Short Answer" : "Long Answer"}, ${q.marks} marks] ${q.question}\nModel Answer: ${q.modelAnswer}\nKey Points Expected: ${q.keyPoints?.join(', ') || 'N/A'}\nStudent's Answer: ${answer || "Not attempted"}\n`;
  }
}).join('\n')}

Evaluate and return ONLY valid JSON:
{
  "totalMarksObtained": number,
  "totalMarksPossible": ${examData.totalMarks},
  "percentage": number,
  "grade": "A+/A/B+/B/C/D/F",
  "estimatedBoardPercentage": number,
  "disclaimer": "This is an AI-estimated score based on your study material. Actual exam results may vary.",
  "questionResults": [
    {
      "questionId": number,
      "marksObtained": number,
      "maxMarks": number,
      "isCorrect": boolean,
      "feedback": "Brief feedback on the answer",
      "improvement": "How to improve this answer"
    }
  ],
  "overallFeedback": "2-3 sentences about overall performance",
  "strongTopics": ["topic1", "topic2"],
  "weakTopics": ["topic1"],
  "studyRecommendations": ["recommendation1", "recommendation2"]
}`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              { role: "system", content: "You are a fair and encouraging exam evaluator. For MCQs, mark strictly correct/incorrect. For short/long answers, evaluate based on key concepts covered, not exact wording. Be generous but honest. Return ONLY valid JSON." },
              { role: "user", content: evalPrompt },
            ],
            temperature: 0.3,
            max_tokens: 4000,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error("Exam evaluation error:", aiResponse.status, errText.substring(0, 500));
          throw new Error(`AI API error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        
        let result = null;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) result = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Failed to parse evaluation JSON:", e);
          throw new Error("Failed to evaluate exam");
        }

        return new Response(JSON.stringify({ result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_sessions": {
        const { data: sessions } = await supabase
          .from("exam_prep_sessions")
          .select("*, exam_prep_materials(id, file_name, processing_status)")
          .eq("student_id", student.id)
          .order("created_at", { ascending: false });

        return new Response(JSON.stringify({ sessions: sessions || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_invite": {
        const { sessionId } = body;
        const { data: invite, error: invErr } = await supabase
          .from("exam_prep_invites")
          .insert({ session_id: sessionId, inviter_id: student.id })
          .select().single();
        if (invErr) throw invErr;
        return new Response(JSON.stringify({ invite }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "join_invite": {
        const { inviteCode } = body;
        const { data: invite } = await supabase
          .from("exam_prep_invites")
          .select("*, exam_prep_sessions(*)")
          .eq("invite_code", inviteCode).eq("is_active", true).single();

        if (!invite) {
          return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.from("exam_prep_invites")
          .update({ joined_by: student.id, is_active: false }).eq("id", invite.id);

        return new Response(JSON.stringify({ session: invite.exam_prep_sessions }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: any) {
    console.error("Exam prep error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
