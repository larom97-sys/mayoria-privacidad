/* Portal del paciente: «Mi plan de hoy», check-in de sesión y chat con el fisio. */
let timer = null;

async function drawPlan(id) {
  if (!session) { afterLogin = id ? "#plan-" + id : "#mi-plan"; return drawLogin(); }
  clearInterval(timer);
  const { data: programs } = await sb.from("patient_programs").select("*").order("created_at", { ascending: false });
  const list = (programs || []).filter((g) => g.status !== "completed");
  if (!list.length) { view.innerHTML = '<div class="pagehead"><h1>Mi plan</h1></div><div class="empty">Tu fisioterapeuta aún no te ha prescrito ningún plan.<br><a href="#tienda">Ver los programas disponibles</a></div>'; return; }
  const g = list.find((x) => x.id === id) || list.find((x) => x.status === "active") || list[0];
  const today = localISO();
  const [ex, lg, ms] = await Promise.all([
    sb.from("program_exercises").select("*").eq("program_id", g.id).order("position"),
    sb.from("exercise_logs").select("*").eq("program_id", g.id).eq("log_date", today),
    sb.from("program_messages").select("*").eq("program_id", g.id).order("created_at")
  ]);
  const exercises = ex.data || [], logs = lg.data || [], msgs = ms.data || [];
  const doneBy = new Map(logs.filter((l) => l.program_exercise_id).map((l) => [l.program_exercise_id, l.id]));
  const checkin = logs.find((l) => !l.program_exercise_id);
  const isDay = g.weekdays.includes(isoDow(today)) && g.start_date <= today;
  const tab = drawPlan.tab || "ejercicios";

  let h = (list.length > 1 ? '<label class="noprint" style="margin-bottom:16px">Plan<select id="plan-pick">' + list.map((x) => '<option value="' + x.id + '"' + (x.id === g.id ? " selected" : "") + ">" + esc(x.title) + "</option>").join("") + "</select></label>" : "") +
    '<div class="pagehead"><div><p class="muted small">' + new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) + "</p><h1>" + esc(g.title) + '</h1><p class="muted">' +
    (g.status === "paused" ? "Tu fisio ha pausado este plan." : isDay ? "Hoy toca sesión." : "Hoy es día de descanso. Puedes hacer la sesión igualmente si te apetece.") + " Días: " + g.weekdays.map((d) => WEEKDAYS[d - 1]).join(" ") + "</p></div></div>" +
    '<div class="actions" style="margin-bottom:18px"><button class="tab" type="button" data-tab="ejercicios" aria-current="' + (tab === "ejercicios") + '" style="background:' + (tab === "ejercicios" ? "" : "var(--white)") + '">Ejercicios</button>' +
    '<button class="tab" type="button" data-tab="chat" aria-current="' + (tab === "chat") + '" style="background:' + (tab === "chat" ? "" : "var(--white)") + '">Chat con mi fisio' + (msgs.length ? " (" + msgs.length + ")" : "") + "</button></div>";

  if (tab === "chat") {
    h += '<div class="panel stack"><div class="chat" id="chat">' + chatHtml(msgs, "patient") + '</div><form class="chatform" id="chat-form"><textarea id="chat-msg" maxlength="2000" required aria-label="Mensaje" placeholder="Escribe tu duda sobre los ejercicios…"></textarea><button class="pill" type="submit">Enviar</button></form>' +
      '<p class="muted small">Tu fisio lo leerá cuando revise su panel. No es un canal de urgencias: ante un empeoramiento brusco, llama a tu centro o al 112.</p></div>';
  } else if (!exercises.length) {
    // Plan de pago sin acceso todavía: el servidor no entrega los ejercicios.
    const prod = catalog.find((p) => p.id === g.product_id);
    h += '<div class="panel stack"><h2>Este plan necesita acceso</h2><p class="muted">Tu fisio lo ha prescrito como ' + (g.access_type === "subscription" ? "parte de la suscripción." : "programa de pago.") + " Cuando lo actives, tus ejercicios personalizados aparecerán aquí.</p>" +
      '<div class="actions">' + (prod ? '<button class="pill" type="button" id="plan-unlock">Ver opciones de acceso</button>' : '<span class="muted small">Pide a tu clínica que active el acceso.</span>') + "</div></div>";
  } else {
    h += (g.clinical_notes ? '<div class="note" style="margin-bottom:16px"><b>Pautas de tu fisio</b><p style="margin-top:4px;white-space:pre-wrap">' + esc(g.clinical_notes) + "</p></div>" : "") +
      '<div class="progress"><i style="width:' + Math.round((doneBy.size / exercises.length) * 100) + '%"></i></div><p class="muted small" style="margin:8px 0 16px">' + doneBy.size + " de " + exercises.length + " ejercicios hechos hoy</p>" +
      '<div class="exlist">' + exercises.map((e, i) => {
        const src = e.video ? embedSrc(e.video) : null, secs = restSeconds(e.rest);
        return '<article class="panel planex' + (doneBy.has(e.id) ? " done" : "") + '"><div class="exfig">' + poseSvg(e.pose, e.name) + "</div>" +
          '<div><p class="muted small">Ejercicio ' + (i + 1) + " de " + exercises.length + "</p><h3>" + esc(e.name) + "</h3><p>" + esc(e.goal) + "</p></div>" +
          '<dl class="dose" style="margin:0"><div><dt>Series</dt><dd>' + esc(e.sets || "—") + "</dd></div><div><dt>Repeticiones</dt><dd>" + esc(e.reps || "—") + "</dd></div><div><dt>Carga</dt><dd>" + esc(e.load || "Sin carga añadida") + "</dd></div><div><dt>Dolor permitido</dt><dd>" + esc(e.pain || "≤ 3/10") + "</dd></div></dl>" +
          (e.instructions ? '<div class="note"><b>Para ti</b><p style="margin-top:4px">' + esc(e.instructions) + "</p></div>" : "") +
          (src ? '<div class="frame"><iframe src="' + esc(src) + '" title="' + esc(e.name) + '" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' : "") +
          ((e.errors || []).length ? '<details><summary class="small" style="cursor:pointer;font-weight:600">Errores a evitar</summary><ul class="small" style="margin:8px 0 0;padding-left:20px">' + e.errors.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></details>" : "") +
          '<div class="actions"><button class="ghost on-white" type="button" data-rest="' + secs + '" aria-live="polite">Descanso ' + (secs >= 60 && secs % 60 === 0 ? secs / 60 + " min" : secs + " s") + "</button>" +
          '<label class="check" style="margin:0"><input type="checkbox" id="pe-' + e.id + '" data-pe="' + e.id + '"' + (doneBy.has(e.id) ? " checked" : "") + "> Hecho</label></div></article>";
      }).join("") + "</div>" +
      (checkin
        ? '<div class="panel stack" style="margin-top:20px"><h2>Sesión registrada</h2><p class="muted">Hoy has anotado dolor ' + checkin.pain_eva + "/10 y esfuerzo " + checkin.effort_rpe + "/10." + (checkin.pain_eva >= 6 ? " Tu fisio verá este registro destacado en su panel." : "") + "</p></div>"
        : '<div class="sticky-cta"><button class="pill" type="button" id="finish">Terminar sesión</button></div>');
  }
  view.innerHTML = h;

  if ($("#plan-pick")) $("#plan-pick").onchange = (e) => (location.hash = "#plan-" + e.target.value);
  $$("[data-tab]", view).forEach((b) => (b.onclick = () => { drawPlan.tab = b.dataset.tab; drawPlan(g.id); }));
  if ($("#plan-unlock")) $("#plan-unlock").onclick = () => drawUnlock(catalog.find((p) => p.id === g.product_id));
  if ($("#chat")) {
    $("#chat").scrollTop = $("#chat").scrollHeight;
    $("#chat-form").onsubmit = async (e) => {
      e.preventDefault();
      const { error } = await sb.from("program_messages").insert({ program_id: g.id, sender: "patient", sender_user: session.user.id, body: $("#chat-msg").value.trim() });
      if (error) return toast("No se ha podido enviar el mensaje.", true);
      drawPlan(g.id);
    };
  }
  $$("[data-pe]", view).forEach((box) => (box.onchange = async () => {
    const q = box.checked ? sb.from("exercise_logs").insert({ program_id: g.id, program_exercise_id: box.dataset.pe, patient_id: patientId, log_date: today, completed: true })
      : sb.from("exercise_logs").delete().eq("id", doneBy.get(box.dataset.pe));
    const { error } = await q;
    if (error) { box.checked = !box.checked; return toast("No se ha podido guardar.", true); }
    drawPlan(g.id);
  }));
  $$("[data-rest]", view).forEach((b) => (b.onclick = () => {
    clearInterval(timer);
    $$("[data-rest]", view).forEach((o) => { if (o.dataset.label) o.textContent = o.dataset.label; });
    b.dataset.label = b.dataset.label || b.textContent;
    let left = Number(b.dataset.rest);
    const tick = () => { if (left <= 0) { clearInterval(timer); b.textContent = "Descanso terminado: siguiente serie"; return; } b.textContent = "Descansando… " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0"); left--; };
    tick(); timer = setInterval(tick, 1000);
  }));
  if ($("#finish")) $("#finish").onclick = () => drawCheckin(g);
}

/* Check-in de sesión: dos deslizadores y un comentario opcional. */
function drawCheckin(g) {
  clearInterval(timer);
  const painWord = (v) => (v <= 3 ? "Molestia aceptable" : v <= 5 ? "Moderado" : "Alto");
  const rpeWord = (v) => (v <= 3 ? "Muy suave" : v <= 6 ? "Moderado" : v <= 8 ? "Duro" : "Máximo");
  view.innerHTML = '<p class="small" style="margin-bottom:12px"><a href="#plan-' + g.id + '" id="back">‹ Volver a los ejercicios</a></p><div class="pagehead"><h1>¿Cómo ha ido?</h1></div>' +
    '<form class="panel form" id="ci-form" style="max-width:560px">' +
    '<label class="slider"><span class="top"><span>Dolor durante la sesión</span><output id="ci-pain-out">2</output></span><input type="range" id="ci-pain" min="0" max="10" step="1" value="2"><span class="ends"><span>0 · Nada</span><span id="ci-pain-word">Molestia aceptable</span><span>10 · Máximo</span></span></label>' +
    '<label class="slider"><span class="top"><span>Esfuerzo percibido</span><output id="ci-rpe-out">5</output></span><input type="range" id="ci-rpe" min="1" max="10" step="1" value="5"><span class="ends"><span>1 · Muy suave</span><span id="ci-rpe-word">Moderado</span><span>10 · Máximo</span></span></label>' +
    '<label>Comentario para tu fisio (opcional)<textarea id="ci-notes" maxlength="1000" placeholder="¿Algo que quieras contarle?"></textarea></label>' +
    '<button class="pill" type="submit">Guardar sesión</button></form>';
  $("#ci-pain").oninput = (e) => { $("#ci-pain-out").textContent = e.target.value; $("#ci-pain-word").textContent = painWord(Number(e.target.value)); };
  $("#ci-rpe").oninput = (e) => { $("#ci-rpe-out").textContent = e.target.value; $("#ci-rpe-word").textContent = rpeWord(Number(e.target.value)); };
  $("#back").onclick = (e) => { e.preventDefault(); drawPlan(g.id); };
  $("#ci-form").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.from("exercise_logs").insert({ program_id: g.id, patient_id: patientId, log_date: localISO(), completed: true, pain_eva: Number($("#ci-pain").value), effort_rpe: Number($("#ci-rpe").value), patient_notes: $("#ci-notes").value.trim() });
    if (error) return toast("No se ha podido guardar la sesión.", true);
    toast("Sesión guardada.");
    drawPlan(g.id);
  };
}
