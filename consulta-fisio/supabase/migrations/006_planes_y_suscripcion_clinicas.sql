-- Suscripción B2B: cada clínica paga su cuota. Planes, periodo de prueba, límites y bloqueo por impago.

-- Configuración centralizada de planes (precios en céntimos; anual = 10 mensualidades). Límite nulo = ilimitado.
create table public.plans (
  tier text primary key check (tier in ('autonomo', 'clinica', 'multicentro')),
  name text not null,
  monthly_cents integer not null,
  yearly_cents integer not null,
  max_therapists integer,
  max_active_patients integer,
  position integer not null,
  popular boolean not null default false,
  features jsonb not null default '[]'::jsonb
);
insert into public.plans (tier, name, monthly_cents, yearly_cents, max_therapists, max_active_patients, position, popular, features) values
  ('autonomo', 'Autónomo', 2900, 29000, 1, 40, 1, false, '["1 fisioterapeuta", "Hasta 40 pacientes activos", "Biblioteca maestra completa", "Seguimiento online"]'),
  ('clinica', 'Clínica', 6900, 69000, 5, null, 2, true, '["Hasta 5 fisioterapeutas", "Pacientes activos ilimitados", "Personalización de marca", "Vídeos y PDF propios"]'),
  ('multicentro', 'Multicentro', 12900, 129000, null, null, 3, false, '["Fisioterapeutas ilimitados", "Varias sedes", "Analítica por profesional"]');
alter table public.plans enable row level security;
grant select on public.plans to authenticated;
create policy plans_read on public.plans for select to authenticated using (true);

alter table public.clinics
  add column stripe_customer_id text,
  add column stripe_subscription_id text unique,
  add column plan_tier text not null default 'trial' check (plan_tier in ('trial', 'autonomo', 'clinica', 'multicentro')),
  add column subscription_status text not null default 'trialing' check (subscription_status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  add column trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column current_period_end timestamptz,
  add column billing_interval text check (billing_interval in ('month', 'year')),
  add column cancel_at_period_end boolean not null default false,
  add column max_therapists integer default 5,          -- la prueba da las funciones del plan Clínica
  add column max_active_patients integer;

-- La clínica solo puede cambiar su nombre; el estado de la suscripción lo escribe el servidor (webhook de Stripe).
revoke update on public.clinics from authenticated;
grant update (name) on public.clinics to authenticated;

-- Interruptor del modo de simulación. Solo se cambia por SQL; apagado en producción.
create table public.app_config (
  id boolean primary key default true check (id),
  billing_simulation boolean not null default false
);
insert into public.app_config default values;
alter table public.app_config enable row level security;

-- ---------------------------------------------------------------- guardas
create function private.is_clinic_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and clinic_id = private.my_clinic() and role = 'admin');
$$;

-- Con cuota al día, en prueba vigente o con un pago pendiente de reintento, la clínica puede crear y asignar.
-- Cancelada, impagada o con la prueba caducada queda en solo lectura (los datos siguen accesibles).
create function private.clinic_writable() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clinics c where c.id = private.my_clinic() and (
    c.subscription_status in ('active', 'past_due')
    or (c.subscription_status = 'trialing' and (c.stripe_subscription_id is not null or c.trial_ends_at > now()))));
$$;

create function private.therapist_slot() returns boolean
language sql stable security definer set search_path = '' as $$
  select c.max_therapists is null or (
    (select count(*) from public.staff s join auth.users u on u.id = s.user_id where s.clinic_id = c.id and u.email not like '%@test.invalid')
    + (select count(*) from public.clinic_invites i where i.clinic_id = c.id and i.accepted_at is null)) < c.max_therapists
  from public.clinics c where c.id = private.my_clinic();
$$;

-- Paciente activo = con al menos un plan en estado activo.
create function private.patient_slot(p_patient uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select c.max_active_patients is null
    or exists (select 1 from public.patient_programs g where g.patient_id = p_patient and g.status = 'active')
    or (select count(distinct g.patient_id) from public.patient_programs g join public.patients t on t.id = g.patient_id
        where t.clinic_id = c.id and g.status = 'active') < c.max_active_patients
  from public.clinics c where c.id = private.my_clinic();
$$;

alter policy products_insert on public.infoproducts with check (clinic_id = private.my_clinic() and not is_master and private.clinic_writable());
alter policy patients_insert on public.patients with check (clinic_id = private.my_clinic() and private.clinic_writable());
alter policy pp_insert on public.patient_programs with check (
  private.manages_patient(patient_id) and (product_id is null or private.reads_product(product_id))
  and private.clinic_writable() and (status <> 'active' or private.patient_slot(patient_id)));
alter policy pp_update on public.patient_programs using (private.manages_patient(patient_id))
  with check (private.manages_patient(patient_id) and (status <> 'active' or private.patient_slot(patient_id)));
alter policy invites_insert on public.clinic_invites with check (
  clinic_id = private.my_clinic() and private.is_clinic_admin() and private.clinic_writable() and private.therapist_slot());
alter policy invites_delete on public.clinic_invites using (clinic_id = private.my_clinic() and private.is_clinic_admin());

-- ---------------------------------------------------------------- API
-- Estado de facturación y uso de mi clínica, para el banner, la pantalla de planes y los avisos de límite.
create function public.billing_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cid uuid := private.my_clinic(); c public.clinics;
begin
  if cid is null then raise exception 'forbidden'; end if;
  select * into c from public.clinics where id = cid;
  return jsonb_build_object(
    'clinic_id', c.id, 'name', c.name, 'plan_tier', c.plan_tier, 'status', c.subscription_status,
    'trial_ends_at', c.trial_ends_at, 'current_period_end', c.current_period_end, 'billing_interval', c.billing_interval,
    'cancel_at_period_end', c.cancel_at_period_end, 'has_subscription', c.stripe_subscription_id is not null,
    'max_therapists', c.max_therapists, 'max_active_patients', c.max_active_patients,
    'therapists', (select count(*) from public.staff s join auth.users u on u.id = s.user_id where s.clinic_id = cid and u.email not like '%@test.invalid'),
    'pending_invites', (select count(*) from public.clinic_invites i where i.clinic_id = cid and i.accepted_at is null),
    'active_patients', (select count(distinct g.patient_id) from public.patient_programs g join public.patients t on t.id = g.patient_id where t.clinic_id = cid and g.status = 'active'),
    'writable', private.clinic_writable(), 'is_admin', private.is_clinic_admin(),
    'simulation', (select billing_simulation from public.app_config),
    'plans', (select jsonb_agg(to_jsonb(p) order by p.position) from public.plans p));
end $$;
revoke execute on function public.billing_state() from public, anon;
grant execute on function public.billing_state() to authenticated;

-- Simulación para pruebas sin Stripe. Solo funciona si app_config.billing_simulation está activado por SQL.
create function public.simulate_billing(p_state text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare cid uuid := private.my_clinic(); pl public.plans;
begin
  if cid is null or not private.is_clinic_admin() then raise exception 'forbidden'; end if;
  if not (select billing_simulation from public.app_config) then raise exception 'simulation disabled'; end if;
  if p_state = 'trial' then
    update public.clinics set plan_tier = 'trial', subscription_status = 'trialing', trial_ends_at = now() + interval '14 days',
      current_period_end = null, billing_interval = null, max_therapists = 5, max_active_patients = null where id = cid;
  elsif p_state = 'expired' then
    update public.clinics set plan_tier = 'trial', subscription_status = 'trialing', trial_ends_at = now() - interval '1 day',
      current_period_end = null where id = cid;
  elsif p_state = 'canceled' then
    update public.clinics set subscription_status = 'canceled' where id = cid;
  elsif p_state in ('autonomo', 'clinica', 'multicentro') then
    select * into pl from public.plans where tier = p_state;
    update public.clinics set plan_tier = pl.tier, subscription_status = 'active', current_period_end = now() + interval '30 days',
      billing_interval = 'month', max_therapists = pl.max_therapists, max_active_patients = pl.max_active_patients where id = cid;
  else raise exception 'unknown state';
  end if;
  return true;
end $$;
revoke execute on function public.simulate_billing(text) from public, anon;
grant execute on function public.simulate_billing(text) to authenticated;
