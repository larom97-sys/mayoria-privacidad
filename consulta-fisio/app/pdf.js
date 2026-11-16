/* PDF generados en el navegador del fisio (pdfkit): infografía con rutina e informe de evolución.
   Si se pide, el archivo va cifrado con AES-256 y se abre con el DNI/NIE del paciente.
   Aviso: un DNI es una contraseña corta y predecible. Protege frente a un envío al contacto equivocado
   o un móvil compartido, no frente a alguien decidido a probar combinaciones. */
const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const normDni = (s) => (s || "").toUpperCase().replace(/[\s.\-]/g, "");
function validDni(v) {
  const m = /^([0-9]{8}|[XYZ][0-9]{7})([A-Z])$/.exec(v);
  return !!m && DNI_LETTERS[Number(m[1].replace("X", "0").replace("Y", "1").replace("Z", "2")) % 23] === m[2];
}
const PDF_INK = "#1D1D1F", PDF_MUTED = "#6E6E73", PDF_ACCENT = "#0066CC", PDF_BAD = "#A83A32", PDF_LINE = "#D2D2D7", PDF_FILL = "#F5F5F7";
/* Las fuentes estándar del PDF no tienen ≤, ≥ ni flechas: se sustituyen por texto. */
const T = (s) => String(s ?? "").replace(/≤\s*/g, "hasta ").replace(/≥\s*/g, "desde ").replace(/→/g, "a").replace(/[‐-‒―]/g, "-");

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("No se ha podido cargar el generador de PDF.")); document.head.appendChild(s); });
}
async function newPdf(title, password) {
  if (!window.PDFDocument) await loadScript("vendor/pdfkit.js");
  const opts = { size: "A4", margin: 48, info: { Title: title, Creator: "Mi rehabilitación" } };
  if (password) Object.assign(opts, { userPassword: password, ownerPassword: crypto.randomUUID(), pdfVersion: "1.7ext3", permissions: { printing: "highResolution" } });
  const doc = new PDFDocument(opts), chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((r) => doc.on("end", () => r(new Blob(chunks, { type: "application/pdf" }))));
  const W = doc.page.width - 96;
  const room = (h) => { if (doc.y + h > doc.page.height - 56) doc.addPage(); };
  const api = {
    doc, done, W, room,
    h1: (t, sub) => { doc.font("Helvetica-Bold").fontSize(20).fillColor(PDF_INK).text(T(t), { width: W }); if (sub) doc.font("Helvetica").fontSize(10).fillColor(PDF_MUTED).text(T(sub), { width: W }); doc.moveDown(0.8); },
    h2: (t) => { room(60); doc.moveDown(0.6).font("Helvetica-Bold").fontSize(13).fillColor(PDF_INK).text(T(t), { width: W }).moveDown(0.3); },
    p: (t, color) => { doc.font("Helvetica").fontSize(10.5).fillColor(color || PDF_INK).text(T(t), { width: W, lineGap: 2 }); },
    small: (t) => { doc.font("Helvetica").fontSize(9).fillColor(PDF_MUTED).text(T(t), { width: W, lineGap: 1.5 }); },
    list: (items, color) => { (items || []).forEach((x) => { room(18); doc.font("Helvetica").fontSize(10.5).fillColor(color || PDF_INK).text("•  " + T(x), { width: W - 8, indent: 0, lineGap: 2 }); }); }
  };
  return api;
}

/* Diagrama de un ejercicio con las mismas posturas que la pantalla (POSES en clinical.js), a escala. */
function pdfPose(doc, keys, x, y) {
  const s = 0.42, list = (keys || []).filter((k) => POSES[k]).slice(0, 2);
  if (!list.length) list.push("stand");
  const w = 200 * s * list.length;
  doc.save().roundedRect(x, y, w, 140 * s, 6).fill(PDF_FILL);
  list.forEach((k, i) => {
    const p = POSES[k], ox = x + i * 200 * s, P = (pt) => [ox + pt[0] * s, y + pt[1] * s];
    const line = (a, b, color) => { if (a && b) doc.moveTo(...P(a)).lineTo(...P(b)).lineWidth(2.2).lineCap("round").stroke(color); };
    doc.moveTo(ox + 8 * s, y + 125 * s).lineTo(ox + 192 * s, y + 125 * s).lineWidth(0.8).stroke(PDF_LINE);
    (p.props || []).forEach((r) => {
      if (r[0] === "wall") doc.moveTo(ox + r[1] * s, y + 8 * s).lineTo(ox + r[1] * s, y + 125 * s).lineWidth(0.8).stroke(PDF_LINE);
      if (r[0] === "box") doc.rect(ox + r[1] * s, y + r[3] * s, (r[2] - r[1]) * s, (125 - r[3]) * s).fill(PDF_LINE);
    });
    line(p.hip, p.knee2, "#A9A9B2"); line(p.knee2, p.foot2, "#A9A9B2"); line(p.sh, p.elbow2, "#A9A9B2"); line(p.elbow2, p.hand2, "#A9A9B2");
    line(p.sh, p.hip, PDF_INK); line(p.hip, p.knee, PDF_INK); line(p.knee, p.foot, PDF_INK); line(p.sh, p.elbow, PDF_INK); line(p.elbow, p.hand, PDF_INK);
    doc.circle(...P(p.head), 8 * s).fill(PDF_INK);
  });
  doc.restore();
  return { w, h: 140 * s };
}

/* Infografía de la lesión + rutina. exercises: los del plan del paciente si los hay, o los de la plantilla. */
async function buildSheetPdf(o) {
  const k = await newPdf(o.title, o.password), doc = k.doc, sheet = o.sheet || {};
  k.small(o.clinic + (o.patient ? "  ·  " + o.patient : ""));
  k.h1(o.title, [o.region, o.pathology].filter(Boolean).join(" · "));
  if (sheet.what_is) { k.h2("¿Qué es?"); k.p(sheet.what_is); if (sheet.duration) { doc.moveDown(0.3); k.small("Evolución habitual: " + sheet.duration); } }
  if ((sheet.phases || []).length) {
    k.h2("Fases y evolución estimada");
    sheet.phases.forEach((ph, i) => { k.room(50); doc.font("Helvetica-Bold").fontSize(10.5).fillColor(PDF_ACCENT).text("Fase " + (i + 1) + "  ", { continued: true }).fillColor(PDF_INK).text(T(ph.name) + (ph.weeks ? "  ·  " + T(ph.weeks) : "")); k.list(ph.goals, PDF_MUTED); doc.moveDown(0.3); });
    k.small("Los plazos son orientativos: manda el criterio de tu fisioterapeuta.");
  }
  k.h2("Regla del semáforo");
  k.list(["0-3 / 10: molestia aceptable, continúa.", "4-5 / 10: reduce carga, repeticiones o recorrido.", "Más de 5 / 10: para ese ejercicio hoy."]);
  k.small("La molestia debe volver a su nivel habitual en menos de 24 horas.");
  if ((sheet.red_flags || []).length) { k.h2("Banderas rojas: detén los ejercicios y consulta"); k.list(sheet.red_flags, PDF_BAD); }
  if ((sheet.advice || []).length) { k.h2("Claves del tratamiento"); k.list(sheet.advice); }
  const ex = o.exercises || [];
  if (ex.length) {
    k.h2("Tu rutina de ejercicios");
    if (o.notes) { k.p("Pautas de tu fisio: " + o.notes, PDF_ACCENT); doc.moveDown(0.5); }
    ex.forEach((e, i) => {
      k.room(110);
      const y0 = doc.y, fig = pdfPose(doc, e.pose, 48, y0), tx = 48 + fig.w + 14, tw = k.W - fig.w - 14;
      doc.font("Helvetica-Bold").fontSize(11).fillColor(PDF_INK).text((i + 1) + ". " + T(e.name), tx, y0, { width: tw });
      if (e.goal) doc.font("Helvetica").fontSize(9.5).fillColor(PDF_MUTED).text(T(e.goal), tx, doc.y, { width: tw });
      doc.font("Helvetica").fontSize(9.5).fillColor(PDF_INK).text(T(["Series: " + (e.sets || "-"), "Repeticiones: " + (e.reps || "-"), e.load ? "Carga: " + e.load : "", "Descanso: " + (e.rest || "-"), "Dolor permitido: " + (e.pain || "hasta 3/10")].filter(Boolean).join("   ·   ")), tx, doc.y + 3, { width: tw, lineGap: 1.5 });
      if (e.instructions) doc.fillColor(PDF_ACCENT).text("Para ti: " + T(e.instructions), tx, doc.y + 2, { width: tw });
      if ((e.errors || []).length) doc.fillColor(PDF_MUTED).text("Evita: " + T(e.errors.join("; ")), tx, doc.y + 2, { width: tw });
      doc.x = 48; doc.y = Math.max(doc.y, y0 + fig.h) + 12;
    });
  }
  doc.moveDown(1); k.small("Material educativo. No sustituye la valoración individual de tu fisioterapeuta ni un diagnóstico médico.");
  doc.end();
  return k.done;
}

/* Gráfica de línea vectorial: una serie, un eje. */
function pdfChart(k, points, o) {
  const doc = k.doc, H = 120; k.room(H + 40);
  const x0 = 48 + 28, y0 = doc.y + 6, w = k.W - 60, py = (v) => y0 + H - (v / o.max) * H, px = (i) => x0 + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  (o.ticks || [0, o.max / 2, o.max]).forEach((t) => { doc.moveTo(x0, py(t)).lineTo(x0 + w, py(t)).lineWidth(0.5).stroke(PDF_LINE); doc.font("Helvetica").fontSize(8).fillColor(PDF_MUTED).text(String(t) + (o.unit || ""), 48, py(t) - 4, { width: 24, align: "right" }); });
  if (o.threshold != null) { doc.moveTo(x0, py(o.threshold)).lineTo(x0 + w, py(o.threshold)).lineWidth(0.6).dash(3, { space: 3 }).stroke(PDF_BAD).undash(); doc.fontSize(8).fillColor(PDF_BAD).text("Alerta", x0 + w + 4, py(o.threshold) - 4, { lineBreak: false }); }
  if (points.length) {
    doc.moveTo(px(0), py(points[0].y)); points.forEach((p, i) => i && doc.lineTo(px(i), py(p.y))); doc.lineWidth(1.5).stroke(PDF_ACCENT);
    points.forEach((p, i) => doc.circle(px(i), py(p.y), 2.4).fill(PDF_ACCENT));
    const every = Math.max(1, Math.ceil(points.length / 6));
    points.forEach((p, i) => { if (i % every === 0 || i === points.length - 1) doc.font("Helvetica").fontSize(8).fillColor(PDF_MUTED).text(T(p.x), px(i) - 25, y0 + H + 5, { width: 50, align: "center", lineBreak: false }); });
  } else doc.font("Helvetica").fontSize(9).fillColor(PDF_MUTED).text("Sin datos todavía.", x0, y0 + H / 2);
  doc.x = 48; doc.y = y0 + H + 24;
}

/* Informe de evolución de un plan: indicadores, dolor por sesión, cumplimiento semanal e historial. */
async function buildReportPdf(o) {
  const k = await newPdf("Informe de evolución", o.password), doc = k.doc, g = o.program, s = o.stats;
  k.small(o.clinic + "  ·  Informe generado el " + new Date().toLocaleDateString("es-ES"));
  k.h1("Informe de evolución", o.patient + "  ·  " + g.title);
  k.p("Inicio: " + shortDate(g.start_date) + "   ·   Días previstos: " + g.weekdays.map((d) => WEEKDAYS[d - 1]).join(" ") + "   ·   Estado: " + PROGRAM_STATUS[g.status]);
  k.p("Adherencia últimos 7 días: " + (s.adherence == null ? "-" : s.adherence + " %") + "   ·   Última actividad: " + (s.last ? shortDate(s.last) : "-") + "   ·   Sesiones registradas: " + o.sessions.length);
  if (g.clinical_notes) { k.h2("Notas clínicas"); k.p(g.clinical_notes); }
  k.h2("Dolor EVA por sesión (0-10)");
  pdfChart(k, o.sessions.filter((l) => l.pain_eva != null).map((l) => ({ x: shortDate(l.log_date), y: l.pain_eva })), { max: 10, ticks: [0, 5, 10], threshold: 6 });
  k.h2("Cumplimiento semanal");
  pdfChart(k, o.weekly, { max: 100, ticks: [0, 50, 100], unit: " %" });
  k.h2("Historial de sesiones");
  if (!o.sessions.length) k.small("Sin sesiones registradas.");
  o.sessions.slice().reverse().forEach((l) => {
    k.room(30);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(PDF_INK).text(shortDate(l.log_date) + "   ", { continued: true }).font("Helvetica").fillColor(l.pain_eva >= 6 ? PDF_BAD : PDF_INK)
      .text("Dolor " + (l.pain_eva ?? "-") + "/10", { continued: true }).fillColor(PDF_INK).text("   Esfuerzo " + (l.effort_rpe ?? "-") + "/10" + (l.patient_notes ? "   " + T(l.patient_notes) : ""), { width: k.W });
  });
  doc.end();
  return k.done;
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
/* En el móvil abre el menú de compartir (WhatsApp, correo…) con el archivo adjunto; si no se puede, lo descarga. */
async function shareOrSave(blob, name) {
  const file = new File([blob], name, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return "shared"; } catch (e) { if (e.name === "AbortError") return "cancelled"; } }
  saveBlob(blob, name); return "saved";
}
