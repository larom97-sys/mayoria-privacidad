-- Datos simulados para comprobar paneles, alertas y gráficas: 3 pacientes marcados como «(demo)».
-- Requiere el catálogo inicial cargado. Las fechas son relativas al día en que se ejecuta.
-- Para retirarlos: delete from public.patients where code like 'DEMO-%';
do $$
declare
  today date := current_date;
  pid uuid; gid uuid; prod uuid; start date;
begin
  if exists (select 1 from public.patients where code like 'DEMO-%') then
    raise notice 'Los pacientes demo ya existen'; return;
  end if;

  -- 1) Alta adherencia y dolor en descenso (6 → 2) durante cuatro semanas.
  start := today - 27;
  select id into prod from public.infoproducts where title = 'Tendinopatía rotuliana' limit 1;
  insert into public.patients (full_name, code) values ('Marta R. (demo)', 'DEMO-1') returning id into pid;
  insert into public.patient_programs (patient_id, product_id, title, start_date, weekdays, clinical_notes, access_type)
    values (pid, prod, 'Tendinopatía rotuliana', start, '{1,3,5}', 'Haz los isométricos antes de entrenar. Sube carga solo si al día siguiente el dolor no ha aumentado.', 'free_consult') returning id into gid;
  insert into public.accesses (patient_id, product_id, method) values (pid, prod, 'assigned');
  insert into public.program_exercises (program_id, position, name, goal, sets, reps, rest, pain, errors, pose)
    select gid, ord - 1, e->>'name', coalesce(e->>'goal', ''), coalesce(e->>'sets', ''), coalesce(e->>'reps', ''), coalesce(e->>'rest', ''), coalesce(e->>'pain', ''), coalesce(e->'errors', '[]'), coalesce(e->'pose', '[]')
    from public.product_content c, jsonb_array_elements(c.sheet->'exercises') with ordinality t(e, ord) where c.product_id = prod;
  insert into public.exercise_logs (program_id, patient_id, log_date, pain_eva, effort_rpe, patient_notes, created_at)
    select gid, pid, d::date, round(6 - 4.0 * (d::date - start) / 27)::int, 6,
           case when d::date = today then 'Cada vez noto menos molestia al bajar escaleras.' else '' end, d + interval '18 hours'
    from generate_series(start, today, interval '1 day') d where extract(isodow from d) in (1, 3, 5);
  insert into public.exercise_logs (program_id, program_exercise_id, patient_id, log_date, created_at)
    select gid, x.id, pid, d::date, d + interval '18 hours'
    from generate_series(start, today, interval '1 day') d, public.program_exercises x
    where x.program_id = gid and extract(isodow from d) in (1, 3, 5);
  insert into public.program_messages (program_id, sender, body, created_at) values
    (gid, 'therapist', 'Buen progreso, Marta. La semana que viene subimos carga en la sentadilla.', now() - interval '2 days');

  -- 2) Alerta clínica: dolor EVA 7/10 ayer y adherencia irregular.
  start := today - 20;
  select id into prod from public.infoproducts where title = 'Dolor subacromial de hombro' limit 1;
  insert into public.patients (full_name, code) values ('Javier L. (demo)', 'DEMO-2') returning id into pid;
  insert into public.patient_programs (patient_id, product_id, title, start_date, weekdays, clinical_notes, access_type)
    values (pid, prod, 'Dolor subacromial de hombro', start, '{2,4,6}', 'Trabaja por debajo de la altura del hombro estas dos semanas.', 'free_consult') returning id into gid;
  insert into public.accesses (patient_id, product_id, method) values (pid, prod, 'assigned');
  insert into public.program_exercises (program_id, position, name, goal, sets, reps, rest, pain, errors, pose)
    select gid, ord - 1, e->>'name', coalesce(e->>'goal', ''), coalesce(e->>'sets', ''), coalesce(e->>'reps', ''), coalesce(e->>'rest', ''), coalesce(e->>'pain', ''), coalesce(e->'errors', '[]'), coalesce(e->'pose', '[]')
    from public.product_content c, jsonb_array_elements(c.sheet->'exercises') with ordinality t(e, ord) where c.product_id = prod;
  insert into public.exercise_logs (program_id, patient_id, log_date, pain_eva, effort_rpe, created_at)
    select gid, pid, d::date, 4 + ((d::date - start) % 2), 6, d + interval '19 hours'
    from generate_series(start, today - 3, interval '1 day') d
    where extract(isodow from d) in (2, 4, 6) and (d::date - start) % 3 <> 0;
  insert into public.exercise_logs (program_id, patient_id, log_date, pain_eva, effort_rpe, patient_notes, created_at)
    values (gid, pid, today - 1, 7, 8, 'Me dolió bastante al levantar el brazo; por la noche seguía molestando.', now() - interval '20 hours');
  insert into public.program_messages (program_id, sender, body, created_at) values
    (gid, 'patient', 'Desde ayer me duele más al levantar el brazo. ¿Sigo con los ejercicios igual?', now() - interval '18 hours');

  -- 3) Inactivo: sin actividad desde hace nueve días.
  start := today - 30;
  select id into prod from public.infoproducts where title = 'Lumbalgia inespecífica' limit 1;
  insert into public.patients (full_name, code) values ('Lucía P. (demo)', 'DEMO-3') returning id into pid;
  insert into public.patient_programs (patient_id, product_id, title, start_date, weekdays, clinical_notes, access_type)
    values (pid, prod, 'Lumbalgia inespecífica', start, '{1,3,5}', 'Camina a diario aunque no hagas la sesión completa.', 'free_consult') returning id into gid;
  insert into public.accesses (patient_id, product_id, method) values (pid, prod, 'assigned');
  insert into public.program_exercises (program_id, position, name, goal, sets, reps, rest, pain, errors, pose)
    select gid, ord - 1, e->>'name', coalesce(e->>'goal', ''), coalesce(e->>'sets', ''), coalesce(e->>'reps', ''), coalesce(e->>'rest', ''), coalesce(e->>'pain', ''), coalesce(e->'errors', '[]'), coalesce(e->'pose', '[]')
    from public.product_content c, jsonb_array_elements(c.sheet->'exercises') with ordinality t(e, ord) where c.product_id = prod;
  insert into public.exercise_logs (program_id, patient_id, log_date, pain_eva, effort_rpe, created_at)
    select gid, pid, d::date, case when d::date - start < 10 then 5 else 4 end, 5, d + interval '20 hours'
    from generate_series(start, today - 9, interval '1 day') d where extract(isodow from d) in (1, 3, 5);
end $$;
