// Teacher persona: small language bank so reactions feel human, not templated.
// Never expose tool names or the word "AI".

export const partOfDay = (d = new Date()) => {
  const h = d.getHours();
  if (h < 12) return "morning" as const;
  if (h < 17) return "afternoon" as const;
  if (h < 21) return "evening" as const;
  return "night" as const;
};

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// Shown while the teacher "thinks" before revealing today's session.
export const thinkingLines = [
  "One second… I'm checking yesterday's work.",
  "Give me a moment… going through where we stopped.",
  "Hmm, looking at what you did last time…",
  "Just a second — pulling up your notebook.",
];

// Warm reactions when a step is marked done.
export const doneReactions = [
  "Good. That's exactly what I wanted.",
  "Hmm — nicely done.",
  "Okay, I saw that. Moving on.",
  "Better than yesterday. Keep going.",
  "Good — I expected you to get through that.",
];

// Reactions for the last step of the day.
export const finalReactions = [
  "That's it for today. You showed up — that matters.",
  "We're done. I'll adjust tomorrow based on what I saw.",
  "Good session. Rest properly, we go again tomorrow.",
];

// Teacher pushes back when student tries to re-plan / skip.
export const refuseSkipLines = [
  "Hmm… I'd rather not change it. You still haven't finished what I set. Give me five minutes first.",
  "Wait. I already thought about today carefully. Let's just start — you'll feel better in five minutes.",
  "One second. Changing the plan won't help right now. Sit down, we do the first step together.",
];

// Proactive line based on time-of-day + whether student has done any step.
export const proactiveNote = (opts: { name: string; hasStarted: boolean; allDone: boolean }) => {
  const { name, hasStarted, allDone } = opts;
  const p = partOfDay();
  if (allDone) {
    return pick([
      `You finished today, ${name}. I've already started preparing tomorrow.`,
      `Done for today. Rest — I'll plan the next one before you're back.`,
    ]);
  }
  if (p === "morning") {
    return pick([
      `Good morning, ${name}. Everything is ready — sit down when you can.`,
      `Morning. I've kept today short and focused. Come when you're ready.`,
    ]);
  }
  if (p === "afternoon") {
    return hasStarted
      ? `You started earlier — pick up where we stopped.`
      : `Afternoon, ${name}. Ten minutes now is better than an hour tonight.`;
  }
  if (p === "evening") {
    return hasStarted
      ? `Let's finish what we started. Not much left.`
      : `Evening, ${name}. This is usually when you study best. I'm ready.`;
  }
  return hasStarted
    ? `Late already — just close the last step, then sleep.`
    : `Late night, ${name}. Do one small step so tomorrow feels lighter.`;
};

export const pickLine = pick;