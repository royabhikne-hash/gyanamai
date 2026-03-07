
CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_inr numeric(10,4) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_log_student_id ON public.ai_usage_log(student_id);
CREATE INDEX idx_ai_usage_log_created_at ON public.ai_usage_log(created_at);
CREATE INDEX idx_ai_usage_log_action ON public.ai_usage_log(action);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to ai_usage_log"
ON public.ai_usage_log FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
