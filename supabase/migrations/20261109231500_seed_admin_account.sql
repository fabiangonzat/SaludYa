-- Initial platform administrator. The account is created through Supabase Auth;
-- this migration only grants the application role.
update public.profiles
set role = 'admin', updated_at = now()
where lower(email) = 'wingarosales@gmail.com';
