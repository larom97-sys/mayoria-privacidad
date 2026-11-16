-- Prescripción de ejercicio y seguimiento clínico: programas por paciente, ejercicios personalizados,
-- registros de sesión (dolor EVA, esfuerzo RPE) y mensajería contextual.
-- La aplicación es de una sola clínica: el "clinic_id" es el propio proyecto y therapist_id apunta a staff.

create table public.patient_programs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients on delete cascade,
  product_id uuid references public.infoproducts on delete set null,
  therapist_id uuid references public.staff (user_id) on delete set null,
  title text not null,
  start_date date not null default current_date,
  weekdays smallint[] not null default '{1,3,5}' check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[] and cardinality(weekdays) > 0),
  clinical_notes text not null default '',
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  access_type text not null default 'free_consult' check (access_type in ('free_consult', 'one_time', 'subscription')),
  created_at timestamptz not null default now()
);
create index patient_programs_patient_idx on public.patient_programs (patient_id);
create index patient_programs_product_idx on public.patient_programs (product_id);
create index patient_programs_therapist_idx on public.patient_programs (therapist_id);

-- Copia personalizable de los ejercicios de la plantilla: cambiarla no altera la plantilla maestra.
create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.patient_programs on delete cascade,
  position integer not null default 0,
  name text not null,
  goal text not null default '',
  sets text not null default '',
  reps text not null default '',
  load text not null default '',
  rest text not null default '',
  pain text not null default '',
  instructions text not null default '',
  errors jsonb not null default '[]'::jsonb,
  pose jsonb not null default '[]'::jsonb,
  video text not null default ''
);
create index program_exercises_program_idx on public.program_exercises (program_id, position);

-- program_exercise_id nulo = check-in de la sesión completa; con valor = ejercicio marcado como hecho.
create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.patient_programs on delete cascade,
  program_exercise_id uuid references public.program_exercises on delete cascade,
  patient_id uuid not null references public.patients on delete cascade,
  log_date date not null default current_date,
  completed boolean not null default true,
  pain_eva smallint check (pain_eva between 0 and 10),
  effort_rpe smallint check (effort_rpe between 1 and 10),
  patient_notes text not null default '' check (char_length(patient_notes) <= 1000),
  created_at timestamptz not null default now()
);
create index exercise_logs_program_idx on public.exercise_logs (program_id, log_date);
create index exercise_logs_patient_idx on public.exercise_logs (patient_id);
create index exercise_logs_exercise_idx on public.exercise_logs (program_exercise_id);

create table public.program_messages (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.patient_programs on delete cascade,
  sender text not null check (sender in ('therapist', 'patient')),
  sender_user uuid references auth.users on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index program_messages_program_idx on public.program_messages (program_id, created_at);
create index program_messages_sender_idx on public.program_messages (sender_user);

-- ---------------------------------------------------------------- control de acceso
create function private.owns_program(p_program uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patient_programs pp join public.patients p on p.id = pp.patient_id
    where pp.id = p_program and p.user_id = (select auth.uid()));
$$;

-- El paciente puede ejecutar el plan si es gratuito de consulta o si tiene acceso al infoproducto
-- (compra individual, asignación o suscripción activa).
create function private.program_usable(p_program uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patient_programs pp join public.patients p on p.id = pp.patient_id
    where pp.id = p_program and p.user_id = (select auth.uid())
      and (pp.access_type = 'free_consult' or (pp.product_id is not null and private.has_access(pp.product_id))));
$$;

alter table public.patient_programs enable row level security;
alter table public.program_exercises enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.program_messages enable row level security;
grant select, insert, update, delete on public.patient_programs, public.program_exercises, public.exercise_logs, public.program_messages to authenticated;

create policy pp_read on public.patient_programs for select to authenticated using (private.is_staff() or patient_id = private.my_patient_id());
create policy pp_insert on public.patient_programs for insert to authenticated with check (private.is_staff());
create policy pp_update on public.patient_programs for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy pp_delete on public.patient_programs for delete to authenticated using (private.is_staff());

create policy pe_read on public.program_exercises for select to authenticated using (private.is_staff() or private.program_usable(program_id));
create policy pe_insert on public.program_exercises for insert to authenticated with check (private.is_staff());
create policy pe_update on public.program_exercises for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy pe_delete on public.program_exercises for delete to authenticated using (private.is_staff());

create policy logs_read on public.exercise_logs for select to authenticated using (private.is_staff() or patient_id = private.my_patient_id());
create policy logs_insert on public.exercise_logs for insert to authenticated
  with check (private.is_staff() or (patient_id = private.my_patient_id() and private.program_usable(program_id)));
create policy logs_delete on public.exercise_logs for delete to authenticated using (private.is_staff() or patient_id = private.my_patient_id());

create policy msg_read on public.program_messages for select to authenticated using (private.is_staff() or private.owns_program(program_id));
create policy msg_insert on public.program_messages for insert to authenticated
  with check (sender_user = (select auth.uid()) and (
    (sender = 'therapist' and private.is_staff()) or (sender = 'patient' and private.owns_program(program_id))));
create policy msg_delete on public.program_messages for delete to authenticated using (private.is_staff());
