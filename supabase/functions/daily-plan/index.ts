import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

type Step = {
  type: 'homework_review' | 'revision' | 'teach' | 'mcq' | 'notebook' | 'flashcards';
  subject?: string;
  topic: string;
  minutes: number;
  reason?: string;
};

function partOfDay(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

function fallbackPlan(name: string, subjects: string[]): { greeting: string; recap: string; steps: Step[]; total: number } {
  const subj = subjects[0] ?? 'your syllabus';
  const steps: Step[] = [
    { type: 'revision', subject: subj, topic: 'Last chapter recap', minutes: 10, reason: 'Warm-up before new material.' },
    { type: 'teach', subject: subj, topic: 'Next concept', minutes: 25, reason: "Today's core lesson." },
    { type: 'mcq', subject: subj, topic: 'Quick check', minutes: 15, reason: 'Practice what you just learnt.' },
    { type: 'notebook', subject: subj, topic: 'Write 3 short answers', minutes: 10, reason: 'Retention through writing.' },
  ];
  return {
    greeting: `Good ${partOfDay()}, ${name}.`,
    recap: "Let's keep your streak going. I've kept today light but focused.",
    steps,
    total: steps.reduce((s, x) => s + x.minutes, 0),
  };
}

async function aiPlan(input: {
  name: string;
  className?: string;
  board?: string;
  language: string;
  subjects: string[];
  weakTopics: any[];
  strongTopics: any[];
  lastSummary?: string | null;
}): Promise<{ greeting: string; recap: string; steps: Step[]; total: number } | null> {
  const langInstr =
    input.language === 'hi' ? 'Reply in clean Hindi (Devanagari).'
    : input.language === 'hinglish' ? 'Reply in warm Hinglish (Roman script, English + Hindi mixed).'
    : input.language === 'kn' ? 'Reply in Kannada.'
    : 'Reply in simple English.';

  const sys = `You are Gyanam, a personal AI Tutor. Build TODAY's study plan for a Class ${input.className ?? '?'} ${input.board ?? ''} student.
${langInstr}
You always speak first, like a caring teacher. Never ask the student what to study — you decide.
Return ONLY strict JSON with this exact shape:
{
  "greeting": "1 short sentence greeting the student by name and referencing time of day",
  "recap": "1-2 sentences recalling yesterday and setting today's tone",
  "steps": [{"type":"revision|teach|mcq|notebook|homework_review|flashcards","subject":"","topic":"","minutes":number,"reason":"1 short sentence"}]
}
Rules: 3-5 steps, total 40-75 minutes, always start with revision or homework_review, always end with a light mcq or notebook step, use subjects from the provided list only.`;

  const user = `Student: ${input.name}
Subjects available: ${input.subjects.join(', ') || 'General Studies'}
Weak topics: ${JSON.stringify(input.weakTopics).slice(0, 400)}
Strong topics: ${JSON.stringify(input.strongTopics).slice(0, 400)}
Last session summary: ${input.lastSummary ?? 'None'}
Time of day: ${partOfDay()}`;

  try {
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const txt = j.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(txt);
    const steps: Step[] = Array.isArray(parsed.steps) ? parsed.steps.slice(0, 6) : [];
    if (steps.length === 0) return null;
    return {
      greeting: String(parsed.greeting ?? ''),
      recap: String(parsed.recap ?? ''),
      steps,
      total: steps.reduce((s, x) => s + (Number(x.minutes) || 0), 0),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { student_id, force } = await req.json().catch(() => ({}));
    if (!student_id) {
      return new Response(JSON.stringify({ error: 'student_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Cached plan for today
    const today = new Date().toISOString().slice(0, 10);
    if (!force) {
      const { data: existing } = await admin.from('daily_plans').select('*').eq('student_id', student_id).eq('plan_date', today).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ plan: existing, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const [{ data: student }, { data: books }, { data: memory }, { data: lastSession }] = await Promise.all([
      admin.from('students').select('id, full_name, class, board').eq('id', student_id).maybeSingle(),
      admin.from('student_books').select('subject').eq('student_id', student_id),
      admin.from('student_memory').select('*').eq('student_id', student_id).maybeSingle(),
      admin.from('study_sessions').select('topic, created_at').eq('student_id', student_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const subjects = (books ?? []).map((b: any) => b.subject).filter(Boolean);
    const name = (student?.full_name ?? 'friend').split(' ')[0];
    const language = (req.headers.get('x-lang') ?? 'en').toLowerCase();

    const built =
      (await aiPlan({
        name,
        className: student?.class ?? undefined,
        board: student?.board ?? undefined,
        language,
        subjects,
        weakTopics: (memory?.weak_topics as any) ?? [],
        strongTopics: (memory?.strong_topics as any) ?? [],
        lastSummary: memory?.last_session_summary ?? (lastSession?.topic ? `Last studied: ${lastSession.topic}` : null),
      })) ?? fallbackPlan(name, subjects);

    const { data: saved, error: saveErr } = await admin
      .from('daily_plans')
      .upsert(
        {
          student_id,
          plan_date: today,
          greeting: built.greeting,
          recap: built.recap,
          steps: built.steps,
          total_minutes: built.total,
          status: 'pending',
          completed_steps: [],
        },
        { onConflict: 'student_id,plan_date' },
      )
      .select()
      .single();

    if (saveErr) throw saveErr;

    return new Response(JSON.stringify({ plan: saved, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('daily-plan error', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 200, // never break the client
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});