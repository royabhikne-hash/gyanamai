
-- Create topic_mastery table
CREATE TABLE public.topic_mastery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  mastery_score INTEGER NOT NULL DEFAULT 50,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_practiced TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trend TEXT NOT NULL DEFAULT 'stable' CHECK (trend IN ('improving', 'declining', 'stable')),
  score_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject, topic)
);

-- Enable RLS
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Deny anonymous access to topic_mastery"
  ON public.topic_mastery FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Students can view own topic mastery"
  ON public.topic_mastery FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "Students can insert own topic mastery"
  ON public.topic_mastery FOR INSERT TO authenticated
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "Students can update own topic mastery"
  ON public.topic_mastery FOR UPDATE TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_topic_mastery_student ON public.topic_mastery(student_id);
CREATE INDEX idx_topic_mastery_score ON public.topic_mastery(student_id, mastery_score);
