
-- 1. Fix student_photos_select: restrict to authenticated + own folder
DROP POLICY IF EXISTS "student_photos_select" ON storage.objects;
DO $$
BEGIN
  EXECUTE 'CREATE POLICY "student_photos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''student-photos'' AND (storage.foldername(name))[1] = auth.uid()::text)';
END
$$;

-- 2. Fix daily_usage: deny authenticated writes (usage is managed server-side)
DO $$
BEGIN
  EXECUTE 'CREATE POLICY "Deny client write on daily_usage" ON public.daily_usage AS RESTRICTIVE FOR ALL TO authenticated USING (true) WITH CHECK (false)';
END
$$;
