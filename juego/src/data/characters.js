/* =========================================================
   Mayoría — Líderes políticos (solo datos, sin lógica)
   ---------------------------------------------------------
   baseStats
     contagioSpeed        1-10  velocidad de difusión          → globalContagionMult
     oppositionResist     1-10  resistencia a la oposición     → globalStabilityMult y globalNegMult
     skillCostMult        x     multiplicador de costes (1 = normal)
     ecoStability         1-10  solidez económica              → ritmo base del medidor propio
     inflationResistance  1-10  aguante frente al medidor      → globalInflationMult
   uniquePassive.modifiers usa el vocabulario del motor:
     af (afinidad por tipo de región), vol, hm, xb, capm, cap0, dm0, tl
   specialAbilities[]: ico icono · why cuándo conviene · con contrapartida · fx efecto (mismas claves que el árbol):
     g, xm, cap, negm, abm, dmc, gd, esb, medm, med2, medr, medrich, xb, af
   ========================================================= */
(function (root) {
  const CHARACTERS = [
    {
      id: 'tecno_baron',
      name: 'Tecno-Barón',
      partyName: 'Movimiento Singularidad Disruptiva',
      description: 'Promete subir la democracia a la nube en cuanto termine la beta. Nunca ha terminado una beta.',
      avatar: 'assets/images/characters/tecno_baron.png',
      themeColor: '#00F5D4',
      ui: { accent2: '#00BBF9', warn: '#7B2CBF', onAccent: '#0B0E14' },
      affinities: { u: 1.35, j: 1.35, r: 0.7, m: 0.8 },
      baseStats: { contagioSpeed: 8, oppositionResist: 3, skillCostMult: 1.08, ecoStability: 5, inflationResistance: 5 },
      uniquePassive: {
        name: 'Hype Exponencial',
        desc: 'Todos los eventos, buenos y malos, pesan un 50 % más.',
        modifiers: { vol: 1.5 }
      },
      specialAbilities: [
        { id: 'beta_perpetua', ico: 'bolt', why: 'Buena primera compra para el Tecno-Barón: su pasiva hace que los eventos pesen un 50 % más y esto amortigua los malos.', con: 'La mejora de difusión es modesta (+8 %).', tier: 1, name: 'Beta Perpetua', cost: 25, desc: 'Los fallos se venden como funciones: difusión +8 % y daño de eventos −15 %.', fx: { g: 1.08, negm: 0.85 } },
        { id: 'algoritmo_adictivo', ico: 'net', why: 'Cuando ya dominas tu zona y quieres saltar a otros continentes: abre enlaces de largo alcance.', con: 'Apenas ayuda en zonas rurales y entre mayores.', tier: 2, name: 'Algoritmo Adictivo', cost: 45, desc: 'El feed no te deja ir: +20 % en jóvenes, +10 % en urbanos y enlaces de largo alcance.', fx: { af: { j: 1.2, u: 1.1 }, med2: 1 } },
        { id: 'salida_a_bolsa', ico: 'coin', why: 'Si tu burbuja va baja y necesitas capital para cerrar la partida.', con: 'La burbuja crece un 25 % más rápido: vigílala de cerca.', tier: 3, name: 'Salida a Bolsa', cost: 70, desc: 'Capital fresco cada semana a cambio de inflar la burbuja: +1 capital/sem, burbuja +25 % más rápida.', fx: { cap: 1, xm: 1.25 } }
      ],
      quotes: [
        'No es una crisis, es un pivote.',
        'Nuestros votantes no son personas: son usuarios activos mensuales.',
        'He pedido a la IA que redacte la constitución. Va por la versión 0.3.'
      ]
    },
    {
      id: 'camarada_bio',
      name: 'Camarada Bio-Ecológica',
      partyName: 'Unión Raíz Suprema',
      description: 'Gobierna por consenso asambleario y compost colectivo. Las reuniones duran lo que tarda en germinar una lenteja.',
      avatar: 'assets/images/characters/camarada_bio.png',
      themeColor: '#38B000',
      ui: { accent2: '#70E000', warn: '#CCFF00', onAccent: '#0B0E14' },
      affinities: { r: 1.4, j: 1.1, u: 0.8, m: 0.9 },
      baseStats: { contagioSpeed: 4, oppositionResist: 7, skillCostMult: 0.92, ecoStability: 7, inflationResistance: 6 },
      uniquePassive: {
        name: 'Paciencia Orgánica',
        desc: 'Movimiento lento pero imparable: tiene hasta la semana 520 en lugar de la 400.',
        modifiers: { tl: 520 }
      },
      specialAbilities: [
        { id: 'huerto_asambleario', ico: 'tree', why: 'Convierte el campo, donde la Camarada ya es fuerte, en su bastión.', con: 'No ayuda nada en las ciudades.', tier: 1, name: 'Huerto Asambleario', cost: 20, desc: 'Cada parcela es una célula del movimiento: +20 % en zonas rurales.', fx: { af: { r: 1.2 } } },
        { id: 'red_de_semillas', ico: 'globe', why: 'Contra los cortafuegos estatales y para expandirte por las redes de medios.', con: 'Efecto lento: se nota a medio plazo.', tier: 2, name: 'Red de Semillas', cost: 40, desc: 'Intercambio de semillas y de panfletos: Redes de Medios +15 % y más resistencia a la censura.', fx: { medm: 1.15, medr: 1.33 } },
        { id: 'compost_ideologico', ico: 'shield', why: 'Para partidas largas: frena el agotamiento y amortigua los golpes de los eventos.', con: 'No acelera tu crecimiento.', tier: 3, name: 'Compost Ideológico', cost: 62, desc: 'Las derrotas se convierten en abono: daño de eventos −40 % y agotamiento un 15 % más lento.', fx: { negm: 0.6, xm: 0.85 } }
      ],
      quotes: [
        'Esta crisis la votaremos en asamblea. En primavera.',
        'El capitalismo es un monocultivo, compañeras.',
        'No perdimos las elecciones: las devolvimos a la tierra.'
      ]
    },
    {
      id: 'el_general',
      name: 'El General',
      partyName: 'Frente Tradición y Puño',
      description: 'Cree que el diálogo es un desfile en el que solo habla él. Tiene más medallas que propuestas.',
      avatar: 'assets/images/characters/el_general.png',
      themeColor: '#D90429',
      ui: { accent2: '#EF233C', warn: '#8D99AE', onAccent: '#FFFFFF' },
      affinities: { m: 1.3, r: 1.2, u: 0.9, j: 0.5 },
      baseStats: { contagioSpeed: 6, oppositionResist: 7, skillCostMult: 1.16, ecoStability: 4, inflationResistance: 5 },
      uniquePassive: {
        name: 'Lealtad de Cuartel',
        desc: 'Difusión +50 % en su país de origen, pero −15 % al cruzar fronteras.',
        modifiers: { hm: 1.5, xb: 0.85 }
      },
      specialAbilities: [
        { id: 'desfile_patriotico', ico: 'flag', why: 'Refuerza la base natural del General: los votantes mayores.', con: 'Los jóvenes siguen sin hacerle caso.', tier: 1, name: 'Desfile Patriótico', cost: 28, desc: 'Tanques, bandas y bocadillos gratis: +15 % en mayores y difusión +3 %.', fx: { af: { m: 1.15 }, g: 1.03 } },
        { id: 'toque_de_queda', ico: 'lock', why: 'Si usas mucho el Control de daños para frenar el descontento.', con: 'No suma apoyo por sí mismo.', tier: 2, name: 'Toque de Queda', cost: 48, desc: 'Nadie protesta si nadie sale: daño de eventos −30 % y Control de daños −20 %.', fx: { negm: 0.7, dmc: 0.8 } },
        { id: 'mano_dura_continental', ico: 'globe', why: 'Compensa su debilidad fuera de su país y además acerca la meta.', con: 'Cara: cuesta 75 en el último nivel.', tier: 3, name: 'Mano Dura Continental', cost: 75, desc: 'Las fronteras son una sugerencia: +15 % al cruzar fronteras y meta −2 puntos.', fx: { xb: 1.15, gd: 2 } }
      ],
      quotes: [
        '¡Firmes! Esto no es una crisis, es un ejercicio de maniobras.',
        'La oposición tiene derecho a opinar. En silencio.',
        'He mandado fusilar al consultor que me recomendó sonreír.'
      ]
    },
    {
      id: 'populista',
      name: 'El Populista',
      partyName: 'Coalición Pan y Circo',
      description: 'Promete bajar los impuestos, subir las pensiones y regalar un jamón por cabeza. Las cuentas las hará otro.',
      avatar: 'assets/images/characters/populista.png',
      themeColor: '#FF9F1C',
      ui: { accent2: '#FFBF69', warn: '#E63946', onAccent: '#0B0E14' },
      affinities: {},
      baseStats: { contagioSpeed: 9, oppositionResist: 5, skillCostMult: 1.0, ecoStability: 2, inflationResistance: 3 },
      uniquePassive: {
        name: 'Carisma de Barra de Bar',
        desc: 'Habla el idioma del pueblo: +10 % de difusión en urbanos y +20 % en zonas rurales.',
        modifiers: { af: { u: 1.1, r: 1.2 } }
      },
      specialAbilities: [
        { id: 'pan_para_hoy', ico: 'users', why: 'Primera compra natural del Populista: potencia a sus votantes de siempre.', con: 'Jóvenes y mayores no notan la diferencia.', tier: 1, name: 'Pan para Hoy', cost: 22, desc: 'Bocadillos en cada mitin: +15 % en urbanos y +10 % en rurales.', fx: { af: { u: 1.15, r: 1.1 } } },
        { id: 'circo_mediatico', ico: 'mega', why: 'Si usas los Subsidios masivos a menudo y quieres llegar a otros países por los medios.', con: 'La mejora es pequeña por cada lado.', tier: 2, name: 'Circo Mediático', cost: 38, desc: 'Un escándalo al día mantiene la audiencia: Redes de Medios +20 % y habilidad especial +10 %.', fx: { medm: 1.2, abm: 1.1 } },
        { id: 'hambre_para_manana', ico: 'warn', why: 'Para cerrar la partida rápido: la meta baja 3 puntos.', con: 'La inflación sube un 20 % más rápido: puedes perder por colapso económico.', tier: 3, name: 'Hambre para Mañana', cost: 58, desc: 'Todo vale para cruzar la meta: meta −3 puntos, pero la inflación sube un 20 % más rápido.', fx: { gd: 3, xm: 1.2 } }
      ],
      quotes: [
        '¡La inflación es un invento de los economistas!',
        'Si los números no cuadran, cambiaremos los números.',
        'Mi programa cabe en una servilleta. Por las dos caras.'
      ]
    },
    {
      id: 'baronesa_lobby',
      name: 'La Baronesa del Lobby',
      partyName: 'Inversiones Gobernanza S.A.',
      description: 'No necesita ganar las elecciones: ya ha comprado a los dos candidatos. Lleva perlas hasta para dormir.',
      avatar: 'assets/images/characters/baronesa_lobby.png',
      themeColor: '#9D4EDD',
      ui: { accent2: '#FFD700', warn: '#E0AAFF', onAccent: '#FFFFFF' },
      affinities: { u: 1.2, m: 1.3, j: 0.6, r: 0.6 },
      baseStats: { contagioSpeed: 5, oppositionResist: 7, skillCostMult: 1.32, ecoStability: 7, inflationResistance: 6 },
      uniquePassive: {
        name: 'Cartera Diversificada',
        desc: 'Ingresos +5 %, empieza con 20 de capital y el Control de daños parte de 20.',
        modifiers: { capm: 1.05, cap0: 20, dm0: 20 }
      },
      specialAbilities: [
        { id: 'cena_de_gala', ico: 'coin', why: 'Más capital cada semana: la Baronesa tiene costes altos y lo necesita.', con: 'No suma apoyo directamente.', tier: 1, name: 'Cena de Gala', cost: 30, desc: 'Cubierto de 5.000 euros, donación incluida: +0,8 capital por semana.', fx: { cap: 0.8 } },
        { id: 'puerta_giratoria', ico: 'door', why: 'Abarata el Control de daños y mejora la llegada a los países ricos, clave para su meta.', con: 'Solo rinde si usas el Control de daños o necesitas países ricos.', tier: 2, name: 'Puerta Giratoria', cost: 50, desc: 'Exministros en tu consejo: Control de daños −40 % y acuerdos +20 % en países ricos.', fx: { dmc: 0.6, medrich: 1.2 } },
        { id: 'captura_regulatoria', ico: 'bank', why: 'Acerca la victoria y estabiliza la economía a la vez.', con: 'La más cara de su árbol (80).', tier: 3, name: 'Captura Regulatoria', cost: 80, desc: 'Tú redactas las leyes que te vigilan: meta −3 puntos y +10 de estabilidad económica.', fx: { gd: 3, esb: 10 } }
      ],
      quotes: [
        'No es corrupción: es networking con factura.',
        'El pueblo ha hablado. Ahora hablarán mis abogados.',
        'Querido, la democracia es un activo como cualquier otro.'
      ]
    }
  ];

  root.CHARACTERS = CHARACTERS;
  if (typeof module !== 'undefined' && module.exports) module.exports = CHARACTERS;
})(typeof window !== 'undefined' ? window : globalThis);
