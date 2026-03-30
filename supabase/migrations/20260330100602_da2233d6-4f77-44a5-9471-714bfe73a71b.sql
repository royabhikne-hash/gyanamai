
-- 1. Fix extension in public: move uuid-ossp to extensions schema (already done, but the linter still flags it - ensure it's in extensions)
-- Note: uuid-ossp is already in extensions schema per query above

-- 2. Fix exam_prep_invites: restrict "Anyone can view active invites" to authenticated only with ownership check
DROP POLICY IF EXISTS "Anyone can view active invites" ON public.exam_prep_invites;
CREATE POLICY "Authenticated can view active invites by code"
ON public.exam_prep_invites FOR SELECT TO authenticated
USING (is_active = true);

-- 3. Fix storage: exam-prep-materials - enforce folder-based ownership
DROP POLICY IF EXISTS "Students view own exam materials" ON storage.objects;
DROP POLICY IF EXISTS "Students upload own exam materials" ON storage.objects;
DROP POLICY IF EXISTS "Students delete own exam materials" ON storage.objects;

CREATE POLICY "Students view own exam materials"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'exam-prep-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Students upload own exam materials"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exam-prep-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Students delete own exam materials"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exam-prep-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Fix storage: study-blaster-files - enforce folder-based ownership
DROP POLICY IF EXISTS "Students view own study files" ON storage.objects;
DROP POLICY IF EXISTS "Students upload own study files" ON storage.objects;
DROP POLICY IF EXISTS "Students delete own study files" ON storage.objects;

CREATE POLICY "Students view own study files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'study-blaster-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Students upload own study files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'study-blaster-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Students delete own study files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'study-blaster-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Fix student-photos: remove the overly permissive "Users can upload their own photo" policy
DROP POLICY IF EXISTS "Users can upload their own photo" ON storage.objects;

-- 6. Clean up duplicate student-photos policies (keep only the properly scoped ones)
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own photos" ON storage.objects;
DROP POLICY IF EXISTS "Students can delete own photos" ON storage.objects;
DROP POLICY IF EXISTS "Students can update own photos" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload own photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to student photos" ON storage.objects;
