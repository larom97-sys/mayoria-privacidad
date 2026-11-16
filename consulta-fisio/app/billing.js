/* Suscripción de la clínica: banner de prueba, pantalla de planes, equipo, avisos de límite y bloqueo por impago.
   Los pacientes nunca pagan; la cuota es de la clínica. El estado real lo escribe el webhook de Stripe. */
const upg = $("#upgrade"), upgBody = $("#upgrade-body");
const money = (cents) => (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 });
const daysLeft = (iso) => Math.ceil((new Date(iso) - new Date()) / 86400000);
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
let yearly = false;
/* Una característica puede venir marcada como "soon": se muestra, pero avisando de que aún no está disponible. */
const feat = (f) => "<li>" + (typeof f === "string" ? esc(f) : esc(f.t) + (f.soon ? ' <span class="chip" style="font-size:.68rem;padding:2px 8px">Próximamente</span>' : "")) + "</li>";

function billingStatus(b) {
  if (b.status === "canceled") return { level: "red", label: "Cancelada" };
  if (b.status === "unpaid") return { level: "red", label: "Impagada" };
  if (b.status === "past_due") return { level: "amber", label: "Pago pendiente" };
  if (b.status === "trialing" && !b.has_subscription) return daysLeft(b.trial_ends_at) > 0 ? { level: "green", label: "En prueba" } : { level: "red", label: "Prueba terminada" };
  return { level: "green", label: "Activa" };
}

async function refreshBilling() {
  const { data, error } = await sb.rpc("billing_state");
  if (error) return;
  bill = data;
  $("#clinic-name").textContent = bill.name;
  const banner = $("#banner"), d = daysLeft(bill.trial_ends_at);
  let msg = "";
  if (!bill.writable) msg = (bill.status === "trialing" ? "Tu prueba gratuita ha terminado." : "Tu suscripción no está activa.") + " El panel está en solo lectura: tus datos siguen disponibles.";
  else if (bill.status === "past_due") msg = "No hemos podido cobrar la última cuota. Actualiza tu forma de pago para no perder el servicio.";
  else if (bill.status === "trialing" && !bill.has_subscription) msg = "Te " + (d === 1 ? "queda 1 día" : "quedan " + d + " días") + " de prueba gratuita.";
  banner.hidden = !msg;
  banner.className = "banner" + (!bill.writable ? " red" : bill.status === "past_due" ? " amber" : "");
  banner.innerHTML = msg ? '<div class="wrap"><span>' + esc(msg) + '</span><button class="tab" type="button" id="banner-go">Elige tu plan</button></div>' : "";
  if (msg) $("#banner-go").onclick = () => show("ajustes");
  if (!$("#v-ajustes").hidden) drawBilling();
}

/* Guarda de escritura: con la prueba caducada o la cuota impagada no se crea ni se asigna nada nuevo. */
function guardWrite() {
  if (!bill || bill.writable) return true;
  upgradeModal("blocked");
  return false;
}

function upgradeModal(reason) {
  const next = bill.plans.find((p) => p.tier === (bill.plan_tier === "autonomo" ? "clinica" : "multicentro")) || bill.plans[1];
  const text = {
    blocked: ["Elige un plan para seguir", "Tu clínica está en solo lectura. Puedes consultar y descargar tus datos, pero para crear programas, dar de alta pacientes o asignar necesitas una suscripción activa."],
    patients: ["Has alcanzado el límite de pacientes activos", "Tu plan incluye hasta " + bill.max_active_patients + " pacientes activos. Con el plan " + next.name + " " + (next.max_active_patients == null ? "no hay límite." : "el límite sube a " + next.max_active_patients + ".")],
    therapists: ["Has alcanzado el límite de fisioterapeutas", "Tu plan incluye " + bill.max_therapists + (bill.max_therapists === 1 ? " fisioterapeuta" : " fisioterapeutas") + ". Con el plan " + next.name + " " + (next.max_therapists == null ? "no hay límite." : "puedes tener hasta " + next.max_therapists + ".")]
  }[reason];
  upgBody.innerHTML = '<div class="dlghead"><h2>' + esc(text[0]) + '</h2><button class="iconbtn" id="upg-close" aria-label="Cerrar" style="background:var(--grey)">✕</button></div>' +
    '<p class="muted">' + esc(text[1]) + "</p>" +
    (reason === "blocked" ? "" : '<div class="choice best"><h3>Plan ' + esc(next.name) + '</h3><span class="amt">' + money(next.monthly_cents) + ' <span class="muted small">al mes + IVA</span></span><ul class="small muted" style="margin:0;padding-left:18px">' + next.features.map(feat).join("") + "</ul></div>") +
    '<div class="dlgfoot"><button class="ghost on-white" type="button" id="upg-later">Ahora no</button><button class="pill" type="button" id="upg-go">Ver planes</button></div>';
  $("#upg-close").onclick = $("#upg-later").onclick = () => upg.close();
  $("#upg-go").onclick = () => { upg.close(); show("ajustes"); };
  if (!upg.open) upg.showModal();
}

const usageBar = (label, used, max) => '<div><div style="display:flex;justify-content:space-between" class="small"><span>' + label + "</span><b>" + used + (max == null ? " · sin límite" : " de " + max) + '</b></div><div class="progress" style="margin-top:6px"><i style="width:' + (max == null ? 0 : Math.min(100, Math.round((used / max) * 100))) + "%" + (max != null && used >= max ? ";background:var(--bad)" : "") + '"></i></div></div>';

async function drawBilling() {
  const host = $("#billing"), b = bill, st = billingStatus(b);
  const current = b.plans.find((p) => p.tier === b.plan_tier);
  const when = b.status === "trialing" && !b.has_subscription ? "La prueba termina el " + new Date(b.trial_ends_at).toLocaleDateString("es-ES")
    : b.current_period_end ? (b.cancel_at_period_end ? "Termina el " : "Se renueva el ") + new Date(b.current_period_end).toLocaleDateString("es-ES") : "";
  const [{ data: invites }, { data: team }] = await Promise.all([
    sb.from("clinic_invites").select("id,email,created_at").is("accepted_at", null).order("created_at"),
    sb.from("staff").select("user_id,role")
  ]);
  host.innerHTML =
    '<div class="panel stack"><div class="pagehead" style="margin:0"><div><span class="muted small">Plan actual</span><h2>' + esc(current ? current.name : "Prueba gratuita") + (b.billing_interval === "year" ? " · anual" : "") + "</h2>" +
    '<p class="muted small">' + esc(when) + "</p></div>" + levelChip(st.level, st.label) + "</div>" +
    usageBar("Fisioterapeutas (incluye invitaciones pendientes)", b.therapists + b.pending_invites, b.max_therapists) + usageBar("Pacientes activos", b.active_patients, b.max_active_patients) +
    (b.has_subscription ? '<div class="actions"><button class="ghost on-white" type="button" id="bill-portal"' + (b.is_admin ? "" : " disabled") + ">Gestionar suscripción y facturas</button></div>" : "") +
    (!b.writable ? '<p class="small muted">Tu clínica está en solo lectura: puedes consultar pacientes, historiales y programas, e imprimirlos, pero no crear ni asignar hasta activar un plan.</p>' : "") + "</div>" +

    '<div class="panel stack"><div class="pagehead" style="margin:0"><h2>Planes</h2><div class="actions" role="group" aria-label="Periodo de facturación">' +
    '<button class="tab" type="button" id="bill-m" aria-current="' + !yearly + '" style="background:' + (yearly ? "var(--grey)" : "") + '">Mensual</button>' +
    '<button class="tab" type="button" id="bill-y" aria-current="' + yearly + '" style="background:' + (yearly ? "" : "var(--grey)") + '">Anual · con descuento</button></div></div>' +
    '<div class="plans">' + b.plans.map((p) => {
      const mine = p.tier === b.plan_tier && b.has_subscription;
      return '<div class="choice' + (p.popular ? " best" : "") + '">' + (p.popular ? '<span class="chip ok" style="align-self:flex-start">Más elegido</span>' : '<span class="chip" style="align-self:flex-start;visibility:hidden">·</span>') +
        "<h3>" + esc(p.name) + '</h3><span class="amt" data-amount="' + (yearly ? p.yearly_cents : p.monthly_cents) + '">' + money(yearly ? Math.round(p.yearly_cents / 12) : p.monthly_cents) + ' <span class="muted small">al mes + IVA</span></span>' +
        '<span class="muted small">' + (yearly ? "Un pago de " + money(p.yearly_cents) + " + IVA al año" : "Facturación mensual, sin permanencia") + "</span>" +
        '<ul class="small muted" style="margin:0;padding-left:18px;flex:1">' + p.features.map(feat).join("") + "</ul>" +
        '<button class="' + (p.popular ? "pill" : "ghost") + '" type="button" data-plan="' + p.tier + '"' + (mine || !b.is_admin ? " disabled" : "") + ">" + (mine ? "Tu plan actual" : b.has_subscription ? "Cambiar a este plan" : "Suscribirme") + "</button></div>";
    }).join("") + "</div>" +
    '<p class="muted small">Precios sin IVA. Los pacientes nunca pagan: la cuota es de la clínica.' + (b.is_admin ? "" : " Solo el administrador de la clínica puede cambiar el plan.") + "</p></div>" +

    '<div class="panel stack"><h2>Equipo</h2><p class="muted small">' + (team || []).length + ((team || []).length === 1 ? " fisioterapeuta" : " fisioterapeutas") + " con acceso. Invita por email: quien entre al panel con esa dirección verificada se une a tu clínica.</p>" +
    ((invites || []).length ? '<div class="rows">' + invites.map((i) => "<div><span>" + esc(i.email) + ' <span class="muted small">· invitación pendiente</span></span><button class="ghost sm on-white" data-uninvite="' + i.id + '">Cancelar</button></div>').join("") + "</div>" : "") +
    (b.is_admin ? '<form class="chatform" id="inv-form"><input type="email" id="inv-email" required placeholder="email@delfisio.es" aria-label="Email del fisioterapeuta"><button class="pill" type="submit">Invitar</button></form>' : "") + "</div>" +

    '<div class="panel stack"><h2>Datos de la clínica</h2><form class="chatform" id="cl-form"><input type="text" id="cl-name" required maxlength="80" aria-label="Nombre de la clínica" value="' + esc(b.name) + '"><button class="ghost on-white" type="submit">Guardar nombre</button></form>' +
    '<div><h3>Tus datos son tuyos</h3><p class="muted small">Descarga pacientes, programas, ejercicios, registros de sesión y mensajes en un ZIP con archivos CSV. Disponible siempre, también con la suscripción inactiva.</p>' +
    '<button class="ghost on-white" type="button" id="export-all" style="margin-top:10px">Exportar todos los datos</button></div></div>' +

    (b.simulation && isLocal ? '<div class="panel stack" style="border:1.5px dashed var(--hair)"><h3>Simulación (solo pruebas)</h3><p class="muted small">Cambia el estado de la clínica sin pasar por Stripe. Solo aparece en local y con la simulación activada en la base de datos.</p><div class="actions">' +
      ["trial", "expired", "canceled", "autonomo", "clinica", "multicentro"].map((s) => '<button class="ghost on-white sm" type="button" data-sim="' + s + '">' + s + "</button>").join("") + "</div></div>" : "");

  $("#bill-m").onclick = () => { yearly = false; drawBilling(); };
  $("#bill-y").onclick = () => { yearly = true; drawBilling(); };
  $$("[data-plan]", host).forEach((btn) => (btn.onclick = async () => {
    btn.disabled = true;
    // Con suscripción en curso, el cambio de plan se hace en el portal de Stripe (prorratea y factura solo).
    const fn = b.has_subscription ? "manage-subscription" : "create-checkout";
    const { data, error } = await sb.functions.invoke(fn, { body: { tier: btn.dataset.plan, interval: yearly ? "year" : "month", return_url: location.href.split("#")[0] } });
    if (error || !data?.url) { btn.disabled = false; return toast("El cobro con tarjeta todavía no está activado en la plataforma.", true); }
    location.href = data.url;
  }));
  if ($("#bill-portal")) $("#bill-portal").onclick = async (e) => {
    e.currentTarget.disabled = true;
    const { data, error } = await sb.functions.invoke("manage-subscription", { body: { return_url: location.href.split("#")[0] } });
    if (error || !data?.url) { e.currentTarget.disabled = false; return toast("No se ha podido abrir el portal de facturación.", true); }
    location.href = data.url;
  };
  if ($("#inv-form")) $("#inv-form").onsubmit = async (e) => {
    e.preventDefault();
    if (!guardWrite()) return;
    if (b.max_therapists != null && b.therapists + b.pending_invites >= b.max_therapists) return upgradeModal("therapists");
    const { error } = await sb.from("clinic_invites").insert({ clinic_id: b.clinic_id, email: $("#inv-email").value.trim().toLowerCase() });
    if (error) return /row-level/.test(error.message) ? upgradeModal("therapists") : toast(/duplicate/.test(error.message) ? "Ese email ya tiene una invitación pendiente." : error.message, true);
    toast("Invitación creada. Avisa al fisio para que entre al panel con ese email."); refreshBilling();
  };
  $$("[data-uninvite]", host).forEach((x) => (x.onclick = async () => { const { error } = await sb.from("clinic_invites").delete().eq("id", x.dataset.uninvite); if (error) return toast(error.message, true); refreshBilling(); }));
  $("#cl-form").onsubmit = async (e) => { e.preventDefault(); const { error } = await sb.from("clinics").update({ name: $("#cl-name").value.trim() }).eq("id", b.clinic_id); if (error) return toast(error.message, true); toast("Nombre guardado."); refreshBilling(); };
  $("#export-all").onclick = async (e) => { const btn = e.currentTarget; btn.disabled = true; try { await exportAll(); } catch (err) { toast(err.message, true); } btn.disabled = false; };
  $$("[data-sim]", host).forEach((x) => (x.onclick = async () => { const { error } = await sb.rpc("simulate_billing", { p_state: x.dataset.sim }); if (error) return toast(error.message, true); refreshBilling(); }));
}

/* Exportación completa en formato abierto: un ZIP con un CSV por tabla (UTF-8 con BOM, para que Excel lo abra bien). */
function toCsv(rows, cols) {
  const cell = (v) => {
    let s = v == null ? "" : Array.isArray(v) ? v.join(" ") : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // evita que una hoja de cálculo lo interprete como fórmula
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return "﻿" + cols.join(",") + "\n" + rows.map((r) => cols.map((c) => cell(r[c])).join(",")).join("\n") + "\n";
}
async function exportAll() {
  if (!window.fflate) await loadScript("vendor/fflate.js");
  const all = async (table, cols) => toCsv(await must(sb.from(table).select(cols.join(",")).limit(100000)), cols);
  const files = {
    "pacientes.csv": await all("patients", ["id", "code", "full_name", "email", "phone", "dni_nie", "consent_at", "created_at"]),
    "programas_asignados.csv": await all("patient_programs", ["id", "patient_id", "title", "start_date", "weekdays", "status", "clinical_notes", "created_at"]),
    "ejercicios.csv": await all("program_exercises", ["id", "program_id", "position", "name", "sets", "reps", "load", "rest", "pain", "instructions"]),
    "registros_de_sesion.csv": await all("exercise_logs", ["id", "program_id", "program_exercise_id", "patient_id", "log_date", "completed", "pain_eva", "effort_rpe", "patient_notes", "created_at"]),
    "mensajes.csv": await all("program_messages", ["id", "program_id", "sender", "body", "created_at"])
  };
  const zip = fflate.zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, fflate.strToU8(v)])));
  saveBlob(new Blob([zip], { type: "application/zip" }), "datos-clinica-" + localISO() + ".zip");
  toast("Exportación descargada.");
}

boot();
