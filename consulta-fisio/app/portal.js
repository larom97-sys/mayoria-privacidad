/* Portal del paciente: escaparate público y área privada «Mis programas». */
const view = $("#view");
let session = null, catalog = [], mine = [], doneIds = new Set(), afterLogin = null;
const SIGNED_SECONDS = 3600; // las URL firmadas de vídeos y PDF caducan en una hora

async function refreshSession() {
  session = (await sb.auth.getSession()).data.session;
  $("#session").textContent = session ? "Salir" : "Entrar";
  if (session) {
    const name = session.user.user_metadata?.name || null;
    const { error } = await sb.rpc("ensure_patient", { p_name: name });
    if (error) toast("No hemos podido abrir tu ficha: " + error.message, true);
  }
}
$("#session").onclick = async () => {
  if (session) { await sb.auth.signOut(); mine = []; doneIds = new Set(); await refreshSession(); location.hash = "#tienda"; route(); }
  else { afterLogin = "#mis-programas"; drawLogin(); }
};

async function loadMine() {
  if (!session) { mine = []; doneIds = new Set(); return; }
  const [a, d] = await Promise.all([
    sb.from("accesses").select("method, acquired_at, infoproducts(id,title,description,category,cover_path, lessons(id,title,kind,file_path,external_url,position))").order("acquired_at", { ascending: false }),
    sb.from("lesson_progress").select("lesson_id")
  ]);
  mine = (a.data || []).filter((x) => x.infoproducts).map((x) => { x.infoproducts.lessons.sort((p, q) => p.position - q.position); return x; });
  doneIds = new Set((d.data || []).map((x) => x.lesson_id));
}
const owns = (id) => mine.some((a) => a.infoproducts.id === id);

function drawLogin() {
  renderAuth(view, { title: "Tu cuenta", intro: "Entra o crea tu cuenta para ver y conseguir tus programas.", askName: true, onDone: async () => {
    await refreshSession(); await loadMine();
    const next = afterLogin || "#mis-programas"; afterLogin = null;
    if (location.hash === next) route(); else location.hash = next;
  } });
}

/* ------------------------------------------------------------ tienda */
async function drawShop(focusId) {
  const { data, error } = await sb.rpc("catalog");
  if (error) { view.innerHTML = '<div class="empty">No se ha podido cargar la tienda.</div>'; return; }
  catalog = data;
  const cats = ["Todos", ...new Set(catalog.map((p) => p.category).filter(Boolean))];
  let current = "Todos";
  const draw = () => {
    const list = catalog.filter((p) => current === "Todos" || p.category === current);
    view.innerHTML = '<div class="pagehead"><div><h1>Programas y guías</h1><p class="muted">Ejercicios en vídeo, guías y cursos para seguir tu tratamiento en casa.</p></div></div>' +
      (cats.length > 2 ? '<div class="actions" style="margin-bottom:24px">' + cats.map((c, i) => '<button class="tab" type="button" id="cat-' + i + '" aria-current="' + (c === current) + '" data-cat="' + esc(c) + '" style="background:' + (c === current ? "" : "var(--white)") + '">' + esc(c) + "</button>").join("") + "</div>" : "") +
      (list.length ? '<div class="grid">' + list.map((p) =>
        '<article class="card hover" id="producto-' + p.id + '"><div class="cover"' + coverStyle(p.cover_path) + "></div>" +
        '<div class="body"><span class="muted small">' + esc(p.category || "Programa") + " · " + p.lesson_count + (p.lesson_count === 1 ? " lección" : " lecciones") + "</span><h3>" + esc(p.title) + '</h3><p class="muted">' + esc(p.description) + "</p>" +
        '<div class="row"><span class="amt">' + euros(p.price_cents) + '</span><button class="pill sm" type="button" data-get="' + p.id + '">' + (owns(p.id) ? "Abrir" : p.price_cents ? "Comprar" : "Conseguir gratis") + "</button></div></div></article>").join("") + "</div>"
        : '<div class="empty">Pronto habrá programas disponibles.</div>') +
      '<p class="muted small" style="text-align:center;margin-top:32px">Estos programas no sustituyen a la valoración de tu fisioterapeuta.</p>';
    $$("[data-cat]", view).forEach((b) => (b.onclick = () => { current = b.dataset.cat; draw(); }));
    $$("[data-get]", view).forEach((b) => (b.onclick = () => getProduct(b.dataset.get, b)));
  };
  draw();
  if (focusId) document.getElementById("producto-" + focusId)?.scrollIntoView({ block: "center" });
}

async function getProduct(id, btn) {
  if (owns(id)) { location.hash = "#programa-" + id; return; }
  if (!session) { afterLogin = "#producto-" + id; return drawLogin(); }
  const p = catalog.find((x) => x.id === id);
  btn.disabled = true;
  if (!p.price_cents) {
    const { error } = await sb.rpc("claim_free_product", { p_product: id });
    if (error) { btn.disabled = false; return toast("No se ha podido añadir: " + error.message, true); }
    await loadMine(); location.hash = "#programa-" + id; return;
  }
  const { data, error } = await sb.functions.invoke("create-checkout", { body: { product_id: id, return_url: location.href.split("#")[0] + "#mis-programas" } });
  if (error || !data?.url) {
    btn.disabled = false;
    return toast("El pago online todavía no está activado. Pide el acceso en tu clínica.", true);
  }
  location.href = data.url;
}

/* ------------------------------------------------------------ mis programas */
function drawMine() {
  if (!session) { afterLogin = "#mis-programas"; return drawLogin(); }
  view.innerHTML = '<div class="pagehead"><h1>Mis programas</h1></div>' + (mine.length ? '<div class="grid">' + mine.map((a) => {
    const p = a.infoproducts, n = p.lessons.length, d = p.lessons.filter((l) => doneIds.has(l.id)).length;
    return '<a class="card hover" href="#programa-' + p.id + '" style="text-decoration:none;color:inherit"><div class="cover"' + coverStyle(p.cover_path) + "></div>" +
      '<div class="body"><span class="muted small">' + esc(p.category || "Programa") + " · " + METHOD_LABEL[a.method] + "</span><h3>" + esc(p.title) + "</h3>" +
      '<div class="progress" style="margin-top:auto"><i style="width:' + (n ? Math.round((d / n) * 100) : 0) + '%"></i></div><span class="muted small">' + d + " de " + n + " completadas</span></div></a>";
  }).join("") + "</div>" : '<div class="empty">Todavía no tienes programas. <a href="#tienda">Ver la tienda</a></div>');
}

async function drawProgram(id, lessonId) {
  if (!session) { afterLogin = "#programa-" + id; return drawLogin(); }
  const acc = mine.find((a) => a.infoproducts.id === id);
  if (!acc) { location.hash = "#producto-" + id; return; }
  const p = acc.infoproducts;
  const lesson = p.lessons.find((l) => l.id === lessonId) || p.lessons.find((l) => !doneIds.has(l.id)) || p.lessons[0];
  const d = p.lessons.filter((l) => doneIds.has(l.id)).length;
  view.innerHTML = '<p class="small" style="margin-bottom:12px"><a href="#mis-programas">‹ Mis programas</a></p><div class="pagehead"><div><h1>' + esc(p.title) + '</h1><p class="muted">' + esc(p.description) + "</p></div></div>" +
    '<div class="player"><div class="panel"><div class="progress"><i style="width:' + (p.lessons.length ? Math.round((d / p.lessons.length) * 100) : 0) + '%"></i></div><p class="muted small" style="margin:8px 0 12px">' + d + " de " + p.lessons.length + " completadas</p>" +
    '<ul class="lessonlist">' + p.lessons.map((l) => '<li><input type="checkbox" id="done-' + l.id + '" data-done="' + l.id + '" aria-label="Completada: ' + esc(l.title) + '"' + (doneIds.has(l.id) ? " checked" : "") + '><button type="button" data-open="' + l.id + '" aria-current="' + (lesson && l.id === lesson.id) + '">' + esc(l.title) + ' <span class="muted small">· ' + KIND_LABEL[l.kind].split(" ")[0] + "</span></button></li>").join("") + "</ul></div>" +
    '<div class="panel stagebox stack" id="stage">' + (lesson ? "" : '<p class="muted">Este programa aún no tiene contenido.</p>') + "</div></div>";
  $$("[data-open]", view).forEach((b) => (b.onclick = () => drawProgram(id, b.dataset.open)));
  $$("[data-done]", view).forEach((c) => (c.onchange = () => setDone(c.dataset.done, c.checked, id, lesson?.id)));
  if (lesson) drawLesson(lesson, id);
}

async function setDone(lessonId, done, productId, openId) {
  const { data: pid } = await sb.rpc("ensure_patient", { p_name: null });
  const q = done ? sb.from("lesson_progress").upsert({ patient_id: pid, lesson_id: lessonId }) : sb.from("lesson_progress").delete().eq("patient_id", pid).eq("lesson_id", lessonId);
  const { error } = await q;
  if (error) toast("No se ha podido guardar el progreso.", true);
  else done ? doneIds.add(lessonId) : doneIds.delete(lessonId);
  drawProgram(productId, openId);
}

async function drawLesson(l, productId) {
  const stage = $("#stage");
  const foot = '<div class="actions"><button class="' + (doneIds.has(l.id) ? "ghost on-white" : "pill") + '" type="button" id="mark">' + (doneIds.has(l.id) ? "Marcar como pendiente" : "Marcar como completada") + "</button></div>";
  let html = "<h2>" + esc(l.title) + "</h2>";
  if (l.kind === "video" || l.kind === "pdf") {
    const opts = l.kind === "pdf" ? { download: l.file_path.split("/").pop().replace(/^[0-9a-f-]{36}-/, "") } : undefined;
    const { data, error } = await sb.storage.from("content").createSignedUrl(l.file_path, SIGNED_SECONDS, opts);
    if (error) { stage.innerHTML = html + '<p class="err">No se ha podido abrir este archivo.</p>'; return; }
    html += l.kind === "video"
      ? '<div class="frame"><video controls playsinline preload="metadata" src="' + esc(data.signedUrl) + '"></video></div>'
      : '<p class="muted">Guía en PDF. El enlace de descarga es personal y caduca en una hora.</p><div class="actions"><a class="pill" href="' + esc(data.signedUrl) + '">Descargar PDF</a></div>';
  } else if (l.kind === "embed") {
    const src = embedSrc(l.external_url);
    html += src ? '<div class="frame"><iframe src="' + esc(src) + '" title="' + esc(l.title) + '" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' : '<p class="err">Este vídeo no se puede mostrar.</p>';
  } else {
    html += isHttps(l.external_url) ? '<div class="actions"><a class="pill" target="_blank" rel="noopener" href="' + esc(l.external_url) + '">Abrir enlace</a></div>' : "";
  }
  stage.innerHTML = html + foot;
  $("#mark").onclick = () => setDone(l.id, !doneIds.has(l.id), productId, l.id);
}

/* ------------------------------------------------------------ rutas */
function route() {
  const h = location.hash.slice(1) || "tienda";
  $$("[data-nav]").forEach((a) => a.setAttribute("aria-current", h.startsWith(a.dataset.nav) || (a.dataset.nav === "mis-programas" && h.startsWith("programa-")) || (a.dataset.nav === "tienda" && h.startsWith("producto-"))));
  if (h === "mis-programas") return drawMine();
  if (h.startsWith("programa-")) return drawProgram(h.slice(9));
  return drawShop(h.startsWith("producto-") ? h.slice(9) : null);
}
window.addEventListener("hashchange", route);
(async () => { await refreshSession(); await loadMine(); route(); })();
