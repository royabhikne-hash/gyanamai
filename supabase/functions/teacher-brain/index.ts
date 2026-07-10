// TeacherBrain — server-side reasoning pipeline.
// Observe -> Remember -> Think -> Decide -> Speak.
//
// Every teacher reaction, refusal, or in-lesson comment should route through
// this endpoint so behaviour comes from student state, not Math.random().
//
// Actions:
//   daily_recall         — one specific memory line to open a session
//   should_refuse_replan — reason-based: refuse rethinking today's plan?
//   should_refuse_exit   — reason-based: refuse to let student quit mid-way?
//   react_to_answer      — in-lesson micro-reaction to a right/wrong answer
//   step_reaction        — reaction when a plan step is completed
//
// Response shape:
//   { decision: "allow" | "refuse" | "react", speech: string, evidence: string[] }

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

type Action =
  | 'daily_recall'
  | 'should_refuse_replan'
  | 'should_refuse_exit'
  | 'react_to_answer'
  | 'step_reaction';

type Memory = {
  name: string;
  weakTopics: string[];
  strongTopics: string[];
  lastSessionSummary: string | null;
  daysSinceLastSession: number | null;
  // Repeating mistake detection: same weak topic seen in mcq errors more than once in last 14 days.
  repeatingMistake: { subject: string; topic: string; lastSeen: string; count: number } | null;
  // Most recent wrong answer (from mcq_attempts.answers[]).
  lastMistake: { subject: string; topic: string; when: string } | null;
  // Homework / plan state today.
  todayPlan: { total: number; done: number; hasHomeworkStep: boolean } | null;
  // Recent trend from topic_mastery.
  improvingTopic: string | null;
};

function partOfDay(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

async function observe(admin: any, studentId: string): Promise<Memory> {
  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: student },
    { data: mem },
    { data: lastSession },
    { data: recentMcq },
    { data: masteryImproving },
    { data: todayPlan },
  ] = await Promise.all([
    admin.from('students').select('full_name').eq('id', studentId).maybeSingle(),
    admin.from('student_memory').select('*').eq('student_id', studentId).maybeSingle(),
    admin.from('study_sessions').select('topic, created_at').eq('student_id', studentId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('mcq_attempts').select('subject, questions, answers, created_at').eq('student_id', studentId).order('created_at', { ascending: false }).limit(6),
    admin.from('topic_mastery').select('subject, topic, trend, mastery_score').eq('student_id', studentId).eq('trend', 'improving').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('daily_plans').select('steps, completed_steps').eq('student_id', studentId).eq('plan_date', today).maybeSingle(),
  ]);

  // Walk mcq attempts to find last wrong + repeating mistake.
  const wrongTopicCounts = new Map<string, { subject: string; topic: string; count: number; lastSeen: string }>();
  let lastMistake: Memory['lastMistake'] = null;
  for (const attempt of recentMcq ?? []) {
    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    const questions = Array.isArray(attempt.questions) ? attempt.questions : [];
    for (let i = 0; i < answers.length; i++) {
      const a: any = answers[i];
      if (a && a.isCorrect === false) {
        const q: any = questions[i] ?? {};
        const topic = String(q.topic ?? attempt.subject ?? 'a concept');
        const key = `${attempt.subject}::${topic}`;
        const prev = wrongTopicCounts.get(key);
        wrongTopicCounts.set(key, {
          subject: attempt.subject,
          topic,
          count: (prev?.count ?? 0) + 1,
          lastSeen: prev?.lastSeen ?? attempt.created_at,
        });
        if (!lastMistake) lastMistake = { subject: attempt.subject, topic, when: attempt.created_at };
      }
    }
  }
  let repeating: Memory['repeatingMistake'] = null;
  for (const v of wrongTopicCounts.values()) {
    if (v.count >= 2 && (!repeating || v.count > repeating.count)) repeating = v;
  }

  const daysSinceLastSession = lastSession?.created_at
    ? Math.floor((Date.now() - new Date(lastSession.created_at).getTime()) / 86400000)
    : null;

  const steps: any[] = Array.isArray(todayPlan?.steps) ? (todayPlan!.steps as any[]) : [];
  const done: number[] = Array.isArray(todayPlan?.completed_steps) ? (todayPlan!.completed_steps as number[]) : [];

  return {
    name: (student?.full_name ?? 'friend').split(' ')[0],
    weakTopics: (mem?.weak_topics as any[] ?? []).map((t: any) => (typeof t === 'string' ? t : t?.topic)).filter(Boolean),
    strongTopics: (mem?.strong_topics as any[] ?? []).map((t: any) => (typeof t === 'string' ? t : t?.topic)).filter(Boolean),
    lastSessionSummary: mem?.last_session_summary ?? (lastSession?.topic ? `Last studied: ${lastSession.topic}` : null),
    daysSinceLastSession,
    repeatingMistake: repeating,
    lastMistake,
    todayPlan: steps.length
      ? { total: steps.length, done: done.length, hasHomeworkStep: steps.some((s) => s?.type === 'homework_review') }
      : null,
    improvingTopic: masteryImproving?.topic ?? null,
  };
}

// THINK: pure rules first — cheap, deterministic, no LLM.
// Return { decision, reasonKey, evidence } that Speak can turn into words.
function think(action: Action, m: Memory, payload: any) {
  const evidence: string[] = [];
  const plan = m.todayPlan;

  if (action === 'should_refuse_replan') {
    if (!plan) return { decision: 'allow', reasonKey: 'no_plan', evidence };
    if (plan.done === 0) {
      evidence.push('student has not started any step yet');
      return { decision: 'refuse', reasonKey: 'not_started', evidence };
    }
    if (plan.hasHomeworkStep && plan.done < 1) {
      evidence.push('homework review still pending');
      return { decision: 'refuse', reasonKey: 'homework_pending', evidence };
    }
    return { decision: 'allow', reasonKey: 'ok_to_replan', evidence };
  }

  if (action === 'should_refuse_exit') {
    if (!plan) return { decision: 'allow', reasonKey: 'no_plan', evidence };
    const remaining = plan.total - plan.done;
    if (remaining <= 0) return { decision: 'allow', reasonKey: 'done', evidence };
    if (plan.done === 0) {
      evidence.push('leaving before starting');
      return { decision: 'refuse', reasonKey: 'not_started', evidence };
    }
    if (remaining === 1) {
      evidence.push('only one step left');
      return { decision: 'refuse', reasonKey: 'one_left', evidence };
    }
    if (m.repeatingMistake) {
      evidence.push(`repeating mistake on ${m.repeatingMistake.topic}`);
      return { decision: 'refuse', reasonKey: 'repeating_mistake', evidence };
    }
    return { decision: 'allow', reasonKey: 'ok_to_leave', evidence };
  }

  if (action === 'react_to_answer') {
    const { isCorrect, topic, subject } = payload ?? {};
    if (isCorrect) {
      if (m.improvingTopic && (m.improvingTopic === topic)) evidence.push(`improving in ${topic}`);
      return { decision: 'react', reasonKey: isCorrect ? 'correct' : 'wrong', evidence };
    }
    // wrong
    if (m.repeatingMistake && m.repeatingMistake.topic === topic) {
      evidence.push(`same mistake as ${new Date(m.repeatingMistake.lastSeen).toLocaleDateString('en-IN', { weekday: 'long' })}`);
      return { decision: 'react', reasonKey: 'repeating_wrong', evidence };
    }
    if (m.weakTopics.includes(topic)) evidence.push(`${topic} is a known weak spot`);
    return { decision: 'react', reasonKey: 'wrong', evidence };
  }

  if (action === 'step_reaction') {
    const { stepType, topic, isLast } = payload ?? {};
    if (isLast) return { decision: 'react', reasonKey: 'final', evidence };
    if (m.improvingTopic && topic && m.improvingTopic === topic) {
      evidence.push(`improving in ${topic}`);
      return { decision: 'react', reasonKey: 'improving', evidence };
    }
    if (m.lastMistake && m.lastMistake.topic === topic) {
      evidence.push(`this was a mistake area recently`);
      return { decision: 'react', reasonKey: 'recovered', evidence };
    }
    return { decision: 'react', reasonKey: 'done', evidence };
  }

  // daily_recall
  if (m.repeatingMistake) evidence.push(`repeating mistake on ${m.repeatingMistake.topic}`);
  if (m.lastMistake) evidence.push(`last wrong: ${m.lastMistake.topic}`);
  if (m.improvingTopic) evidence.push(`improving in ${m.improvingTopic}`);
  if (m.daysSinceLastSession != null && m.daysSinceLastSession >= 2) evidence.push(`${m.daysSinceLastSession} days since last session`);
  return { decision: 'react', reasonKey: 'recall', evidence };
}

// SPEAK: turn the decision + evidence into one warm human sentence.
async function speak(action: Action, decision: any, m: Memory, payload: any, language: string): Promise<string> {
  const langInstr =
    language === 'hi' ? 'Reply in Hindi (Devanagari).'
    : language === 'hinglish' ? 'Reply in warm Hinglish (Roman script).'
    : language === 'kn' ? 'Reply in Kannada.'
    : 'Reply in simple English.';

  const sys = `You are the student's personal Teacher. Never say "AI", "bot", "tool", "app", "system", "MCQ", "flashcards".
${langInstr}
Return ONE short spoken sentence (max 22 words). Warm, human, specific. Reference the evidence naturally when useful. No emojis. No bullet points. No greetings unless it's the daily_recall action.`;

  const user = `Action: ${action}
Decision: ${decision.decision} / ${decision.reasonKey}
Student name: ${m.name}
Time of day: ${partOfDay()}
Evidence: ${decision.evidence.join('; ') || 'none'}
Extra: ${JSON.stringify(payload ?? {}).slice(0, 200)}
Recent memory: last=${m.lastSessionSummary ?? 'none'}, weak=${m.weakTopics.slice(0, 3).join(', ') || 'none'}, repeating=${m.repeatingMistake ? m.repeatingMistake.topic : 'none'}`;

  try {
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      }),
    });
    if (!r.ok) throw new Error(`gateway ${r.status}`);
    const j = await r.json();
    const txt = String(j.choices?.[0]?.message?.content ?? '').trim().replace(/^["']|["']$/g, '');
    if (txt) return txt;
  } catch (e) {
    console.error('teacher-brain speak error', e);
  }
  // Deterministic fallbacks per reason key so the teacher never goes silent.
  const fallback: Record<string, string> = {
    not_started: "Hmm — you haven't started yet. Give me five minutes first, then we'll see.",
    homework_pending: "Wait. Homework check is still open. Let's clear that first.",
    one_left: "Just one step left. Don't leave it for tomorrow — finish it.",
    repeating_mistake: "Before you go — you slipped on the same spot again. Two more minutes with me.",
    ok_to_leave: "Alright. Come back when you can. I'll adjust.",
    ok_to_replan: "Okay, let me rethink today for you.",
    correct: "Good. That's exactly it.",
    wrong: "Wait — I think I know why. Let's slow down.",
    repeating_wrong: `Same slip as before, ${m.name}. Let me explain it differently.`,
    improving: "See — this used to trouble you. Not anymore.",
    recovered: "You cleared a spot you struggled with earlier. Noted.",
    final: "That's it for today. I saw where you paused — I'll use that tomorrow.",
    done: "Good. Moving on.",
    recall: m.repeatingMistake
      ? `Before we begin — you keep slipping on ${m.repeatingMistake.topic}. We'll fix that today.`
      : m.lastMistake
        ? `Last time you got stuck on ${m.lastMistake.topic}. I've kept that in mind.`
        : `I've looked at everything you did recently, ${m.name}. Ready when you are.`,
  };
  return fallback[decision.reasonKey] ?? "Okay. Let's keep going.";
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { student_id, action, payload } = body as { student_id?: string; action?: Action; payload?: any };
    if (!student_id || !action) {
      return new Response(JSON.stringify({ error: 'student_id and action required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const language = (req.headers.get('x-lang') ?? 'en').toLowerCase();

    const memory = await observe(admin, student_id);
    const decision = think(action, memory, payload);
    // No speech needed for a plain "allow" — client will just proceed silently.
    const speech = decision.decision === 'allow' && action !== 'daily_recall'
      ? ''
      : await speak(action, decision, memory, payload, language);

    return new Response(JSON.stringify({
      decision: decision.decision,
      reason: decision.reasonKey,
      evidence: decision.evidence,
      speech,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('teacher-brain error', e);
    // Never break the illusion — allow the action, stay silent.
    return new Response(JSON.stringify({ decision: 'allow', reason: 'error', evidence: [], speech: '' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});