# Gyanam AI – PDF Requirements Implementation Plan

The PDF has ~15 distinct items spanning bug fixes, UX polish, AI quality, and brand‑new features (YouTube source, syllabus algorithm rewrite, podcast voice upgrade). Doing all of it in one shot will produce a messy diff and likely regressions. I'll split it into **3 stages** and ship Stage 1 immediately after you confirm.

---

## Stage 1 — Bug Fixes & Quick Wins (ship now)

These are small, high‑impact, low‑risk changes.

1. **TTS false "Voice Error" popup** — only show the error toast when `onerror` fires, not when playback completes/cancels normally. Fix in `useSmartTTS`, `useNativeTTS`, `useSpeechifyTTS`.
2. **Study Blaster project creation failure** — add proper try/catch around the create flow in `StudyBlasterProjectList.tsx` + edge function, return structured `{ success, error }`, show success/error toasts instead of silent failure.
3. **AI sends two responses at once** — guard the chat submit handlers (`StudyChat`, `ExamPrepChat`, `StudyBlasterChat`) with an `isStreaming` lock so double‑tap/Enter+click can't fire twice.
4. **AI can't detect subject** — pass `currentSubject` + `currentChapter` into the system prompt of `study-chat` edge function so it stops "guessing general study".
5. **Hindi toggle wording** — replace "Tera Personal Gyanam AI Aa Gaya" / informal "tu" copy with respectful Hindi ("Aapka", "Namaste") across `LanguageContext`, Landing/Login.
6. **Forgot password link 10‑min expiry** — already handled by Supabase default (1h); set `OTP expiry` to 600s via auth config + show "Link valid for 10 minutes" copy on `ForgotPassword.tsx` and "Link expired" message on `ResetPassword.tsx`.
7. **School notification on new student approval request** — insert a row into existing `school_notifications` (or create one) when a student signs up with a school_id, surface a badge on School Dashboard.
8. **Compulsory student photo** — make the photo field `required` on `Signup.tsx`, validate before submit.
9. **Updated Terms & Conditions checkbox** on first signup (already partially exists — enforce it).
10. **Skeleton screens** — wire existing `DashboardSkeleton` into `StudentDashboard`, add lightweight skeletons to Study Blaster project list and Exam Prep dashboard.

## Stage 2 — AI Quality Upgrade ✅ SHIPPED

11. ✅ Rewrote system prompts in `study-chat`, `exam-prep`, `study-blaster`: respectful Hindi (aap/aapka, never tu/tera), clarifying questions for vague queries, step-by-step for hard topics, NCERT/board-aligned.
12. ✅ New WPS formula in `StudentProgress.tsx`: 25% study time (target 7h/wk) + 25% topic completion (3 chapters/wk) + 25% MCQ accuracy + 25% consistency (unique days/7). Now fetches `mcq_attempts` and `chapter_progress` in parallel.

## Stage 3 — New Features ✅ SHIPPED

13. ✅ **YouTube source** — new YouTube tab in Source Manager. `process_url` edge action detects YT URLs, scrapes `captionTracks` from watch page HTML, fetches XML transcript, stores as `extracted_content`.
14. ✅ **Exam Prep new algorithm** — two new actions: `analyze_full_syllabus` (extracts subjects→chapters→topics with importance/`pastYearFreq`/`expectedMarks` based on board pattern) and `generate_priority_plan` (day-by-day plan: front-loads must-do topics, reserves last 20% for revision/mock). Stored in `exam_prep_sessions.syllabus_structure` + `priority_plan`. UI buttons surface results.
15. ✅ **Podcast voice upgrade** — `StudyBlasterPodcast` now calls `text-to-speech` (Speechify Henry/Natasha Indian voices) per turn with prosody pacing. Auto-falls-back to browser TTS on Basic plan. Toggle in player UI.

---

## Technical Notes

- All edge function changes follow existing rule: return HTTP 200 + JSON, parse `req.json()` once.
- New school‑notification table (if needed) will include `GRANT` + RLS per project conventions.
- Skeleton components reuse existing `DashboardSkeleton.tsx` patterns — no new deps.
- No schema changes in Stage 1 except possibly `school_notifications` table.

---

**Approve and I'll ship Stage 1 immediately.** Then we move to Stage 2, then Stage 3 — each as a separate, reviewable change so nothing regresses.
