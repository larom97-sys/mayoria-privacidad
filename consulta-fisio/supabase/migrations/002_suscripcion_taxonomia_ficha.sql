-- Modelo híbrido (suscripción + compra individual + asignación), taxonomía clínica y ficha de patología.

-- ---------------------------------------------------------------- taxonomía
alter table public.infoproducts
  add column body_region text check (body_region is null or body_region in (
    'Columna cervical', 'Columna dorsal/lumbar', 'Hombro', 'Codo/muñeca', 'Cadera/pelvis', 'Rodilla', 'Tobillo/pie', 'Suelo pélvico')),
  add column pathology_type text check (pathology_type is null or pathology_type in (
    'Tendinopatías', 'Lesiones musculares', 'Lesiones ligamentosas/articulares', 'Dolor neuropático/radicular',
    'Readaptación postquirúrgica', 'Prevención y ergonomía'));
create index infoproducts_taxonomy_idx on public.infoproducts (body_region, pathology_type);

-- ---------------------------------------------------------------- ficha clínica (contenido protegido)
-- sheet: { what_is, duration, phases[], red_flags[], advice[], sources[], exercises[] }
create table public.product_content (
  product_id uuid primary key references public.infoproducts on delete cascade,
  sheet jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.exercise_progress (
  patient_id uuid not null references public.patients on delete cascade,
  product_id uuid not null references public.infoproducts on delete cascade,
  exercise_key text not null,
  completed_at timestamptz not null default now(),
  primary key (patient_id, product_id, exercise_key)
);
create index exercise_progress_product_idx on public.exercise_progress (product_id);

-- ---------------------------------------------------------------- suscripción
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients on delete cascade,
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  id boolean primary key default true check (id),
  subscription_name text not null default 'Acceso total',
  subscription_price_cents integer not null default 1499 check (subscription_price_cents > 0)
);
insert into public.settings default values;

alter table public.purchases alter column product_id drop not null;
alter table public.purchases add column kind text not null default 'product' check (kind in ('product', 'subscription'));

-- ---------------------------------------------------------------- control de acceso
create function private.has_active_subscription() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    join public.patients p on p.id = s.patient_id
    where p.user_id = (select auth.uid())
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- Acceso = compra individual o asignación del fisio (fila en accesses) O suscripción activa sobre un producto publicado.
create or replace function private.has_access(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.accesses a
    join public.patients p on p.id = a.patient_id
    where a.product_id = p_product and p.user_id = (select auth.uid())
  ) or (
    private.has_active_subscription()
    and exists (select 1 from public.infoproducts i where i.id = p_product and i.status = 'published')
  );
$$;

alter table public.product_content enable row level security;
alter table public.exercise_progress enable row level security;
alter table public.subscriptions enable row level security;
alter table public.settings enable row level security;

grant select, insert, update, delete on public.product_content, public.exercise_progress to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.settings to anon, authenticated;
grant update on public.settings to authenticated;

create policy content_read on public.product_content for select to authenticated
  using (private.is_staff() or private.has_access(product_id));
create policy content_insert on public.product_content for insert to authenticated with check (private.is_staff());
create policy content_update on public.product_content for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy content_delete on public.product_content for delete to authenticated using (private.is_staff());

create policy exprogress_read on public.exercise_progress for select to authenticated
  using (private.is_staff() or patient_id = private.my_patient_id());
create policy exprogress_insert on public.exercise_progress for insert to authenticated
  with check (patient_id = private.my_patient_id() and private.has_access(product_id));
create policy exprogress_delete on public.exercise_progress for delete to authenticated
  using (patient_id = private.my_patient_id());

create policy subscriptions_read on public.subscriptions for select to authenticated
  using (private.is_staff() or patient_id = private.my_patient_id());

create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_update on public.settings for update to authenticated using (private.is_staff()) with check (private.is_staff());

-- ---------------------------------------------------------------- funciones de la API
-- Escaparate con taxonomía. No expone la ficha ni los archivos, solo cuántos ejercicios y recursos hay.
create function public.store_catalog() returns table (
  id uuid, title text, description text, body_region text, pathology_type text, price_cents integer,
  cover_path text, exercise_count integer, lesson_count integer
) language sql stable security definer set search_path = '' as $$
  select p.id, p.title, p.description, p.body_region, p.pathology_type, p.price_cents, p.cover_path,
         coalesce(jsonb_array_length(c.sheet -> 'exercises'), 0),
         (select count(*)::integer from public.lessons l where l.product_id = p.id)
  from public.infoproducts p
  left join public.product_content c on c.product_id = p.id
  where p.status = 'published'
  order by p.body_region nulls last, p.title;
$$;
revoke execute on function public.store_catalog() from public;
grant execute on function public.store_catalog() to anon, authenticated;

create or replace function public.product_metrics() returns table (
  product_id uuid, accesses integer, sales integer, revenue_cents bigint, viewers integer
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'forbidden'; end if;
  return query
    select p.id,
      (select count(*)::integer from public.accesses a where a.product_id = p.id),
      (select count(*)::integer from public.purchases s where s.product_id = p.id and s.status = 'paid'),
      (select coalesce(sum(s.amount_cents), 0)::bigint from public.purchases s where s.product_id = p.id and s.status = 'paid'),
      (select count(*)::integer from (
         select lp.patient_id from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id where l.product_id = p.id
         union
         select ep.patient_id from public.exercise_progress ep where ep.product_id = p.id) v)
    from public.infoproducts p;
end $$;

create function public.business_metrics() returns table (
  active_subscriptions integer, monthly_recurring_cents bigint, subscription_revenue_cents bigint
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'forbidden'; end if;
  return query
    select n.c, n.c::bigint * (select subscription_price_cents from public.settings),
           (select coalesce(sum(amount_cents), 0)::bigint from public.purchases where kind = 'subscription' and status = 'paid')
    from (select count(*)::integer c from public.subscriptions
          where status in ('active', 'trialing') and (current_period_end is null or current_period_end > now())) n;
end $$;
revoke execute on function public.business_metrics() from public, anon;
grant execute on function public.business_metrics() to authenticated;
