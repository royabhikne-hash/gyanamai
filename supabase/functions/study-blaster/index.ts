import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { action, projectId, messages, content, fileName, fileType, fileBase64, exchanges } = body;

    // Validate user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get student
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!student) {
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Rate limit check
    const { data: allowed } = await supabase.rpc("check_ai_rate_limit", {
      p_user_id: student.id,
      p_action: "study_blaster",
      p_max_requests: 30,
      p_window_minutes: 5,
    });
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a few minutes." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "analyze_sources") {
      // Fetch all sources for this project
      const { data: sources } = await supabase
        .from("study_sources")
        .select("*")
        .eq("project_id", projectId)
        .eq("student_id", student.id);

      if (!sources || sources.length === 0) {
        return new Response(JSON.stringify({ error: "No sources found" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const combinedContent = sources
        .map(s => `[Source: ${s.title}]\n${s.extracted_content || "No content extracted"}`)
        .join("\n\n---\n\n");

      // Get project target date
      const { data: project } = await supabase
        .from("study_projects")
        .select("target_date, title")
        .eq("id", projectId)
        .single();

      const targetDateInfo = project?.target_date 
        ? `The student's target completion date is: ${project.target_date}. Provide time-based guidance.` 
        : "";

      const analysisPrompt = `You are an expert study assistant. Analyze the following study materials and generate:
1. "key_concepts": An array of the top 8-12 key concepts/topics (each as a short string)
2. "summary": A comprehensive 3-5 paragraph summary of all the materials combined
3. "study_guide": An array of 5-8 study guide items, each with "topic" and "explanation" fields
4. "faqs": An array of 8-10 frequently asked questions with "question" and "answer" fields based on the material

${targetDateInfo}

Return ONLY valid JSON with these exact keys. No markdown formatting.

MATERIALS:
${combinedContent.substring(0, 80000)}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an expert educational content analyzer. Always respond with valid JSON only." },
            { role: "user", content: analysisPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_study_analysis",
                description: "Generate study analysis from source materials",
                parameters: {
                  type: "object",
                  properties: {
                    key_concepts: { type: "array", items: { type: "string" } },
                    summary: { type: "string" },
                    study_guide: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          topic: { type: "string" },
                          explanation: { type: "string" },
                        },
                        required: ["topic", "explanation"],
                      },
                    },
                    faqs: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          question: { type: "string" },
                          answer: { type: "string" },
                        },
                        required: ["question", "answer"],
                      },
                    },
                  },
                  required: ["key_concepts", "summary", "study_guide", "faqs"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "generate_study_analysis" } },
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again later." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        throw new Error("AI gateway error");
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let analysis;
      
      if (toolCall) {
        analysis = JSON.parse(toolCall.function.arguments);
      } else {
        // Fallback: parse from content
        const raw = aiData.choices?.[0]?.message?.content || "{}";
        analysis = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, ""));
      }

      // Update project with AI analysis
      await supabase
        .from("study_projects")
        .update({
          ai_summary: analysis.summary,
          ai_key_concepts: analysis.key_concepts,
          ai_study_guide: analysis.study_guide,
          ai_faqs: analysis.faqs,
          processing_status: "completed",
        })
        .eq("id", projectId);

      // Log usage
      await supabase.from("ai_usage_log").insert({
        student_id: student.id,
        action: "study_blaster_analyze",
        model: "google/gemini-3-flash-preview",
        input_tokens: combinedContent.length,
        output_tokens: JSON.stringify(analysis).length,
        estimated_cost_inr: 0.5,
      });

      return new Response(JSON.stringify({ success: true, analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } else if (action === "chat") {
      // Source-grounded chat
      const { data: sources } = await supabase
        .from("study_sources")
        .select("title, extracted_content")
        .eq("project_id", projectId)
        .eq("student_id", student.id);

      const combinedContent = (sources || [])
        .map(s => `[Source: ${s.title}]\n${s.extracted_content || ""}`)
        .join("\n\n---\n\n");

      const { data: project } = await supabase
        .from("study_projects")
        .select("title, target_date, ai_summary")
        .eq("id", projectId)
        .single();

      const targetInfo = project?.target_date
        ? `Student's target date: ${project.target_date}. Guide them accordingly.`
        : "";

      const systemPrompt = `You are Study Blaster AI - an expert study tutor. You MUST ONLY answer based on the provided source materials below. If a question cannot be answered from these materials, clearly state: "This information is not available in your uploaded sources."

When answering:
- Always reference which source the information comes from
- Be concise but thorough
- Use simple language appropriate for students
- If asked, generate practice questions from the materials
- Never make up information not in the sources

${targetInfo}

PROJECT: ${project?.title || "Study Project"}

SOURCE MATERIALS:
${combinedContent.substring(0, 60000)}`;

      const chatMessages = [
        { role: "system", content: systemPrompt },
        ...(messages || []).map((m: any) => ({ role: m.role, content: m.content })),
      ];

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: chatMessages,
          stream: true,
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        throw new Error("AI gateway error");
      }

      // Log usage
      await supabase.from("ai_usage_log").insert({
        student_id: student.id,
        action: "study_blaster_chat",
        model: "google/gemini-3-flash-preview",
        input_tokens: JSON.stringify(chatMessages).length,
        output_tokens: 0,
        estimated_cost_inr: 0.3,
      });

      return new Response(aiResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } else if (action === "process_url") {
      // Extract content from URL - content already parsed from initial req.json()
      const extractPrompt = `Extract and summarize the main educational content from this URL: ${content}. Return the key text content suitable for study purposes. If you cannot access the URL, explain why.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a content extraction specialist. Extract and organize educational content from web pages." },
            { role: "user", content: extractPrompt },
          ],
        }),
      });

      if (!aiResponse.ok) throw new Error("Failed to process URL");

      const aiData = await aiResponse.json();
      const extractedContent = aiData.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ success: true, extractedContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } else if (action === "extract_file") {
      // Extract content from base64 file using multimodal Gemini
      if (!fileBase64 || !fileName) {
        return new Response(JSON.stringify({ error: "Missing file data" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const extractPrompt = `Extract ALL text content from this uploaded document "${fileName}". Preserve all important information, formulas, definitions, key points, headings, and structure. Return the full extracted text content in a well-organized format.`;

      // Use multimodal with inline_data for the file
      const mimeType = fileType || "application/pdf";
      const aiMessages: any[] = [
        { role: "system", content: "You are an expert document content extractor. Extract all educational text content from documents, preserving structure, formulas, and key information. Return plain text only." },
        { 
          role: "user", 
          content: [
            { 
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${fileBase64}` }
            },
            { type: "text", text: extractPrompt },
          ]
        },
      ];

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
        }),
      });

      if (!aiResponse.ok) {
        console.error("AI extract_file error:", aiResponse.status, await aiResponse.text());
        throw new Error("Failed to extract file content");
      }

      const aiData = await aiResponse.json();
      const extractedContent = aiData.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ success: true, extractedContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } else if (action === "process_text") {
      // Process plain text content
      const extractPrompt = `Organize and structure the following study material content. Preserve all important information, formulas, definitions, and key points:\n\n${content?.substring(0, 80000)}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an educational content organizer. Structure and preserve all study material content." },
            { role: "user", content: extractPrompt },
          ],
        }),
      });

      if (!aiResponse.ok) throw new Error("Failed to process text");

      const aiData = await aiResponse.json();
      const extractedContent = aiData.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ success: true, extractedContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else if (action === "generate_podcast") {
      // Generate teacher+student dialogue podcast script grounded in project sources
      const numExchanges = Math.min(Math.max(parseInt(String(exchanges)) || 20, 6), 50);

      // Random Indian teacher (female) + student (male) name pools — change every generation
      const teacherNames = [
        "Priya Ma'am", "Anjali Ma'am", "Neha Ma'am", "Kavya Ma'am", "Ritu Ma'am",
        "Shreya Ma'am", "Pooja Ma'am", "Divya Ma'am", "Meera Ma'am", "Sunita Ma'am",
        "Nisha Ma'am", "Aditi Ma'am", "Ishita Ma'am", "Radhika Ma'am", "Sneha Ma'am"
      ];
      const studentNames = [
        "Arjun", "Rohan", "Aditya", "Karan", "Vivek",
        "Rahul", "Aryan", "Siddharth", "Harsh", "Manish",
        "Yash", "Dev", "Kabir", "Nikhil", "Tanish"
      ];
      const teacherName = teacherNames[Math.floor(Math.random() * teacherNames.length)];
      const studentName = studentNames[Math.floor(Math.random() * studentNames.length)];

      const { data: sources } = await supabase
        .from("study_sources")
        .select("title, extracted_content")
        .eq("project_id", projectId)
        .eq("student_id", student.id);

      if (!sources || sources.length === 0) {
        return new Response(JSON.stringify({ error: "No sources found. Add notes/PDFs first." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data: project } = await supabase
        .from("study_projects")
        .select("title")
        .eq("id", projectId)
        .single();

      const combinedContent = sources
        .map((s: any) => `[Source: ${s.title}]\n${s.extracted_content || ""}`)
        .join("\n\n---\n\n")
        .substring(0, 70000);

      const podcastPrompt = `You are scripting an educational podcast titled "${project?.title || "Study Podcast"}".

Format: A friendly DIALOGUE between two hosts:
- TEACHER (female voice): "${teacherName}" — patient, clear, expert, explains concepts deeply with real-world examples and analogies.
- STUDENT (male voice): "${studentName}" — curious learner who asks smart, probing questions, sometimes challenges/debates points to dig deeper, occasionally summarizes back what he understood.

Rules:
- Generate EXACTLY ${numExchanges} alternating turns (start with TEACHER introducing the topic).
- Each turn must be 2-5 sentences (long enough to be substantive, short enough to feel like real conversation).
- Ground EVERY explanation strictly in the source materials below — do not invent facts.
- Cover the most important concepts in depth: definitions, why-it-matters, examples, common confusions, and quick recaps.
- Include 1-2 light debate moments where ${studentName} pushes back or proposes a different angle and ${teacherName} clarifies.
- End with ${teacherName} giving a crisp summary + motivational sign-off.
- Keep language simple, warm, conversational. Mix English with occasional Hindi/Hinglish phrases ONLY in ${studentName}'s lines (1-2 times max) for relatability — ${teacherName} stays in clear English.
- No stage directions, no markdown, no asterisks. Just the dialogue text.

Return JSON with a "turns" array, each item: { "speaker": "teacher" | "student", "text": "..." }

SOURCE MATERIALS:
${combinedContent}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an expert educational podcast scriptwriter. Always respond using the provided tool." },
            { role: "user", content: podcastPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_podcast_script",
                description: "Generate a teacher-student dialogue podcast script",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    turns: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          speaker: { type: "string", enum: ["teacher", "student"] },
                          text: { type: "string" },
                        },
                        required: ["speaker", "text"],
                      },
                    },
                  },
                  required: ["title", "turns"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "generate_podcast_script" } },
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "AI rate limit. Try again in a minute." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        throw new Error("AI gateway error");
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let script: any = { title: project?.title || "Podcast", turns: [] };
      if (toolCall) {
        try { script = JSON.parse(toolCall.function.arguments); } catch (_) { /* keep default */ }
      }
      // Attach the chosen host names so the UI can display them
      script.teacherName = teacherName;
      script.studentName = studentName;

      await supabase.from("ai_usage_log").insert({
        student_id: student.id,
        action: "study_blaster_podcast",
        model: "google/gemini-3-flash-preview",
        input_tokens: combinedContent.length,
        output_tokens: JSON.stringify(script).length,
        estimated_cost_inr: 0.7,
      });

      return new Response(JSON.stringify({ success: true, script }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("study-blaster error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
