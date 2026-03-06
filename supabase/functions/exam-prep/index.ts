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

    // Get student
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

    // Get subscription plan
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("student_id", student.id)
      .single();

    const plan = sub?.plan || "starter";

    const body = await req.json();
    const { action } = body;

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
          hasAccess: true,
          plan,
          monthlyLimit,
          sessionsUsed,
          sessionsRemaining: Math.max(0, monthlyLimit - sessionsUsed),
          studentName: student.full_name,
          studentId: student.id,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "create_session": {
        const { examName, examDate, targetScore, topicFamiliarity, mood } = body;

        // Check monthly limit
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
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create session
        const { data: session, error: sessErr } = await supabase
          .from("exam_prep_sessions")
          .insert({
            student_id: student.id,
            exam_name: examName || "",
            exam_date: examDate || null,
            target_score: targetScore || null,
            topic_familiarity: topicFamiliarity || "new",
            mood: mood || "neutral",
            onboarding_completed: true,
          })
          .select()
          .single();

        if (sessErr) throw sessErr;

        // Upsert usage
        await supabase.from("exam_prep_usage").upsert({
          student_id: student.id,
          usage_month: currentMonth,
          sessions_used: sessionsUsed + 1,
        }, { onConflict: "student_id,usage_month" });

        return new Response(JSON.stringify({ session }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "extract_content": {
        const { sessionId, fileUrl, fileName } = body;

        // Use AI to extract topics from PDF text
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
        if (!lovableApiKey) throw new Error("AI not configured");

        // Get the file content from storage
        const { data: fileData } = await supabase.storage
          .from("exam-prep-materials")
          .download(fileUrl);

        let textContent = "";
        if (fileData) {
          textContent = await fileData.text();
        }

        // Use AI to extract key topics
        const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are an educational content analyzer. Extract key topics, concepts, and create a structured study plan from the provided material. Return JSON with: { topics: [{ name, description, difficulty }], summary: string, estimatedStudyHours: number }",
              },
              {
                role: "user",
                content: `Extract key topics from this educational material (filename: ${fileName}):\n\n${textContent.substring(0, 15000)}`,
              },
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

        // Update material
        await supabase
          .from("exam_prep_materials")
          .update({
            extracted_content: textContent.substring(0, 50000),
            extracted_topics: extracted.topics,
            processing_status: "completed",
          })
          .eq("session_id", sessionId)
          .eq("file_name", fileName);

        // Update session topics
        await supabase
          .from("exam_prep_sessions")
          .update({ extracted_topics: extracted.topics })
          .eq("id", sessionId);

        return new Response(JSON.stringify({ extracted }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "chat": {
        const { sessionId, message, history } = body;

        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
        if (!lovableApiKey) throw new Error("AI not configured");

        // Get session context
        const { data: session } = await supabase
          .from("exam_prep_sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        // Get materials
        const { data: materials } = await supabase
          .from("exam_prep_materials")
          .select("extracted_content, extracted_topics")
          .eq("session_id", sessionId);

        const context = materials?.map((m: any) => m.extracted_content).join("\n").substring(0, 10000) || "";
        const topics = session?.extracted_topics || [];

        const systemPrompt = `You are a smart, friendly AI exam prep tutor for ${student.full_name} (Class ${student.class}, ${student.board} board).
The student's topic familiarity: ${session?.topic_familiarity || "new"}
The student's mood: ${session?.mood || "neutral"}
Exam: ${session?.exam_name || "General"}
${session?.exam_date ? `Exam date: ${session.exam_date}` : ""}
${session?.target_score ? `Target score: ${session.target_score}` : ""}

Key topics from their materials: ${JSON.stringify(topics)}

Material context: ${context}

Instructions:
- Adapt your teaching style based on the student's familiarity and mood
- If mood is "stressed" or "low_energy", be extra encouraging and break things down
- If mood is "ready" or "curious", challenge them more
- Use examples, scenarios, and ask questions to test understanding
- Be conversational and supportive
- Always relate explanations to their study materials when possible
- Keep responses focused and not too long`;

        const messages = [
          { role: "system", content: systemPrompt },
          ...(history || []).slice(-10),
          { role: "user", content: message },
        ];

        const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages,
            temperature: 0.7,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error("AI API error:", aiResponse.status, errText.substring(0, 500));
          throw new Error(`AI API error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const reply = aiData.choices?.[0]?.message?.content || "I'm having trouble responding right now. Please try again.";

        // Save messages
        await supabase.from("exam_prep_messages").insert([
          { session_id: sessionId, role: "user", content: message },
          { session_id: sessionId, role: "assistant", content: reply },
        ]);

        return new Response(JSON.stringify({ reply }), {
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
          .select()
          .single();

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
          .eq("invite_code", inviteCode)
          .eq("is_active", true)
          .single();

        if (!invite) {
          return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("exam_prep_invites")
          .update({ joined_by: student.id, is_active: false })
          .eq("id", invite.id);

        return new Response(JSON.stringify({ session: invite.exam_prep_sessions }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: any) {
    console.error("Exam prep error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
