-- Nuevos precios y límites de los planes, y consentimiento informado del paciente en su primer acceso.

-- Precios en céntimos, sin IVA. yearly_cents = importe del cobro anual (precio mensual rebajado × 12).
-- Cada característica es { "t": texto, "soon": true } si todavía no está disponible en el producto.
update public.plans set monthly_cents = 1900, yearly_cents = 18000, max_therapists = 1, max_active_patients = 50, popular = false,
  features = '[{"t":"1 fisioterapeuta"},{"t":"Hasta 50 pacientes activos a la vez"},{"t":"Biblioteca maestra de infografías y ejercicios"},{"t":"Envío por WhatsApp y seguimiento de dolor EVA y esfuerzo RPE"}]'
  where tier = 'autonomo';
update public.plans set monthly_cents = 3900, yearly_cents = 34800, max_therapists = 10, max_active_patients = null, popular = true,
  features = '[{"t":"Hasta 10 fisioterapeutas"},{"t":"Pacientes activos ilimitados"},{"t":"Vídeos, imágenes y guías PDF propias"},{"t":"Panel de alertas: adherencia y dolor alto"},{"t":"Marca blanca: logo y colores de tu clínica","soon":true}]'
  where tier = 'clinica';
update public.plans set monthly_cents = 7900, yearly_cents = 78000, max_therapists = null, max_active_patients = null, popular = false,
  features = '[{"t":"Fisioterapeutas ilimitados"},{"t":"Todo lo del plan Clínica"},{"t":"Varias sedes","soon":true},{"t":"Analítica por profesional","soon":true},{"t":"Soporte prioritario y exportación de informes","soon":true}]'
  where tier = 'multicentro';

-- La prueba gratuita da las funciones del plan Clínica: ahora hasta 10 fisioterapeutas.
alter table public.clinics alter column max_therapists set default 10;
update public.clinics set max_therapists = 10 where plan_tier = 'trial';

-- Consentimiento informado: se registra cuándo y qué versión del texto aceptó el paciente.
alter table public.patients add column consent_at timestamptz, add column consent_version text;

create function public.accept_consent(p_version text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare ts timestamptz;
begin
  update public.patients set consent_at = now(), consent_version = left(p_version, 20)
    where user_id = (select auth.uid()) and consent_at is null returning consent_at into ts;
  if ts is null then select consent_at into ts from public.patients where user_id = (select auth.uid()); end if;
  return ts;
end $$;

-- Lo que el portal necesita saber del paciente que ha iniciado sesión: su clínica y si ya consintió.
create function public.portal_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('patient_id', p.id, 'clinic_name', c.name, 'consent_at', p.consent_at)
  from public.patients p join public.clinics c on c.id = p.clinic_id where p.user_id = (select auth.uid());
$$;
revoke execute on function public.accept_consent(text), public.portal_context() from public, anon;
grant execute on function public.accept_consent(text), public.portal_context() to authenticated;

-- Sin consentimiento, el paciente no puede registrar dolor, esfuerzo ni mensajes.
create function private.has_consent() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.patients where user_id = (select auth.uid()) and consent_at is not null);
$$;
alter policy logs_insert on public.exercise_logs
  with check (private.manages_patient(patient_id) or (patient_id = private.my_patient_id() and private.owns_program(program_id) and private.has_consent()));
alter policy msg_insert on public.program_messages
  with check (sender_user = (select auth.uid()) and (
    (sender = 'therapist' and private.manages_program(program_id))
    or (sender = 'patient' and private.owns_program(program_id) and private.has_consent())));
