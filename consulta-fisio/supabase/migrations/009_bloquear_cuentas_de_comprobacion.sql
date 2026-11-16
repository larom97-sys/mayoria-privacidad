-- Todas las cuentas de pruebas automáticas usan dominios .invalid: bloqueadas y sin permisos de personal.
update auth.users
  set banned_until = 'infinity', encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf'))
  where email like '%.invalid';
create or replace function private.my_clinic() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.clinic_id from public.staff s join auth.users u on u.id = s.user_id
  where s.user_id = (select auth.uid()) and u.email not like '%.invalid';
$$;
