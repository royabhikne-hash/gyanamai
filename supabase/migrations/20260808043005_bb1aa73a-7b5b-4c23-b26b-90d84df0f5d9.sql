ALTER TABLE public.topic_mastery
  ADD COLUMN IF NOT EXISTS understanding_score numeric,
  ADD COLUMN IF NOT EXISTS alpha numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS beta numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mcq_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS test_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chatbot_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz;

CREATE TABLE IF NOT EXISTS public.weekly_effort_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  study_minutes integer NOT NULL DEFAULT 0,
  active_days integer NOT NULL DEFAULT 0,
  chapters_covered integer NOT NULL DEFAULT 0,
  exam_tasks_completed integer NOT NULL DEFAULT 0,
  effort_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_effort_scores TO authenticated;
GRANT ALL ON public.weekly_effort_scores TO service_role;

ALTER TABLE public.weekly_effort_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own effort scores"
ON public.weekly_effort_scores FOR ALL TO authenticated
USING (student_id IN (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()))
WITH CHECK (student_id IN (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()));

CREATE TRIGGER update_weekly_effort_scores_updated_at
BEFORE UPDATE ON public.weekly_effort_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();