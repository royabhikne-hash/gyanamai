# Stage 4 — Security Hardening, Password Reset, Skeletons & QA

## Important clarification first (please read)

**About `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`:**
These are **not secrets**. The `anon` / publishable key is *designed* to be public and shipped to the browser — that is how every Supabase client works. Security comes from **RLS policies + JWT validation in edge functions**, not from hiding the URL. The actual secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `TWILIO_*`, `SPEECHIFY_API_KEY`) are already backend-only.
**Action:** I will leave `VITE_*` vars as-is (required for the app to work) but will lock down every edge function so the publishable key alone gives an attacker nothing.

---

## 1. Fix all 12 security findings

### Edge function auth rewrites (derive `studentId` from JWT, never trust body)
- `manage-subscription` — validate JWT on `get_subscription`, `get_daily_usage`, `check_daily_usage`, `request_upgrade`, `increment_tts`; gate `check_expiry` behind `CRON_SECRET`.
- `update-topic-mastery` — add `getClaims()`, drop body `studentId`.
- `text-to-speech` — require JWT, derive student, rate-limit per user.
- `get-students` `get_student_rankings` — require JWT, strip `phone` / `parent_whatsapp` / `user_id` from response.
- `send-weekly-report` — gate behind `CRON_SECRET` (cron) or admin session token (manual).
- `generate-mcq` — replace header-presence check with real `getClaims()`.
- `notify-school-registration` — require student JWT; verify `schoolId` matches `students.school_id`.
- `save-weekly-rankings` — require `CRON_SECRET`.
- `secure-auth` `login_auto` — sanitize identifier (reject `%`, `_`, `,`, `(`, `)`) to kill PostgREST filter injection.

### Database migration
- Tighten `students` UPDATE policy to a WITH CHECK that blocks changes to `is_approved`, `is_banned`, `student_type`, `school_id`, `coaching_center_id`, `user_id`, `approved_by`, `approved_at`, `rejection_reason`.
- Tighten `exam_prep_invites` UPDATE to require matching `invite_code`.
- Revoke `EXECUTE` on SECURITY DEFINER functions from `anon` / `authenticated` where not needed (`cleanup_expired_sessions`, `create_basic_subscription`, `prevent_student_sensitive_update`). Keep `has_role`-style and `check_ai_rate_limit` callable.
- Move `pg_net` / `pg_cron` out of `public` if present (informational lint).

### New secret
- Add `CRON_SECRET` (I'll request via `add_secret` when we start).

---

## 2. Password reset 10-min expiry
- Replace Supabase's built-in `resetPasswordForEmail` flow with a custom token table:
  - New table `password_reset_tokens(token, user_id, expires_at, used_at)` — 10 min expiry.
  - Edge function `request-password-reset` — generates token, emails/WhatsApps link.
  - Edge function `verify-reset-token` + UI in `ResetPassword.tsx` — shows "This link has expired, please request a new one" if `now() > expires_at` or `used_at IS NOT NULL`.

*(If you'd rather just shorten Supabase's built-in recovery link lifetime to 10 min instead of building a custom system, say so — that's a 1-line config change in Auth settings.)*

---

## 3. WhatsApp on new signup
- `Signup.tsx` already triggers `notify-school-registration`. After Stage-4 auth hardening that function will require the student's JWT — I'll thread `session.access_token` through the invoke call.
- Verify Twilio secrets are still valid by sending a test message in dev.

---

## 4. Skeleton screens
- StudentDashboard → use existing `DashboardSkeleton` during initial load (already exists, just wire it).
- StudyChat → add message-bubble skeleton list during history fetch.
- StudentProgress / report views → use existing `ProgressSkeleton` / `ReportSkeleton`.
- Parent report PDF preview → loading skeleton before PDF renders.

---

## 5. QA Stages 1–3
- Stage 1: verify TTS no-longer-throws toast, double-send guard, Study Blaster project insert error surface, respectful Hindi copy, required photo on signup.
- Stage 2: verify new WPS formula renders on StudentProgress and AI prompts return formal "Aap" Hindi.
- Stage 3: smoke-test YouTube URL ingestion in Study Blaster, Speechify toggle, `analyze_full_syllabus` + `generate_priority_plan` in Exam Prep.
- Report any regressions back before closing.

---

## Order of execution
1. Request `CRON_SECRET` secret.
2. Ship DB migration (RLS tightening + function grants).
3. Rewrite all 8 edge functions in parallel; deploy.
4. Build password-reset token system (table + 2 functions + UI).
5. Wire skeletons.
6. QA pass on Stages 1-3 + new changes; run security rescan.

---

## Questions before I start
1. **Password reset** — custom 10-min token system as described, or just shorten Supabase Auth's built-in recovery lifetime?
2. **`CRON_SECRET`** — OK for me to request this secret via the secrets tool?
3. **Scope confirmation** — this is roughly a 25-file change touching auth on every protected endpoint. Want it as one big push, or split (security first → password reset → skeletons)?
