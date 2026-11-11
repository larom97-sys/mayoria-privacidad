/* =========================================================
   Mayoría — Sonido (Web Audio API) y vibración háptica (Capacitor Haptics)
   ---------------------------------------------------------
   SFX.play(nombre)    click | tap | pop | buy | alert | crit | news | win | lose
   SFX.haptic(estilo)  'LIGHT' | 'MEDIUM' | 'HEAVY'  →  Haptics.impact({ style: ImpactStyle.* })
   SFX.setVolume(0..1) · SFX.setMuted(bool) · SFX.setHaptics(bool)   (se recuerdan en el dispositivo)
   Los sonidos se sintetizan al vuelo: no hay archivos de audio que cargar.
   El navegador solo deja sonar audio tras un gesto del jugador: SFX.unlock() en el primer toque.
   ========================================================= */
(function (root) {
  const KEY = 'mi_audio';
  const cfg = { volume: 0.6, muted: false, haptics: true };
  try { Object.assign(cfg, JSON.parse(root.localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const save = () => { try { root.localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };

  let ctx = null, master = null;
  function unlock() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      applyGain();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function applyGain() { if (master) master.gain.value = cfg.muted ? 0 : cfg.volume * 0.5; }

  /* tono simple con envolvente: tipo de onda, frecuencia (o [inicio, fin]), inicio, duración, volumen */
  function tone(type, freq, at, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at;
    o.type = type;
    if (Array.isArray(freq)) { o.frequency.setValueAtTime(freq[0], t); o.frequency.exponentialRampToValueAtTime(freq[1], t + dur); }
    else o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(at, dur, vol, hp) {
    const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + at;
    f.type = 'highpass'; f.frequency.value = hp || 1200; g.gain.value = vol;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  const SOUNDS = {
    click: () => tone('square', 900, 0, 0.035, 0.05),
    tap:   () => tone('sine', [520, 760], 0, 0.06, 0.06),
    pop:   () => { tone('sine', [480, 1400], 0, 0.09, 0.16); noise(0, 0.06, 0.08, 2500); },
    buy:   () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, i * 0.07, 0.16, 0.12)),
    alert: () => [0, 0.22].forEach(at => { tone('sawtooth', 660, at, 0.18, 0.06); tone('sawtooth', 880, at + 0.11, 0.18, 0.05); }),
    crit:  () => [0, 0.26, 0.52].forEach(at => { tone('sawtooth', [440, 330], at, 0.24, 0.08); }),
    news:  () => { tone('sine', 1046, 0, 0.6, 0.09); tone('sine', 1568, 0.08, 0.7, 0.06); },
    win:   () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, i * 0.12, 0.4, 0.13)),
    lose:  () => [392, 349, 311, 262].forEach((f, i) => tone('sawtooth', f, i * 0.2, 0.35, 0.07))
  };

  /* vibración: Capacitor Haptics en la app; navigator.vibrate como respaldo en el navegador del móvil */
  const VIB = { LIGHT: 10, MEDIUM: 22, HEAVY: 45 };
  function haptic(style) {
    if (!cfg.haptics) return;
    const s = VIB[style] ? style : 'LIGHT';
    try {
      const H = root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins.Haptics;
      if (H && H.impact) { H.impact({ style: s }); return; }
      if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(VIB[s]);
    } catch (e) {}
  }

  root.SFX = {
    unlock,
    play(name) { try { if (cfg.muted || !SOUNDS[name]) return; unlock(); if (ctx && ctx.state === 'running') SOUNDS[name](); } catch (e) {} },
    haptic,
    /* segundo plano: suspende el contexto de audio (ahorra batería) y lo reanuda al volver */
    suspend(off) { try { if (!ctx) return; if (off) ctx.suspend(); else if (ctx.state !== 'running') ctx.resume(); } catch (e) {} },
    setVolume(v) { cfg.volume = Math.max(0, Math.min(1, +v || 0)); applyGain(); save(); },
    setMuted(m) { cfg.muted = !!m; applyGain(); save(); },
    setHaptics(h) { cfg.haptics = !!h; save(); },
    get volume() { return cfg.volume; },
    get muted() { return cfg.muted; },
    get haptics() { return cfg.haptics; }
  };
  root.addEventListener && root.addEventListener('pointerdown', unlock, { capture: true });
})(typeof window !== 'undefined' ? window : globalThis);
