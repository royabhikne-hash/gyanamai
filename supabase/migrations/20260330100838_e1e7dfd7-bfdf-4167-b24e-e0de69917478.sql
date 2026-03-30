
-- 1. Fix coaching_centers: change PERMISSIVE deny to RESTRICTIVE deny
DROP POLICY IF EXISTS "Deny all direct access to coaching_centers" ON public.coaching_centers;
CREATE POLICY "Deny all direct access to coaching_centers"
ON public.coaching_centers FOR ALL TO public
USING (false)
WITH CHECK (false);
ALTER POLICY "Deny all direct access to coaching_centers" ON public.coaching_centers USING (false);
-- Need to recreate as restrictive
DROP POLICY IF EXISTS "Deny all direct access to coaching_centers" ON public.coaching_centers;

DO $$
BEGIN
  EXECUTE 'CREATE POLICY "Deny all direct access to coaching_centers" ON public.coaching_centers AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false)';
END
$$;

-- 2. Fix daily_usage: change PERMISSIVE deny to RESTRICTIVE
DROP POLICY IF EXISTS "Deny anonymous access to daily_usage" ON public.daily_usage;
DO $$
BEGIN
  EXECUTE 'CREATE POLICY "Deny anonymous access to daily_usage" ON public.daily_usage AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)';
END
$$;

-- 3. Fix student-photos bucket: make it private
UPDATE storage.buckets SET public = false WHERE id = 'student-photos';
