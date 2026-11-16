-- Modelo B2B: varias clínicas aisladas entre sí, biblioteca interna y acceso del paciente solo por asignación.
-- Se retiran la tienda pública y los pagos de pacientes (las tablas de compras y suscripciones quedan sin uso).
-- Equivalencias de nombres: therapists = staff, library_templates = infoproducts (+ product_content),
-- assigned_programs = patient_programs (+ program_exercises).

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi clínica' check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create table public.clinic_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index clinic_invites_email_key on public.clinic_invites (lower(email)) where accepted_at is null;
create index clinic_invites_clinic_idx on public.clinic_invites (clinic_id);

alter table public.staff add column clinic_id uuid references public.clinics on delete cascade,
  add column role text not null default 'admin' check (role in ('admin', 'therapist'));
alter table public.patients add column clinic_id uuid references public.clinics on delete cascade;
alter table public.infoproducts add column clinic_id uuid references public.clinics on delete cascade,
  add column is_master boolean not null default false;

-- Datos existentes: una clínica inicial para el personal y los pacientes; los programas cargados pasan a ser plantillas maestras.
do $$
declare cid uuid;
begin
  insert into public.clinics (name) values ('Mi clínica') returning id into cid;
  update public.staff set clinic_id = cid;
  update public.patients set clinic_id = cid;
  update public.infoproducts set is_master = true, clinic_id = null;
end $$;
alter table public.staff alter column clinic_id set not null;
alter table public.patients alter column clinic_id set not null;
create index staff_clinic_idx on public.staff (clinic_id);
create index patients_clinic_idx on public.patients (clinic_id);
create index infoproducts_clinic_idx on public.infoproducts (clinic_id);

-- ---------------------------------------------------------------- ayudantes
create function private.my_clinic() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.clinic_id from public.staff s join auth.users u on u.id = s.user_id
  where s.user_id = (select auth.uid()) and u.email not like '%@test.invalid';
$$;
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$ select private.my_clinic() is not null; $$;

create function private.manages_patient(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.patients where id = p and clinic_id = private.my_clinic());
$$;
create function private.manages_product(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.infoproducts where id = p and clinic_id = private.my_clinic());
$$;
-- Lectura: plantillas de mi clínica y plantillas maestras (estas últimas no se pueden modificar, solo clonar).
create function private.reads_product(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.infoproducts where id = p
    and (clinic_id = private.my_clinic() or (is_master and private.my_clinic() is not null)));
$$;
create function private.manages_program(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.patient_programs pp join public.patients p on p.id = pp.patient_id
    where pp.id = g and p.clinic_id = private.my_clinic());
$$;
create function private.manages_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin return private.manages_product(split_part(p_name, '/', 1)::uuid); exception when others then return false; end $$;
create function private.reads_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin return private.reads_product(split_part(p_name, '/', 1)::uuid); exception when others then return false; end $$;

-- El paciente solo accede a lo que su fisio le ha asignado: ya no hay compra ni suscripción.
create or replace function private.has_access(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.accesses a join public.patients p on p.id = a.patient_id
    where a.product_id = p_product and p.user_id = (select auth.uid()));
$$;
create or replace function private.program_usable(p_program uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select private.owns_program(p_program); $$;

alter table public.infoproducts alter column clinic_id set default private.my_clinic();
alter table public.patients alter column clinic_id set default private.my_clinic();

-- ---------------------------------------------------------------- políticas
alter table public.clinics enable row level security;
alter table public.clinic_invites enable row level security;
grant select, update on public.clinics to authenticated;
grant select, insert, delete on public.clinic_invites to authenticated;
create policy clinics_read on public.clinics for select to authenticated using (id = private.my_clinic());
create policy clinics_update on public.clinics for update to authenticated using (id = private.my_clinic()) with check (id = private.my_clinic());
create policy invites_read on public.clinic_invites for select to authenticated using (clinic_id = private.my_clinic());
create policy invites_insert on public.clinic_invites for insert to authenticated with check (clinic_id = private.my_clinic());
create policy invites_delete on public.clinic_invites for delete to authenticated using (clinic_id = private.my_clinic());

alter policy staff_self on public.staff using (user_id = (select auth.uid()) or clinic_id = private.my_clinic());

-- Sin escaparate público: nadie sin sesión lee nada.
revoke select on public.infoproducts, public.settings from anon;
alter policy products_read on public.infoproducts to authenticated
  using (clinic_id = private.my_clinic() or (is_master and private.is_staff()) or private.has_access(id));
alter policy products_insert on public.infoproducts with check (clinic_id = private.my_clinic() and not is_master);
alter policy products_update on public.infoproducts using (clinic_id = private.my_clinic()) with check (clinic_id = private.my_clinic() and not is_master);
alter policy products_delete on public.infoproducts using (clinic_id = private.my_clinic());

alter policy lessons_read on public.lessons using (private.reads_product(product_id) or private.has_access(product_id));
alter policy lessons_insert on public.lessons with check (private.manages_product(product_id));
alter policy lessons_update on public.lessons using (private.manages_product(product_id)) with check (private.manages_product(product_id));
alter policy lessons_delete on public.lessons using (private.manages_product(product_id));

alter policy content_read on public.product_content using (private.reads_product(product_id) or private.has_access(product_id));
alter policy content_insert on public.product_content with check (private.manages_product(product_id));
alter policy content_update on public.product_content using (private.manages_product(product_id)) with check (private.manages_product(product_id));
alter policy content_delete on public.product_content using (private.manages_product(product_id));

alter policy patients_read on public.patients using (clinic_id = private.my_clinic() or user_id = (select auth.uid()));
alter policy patients_insert on public.patients with check (clinic_id = private.my_clinic());
alter policy patients_update on public.patients using (clinic_id = private.my_clinic()) with check (clinic_id = private.my_clinic());
alter policy patients_delete on public.patients using (clinic_id = private.my_clinic());

alter policy accesses_read on public.accesses using (private.manages_patient(patient_id) or patient_id = private.my_patient_id());
alter policy accesses_insert on public.accesses with check (private.manages_patient(patient_id) and private.reads_product(product_id));
alter policy accesses_delete on public.accesses using (private.manages_patient(patient_id));

alter policy progress_read on public.lesson_progress using (private.manages_patient(patient_id) or patient_id = private.my_patient_id());
alter policy exprogress_read on public.exercise_progress using (private.manages_patient(patient_id) or patient_id = private.my_patient_id());
alter policy purchases_read on public.purchases using (private.manages_patient(patient_id) or patient_id = private.my_patient_id());
alter policy subscriptions_read on public.subscriptions using (private.manages_patient(patient_id) or patient_id = private.my_patient_id());
alter policy settings_read on public.settings to authenticated using (private.is_staff());

alter policy pp_read on public.patient_programs using (private.manages_patient(patient_id) or patient_id = private.my_patient_id());
alter policy pp_insert on public.patient_programs with check (private.manages_patient(patient_id) and (product_id is null or private.reads_product(product_id)));
alter policy pp_update on public.patient_programs using (private.manages_patient(patient_id)) with check (private.manages_patient(patient_id));
alter policy pp_delete on public.patient_programs using (private.manages_patient(patient_id));

alter policy pe_read on public.program_exercises using (private.manages_program(program_id) or private.owns_program(program_id));
alter policy pe_insert on public.program_exercises with check (private.manages_program(program_id));
alter policy pe_update on public.program_exercises using (private.manages_program(program_id)) with check (private.manages_program(program_id));
alter policy pe_delete on public.program_exercises using (private.manages_program(program_id));

alter policy logs_read on public.exercise_logs using (private.manages_patient(patient_id) or patient_id = private.my_patient_id());
alter policy logs_insert on public.exercise_logs
  with check (private.manages_patient(patient_id) or (patient_id = private.my_patient_id() and private.owns_program(program_id)));
alter policy logs_delete on public.exercise_logs using (private.manages_patient(patient_id) or patient_id = private.my_patient_id());

alter policy msg_read on public.program_messages using (private.manages_program(program_id) or private.owns_program(program_id));
alter policy msg_insert on public.program_messages
  with check (sender_user = (select auth.uid()) and (
    (sender = 'therapist' and private.manages_program(program_id)) or (sender = 'patient' and private.owns_program(program_id))));
alter policy msg_delete on public.program_messages using (private.manages_program(program_id));

-- Almacenamiento: cada clínica gestiona solo sus archivos; las plantillas maestras se pueden leer para clonarlas.
alter policy storage_staff_all on storage.objects
  using (bucket_id in ('covers', 'content') and private.manages_path(name))
  with check (bucket_id in ('covers', 'content') and private.manages_path(name));
create policy storage_staff_read_master on storage.objects for select to authenticated
  using (bucket_id in ('covers', 'content') and private.reads_path(name));

-- ---------------------------------------------------------------- funciones de la API
-- Entrar al panel: quien ya es personal entra; quien tiene una invitación con su email verificado se une a esa clínica.
create or replace function public.claim_clinic() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); em text; conf boolean; cid uuid;
begin
  if uid is null then return false; end if;
  if private.my_clinic() is not null then return true; end if;
  select email, email_confirmed_at is not null into em, conf from auth.users where id = uid;
  if em like '%@test.invalid' or not conf then return false; end if;
  select clinic_id into cid from public.clinic_invites where lower(email) = lower(em) and accepted_at is null;
  if cid is null then return false; end if;
  insert into public.staff (user_id, clinic_id, role) values (uid, cid, 'therapist')
    on conflict (user_id) do update set clinic_id = excluded.clinic_id, role = 'therapist';
  update public.clinic_invites set accepted_at = now() where lower(email) = lower(em) and accepted_at is null;
  return true;
end $$;

-- Alta de una clínica nueva: explícita, nunca automática al iniciar sesión.
create function public.create_clinic(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); em text; conf boolean; cid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if private.my_clinic() is not null then raise exception 'already in a clinic'; end if;
  select email, email_confirmed_at is not null into em, conf from auth.users where id = uid;
  if em like '%@test.invalid' or not conf then raise exception 'email not verified'; end if;
  insert into public.clinics (name) values (coalesce(nullif(trim(p_name), ''), 'Mi clínica')) returning id into cid;
  insert into public.staff (user_id, clinic_id, role) values (uid, cid, 'admin')
    on conflict (user_id) do update set clinic_id = excluded.clinic_id, role = 'admin';
  return cid;
end $$;
revoke execute on function public.create_clinic(text) from public, anon;
grant execute on function public.create_clinic(text) to authenticated;

-- El paciente ya no se da de alta solo: se vincula a la ficha que su clínica creó con su email verificado.
create or replace function public.ensure_patient(p_name text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); u_email text; u_confirmed boolean; pid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into pid from public.patients where user_id = uid;
  if pid is not null then return pid; end if;
  select email, email_confirmed_at is not null into u_email, u_confirmed from auth.users where id = uid;
  if u_confirmed then
    update public.patients set user_id = uid where lower(email) = lower(u_email) and user_id is null returning id into pid;
  end if;
  return pid;
end $$;

-- Métricas por plantilla dentro de mi clínica (asignaciones y pacientes que han empezado).
create or replace function public.product_metrics() returns table (
  product_id uuid, accesses integer, sales integer, revenue_cents bigint, viewers integer
) language plpgsql stable security definer set search_path = '' as $$
declare cid uuid := private.my_clinic();
begin
  if cid is null then raise exception 'forbidden'; end if;
  return query
    select p.id,
      (select count(*)::integer from public.patient_programs g join public.patients t on t.id = g.patient_id where g.product_id = p.id and t.clinic_id = cid),
      0, 0::bigint,
      (select count(distinct l.patient_id)::integer from public.exercise_logs l join public.patient_programs g on g.id = l.program_id
         join public.patients t on t.id = g.patient_id where g.product_id = p.id and t.clinic_id = cid)
    from public.infoproducts p where p.clinic_id = cid or p.is_master;
end $$;

-- Tienda y pagos de pacientes: fuera de servicio.
revoke execute on function public.catalog(), public.store_catalog() from anon, authenticated, public;
revoke execute on function public.claim_free_product(uuid), public.business_metrics() from authenticated, public;
