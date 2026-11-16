/* Panel de la clínica: catálogo, editor (datos, portada, ficha, ejercicios, archivos), pacientes y asignaciones. */
let products = [], metrics = {}, business = null, settings = null, patients = [], currentPatient = null;
const portalLink = (productId) => new URL("portal.html", location.href).href.split("#")[0] + "#producto-" + productId;
const money = (cents) => (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const opt = (list, sel) => list.map((x) => '<option value="' + esc(x) + '"' + (x === sel ? " selected" : "") + ">" + esc(x) + "</option>").join("");
const sheetOf = (p) => (Array.isArray(p.product_content) ? p.product_content[0] : p.product_content)?.sheet || {};

/* ------------------------------------------------------------ arranque y sesión */
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  ["v-productos", "v-pacientes", "denied"].forEach((id) => ($("#" + id).hidden = true));
  $("#nav").hidden = true;
  if (!session) {
    $("#auth").hidden = false;
    return renderAuth($("#auth"), { title: "Panel de la clínica", intro: "Entra con la cuenta que gestiona la clínica. La primera cuenta que se crea queda como administradora.", onDone: boot });
  }
  $("#auth").hidden = true;
  const { data: isStaff, error } = await sb.rpc("claim_clinic");
  if (error || !isStaff) { $("#denied").hidden = false; $("#nav").hidden = false; $$("#nav [data-view]").forEach((b) => (b.hidden = true)); return; }
  $("#nav").hidden = false;
  $$("#nav [data-view]").forEach((b) => (b.hidden = false));
  await loadProducts();
  show("productos");
}
function show(view) {
  $("#v-productos").hidden = view !== "productos";
  $("#v-pacientes").hidden = view !== "pacientes";
  $$("#nav [data-view]").forEach((b) => b.setAttribute("aria-current", b.dataset.view === view));
  if (view === "pacientes") loadPatients();
}
$$("#nav [data-view]").forEach((b) => (b.onclick = () => show(b.dataset.view)));
$("#logout").onclick = async () => { await sb.auth.signOut(); boot(); };
async function must(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data; }

/* ------------------------------------------------------------ catálogo y métricas */
async function loadProducts() {
  const [{ data, error }, m, b, s] = await Promise.all([
    sb.from("infoproducts").select("*, lessons(id,title,kind,file_path,external_url,position), product_content(sheet)").order("created_at", { ascending: false }),
    sb.rpc("product_metrics"), sb.rpc("business_metrics"), sb.from("settings").select("*").single()
  ]);
  if (error) return toast(error.message, true);
  products = data;
  products.forEach((p) => { p.lessons.sort((a, b) => a.position - b.position); p.sheet = sheetOf(p); });
  metrics = {};
  (m.data || []).forEach((r) => (metrics[r.product_id] = r));
  business = (b.data || [])[0] || { active_subscriptions: 0, monthly_recurring_cents: 0, subscription_revenue_cents: 0 };
  settings = s.data;
  drawProducts();
}

function drawProducts() {
  const all = Object.values(metrics);
  const sales = all.reduce((s, r) => s + r.sales, 0), revenue = all.reduce((s, r) => s + Number(r.revenue_cents), 0);
  const acc = all.reduce((s, r) => s + r.accesses, 0), viewers = all.reduce((s, r) => s + r.viewers, 0);
  $("#stats").innerHTML =
    '<div class="panel"><span class="muted small">Ventas individuales</span><b>' + sales + '</b><span class="muted small">' + money(revenue) + " ingresados</span></div>" +
    '<div class="panel"><span class="muted small">Suscripciones activas</span><b>' + business.active_subscriptions + '</b><span class="muted small">' + money(Number(business.monthly_recurring_cents)) + " al mes</span></div>" +
    '<div class="panel"><span class="muted small">Tasa de visualización</span><b>' + (acc ? Math.round((viewers / acc) * 100) + " %" : "—") + '</b><span class="muted small">' + viewers + " de " + acc + " accesos han empezado</span></div>";
  $("#plan").innerHTML = '<form class="panel" id="plan-form" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:24px">' +
    '<label style="flex:1 1 200px">Nombre de la suscripción<input type="text" id="plan-name" required maxlength="40" value="' + esc(settings?.subscription_name || "") + '"></label>' +
    '<label style="flex:1 1 160px">Precio mensual en €<input type="number" id="plan-price" min="0.5" step="0.01" required value="' + ((settings?.subscription_price_cents || 1499) / 100) + '"></label>' +
    '<button class="ghost on-white" type="submit">Guardar tarifa</button></form>';
  $("#plan-form").onsubmit = async (e) => {
    e.preventDefault();
    try { await must(sb.from("settings").update({ subscription_name: $("#plan-name").value.trim(), subscription_price_cents: Math.round(parseFloat($("#plan-price").value) * 100) }).eq("id", true)); toast("Tarifa guardada. Se aplica a las suscripciones nuevas."); }
    catch (err) { toast(err.message, true); }
  };
  if (!products.length) {
    $("#grid").innerHTML = '<div class="empty stack" style="grid-column:1/-1;align-items:center"><p>Aún no hay infoproductos.</p><button class="pill" id="seed">Cargar catálogo inicial (' + SEED_PRODUCTS.length + " programas)</button></div>";
    $("#seed").onclick = runSeed;
    return;
  }
  $("#grid").innerHTML = products.map((p) => {
    const m = metrics[p.id] || { accesses: 0, sales: 0, viewers: 0 }, nEx = (p.sheet.exercises || []).length;
    return '<article class="card" data-id="' + p.id + '">' + coverBlock(p, '<span class="chip ' + p.status + '">' + STATUS_LABEL[p.status] + "</span>") +
      '<div class="body"><span class="muted small">' + esc(p.body_region || "Sin localización") + " · " + esc(p.pathology_type || "Sin tipo") + "</span>" +
      "<h3>" + esc(p.title) + '</h3><span class="muted small">' + nEx + " ejercicios · " + p.lessons.length + " archivos · " + m.accesses + " accesos · " + m.sales + " ventas</span>" +
      '<div class="row"><span class="amt">' + euros(p.price_cents) + "</span></div>" +
      '<div class="actions">' +
      '<button class="ghost sm on-white" data-act="edit">Editar</button>' +
      '<button class="ghost sm on-white" data-act="dup">Duplicar</button>' +
      '<button class="ghost sm on-white" data-act="toggle">' + (p.status === "published" ? "Pasar a borrador" : "Publicar") + "</button>" +
      (p.status !== "archived" ? '<button class="ghost sm on-white" data-act="archive">Archivar</button>' : "") +
      '<button class="danger sm" data-act="del">Eliminar</button></div></div></article>';
  }).join("");
}
const hasContent = (p) => (p.sheet.exercises || []).length || p.lessons.length;

$("#grid").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const p = products.find((x) => x.id === btn.closest("[data-id]").dataset.id);
  const act = btn.dataset.act;
  if (act === "edit") return openEditor(p);
  if (act === "del" && btn.dataset.armed !== "1") { btn.dataset.armed = "1"; btn.textContent = "¿Seguro? Eliminar"; return; }
  btn.disabled = true;
  try {
    if (act === "toggle") {
      if (p.status !== "published") checkPublishable(p);
      await must(sb.from("infoproducts").update({ status: p.status === "published" ? "draft" : "published", updated_at: new Date().toISOString() }).eq("id", p.id));
    }
    if (act === "archive") await must(sb.from("infoproducts").update({ status: "archived" }).eq("id", p.id));
    if (act === "dup") await duplicateProduct(p);
    if (act === "del") await deleteProduct(p);
    await loadProducts();
  } catch (err) { toast(err.message, true); btn.disabled = false; }
});
$("#new-product").onclick = () => openEditor(null);

function checkPublishable(p) {
  if (!p.body_region || !p.pathology_type) throw new Error("Indica la localización y el tipo de patología antes de publicar.");
  if (!hasContent(p)) throw new Error("Añade al menos un ejercicio o un archivo antes de publicar.");
}

/* Elimina el producto y también sus archivos, para no dejar huérfanos en el almacenamiento. */
async function deleteProduct(p) {
  const files = p.lessons.map((l) => l.file_path).filter(Boolean);
  if (files.length) await must(sb.storage.from("content").remove(files));
  if (p.cover_path) await must(sb.storage.from("covers").remove([p.cover_path]));
  await must(sb.from("infoproducts").delete().eq("id", p.id));
  toast("Infoproducto eliminado.");
}

async function duplicateProduct(p) {
  const copy = await must(sb.from("infoproducts").insert({ title: p.title + " (copia)", description: p.description, body_region: p.body_region, pathology_type: p.pathology_type, price_cents: p.price_cents, status: "draft" }).select().single());
  await must(sb.from("product_content").insert({ product_id: copy.id, sheet: p.sheet }));
  if (p.cover_path) {
    const to = copy.id + "/" + crypto.randomUUID() + "." + extOf(p.cover_path);
    await must(sb.storage.from("covers").copy(p.cover_path, to));
    await must(sb.from("infoproducts").update({ cover_path: to }).eq("id", copy.id));
  }
  for (const l of p.lessons) {
    let file_path = null;
    if (l.file_path) {
      file_path = copy.id + "/" + crypto.randomUUID() + "-" + l.file_path.split("/").pop().replace(/^[0-9a-f-]{36}-/, "");
      await must(sb.storage.from("content").copy(l.file_path, file_path));
    }
    await must(sb.from("lessons").insert({ product_id: copy.id, title: l.title, kind: l.kind, file_path, external_url: l.external_url, position: l.position }));
  }
  toast("Duplicado como borrador.");
}

/* Carga el catálogo inicial (seed-data.js) y lo deja publicado. Solo se ofrece con el catálogo vacío. */
async function runSeed() {
  const btn = $("#seed"); btn.disabled = true;
  try {
    for (let i = 0; i < SEED_PRODUCTS.length; i++) {
      const s = SEED_PRODUCTS[i];
      btn.textContent = "Cargando " + (i + 1) + " de " + SEED_PRODUCTS.length + "…";
      const row = await must(sb.from("infoproducts").insert({ title: s.title, description: s.description, body_region: s.body_region, pathology_type: s.pathology_type, price_cents: s.price_cents, status: "draft" }).select().single());
      await must(sb.from("product_content").insert({ product_id: row.id, sheet: s.sheet }));
      await must(sb.from("infoproducts").update({ status: "published" }).eq("id", row.id));
    }
    toast("Catálogo inicial cargado y publicado.");
  } catch (err) { toast(err.message, true); }
  loadProducts();
}

/* ------------------------------------------------------------ editor paso a paso */
const dlg = $("#editor"), body = $("#editor-body");
const STEPS = ["Datos", "Portada", "Ficha clínica", "Ejercicios", "Archivos"];
let ed = null;
function openEditor(p) {
  ed = { p: p ? JSON.parse(JSON.stringify(p)) : null, step: 1 };
  drawEditor();
  dlg.showModal();
}
dlg.addEventListener("close", loadProducts);
const go = (n) => { ed.step = n; drawEditor(); body.scrollIntoView(); };
async function saveSheet() {
  await must(sb.from("product_content").upsert({ product_id: ed.p.id, sheet: ed.p.sheet, updated_at: new Date().toISOString() }));
}

function drawEditor() {
  const p = ed.p;
  const head = '<div class="dlghead"><h2>' + (p ? esc(p.title) : "Nuevo infoproducto") + '</h2><button class="iconbtn" id="ed-close" aria-label="Cerrar" style="background:var(--grey)">✕</button></div>' +
    '<div class="steps">' + STEPS.map((s, i) => "<span" + (ed.step === i + 1 ? ' aria-current="step"' : "") + ">" + (i + 1) + ". " + s + "</span>").join("") + "</div>";
  const foot = (next) => '<div class="dlgfoot"><button class="ghost on-white" type="button" id="ed-back">Atrás</button><button class="pill" type="submit" id="ed-next">' + (next || "Guardar y continuar") + "</button></div>";

  if (ed.step === 1) {
    body.innerHTML = head + '<form class="form" id="ed-form">' +
      '<label>Título<input type="text" id="ed-title" required maxlength="120" value="' + esc(p?.title || "") + '"></label>' +
      '<label>Descripción breve (visible en la tienda)<textarea id="ed-desc" maxlength="400">' + esc(p?.description || "") + "</textarea></label>" +
      '<div class="two"><label>Localización anatómica<select id="ed-region" required><option value="">Elige…</option>' + opt(REGIONS, p?.body_region) + "</select></label>" +
      '<label>Tipo de patología<select id="ed-path" required><option value="">Elige…</option>' + opt(PATHOLOGIES, p?.pathology_type) + "</select></label></div>" +
      '<label>Precio de compra individual en € (0 = gratuito)<input type="number" id="ed-price" min="0" step="0.01" inputmode="decimal" required value="' + ((p?.price_cents || 0) / 100) + '"></label>' +
      '<p class="err" id="ed-err" hidden></p><div class="dlgfoot"><span></span><button class="pill" type="submit">Guardar y continuar</button></div></form>';
    $("#ed-form").onsubmit = async (e) => {
      e.preventDefault();
      const row = { title: $("#ed-title").value.trim(), description: $("#ed-desc").value.trim(), body_region: $("#ed-region").value, pathology_type: $("#ed-path").value, price_cents: Math.round(parseFloat($("#ed-price").value || "0") * 100), updated_at: new Date().toISOString() };
      try {
        const saved = p ? await must(sb.from("infoproducts").update(row).eq("id", p.id).select().single()) : await must(sb.from("infoproducts").insert(row).select().single());
        ed.p = Object.assign({ lessons: [], sheet: {} }, p, saved);
        go(2);
      } catch (err) { $("#ed-err").textContent = err.message; $("#ed-err").hidden = false; }
    };
  }

  if (ed.step === 2) {
    body.innerHTML = head + '<div class="stack"><div class="coverprev" id="ed-cover"' + coverStyle(p.cover_path) + '></div><div id="ed-up"></div>' +
      (p.cover_path ? '<button class="ghost sm on-white" id="ed-rmcover" style="align-self:flex-start">Quitar portada</button>' : '<p class="muted small">Sin portada se muestra una tarjeta con la localización.</p>') +
      "</div>" + foot("Continuar");
    uploader($("#ed-up"), "cover", (f) => p.id + "/" + crypto.randomUUID() + "." + extOf(f.name), async (path) => {
      const old = p.cover_path;
      await must(sb.from("infoproducts").update({ cover_path: path }).eq("id", p.id));
      if (old) await sb.storage.from("covers").remove([old]);
      p.cover_path = path; drawEditor();
    });
    if (p.cover_path) $("#ed-rmcover").onclick = async () => {
      await sb.storage.from("covers").remove([p.cover_path]);
      await must(sb.from("infoproducts").update({ cover_path: null }).eq("id", p.id));
      p.cover_path = null; drawEditor();
    };
    $("#ed-back").onclick = () => go(1);
    $("#ed-next").onclick = () => go(3);
  }

  if (ed.step === 3) {
    const s = p.sheet, ph = (s.phases || []).concat([{}, {}, {}]).slice(0, 3);
    body.innerHTML = head + '<form class="form" id="sh-form">' +
      '<label>¿Qué es la lesión?<textarea id="sh-what" style="min-height:130px" maxlength="1500">' + esc(s.what_is || "") + "</textarea></label>" +
      '<label>Evolución habitual<input type="text" id="sh-dur" maxlength="120" placeholder="de 6 a 12 semanas" value="' + esc(s.duration || "") + '"></label>' +
      ph.map((x, i) => '<fieldset class="exed" style="border:0;margin:0"><legend class="small" style="font-weight:600;padding-top:10px">Fase ' + (i + 1) + '</legend><div class="form"><div class="two">' +
        '<label>Nombre<input type="text" id="ph-name-' + i + '" maxlength="60" value="' + esc(x.name || "") + '"></label>' +
        '<label>Tiempo aproximado<input type="text" id="ph-weeks-' + i + '" maxlength="60" placeholder="Semanas 1–3" value="' + esc(x.weeks || "") + '"></label></div>' +
        '<label>Objetivos (uno por línea)<textarea id="ph-goals-' + i + '">' + esc((x.goals || []).join("\n")) + "</textarea></label></div></fieldset>").join("") +
      '<label>Banderas rojas (una por línea)<textarea id="sh-flags">' + esc((s.red_flags || []).join("\n")) + "</textarea></label>" +
      '<label>Claves del tratamiento (una por línea)<textarea id="sh-advice">' + esc((s.advice || []).join("\n")) + "</textarea></label>" +
      '<label>Referencias (una por línea)<textarea id="sh-src">' + esc((s.sources || []).join("\n")) + "</textarea></label>" + foot() + "</form>";
    $("#ed-back").onclick = () => go(2);
    $("#sh-form").onsubmit = async (e) => {
      e.preventDefault();
      Object.assign(s, { what_is: $("#sh-what").value.trim(), duration: $("#sh-dur").value.trim(), red_flags: lines($("#sh-flags").value), advice: lines($("#sh-advice").value), sources: lines($("#sh-src").value),
        phases: [0, 1, 2].map((i) => ({ name: $("#ph-name-" + i).value.trim(), weeks: $("#ph-weeks-" + i).value.trim(), goals: lines($("#ph-goals-" + i).value) })).filter((x) => x.name) });
      try { await saveSheet(); go(4); } catch (err) { toast(err.message, true); }
    };
  }

  if (ed.step === 4) {
    const s = p.sheet; s.exercises = s.exercises || [];
    const poseOpts = (sel, none) => (none ? '<option value="">(sin segunda postura)</option>' : "") + Object.keys(POSES).map((k) => '<option value="' + k + '"' + (k === sel ? " selected" : "") + ">" + esc(POSES[k].label) + "</option>").join("");
    body.innerHTML = head + '<form class="form" id="ex-form"><p class="muted small">Cada ejercicio muestra un diagrama generado a partir de la postura inicial y final. El vídeo es opcional.</p>' +
      s.exercises.map((x, i) => '<details class="exed" data-i="' + i + '"' + (ed.openEx === i ? " open" : "") + "><summary>" + (i + 1) + ". " + esc(x.name || "Ejercicio nuevo") + '</summary><div class="form">' +
        '<div class="two"><label>Nombre<input type="text" data-f="name" required maxlength="100" value="' + esc(x.name || "") + '"></label>' +
        '<label>Fase<select data-f="phase">' + [1, 2, 3].map((n) => '<option value="' + n + '"' + (Number(x.phase) === n ? " selected" : "") + ">Fase " + n + "</option>").join("") + "</select></label></div>" +
        '<label>Objetivo clínico<input type="text" data-f="goal" maxlength="200" value="' + esc(x.goal || "") + '"></label>' +
        '<div class="two"><label>Series<input type="text" data-f="sets" maxlength="40" value="' + esc(x.sets || "") + '"></label><label>Repeticiones<input type="text" data-f="reps" maxlength="80" value="' + esc(x.reps || "") + '"></label></div>' +
        '<div class="two"><label>Descanso<input type="text" data-f="rest" maxlength="40" value="' + esc(x.rest || "") + '"></label><label>Dolor permitido<input type="text" data-f="pain" maxlength="60" value="' + esc(x.pain || "≤ 3/10 y que ceda en 24 h") + '"></label></div>' +
        '<label>Errores a evitar (uno por línea)<textarea data-f="errors">' + esc((x.errors || []).join("\n")) + "</textarea></label>" +
        '<div class="two"><label>Postura inicial<select data-f="pose0">' + poseOpts((x.pose || [])[0] || "stand") + '</select></label><label>Postura final<select data-f="pose1">' + poseOpts((x.pose || [])[1] || "", true) + "</select></label></div>" +
        '<label>Vídeo de YouTube o Vimeo (opcional)<input type="url" data-f="video" placeholder="https://" value="' + esc(x.video || "") + '"></label>' +
        '<div class="actions"><button class="ghost sm" type="button" data-mv="-1"' + (i === 0 ? " disabled" : "") + '>Subir</button><button class="ghost sm" type="button" data-mv="1"' + (i === s.exercises.length - 1 ? " disabled" : "") + '>Bajar</button><button class="danger sm" type="button" data-rm>Quitar ejercicio</button></div>' +
        "</div></details>").join("") +
      '<button class="ghost on-white" type="button" id="ex-add" style="align-self:flex-start">Añadir ejercicio</button><p class="err" id="ex-err" hidden></p>' + foot() + "</form>";
    const collect = () => {
      let bad = null;
      $$("#ex-form details").forEach((d) => {
        const x = s.exercises[Number(d.dataset.i)], v = (f) => $('[data-f="' + f + '"]', d).value.trim();
        Object.assign(x, { name: v("name"), phase: Number(v("phase")), goal: v("goal"), sets: v("sets"), reps: v("reps"), rest: v("rest"), pain: v("pain"), errors: lines(v("errors")), pose: [v("pose0"), v("pose1")].filter(Boolean), video: v("video") });
        if (!x.key) x.key = "ex-" + Math.random().toString(36).slice(2, 9);
        if (x.video && !embedSrc(x.video)) bad = "El vídeo de «" + x.name + "» no es un enlace reconocido de YouTube o Vimeo.";
        if (!x.name) bad = "Hay un ejercicio sin nombre.";
      });
      return bad;
    };
    $("#ex-add").onclick = () => { collect(); s.exercises.push({ phase: 1, pose: ["stand"] }); ed.openEx = s.exercises.length - 1; drawEditor(); };
    $("#ex-form").onclick = (e) => {
      const d = e.target.closest("details"); if (!d) return;
      const i = Number(d.dataset.i), mv = e.target.closest("[data-mv]");
      if (mv) { collect(); const j = i + Number(mv.dataset.mv); [s.exercises[i], s.exercises[j]] = [s.exercises[j], s.exercises[i]]; ed.openEx = j; drawEditor(); }
      if (e.target.closest("[data-rm]")) { collect(); s.exercises.splice(i, 1); ed.openEx = null; drawEditor(); }
    };
    $("#ed-back").onclick = () => { collect(); go(3); };
    $("#ex-form").onsubmit = async (e) => {
      e.preventDefault();
      const bad = collect();
      if (bad) { $("#ex-err").textContent = bad; $("#ex-err").hidden = false; return; }
      try { await saveSheet(); go(5); } catch (err) { toast(err.message, true); }
    };
  }

  if (ed.step === 5) {
    body.innerHTML = head +
      '<div class="stack"><div><h3>Archivos y vídeos propios</h3><p class="muted small">PDF descargables y vídeos subidos o enlazados. Solo los ve quien tiene acceso. Arrastra para ordenar.</p></div>' +
      (p.lessons.length ? '<ul class="lessons" id="ed-lessons">' + p.lessons.map((l, i) =>
        '<li draggable="true" data-id="' + l.id + '"><span class="grip" aria-hidden="true">⠿</span><span class="chip">' + KIND_LABEL[l.kind] + '</span><span class="t">' + esc(l.title) + "</span>" +
        '<button class="iconbtn" data-mv="-1" aria-label="Subir"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
        '<button class="iconbtn" data-mv="1" aria-label="Bajar"' + (i === p.lessons.length - 1 ? " disabled" : "") + ">↓</button>" +
        '<button class="iconbtn" data-rm aria-label="Eliminar archivo">✕</button></li>').join("") + "</ul>"
        : '<p class="muted">Todavía no hay archivos.</p>') +
      '<div class="panel stack" style="background:var(--grey)"><h3>Añadir archivo o vídeo</h3>' +
      '<div class="two"><label>Título<input type="text" id="ls-title" maxlength="120" placeholder="Guía de ejercicios en PDF"></label>' +
      '<label>Tipo<select id="ls-kind"><option value="pdf">PDF (subir archivo)</option><option value="video">Vídeo (subir archivo)</option><option value="embed">Vídeo por enlace (YouTube, Vimeo, Mux)</option><option value="link">Enlace externo</option></select></label></div>' +
      '<div id="ls-input"></div></div>' +
      '<label>Estado<select id="ed-status"><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label></div>' +
      '<div class="dlgfoot"><button class="ghost on-white" id="ed-back">Atrás</button><button class="pill" id="ed-done">Guardar y cerrar</button></div>';
    $("#ed-status").value = p.status;
    $("#ls-kind").value = ed.kind || "pdf";
    $("#ls-title").value = ed.title || "";
    $("#ls-title").oninput = () => (ed.title = $("#ls-title").value);
    drawLessonInput();
    $("#ls-kind").onchange = () => { ed.kind = $("#ls-kind").value; drawLessonInput(); };
    $("#ed-back").onclick = () => go(4);
    $("#ed-done").onclick = async () => {
      const status = $("#ed-status").value;
      try {
        if (status === "published") checkPublishable(p);
        await must(sb.from("infoproducts").update({ status, updated_at: new Date().toISOString() }).eq("id", p.id)); dlg.close();
      } catch (err) { toast(err.message, true); }
    };
    wireLessons();
  }
  $("#ed-close").onclick = () => dlg.close();
}

function drawLessonInput() {
  const p = ed.p, kind = $("#ls-kind").value, host = $("#ls-input");
  const add = async (fields, fallbackTitle) => {
    const title = $("#ls-title").value.trim() || fallbackTitle;
    const row = await must(sb.from("lessons").insert(Object.assign({ product_id: p.id, title, kind, position: p.lessons.length }, fields)).select().single());
    p.lessons.push(row); ed.title = ""; drawEditor();
  };
  if (kind === "video" || kind === "pdf") {
    uploader(host, kind, (f) => p.id + "/" + crypto.randomUUID() + "-" + safeName(f.name), async (path, file) => {
      try { await add({ file_path: path }, file.name.replace(/\.[^.]+$/, "")); }
      catch (err) { await sb.storage.from("content").remove([path]); throw err; }
    });
  } else {
    host.innerHTML = '<form class="form" id="ls-form"><label>' + (kind === "embed" ? "Enlace del vídeo (https)" : "Enlace (https)") + '<input type="url" id="ls-url" required placeholder="https://"></label><p class="err" id="ls-err" hidden></p><button class="pill" type="submit" style="align-self:flex-start">Añadir</button></form>';
    $("#ls-form").onsubmit = async (e) => {
      e.preventDefault();
      const url = $("#ls-url").value.trim(), err = $("#ls-err");
      const bad = kind === "embed" ? !embedSrc(url) && "No reconozco ese enlace. Usa uno de YouTube, Vimeo o Mux." : !isHttps(url) && "El enlace debe empezar por https://";
      if (bad) { err.textContent = bad; err.hidden = false; return; }
      try { await add({ external_url: url }, kind === "embed" ? "Vídeo" : "Enlace"); } catch (x) { err.textContent = x.message; err.hidden = false; }
    };
  }
}

function wireLessons() {
  const list = $("#ed-lessons"), p = ed.p;
  if (!list) return;
  const persist = async () => {
    p.lessons.forEach((l, i) => (l.position = i));
    drawEditor();
    try { await Promise.all(p.lessons.map((l) => must(sb.from("lessons").update({ position: l.position }).eq("id", l.id)))); } catch (err) { toast(err.message, true); }
  };
  list.onclick = async (e) => {
    const li = e.target.closest("li"); if (!li) return;
    const i = p.lessons.findIndex((l) => l.id === li.dataset.id);
    const mv = e.target.closest("[data-mv]");
    if (mv) { const j = i + Number(mv.dataset.mv); [p.lessons[i], p.lessons[j]] = [p.lessons[j], p.lessons[i]]; return persist(); }
    if (e.target.closest("[data-rm]")) {
      const l = p.lessons[i];
      try {
        await must(sb.from("lessons").delete().eq("id", l.id));
        if (l.file_path) await sb.storage.from("content").remove([l.file_path]);
        p.lessons.splice(i, 1); persist();
      } catch (err) { toast(err.message, true); }
    }
  };
  let dragId = null;
  list.addEventListener("dragstart", (e) => { const li = e.target.closest("li"); dragId = li.dataset.id; li.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
  list.addEventListener("dragend", () => $$("li", list).forEach((li) => li.classList.remove("dragging")));
  list.addEventListener("dragover", (e) => e.preventDefault());
  list.addEventListener("drop", (e) => {
    e.preventDefault();
    const over = e.target.closest("li"); if (!over || !dragId || over.dataset.id === dragId) return;
    const from = p.lessons.findIndex((l) => l.id === dragId), to = p.lessons.findIndex((l) => l.id === over.dataset.id);
    p.lessons.splice(to, 0, p.lessons.splice(from, 1)[0]);
    persist();
  });
}

/* ------------------------------------------------------------ pacientes y asignación */
async function loadPatients() {
  const { data, error } = await sb.from("patients").select("*, accesses(id,method,acquired_at,product_id), subscriptions(status,current_period_end,cancel_at_period_end)").order("created_at", { ascending: false });
  if (error) return toast(error.message, true);
  patients = data;
  patients.forEach((p) => { const s = Array.isArray(p.subscriptions) ? p.subscriptions[0] : p.subscriptions; p.sub = s && ["active", "trialing"].includes(s.status) && (!s.current_period_end || new Date(s.current_period_end) > new Date()) ? s : null; });
  if (currentPatient) currentPatient = patients.find((x) => x.id === currentPatient.id) || null;
  drawPatients();
}

function drawPatients() {
  $("#patient-list").innerHTML = patients.length
    ? '<ul class="list">' + patients.map((p) => '<li><button type="button" data-id="' + p.id + '" aria-current="' + (currentPatient?.id === p.id) + '"><span>' + esc(p.full_name) + (p.code ? ' <span class="muted small">' + esc(p.code) + "</span>" : "") + '</span><span class="muted small">' + (p.sub ? "Suscrito" : p.accesses.length + " programas") + "</span></button></li>").join("") + "</ul>"
    : '<p class="muted">Aún no hay pacientes. Los que se registren en el portal aparecerán aquí.</p>';
  $$("#patient-list button").forEach((b) => (b.onclick = () => { currentPatient = patients.find((x) => x.id === b.dataset.id); drawPatients(); }));
  drawPatientCard();
}

$("#new-patient").onclick = () => { currentPatient = null; drawPatients(); drawPatientForm(); };

function drawPatientForm() {
  $("#patient-card").innerHTML = '<form class="form" id="pt-form"><h2>Nuevo paciente</h2>' +
    '<div class="two"><label>Nombre o iniciales<input type="text" id="pt-name" required maxlength="120"></label><label>Código (opcional)<input type="text" id="pt-code" maxlength="20" placeholder="P-003"></label></div>' +
    '<div class="two"><label>Email<input type="email" id="pt-email"></label><label>Teléfono (con prefijo)<input type="tel" id="pt-phone" placeholder="+34 600 000 000"></label></div>' +
    '<p class="muted small">Con el email, el paciente verá sus programas al registrarse en el portal con esa misma dirección.</p>' +
    '<p class="err" id="pt-err" hidden></p><button class="pill" type="submit" style="align-self:flex-start">Guardar paciente</button></form>';
  $("#pt-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      currentPatient = await must(sb.from("patients").insert({ full_name: $("#pt-name").value.trim(), code: $("#pt-code").value.trim() || null, email: $("#pt-email").value.trim().toLowerCase() || null, phone: $("#pt-phone").value.trim() || null }).select().single());
      loadPatients();
    } catch (err) { $("#pt-err").textContent = /duplicate/.test(err.message) ? "Ya existe un paciente con ese email o código." : err.message; $("#pt-err").hidden = false; }
  };
}

async function drawPatientCard() {
  const host = $("#patient-card"), p = currentPatient;
  if (!p) { host.innerHTML = '<p class="muted">Elige un paciente para ver su ficha y asignarle programas.</p>'; return; }
  const [{ data: doneL }, { data: doneE }] = await Promise.all([
    sb.from("lesson_progress").select("lesson_id").eq("patient_id", p.id),
    sb.from("exercise_progress").select("product_id,exercise_key").eq("patient_id", p.id)
  ]);
  if (currentPatient !== p) return;
  const lessonDone = new Set((doneL || []).map((d) => d.lesson_id));
  const owned = new Set(p.accesses.map((a) => a.product_id));
  const assignable = products.filter((x) => !owned.has(x.id) && x.status !== "archived");
  const shareable = products.filter((x) => x.status === "published");
  host.innerHTML = '<div class="stack"><div><h2>' + esc(p.full_name) + '</h2><p class="muted small">' + [p.code, p.email, p.phone].filter(Boolean).map(esc).join(" · ") + (p.user_id ? " · con cuenta en el portal" : " · sin cuenta en el portal todavía") + "</p>" +
    (p.sub ? '<p style="margin-top:8px"><span class="chip ok">Suscripción activa</span> <span class="muted small">' + (p.sub.current_period_end ? (p.sub.cancel_at_period_end ? "termina el " : "se renueva el ") + new Date(p.sub.current_period_end).toLocaleDateString("es-ES") : "") + "</span></p>" : "") + "</div>" +
    '<div class="actions"><button class="pill" id="pt-assign"' + (assignable.length ? "" : " disabled") + '>Asignar infoproducto</button><button class="ghost on-white" id="pt-share"' + (shareable.length ? "" : " disabled") + ">Enviar enlace de compra</button></div>" +
    '<div id="pt-action"></div>' +
    "<div><h3>Programas asignados o comprados</h3>" + (p.accesses.length ? '<div class="rows">' + p.accesses.map((a) => {
      const prod = products.find((x) => x.id === a.product_id); if (!prod) return "";
      const ex = prod.sheet.exercises || [], total = ex.length + prod.lessons.length;
      const d = (doneE || []).filter((x) => x.product_id === prod.id && ex.some((e) => e.key === x.exercise_key)).length + prod.lessons.filter((l) => lessonDone.has(l.id)).length;
      return '<div><span><b>' + esc(prod.title) + '</b><br><span class="muted small">' + METHOD_LABEL[a.method] + " · " + new Date(a.acquired_at).toLocaleDateString("es-ES") + " · " + d + " de " + total + " completados</span></span>" +
        '<button class="ghost sm on-white" data-revoke="' + a.id + '">Retirar acceso</button></div>';
    }).join("") + "</div>" : '<p class="muted">Sin programas asignados.</p>') + "</div></div>";

  $("#pt-assign").onclick = () => {
    $("#pt-action").innerHTML = '<form class="form panel" id="as-form" style="background:var(--grey)"><h3>Asignar infoproducto</h3><div class="two">' +
      '<label>Infoproducto<select id="as-product">' + assignable.map((x) => '<option value="' + x.id + '">' + esc(x.title) + (x.status === "draft" ? " (borrador)" : "") + "</option>").join("") + "</select></label>" +
      '<label>Cómo lo obtiene<select id="as-method"><option value="assigned">Asignado gratis en consulta</option><option value="bono">Incluido en bono</option></select></label></div>' +
      '<button class="pill" type="submit" style="align-self:flex-start">Dar acceso</button></form>';
    $("#as-form").onsubmit = async (e) => {
      e.preventDefault();
      try { await must(sb.from("accesses").insert({ patient_id: p.id, product_id: $("#as-product").value, method: $("#as-method").value })); toast("Acceso concedido."); loadPatients(); }
      catch (err) { toast(err.message, true); }
    };
  };
  $("#pt-share").onclick = () => {
    const draw = () => {
      const prod = shareable.find((x) => x.id === $("#sh-product").value), link = portalLink(prod.id);
      const text = "Hola" + (p.full_name ? " " + p.full_name.split(" ")[0] : "") + ", te recomiendo este programa: " + prod.title + ". " + link;
      const phone = (p.phone || "").replace(/\D/g, "");
      $("#sh-links").innerHTML =
        '<a class="ghost on-white sm" target="_blank" rel="noopener" href="https://wa.me/' + phone + "?text=" + encodeURIComponent(text) + '">WhatsApp</a>' +
        '<a class="ghost on-white sm" href="mailto:' + encodeURIComponent(p.email || "") + "?subject=" + encodeURIComponent(prod.title) + "&body=" + encodeURIComponent(text) + '">Email</a>' +
        '<button class="ghost on-white sm" type="button" id="sh-copy">Copiar enlace</button>';
      $("#sh-copy").onclick = () => navigator.clipboard.writeText(link).then(() => toast("Enlace copiado."), () => toast(link));
    };
    $("#pt-action").innerHTML = '<div class="form panel" style="background:var(--grey)"><h3>Enviar enlace de compra</h3><label>Infoproducto<select id="sh-product">' + shareable.map((x) => '<option value="' + x.id + '">' + esc(x.title) + " · " + euros(x.price_cents) + '</option>').join("") + '</select></label><div class="actions" id="sh-links"></div></div>';
    $("#sh-product").onchange = draw; draw();
  };
  $$("[data-revoke]", host).forEach((b) => (b.onclick = async () => {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "¿Seguro? Retirar"; return; }
    try { await must(sb.from("accesses").delete().eq("id", b.dataset.revoke)); loadPatients(); } catch (err) { toast(err.message, true); }
  }));
}

boot();
