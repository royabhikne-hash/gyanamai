
Your request has ~8 different asks. Some are quick bug fixes, some are multi-week platform features (GLIS with teacher intelligence, heat maps, AI intervention engine). Trying to ship all of it in one turn will produce shallow, buggy work. Here is how I propose to sequence it.

## Phase 1 — Bug fixes + quick wins (this turn, if you approve)

1. **Double-click navigation bug** — "1 click sahi, 2nd click pe kahin aur chala jaata hai"
   - Audit `BottomNavBar.tsx` + `NavLink.tsx` for stale active-state / double routing
   - Fix so a single tap always lands on the right route

2. **Bottom tabs visible on desktop too**
   - Currently `BottomNavBar` is mobile-only. Make it render on all breakpoints (same look on mobile, adapted on desktop) without breaking existing mobile UX

3. **Chatbot subject detection bug**
   - "Computer Science" pooch rahe ho par bot "General Study" bol raha hai
   - Fix in `StudyChat` + `study-chat` edge function: pass and respect the active subject from `SubjectChapterSelector` instead of defaulting to General Study

4. **Performance pass (light)**
   - Add `React.lazy` for heavy routes (ExamPrep, StudyBlaster, AdminDashboard)
   - Memoize hot lists, add `transform: translateZ(0)` to already-animated cards
   - No architectural rewrite in this phase

## Phase 2 — Multilingual system (next turn)

5. **First-run language picker: English / हिंदी / Hinglish / ಕನ್ನಡ**
   - New onboarding step before `AppOnboarding` slides
   - Store in `profiles.preferred_language` (new column) + localStorage fallback
   - Extend `LanguageContext` from 2 langs to 4, add translation dictionaries
   - Every student-facing chatbot (Study Chat, Study Blaster, Exam Prep, Parent Chat) receives `preferred_language` and replies in that language
   - "Change language" control on Student Profile

## Phase 3 — GLIS foundations (following turn)

Rebrand **WPS → Gyanam Learning Intelligence (GLIS)** and ship the first two layers end-to-end:

6. **Layer 1 — Daily Learning Pulse (DLP)**
   - Nightly edge function `compute-daily-pulse` writes to new `daily_pulse` table
   - Fields: score, study_time, concepts_learned, revision_done, mcq_ratio, focus, energy, tomorrow_action
   - New `DailyPulseCard` on Student Dashboard replacing the current "today" strip

7. **Layer 2 — Weekly Learning Health**
   - Rename WPS UI to "Learning Health", keep formula but add sub-pillars: Habit / Retention / Understanding / Accuracy
   - Weekly delta (↑ +6 vs last week) + AI recommendation string

## Phase 4 — GLIS advanced (separate turns, one layer per turn)

Each of these is a full feature on its own — I will scope + plan each before building:

- **Layer 3** Monthly Growth Report (parent + student view)
- **Layer 4a** Teacher Intelligence Dashboard (class map: Healthy / Attention / Critical / Inactive, per-student drilldown, class chapter heat map)
- **Layer 4b** AI Classroom Prediction ("28% may struggle in Electricity")
- **Layer 4c** Weekly Teacher Brief (Monday morning report)
- **Parent Dashboard** rewritten in plain language
- **Principal Dashboard** with school-wide health + teacher performance + attendance correlation
- **AI Alert System** (auto WhatsApp to teacher on 5-day inactivity / accuracy drop)
- **AI Intervention Engine** — the closed loop: detect weak → auto revision → still weak → notify teacher → teacher session → AI verifies improvement → parent notified

## Technical notes (for your reference)

- New tables required for GLIS: `daily_pulse`, `weekly_health`, `monthly_growth`, `class_heatmap_cache`, `ai_interventions`. Each with RLS + GRANTs.
- New edge functions: `compute-daily-pulse` (cron nightly), `compute-weekly-health` (cron Sunday), `compute-monthly-growth` (cron 1st of month), `teacher-intelligence`, `ai-intervention-engine`.
- Multilingual: extending `LanguageContext` + passing `lang` param to every AI edge function's system prompt.
- Desktop bottom nav: `BottomNavBar` currently gated by `sm:hidden` — remove the gate, restyle for desktop width.

## What I need from you

**Approve Phase 1 to start now.** Reply "go phase 1" (or list which items from phase 1 to skip). I'll ship those, verify with a build, then we move to Phase 2 in the next turn.

If you want a different order — e.g. multilingual first, or teacher dashboard first — tell me and I'll reshuffle.
