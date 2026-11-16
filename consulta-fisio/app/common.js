/* Utilidades compartidas por el panel (admin) y el portal del paciente. */
const sb = supabase.createClient(APP_CONFIG.url, APP_CONFIG.key);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const euros = (cents) => cents ? (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" }) : "Gratis";
const MB = 1024 * 1024;

const KIND_LABEL = { video: "Vídeo", pdf: "PDF", embed: "Vídeo por enlace", link: "Enlace" };
const METHOD_LABEL = { purchased: "Comprado online", assigned: "Asignado en consulta", bono: "Incluido en bono", free: "Gratuito" };
const STATUS_LABEL = { draft: "Borrador", published: "Publicado", archived: "Archivado" };

/* Reglas de subida. El servidor aplica las mismas (tipos y peso) en cada bucket. */
const RULES = {
  cover: { bucket: "covers", types: ["image/jpeg", "image/png", "image/webp"], ext: ["jpg", "jpeg", "png", "webp"], max: 5 * MB, hint: "JPG, PNG o WebP · máx. 5 MB" },
  pdf: { bucket: "content", types: ["application/pdf"], ext: ["pdf"], max: 50 * MB, hint: "PDF · máx. 50 MB" },
  video: { bucket: "content", types: ["video/mp4", "video/quicktime"], ext: ["mp4", "mov"], max: 50 * MB, hint: "MP4 o MOV · máx. 50 MB. Para vídeos más pesados usa un enlace privado." }
};
const MIME_BY_EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf", mp4: "video/mp4", mov: "video/quicktime" };
const extOf = (name) => (name.split(".").pop() || "").toLowerCase();

function validateFile(file, rule) {
  const ext = extOf(file.name);
  if (!rule.types.includes(file.type) && !rule.ext.includes(ext)) return "Formato no admitido. " + rule.hint;
  if (file.size > rule.max) return "El archivo pesa " + (file.size / MB).toFixed(1) + " MB. " + rule.hint;
  if (file.size === 0) return "El archivo está vacío.";
  return null;
}

function toast(msg, bad) {
  $$(".toast").forEach((t) => t.remove());
  const t = document.createElement("div");
  t.className = "toast" + (bad ? " bad" : "");
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* Subida con progreso real: XHR directo a Storage con el token de la sesión. */
async function uploadFile(file, rule, path, onProgress) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Sesión caducada. Vuelve a entrar.");
  const type = rule.types.includes(file.type) ? file.type : MIME_BY_EXT[extOf(file.name)];
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", APP_CONFIG.url + "/storage/v1/object/" + rule.bucket + "/" + path.split("/").map(encodeURIComponent).join("/"));
    xhr.setRequestHeader("Authorization", "Bearer " + session.access_token);
    xhr.setRequestHeader("apikey", APP_CONFIG.key);
    xhr.setRequestHeader("Content-Type", type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(path);
      let msg = "No se pudo subir el archivo (" + xhr.status + ").";
      try { msg = JSON.parse(xhr.responseText).message || msg; } catch (_) {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Fallo de conexión durante la subida."));
    xhr.send(file);
  });
}

/* Zona de arrastrar y soltar. pathFor(file) devuelve la ruta destino; onDone(path, file) al terminar. */
function uploader(host, ruleName, pathFor, onDone) {
  const rule = RULES[ruleName];
  const id = "file-" + Math.random().toString(36).slice(2, 8);
  host.innerHTML =
    '<div class="drop" tabindex="0" role="button" aria-label="Subir archivo"><b>Arrastra el archivo aquí</b> o pulsa para elegirlo<br><span class="small">' + esc(rule.hint) + "</span>" +
    '<input type="file" id="' + id + '" hidden accept="' + rule.ext.map((e) => "." + e).join(",") + '">' +
    '<div class="bar" hidden><i></i></div></div><p class="err" hidden></p>';
  const drop = $(".drop", host), input = $("input", host), bar = $(".bar", host), fill = $(".bar i", host), err = $(".err", host);
  let busy = false;
  async function take(file) {
    if (!file || busy) return;
    err.hidden = true;
    const problem = validateFile(file, rule);
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    busy = true; bar.hidden = false; fill.style.width = "0";
    try {
      const path = await uploadFile(file, rule, pathFor(file), (f) => { fill.style.width = Math.round(f * 100) + "%"; });
      fill.style.width = "100%";
      await onDone(path, file);
    } catch (e) {
      err.textContent = e.message; err.hidden = false;
    } finally {
      busy = false; bar.hidden = true; input.value = "";
    }
  }
  drop.addEventListener("click", () => input.click());
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("click", (e) => e.stopPropagation());
  input.addEventListener("change", () => take(input.files[0]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => take(e.dataTransfer.files[0]));
}

const safeName = (name) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-80);
const coverUrl = (path) => path ? sb.storage.from("covers").getPublicUrl(path).data.publicUrl : "";
const coverStyle = (path) => path ? ' style="background-image:url(\'' + esc(coverUrl(path)) + '\')"' : "";

/* Convierte un enlace de YouTube o Vimeo en su URL de incrustación. Devuelve null si no lo reconoce. */
function embedSrc(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return "https://www.youtube-nocookie.com/embed/" + u.pathname.slice(1);
    if (h === "youtube.com" || h === "m.youtube.com") {
      const id = u.searchParams.get("v") || (u.pathname.startsWith("/embed/") || u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : "");
      return id ? "https://www.youtube-nocookie.com/embed/" + id : null;
    }
    if (h === "vimeo.com") { const p = u.pathname.split("/").filter(Boolean); return p[0] ? "https://player.vimeo.com/video/" + p[0] + (p[1] ? "?h=" + p[1] : "") : null; }
    if (h === "player.vimeo.com" || h === "stream.mux.com" || h === "player.mux.com") return u.href;
    return null;
  } catch (_) { return null; }
}
const isHttps = (url) => { try { return new URL(url).protocol === "https:"; } catch (_) { return false; } };

/* Formulario de acceso (entrar / crear cuenta) reutilizable. */
function renderAuth(host, opts) {
  let mode = "login";
  function draw(note) {
    host.innerHTML =
      '<div class="panel authbox"><form class="form" id="authform"><h2>' + esc(opts.title) + "</h2>" +
      (opts.intro ? '<p class="muted">' + esc(opts.intro) + "</p>" : "") +
      (mode === "signup" && opts.askName ? '<label>Nombre<input type="text" id="auth-name" autocomplete="name" required></label>' : "") +
      '<label>Email<input type="email" id="auth-email" autocomplete="email" required></label>' +
      '<label>Contraseña<input type="password" id="auth-pass" autocomplete="' + (mode === "login" ? "current-password" : "new-password") + '" minlength="8" required></label>' +
      '<p class="err" id="auth-err"' + (note ? "" : " hidden") + ">" + esc(note || "") + "</p>" +
      '<button class="pill" type="submit">' + (mode === "login" ? "Entrar" : "Crear cuenta") + "</button>" +
      '<button class="tab" type="button" id="auth-switch">' + (mode === "login" ? "No tengo cuenta" : "Ya tengo cuenta") + "</button></form></div>";
    $("#auth-switch", host).onclick = () => { mode = mode === "login" ? "signup" : "login"; draw(); };
    $("#authform", host).onsubmit = async (e) => {
      e.preventDefault();
      const email = $("#auth-email", host).value.trim(), password = $("#auth-pass", host).value;
      const btn = $("button[type=submit]", host); btn.disabled = true;
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return draw(error.message === "Email not confirmed" ? "Confirma tu email con el enlace que te enviamos y vuelve a entrar." : "Email o contraseña incorrectos.");
      } else {
        const name = opts.askName ? $("#auth-name", host).value.trim() : "";
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.href.split("#")[0] } });
        if (error) return draw(error.message);
        if (!data.session) { mode = "login"; return draw("Te hemos enviado un email. Confírmalo y entra con tu contraseña."); }
      }
      opts.onDone();
    };
  }
  draw();
}
