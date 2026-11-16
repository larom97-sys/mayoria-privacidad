/* Portal del paciente «Mi rehabilitación»: privado y sin pagos.
   El paciente solo ve los programas que su fisioterapeuta le ha asignado; el servidor no entrega nada más. */
const view = $("#view");
let session = null, patientId = null, programs = [], afterLogin = null, consented = false;
const CONSENT_VERSION = "2026-11";

/* Consentimiento informado en el primer acceso: sin aceptarlo no se muestran los programas ni se registran datos. */
function drawConsent() {
  view.innerHTML = '<div class="panel authbox stack" style="max-width:560px"><h2>Antes de empezar</h2>' +
    "<p>Tu clínica usa este portal para enviarte tus ejercicios y seguir tu evolución. Para ello se tratarán estos datos tuyos:</p>" +
    '<ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px"><li>Tu nombre, email y teléfono, tal como los tiene tu clínica.</li><li>Los programas y pautas que te asigne tu fisioterapeuta.</li><li>Lo que tú registres: ejercicios hechos, dolor, esfuerzo, comentarios y mensajes.</li></ul>' +
    '<p class="muted small">Son datos de salud. Solo los ven los profesionales de tu clínica, que es la responsable de su tratamiento. Puedes pedirle en cualquier momento el acceso, la rectificación o el borrado de tus datos.</p>' +
    '<label class="check" style="margin:0"><input type="checkbox" id="consent-ok"> He leído lo anterior y consiento el tratamiento de mis datos de salud con este fin.</label>' +
    '<button class="pill" type="button" id="consent-go" disabled>Continuar</button></div>';
  $("#consent-ok").onchange = (e) => ($("#consent-go").disabled = !e.target.checked);
  $("#consent-go").onclick = async () => {
    const { data, error } = await sb.rpc("accept_consent", { p_version: CONSENT_VERSION });
    if (error || !data) return toast("No se ha podido guardar tu consentimiento.", true);
    consented = true; route();
  };
}
const SIGNED_SECONDS = 3600; // las URL firmadas de vídeos y PDF caducan en una hora
const here = () => location.href.split("#")[0];

async function refresh() {
  session = (await sb.auth.getSession()).data.session;
  $("#session").textContent = session ? "Salir" : "Entrar";
  patientId = null; programs = [];
  if (!session) return;
  const { data: pid } = await sb.rpc("ensure_patient", { p_name: null });
  patientId = pid || null;
  if (!patientId) return;
  const { data: ctx } = await sb.rpc("portal_context");
  consented = !!ctx?.consent_at;
  if (ctx?.clinic_name) $(".brand").innerHTML = "Mi rehabilitación <span class=\"muted\">· " + esc(ctx.clinic_name) + "</span>";
  const { data } = await sb.from("patient_programs").select("*").order("created_at", { ascending: false });
  programs = data || [];
}
$("#session").onclick = async () => {
  if (session) { await sb.auth.signOut(); await refresh(); location.hash = ""; route(); }
  else drawLogin();
};

function drawLogin() {
  view.innerHTML = '<div id="auth-box"></div><div class="panel authbox" style="margin-top:-28px"><form class="form" id="magic-form"><h3>Entrar sin contraseña</h3>' +
    '<p class="muted small">Te enviamos un enlace de acceso al email que diste en tu clínica.</p>' +
    '<label>Email<input type="email" id="magic-email" autocomplete="email" required></label><p class="small" id="magic-msg" hidden></p>' +
    '<button class="ghost on-white" type="submit">Enviarme el enlace</button></form></div>';
  renderAuth($("#auth-box"), { title: "Mi rehabilitación", intro: "Entra con el email que diste en tu clínica. Si es tu primera vez, crea tu cuenta con ese mismo email.", onDone: afterAuth });
  $("#magic-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("#magic-form button"), msg = $("#magic-msg"); btn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email: $("#magic-email").value.trim(), options: { emailRedirectTo: here() + (afterLogin || "") } });
    msg.hidden = false; btn.disabled = false;
    msg.textContent = error ? "No se ha podido enviar el enlace. Inténtalo de nuevo en unos minutos." : "Enlace enviado. Ábrelo desde este mismo dispositivo.";
  };
}
async function afterAuth() {
  await refresh();
  const next = afterLogin || ""; afterLogin = null;
  if (location.hash === next) route(); else location.hash = next;
}

/* ------------------------------------------------------------ inicio: mis programas asignados */
function drawHome() {
  if (!session) return drawLogin();
  if (!patientId) {
    view.innerHTML = '<div class="pagehead"><h1>Mi rehabilitación</h1></div><div class="empty">Todavía no hay ningún programa vinculado a <b>' + esc(session.user.email) + "</b>.<br>Comprueba con tu clínica que este es el email que tienen en tu ficha.</div>";
    return;
  }
  const today = localISO(), list = programs.filter((g) => g.status !== "completed"), done = programs.filter((g) => g.status === "completed");
  const card = (g) => '<a class="card hover" href="#plan-' + g.id + '" style="text-decoration:none;color:inherit"><div class="body"><span class="muted small">' +
    (g.status === "paused" ? "En pausa" : g.status === "completed" ? "Completado" : g.weekdays.includes(isoDow(today)) && g.start_date <= today ? "Hoy toca sesión" : "Hoy descansas") +
    "</span><h3>" + esc(g.title) + '</h3><span class="muted small">Días: ' + g.weekdays.map((d) => WEEKDAYS[d - 1]).join(" ") + '</span><span class="pill sm" style="align-self:flex-start;margin-top:12px">Abrir</span></div></a>';
  view.innerHTML = '<div class="pagehead"><div><h1>Mi rehabilitación</h1><p class="muted">Los programas que te ha asignado tu fisioterapeuta.</p></div></div>' +
    (list.length ? '<div class="grid">' + list.map(card).join("") + "</div>" : '<div class="empty">Tu fisioterapeuta aún no te ha asignado ningún programa.</div>') +
    (done.length ? '<h2 style="margin:32px 0 14px">Completados</h2><div class="grid">' + done.map(card).join("") + "</div>" : "");
}

/* ------------------------------------------------------------ rutas */
function route() {
  const h = location.hash.slice(1);
  window.scrollTo(0, 0);
  if (session && patientId && !consented) return drawConsent();
  if (h.startsWith("plan-")) return drawPlan(h.slice(5));
  return drawHome();
}
window.addEventListener("hashchange", () => { drawPlan.tab = null; route(); });
// Llegada por enlace de acceso (la URL trae el token): al completarse el inicio de sesión se carga el portal.
// Solo en ese caso: en una recarga normal no hay que tocar la ruta.
const cameByLink = /[#?&](access_token|code)=/.test(location.href);
sb.auth.onAuthStateChange((ev) => { if (cameByLink && ev === "SIGNED_IN" && !session) setTimeout(afterAuth, 0); });
(async () => { await refresh(); route(); })();
