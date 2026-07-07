
-- 1) student_books
CREATE TABLE public.student_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  publisher TEXT,
  book_title TEXT,
  cover_url TEXT,
  detected_class TEXT,
  detected_board TEXT,
  confidence NUMERIC,
  raw_detection JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_books TO authenticated;
GRANT ALL ON public.student_books TO service_role;
ALTER TABLE public.student_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own books" ON public.student_books FOR ALL
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()))
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE TRIGGER update_student_books_updated_at BEFORE UPDATE ON public.student_books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) student_observations
CREATE TABLE public.student_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  mood TEXT,
  focus_level TEXT,
  session_length_minutes INTEGER,
  time_of_day TEXT,
  device TEXT,
  source TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.student_observations TO authenticated;
GRANT ALL ON public.student_observations TO service_role;
ALTER TABLE public.student_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own observations" ON public.student_observations FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE POLICY "Students insert own observations" ON public.student_observations FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE INDEX idx_student_obs_student_time ON public.student_observations(student_id, observed_at DESC);

-- 3) student_memory (one row per student)
CREATE TABLE public.student_memory (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  weak_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  strong_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  learning_style TEXT,
  best_study_time TEXT,
  streak_health TEXT,
  last_session_summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_memory TO authenticated;
GRANT ALL ON public.student_memory TO service_role;
ALTER TABLE public.student_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own memory" ON public.student_memory FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE TRIGGER update_student_memory_updated_at BEFORE UPDATE ON public.student_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) daily_plans
CREATE TABLE public.daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  greeting TEXT,
  recap TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, plan_date)
);
GRANT SELECT, UPDATE ON public.daily_plans TO authenticated;
GRANT ALL ON public.daily_plans TO service_role;
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own plan" ON public.daily_plans FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE POLICY "Students update own plan progress" ON public.daily_plans FOR UPDATE
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE TRIGGER update_daily_plans_updated_at BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
