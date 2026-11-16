-- Las cuentas de prueba (@test.invalid) quedan bloqueadas y con contraseña aleatoria, y dejan de contar como personal de la clínica.
update auth.users
  set banned_until = 'infinity', encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf'))
  where email like '%@test.invalid';

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s join auth.users u on u.id = s.user_id
    where s.user_id = (select auth.uid()) and u.email not like '%@test.invalid');
$$;

-- La primera cuenta real que entra en el panel se convierte en administradora.
create or replace function public.claim_clinic() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return false; end if;
  if private.is_staff() then return true; end if;
  lock table public.staff in exclusive mode;
  if not exists (select 1 from public.staff s join auth.users u on u.id = s.user_id where u.email not like '%@test.invalid') then
    insert into public.staff (user_id) values (uid) on conflict do nothing;
    return private.is_staff();
  end if;
  return false;
end $$;
