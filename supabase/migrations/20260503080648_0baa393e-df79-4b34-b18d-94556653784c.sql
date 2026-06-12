
CREATE TABLE public.study_podcasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  student_id UUID NOT NULL,
  title TEXT NOT NULL,
  script JSONB NOT NULL DEFAULT '{}'::jsonb,
  exchanges INTEGER NOT NULL DEFAULT 20,
  teacher_name TEXT,
  student_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_study_podcasts_project ON public.study_podcasts(project_id, created_at DESC);

ALTER TABLE public.study_podcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon study_podcasts" ON public.study_podcasts
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Students view own podcasts" ON public.study_podcasts
  FOR SELECT USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "Students insert own podcasts" ON public.study_podcasts
  FOR INSERT WITH CHECK (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "Students delete own podcasts" ON public.study_podcasts
  FOR DELETE USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
