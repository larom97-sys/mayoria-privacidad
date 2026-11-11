/* =========================================================
   Mayoría — Motor por turnos (sin pantalla: solo reglas)
   ---------------------------------------------------------
   10 semanas · 6 regiones · plan semanal con puntos de campaña · hitos al 1/3 y 2/3 del plazo.
   Los líderes (src/data/characters.js) aportan afinidades por tipo de votante
   (u urbano, r rural, j joven, m mayor), velocidad, resistencia, costes y pasiva.
   Todo texto está en español: la interfaz lo traduce con src/i18n/turnos.js.
   Uso:  const S=TURN.newGame(personaje, Math.random);  TURN.planAdd(S,ch,meta,'mitin');  TURN.endWeek(S,ch,meta,rnd);
   ========================================================= */
(function (root) {
  'use strict';
  /* ══════ TABLA DE EQUILIBRIO: todo lo ajustable está en estas constantes ══════
     BASE_WEEKS, PC, PLAN_MAX, OFFER, CAP0 … duración, puntos de campaña, acciones por plan, opciones ofrecidas y capital inicial
     TUNE ……… fuerza de las acciones (gk), desgaste semanal (decay), ritmo del rival (rival, steal), probabilidad de suceso (evp)
     DIFF ……… por dificultad: ritmo del rival, desgaste, meta final e hitos
     ACT ………… por acción: capital, puntos de campaña y probabilidad de éxito
     COMBOS, RIV_CTR, ADAPT … combos, respuestas a la jugada del rival y rival que aprende
     LEAD_K, LEAD_REQ, SLOT2, SK_NUM … ajuste por líder y requisitos de desbloqueo
     Las rachas y el ritmo de pantalla se ajustan en RET, al principio del script de index.html. */
  const REG0 = [
    { n: 'Norte industrial', t: 'm', p: 25, r: 30 },
    { n: 'Costa', t: 'u', p: 15, r: 20 },
    { n: 'Metrópoli', t: 'u', p: 35, r: 20 },
    { n: 'Campo Sur', t: 'r', p: 20, r: 25 },
    { n: 'Universidad', t: 'j', p: 30, r: 15 },
    { n: 'Frontera Este', t: 'r', p: 10, r: 30 }
  ];
  const BASE_WEEKS = 10, GOAL = 40, AP = 3, CAP0 = 30, OFFER = 4, PC = 6, PLAN_MAX = 4;   // 10 semanas · capital inicial · opciones ofrecidas · puntos de campaña por semana y acciones máximas en el plan
  const LEAD_K = { tecno_baron: 0.815, camarada_bio: 0.993, el_general: 1.03, populista: 0.88, baronesa_lobby: 1.08 };   // ajuste fino por líder (calibrado con simulaciones)
  const clamp = x => Math.max(0, Math.min(100, x));
  const TUNE = { sat: 110, rival: 15, steal: 5, second: 2, decay: 0.065, affk: 0.6, rcap: 65, gk: 2.6, stk: 3, inc: 1.5, evp: 0.5, ad: 1.6 };   // ad: fuerza de la publicidad en cada región   // gk: fuerza de las acciones · stk/inc: estabilidad y capital por semana   // ajustes de equilibrio

  /* ---- dificultades: rv ritmo del rival · dc desgaste del apoyo · goal meta final · m1/m2 hitos · cap capital extra ---- */
  const DIFF = [
    { id: 'aprendiz', n: 'Aprendiz', rv: 0.65, dc: 0.5, goal: 33, m1: 10, m2: 18, cap: 10, x: 'Rival más lento y meta del {0} %. Para aprender las reglas.' },
    { id: 'estratega', n: 'Estratega', rv: 1.08, dc: 1.04, goal: 40, m1: 15, m2: 25, cap: 0, x: 'El reto equilibrado: meta del {0} %.' },
    { id: 'veterano', n: 'Veterano', rv: 1.15, dc: 1.14, goal: 43, m1: 17, m2: 27, cap: 0, x: 'Rival más rápido, apoyo que se enfría antes y meta del {0} %.' },
    { id: 'leyenda', n: 'Leyenda', rv: 1.32, dc: 1.2, goal: 44, m1: 18, m2: 30, cap: 0, x: 'Rival implacable y meta del {0} %. Solo para leyendas.' }
  ];
  const dOf = S => DIFF[S && S.di != null ? S.di : 1] || DIFF[1];
  const hasSk = (S, id) => !!(S && S.sk && S.sk[id]);

  /* ---- habilidades iniciales (se eligen antes de la partida; se desbloquean con logros) ---- */
  const SKILLS = [
    { id: 'fondo', n: 'Fondo de campaña', x: 'Empiezas con {0} de capital extra.' },
    { id: 'arranque', n: 'Arranque sólido', x: 'Empiezas con +{0} de apoyo en todas las regiones.' },
    { id: 'redes', n: 'Red de contactos', x: 'Tus mitines, negociaciones y debates ganan un {0} % más de apoyo.' },
    { id: 'asesor', n: 'Asesor de imagen', x: 'La estabilidad democrática sube un {0} % más despacio.' },
    { id: 'mecenas', n: 'Mecenas', x: 'Ganas +{0} de capital cada semana.' },
    { id: 'espias', n: 'Espías', x: 'Investigar al rival acierta el {0} % de las veces y quita {1}.' },
    { id: 'oratoria', n: 'Oratoria', x: 'Mitin y debate tienen {0} puntos más de probabilidad de éxito.' },
    { id: 'blindaje', n: 'Blindaje mediático', x: 'Los efectos negativos de eventos y decisiones se reducen un {0} %.' },
    { id: 'maquinaria', n: 'Maquinaria de partido', x: 'El rival crece un {0} % más despacio.' },
    { id: 'estrella', n: 'Estrella de la prensa', x: 'La publicidad cuesta un {0} % menos de capital.' },
    { id: 'leyenda', n: 'Leyenda viva', x: 'Tienes una semana más y {0} de capital extra.' }
  ];
  const LEAD_REQ = { populista: 0, camarada_bio: 0, el_general: 1, tecno_baron: 3, baronesa_lobby: 5 };   // victorias necesarias
  const SLOT2 = 6;                                                                                      // victorias para la 2.ª habilidad
  const wonAt = (m, d) => (m.dw || []).some((n, i) => i >= d && n > 0);
  const nWon = m => Object.keys(m.won || {}).length;
  const ach = (m, k) => !!(m.ach && m.ach[k]);
  const SK_REQ = {
    fondo: [() => true, 'Disponible desde el principio'],
    arranque: [m => m.wins >= 1, 'Gana una partida'],
    redes: [m => wonAt(m, 1), 'Gana una partida en Estratega o superior'],
    asesor: [m => ach(m, 'impecable'), 'Gana con la estabilidad final por debajo del {0} %'],
    mecenas: [m => m.wins >= 3, 'Gana {0} partidas'],
    espias: [m => ach(m, 'topo'), 'Gana usando Investigar al rival {0} veces o más en la misma partida'],
    oratoria: [m => nWon(m) >= 3, 'Gana con {0} líderes distintos'],
    blindaje: [m => wonAt(m, 2), 'Gana una partida en Veterano o superior'],
    maquinaria: [m => ach(m, 'aplastante'), 'Gana con un apoyo medio final del {0} % o más'],
    estrella: [m => nWon(m) >= 5, 'Gana con los {0} líderes'],
    leyenda: [m => wonAt(m, 3), 'Gana una partida en Leyenda']
  };
  const SK_NUM = { asesor: [45], mecenas: [3], espias: [5], oratoria: [3], maquinaria: [56], estrella: [5] };
  const leaderOpen = (m, id) => (m.wins || 0) >= (LEAD_REQ[id] || 0);
  /* m.all = compra «desbloquear todo»: abre dificultades, habilidades y la 2.ª casilla */
  const diffOpen = (m, i) => !!m.all || i <= 1 || (i === 2 && wonAt(m, 1)) || (i === 3 && wonAt(m, 2));
  const skillOpen = (m, id) => !!m.all || SK_REQ[id][0](m);
  const slotsOf = m => (m.all || (m.wins || 0) >= SLOT2 ? 2 : 1);
  const snap = m => ({ l: Object.keys(LEAD_REQ).filter(id => leaderOpen(m, id)), d: DIFF.map((_, i) => i).filter(i => diffOpen(m, i)), s: SKILLS.map(k => k.id).filter(id => skillOpen(m, id)), n: slotsOf(m) });
  /* se llama al terminar una partida: apunta resultados y logros y devuelve lo que se ha desbloqueado */
  function record(m, S) {
    const r = S.res, a = snap(m);
    m.games = (m.games || 0) + 1; m.best = m.best || {}; m.won = m.won || {}; m.ach = m.ach || {}; m.dw = m.dw || [0, 0, 0, 0];
    if (r.won) {
      m.wins = (m.wins || 0) + 1; m.won[S.id] = true; m.dw[S.di != null ? S.di : 1]++;
      if (r.stab < SK_NUM.asesor[0]) m.ach.impecable = 1;
      if (r.avg >= SK_NUM.maquinaria[0]) m.ach.aplastante = 1;
      if (((S.cnt || {}).investigar || 0) >= SK_NUM.espias[0]) m.ach.topo = 1;
    }
    m.best[S.id] = Math.max(m.best[S.id] || 0, r.avg);
    const b = snap(m);
    return { leaders: b.l.filter(x => !a.l.includes(x)), diffs: b.d.filter(x => !a.d.includes(x)), skills: b.s.filter(x => !a.s.includes(x)), slot: b.n > a.n };
  }

  /* ---- acciones ---- */
  /* pc: puntos de campaña que gasta en el plan de la semana (hay PC por semana) */
  const ACT = {
    mitin:      { name: 'Mitin en la región',    cap: 0,  pc: 2, p: S => (S.w === 1 ? 1 : 0.8), unlock: false },
    negociar:   { name: 'Negociar con aliado',   cap: 0,  pc: 2, p: () => 0.6, unlock: false },
    investigar: { name: 'Investigar al rival',   cap: 0,  pc: 2, p: () => 0.6, unlock: false },
    publicidad: { name: 'Publicidad (todas)',    cap: 15, pc: 3, p: () => 1,   unlock: false },
    control:    { name: 'Control de daños',      cap: 6,  pc: 1, p: () => 1,   unlock: false },
    debate:     { name: 'Debate televisado',     cap: 6,  pc: 3, p: () => 0.7, unlock: true }
  };
  const ACT_ORDER = ['mitin', 'negociar', 'investigar', 'publicidad', 'control', 'debate'];
  /* rival que aprende: a partir de th usos acumulados contrarresta tu acción favorita (−p de éxito; la publicidad rinde ×ad) */
  const ADAPT = { th: 1.5, p: 0.15, ad: 0.7 };
  /* combos: la acción b justo después de la a (en la misma región si same) · pp prob. extra · gm apoyo extra */
  const COMBOS = [
    { id: 'pacto', n: 'Pacto y mitin', a: 'negociar', b: 'mitin', same: true, gm: 1.5, pp: 0 },
    { id: 'dossier', n: 'Dossier en directo', a: 'investigar', b: 'debate', same: true, gm: 1.2, pp: 0.15 },
    { id: 'altavoz', n: 'Altavoz', a: 'publicidad', b: 'mitin', same: false, gm: 1.25, pp: 0.2 },
    { id: 'calma', n: 'Mesa tranquila', a: 'control', b: 'negociar', same: false, gm: 1, pp: 0.2 }
  ];
  const comboOf = (prev, k, i) => (prev && COMBOS.find(c => c.a === prev.k && c.b === k && (!c.same || prev.i === i))) || null;
  /* qué acción tuya frena la jugada anunciada del rival (multiplica su efecto) */
  const RIV_CTR = { reg: { investigar: 0.35, debate: 0.6, mitin: 0.75 }, all: { publicidad: 0.5 },
    fichaje: { negociar: 0.3, mitin: 0.75 },        // te roba un cuadro en una región: se frena negociando allí
    bulo: { control: 0.4, investigar: 0.5 } };      // bulo en todo el país: se frena calmando o investigando (en cualquier región)
  /* factor con el que tu acción k en la región i frena la jugada V del rival (null si no la frena) */
  function rivCtr(V, k, i) {
    if (!V) return null;
    if (V.k === 'campana') return RIV_CTR.all[k] || null;
    if (V.k === 'bulo') return RIV_CTR.bulo[k] || null;
    if (i !== V.i) return null;
    return (V.k === 'fichaje' ? RIV_CTR.fichaje[k] : RIV_CTR.reg[k]) || null;
  }

  /* ---- efectos de eventos y decisiones (datos): p apoyo propio · v rival · c capital · s estabilidad ---- */
  const E = (k, r, d) => ({ k, r, d });
  const ALL = 'all';
  /* consecuencia diferida: se cobra o se paga d semanas después de decidir */
  const L = (d, t, fx) => ({ d, t, fx });

  const EVS = [
    { t: 'Vídeo viral en la Universidad: +6 de apoyo allí.', fx: [E('p', 4, 6)] },
    { t: 'Sequía en Campo Sur: tu mensaje cala (+5 allí) y la estabilidad sube 2.', fx: [E('p', 3, 5), E('s', 0, 2)] },
    { t: 'Pelea de rivales en televisión: el rival de Metrópoli pierde 8.', fx: [E('v', 2, -8)] },
    { t: 'Huelga en el Norte industrial: tu apoyo allí sube 5.', fx: [E('p', 0, 5)] },
    { t: 'Temporal en la Costa: la gente culpa al gobierno y tú ganas 4 allí.', fx: [E('p', 1, 4)] }
  ];

  const DEC_PLATO = {
    t: 'Pelea en directo entre rivales', x: 'Tienes un hueco en el plató. ¿Entras?',
    o: [
      { n: 'Entrar al plató', p: 0.6, g: '+8 de apoyo en todas y el rival pierde 10 en Metrópoli.', b: '-5 de apoyo en todas.',
        fg: [E('p', ALL, 8), E('v', 2, -10)], fb: [E('p', ALL, -5)] },
      { n: 'No darles ese altavoz', p: 0.8, g: '+2 de apoyo en todas.', b: '-3 de capital.',
        fg: [E('p', ALL, 2)], fb: [E('c', 0, -3)], lg: L(3, 'Te ven como alternativa seria: +3 de apoyo en todas.', [E('p', ALL, 3)]) }
    ]
  };
  const DEC_POOL = [
    { t: 'Mensaje para redes', x: 'El equipo propone dos tonos para la campaña de esta semana.',
      o: [
        { n: 'Tono humorístico', p: 0.6, g: '+6 de apoyo en todas.', b: '-3 de apoyo en todas.', fg: [E('p', ALL, 6)], fb: [E('p', ALL, -3)] },
        { n: 'Tono serio', p: 0.8, g: '+3 de apoyo en todas.', b: '-2 de capital.', fg: [E('p', ALL, 3)], fb: [E('c', 0, -2)], lg: L(2, 'Tu tono serio cala: +5 en Norte industrial y Campo Sur.', [E('p', 0, 5), E('p', 3, 5)]) }
      ] },
    { t: 'Un aliado pide un cargo', x: 'Quiere una vicepresidencia a cambio de su apoyo.',
      o: [
        { n: 'Darle el cargo (-8 de capital)', p: 0.7, g: '+5 de apoyo en todas.', b: 'Se queja en público: -3 de apoyo.',
          fg: [E('c', 0, -8), E('p', ALL, 5)], fb: [E('c', 0, -8), E('p', ALL, -3)], lg: L(2, 'Tu aliado moviliza a sus bases: +3 de apoyo en todas.', [E('p', ALL, 3)]) },
        { n: 'Rechazarlo', p: 0.8, g: '+1 de apoyo en todas.', b: 'Se va con los rivales: el rival del Norte crece 6.',
          fg: [E('p', ALL, 1)], fb: [E('v', 0, 6)] }
      ] },
    { t: 'Filtración de sedes', x: 'Se publican las direcciones de tres sedes. Hay pintadas.',
      o: [
        { n: 'Cerrar las sedes (-8 de capital)', p: 0.8, g: 'Te ven prudente: +3 en todas.', b: 'Parece huida: -12 de capital y -2 de apoyo.',
          fg: [E('c', 0, -8), E('p', ALL, 3)], fb: [E('c', 0, -12), E('p', ALL, -2)] },
        { n: 'Denunciar a los autores', p: 0.5, g: 'Los identifican: +7 de apoyo en todas.', b: 'La denuncia se archiva: -4 de apoyo.',
          fg: [E('p', ALL, 7)], fb: [E('p', ALL, -4)], lb: L(2, 'Las costas del juicio llegan: -10 de capital.', [E('c', 0, -10)]) }
      ] },
    { t: 'Cifra falsa en tu discurso', x: 'Un periodista demuestra en directo que una cifra era falsa.',
      o: [
        { n: 'Pedir disculpas', p: 0.8, g: 'Te ven honesto: +2 en todas.', b: 'La disculpa parece forzada: -4 en todas.',
          fg: [E('p', ALL, 2)], fb: [E('p', ALL, -4)], lg: L(3, 'Te citan como ejemplo de honestidad: +1 de apoyo en todas y -3 de estabilidad.', [E('p', ALL, 1), E('s', 0, -3)]) },
        { n: 'Atacar al periodista', p: 0.55, g: 'Tu base aplaude: +8 en Universidad y +15 de capital.', b: 'El vídeo da la vuelta al mundo: -3 en todas y +3 de estabilidad.',
          fg: [E('p', 4, 8), E('c', 0, 15)], fb: [E('p', ALL, -3), E('s', 0, 3)] }
      ] },
    { t: 'Un empresario te ofrece dinero', x: 'Un empresario ofrece un maletín a cambio de favores.',
      o: [
        { n: 'Aceptar el maletín', p: 0.6, g: 'Recibes 20 de capital.', b: 'Sale a la luz: -4 de apoyo en todas y +4 de estabilidad.',
          fg: [E('c', 0, 20)], fb: [E('p', ALL, -4), E('s', 0, 4)], lg: L(3, 'Hacienda pregunta por el maletín: -3 de apoyo en todas y +4 de estabilidad.', [E('p', ALL, -3), E('s', 0, 4)]) },
        { n: 'Rechazarlo', p: 0.85, g: 'Te ven íntegro: +2 en todas.', b: 'Se lo ofrece a tu rival: el rival del Norte crece 5.',
          fg: [E('p', ALL, 2)], fb: [E('v', 0, 5)] }
      ] },
    { t: 'Tu vídeo bailando se hace viral', x: 'Un vídeo tuyo bailando arrasa en redes.',
      o: [
        { n: 'Subirse a la ola', p: 0.65, g: '+10 de apoyo en Universidad y +6 en Costa.', b: 'No te toman en serio: -1 de apoyo en todas.',
          fg: [E('p', 4, 10), E('p', 1, 6)], fb: [E('p', ALL, -1)], lg: L(2, 'La moda pasa: -3 de apoyo en Universidad.', [E('p', 4, -3)]) },
        { n: 'Ignorarlo', p: 0.9, g: '+1 de apoyo en todas.', b: 'Pierdes la ocasión: -2 de apoyo en todas.',
          fg: [E('p', ALL, 1)], fb: [E('p', ALL, -2)] }
      ] }
  ];
  const POOL_BASE = [5, 7, 9];            // semanas con decisión (además del plató en la semana 3)

  /* retos del rival: decisiones que lanza él (rv: true) en las semanas RCH_BASE */
  const RIV_DEC = [
    { rv: true, t: 'El rival te reta a un debate', x: 'Lo anuncia en todas las cadenas. Si no vas, la silla vacía sale en portada.',
      o: [
        { n: 'Aceptar el reto', p: 0.55, g: 'Le ganas en directo: +6 de apoyo en todas y el rival pierde 4 en todas.', b: 'Te quedas en blanco: -7 de apoyo en todas.',
          fg: [E('p', ALL, 6), E('v', ALL, -4)], fb: [E('p', ALL, -7)] },
        { n: 'Mandar a un portavoz', p: 0.85, g: 'Tu portavoz sale airoso: +1 de apoyo en todas.', b: 'La silla vacía sale en portada: -4 de apoyo en todas.',
          fg: [E('p', ALL, 1)], fb: [E('p', ALL, -4)] }
      ] },
    { rv: true, t: 'El rival difunde un bulo sobre tu salud', x: 'Dice que llevas semanas sin dormir por culpa de las encuestas.',
      o: [
        { n: 'Desmentirlo en directo', p: 0.7, g: 'Te ven en forma: +1 de apoyo en todas.', b: 'Nadie te cree: -3 de apoyo en todas y +4 de estabilidad.',
          fg: [E('p', ALL, 1)], fb: [E('p', ALL, -3), E('s', 0, 4)] },
        { n: 'Responder con otro bulo', p: 0.5, g: 'Su bulo queda en nada: el rival pierde 6 en todas.', b: 'Guerra de bulos: -2 de apoyo en todas y +5 de estabilidad.',
          fg: [E('v', ALL, -6)], fb: [E('p', ALL, -2), E('s', 0, 5)] }
      ] },
    { rv: true, t: 'El rival quiere fichar a tu número dos', x: 'Le ofrece un ministerio si gana las elecciones.',
      o: [
        { n: 'Subirle el sueldo (-10 de capital)', p: 0.9, g: 'Se queda contigo: +1 de apoyo en todas.', b: 'Se va igualmente: el rival crece 4 en todas.',
          fg: [E('c', 0, -10), E('p', ALL, 1)], fb: [E('c', 0, -10), E('v', ALL, 4)] },
        { n: 'Dejar que se vaya', p: 0.6, g: 'Se lleva pocos votos: el rival crece 2 en todas.', b: 'Se lleva tu agenda: -4 de apoyo en todas y el rival crece 4 en todas.',
          fg: [E('v', ALL, 2)], fb: [E('p', ALL, -4), E('v', ALL, 4)] }
      ] },
    { rv: true, t: 'Encuesta trucada del rival', x: 'Publica una encuesta que te da diez puntos menos de los que tienes.',
      o: [
        { n: 'Encargar tu propia encuesta (-6 de capital)', p: 0.65, g: 'Tu encuesta convence: +3 de apoyo en todas.', b: 'Se nota el truco: +5 de estabilidad.',
          fg: [E('c', 0, -6), E('p', ALL, 3)], fb: [E('c', 0, -6), E('s', 0, 5)] },
        { n: 'Ignorarla', p: 0.8, g: 'Nadie se la cree: +1 de apoyo en todas.', b: 'Cala entre los indecisos: -4 de apoyo en todas.',
          fg: [E('p', ALL, 1)], fb: [E('p', ALL, -4)] }
      ] }
  ];
  const RCH_BASE = [4, 8];                // semanas con reto del rival

  /* el rival habla: frase de la semana (up: va por delante · down: por detrás) y reacciones a tus acciones */
  const QUIPS = {
    up: ['Las encuestas me quieren. Y yo a ellas.', 'Ya he elegido la foto para el cartel de la victoria.', 'Mi programa cabe en un eslogan. El tuyo, en ninguno.'],
    down: ['¿Encuestas? Las hace gente que no me conoce.', 'Voy a remontar. Lo dice mi primo, que es asesor.', 'Esta semana prometo más cosas. Muchas más.'],
    ok: ['Eso lo tenía yo en el programa. En letra pequeña.', 'Aplausos comprados. Seguro.', 'Disfrútalo mientras dure.'],
    ko: ['Ni lo he tenido que intentar.', 'Te presto a mi asesor. El caro.', 'Así no se hace. Pregúntame.'],
    blk: ['¿Quién te ha filtrado mi agenda?', 'Vale, esta vez me has pillado.', 'Eso no estaba en el guion.']
  };
  const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];

  /* ---- modificadores del líder ---- */
  function mods(ch, S) {
    const m = (ch.uniquePassive && ch.uniquePassive.modifiers) || {}, b = ch.baseStats || {}, k = id => hasSk(S, id);
    const raw = t => ((ch.affinities && ch.affinities[t]) || 1) * ((m.af && m.af[t]) || 1);
    /* las afinidades se suavizan y se normalizan: todos los líderes rinden igual de media, pero en sitios distintos */
    const soft = t => 1 + (raw(t) - 1) * TUNE.affk, mean = REG0.reduce((a, r) => a + soft(r.t), 0) / REG0.length;
    const aff = t => soft(t) / mean;
    return {
      aff,
      gm: (1 + 0.02 * ((b.contagioSpeed || 5) - 5)) * (k('redes') ? 1.1 : 1),   // velocidad de difusión → ganancia por acción
      rg: TUNE.rival * (1 + 0.03 * (5 - (b.oppositionResist || 5))),         // resistencia → crecimiento del rival
      rm: dOf(S).rv * (k('maquinaria') ? 0.85 : 1),                // dificultad y habilidades → ritmo del rival
      cm: b.skillCostMult || 1,                                  // coste de las acciones con capital
      sg: (1 + 0.03 * (5 - (b.inflationResistance || 5))) * (k('asesor') ? 0.75 : 1),   // aguante → estabilidad semanal
      vol: m.vol || 1,                                           // peso de eventos y decisiones
      neg: k('blindaje') ? 0.7 : 1,                              // efectos negativos de eventos y decisiones
      extra: (m.tl ? 2 : 0) + (k('leyenda') ? 1 : 0),            // plazo extra
      cap0: (m.cap0 ? 15 : 0) + (k('fondo') ? 12 : 0) + (k('leyenda') ? 10 : 0),
      inc: 4 * TUNE.inc + (m.capm ? 2 : 0) + (k('mecenas') ? 2 : 0),       // capital por semana
      home: m.hm ? 0 : -1                                        // región donde es fuerte (+30 %); −8 % en el resto
    };
  }

  /* opt: { di: dificultad (0-3), sk: [ids de habilidades] } */
  function newGame(ch, rnd, meta, opt) {
    opt = opt || {};
    const S = {
      id: ch.id, w: 1, W: BASE_WEEKS, cap: 0, stab: 20, di: opt.di != null ? opt.di : 1, sk: {}, cnt: {},
      reg: REG0.map(r => ({ ...r })), sel: 1, log: [], dec: null, over: false, res: null,
      used: [], pool: [], adGot: 0, ms: 0, plan: [], pend: [], wg: [0, 0, 0, 0, 0, 0], riv: null, rblk: 1, last: null, wk: {}, hab: {}, adapt: null
    };
    (opt.sk || []).forEach(id => { S.sk[id] = 1; });
    const M = mods(ch, S), W = BASE_WEEKS + M.extra;
    S.W = W; S.cap = CAP0 + M.cap0 + dOf(S).cap + ((meta && meta.bonusCap) || 0);
    S.pool = POOL_BASE.map(x => Math.min(W, Math.round(x * W / BASE_WEEKS)));
    S.rch = RCH_BASE.map(x => Math.min(W, Math.round(x * W / BASE_WEEKS))); S.rused = [];
    if (hasSk(S, 'arranque')) S.reg.forEach(x => { x.p += 3; });
    if (ch.id === 'populista') { S.reg[1].p += 3; }                       // arranca algo más fuerte en la Costa
    rollOffer(S, meta, rnd); planRival(S, rnd);
    S.msg = 'Semana 1. Planifica tus acciones: tienes ' + PC + ' puntos de campaña.';
    S.log.unshift('S1: ' + S.msg);
    return S;
  }
  /* partidas guardadas antes del plan semanal: les añade lo que falta */
  function upgrade(S, rnd) {
    if (!S.plan) S.plan = [];
    if (!S.pend) S.pend = [];
    if (!S.wg) S.wg = S.reg.map(() => 0);
    if (S.rblk == null) S.rblk = 1;
    if (!S.wk) S.wk = {};
    if (!S.hab) S.hab = {};
    if (!S.rch) { S.rch = RCH_BASE.map(x => Math.min(S.W, Math.round(x * S.W / BASE_WEEKS))).filter(x => x > S.w); S.rused = []; }
    if (!S.riv && !S.over) planRival(S, rnd);
    return S;
  }
  const say = (S, t) => { S.log.unshift('S' + S.w + ': ' + t); S.log = S.log.slice(0, 40); S.msg = t; if (S.inEnd && S.rep) S.rep.push(t); };   // S.rep: lo ocurrido al cerrar la semana (para el informe)
  const norm = S => { S.reg.forEach(x => { x.p = clamp(x.p); x.r = clamp(x.r); if (x.p + x.r > 100) x.p = 100 - x.r; }); };
  const avg = S => S.reg.reduce((a, x) => a + x.p, 0) / S.reg.length;

  /* ganancia de apoyo de una acción en una región, ya con el líder aplicado */
  function gain(S, ch, i, base) {
    const M = mods(ch, S), t = S.reg[i].t;
    let g = base * M.gm * M.aff(t) * (LEAD_K[ch.id] || 1);
    if (M.home >= 0 && i === 0) g *= 1.25;
    g *= Math.max(0.3, 1 - S.reg[i].p / TUNE.sat);          // rendimientos decrecientes: cuesta más cuanto más apoyo tienes
    return Math.max(1, Math.round(g));
  }
  const costOf = (ch, k, S) => Math.ceil(ACT[k].cap * mods(ch, S).cm * (k === 'publicidad' && hasSk(S, 'estrella') ? 0.7 : 1) - 1e-9);
  const unlockedOf = (meta, k) => !ACT[k].unlock || (meta && meta.wins > 0);
  /* probabilidad de éxito de una acción, con las habilidades y el combo (si lo hay) aplicados */
  function probOf(S, k, cb) {
    let p = ACT[k].p(S);
    if ((k === 'mitin' || k === 'debate') && hasSk(S, 'oratoria')) p = Math.min(1, p + 0.1);
    if (k === 'investigar' && hasSk(S, 'espias')) p = 0.75;
    if (cb && cb.pp) p = Math.min(1, p + cb.pp);
    if (S && S.adapt === k && ACT[k].p(S) < 1) p = Math.max(0.1, p - ADAPT.p);   // el rival ya se sabe tu acción favorita
    return p;
  }

  function apply(S, ch, fx) {
    const M = mods(ch, S), v = M.vol;
    fx.forEach(e => {
      let d = Math.round(e.d * v);
      if (M.neg < 1 && ((e.k === 'p' || e.k === 'c') ? d < 0 : d > 0)) d = Math.round(d * M.neg);
      const rs = e.r === ALL ? S.reg.map((_, i) => i) : [e.r];
      if (e.k === 'p') rs.forEach(i => { S.reg[i].p = clamp(S.reg[i].p + d); });
      if (e.k === 'v') rs.forEach(i => { S.reg[i].r = clamp(S.reg[i].r + d); });
      if (e.k === 'c') S.cap = Math.max(0, S.cap + d);
      if (e.k === 's') S.stab = clamp(S.stab + d);
    });
    norm(S);
  }

  /* ---- opciones de la semana: el mitin siempre; el resto se sortea (Calmar fijo si la estabilidad aprieta) ---- */
  function rollOffer(S, meta, rnd) {
    const pool = ACT_ORDER.filter(k => k !== 'mitin' && unlockedOf(meta, k)), o = ['mitin'];
    if (S.stab >= 60) o.push('control');
    const rest = pool.filter(k => !o.includes(k));
    while (o.length < OFFER && rest.length) o.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0]);
    S.offer = ACT_ORDER.filter(k => o.includes(k));
  }
  const offered = (S, k) => !S.offer || S.offer.includes(k);

  /* ---- plan de la semana: el jugador apunta acciones y se ejecutan en orden al cerrar la semana ---- */
  const pcLeft = S => PC - (S.plan || []).reduce((a, x) => a + ACT[x.k].pc, 0);
  const capLeft = (S, ch) => S.cap - (S.plan || []).reduce((a, x) => a + costOf(ch, x.k, S), 0);
  /* combo que tendría la acción k en la región i si se añade ahora al final del plan */
  const comboNext = (S, k, i) => comboOf(S.plan && S.plan.length ? S.plan[S.plan.length - 1] : null, k, i);
  const planCombo = (S, j) => (j > 0 ? comboOf(S.plan[j - 1], S.plan[j].k, S.plan[j].i) : null);
  /* por qué no se puede añadir (texto) o null si se puede */
  function planWhy(S, ch, meta, k) {
    if (S.over || S.dec) return 'Ahora no puedes planificar.';
    if (!unlockedOf(meta, k)) return 'Debate televisado se desbloquea al ganar una partida.';
    if (!offered(S, k)) return 'Esa acción no está disponible esta semana.';
    if (S.plan.length >= PLAN_MAX) return 'Tu plan ya está completo.';
    if (ACT[k].pc > pcLeft(S)) return 'No te quedan puntos de campaña para esa acción.';
    if (costOf(ch, k, S) > capLeft(S, ch)) return 'No tienes capital suficiente para esa acción.';
    return null;
  }
  function planAdd(S, ch, meta, k) {
    const why = planWhy(S, ch, meta, k);
    if (why) return say(S, why), null;
    const it = { k, i: S.sel }; S.plan.push(it);
    return it;
  }
  const planDel = (S, j) => { if (S.plan && j >= 0 && j < S.plan.length) S.plan.splice(j, 1); };

  /* ---- ejecuta la primera acción del plan (la interfaz la llama una a una para animarlas) ---- */
  function runNext(S, ch, meta, rnd) {
    if (S.over || S.dec || !S.plan || !S.plan.length) return null;
    const it = S.plan[0], k = it.k, i = it.i, cb = comboOf(S.last, k, i);
    S.plan.shift();
    const c = costOf(ch, k, S);
    if (c > S.cap) { S.last = it; return { k, i, ok: false, t: say(S, 'No tienes capital suficiente para esa acción.') || S.msg, cb: null, skip: true }; }
    S.cap -= c; S.cnt = S.cnt || {}; S.cnt[k] = (S.cnt[k] || 0) + 1; S.wk = S.wk || {}; S.wk[k] = (S.wk[k] || 0) + 1;
    const R = S.reg[i], ok = rnd() < probOf(S, k, cb), p0 = R.p;
    let t = ''; const K = TUNE.gk, n = x => Math.round(x * K), gm = cb ? cb.gm : 1;   // con 10 semanas cada acción pesa más
    if (k === 'mitin') {
      if (ok) { const g = gain(S, ch, i, 8 * K * gm); R.p = clamp(R.p + g); R.r = clamp(R.r - n(2)); t = 'Mitin en ' + R.n + ': +' + g + ' de apoyo, el rival pierde ' + n(2) + '.'; }
      else { const g = gain(S, ch, i, 2 * K); R.p = clamp(R.p + g); t = 'Mitin con poca asistencia en ' + R.n + ': +' + g + '.'; }
    }
    if (k === 'negociar') {
      if (ok) { const g = gain(S, ch, i, 10 * K * gm); R.p = clamp(R.p + g); t = 'Acuerdo en ' + R.n + ': +' + g + ' de apoyo.'; }
      else t = 'La negociación en ' + R.n + ' se rompe: sin cambios.';
    }
    if (k === 'investigar') {
      if (ok) { const q = n(hasSk(S, 'espias') ? 12 : 10); R.r = clamp(R.r - q); t = 'Investigación en ' + R.n + ': el rival pierde ' + q + '.'; }
      else { R.p = clamp(R.p - n(4)); S.stab = clamp(S.stab + n(3)); t = 'La investigación se vuelve contra ti en ' + R.n + ': -' + n(4) + ' de apoyo y +' + n(3) + ' de estabilidad.'; }
    }
    if (k === 'publicidad') {   // llega a todas, pero poco en cada una y con rendimientos decrecientes
      let tot = 0; S.reg.forEach((x, j) => { const g = gain(S, ch, j, TUNE.ad * K * (S.adapt === 'publicidad' ? ADAPT.ad : 1)); x.p = clamp(x.p + g); tot += g; S.wg[j] += g; });
      t = 'Publicidad: +' + Math.round(tot / S.reg.length) + ' de media en todas las regiones.';
    }
    if (k === 'control') { S.stab = clamp(S.stab - n(6)); t = 'Control de daños: estabilidad -' + n(6) + '.'; }
    if (k === 'debate') {
      if (ok) { const g = gain(S, ch, i, 13 * K * gm); R.p = clamp(R.p + g); R.r = clamp(R.r - n(cb ? 6 : 4)); t = 'Debate televisado en ' + R.n + ': +' + g + ' de apoyo y el rival pierde ' + n(cb ? 6 : 4) + '.'; }
      else { R.p = clamp(R.p - n(2)); t = 'El debate sale mal en ' + R.n + ': -' + n(2) + ' de apoyo.'; }
    }
    norm(S);
    if (k !== 'publicidad') S.wg[i] += Math.max(0, R.p - p0);
    /* ¿frena la jugada anunciada del rival? */
    const V = S.riv, f = rivCtr(V, k, i);
    let blk = false;
    if (f && (ok || k === 'publicidad' || k === 'control') && f < S.rblk) { S.rblk = f; blk = true; }
    S.last = it;
    say(S, t);
    if (cb) say(S, 'Combo «' + cb.n + '».');
    if (blk) say(S, 'Le has plantado cara a la jugada del rival.');
    if (k !== 'control' || blk) { const kind = blk ? 'blk' : ok ? 'ok' : 'ko'; if (blk || rnd() < (ok ? 0.35 : 0.5)) S.rq = pick(QUIPS[kind], rnd); }
    return { k, i, ok, t, cb, blk };
  }

  /* ---- el rival anuncia su jugada al empezar la semana; responde a dónde avanzaste la anterior ---- */
  function planRival(S, rnd) {
    let b = -1; S.reg.forEach((x, j) => { if (x.r < TUNE.rcap && (b < 0 || x.r > S.reg[b].r)) b = j; }); if (b < 0) b = 0;
    const wg = S.wg || [], m = wg.reduce((a, x, j) => (x > (wg[a] || 0) ? j : a), 0);
    /* tu región más fuerte: allí intenta fichar a tus cuadros */
    const top = S.reg.reduce((a, x, j) => (x.p > S.reg[a].p ? j : a), 0), q = S.w > 1 ? rnd() : 1;
    if (S.w > 1 && (wg[m] || 0) >= 8 && rnd() < 0.6) S.riv = { k: 'ataque', i: m };
    else if (q < 0.15) S.riv = { k: 'campana', i: -1 };
    else if (q < 0.3) S.riv = { k: 'fichaje', i: top };
    else if (q < 0.42) S.riv = { k: 'bulo', i: -1 };
    else S.riv = { k: 'mitin', i: b };
    S.rblk = 1; S.wg = S.reg.map(() => 0); S.last = null;
    /* aprende: tu uso de cada acción (las semanas pasadas pesan la mitad cada vez); si abusas de una, la contrarresta */
    const H = S.hab = S.hab || {}, wk = S.wk || {};
    ACT_ORDER.forEach(a => { H[a] = (H[a] || 0) * 0.5 + (wk[a] || 0); });
    S.wk = {};
    const fav = ACT_ORDER.filter(a => a !== 'control').reduce((a, x) => ((H[x] || 0) > (H[a] || 0) ? x : a), 'mitin');
    S.adapt = S.w > 1 && (H[fav] || 0) >= ADAPT.th ? fav : null;
    /* frase de la semana: presume si va por delante, se excusa si va por detrás */
    const rv = S.reg.reduce((a, x) => a + x.r, 0) / S.reg.length;
    S.rq = pick(QUIPS[rv >= avg(S) ? 'up' : 'down'], rnd);
  }
  function rivalTurn(S, ch) {
    const V = S.riv || { k: 'mitin', i: 0 }, f = S.rblk == null ? 1 : S.rblk;
    const M = mods(ch, S), g = Math.round(M.rg * M.rm * f), st = Math.round(TUNE.steal * f);
    let rt = '', b = V.i;
    if (V.k === 'campana') {
      const gg = Math.max(1, Math.round(g / 3));
      S.reg.forEach(x => { if (x.r < TUNE.rcap) x.r = Math.min(TUNE.rcap, clamp(x.r + gg)); x.p = clamp(x.p - (f < 1 ? 0 : 1)); });
      rt = 'El rival lanza publicidad: +' + gg + ' en todas sus regiones.';
      b = S.reg.reduce((a, x, j) => (x.r > S.reg[a].r ? j : a), 0);
    } else if (V.k === 'ataque') {
      const q = st + Math.round(g * 0.3); S.reg[b].p = clamp(S.reg[b].p - q);
      rt = 'Campaña negativa del rival en ' + S.reg[b].n + ': pierdes ' + q + ' de apoyo.';
    } else if (V.k === 'fichaje') {
      const q = st + Math.round(g * 0.25), gg = Math.round(g * 0.5);
      S.reg[b].p = clamp(S.reg[b].p - q); S.reg[b].r = Math.min(TUNE.rcap, clamp(S.reg[b].r + gg));
      rt = 'El rival ficha a uno de tus cuadros en ' + S.reg[b].n + ': pierdes ' + q + ' de apoyo y él gana ' + gg + '.';
    } else if (V.k === 'bulo') {
      const s = Math.max(1, Math.round(g * 0.4 * f)), q = f < 1 ? 0 : 1;
      S.stab = clamp(S.stab + s); S.reg.forEach(x => { x.p = clamp(x.p - q); });
      rt = q ? 'El rival difunde un bulo sobre ti: la estabilidad sube ' + s + ' y pierdes ' + q + ' de apoyo en todas.' : 'El rival difunde un bulo sobre ti: la estabilidad sube ' + s + '.';
      b = S.reg.reduce((a, x, j) => (x.r > S.reg[a].r ? j : a), 0);
    } else {
      S.reg[b].r = Math.min(TUNE.rcap, clamp(S.reg[b].r + g)); S.reg[b].p = clamp(S.reg[b].p - st);
      rt = 'El rival crece en ' + S.reg[b].n + ' (+' + g + ') y te quita ' + st + ' de apoyo allí.';
    }
    /* el rival también ataca la región donde más apoyo tienes (si no es la anterior) */
    let t = 0; S.reg.forEach((x, j) => { if (j !== b && x.p > S.reg[t === b ? 0 : t].p) t = j; });
    if (t === b) t = (b + 1) % S.reg.length;
    S.reg[t].p = clamp(S.reg[t].p - TUNE.second);
    norm(S);
    const out = f < 1 ? [rt, 'Tu respuesta le restó fuerza al rival.'] : [rt];
    out.forEach(x => { S.log.unshift('S' + S.w + ': ' + x); if (S.rep) S.rep.push(x); }); S.log = S.log.slice(0, 40);
  }
  /* compromisos pendientes que vencen esta semana */
  function payPend(S, ch) {
    const due = (S.pend || []).filter(p => p.w <= S.w);
    S.pend = (S.pend || []).filter(p => p.w > S.w);
    due.forEach(p => { apply(S, ch, p.fx); say(S, 'Compromiso: ' + p.t); });
  }
  function endWeek(S, ch, meta, rnd) {
    if (S.over || S.dec) return;
    while (S.plan && S.plan.length && !S.over) runNext(S, ch, meta, rnd);   // lo que quede del plan (simulaciones o sin animar)
    S.rep = []; S.inEnd = true;
    rivalTurn(S, ch);
    const M = mods(ch, S);
    S.reg.forEach(x => { x.p = clamp(x.p - x.p * TUNE.decay * dOf(S).dc); });           // desgaste: el apoyo se enfría si no lo cuidas
    S.stab = clamp(S.stab + Math.round(avg(S) / 20 * M.sg * TUNE.stk));
    S.cap += M.inc;
    payPend(S, ch);
    const plato = Math.round(3 * S.W / BASE_WEEKS);
    if (S.w === plato) { S.dec = DEC_PLATO; return; }
    if (S.pool.includes(S.w)) {
      const left = DEC_POOL.map((d, j) => j).filter(j => !S.used.includes(j));
      if (left.length) { const j = left[Math.floor(rnd() * left.length)]; S.used.push(j); S.dec = DEC_POOL[j]; return; }
    }
    if ((S.rch || []).includes(S.w)) {     // reto del rival
      const left = RIV_DEC.map((d, j) => j).filter(j => !(S.rused || []).includes(j));
      if (left.length) { const j = left[Math.floor(rnd() * left.length)]; S.rused = (S.rused || []).concat(j); S.dec = RIV_DEC[j]; return; }
    }
    afterWeek(S, ch, meta, rnd);
  }
  /* signo de un efecto (para pintar el compromiso en verde o rojo) */
  const fxGood = fx => fx.reduce((a, e) => a + (e.k === 'p' || e.k === 'c' ? e.d : -e.d) * (e.r === ALL ? 6 : 1), 0) >= 0;
  function pickDec(S, ch, meta, j, rnd) {
    if (!S.dec) return;
    const o = S.dec.o[j], ok = rnd() < o.p, l = ok ? o.lg : o.lb;
    apply(S, ch, ok ? o.fg : o.fb);
    say(S, (ok ? 'Acierto: ' : 'Fallo: ') + (ok ? o.g : o.b));
    if (l && S.w + l.d <= S.W) { S.pend = S.pend || []; S.pend.push({ w: S.w + l.d, t: l.t, fx: l.fx, n: S.dec.t, good: fxGood(l.fx) }); say(S, 'Nuevo compromiso para la semana ' + (S.w + l.d) + '.'); }
    S.dec = null;
    afterWeek(S, ch, meta, rnd);
  }
  function afterWeek(S, ch, meta, rnd) {
    if (rnd() < TUNE.evp) { const e = EVS[Math.floor(rnd() * EVS.length)]; apply(S, ch, e.fx); say(S, e.t); }
    checkEnd(S, ch, meta);
    S.inEnd = false;
    if (S.over) return;
    S.w++; S.plan = []; rollOffer(S, meta, rnd); planRival(S, rnd);
    say(S, 'Semana ' + S.w + '. Planifica tus acciones: tienes ' + PC + ' puntos de campaña.');
  }

  /* hitos: al 1/3 y 2/3 del plazo hay que ir por buen camino; al final, 40 % de apoyo medio */
  function hitos(S) { return [Math.round(S.W / 3), Math.round(2 * S.W / 3)]; }
  function checkEnd(S, ch, meta) {
    const a = avg(S), big = S.reg.filter(x => x.p >= 40).length, [h1, h2] = hitos(S), D = dOf(S);
    if (S.stab >= 100) return finish(S, ch, meta, 'Derrota: la estabilidad democrática llega a 100.', 'stab');
    if (S.w === h1) {
      if (a < D.m1) return finish(S, ch, meta, 'Derrota en la semana ' + S.w + ': apoyo medio inferior al ' + D.m1 + ' %.', 'hito');
      S.ms = 1; say(S, 'Hito de la semana ' + S.w + ' superado.');
    }
    if (S.w === h2) {
      if (a < D.m2 || big < 2) return finish(S, ch, meta, 'Derrota en la semana ' + S.w + ': hacen falta ' + D.m2 + ' % de apoyo medio y 2 regiones por encima del 40 %.', 'hito');
      S.ms = 2; say(S, 'Hito de la semana ' + S.w + ' superado.');
    }
    if (S.w === S.W) {
      if (a >= D.goal) finish(S, ch, meta, 'Victoria: apoyo medio del ' + Math.round(a) + ' % en la semana ' + S.w + '.', 'win');
      else finish(S, ch, meta, 'Derrota en la semana ' + S.w + ': apoyo medio inferior al ' + D.goal + ' %.', 'hito');
    }
  }
  function finish(S, ch, meta, text, kind) {
    S.over = true; S.res = { won: kind === 'win', kind, di: S.di != null ? S.di : 1, text, avg: Math.round(avg(S)), stab: Math.round(S.stab), cap: Math.round(S.cap), w: S.w };
    say(S, text);
  }

  root.TURN = { LEAD_K, TUNE, REG0, ACT, ACT_ORDER, GOAL, BASE_WEEKS, AP, PC, PLAN_MAX, OFFER, COMBOS, RIV_CTR, rivCtr, ADAPT, QUIPS, offered, DIFF, SKILLS, SK_REQ, SK_NUM, LEAD_REQ, SLOT2, dOf, mods, newGame, upgrade, planAdd, planDel, planWhy, pcLeft, capLeft, comboNext, planCombo, comboOf, runNext, planRival, endWeek, pickDec, gain, costOf, probOf, unlockedOf, avg, hitos, apply, leaderOpen, diffOpen, skillOpen, slotsOf, record };
})(typeof window !== 'undefined' ? window : globalThis);
