ALTER TABLE public.exam_prep_sessions
  ADD COLUMN IF NOT EXISTS syllabus_structure JSONB,
  ADD COLUMN IF NOT EXISTS priority_plan JSONB;