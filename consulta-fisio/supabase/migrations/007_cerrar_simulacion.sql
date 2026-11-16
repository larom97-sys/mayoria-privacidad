-- Los precios de los planes solo los ve el personal de las clínicas, no los pacientes.
alter policy plans_read on public.plans using (private.is_staff());
-- Simulación de facturación apagada en producción. Para probar en local: update public.app_config set billing_simulation = true;
update public.app_config set billing_simulation = false;
-- Cuentas usadas en las pruebas automáticas: bloqueadas y con contraseña aleatoria.
update auth.users
  set banned_until = 'infinity', encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf'))
  where email like '%@e2e.invalid';
create or replace function private.my_clinic() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.clinic_id from public.staff s join auth.users u on u.id = s.user_id
  where s.user_id = (select auth.uid()) and u.email not like '%@test.invalid' and u.email not like '%@e2e.invalid';
$$;
