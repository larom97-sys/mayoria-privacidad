/* Panel de la clínica: biblioteca interna, editor de programas y pacientes.
   Seguimiento y prescripción están en tracking.js; planes y facturación en billing.js. */
let products = [], metrics = {}, patients = [], currentPatient = null, bill = null;
let libFilter = { region: "", path: "", source: "" };
const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const opt = (list, sel) => list.map((x) => '<option value="' + esc(x) + '"' + (x === sel ? " selected" : "") + ">" + esc(x) + "</option>").join("");
const sheetOf = (p) => (Array.isArray(p.product_content) ? p.product_content[0] : p.product_content)?.sheet || {};
const LIB_STATUS = { draft: "Borrador", published: "Disponible", archived: "Archivado" };
const VIEWS = ["seguimiento", "pacientes", "productos", "ajustes"];

/* ------------------------------------------------------------ arranque y sesión */
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  VIEWS.forEach((v) => ($("#v-" + v).hidden = true));
  $("#nav").hidden = true; $("#onboard").hidden = true; $("#banner").hidden = true;
  if (!session) {
    $("#auth").hidden = false;
    return renderAuth($("#auth"), { title: "Panel de la clínica", intro: "Entra con tu cuenta de fisioterapeuta, o crea una para dar de alta tu clínica.", onDone: boot });
  }
  $("#auth").hidden = true;
  const { data: isStaff } = await sb.rpc("claim_clinic");
  if (!isStaff) return drawOnboard();
  $("#nav").hidden = false;
  await refreshBilling();
  await loadProducts();
  show("seguimiento");
}

/* Cuenta sin clínica: darla de alta (14 días de prueba, sin tarjeta) o avisar de que es un paciente. */
function drawOnboard() {
  const host = $("#onboard"); host.hidden = false;
  host.innerHTML = '<div class="panel authbox"><form class="form" id="ob-form"><h2>Da de alta tu clínica</h2>' +
    '<p class="muted">Empiezas con 14 días de prueba gratuita, con todas las funciones y sin tarjeta.</p>' +
    '<label>Nombre de la clínica<input type="text" id="ob-name" required maxlength="80" placeholder="Fisioterapia Ejemplo"></label>' +
    '<p class="err" id="ob-err" hidden></p><button class="pill" type="submit">Crear clínica</button>' +
    '<p class="muted small">¿Tu clínica ya usa la plataforma? Pide a su administrador que te invite con este email y vuelve a entrar. ¿Eres paciente? Tu plan está en el <a href="portal.html">portal de pacientes</a>.</p>' +
    '<button class="tab" type="button" id="ob-out">Salir</button></form></div>';
  $("#ob-out").onclick = async () => { await sb.auth.signOut(); boot(); };
  $("#ob-form").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.rpc("create_clinic", { p_name: $("#ob-name").value });
    if (error) { $("#ob-err").textContent = /verified/.test(error.message) ? "Confirma tu email antes de crear la clínica." : error.message; $("#ob-err").hidden = false; return; }
    boot();
  };
}

function show(view) {
  VIEWS.forEach((v) => ($("#v-" + v).hidden = view !== v));
  $$("#nav [data-view]").forEach((b) => b.setAttribute("aria-current", b.dataset.view === view));
  if (view === "pacientes") loadPatients();
  if (view === "seguimiento") loadTracking();
  if (view === "productos") drawProducts();
  if (view === "ajustes") drawBilling();
}
$$("#nav [data-view]").forEach((b) => (b.onclick = () => show(b.dataset.view)));
$("#logout").onclick = async () => { await sb.auth.signOut(); boot(); };
async function must(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data; }

/* ------------------------------------------------------------ biblioteca clínica */
async function loadProducts() {
  const [{ data, error }, m] = await Promise.all([
    sb.from("infoproducts").select("*, lessons(id,title,kind,file_path,external_url,position), product_content(sheet)").order("title"),
    sb.rpc("product_metrics")
  ]);
  if (error) return toast(error.message, true);
  products = data;
  products.forEach((p) => { p.lessons.sort((a, b) => a.position - b.position); p.sheet = sheetOf(p); });
  metrics = {};
  (m.data || []).forEach((r) => (metrics[r.product_id] = r));
  if (!$("#v-productos").hidden) drawProducts();
}

function drawProducts() {
  const sel = (id, label, list, cur) => "<label>" + label + '<select id="' + id + '"><option value="">Todas</option>' + opt(list, cur) + "</select></label>";
  $("#lib-filters").innerHTML = sel("lf-region", "Localización anatómica", REGIONS, libFilter.region) + sel("lf-path", "Tipo de patología", PATHOLOGIES, libFilter.path) +
    '<label>Origen<select id="lf-source"><option value="">Todas</option><option value="own"' + (libFilter.source === "own" ? " selected" : "") + '>De mi clínica</option><option value="master"' + (libFilter.source === "master" ? " selected" : "") + ">Plantillas maestras</option></select></label>";
  $("#lf-region").onchange = (e) => { libFilter.region = e.target.value; drawProducts(); };
  $("#lf-path").onchange = (e) => { libFilter.path = e.target.value; drawProducts(); };
  $("#lf-source").onchange = (e) => { libFilter.source = e.target.value; drawProducts(); };
  const list = products.filter((p) => (!libFilter.region || p.body_region === libFilter.region) && (!libFilter.path || p.pathology_type === libFilter.path) &&
    (!libFilter.source || (libFilter.source === "master") === p.is_master));
  $("#lib-count").textContent = list.length + (list.length === 1 ? " programa" : " programas");
  if (!list.length) { $("#grid").innerHTML = '<div class="empty" style="grid-column:1/-1">Ningún programa coincide con esos filtros.</div>'; return; }
  $("#grid").innerHTML = list.map((p) => {
    const m = metrics[p.id] || { accesses: 0, viewers: 0 }, nEx = (p.sheet.exercises || []).length;
    return '<article class="card" data-id="' + p.id + '">' + coverBlock(p, p.is_master ? '<span class="chip ok">Plantilla maestra</span>' : '<span class="chip ' + p.status + '">' + LIB_STATUS[p.status] + "</span>") +
      '<div class="body"><span class="muted small">' + esc(p.body_region || "Sin localización") + " · " + esc(p.pathology_type || "Sin tipo") + "</span>" +
      "<h3>" + esc(p.title) + '</h3><span class="muted small">' + nEx + " ejercicios · " + p.lessons.length + " archivos · asignado " + m.accesses + (m.accesses === 1 ? " vez" : " veces") + "</span>" +
      '<div class="actions" style="margin-top:auto;padding-top:14px"><button class="ghost sm on-white" data-act="view">Ver</button>' +
      (p.is_master ? '<button class="pill sm" data-act="dup">Clonar a mi biblioteca</button>'
        : '<button class="ghost sm on-white" data-act="edit">Editar</button><button class="ghost sm on-white" data-act="dup">Duplicar</button>' +
          '<button class="ghost sm on-white" data-act="toggle">' + (p.status === "published" ? "Pasar a borrador" : "Marcar disponible") + "</button>" +
          (p.status !== "archived" ? '<button class="ghost sm on-white" data-act="archive">Archivar</button>' : "") +
          '<button class="danger sm" data-act="del">Eliminar</button>') + "</div></div></article>";
  }).join("");
}
const hasContent = (p) => (p.sheet.exercises || []).length || p.lessons.length || p.sheet.what_is;

$("#grid").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const p = products.find((x) => x.id === btn.closest("[data-id]").dataset.id);
  const act = btn.dataset.act;
  if (act === "view") return previewProduct(p);
  if (act === "edit") return openEditor(p);
  if (act === "dup" && !guardWrite()) return;
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
$("#new-product").onclick = () => guardWrite() && openEditor(null);

function previewProduct(p) {
  rxBody.innerHTML = rxHead(p.title) + '<p class="muted">' + esc(p.description) + "</p>" + renderSheet(p, p.sheet, {});
  wireClose(); rx.showModal();
}

function checkPublishable(p) {
  if (!p.body_region || !p.pathology_type) throw new Error("Indica la localización y el tipo de patología.");
  if (!hasContent(p)) throw new Error("Añade la ficha, algún ejercicio o un archivo antes de marcarlo disponible.");
}

/* Elimina el programa y también sus archivos, para no dejar huérfanos en el almacenamiento. */
async function deleteProduct(p) {
  const files = p.lessons.map((l) => l.file_path).filter(Boolean);
  if (files.length) await must(sb.storage.from("content").remove(files));
  if (p.cover_path) await must(sb.storage.from("covers").remove([p.cover_path]));
  await must(sb.from("infoproducts").delete().eq("id", p.id));
  toast("Programa eliminado.");
}

/* Duplica un programa propio o clona una plantilla maestra a la biblioteca de la clínica, con sus archivos. */
async function duplicateProduct(p) {
  const copy = await must(sb.from("infoproducts").insert({ title: p.is_master ? p.title : p.title + " (copia)", description: p.description, body_region: p.body_region, pathology_type: p.pathology_type, status: "draft" }).select().single());
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
  libFilter = { region: "", path: "", source: "own" };
  toast(p.is_master ? "Clonada a tu biblioteca como borrador. Ya puedes personalizarla." : "Duplicado como borrador.");
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
  const head = '<div class="dlghead"><h2>' + (p ? esc(p.title) : "Nuevo programa") + '</h2><button class="iconbtn" id="ed-close" aria-label="Cerrar" style="background:var(--grey)">✕</button></div>' +
    '<div class="steps">' + STEPS.map((s, i) => "<span" + (ed.step === i + 1 ? ' aria-current="step"' : "") + ">" + (i + 1) + ". " + s + "</span>").join("") + "</div>";
  const foot = (next) => '<div class="dlgfoot"><button class="ghost on-white" type="button" id="ed-back">Atrás</button><button class="pill" type="submit" id="ed-next">' + (next || "Guardar y continuar") + "</button></div>";

  if (ed.step === 1) {
    body.innerHTML = head + '<form class="form" id="ed-form">' +
      '<label>Título<input type="text" id="ed-title" required maxlength="120" value="' + esc(p?.title || "") + '"></label>' +
      '<label>Descripción breve (resumen para el fisio y el paciente)<textarea id="ed-desc" maxlength="400">' + esc(p?.description || "") + "</textarea></label>" +
      '<div class="two"><label>Localización anatómica<select id="ed-region" required><option value="">Elige…</option>' + opt(REGIONS, p?.body_region) + "</select></label>" +
      '<label>Tipo de patología<select id="ed-path" required><option value="">Elige…</option>' + opt(PATHOLOGIES, p?.pathology_type) + "</select></label></div>" +
      '<p class="err" id="ed-err" hidden></p><div class="dlgfoot"><span></span><button class="pill" type="submit">Guardar y continuar</button></div></form>';
    $("#ed-form").onsubmit = async (e) => {
      e.preventDefault();
      const row = { title: $("#ed-title").value.trim(), description: $("#ed-desc").value.trim(), body_region: $("#ed-region").value, pathology_type: $("#ed-path").value, updated_at: new Date().toISOString() };
      try {
        const saved = p ? await must(sb.from("infoproducts").update(row).eq("id", p.id).select().single()) : await must(sb.from("infoproducts").insert(row).select().single());
        ed.p = Object.assign({ lessons: [], sheet: {} }, p, saved);
        go(2);
      } catch (err) { $("#ed-err").textContent = /row-level/.test(err.message) ? "No se puede guardar: la plantilla no es de tu clínica o tu plan está en solo lectura." : err.message; $("#ed-err").hidden = false; }
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
      '<label>Estado<select id="ed-status"><option value="draft">Borrador</option><option value="published">Disponible para asignar</option><option value="archived">Archivado</option></select></label></div>' +
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


/* ------------------------------------------------------------ pacientes */
async function loadPatients() {
  const { data, error } = await sb.from("patients").select("*, patient_programs(id,status)").order("created_at", { ascending: false });
  if (error) return toast(error.message, true);
  patients = data;
  if (currentPatient) currentPatient = patients.find((x) => x.id === currentPatient.id) || null;
  drawPatients();
}

function drawPatients() {
  $("#patient-list").innerHTML = patients.length
    ? '<ul class="list">' + patients.map((p) => { const n = p.patient_programs.filter((g) => g.status === "active").length;
        return '<li><button type="button" data-id="' + p.id + '" aria-current="' + (currentPatient?.id === p.id) + '"><span>' + esc(p.full_name) + (p.code ? ' <span class="muted small">' + esc(p.code) + "</span>" : "") + '</span><span class="muted small">' + n + (n === 1 ? " plan activo" : " planes activos") + "</span></button></li>"; }).join("") + "</ul>"
    : '<p class="muted">Aún no hay pacientes. Da de alta el primero con «Nuevo paciente».</p>';
  $$("#patient-list button").forEach((b) => (b.onclick = () => { currentPatient = patients.find((x) => x.id === b.dataset.id); drawPatients(); }));
  drawPatientCard();
}

$("#new-patient").onclick = () => { if (!guardWrite()) return; currentPatient = null; drawPatients(); drawPatientForm(); };

function drawPatientForm() {
  $("#patient-card").innerHTML = '<form class="form" id="pt-form"><h2>Nuevo paciente</h2>' +
    '<div class="two"><label>Nombre o iniciales<input type="text" id="pt-name" required maxlength="120"></label><label>Código (opcional)<input type="text" id="pt-code" maxlength="20" placeholder="P-003"></label></div>' +
    '<div class="two"><label>Email<input type="email" id="pt-email" required></label><label>Teléfono (con prefijo)<input type="tel" id="pt-phone" placeholder="+34 600 000 000"></label></div>' +
    '<p class="muted small">El paciente entra al portal con este email. Solo verá lo que le asignes.</p>' +
    '<p class="err" id="pt-err" hidden></p><button class="pill" type="submit" style="align-self:flex-start">Guardar paciente</button></form>';
  $("#pt-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      currentPatient = await must(sb.from("patients").insert({ full_name: $("#pt-name").value.trim(), code: $("#pt-code").value.trim() || null, email: $("#pt-email").value.trim().toLowerCase(), phone: $("#pt-phone").value.trim() || null }).select().single());
      loadPatients();
    } catch (err) { $("#pt-err").textContent = /duplicate/.test(err.message) ? "Ya existe un paciente con ese email o código." : /row-level/.test(err.message) ? "Tu plan no permite dar de alta pacientes ahora mismo. Revisa Ajustes." : err.message; $("#pt-err").hidden = false; }
  };
}

function drawPatientCard() {
  const host = $("#patient-card"), p = currentPatient;
  if (!p) { host.innerHTML = '<p class="muted">Elige un paciente para ver su ficha y asignarle programas.</p>'; return; }
  host.innerHTML = '<div class="stack"><div><h2>' + esc(p.full_name) + '</h2><p class="muted small">' + [p.code, p.email, p.phone].filter(Boolean).map(esc).join(" · ") + (p.user_id ? " · ya ha entrado en el portal" : " · aún no ha entrado en el portal") + "</p></div></div>";
  drawPatientPrograms(p, host);
}

