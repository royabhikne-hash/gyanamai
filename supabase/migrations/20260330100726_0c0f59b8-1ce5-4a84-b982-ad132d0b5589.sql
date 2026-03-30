
-- 1. Fix exam_prep_invites: restrict to own invites only (invite joining handled via edge function)
DROP POLICY IF EXISTS "Authenticated can view active invites by code" ON public.exam_prep_invites;

-- Students can only view their own invites
-- Invite code lookup for joining is handled server-side via edge function with service role
CREATE POLICY "Students view own active invites"
ON public.exam_prep_invites FOR SELECT TO authenticated
USING (
  inviter_id IN (SELECT students.id FROM students WHERE students.user_id = auth.uid())
  OR joined_by IN (SELECT students.id FROM students WHERE students.user_id = auth.uid())
);

-- 2. Add missing UPDATE policies on storage buckets
CREATE POLICY "Students update own exam materials"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'exam-prep-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Students update own study files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'study-blaster-files' AND (storage.foldername(name))[1] = auth.uid()::text);
