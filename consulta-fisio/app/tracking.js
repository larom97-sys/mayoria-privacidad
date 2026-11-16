/* Panel del fisio: prescripción en la ficha del paciente, panel de seguimiento y evolución con chat. */
const rx = $("#rx"), rxBody = $("#rx-body");
const planLink = (id) => new URL("portal.html", location.href).href.split("#")[0] + "#plan-" + id;
const rxHead = (title) => '<div class="dlghead"><h2>' + esc(title) + '</h2><button class="iconbtn" id="rx-close" aria-label="Cerrar" style="background:var(--grey)">✕</button></div>';
const wireClose = () => ($("#rx-close").onclick = () => rx.close());

async function fetchPrograms(filter) {
  let q = sb.from("patient_programs").select("*, patients(id,full_name,code,email,phone), exercise_logs(id,program_exercise_id,log_date,completed,pain_eva,effort_rpe,patient_notes,created_at)").order("created_at", { ascending: false });
  if (filter) q = filter(q);
  return must(q);
}

/* ------------------------------------------------------------ panel de seguimiento (triage) */
async function loadTracking() {
  const host = $("#tracking");
  let programs;
  try { programs = await fetchPrograms((q) => q.eq("status", "active")); } catch (err) { return toast(err.message, true); }
  const rows = programs.map((p) => ({ p, s: programStats(p, p.exercise_logs) }));
  const order = { red: 0, amber: 1, green: 2 };
  rows.sort((a, b) => order[a.s.level] - order[b.s.level] || b.s.inactive - a.s.inactive);
  const n = (lv) => rows.filter((r) => r.s.level === lv).length;
  $("#track-stats").innerHTML =
    '<div class="panel"><span class="muted small">Planes activos</span><b>' + rows.length + "</b></div>" +
    '<div class="panel"><span class="muted small">Alertas de dolor (EVA ≥ 6 en 48 h)</span><b>' + n("red") + "</b></div>" +
    '<div class="panel"><span class="muted small">Inactivos más de 5 días</span><b>' + n("amber") + "</b></div>";
  if (!rows.length) { host.innerHTML = '<div class="empty">No hay planes activos. Prescribe uno desde la ficha de un paciente.</div>'; return; }
  host.innerHTML = '<div class="panel tablewrap"><table class="track"><thead><tr><th>Paciente</th><th>Programa</th><th>Estado</th><th>Adherencia 7 días</th><th>Última actividad</th><th>Dolor máx. 48 h</th><th></th></tr></thead><tbody>' +
    rows.map(({ p, s }) => "<tr><td><b>" + esc(p.patients?.full_name || "") + "</b></td><td>" + esc(p.title) + "</td><td>" + levelChip(s.level, s.label) + "</td>" +
      "<td>" + (s.adherence == null ? '<span class="muted">Sin sesiones previstas</span>' : levelChip(pctLevel(s.adherence), s.adherence + " %")) + "</td>" +
      "<td>" + (s.last ? (s.inactive === 0 ? "Hoy" : "Hace " + s.inactive + (s.inactive === 1 ? " día" : " días")) : '<span class="muted">Sin actividad</span>') + "</td>" +
      "<td>" + (s.pain48 == null ? '<span class="muted">—</span>' : s.pain48 + " / 10") + "</td>" +
      '<td><button class="ghost sm on-white" data-evo="' + p.id + '">Ver evolución</button></td></tr>').join("") + "</tbody></table></div>";
  $$("[data-evo]", host).forEach((b) => (b.onclick = () => openEvolution(b.dataset.evo)));
}

/* ------------------------------------------------------------ programas en la ficha del paciente */
async function drawPatientPrograms(p, host) {
  let programs;
  try { programs = await fetchPrograms((q) => q.eq("patient_id", p.id)); } catch (_) { return; }
  if (currentPatient !== p) return;
  const box = document.createElement("div");
  box.className = "stack";
  box.innerHTML = '<div class="pagehead" style="margin:0"><h3>Planes de ejercicio</h3><button class="pill sm" id="pt-rx">Prescribir programa</button></div>' +
    (programs.length ? '<div class="rows">' + programs.map((g) => {
      const s = programStats(g, g.exercise_logs);
      return "<div><span><b>" + esc(g.title) + '</b><br><span class="muted small">' + ACCESS_LABEL[g.access_type] + " · desde " + shortDate(g.start_date) + " · " + g.weekdays.map((d) => WEEKDAYS[d - 1]).join(" ") + "</span></span>" +
        '<span class="actions">' + (g.status === "active" ? levelChip(s.level, s.label) : '<span class="chip">' + PROGRAM_STATUS[g.status] + "</span>") +
        '<button class="ghost sm on-white" data-evo="' + g.id + '">Evolución y chat</button></span></div>';
    }).join("") + "</div>" : '<p class="muted">Sin planes prescritos.</p>');
  $(".stack", host).appendChild(box);
  $("#pt-rx", box).onclick = () => openPrescribe(p);
  $$("[data-evo]", box).forEach((b) => (b.onclick = () => openEvolution(b.dataset.evo)));
}

/* ------------------------------------------------------------ asignador rápido */
function openPrescribe(patient) {
  const templates = products.filter((x) => x.status !== "archived" && (x.sheet.exercises || []).length);
  if (!templates.length) return toast("No hay plantillas con ejercicios. Crea una en Infoproductos.", true);
  rxBody.innerHTML = rxHead("Prescribir a " + patient.full_name) + '<form class="form" id="rx-form">' +
    '<div class="two"><label>Plantilla<select id="rx-tpl">' + templates.map((t) => '<option value="' + t.id + '">' + esc(t.title) + "</option>").join("") + "</select></label>" +
    '<label>Tipo de acceso<select id="rx-access"><option value="free_consult">Gratuito, incluido en consulta</option><option value="one_time">De pago: compra individual</option><option value="subscription">De pago: con suscripción</option></select></label></div>' +
    '<div class="two"><label>Fecha de inicio<input type="date" id="rx-start" required value="' + localISO() + '"></label>' +
    '<div><span class="small muted" style="font-weight:500">Días recomendados</span><div class="days" style="margin-top:6px">' + WEEKDAYS.map((d, i) => "<label>" + d + '<input type="checkbox" id="rx-day-' + (i + 1) + '" value="' + (i + 1) + '"' + ([1, 3, 5].includes(i + 1) ? " checked" : "") + "></label>").join("") + "</div></div></div>" +
    '<label>Notas clínicas para el paciente<textarea id="rx-notes" maxlength="1500" placeholder="Pautas generales, precauciones, objetivo de estas semanas…"></textarea></label>' +
    '<div><h3>Ejercicios</h3><p class="muted small">Ajusta la dosis para este paciente. La plantilla de la clínica no cambia.</p><div id="rx-ex" style="margin-top:8px"></div></div>' +
    '<p class="err" id="rx-err" hidden></p><div class="dlgfoot"><span></span><button class="pill" type="submit">Prescribir y generar enlace</button></div></form>';
  wireClose();
  const drawEx = () => {
    const t = templates.find((x) => x.id === $("#rx-tpl").value);
    $("#rx-ex").innerHTML = '<div class="rxrow small muted" style="border-top:0"><span></span><span class="nm">Ejercicio</span><span>Series</span><span>Repeticiones</span><span>Carga</span><span>Descanso</span></div>' +
      t.sheet.exercises.map((e, i) => '<div class="rxrow" data-i="' + i + '"><input type="checkbox" id="rx-on-' + i + '" checked aria-label="Incluir ' + esc(e.name) + '">' +
        '<span class="nm"><b>' + esc(e.name) + "</b></span>" +
        '<input type="text" data-f="sets" aria-label="Series" value="' + esc(e.sets || "") + '"><input type="text" data-f="reps" aria-label="Repeticiones" value="' + esc(e.reps || "") + '">' +
        '<input type="text" data-f="load" aria-label="Carga o resistencia" placeholder="p. ej. 5 kg"><input type="text" data-f="rest" aria-label="Descanso" value="' + esc(e.rest || "") + '">' +
        '<input type="text" class="ins" data-f="instructions" aria-label="Indicaciones para este paciente" placeholder="Indicaciones para este paciente (opcional)"></div>').join("");
  };
  $("#rx-tpl").onchange = drawEx; drawEx();
  $("#rx-form").onsubmit = async (e) => {
    e.preventDefault();
    const t = templates.find((x) => x.id === $("#rx-tpl").value), err = $("#rx-err");
    const weekdays = $$(".days input:checked", rxBody).map((c) => Number(c.value));
    const chosen = $$("#rx-ex .rxrow[data-i]").filter((r) => $("input[type=checkbox]", r).checked);
    if (!weekdays.length || !chosen.length) { err.textContent = "Elige al menos un día y un ejercicio."; err.hidden = false; return; }
    const btn = $("button[type=submit]", rxBody); btn.disabled = true;
    try {
      const { data: { session } } = await sb.auth.getSession();
      const access = $("#rx-access").value;
      const prog = await must(sb.from("patient_programs").insert({ patient_id: patient.id, product_id: t.id, therapist_id: session.user.id, title: t.title, start_date: $("#rx-start").value, weekdays, clinical_notes: $("#rx-notes").value.trim(), access_type: access }).select().single());
      await must(sb.from("program_exercises").insert(chosen.map((r, pos) => {
        const src = t.sheet.exercises[Number(r.dataset.i)], v = (f) => $('[data-f="' + f + '"]', r).value.trim();
        return { program_id: prog.id, position: pos, name: src.name, goal: src.goal || "", sets: v("sets"), reps: v("reps"), load: v("load"), rest: v("rest"), pain: src.pain || "", instructions: v("instructions"), errors: src.errors || [], pose: src.pose || [], video: src.video || "" };
      })));
      // Gratuito de consulta: se desbloquea también la ficha completa de la plantilla.
      if (access === "free_consult") await sb.from("accesses").upsert({ patient_id: patient.id, product_id: t.id, method: "assigned" }, { onConflict: "patient_id,product_id", ignoreDuplicates: true });
      drawShare(patient, prog);
      loadPatients();
    } catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; }
  };
  rx.showModal();
}

function drawShare(patient, prog) {
  const link = planLink(prog.id), phone = (patient.phone || "").replace(/\D/g, "");
  const text = "Hola" + (patient.full_name ? " " + patient.full_name.split(" ")[0] : "") + ", aquí tienes tu plan de ejercicios «" + prog.title + "»: " + link;
  rxBody.innerHTML = rxHead("Plan prescrito") + '<p>«' + esc(prog.title) + "» · " + ACCESS_LABEL[prog.access_type] + ".</p>" +
    '<p class="muted small">' + (patient.user_id ? "El paciente ya tiene cuenta: lo verá en «Mi plan»." : patient.email ? "El paciente lo verá al registrarse en el portal con " + esc(patient.email) + "." : "Añade un email a la ficha para que el paciente pueda entrar en el portal.") + "</p>" +
    '<label>Enlace directo<input type="text" id="rx-link" readonly value="' + esc(link) + '"></label>' +
    '<div class="actions"><a class="pill sm" target="_blank" rel="noopener" href="https://wa.me/' + phone + "?text=" + encodeURIComponent(text) + '">Enviar por WhatsApp</a>' +
    '<a class="ghost on-white sm" href="mailto:' + encodeURIComponent(patient.email || "") + "?subject=" + encodeURIComponent("Tu plan de ejercicios") + "&body=" + encodeURIComponent(text) + '">Enviar por email</a>' +
    '<button class="ghost on-white sm" type="button" id="rx-copy">Copiar enlace</button></div>';
  wireClose();
  $("#rx-copy").onclick = () => navigator.clipboard.writeText(link).then(() => toast("Enlace copiado."), () => $("#rx-link").select());
}

/* ------------------------------------------------------------ evolución del paciente y chat */
async function openEvolution(programId, refresh) {
  let g, msgs;
  try {
    [g] = await fetchPrograms((q) => q.eq("id", programId));
    msgs = await must(sb.from("program_messages").select("*").eq("program_id", programId).order("created_at"));
  } catch (err) { return toast(err.message, true); }
  if (refresh && !rx.open) return; // se cerró mientras se actualizaba: no reabrir
  const logs = g.exercise_logs, s = programStats(g, logs);
  const sessions = logs.filter((l) => !l.program_exercise_id).sort((a, b) => (a.log_date + a.created_at < b.log_date + b.created_at ? -1 : 1));
  const painPts = sessions.filter((l) => l.pain_eva != null).map((l) => ({ x: shortDate(l.log_date), y: l.pain_eva, tip: shortDate(l.log_date) + ": dolor " + l.pain_eva + "/10" + (l.effort_rpe ? ", esfuerzo " + l.effort_rpe + "/10" : "") }));
  rxBody.innerHTML = rxHead(g.patients.full_name + " · " + g.title) +
    '<div class="actions">' + levelChip(s.level, s.label) + '<label style="flex-direction:row;align-items:center;gap:8px">Estado<select id="evo-status" style="width:auto;padding:8px 12px">' + Object.keys(PROGRAM_STATUS).map((k) => '<option value="' + k + '"' + (g.status === k ? " selected" : "") + ">" + PROGRAM_STATUS[k] + "</option>").join("") + "</select></label></div>" +
    '<div class="kpis"><div><span class="muted small">Adherencia 7 días</span><b>' + (s.adherence == null ? "—" : s.adherence + " %") + '</b></div><div><span class="muted small">Última actividad</span><b>' + (s.last ? shortDate(s.last) : "—") + '</b></div><div><span class="muted small">Dolor máx. 48 h</span><b>' + (s.pain48 == null ? "—" : s.pain48 + " / 10") + '</b></div><div><span class="muted small">Sesiones registradas</span><b>' + sessions.length + "</b></div></div>" +
    "<div><h3>Dolor EVA por sesión</h3>" + lineChart(painPts, { max: 10, ticks: [0, 5, 10], title: "Dolor EVA por sesión, de 0 a 10", threshold: 6, thresholdLabel: "Alerta", empty: "El paciente aún no ha registrado ninguna sesión." }) + "</div>" +
    "<div><h3>Cumplimiento semanal</h3>" + lineChart(weeklyAdherence(g, logs), { max: 100, ticks: [0, 50, 100], unit: " %", title: "Porcentaje de sesiones previstas completadas cada semana", empty: "Aún no hay semanas con sesiones previstas." }) + "</div>" +
    (g.clinical_notes ? '<div><h3>Notas clínicas</h3><p class="muted">' + esc(g.clinical_notes) + "</p></div>" : "") +
    "<div><h3>Historial de sesiones</h3>" + (sessions.length ? '<div class="tablewrap"><table class="track" style="min-width:480px"><thead><tr><th>Fecha</th><th>Dolor</th><th>Esfuerzo</th><th>Comentario del paciente</th></tr></thead><tbody>' +
      sessions.slice().reverse().map((l) => "<tr><td>" + shortDate(l.log_date) + "</td><td>" + (l.pain_eva == null ? "—" : levelChip(l.pain_eva >= 6 ? "red" : l.pain_eva >= 4 ? "amber" : "green", l.pain_eva + " / 10")) + "</td><td>" + (l.effort_rpe == null ? "—" : l.effort_rpe + " / 10") + "</td><td>" + (esc(l.patient_notes) || '<span class="muted">—</span>') + "</td></tr>").join("") + "</tbody></table></div>" : '<p class="muted small">Sin sesiones registradas.</p>') + "</div>" +
    '<div><h3>Chat con el paciente</h3><div class="chat" id="evo-chat">' + chatHtml(msgs, "therapist") + '</div><form class="chatform" id="evo-form" style="margin-top:10px"><textarea id="evo-msg" maxlength="2000" required aria-label="Mensaje" placeholder="Escribe al paciente…"></textarea><button class="pill" type="submit">Enviar</button></form></div>';
  wireClose(); wireCharts(rxBody);
  const chat = $("#evo-chat"); chat.scrollTop = chat.scrollHeight;
  $("#evo-status").onchange = async (e) => { try { await must(sb.from("patient_programs").update({ status: e.target.value }).eq("id", g.id)); toast("Estado actualizado."); } catch (err) { toast(err.message, true); } };
  $("#evo-form").onsubmit = async (e) => {
    e.preventDefault();
    const { data: { session } } = await sb.auth.getSession();
    try { await must(sb.from("program_messages").insert({ program_id: g.id, sender: "therapist", sender_user: session.user.id, body: $("#evo-msg").value.trim() })); openEvolution(g.id, true); }
    catch (err) { toast(err.message, true); }
  };
  if (!rx.open) rx.showModal();
}
rx.addEventListener("close", () => { if (!$("#v-seguimiento").hidden) loadTracking(); else if (!$("#v-pacientes").hidden) loadPatients(); });
