-- Infoproductos: almacenamiento, esquema, seguridad por filas y funciones.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------- tablas
create table public.staff (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users on delete set null,
  code text unique,
  full_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
create unique index patients_email_key on public.patients (lower(email)) where email is not null;

create type public.product_status as enum ('draft', 'published', 'archived');
create type public.lesson_kind as enum ('video', 'pdf', 'embed', 'link');
create type public.access_method as enum ('purchased', 'assigned', 'bono', 'free');

create table public.infoproducts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0),
  status public.product_status not null default 'draft',
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.infoproducts on delete cascade,
  title text not null,
  kind public.lesson_kind not null,
  file_path text,
  external_url text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  check ((kind in ('video', 'pdf') and file_path is not null) or (kind in ('embed', 'link') and external_url is not null))
);
create index lessons_product_idx on public.lessons (product_id, position);
create index lessons_file_path_idx on public.lessons (file_path);

create table public.accesses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients on delete cascade,
  product_id uuid not null references public.infoproducts on delete cascade,
  method public.access_method not null,
  acquired_at timestamptz not null default now(),
  unique (patient_id, product_id)
);
create index accesses_product_idx on public.accesses (product_id);

create table public.lesson_progress (
  patient_id uuid not null references public.patients on delete cascade,
  lesson_id uuid not null references public.lessons on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (patient_id, lesson_id)
);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients on delete cascade,
  product_id uuid not null references public.infoproducts on delete cascade,
  amount_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  stripe_session_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index purchases_patient_idx on public.purchases (patient_id);
create index purchases_product_idx on public.purchases (product_id);

-- ---------------------------------------------------------------- ayudantes (no expuestos por la API)
create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()));
$$;

create function private.my_patient_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.patients where user_id = (select auth.uid());
$$;

create function private.has_access(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.accesses a
    join public.patients p on p.id = a.patient_id
    where a.product_id = p_product and p.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------- seguridad por filas
alter table public.staff enable row level security;
alter table public.patients enable row level security;
alter table public.infoproducts enable row level security;
alter table public.lessons enable row level security;
alter table public.accesses enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.purchases enable row level security;

grant select on public.infoproducts to anon;
grant select, insert, update, delete on public.infoproducts, public.lessons, public.patients, public.accesses, public.lesson_progress to authenticated;
grant select on public.staff, public.purchases to authenticated;

create policy staff_self on public.staff for select to authenticated
  using (user_id = (select auth.uid()));

create policy products_read on public.infoproducts for select to anon, authenticated
  using (status = 'published' or private.is_staff() or private.has_access(id));
create policy products_insert on public.infoproducts for insert to authenticated with check (private.is_staff());
create policy products_update on public.infoproducts for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy products_delete on public.infoproducts for delete to authenticated using (private.is_staff());

-- Las lecciones (rutas de archivo y enlaces privados) solo las ve la clínica y quien tiene acceso.
create policy lessons_read on public.lessons for select to authenticated
  using (private.is_staff() or private.has_access(product_id));
create policy lessons_insert on public.lessons for insert to authenticated with check (private.is_staff());
create policy lessons_update on public.lessons for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy lessons_delete on public.lessons for delete to authenticated using (private.is_staff());

create policy patients_read on public.patients for select to authenticated
  using (private.is_staff() or user_id = (select auth.uid()));
create policy patients_insert on public.patients for insert to authenticated with check (private.is_staff());
create policy patients_update on public.patients for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy patients_delete on public.patients for delete to authenticated using (private.is_staff());

create policy accesses_read on public.accesses for select to authenticated
  using (private.is_staff() or patient_id = private.my_patient_id());
create policy accesses_insert on public.accesses for insert to authenticated with check (private.is_staff());
create policy accesses_delete on public.accesses for delete to authenticated using (private.is_staff());

create policy progress_read on public.lesson_progress for select to authenticated
  using (private.is_staff() or patient_id = private.my_patient_id());
create policy progress_insert on public.lesson_progress for insert to authenticated
  with check (
    patient_id = private.my_patient_id()
    and exists (select 1 from public.lessons l where l.id = lesson_id and private.has_access(l.product_id))
  );
create policy progress_delete on public.lesson_progress for delete to authenticated
  using (patient_id = private.my_patient_id());

create policy purchases_read on public.purchases for select to authenticated
  using (private.is_staff() or patient_id = private.my_patient_id());

-- ---------------------------------------------------------------- funciones de la API
-- La primera cuenta que entra en el panel se convierte en administradora de la clínica.
create function public.claim_clinic() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return false; end if;
  if exists (select 1 from public.staff where user_id = uid) then return true; end if;
  lock table public.staff in exclusive mode;
  if not exists (select 1 from public.staff) then
    insert into public.staff (user_id) values (uid);
    return true;
  end if;
  return false;
end $$;

-- Vincula la cuenta que ha iniciado sesión con su ficha de paciente (por email verificado) o la crea.
create function public.ensure_patient(p_name text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  u_email text;
  u_confirmed boolean;
  pid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into pid from public.patients where user_id = uid;
  if pid is not null then return pid; end if;
  select email, email_confirmed_at is not null into u_email, u_confirmed from auth.users where id = uid;
  if u_confirmed then
    update public.patients set user_id = uid
      where lower(email) = lower(u_email) and user_id is null
      returning id into pid;
    if pid is not null then return pid; end if;
  end if;
  if exists (select 1 from public.patients where lower(email) = lower(u_email)) then
    raise exception 'email pending verification';
  end if;
  insert into public.patients (user_id, full_name, email)
    values (uid, coalesce(nullif(trim(p_name), ''), split_part(u_email, '@', 1)), u_email)
    returning id into pid;
  return pid;
end $$;

-- Escaparate público: productos publicados con el número de lecciones, sin exponer su contenido.
create function public.catalog() returns table (
  id uuid, title text, description text, category text, price_cents integer, cover_path text,
  lesson_count integer, kinds text[]
) language sql stable security definer set search_path = '' as $$
  select p.id, p.title, p.description, p.category, p.price_cents, p.cover_path,
         count(l.id)::integer, coalesce(array_agg(distinct l.kind::text) filter (where l.id is not null), '{}')
  from public.infoproducts p
  left join public.lessons l on l.product_id = p.id
  where p.status = 'published'
  group by p.id
  order by p.created_at desc;
$$;

create function public.claim_free_product(p_product uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare pid uuid := private.my_patient_id();
begin
  if pid is null then raise exception 'no patient profile'; end if;
  if not exists (select 1 from public.infoproducts where id = p_product and status = 'published' and price_cents = 0) then
    raise exception 'product is not free';
  end if;
  insert into public.accesses (patient_id, product_id, method) values (pid, p_product, 'free')
    on conflict (patient_id, product_id) do nothing;
  return true;
end $$;

-- Métricas para el panel: accesos, ventas, ingresos y tasa de visualización por producto.
create function public.product_metrics() returns table (
  product_id uuid, accesses integer, sales integer, revenue_cents bigint, viewers integer
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'forbidden'; end if;
  return query
    select p.id,
      (select count(*)::integer from public.accesses a where a.product_id = p.id),
      (select count(*)::integer from public.purchases s where s.product_id = p.id and s.status = 'paid'),
      (select coalesce(sum(s.amount_cents), 0)::bigint from public.purchases s where s.product_id = p.id and s.status = 'paid'),
      (select count(distinct lp.patient_id)::integer from public.lesson_progress lp
         join public.lessons l on l.id = lp.lesson_id where l.product_id = p.id)
    from public.infoproducts p;
end $$;

revoke execute on function public.claim_clinic(), public.ensure_patient(text), public.claim_free_product(uuid), public.product_metrics() from public, anon;
grant execute on function public.claim_clinic(), public.ensure_patient(text), public.claim_free_product(uuid), public.product_metrics() to authenticated;
revoke execute on function public.catalog() from public;
grant execute on function public.catalog() to anon, authenticated;

-- ---------------------------------------------------------------- almacenamiento
-- covers: portadas, público. content: PDF y vídeo, privado; se sirve con URL firmada temporal.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('content', 'content', false, 52428800, array['application/pdf', 'video/mp4', 'video/quicktime']);

create policy storage_staff_all on storage.objects for all to authenticated
  using (bucket_id in ('covers', 'content') and private.is_staff())
  with check (bucket_id in ('covers', 'content') and private.is_staff());

-- Un paciente solo puede firmar/leer un archivo si pertenece a una lección de un producto al que tiene acceso.
create policy storage_patient_read on storage.objects for select to authenticated
  using (
    bucket_id = 'content'
    and exists (select 1 from public.lessons l where l.file_path = name and private.has_access(l.product_id))
  );
