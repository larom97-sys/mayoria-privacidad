/* =========================================================
   Mayoría — Motor de idiomas (español, inglés, francés, alemán)
   ---------------------------------------------------------
   El juego se escribe en español. Este módulo traduce lo que aparece en pantalla
   buscando cada texto en el diccionario del idioma (src/i18n/en.js, fr.js, de.js).
   Las claves del diccionario son el texto en español "normalizado":
     · números        →  {0}, {1}…   (se conservan y se recolocan en la traducción)
     · nombres propios →  {c0}, {c1}… (países, regiones, partidos rivales, líderes)
     · partido y líder del jugador → {party}, {leader} (nunca se traducen)
   Si un texto no está entero en el diccionario, se prueba por partes («A · B», «A: B»).
   API:  I18N.lang · I18N.set(l) · I18N.tr(s) · I18N.keyOf(s) · I18N.apply(raíces) · I18N.locale()
   ========================================================= */
(function (root) {
  const LANGS = [['es', 'Español'], ['en', 'English'], ['fr', 'Français'], ['de', 'Deutsch']];
  const LOCALE = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' };
  const DICT = root.I18N_DICT = root.I18N_DICT || {};
  let lang = '';
  try { lang = root.localStorage.getItem('mi_lang') || ''; } catch (e) {}
  if (!LOCALE[lang]) { const n = ((root.navigator && navigator.language) || 'es').slice(0, 2).toLowerCase(); lang = LOCALE[n] ? n : 'es'; }

  /* ---- nombres propios: los aporta el juego con I18N.setNames([[es, traductor]]) ---- */
  let NAMES = [], NAME_RE = null, NAME_MAP = new Map();
  function setNames(list) {
    NAMES = list.filter(x => x && x[0] && x[0].length > 2).sort((a, b) => b[0].length - a[0].length);
    NAME_MAP = new Map(NAMES.map(x => [x[0], x[1]]));
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    NAME_RE = NAMES.length ? new RegExp('(^|[^\\p{L}])(' + NAMES.map(x => esc(x[0])).join('|') + ')(?![\\p{L}])', 'gu') : null;
  }
  const nameTr = es => { const f = NAME_MAP.get(es); const t = typeof f === 'function' ? f() : f; return t || es; };

  /* ---- normalización: números y nombres → marcadores ---- */
  const NUM = /\d+(?:[.,]\d+)*/g;
  const DATE = /\d{1,2}\.? \p{L}{3,5}\.? \d{4}/gu;
  let EXTRA = () => [];   /* [[texto, marcador]] del jugador: nombre de partido y de líder */
  function keyOf(s, out) {
    let k = s;
    for (const [v, mk] of EXTRA()) if (v && v.length > 1 && k.includes(v)) { k = k.split(v).join(mk); }
    /* fechas ya formateadas en el idioma («5 ene 2026», «5 Jan 2026», «5. Jan. 2026») → {dA}, {dB}… (con letra, para no confundirlas con números) */
    const dates = [];
    k = k.replace(DATE, m => { dates.push(m); return '{d' + String.fromCharCode(64 + dates.length) + '}'; });
    /* primero los números y después los nombres, para no confundir el índice de {c0} con un número */
    const nums = [];
    k = k.replace(NUM, m => { nums.push(m); return '{' + (nums.length - 1) + '}'; });
    const names = [];
    if (NAME_RE) k = k.replace(NAME_RE, (m, pre, nm) => { names.push(nm); return pre + '{c' + (names.length - 1) + '}'; });
    if (out) { out.names = names; out.nums = nums; out.dates = dates; }
    return k;
  }
  function fill(tpl, o) {
    return tpl.replace(/\{d([A-Z])\}/g, (m, i) => o.dates[i.charCodeAt(0) - 65] != null ? o.dates[i.charCodeAt(0) - 65] : m).replace(/\{c(\d+)\}/g, (m, i) => o.names[+i] != null ? nameTr(o.names[+i]) : m)
      .replace(/\{(\d+)\}/g, (m, i) => o.nums[+i] != null ? o.nums[+i] : m)
      .replace(/\{(party|leader)\}/g, (m, k) => { const e = EXTRA().find(x => x[1] === m); return e ? nameTr(e[0]) : m; });
  }
  const MISS = root.__i18nMiss = new Set();
  const HAS_LETTERS = /\p{L}{2,}/u;

  function look(core, depth) {
    const d = DICT[lang];
    if (!d) return null;
    if (d[core] != null) return d[core];
    const o = {}, k = keyOf(core, o);
    if (d[k] != null) return fill(d[k], o);
    /* el diccionario puede tener la frase con el nombre como {c0} en vez de {party}/{leader} */
    if (/\{(party|leader)\}/.test(k) && !/\{c\d+\}/.test(k)) {
      const o2 = { nums: o.nums, dates: o.dates, names: [] };
      const k2 = k.replace(/\{(party|leader)\}/g, m => { const e = EXTRA().find(x => x[1] === m); o2.names.push(e ? e[0] : m); return '{c' + (o2.names.length - 1) + '}'; });
      if (d[k2] != null) return fill(d[k2], o2);
    }
    if (/^\{c\d+\}$/.test(k)) return nameTr(o.names[0]);           /* el texto es solo un nombre propio */
    if (/^\{(party|leader)\}$/.test(k)) return nameTr(core);          /* nombre elegido por el jugador (o el del arquetipo) */
    if (!HAS_LETTERS.test(k.replace(/\{[^}]+\}/g, ''))) return core;  /* solo números y signos */
    if (/^[\p{Lu}]{2,6}$/u.test(k)) return core;                     /* siglas de partido (BACC, URS…) */
    if (depth < 2) {
      for (const sep of [' · ', ': ', ' — ', ' | ']) {
        const i = core.indexOf(sep);
        if (i > 0) {
          const parts = sep === ': ' ? [core.slice(0, i), core.slice(i + 2)] : core.split(sep);
          /* la parte tras «: » suele empezar en minúscula; si no está así, se prueba con mayúscula inicial */
          const sub = p => { let t = look(p, depth + 1); if (t == null && /^\p{Ll}/u.test(p)) { t = look(p[0].toUpperCase() + p.slice(1), depth + 1); if (t != null) t = t[0].toLowerCase() + t.slice(1); } return t; };
          const tr = parts.map(p => { const t = p.trim() ? sub(p.trim()) : p; return t == null ? null : t; });
          if (tr.every(x => x != null)) return tr.join(sep);
        }
      }
    }
    if (depth === 0) MISS.add(k);
    return null;
  }
  /* modo recopilación (herramienta de traducción): window.__i18nHarvest = new Set() guarda cada clave vista */
  const harvest = core => { const H = root.__i18nHarvest; if (H && HAS_LETTERS.test(core)) H.add(keyOf(core)); };
  function tr(s) {
    if (s == null) return s;
    s = String(s);
    const core = s.trim();
    if (!core) return s;
    harvest(core);
    if (lang === 'es') return s;
    const r = look(core, 0);
    if (r == null) return s;
    const lead = s.slice(0, s.indexOf(core[0])), trail = s.slice(s.lastIndexOf(core[core.length - 1]) + 1);
    return lead + r + trail;
  }

  /* ---- traducción de la pantalla: nodos de texto y atributos visibles ---- */
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
  function apply(roots) {
    if (lang === 'es' && !root.__i18nHarvest) return;
    for (const r of roots) {
      if (!r) continue;
      const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentNode && SKIP.has(n.parentNode.nodeName)) || (n.parentNode && n.parentNode.closest && n.parentNode.closest('[data-noi18n]')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
      let n;
      while ((n = w.nextNode())) {
        const v = n.nodeValue;
        if (n.__i18n === v || !HAS_LETTERS.test(v)) continue;
        const t = tr(v);
        if (t !== v) n.nodeValue = t;
        n.__i18n = n.nodeValue;
      }
      const els = r.querySelectorAll ? r.querySelectorAll('[title],[aria-label],[placeholder]') : [];
      for (const el of els) for (const a of ['title', 'aria-label', 'placeholder']) {
        const v = el.getAttribute(a);
        if (!v || el['__i18n_' + a] === v) continue;
        const t = tr(v);
        if (t !== v) el.setAttribute(a, t);
        el['__i18n_' + a] = el.getAttribute(a);
      }
    }
  }

  root.I18N = {
    LANGS, get lang() { return lang; },
    set(l) { if (!LOCALE[l]) return; lang = l; try { root.localStorage.setItem('mi_lang', l); } catch (e) {} document.documentElement.lang = l; },
    locale() { return LOCALE[lang]; },
    tr, keyOf, apply, setNames, setExtra(f) { EXTRA = f; }, nameTr,
    misses() { return [...MISS]; }
  };
  try { document.documentElement.lang = lang; } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
