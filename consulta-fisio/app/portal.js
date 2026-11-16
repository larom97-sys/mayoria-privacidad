/* Portal del paciente: catálogo con filtros dobles, ficha del programa, suscripción o compra y «Mis programas». */
const view = $("#view"), unlock = $("#unlock");
let session = null, patientId = null, catalog = [], owned = new Map(), sub = null, settings = { subscription_name: "Acceso total", subscription_price_cents: 1499 }, afterLogin = null;
let filters = { region: "", path: "" };
const SIGNED_SECONDS = 3600; // las URL firmadas de vídeos y PDF caducan en una hora
const money = (cents) => (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const here = () => location.href.split("#")[0];

/* Regla de acceso en el cliente (la que manda es la del servidor):
   suscripción activa O compra individual O asignado por el fisio. */
const subActive = () => !!sub && ["active", "trialing"].includes(sub.status) && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
const hasAccess = (id) => owned.has(id) || (subActive() && catalog.some((p) => p.id === id));

async function refresh() {
  session = (await sb.auth.getSession()).data.session;
  $("#session").textContent = session ? "Salir" : "Entrar";
  const [cat, set] = await Promise.all([sb.rpc("store_catalog"), sb.from("settings").select("*").single()]);
  catalog = cat.data || [];
  if (set.data) settings = set.data;
  owned = new Map(); sub = null; patientId = null;
  if (!session) return;
  const { data: pid, error } = await sb.rpc("ensure_patient", { p_name: session.user.user_metadata?.name || null });
  if (error) return toast("No hemos podido abrir tu ficha: " + error.message, true);
  patientId = pid;
  const [a, s] = await Promise.all([
    sb.from("accesses").select("method, acquired_at, infoproducts(id,title,description,body_region,pathology_type,cover_path,price_cents)"),
    sb.from("subscriptions").select("*").maybeSingle()
  ]);
  (a.data || []).filter((x) => x.infoproducts).forEach((x) => owned.set(x.infoproducts.id, x));
  sub = s.data;
}
$("#session").onclick = async () => {
  if (session) { await sb.auth.signOut(); await refresh(); location.hash = "#tienda"; route(); }
  else { afterLogin = location.hash || "#mis-programas"; drawLogin(); }
};

function drawLogin() {
  unlock.open && unlock.close();
  renderAuth(view, { title: "Tu cuenta", intro: "Entra o crea tu cuenta para ver y conseguir tus programas.", askName: true, onDone: async () => {
    await refresh();
    const next = afterLogin || "#mis-programas"; afterLogin = null;
    if (location.hash === next) route(); else location.hash = next;
  } });
}

const planBanner = () => subActive()
  ? '<div class="plan noprint"><div><b>' + esc(settings.subscription_name) + ' activa</b><br><span class="muted small">Tienes acceso a todos los programas' + (sub.current_period_end ? " · " + (sub.cancel_at_period_end ? "termina el " : "se renueva el ") + new Date(sub.current_period_end).toLocaleDateString("es-ES") : "") + '</span></div><button class="ghost" type="button" id="manage">Gestionar suscripción</button></div>'
  : '<div class="plan noprint"><div><b>' + esc(settings.subscription_name) + " · " + money(settings.subscription_price_cents) + ' al mes</b><br><span class="muted small">Todos los programas actuales y futuros mientras la suscripción esté activa.</span></div><button class="pill" type="button" id="subscribe">Suscribirme</button></div>';
function wirePlan() {
  if ($("#subscribe")) $("#subscribe").onclick = (e) => checkout("subscription", null, e.currentTarget);
  if ($("#manage")) $("#manage").onclick = async (e) => {
    e.currentTarget.disabled = true;
    const { data, error } = await sb.functions.invoke("manage-subscription", { body: { return_url: here() + "#mis-programas" } });
    if (error || !data?.url) { e.currentTarget.disabled = false; return toast("No se ha podido abrir la gestión de la suscripción.", true); }
    location.href = data.url;
  };
}

const card = (p, foot) => '<a class="card hover" href="#producto-' + p.id + '" style="text-decoration:none;color:inherit">' + coverBlock(p) +
  '<div class="body"><span class="muted small">' + esc(p.body_region || "") + " · " + esc(p.pathology_type || "") + "</span><h3>" + esc(p.title) + '</h3><p class="muted">' + esc(p.description) + "</p>" + foot + "</div></a>";

/* ------------------------------------------------------------ catálogo con filtros combinables */
function drawShop() {
  const regions = REGIONS.filter((r) => catalog.some((p) => p.body_region === r)), paths = PATHOLOGIES.filter((t) => catalog.some((p) => p.pathology_type === t));
  const sel = (id, label, list, cur) => "<label>" + label + '<select id="' + id + '"><option value="">Todas</option>' + list.map((x) => '<option value="' + esc(x) + '"' + (x === cur ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select></label>";
  const list = catalog.filter((p) => (!filters.region || p.body_region === filters.region) && (!filters.path || p.pathology_type === filters.path));
  view.innerHTML = '<div class="pagehead"><div><h1>Programas de rehabilitación</h1><p class="muted">Fichas de cada lesión y protocolos de ejercicio paso a paso.</p></div></div>' + planBanner() +
    '<div class="filters">' + sel("f-region", "Localización anatómica", regions, filters.region) + sel("f-path", "Tipo de patología", paths, filters.path) +
    '<button class="ghost" type="button" id="f-clear"' + (filters.region || filters.path ? "" : " disabled") + ">Quitar filtros</button></div>" +
    '<p class="muted small" id="count" style="margin-bottom:14px">' + list.length + (list.length === 1 ? " programa" : " programas") + "</p>" +
    (list.length ? '<div class="grid">' + list.map((p) => card(p, '<div class="row"><span class="amt">' + (hasAccess(p.id) ? "Tuyo" : euros(p.price_cents)) + '</span><span class="muted small">' + p.exercise_count + " ejercicios</span></div>")).join("") + "</div>"
      : '<div class="empty">' + (catalog.length ? "Ningún programa coincide con esos filtros." : "Pronto habrá programas disponibles.") + "</div>") +
    '<p class="muted small" style="text-align:center;margin-top:32px">Material educativo. No sustituye a la valoración de tu fisioterapeuta.</p>';
  $("#f-region").onchange = (e) => { filters.region = e.target.value; drawShop(); };
  $("#f-path").onchange = (e) => { filters.path = e.target.value; drawShop(); };
  $("#f-clear").onclick = () => { filters = { region: "", path: "" }; drawShop(); };
  wirePlan();
}

/* ------------------------------------------------------------ mis programas */
function drawMine() {
  if (!session) { afterLogin = "#mis-programas"; return drawLogin(); }
  const mine = subActive() ? catalog.concat([...owned.values()].map((a) => a.infoproducts).filter((p) => !catalog.some((c) => c.id === p.id))) : [...owned.values()].map((a) => a.infoproducts);
  view.innerHTML = '<div class="pagehead"><h1>Mis programas</h1></div>' + planBanner() + (mine.length ? '<div class="grid">' + mine.map((p) => {
    const a = owned.get(p.id);
    return card(p, '<div class="row"><span class="chip ok">' + (a ? METHOD_LABEL[a.method] : "Incluido en tu suscripción") + "</span></div>");
  }).join("") + "</div>" : '<div class="empty">Todavía no tienes programas. <a href="#tienda">Ver el catálogo</a></div>');
  wirePlan();
}

/* ------------------------------------------------------------ ficha del programa */
async function drawProduct(id) {
  let p = catalog.find((x) => x.id === id) || owned.get(id)?.infoproducts;
  if (!p) { view.innerHTML = '<div class="empty">Este programa no está disponible. <a href="#tienda">Ver el catálogo</a></div>'; return; }
  const head = '<p class="small noprint" style="margin-bottom:12px"><a href="#tienda">‹ Catálogo</a></p><div class="pagehead"><div><h1>' + esc(p.title) + '</h1><p class="muted">' + esc(p.description) + "</p></div>";
  if (!session || !hasAccess(id)) {
    view.innerHTML = head + "</div>" +
      '<div class="panel stack"><p><span class="chip">' + esc(p.body_region || "") + '</span> <span class="chip">' + esc(p.pathology_type || "") + "</span></p>" +
      "<h2>Qué incluye</h2><ul style=\"margin:0;padding-left:20px\"><li>Ficha de la lesión: qué es, fases y tiempos orientativos</li><li>Banderas rojas: cuándo parar y consultar</li><li>" + (p.exercise_count || 0) + " ejercicios progresivos con diagramas, series, repeticiones y errores a evitar</li>" + (p.lesson_count ? "<li>" + p.lesson_count + " archivos o vídeos adicionales</li>" : "") + "<li>Guía imprimible en PDF</li></ul>" +
      '<div class="actions"><button class="pill" type="button" id="open-unlock">' + (p.price_cents ? "Desbloquear programa" : "Conseguir gratis") + "</button></div></div>";
    $("#open-unlock").onclick = () => p.price_cents ? drawUnlock(p) : claimFree(p, $("#open-unlock"));
    return;
  }
  const [c, l, d, ld] = await Promise.all([
    sb.from("product_content").select("sheet").eq("product_id", id).maybeSingle(),
    sb.from("lessons").select("id,title,kind,file_path,external_url,position").eq("product_id", id).order("position"),
    sb.from("exercise_progress").select("exercise_key").eq("product_id", id),
    sb.from("lesson_progress").select("lesson_id")
  ]);
  const sheet = c.data?.sheet || {}, lessons = l.data || [], done = new Set((d.data || []).map((x) => x.exercise_key)), lessonDone = new Set((ld.data || []).map((x) => x.lesson_id));
  view.innerHTML = head + '<button class="ghost noprint" type="button" id="print">Imprimir o guardar en PDF</button></div>' + renderSheet(p, sheet, { interactive: true, done }) +
    (lessons.length ? '<section class="panel noprint" style="margin-top:20px"><h2>Archivos y vídeos</h2><ul class="lessonlist">' + lessons.map((x) =>
      '<li><input type="checkbox" id="done-' + x.id + '" data-lesson="' + x.id + '" aria-label="Visto: ' + esc(x.title) + '"' + (lessonDone.has(x.id) ? " checked" : "") + '><button type="button" data-open="' + x.id + '">' + esc(x.title) + ' <span class="muted small">· ' + KIND_LABEL[x.kind].split(" ")[0] + "</span></button></li>").join("") + '</ul><div id="stage" class="stack" style="margin-top:14px"></div></section>' : "");
  $("#print").onclick = () => window.print();
  $$("[data-ex]", view).forEach((box) => (box.onchange = async () => {
    const q = box.checked ? sb.from("exercise_progress").upsert({ patient_id: patientId, product_id: id, exercise_key: box.dataset.ex }) : sb.from("exercise_progress").delete().eq("patient_id", patientId).eq("product_id", id).eq("exercise_key", box.dataset.ex);
    const { error } = await q;
    if (error) { box.checked = !box.checked; return toast("No se ha podido guardar el progreso.", true); }
    box.checked ? done.add(box.dataset.ex) : done.delete(box.dataset.ex);
    const ex = sheet.exercises || [], n = ex.filter((e) => done.has(e.key)).length;
    $(".sheet .progress i").style.width = Math.round((n / ex.length) * 100) + "%";
    $(".sheet .progress + p").textContent = n + " de " + ex.length + " ejercicios completados hoy";
  }));
  $$("[data-lesson]", view).forEach((box) => (box.onchange = async () => {
    const q = box.checked ? sb.from("lesson_progress").upsert({ patient_id: patientId, lesson_id: box.dataset.lesson }) : sb.from("lesson_progress").delete().eq("patient_id", patientId).eq("lesson_id", box.dataset.lesson);
    const { error } = await q;
    if (error) { box.checked = !box.checked; toast("No se ha podido guardar el progreso.", true); }
  }));
  $$("[data-open]", view).forEach((b) => (b.onclick = () => openLesson(lessons.find((x) => x.id === b.dataset.open))));
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

/* ------------------------------------------------------------ suscripción frente a compra única */
function drawUnlock(p) {
  $("#unlock-body").innerHTML = '<div class="dlghead"><h2>Cómo quieres acceder</h2><button class="iconbtn" id="un-close" aria-label="Cerrar" style="background:var(--grey)">✕</button></div>' +
    '<div class="choices"><div class="choice best"><span class="chip ok" style="align-self:flex-start">Todo incluido</span><h3>' + esc(settings.subscription_name) + '</h3><span class="amt">' + money(settings.subscription_price_cents) + ' <span class="muted small">al mes</span></span>' +
    '<p class="muted small">Todos los programas actuales y futuros mientras la suscripción esté activa. Puedes cancelarla cuando quieras.</p><button class="pill" type="button" id="un-sub">Suscribirme</button></div>' +
    '<div class="choice"><span class="chip" style="align-self:flex-start">Pago único</span><h3>Solo este programa</h3><span class="amt">' + money(p.price_cents) + "</span>" +
    '<p class="muted small">«' + esc(p.title) + '» con acceso para siempre, sin suscripción.</p><button class="ghost" type="button" id="un-buy">Comprar</button></div></div>' +
    '<p class="muted small">Si tu fisioterapeuta te ha asignado este programa, aparecerá en «Mis programas» sin coste.</p>';
  $("#un-close").onclick = () => unlock.close();
  $("#un-sub").onclick = (e) => checkout("subscription", null, e.currentTarget, p.id);
  $("#un-buy").onclick = (e) => checkout("product", p.id, e.currentTarget, p.id);
  unlock.showModal();
}

async function claimFree(p, btn) {
  if (!session) { afterLogin = "#producto-" + p.id; return drawLogin(); }
  btn.disabled = true;
  const { error } = await sb.rpc("claim_free_product", { p_product: p.id });
  if (error) { btn.disabled = false; return toast("No se ha podido añadir: " + error.message, true); }
  await refresh(); drawProduct(p.id);
}

async function checkout(kind, productId, btn, backTo) {
  if (!session) { afterLogin = backTo ? "#producto-" + backTo : "#tienda"; return drawLogin(); }
  btn.disabled = true;
  const { data, error } = await sb.functions.invoke("create-checkout", { body: { kind, product_id: productId, return_url: here() + (backTo ? "#producto-" + backTo : "#mis-programas") } });
  if (error || !data?.url) {
    btn.disabled = false;
    return toast("El pago online todavía no está activado. Pide el acceso en tu clínica.", true);
  }
  location.href = data.url;
}

/* ------------------------------------------------------------ rutas */
function route() {
  unlock.open && unlock.close();
  const h = location.hash.slice(1) || "tienda";
  const isPlan = h === "mi-plan" || h.startsWith("plan-");
  const cur = isPlan ? "mi-plan" : h === "mis-programas" ? "mis-programas" : "tienda";
  $$("[data-nav]").forEach((a) => a.setAttribute("aria-current", a.dataset.nav === cur));
  window.scrollTo(0, 0);
  if (isPlan) { drawPlan.tab = "ejercicios"; return drawPlan(h.startsWith("plan-") ? h.slice(5) : null); }
  if (h === "mis-programas") return drawMine();
  if (h.startsWith("producto-")) return drawProduct(h.slice(9));
  return drawShop();
}
window.addEventListener("hashchange", route);
(async () => { await refresh(); route(); })();
