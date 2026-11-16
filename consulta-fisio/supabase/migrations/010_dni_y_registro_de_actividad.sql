-- DNI/NIE opcional del paciente (validado) y registro de actividad por ficha.

-- Valida el formato y la letra de control de un DNI o NIE español ya normalizado (mayúsculas, sin espacios ni guiones).
create function public.valid_dni_nie(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p ~ '^([0-9]{8}|[XYZ][0-9]{7})[A-Z]$'
    and substr('TRWAGMYFPDXBNJZSQVHLCKE', (translate(left(p, 8), 'XYZ', '012')::bigint % 23)::int + 1, 1) = right(p, 1);
$$;
alter table public.patients add column dni_nie text check (dni_nie is null or public.valid_dni_nie(dni_nie));

-- Registro de actividad: quién hizo qué sobre la ficha de cada paciente. No guarda el contenido, solo el hecho.
create table public.audit_log (
  id bigint generated always as identity primary key,
  clinic_id uuid not null,
  patient_id uuid,
  actor uuid,
  actor_role text not null,
  action text not null,
  entity text not null,
  at timestamptz not null default now()
);
create index audit_log_patient_idx on public.audit_log (patient_id, at desc);
create index audit_log_clinic_idx on public.audit_log (clinic_id, at desc);
alter table public.audit_log enable row level security;
grant select on public.audit_log to authenticated;
create policy audit_read on public.audit_log for select to authenticated using (clinic_id = private.my_clinic());

create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record; pid uuid; cid uuid; uid uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_table_name = 'patients' then pid := r.id; cid := r.clinic_id;
  elsif tg_table_name in ('program_exercises', 'program_messages') then
    select g.patient_id into pid from public.patient_programs g where g.id = r.program_id;
  else pid := r.patient_id;
  end if;
  if cid is null then select clinic_id into cid from public.patients where id = pid; end if;
  if cid is null then return null; end if; -- la ficha ya no existe (borrado en cascada)
  insert into public.audit_log (clinic_id, patient_id, actor, actor_role, action, entity)
  values (cid, pid, uid,
    case when uid is null then 'sistema' when exists (select 1 from public.staff where user_id = uid and clinic_id = cid) then 'fisio' else 'paciente' end,
    lower(tg_op), tg_table_name);
  return null;
end $$;

create trigger audit_patients after insert or update or delete on public.patients for each row execute function private.audit();
create trigger audit_programs after insert or update or delete on public.patient_programs for each row execute function private.audit();
create trigger audit_accesses after insert or delete on public.accesses for each row execute function private.audit();
create trigger audit_logs after insert or delete on public.exercise_logs for each row execute function private.audit();
create trigger audit_messages after insert or delete on public.program_messages for each row execute function private.audit();
