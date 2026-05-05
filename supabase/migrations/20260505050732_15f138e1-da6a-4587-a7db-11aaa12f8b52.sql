UPDATE public.admins
SET admin_id = 'superadmin5670@gmail.com',
    password_hash = '$2b$12$KJbIy1oNLBXWUDFyM2A32.x9Fpq0TcBQ3sUUNQPt/etI5GRNlohhG',
    password_reset_required = false,
    password_updated_at = now()
WHERE admin_id = 'suparadmin5670';