CREATE OR REPLACE FUNCTION public.prevent_student_sensitive_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Allow service_role (edge functions) to update sensitive fields
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block authenticated users (students) from modifying sensitive fields
  NEW.is_approved := OLD.is_approved;
  NEW.is_banned := OLD.is_banned;
  NEW.approved_by := OLD.approved_by;
  NEW.approved_at := OLD.approved_at;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.student_type := OLD.student_type;
  NEW.school_id := OLD.school_id;
  NEW.coaching_center_id := OLD.coaching_center_id;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;