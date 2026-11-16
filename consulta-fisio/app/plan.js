/* Un programa asignado: «Entender mi lesión», «Mis ejercicios» (con check-in) y chat con el fisio. */
let timer = null;

async function drawPlan(id) {
  if (!session) { afterLogin = "#plan-" + id; return drawLogin(); }
  clearInterval(timer);
  const g = programs.find((x) => x.id === id);
  if (!g) { view.innerHTML = '<div class="empty">Este programa no está en tu cuenta.<br><a href="#">Ver mis programas</a></div>'; return; }
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
  const tab = drawPlan.tab || (exercises.length ? "ejercicios" : "lesion");
  const tabBtn = (k, label) => '<button class="tab" type="button" data-tab="' + k + '" aria-current="' + (tab === k) + '" style="background:' + (tab === k ? "" : "var(--white)") + '">' + label + "</button>";

  let h = '<p class="small noprint" style="margin-bottom:12px"><a href="#">‹ Mis programas</a></p>' +
    '<div class="pagehead"><div><p class="muted small noprint">' + new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) + "</p><h1>" + esc(g.title) + '</h1><p class="muted noprint">' +
    (g.status === "paused" ? "Tu fisio ha pausado este programa." : g.status === "completed" ? "Programa completado." : isDay ? "Hoy toca sesión." : "Hoy es día de descanso.") + " Días: " + g.weekdays.map((d) => WEEKDAYS[d - 1]).join(" ") + "</p></div></div>" +
    '<div class="actions noprint" style="margin-bottom:18px">' + tabBtn("lesion", "Entender mi lesión") + tabBtn("ejercicios", "Mis ejercicios") + tabBtn("chat", "Chat con mi fisio" + (msgs.length ? " (" + msgs.length + ")" : "")) + "</div>";
  view.innerHTML = h + '<div id="tabbody"></div>';
  $$("[data-tab]", view).forEach((b) => (b.onclick = () => { drawPlan.tab = b.dataset.tab; drawPlan(g.id); }));
  const host = $("#tabbody");

  if (tab === "lesion") return drawLesion(g, host);

  if (tab === "chat") {
    host.innerHTML = '<div class="panel stack"><div class="chat" id="chat">' + chatHtml(msgs, "patient") + '</div><form class="chatform" id="chat-form"><textarea id="chat-msg" maxlength="2000" required aria-label="Mensaje" placeholder="Escribe tu duda sobre los ejercicios…"></textarea><button class="pill" type="submit">Enviar</button></form>' +
      '<p class="muted small">Tu fisio lo leerá cuando revise su panel. No es un canal de urgencias: ante un empeoramiento brusco, llama a tu centro o al 112.</p></div>';
    $("#chat").scrollTop = $("#chat").scrollHeight;
    $("#chat-form").onsubmit = async (e) => {
      e.preventDefault();
      const { error } = await sb.from("program_messages").insert({ program_id: g.id, sender: "patient", sender_user: session.user.id, body: $("#chat-msg").value.trim() });
      if (error) return toast("No se ha podido enviar el mensaje.", true);
      drawPlan(g.id);
    };
    return;
  }

  if (!exercises.length) { host.innerHTML = '<div class="empty">Este programa no incluye ejercicios. Consulta la pestaña «Entender mi lesión».</div>'; return; }
  host.innerHTML = (g.clinical_notes ? '<div class="note" style="margin-bottom:16px"><b>Pautas de tu fisio</b><p style="margin-top:4px;white-space:pre-wrap">' + esc(g.clinical_notes) + "</p></div>" : "") +
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

  $$("[data-pe]", host).forEach((box) => (box.onchange = async () => {
    const q = box.checked ? sb.from("exercise_logs").insert({ program_id: g.id, program_exercise_id: box.dataset.pe, patient_id: patientId, log_date: today, completed: true })
      : sb.from("exercise_logs").delete().eq("id", doneBy.get(box.dataset.pe));
    const { error } = await q;
    if (error) { box.checked = !box.checked; return toast("No se ha podido guardar.", true); }
    drawPlan(g.id);
  }));
  $$("[data-rest]", host).forEach((b) => (b.onclick = () => {
    clearInterval(timer);
    $$("[data-rest]", host).forEach((o) => { if (o.dataset.label) o.textContent = o.dataset.label; });
    b.dataset.label = b.dataset.label || b.textContent;
    let left = Number(b.dataset.rest);
    const tick = () => { if (left <= 0) { clearInterval(timer); b.textContent = "Descanso terminado: siguiente serie"; return; } b.textContent = "Descansando… " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0"); left--; };
    tick(); timer = setInterval(tick, 1000);
  }));
  if ($("#finish")) $("#finish").onclick = () => drawCheckin(g);
}

/* Infografía de la lesión: qué es, fases, señales de alarma, y los archivos que el fisio haya adjuntado. */
async function drawLesion(g, host) {
  if (!g.product_id) { host.innerHTML = '<div class="empty">Este programa no tiene ficha de la lesión.</div>'; return; }
  const [p, c, l] = await Promise.all([
    sb.from("infoproducts").select("id,title,description,body_region,pathology_type").eq("id", g.product_id).maybeSingle(),
    sb.from("product_content").select("sheet").eq("product_id", g.product_id).maybeSingle(),
    sb.from("lessons").select("id,title,kind,file_path,external_url,position").eq("product_id", g.product_id).order("position")
  ]);
  if (!p.data || !c.data) { host.innerHTML = '<div class="empty">La ficha de este programa no está disponible.</div>'; return; }
  const sheet = Object.assign({}, c.data.sheet, { exercises: [] }), lessons = l.data || [];
  host.innerHTML = '<div class="actions noprint" style="margin-bottom:16px"><button class="ghost" type="button" id="print">Imprimir o guardar en PDF</button></div>' + renderSheet(p.data, sheet, {}) +
    (lessons.length ? '<section class="panel noprint" style="margin-top:20px"><h2>Archivos y vídeos de tu fisio</h2><ul class="lessonlist">' + lessons.map((x) =>
      '<li><button type="button" data-open="' + x.id + '">' + esc(x.title) + ' <span class="muted small">· ' + KIND_LABEL[x.kind].split(" ")[0] + "</span></button></li>").join("") + '</ul><div id="stage" class="stack" style="margin-top:14px"></div></section>' : "");
  $("#print").onclick = () => window.print();
  $$("[data-open]", host).forEach((b) => (b.onclick = () => openLesson(lessons.find((x) => x.id === b.dataset.open))));
}

async function openLesson(l) {
  const stage = $("#stage");
  $$("[data-open]").forEach((b) => b.setAttribute("aria-current", b.dataset.open === l.id));
  let html = "<h3>" + esc(l.title) + "</h3>";
  if (l.kind === "video" || l.kind === "pdf") {
    const opts = l.kind === "pdf" ? { download: l.file_path.split("/").pop().replace(/^[0-9a-f-]{36}-/, "") } : undefined;
    const { data, error } = await sb.storage.from("content").createSignedUrl(l.file_path, SIGNED_SECONDS, opts);
    if (error) { stage.innerHTML = html + '<p class="err">No se ha podido abrir este archivo.</p>'; return; }
    html += l.kind === "video"
      ? '<div class="frame"><video controls playsinline preload="metadata" src="' + esc(data.signedUrl) + '"></video></div>'
      : '<p class="muted small">El enlace de descarga es personal y caduca en una hora.</p><div class="actions"><a class="pill" href="' + esc(data.signedUrl) + '">Descargar PDF</a></div>';
  } else if (l.kind === "embed") {
    const src = embedSrc(l.external_url);
    html += src ? '<div class="frame"><iframe src="' + esc(src) + '" title="' + esc(l.title) + '" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' : '<p class="err">Este vídeo no se puede mostrar.</p>';
  } else {
    html += isHttps(l.external_url) ? '<div class="actions"><a class="pill" target="_blank" rel="noopener" href="' + esc(l.external_url) + '">Abrir enlace</a></div>' : "";
  }
  stage.innerHTML = html;
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
    drawPlan.tab = "ejercicios"; drawPlan(g.id);
  };
}
