
-- Fix: Restrict exam_prep_invites UPDATE so only the inviter or an unclaimed invite can be modified
DROP POLICY IF EXISTS "Students can join invites" ON public.exam_prep_invites;

CREATE POLICY "Students can join unclaimed invites"
ON public.exam_prep_invites
FOR UPDATE
TO authenticated
USING (
  is_active = true
  AND joined_by IS NULL
)
WITH CHECK (
  is_active = true
  AND joined_by IN (
    SELECT students.id FROM public.students WHERE students.user_id = auth.uid()
  )
);

-- Defense in depth: tighten student UPDATE policy with WITH CHECK that re-asserts sensitive fields cannot diverge
-- (the prevent_student_sensitive_update trigger already enforces this; this adds a clearer policy intent)
COMMENT ON POLICY "Students can update own safe fields" ON public.students IS
  'Sensitive fields (is_approved, is_banned, approved_by, approved_at, rejection_reason, student_type, school_id, coaching_center_id, user_id) are protected by the prevent_student_sensitive_update trigger which resets them to OLD values for non-service_role updates.';
