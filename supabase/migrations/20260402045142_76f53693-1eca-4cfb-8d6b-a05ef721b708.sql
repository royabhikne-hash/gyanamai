-- Fix exam_prep_invites: drop conflicting SELECT policies, create one consolidated PERMISSIVE policy
DROP POLICY IF EXISTS "Students view own active invites" ON public.exam_prep_invites;
DROP POLICY IF EXISTS "Students view own exam_prep_invites" ON public.exam_prep_invites;

-- Single permissive SELECT: students can see invites they created OR joined
CREATE POLICY "Students view own invites"
ON public.exam_prep_invites
FOR SELECT
TO authenticated
USING (
  (inviter_id IN (SELECT students.id FROM students WHERE students.user_id = auth.uid()))
  OR
  (joined_by IN (SELECT students.id FROM students WHERE students.user_id = auth.uid()))
);

-- Add UPDATE policy so students can claim an invite (set joined_by)
CREATE POLICY "Students can join invites"
ON public.exam_prep_invites
FOR UPDATE
TO authenticated
USING (is_active = true)
WITH CHECK (
  joined_by IN (SELECT students.id FROM students WHERE students.user_id = auth.uid())
);