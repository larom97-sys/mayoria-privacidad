/* Taxonomía clínica, diagramas de ejercicio generados por código y render de la ficha de patología.
   Compartido por el panel (vista previa) y el portal del paciente. */
const REGIONS = ["Columna cervical", "Columna dorsal/lumbar", "Hombro", "Codo/muñeca", "Cadera/pelvis", "Rodilla", "Tobillo/pie", "Suelo pélvico"];
const PATHOLOGIES = ["Tendinopatías", "Lesiones musculares", "Lesiones ligamentosas/articulares", "Dolor neuropático/radicular", "Readaptación postquirúrgica", "Prevención y ergonomía"];

/* Posturas esquemáticas en vista lateral (lienzo 200×140, suelo en y=125).
   Puntos: head, sh (hombro), hip, knee, foot, elbow, hand; "2" = extremidad del otro lado. */
const POSES = {
  stand:      { label: "De pie", head: [100, 24], sh: [100, 38], hip: [100, 72], knee: [100, 98], foot: [100, 125], elbow: [102, 56], hand: [104, 72] },
  squat:      { label: "Sentadilla", head: [108, 45], sh: [104, 58], hip: [90, 90], knee: [116, 102], foot: [102, 125], elbow: [118, 66], hand: [132, 62] },
  wallsit:    { label: "Sentadilla isométrica en pared", head: [84, 48], sh: [84, 62], hip: [84, 98], knee: [110, 98], foot: [110, 125], elbow: [90, 80], hand: [100, 92], props: [["wall", 78]] },
  chairsit:   { label: "Sentado", head: [96, 44], sh: [96, 58], hip: [96, 92], knee: [120, 92], foot: [120, 125], elbow: [102, 76], hand: [114, 88], props: [["chair", 86, 110, 94]] },
  chintuck:   { label: "Sentado, mentón atrás", head: [91, 44], sh: [96, 58], hip: [96, 92], knee: [120, 92], foot: [120, 125], elbow: [102, 76], hand: [114, 88], props: [["chair", 86, 110, 94], ["arrow", 112, 44, 100, 44]] },
  kneeext:    { label: "Sentado, rodilla extendida", head: [96, 44], sh: [96, 58], hip: [96, 92], knee: [120, 92], foot: [148, 90], elbow: [100, 76], hand: [104, 92], knee2: [120, 92], foot2: [120, 125], props: [["chair", 86, 110, 94]] },
  splitsquat: { label: "Zancada", head: [100, 44], sh: [100, 58], hip: [100, 92], knee: [122, 100], foot: [122, 125], knee2: [92, 116], foot2: [72, 122], elbow: [101, 76], hand: [103, 90] },
  stepdown:   { label: "Descenso desde escalón", head: [104, 33], sh: [102, 46], hip: [96, 76], knee: [110, 92], foot: [100, 110], knee2: [106, 98], foot2: [120, 122], elbow: [108, 60], hand: [114, 72], props: [["box", 84, 112, 110]] },
  heellow:    { label: "Talones abajo en escalón", head: [100, 22], sh: [100, 36], hip: [100, 70], knee: [100, 96], foot: [100, 121], elbow: [110, 48], hand: [124, 42], props: [["box", 84, 106, 114], ["wall", 128]] },
  heelhigh:   { label: "Talones arriba en escalón", head: [100, 12], sh: [100, 26], hip: [100, 60], knee: [100, 86], foot: [100, 110], elbow: [110, 38], hand: [124, 34], props: [["box", 84, 106, 114], ["wall", 128]] },
  calfstretch:{ label: "Estiramiento de gemelo en pared", head: [114, 37], sh: [110, 50], hip: [98, 82], knee: [84, 104], foot: [70, 125], knee2: [112, 104], foot2: [112, 125], elbow: [124, 56], hand: [138, 52], props: [["wall", 142]] },
  hooklying:  { label: "Tumbado, rodillas flexionadas", head: [52, 116], sh: [64, 116], hip: [100, 116], knee: [122, 94], foot: [138, 125], elbow: [80, 121], hand: [92, 110] },
  bridge:     { label: "Puente de glúteo", head: [52, 116], sh: [64, 116], hip: [100, 94], knee: [124, 96], foot: [134, 125], elbow: [80, 121], hand: [94, 122] },
  bridge1:    { label: "Puente a una pierna", head: [52, 116], sh: [64, 116], hip: [100, 94], knee: [124, 96], foot: [134, 125], knee2: [128, 84], foot2: [154, 76], elbow: [80, 121], hand: [94, 122] },
  bridgeslide:{ label: "Puente con talones alejados", head: [52, 116], sh: [64, 116], hip: [100, 100], knee: [130, 106], foot: [152, 124], elbow: [80, 121], hand: [94, 122] },
  hinge:      { label: "Bisagra de cadera", head: [134, 56], sh: [122, 62], hip: [90, 78], knee: [104, 100], foot: [100, 125], elbow: [122, 80], hand: [122, 98], props: [["weight"]] },
  plank:      { label: "Plancha", head: [58, 94], sh: [70, 100], hip: [108, 104], knee: [132, 112], foot: [152, 122], elbow: [70, 122], hand: [86, 122] },
  quadruped:  { label: "Cuadrupedia", head: [58, 88], sh: [70, 92], hip: [118, 92], knee: [118, 125], foot: [142, 125], elbow: [70, 108], hand: [70, 125] },
  catflex:    { label: "Cuadrupedia, espalda redondeada", head: [60, 100], sh: [72, 90], hip: [116, 90], knee: [118, 125], foot: [142, 125], elbow: [71, 108], hand: [70, 125], props: [["curve", 72, 90, 94, 70, 116, 90]] },
  birddog:    { label: "Brazo y pierna contrarios", head: [58, 88], sh: [70, 92], hip: [118, 92], knee: [118, 125], foot: [142, 125], elbow: [70, 108], hand: [70, 125], elbow2: [54, 89], hand2: [38, 86], knee2: [142, 92], foot2: [166, 92] },
  sidelying:  { label: "Tumbado de lado", head: [50, 110], sh: [64, 114], hip: [104, 114], knee: [128, 118], foot: [152, 122], elbow: [80, 118], hand: [90, 112] },
  sideabd:    { label: "De lado, pierna elevada", head: [50, 110], sh: [64, 114], hip: [104, 114], knee: [128, 118], foot: [152, 122], knee2: [128, 104], foot2: [152, 94], elbow: [80, 118], hand: [90, 112] },
  sideer:     { label: "De lado, rotación externa", head: [50, 108], sh: [64, 112], hip: [104, 114], knee: [128, 118], foot: [152, 122], elbow: [82, 110], hand: [82, 92], props: [["weight"]] },
  armdown:    { label: "De pie, brazo abajo", head: [100, 24], sh: [100, 38], hip: [100, 72], knee: [100, 98], foot: [100, 125], elbow: [103, 56], hand: [106, 73], props: [["weight"]] },
  armraise:   { label: "Elevación de brazo", head: [100, 24], sh: [100, 38], hip: [100, 72], knee: [100, 98], foot: [100, 125], elbow: [114, 28], hand: [128, 18], props: [["weight"]] },
  rowstart:   { label: "Remo con goma, inicio", head: [100, 24], sh: [100, 38], hip: [100, 72], knee: [100, 98], foot: [100, 125], elbow: [112, 54], hand: [126, 58], props: [["band", 160, 58]] },
  rowend:     { label: "Remo con goma, final", head: [100, 24], sh: [100, 38], hip: [100, 72], knee: [100, 98], foot: [100, 125], elbow: [86, 56], hand: [104, 58], props: [["band", 160, 58]] },
  wallslide:  { label: "Deslizamiento en pared", head: [100, 24], sh: [100, 38], hip: [98, 72], knee: [98, 98], foot: [96, 125], elbow: [118, 34], hand: [124, 16], props: [["wall", 128]] },
  wallpush:   { label: "Antebrazos en pared", head: [100, 24], sh: [100, 38], hip: [98, 72], knee: [98, 98], foot: [96, 125], elbow: [122, 46], hand: [124, 30], props: [["wall", 128]] },
  balance:    { label: "Equilibrio a una pierna", head: [100, 24], sh: [100, 38], hip: [100, 72], knee: [100, 98], foot: [100, 125], knee2: [114, 94], foot2: [106, 110], elbow: [114, 50], hand: [128, 58] },
  kneewall:   { label: "Rodilla a la pared", head: [106, 40], sh: [104, 54], hip: [98, 86], knee: [124, 100], foot: [112, 125], knee2: [86, 108], foot2: [70, 125], elbow: [116, 62], hand: [130, 58], props: [["wall", 132]] },
  stride:     { label: "Marcha / carrera suave", head: [104, 26], sh: [102, 40], hip: [100, 74], knee: [110, 100], foot: [112, 125], knee2: [92, 100], foot2: [78, 116], elbow: [110, 54], hand: [120, 62], elbow2: [94, 56], hand2: [86, 66] },
  hop:        { label: "Salto y recepción", head: [106, 30], sh: [103, 44], hip: [96, 76], knee: [110, 96], foot: [102, 116], elbow: [112, 56], hand: [124, 50], props: [["arrow", 140, 100, 140, 80]] }
};

function figure(key, dx) {
  const p = POSES[key] || POSES.stand, o = (pt) => (pt[0] + dx) + "," + pt[1];
  const line = (a, b, cls) => a && b ? '<line x1="' + (a[0] + dx) + '" y1="' + a[1] + '" x2="' + (b[0] + dx) + '" y2="' + b[1] + '" class="' + cls + '"/>' : "";
  const foot = (f, k, cls) => f && k && Math.abs(f[1] - k[1]) > Math.abs(f[0] - k[0]) && f[1] > k[1] ? '<line x1="' + (f[0] + dx) + '" y1="' + f[1] + '" x2="' + (f[0] + dx + 9) + '" y2="' + f[1] + '" class="' + cls + '"/>' : "";
  let s = "";
  (p.props || []).forEach((r) => {
    if (r[0] === "wall") s += '<line x1="' + (r[1] + dx) + '" y1="6" x2="' + (r[1] + dx) + '" y2="125" class="prop"/>';
    if (r[0] === "box") s += '<rect x="' + (r[1] + dx) + '" y="' + r[3] + '" width="' + (r[2] - r[1]) + '" height="' + (125 - r[3]) + '" rx="2" class="propfill"/>';
    if (r[0] === "chair") s += '<path d="M' + (r[1] + dx) + " " + r[3] + "H" + (r[2] + dx) + "M" + (r[1] + dx + 2) + " " + r[3] + "V125M" + (r[2] + dx - 2) + " " + r[3] + 'V125" class="prop" fill="none"/>';
    if (r[0] === "band") s += '<line x1="' + (p.hand[0] + dx) + '" y1="' + p.hand[1] + '" x2="' + (r[1] + dx) + '" y2="' + r[2] + '" class="band"/><line x1="' + (r[1] + dx) + '" y1="20" x2="' + (r[1] + dx) + '" y2="125" class="prop"/>';
    if (r[0] === "arrow") s += '<path d="M' + (r[1] + dx) + " " + r[2] + "L" + (r[3] + dx) + " " + r[4] + '" class="band" marker-end="url(#ah)"/>';
    if (r[0] === "curve") s += '<path d="M' + (r[1] + dx) + " " + r[2] + "Q" + (r[3] + dx) + " " + r[4] + " " + (r[5] + dx) + " " + r[6] + '" class="limb" fill="none"/>';
  });
  const curved = (p.props || []).some((r) => r[0] === "curve");
  s += line(p.hip, p.knee2, "far") + line(p.knee2, p.foot2, "far") + foot(p.foot2, p.knee2 || p.hip, "far") + line(p.sh, p.elbow2, "far") + line(p.elbow2, p.hand2, "far");
  s += (curved ? "" : line(p.sh, p.hip, "limb")) + line(p.hip, p.knee, "limb") + line(p.knee, p.foot, "limb") + foot(p.foot, p.knee, "limb");
  s += line(p.sh, p.elbow, "limb") + line(p.elbow, p.hand, "limb");
  s += '<circle cx="' + (p.head[0] + dx) + '" cy="' + p.head[1] + '" r="8" class="head"/>';
  if ((p.props || []).some((r) => r[0] === "weight")) s += '<circle cx="' + (p.hand[0] + dx) + '" cy="' + p.hand[1] + '" r="5" class="weight"/>';
  return s;
}

/* Diagrama de un ejercicio: una o dos posturas (inicio → final). */
function poseSvg(keys, title) {
  const list = (keys || []).filter((k) => POSES[k]).slice(0, 2);
  if (!list.length) list.push("stand");
  const w = list.length === 2 ? 400 : 200;
  return '<svg class="pose" viewBox="0 0 ' + w + ' 140" role="img" aria-label="' + esc(title || "Diagrama del ejercicio") + '">' +
    '<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" class="weight"/></marker></defs>' +
    '<line x1="8" y1="125" x2="' + (w - 8) + '" y2="125" class="floor"/>' +
    list.map((k, i) => figure(k, i * 200) + (list.length === 2 ? '<text x="' + (i * 200 + 12) + '" y="16" class="cap">' + (i ? "Final" : "Inicio") + "</text>" : "")).join("") +
    (list.length === 2 ? '<path d="M190 70H210" class="band" marker-end="url(#ah)"/>' : "") + "</svg>";
}

/* Ficha de patología + protocolo. opts.done: Set de claves completadas; opts.interactive: muestra casillas. */
function renderSheet(product, sheet, opts) {
  opts = opts || {};
  const done = opts.done || new Set(), ex = sheet.exercises || [], phases = sheet.phases || [];
  const li = (arr) => (arr || []).map((x) => "<li>" + esc(x) + "</li>").join("");
  let h = '<article class="sheet">';
  h += '<section class="panel"><p class="tags"><span class="chip">' + esc(product.body_region || "") + '</span> <span class="chip">' + esc(product.pathology_type || "") + "</span></p>" +
    "<h2>¿Qué es?</h2><p>" + esc(sheet.what_is || "") + "</p>" + (sheet.duration ? '<p class="muted small" style="margin-top:10px">Evolución habitual: ' + esc(sheet.duration) + "</p>" : "") + "</section>";
  if (phases.length) h += '<section class="panel"><h2>Fases y evolución estimada</h2><ol class="phases">' + phases.map((p, i) =>
    '<li><span class="phn">Fase ' + (i + 1) + '</span><h3>' + esc(p.name) + '</h3><p class="when">' + esc(p.weeks) + "</p><ul>" + li(p.goals) + "</ul></li>").join("") + "</ol>" +
    '<p class="muted small">Los plazos son orientativos: cada persona progresa a su ritmo y manda el criterio de tu fisioterapeuta.</p></section>';
  h += '<section class="panel light"><h2>Regla del semáforo</h2><div class="lights">' +
    '<div><i class="g"></i><b>0–3 / 10</b><span>Molestia aceptable. Continúa.</span></div>' +
    '<div><i class="a"></i><b>4–5 / 10</b><span>Reduce carga, repeticiones o recorrido.</span></div>' +
    '<div><i class="r"></i><b>Más de 5 / 10</b><span>Para ese ejercicio hoy.</span></div></div>' +
    '<p class="muted small">La molestia debe volver a su nivel habitual en menos de 24 horas. Si no, la próxima sesión baja la carga.</p></section>';
  if ((sheet.red_flags || []).length) h += '<section class="panel flags"><h2>Banderas rojas</h2><p>Detén los ejercicios y consulta con un profesional sanitario si aparece cualquiera de estas señales:</p><ul>' + li(sheet.red_flags) + "</ul></section>";
  if ((sheet.advice || []).length) h += '<section class="panel"><h2>Claves del tratamiento</h2><ul>' + li(sheet.advice) + "</ul></section>";
  if (ex.length) {
    h += '<section><h2 class="sech">Protocolo de ejercicios</h2>' + (opts.interactive ? '<div class="progress" style="margin:10px 0 6px"><i style="width:' + Math.round((ex.filter((e) => done.has(e.key)).length / ex.length) * 100) + '%"></i></div><p class="muted small noprint">' + ex.filter((e) => done.has(e.key)).length + " de " + ex.length + " ejercicios completados hoy</p>" : "") + '<div class="exlist">' +
      ex.map((e, i) => {
        const src = e.video ? embedSrc(e.video) : null;
        return '<article class="panel ex"><div class="exfig">' + poseSvg(e.pose, e.name) + "</div><div class=\"exbody\">" +
          '<p class="muted small">Ejercicio ' + (i + 1) + (e.phase ? " · Fase " + esc(e.phase) : "") + "</p><h3>" + esc(e.name) + "</h3><p>" + esc(e.goal || "") + "</p>" +
          '<dl class="dose"><div><dt>Series</dt><dd>' + esc(e.sets || "—") + "</dd></div><div><dt>Repeticiones</dt><dd>" + esc(e.reps || "—") + "</dd></div><div><dt>Descanso</dt><dd>" + esc(e.rest || "—") + "</dd></div><div><dt>Dolor permitido</dt><dd>" + esc(e.pain || "≤ 3/10") + "</dd></div></dl>" +
          ((e.errors || []).length ? '<p class="small" style="font-weight:600;margin-top:10px">Errores a evitar</p><ul class="small">' + li(e.errors) + "</ul>" : "") +
          (src ? '<div class="frame noprint" style="margin-top:14px"><iframe src="' + esc(src) + '" title="' + esc(e.name) + '" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' : "") +
          (opts.interactive ? '<label class="check noprint"><input type="checkbox" id="ex-' + esc(e.key) + '" data-ex="' + esc(e.key) + '"' + (done.has(e.key) ? " checked" : "") + "> Hecho</label>" : "") +
          "</div></article>";
      }).join("") + "</div></section>";
  }
  if ((sheet.sources || []).length) h += '<section class="panel"><h2>Referencias</h2><ul class="small muted">' + li(sheet.sources) + "</ul></section>";
  h += '<p class="muted small disclaimer">Material educativo. No sustituye la valoración individual de tu fisioterapeuta ni un diagnóstico médico.</p></article>';
  return h;
}

/* Portada: la imagen subida o, si no hay, una tarjeta tipográfica con la localización. */
function coverBlock(p, inner) {
  return p.cover_path
    ? '<div class="cover"' + coverStyle(p.cover_path) + ">" + (inner || "") + "</div>"
    : '<div class="cover auto" style="flex-direction:column;align-items:flex-start;justify-content:space-between">' + (inner || "<span></span>") + "<span>" + esc(p.body_region || "Programa") + "</span></div>";
}
