import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

// { student_id, images: [{subject, dataUrl}] }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const student_id: string = body.student_id;
    const images: Array<{ subject: string; dataUrl: string }> = body.images ?? [];
    if (!student_id || images.length === 0) {
      return new Response(JSON.stringify({ error: 'student_id and images required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const results: any[] = [];

    for (const img of images) {
      let detection = { publisher: null as string | null, book_title: null as string | null, class: null as string | null, board: null as string | null, confidence: 0 };
      try {
        const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: 'You are a textbook identifier for Indian school books (Class 1-12). Look at the cover image and return ONLY a JSON object: {"publisher":"","book_title":"","class":"","board":"CBSE|ICSE|State|Unknown","confidence":0-1}. If unsure, use null and low confidence.',
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: `Identify this ${img.subject} textbook cover.` },
                  { type: 'image_url', image_url: { url: img.dataUrl } },
                ],
              },
            ],
            response_format: { type: 'json_object' },
          }),
        });
        if (r.ok) {
          const j = await r.json();
          const txt = j.choices?.[0]?.message?.content ?? '{}';
          detection = { ...detection, ...JSON.parse(txt) };
        }
      } catch (e) {
        console.error('detect-books vision error', e);
      }

      const { data: saved } = await admin
        .from('student_books')
        .upsert(
          {
            student_id,
            subject: img.subject,
            publisher: detection.publisher,
            book_title: detection.book_title,
            detected_class: detection.class,
            detected_board: detection.board,
            confidence: detection.confidence,
            raw_detection: detection,
          },
          { onConflict: 'student_id,subject' },
        )
        .select()
        .single();

      results.push(saved);
    }

    return new Response(JSON.stringify({ books: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('detect-books error', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});