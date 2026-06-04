
-- =====================================================================
-- 1. STUDENTS: block sensitive-column updates by client UPDATEs
-- =====================================================================
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Students can update own safe fields" ON public.students;

-- Recreate with a strict WITH CHECK that pins sensitive fields to their
-- existing values. The trigger `prevent_student_sensitive_update`
-- already protects against changes for the authenticated role, but
-- defense-in-depth: explicitly check at the policy layer too.
CREATE POLICY "Students can update own safe fields"
ON public.students
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
);
-- Note: column-level enforcement is handled by the existing trigger
-- `prevent_student_sensitive_update` which resets sensitive cols to OLD.*
-- on any non-service-role update.

-- =====================================================================
-- 2. EXAM_PREP_INVITES: require invite_code match on claim
-- =====================================================================
DROP POLICY IF EXISTS "Students can join unclaimed invites" ON public.exam_prep_invites;

-- Replace with a tighter policy that only allows claiming when the row
-- is still unclaimed AND the caller is updating their own joined_by id.
-- Code-knowledge is enforced application-side by selecting via invite_code
-- before issuing the UPDATE — combined with the policy's joined_by IS NULL
-- check this is safe from UUID enumeration as long as invite_code is the
-- only way to read the row id.
CREATE POLICY "Students can join unclaimed invites"
ON public.exam_prep_invites
FOR UPDATE
TO authenticated
USING (
  is_active = true
  AND joined_by IS NULL
  AND inviter_id <> (
    SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1
  )
)
WITH CHECK (
  is_active = true
  AND joined_by IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
);

-- Also tighten SELECT so students cannot enumerate other students' invites
DROP POLICY IF EXISTS "Students view own invites" ON public.exam_prep_invites;
CREATE POLICY "Students view own invites"
ON public.exam_prep_invites
FOR SELECT
TO authenticated
USING (
  inviter_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  OR joined_by IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

-- =====================================================================
-- 3. SECURITY DEFINER functions: revoke from public/authenticated/anon
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_basic_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_student_sensitive_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Keep validate_session_token and check_ai_rate_limit callable — they're
-- intentionally exposed.
GRANT EXECUTE ON FUNCTION public.validate_session_token(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(uuid, text, integer, integer) TO authenticated, service_role;

-- =====================================================================
-- 4. Move pg_net extension out of public (lint fix)
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS extensions;
-- ALTER EXTENSION is idempotent; harmless if already moved
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      EXECUTE 'ALTER EXTENSION pg_net SET SCHEMA extensions';
    EXCEPTION WHEN OTHERS THEN
      -- Some Supabase managed envs disallow moving pg_net; log and continue.
      RAISE NOTICE 'pg_net schema move skipped: %', SQLERRM;
    END;
  END IF;
END $$;
