
REVOKE EXECUTE ON FUNCTION public.validate_session_token(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_basic_subscription() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_student_sensitive_update() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_ai_rate_limit(uuid, text, integer, integer) FROM anon, authenticated, PUBLIC;
