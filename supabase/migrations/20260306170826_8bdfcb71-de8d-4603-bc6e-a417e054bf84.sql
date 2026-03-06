
-- Exam prep sessions table
CREATE TABLE public.exam_prep_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exam_name text NOT NULL DEFAULT '',
  exam_date date,
  target_score integer,
  topic_familiarity text NOT NULL DEFAULT 'new',
  mood text NOT NULL DEFAULT 'neutral',
  onboarding_completed boolean NOT NULL DEFAULT false,
  extracted_topics jsonb DEFAULT '[]'::jsonb,
  mastery_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Exam prep materials (uploaded PDFs)
CREATE TABLE public.exam_prep_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exam_prep_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer DEFAULT 0,
  extracted_content text,
  extracted_topics jsonb DEFAULT '[]'::jsonb,
  processing_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Exam prep chat messages
CREATE TABLE public.exam_prep_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exam_prep_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Exam prep usage tracking (monthly limits)
CREATE TABLE public.exam_prep_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  usage_month date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  sessions_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, usage_month)
);

-- Invite links for social study
CREATE TABLE public.exam_prep_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exam_prep_sessions(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invite_code text NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  joined_by uuid REFERENCES public.students(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invite_code)
);

-- Enable RLS
ALTER TABLE public.exam_prep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_prep_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_prep_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_prep_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_prep_invites ENABLE ROW LEVEL SECURITY;

-- RLS: exam_prep_sessions
CREATE POLICY "Deny anon exam_prep_sessions" ON public.exam_prep_sessions AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Students view own exam_prep_sessions" ON public.exam_prep_sessions AS RESTRICTIVE FOR SELECT USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "Students insert own exam_prep_sessions" ON public.exam_prep_sessions AS RESTRICTIVE FOR INSERT WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "Students update own exam_prep_sessions" ON public.exam_prep_sessions AS RESTRICTIVE FOR UPDATE USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "Students delete own exam_prep_sessions" ON public.exam_prep_sessions AS RESTRICTIVE FOR DELETE USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- RLS: exam_prep_materials
CREATE POLICY "Deny anon exam_prep_materials" ON public.exam_prep_materials AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Students view own exam_prep_materials" ON public.exam_prep_materials AS RESTRICTIVE FOR SELECT USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "Students insert own exam_prep_materials" ON public.exam_prep_materials AS RESTRICTIVE FOR INSERT WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "Students delete own exam_prep_materials" ON public.exam_prep_materials AS RESTRICTIVE FOR DELETE USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- RLS: exam_prep_messages
CREATE POLICY "Deny anon exam_prep_messages" ON public.exam_prep_messages AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Students view own exam_prep_messages" ON public.exam_prep_messages AS RESTRICTIVE FOR SELECT USING (session_id IN (SELECT id FROM exam_prep_sessions WHERE student_id IN (SELECT id FROM students WHERE user_id = auth.uid())));
CREATE POLICY "Students insert own exam_prep_messages" ON public.exam_prep_messages AS RESTRICTIVE FOR INSERT WITH CHECK (session_id IN (SELECT id FROM exam_prep_sessions WHERE student_id IN (SELECT id FROM students WHERE user_id = auth.uid())));

-- RLS: exam_prep_usage
CREATE POLICY "Deny anon exam_prep_usage" ON public.exam_prep_usage AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Students view own exam_prep_usage" ON public.exam_prep_usage AS RESTRICTIVE FOR SELECT USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- RLS: exam_prep_invites
CREATE POLICY "Deny anon exam_prep_invites" ON public.exam_prep_invites AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Students view own exam_prep_invites" ON public.exam_prep_invites AS RESTRICTIVE FOR SELECT USING (inviter_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "Students insert own exam_prep_invites" ON public.exam_prep_invites AS RESTRICTIVE FOR INSERT WITH CHECK (inviter_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "Anyone can view active invites" ON public.exam_prep_invites AS RESTRICTIVE FOR SELECT USING (is_active = true);

-- Storage bucket for exam prep PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('exam-prep-materials', 'exam-prep-materials', false);

-- Storage RLS
CREATE POLICY "Students upload own exam materials" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'exam-prep-materials' AND auth.uid() IS NOT NULL);
CREATE POLICY "Students view own exam materials" ON storage.objects FOR SELECT USING (bucket_id = 'exam-prep-materials' AND auth.uid() IS NOT NULL);
CREATE POLICY "Students delete own exam materials" ON storage.objects FOR DELETE USING (bucket_id = 'exam-prep-materials' AND auth.uid() IS NOT NULL);

-- Updated at trigger
CREATE TRIGGER update_exam_prep_sessions_updated_at BEFORE UPDATE ON public.exam_prep_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exam_prep_usage_updated_at BEFORE UPDATE ON public.exam_prep_usage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
