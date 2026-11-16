/* Catálogo inicial: 8 programas. Se carga desde el panel con «Cargar catálogo inicial».
   Contenido educativo general, pensado para que el fisioterapeuta lo revise y adapte antes de recomendarlo.
   Cada ejercicio: key, phase, name, goal, sets, reps, rest, pain, errors[], pose[inicio, final], video (opcional). */
const PAIN = "≤ 3/10 y que ceda en 24 h";
const SEED_PRODUCTS = [
  {
    title: "Tendinopatía rotuliana", body_region: "Rodilla", pathology_type: "Tendinopatías", price_cents: 1900,
    description: "Programa de carga progresiva para el dolor en el tendón rotuliano, de los isométricos al salto.",
    sheet: {
      what_is: "Es un dolor localizado justo debajo de la rótula que aparece cuando el tendón recibe más carga de la que tolera, sobre todo al saltar, frenar o bajar escaleras. No es una inflamación que haya que «apagar» con reposo: el tendón necesita carga bien dosificada para volver a tolerar el esfuerzo. El reposo completo alivia a corto plazo, pero le quita capacidad.",
      duration: "de 3 a 6 meses, con mejoría apreciable a partir de las 6–8 semanas",
      phases: [
        { name: "Control de síntomas", weeks: "Semanas 1–3", goals: ["Reducir el dolor con isométricos", "Ajustar la carga deportiva sin parar del todo", "Quitar temporalmente saltos y sprints"] },
        { name: "Fuerza base", weeks: "Semanas 3–12", goals: ["Ganar fuerza con cargas pesadas y lentas", "Trabajar cuádriceps, glúteo y gemelo", "Tolerar sentadilla y zancada sin repunte de dolor"] },
        { name: "Readaptación al salto", weeks: "A partir de la semana 12", goals: ["Reintroducir saltos y cambios de ritmo", "Subir volumen deportivo de forma gradual", "Mantener dos sesiones de fuerza a la semana"] }
      ],
      red_flags: ["Rodilla hinchada, caliente o que se bloquea", "Dolor nocturno o en reposo que no cede", "Chasquido brusco con incapacidad para extender la rodilla", "Dolor que empeora semana tras semana pese a reducir la carga"],
      advice: ["Evalúa el dolor al día siguiente con una prueba fija, por ejemplo una sentadilla a una pierna: si no ha empeorado, la carga fue correcta.", "Es preferible reducir el deporte a pararlo por completo.", "La progresión se decide por tolerancia, no por calendario."],
      sources: ["Malliaras P. et al. Patellar tendinopathy: clinical diagnosis, load management, and advice for challenging case presentations. JOSPT, 2015.", "Rio E. et al. Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy. Br J Sports Med, 2015."],
      exercises: [
        { key: "iso-pared", phase: 1, name: "Sentadilla isométrica en pared", goal: "Aliviar el dolor y empezar a cargar el tendón sin movimiento.", sets: "5", reps: "45 s mantenidos", rest: "2 min", pain: PAIN, errors: ["Bajar más de lo que toleras", "Aguantar la respiración", "Dejar que las rodillas se junten"], pose: ["stand", "wallsit"] },
        { key: "ext-rodilla", phase: 1, name: "Extensión de rodilla isométrica sentado", goal: "Activar el cuádriceps con carga controlada.", sets: "4", reps: "30–45 s mantenidos", rest: "90 s", pain: PAIN, errors: ["Levantar el muslo de la silla", "Bloquear la rodilla con un tirón"], pose: ["chairsit", "kneeext"] },
        { key: "sentadilla-lenta", phase: 2, name: "Sentadilla lenta con carga", goal: "Aumentar la capacidad del tendón con carga pesada y ritmo lento.", sets: "3–4", reps: "8–12 (3 s bajar, 3 s subir)", rest: "2–3 min", pain: PAIN, errors: ["Rebotar abajo", "Subir la carga y perder el ritmo lento", "Cargar más peso en la pierna sana"], pose: ["stand", "squat"] },
        { key: "zancada", phase: 2, name: "Zancada estática", goal: "Fortalecer cada pierna por separado.", sets: "3", reps: "8–10 por pierna", rest: "2 min", pain: PAIN, errors: ["Dejar caer la rodilla hacia dentro", "Inclinar el tronco en exceso"], pose: ["stand", "splitsquat"] },
        { key: "escalon", phase: 2, name: "Descenso controlado desde escalón", goal: "Controlar la frenada, que es la fase que más exige al tendón.", sets: "3", reps: "8 por pierna, 4 s de bajada", rest: "2 min", pain: PAIN, errors: ["Caer en lugar de frenar", "Girar la pelvis"], pose: ["stand", "stepdown"] },
        { key: "saltos", phase: 3, name: "Saltos con recepción suave", goal: "Reentrenar el almacenamiento y liberación de energía.", sets: "3", reps: "6–8", rest: "2 min", pain: PAIN, errors: ["Empezar antes de tolerar la fuerza pesada", "Aterrizar con las rodillas rígidas", "Hacerlos dos días seguidos al principio"], pose: ["squat", "hop"] }
      ]
    }
  },
  {
    title: "Lumbalgia inespecífica", body_region: "Columna dorsal/lumbar", pathology_type: "Prevención y ergonomía", price_cents: 1900,
    description: "Movimiento, educación y fuerza progresiva para el dolor lumbar sin causa estructural grave.",
    sheet: {
      what_is: "Es el dolor en la zona baja de la espalda que no se explica por una lesión grave concreta. Es el tipo más frecuente y, en la gran mayoría de casos, la espalda está sana y es fuerte: el dolor refleja una zona sensibilizada, no un daño proporcional. Mantenerte activo acelera la recuperación; el reposo en cama la retrasa.",
      duration: "la mayoría de episodios mejora claramente en 2–6 semanas",
      phases: [
        { name: "Control de síntomas", weeks: "Días 1–10", goals: ["Seguir moviéndote dentro de lo tolerable", "Caminar varias veces al día", "Encontrar posturas y movimientos de alivio"] },
        { name: "Movilidad y fuerza base", weeks: "Semanas 2–6", goals: ["Recuperar la confianza al flexionar y girar", "Fortalecer glúteos y tronco", "Volver a las tareas habituales"] },
        { name: "Readaptación funcional", weeks: "A partir de la semana 6", goals: ["Levantar peso con progresión", "Recuperar deporte y trabajo físico", "Mantener ejercicio regular para prevenir recaídas"] }
      ],
      red_flags: ["Pérdida de control de la orina o las heces, o adormecimiento en la zona genital o perianal", "Debilidad progresiva en una o ambas piernas", "Fiebre, pérdida de peso sin motivo o antecedente de cáncer", "Dolor tras una caída o golpe importante", "Dolor nocturno constante que no cambia con la postura"],
      advice: ["No existe una postura perfecta: lo que ayuda es cambiar de postura con frecuencia.", "Flexionar la espalda no es peligroso; se reentrena igual que cualquier otro movimiento.", "Dormir bien, moverte y reducir el estrés influyen tanto como los ejercicios."],
      sources: ["NICE. Low back pain and sciatica in over 16s: assessment and management (NG59), 2016, actualizada en 2020.", "Foster N.E. et al. Prevention and treatment of low back pain: evidence, challenges, and promising directions. The Lancet, 2018."],
      exercises: [
        { key: "caminar", phase: 1, name: "Caminar a ritmo cómodo", goal: "Mantener la actividad y reducir la sensibilidad de la zona.", sets: "2–3 al día", reps: "10–20 min", rest: "—", pain: PAIN, errors: ["Esperar a no tener dolor para empezar", "Caminar rígido, sin mover los brazos"], pose: ["stride"] },
        { key: "gato", phase: 1, name: "Movilidad en cuadrupedia", goal: "Recuperar el movimiento de flexión y extensión sin miedo.", sets: "2", reps: "10–12 lentas", rest: "30 s", pain: PAIN, errors: ["Forzar el final del recorrido", "Moverte deprisa"], pose: ["quadruped", "catflex"] },
        { key: "puente", phase: 2, name: "Puente de glúteo", goal: "Fortalecer glúteos y musculatura posterior.", sets: "3", reps: "10–15", rest: "60 s", pain: PAIN, errors: ["Arquear la zona lumbar para subir más", "Empujar con los dedos en vez de con los talones"], pose: ["hooklying", "bridge"] },
        { key: "bird-dog", phase: 2, name: "Brazo y pierna contrarios", goal: "Ganar control del tronco mientras se mueven las extremidades.", sets: "3", reps: "8 por lado, 3 s arriba", rest: "60 s", pain: PAIN, errors: ["Girar la pelvis", "Elevar la pierna por encima de la cadera"], pose: ["quadruped", "birddog"] },
        { key: "bisagra", phase: 3, name: "Bisagra de cadera con carga", goal: "Reaprender a levantar peso y cargar la espalda de forma progresiva.", sets: "3", reps: "8–10", rest: "2 min", pain: PAIN, errors: ["Empezar con demasiado peso", "Convertirlo en una sentadilla", "Evitar por miedo cualquier flexión de espalda"], pose: ["stand", "hinge"] },
        { key: "sentadilla", phase: 3, name: "Sentadilla", goal: "Recuperar un gesto básico del día a día con fuerza.", sets: "3", reps: "10–12", rest: "90 s", pain: PAIN, errors: ["Contener la respiración", "Bajar solo hasta donde no hay ninguna molestia aunque sea tolerable"], pose: ["stand", "squat"] }
      ]
    }
  },
  {
    title: "Esguince lateral de tobillo", body_region: "Tobillo/pie", pathology_type: "Lesiones ligamentosas/articulares", price_cents: 1900,
    description: "De la protección inicial al retorno al deporte, con trabajo de movilidad, fuerza y equilibrio.",
    sheet: {
      what_is: "Es la lesión de los ligamentos de la cara externa del tobillo, normalmente al torcerlo hacia dentro. Es muy frecuente y suele evolucionar bien, pero si no se rehabilita deja inestabilidad y recaídas. El tobillo necesita carga temprana y progresiva: apoyar y moverlo pronto, dentro de lo tolerable, mejora el resultado.",
      duration: "de 2 a 6 semanas en esguinces leves; hasta 12 semanas en los moderados",
      phases: [
        { name: "Protección y carga temprana", weeks: "Días 1–7", goals: ["Proteger sin inmovilizar del todo", "Elevar y comprimir para la hinchazón", "Apoyar el pie en cuanto se tolere"] },
        { name: "Movilidad y fuerza base", weeks: "Semanas 1–4", goals: ["Recuperar la flexión dorsal", "Fortalecer gemelo y peroneos", "Caminar sin cojear"] },
        { name: "Equilibrio y retorno", weeks: "Semanas 4–12", goals: ["Entrenar el equilibrio a una pierna", "Reintroducir carrera, saltos y cambios de dirección", "Volver al deporte con pruebas superadas"] }
      ],
      red_flags: ["No poder dar cuatro pasos apoyando el pie", "Dolor al presionar los huesos del tobillo o el borde del pie", "Deformidad visible, o pie frío, pálido o dormido", "Hinchazón o dolor en la pantorrilla que va a más"],
      advice: ["Los antiinflamatorios y el hielo alivian, pero no aceleran la curación; úsalos solo si lo necesitas.", "Volver al deporte sin entrenar el equilibrio es la causa más habitual de recaída.", "Una tobillera o vendaje en el retorno deportivo reduce el riesgo de un nuevo esguince."],
      sources: ["Vuurberg G. et al. Diagnosis, treatment and prevention of ankle sprains: update of an evidence-based clinical guideline. Br J Sports Med, 2018.", "Dubois B., Esculier J.F. Soft-tissue injuries simply need PEACE and LOVE. Br J Sports Med, 2020."],
      exercises: [
        { key: "rodilla-pared", phase: 1, name: "Rodilla a la pared", goal: "Recuperar la flexión dorsal del tobillo en carga.", sets: "3", reps: "10 por lado", rest: "30 s", pain: PAIN, errors: ["Levantar el talón del suelo", "Dejar que la rodilla se vaya hacia dentro"], pose: ["stand", "kneewall"] },
        { key: "talones", phase: 2, name: "Elevación de talones", goal: "Fortalecer el gemelo y el sóleo.", sets: "3", reps: "12–15, primero a dos pies", rest: "60 s", pain: PAIN, errors: ["Caer en la bajada", "Volcar el peso hacia el borde externo del pie"], pose: ["heellow", "heelhigh"] },
        { key: "equilibrio", phase: 2, name: "Equilibrio a una pierna", goal: "Recuperar la estabilidad y los reflejos del tobillo.", sets: "3", reps: "30–45 s por pierna", rest: "30 s", pain: PAIN, errors: ["Mirarte el pie todo el rato", "No progresar: añade ojos cerrados o superficie blanda"], pose: ["stand", "balance"] },
        { key: "zancada", phase: 2, name: "Zancada estática", goal: "Cargar el tobillo en un gesto funcional.", sets: "3", reps: "10 por pierna", rest: "90 s", pain: PAIN, errors: ["Acortar el paso para evitar doblar el tobillo", "Perder el apoyo del talón delantero"], pose: ["stand", "splitsquat"] },
        { key: "saltos", phase: 3, name: "Saltos y recepciones", goal: "Preparar el tobillo para correr y cambiar de dirección.", sets: "3", reps: "8, de dos pies a un pie", rest: "90 s", pain: PAIN, errors: ["Empezar antes de caminar sin cojera", "Aterrizar con el pie rígido"], pose: ["squat", "hop"] }
      ]
    }
  },
  {
    title: "Dolor subacromial de hombro", body_region: "Hombro", pathology_type: "Tendinopatías", price_cents: 1900,
    description: "Ejercicio progresivo para el dolor de hombro relacionado con el manguito rotador.",
    sheet: {
      what_is: "Es el dolor en la cara externa del hombro al levantar el brazo, vestirse o dormir sobre ese lado, relacionado con los tendones del manguito rotador. Antes se explicaba como un «pinzamiento», pero hoy se entiende como un problema de tolerancia a la carga de esos tendones. El ejercicio progresivo es el tratamiento de primera elección y obtiene resultados comparables a la cirugía en la mayoría de casos.",
      duration: "unas 12 semanas de ejercicio constante; algunos casos necesitan 6 meses",
      phases: [
        { name: "Control de síntomas", weeks: "Semanas 1–3", goals: ["Reducir el dolor con isométricos", "Modificar, sin eliminar, los gestos que duelen", "Mantener el brazo en uso"] },
        { name: "Movilidad y fuerza base", weeks: "Semanas 3–8", goals: ["Fortalecer manguito y musculatura escapular", "Recuperar la elevación completa", "Dormir mejor sobre el hombro"] },
        { name: "Readaptación funcional", weeks: "Semanas 8–12 y siguientes", goals: ["Cargar por encima de la cabeza", "Recuperar deporte o trabajo con el brazo en alto", "Mantener la fuerza dos veces por semana"] }
      ],
      red_flags: ["Pérdida brusca de fuerza para levantar el brazo tras una caída o tirón", "Hombro caliente, enrojecido o con fiebre", "Dolor de hombro con dolor en el pecho, falta de aire o mareo", "Deformidad visible o imposibilidad total de mover el brazo"],
      advice: ["Que duela un poco al ejercitar no significa que el tendón se dañe.", "Los hallazgos de una ecografía o resonancia son frecuentes en hombros sin dolor.", "La constancia durante 12 semanas pesa más que el ejercicio concreto que elijas."],
      sources: ["Diercks R. et al. Guideline for diagnosis and treatment of subacromial pain syndrome. Acta Orthopaedica, 2014.", "Littlewood C. et al. Exercise for rotator cuff tendinopathy: a systematic review. Physiotherapy, 2012."],
      exercises: [
        { key: "iso-pared", phase: 1, name: "Empuje isométrico contra la pared", goal: "Aliviar el dolor activando el manguito sin movimiento.", sets: "4", reps: "30 s mantenidos", rest: "60 s", pain: PAIN, errors: ["Empujar con el cuerpo en vez de con el brazo", "Encoger el hombro hacia la oreja"], pose: ["stand", "wallpush"] },
        { key: "remo", phase: 2, name: "Remo con goma", goal: "Fortalecer la musculatura que estabiliza la escápula.", sets: "3", reps: "12–15", rest: "60 s", pain: PAIN, errors: ["Encoger los hombros", "Tirar con un golpe y soltar sin control"], pose: ["rowstart", "rowend"] },
        { key: "rot-externa", phase: 2, name: "Rotación externa tumbado de lado", goal: "Fortalecer los rotadores externos del manguito.", sets: "3", reps: "10–12 con peso ligero", rest: "60 s", pain: PAIN, errors: ["Separar el codo del costado", "Usar demasiado peso y girar el tronco"], pose: ["sidelying", "sideer"] },
        { key: "elevacion", phase: 2, name: "Elevación del brazo en el plano de la escápula", goal: "Recuperar la elevación con carga progresiva.", sets: "3", reps: "10–12", rest: "90 s", pain: PAIN, errors: ["Subir el hombro antes que el brazo", "Bajar dejando caer el peso"], pose: ["armdown", "armraise"] },
        { key: "pared", phase: 3, name: "Deslizamiento en pared", goal: "Controlar el hombro por encima de la cabeza.", sets: "3", reps: "10", rest: "60 s", pain: PAIN, errors: ["Arquear la espalda para llegar más alto", "Perder el contacto de los antebrazos con la pared"], pose: ["wallpush", "wallslide"] }
      ]
    }
  },
  {
    title: "Cervicalgia postural", body_region: "Columna cervical", pathology_type: "Prevención y ergonomía", price_cents: 1900,
    description: "Movilidad y fuerza de cuello y espalda alta para el dolor cervical ligado a posturas mantenidas.",
    sheet: {
      what_is: "Es el dolor y la rigidez de cuello que aparecen tras muchas horas en la misma posición, sobre todo frente a pantallas, sin una lesión grave que lo explique. El problema no suele ser una «mala postura», sino permanecer demasiado tiempo en cualquiera de ellas. El cuello responde bien al movimiento frecuente y al fortalecimiento.",
      duration: "mejoría habitual en 2–6 semanas; la fuerza necesita 8–12 semanas",
      phases: [
        { name: "Control de síntomas", weeks: "Semanas 1–2", goals: ["Mover el cuello con suavidad varias veces al día", "Interrumpir la postura cada 30–45 minutos", "Reducir la tensión mantenida de hombros"] },
        { name: "Movilidad y fuerza base", weeks: "Semanas 2–8", goals: ["Fortalecer la musculatura profunda del cuello", "Fortalecer la espalda alta y las escápulas", "Recuperar el giro completo"] },
        { name: "Readaptación funcional", weeks: "A partir de la semana 8", goals: ["Tolerar la jornada sin dolor", "Añadir carga con gomas o pesas", "Mantener ejercicio general regular"] }
      ],
      red_flags: ["Dolor tras un accidente o golpe en la cabeza o el cuello", "Hormigueo, pérdida de fuerza o torpeza en brazos o manos", "Mareo intenso, visión doble, dificultad para hablar o tragar", "Fiebre con rigidez de cuello", "Dolor de cabeza brusco y muy intenso, distinto a los habituales"],
      advice: ["Ajusta la pantalla a la altura de los ojos, pero prioriza levantarte y moverte.", "El estrés y dormir poco aumentan la tensión cervical.", "La fuerza de espalda alta y hombros protege al cuello."],
      sources: ["Blanpied P.R. et al. Neck pain: revision 2017. Clinical practice guidelines. JOSPT, 2017.", "Gross A. et al. Exercises for mechanical neck disorders. Cochrane Database of Systematic Reviews, 2015."],
      exercises: [
        { key: "menton", phase: 1, name: "Retracción de mentón", goal: "Activar la musculatura profunda del cuello.", sets: "3", reps: "10, manteniendo 5 s", rest: "30 s", pain: PAIN, errors: ["Bajar la barbilla al pecho en lugar de llevarla atrás", "Apretar la mandíbula"], pose: ["chairsit", "chintuck"] },
        { key: "pausa", phase: 1, name: "Pausa activa: levantarse y estirarse", goal: "Romper la postura mantenida.", sets: "Cada 30–45 min", reps: "1 min de movimiento", rest: "—", pain: PAIN, errors: ["Esperar a que aparezca el dolor", "Hacerlo solo los días malos"], pose: ["chairsit", "stand"] },
        { key: "remo", phase: 2, name: "Remo con goma", goal: "Fortalecer la espalda alta y la musculatura escapular.", sets: "3", reps: "12–15", rest: "60 s", pain: PAIN, errors: ["Adelantar la cabeza al tirar", "Encoger los hombros"], pose: ["rowstart", "rowend"] },
        { key: "pared", phase: 2, name: "Deslizamiento en pared", goal: "Mejorar la movilidad de hombros y espalda dorsal.", sets: "3", reps: "10", rest: "60 s", pain: PAIN, errors: ["Arquear la zona lumbar", "Subir los hombros hacia las orejas"], pose: ["wallpush", "wallslide"] },
        { key: "cuadrupedia", phase: 2, name: "Movilidad de columna en cuadrupedia", goal: "Mover la zona dorsal, que suele estar rígida.", sets: "2", reps: "10–12", rest: "30 s", pain: PAIN, errors: ["Mover solo la zona lumbar", "Hundir la cabeza entre los hombros"], pose: ["quadruped", "catflex"] }
      ]
    }
  },
  {
    title: "Fascitis plantar", body_region: "Tobillo/pie", pathology_type: "Tendinopatías", price_cents: 1900,
    description: "Carga progresiva y estiramientos específicos para el dolor en el talón y la planta del pie.",
    sheet: {
      what_is: "Es el dolor en la base del talón, peor en los primeros pasos de la mañana o tras estar sentado. Hoy se considera una sobrecarga de la fascia plantar más que una inflamación: el tejido ha recibido más carga de la que tolera. Mejora con paciencia, ajustando la carga y fortaleciéndola de forma progresiva.",
      duration: "mejoría en 6–12 semanas; la resolución completa puede tardar varios meses",
      phases: [
        { name: "Control de síntomas", weeks: "Semanas 1–3", goals: ["Reducir temporalmente las horas de pie y los impactos", "Estirar la fascia a diario", "Usar calzado cómodo y con algo de amortiguación"] },
        { name: "Fuerza base", weeks: "Semanas 3–12", goals: ["Fortalecer la fascia y el gemelo con carga lenta y pesada", "Fortalecer la musculatura propia del pie", "Caminar sin dolor matutino intenso"] },
        { name: "Readaptación funcional", weeks: "A partir de la semana 12", goals: ["Reintroducir carrera y saltos", "Aumentar distancias de forma gradual", "Mantener el trabajo de fuerza"] }
      ],
      red_flags: ["Dolor tras un salto o caída con imposibilidad de apoyar", "Talón hinchado, caliente o enrojecido", "Hormigueo, quemazón o adormecimiento en el pie", "Dolor nocturno o en reposo que no cede"],
      advice: ["El dolor matutino es el mejor termómetro: si mejora semana a semana, vas bien.", "Las taloneras o plantillas pueden aliviar a corto plazo mientras fortaleces.", "Aumentar de golpe las horas de pie o los kilómetros es el desencadenante más habitual."],
      sources: ["Martin R.L. et al. Heel pain – plantar fasciitis: revision 2014. Clinical practice guidelines. JOSPT, 2014.", "Rathleff M.S. et al. High-load strength training improves outcome in patients with plantar fasciitis. Scand J Med Sci Sports, 2015."],
      exercises: [
        { key: "estiramiento-gemelo", phase: 1, name: "Estiramiento de gemelo en pared", goal: "Reducir la tensión de la cadena posterior de la pierna.", sets: "3", reps: "30 s por pierna", rest: "20 s", pain: PAIN, errors: ["Levantar el talón de atrás", "Girar el pie hacia fuera"], pose: ["stand", "calfstretch"] },
        { key: "rodilla-pared", phase: 1, name: "Rodilla a la pared", goal: "Ganar flexión dorsal de tobillo.", sets: "3", reps: "10 por lado", rest: "30 s", pain: PAIN, errors: ["Despegar el talón", "Hundir el arco del pie"], pose: ["stand", "kneewall"] },
        { key: "talones-toalla", phase: 2, name: "Elevación de talones con toalla bajo los dedos", goal: "Cargar la fascia plantar de forma lenta y progresiva.", sets: "3", reps: "12 (3 s subir, 2 s arriba, 3 s bajar), en días alternos", rest: "2 min", pain: PAIN, errors: ["Hacerlo deprisa", "No añadir peso cuando ya resulta fácil"], pose: ["heellow", "heelhigh"] },
        { key: "equilibrio", phase: 2, name: "Equilibrio a una pierna con arco activo", goal: "Fortalecer la musculatura propia del pie.", sets: "3", reps: "30–45 s por pierna", rest: "30 s", pain: PAIN, errors: ["Agarrar el suelo con los dedos", "Dejar caer el arco hacia dentro"], pose: ["stand", "balance"] },
        { key: "carrera", phase: 3, name: "Retorno progresivo a caminar rápido y correr", goal: "Recuperar la tolerancia al impacto.", sets: "3 días por semana", reps: "Intervalos de 1 min de trote y 2 min caminando", rest: "Un día entre sesiones", pain: PAIN, errors: ["Subir más de un 10–20 % de carga por semana", "Correr dos días seguidos al principio"], pose: ["stride"] }
      ]
    }
  },
  {
    title: "Rotura fibrilar de isquiotibiales", body_region: "Cadera/pelvis", pathology_type: "Lesiones musculares", price_cents: 1900,
    description: "Del primer día a la vuelta a correr, con énfasis en el trabajo excéntrico y en alargamiento.",
    sheet: {
      what_is: "Es la lesión de las fibras de los músculos de la parte posterior del muslo, típica al esprintar o al estirar la pierna con fuerza. Se nota como un pinchazo brusco. El músculo cicatriza bien si se le da carga progresiva desde los primeros días; el reposo prolongado deja una cicatriz débil y aumenta el riesgo de recaída.",
      duration: "2–4 semanas en lesiones leves; 4–8 semanas en las moderadas",
      phases: [
        { name: "Protección y carga temprana", weeks: "Días 1–7", goals: ["Caminar con normalidad cuanto antes", "Isométricos suaves sin dolor", "Evitar estiramientos forzados"] },
        { name: "Fuerza base", weeks: "Semanas 1–4", goals: ["Fortalecer en rangos cada vez más largos", "Introducir el trabajo excéntrico", "Trotar sin dolor"] },
        { name: "Retorno a la carrera", weeks: "Semanas 3–8", goals: ["Progresar la velocidad de carrera por tramos", "Recuperar la fuerza comparada con la otra pierna", "Esprintar al 100 % antes de competir"] }
      ],
      red_flags: ["Hematoma extenso con un hueco palpable en el músculo", "Imposibilidad de caminar o de doblar la rodilla contra resistencia", "Dolor junto al hueso de la nalga tras un chasquido fuerte", "Pantorrilla hinchada, caliente y dolorosa"],
      advice: ["Volver a esprintar demasiado pronto es la causa principal de recaída.", "Los ejercicios en alargamiento reducen el riesgo de nuevas lesiones.", "La vuelta al deporte se decide por pruebas superadas, no por fechas."],
      sources: ["Askling C.M. et al. Acute hamstring injuries in Swedish elite football: a prospective randomised controlled clinical trial comparing two rehabilitation protocols. Br J Sports Med, 2013.", "Hickey J.T. et al. Hamstring strain injury rehabilitation. Journal of Athletic Training, 2022."],
      exercises: [
        { key: "puente-iso", phase: 1, name: "Puente isométrico", goal: "Activar los isquiotibiales sin estirar la zona lesionada.", sets: "4", reps: "20–30 s mantenidos", rest: "60 s", pain: PAIN, errors: ["Subir la cadera arqueando la espalda", "Empezar con los pies demasiado lejos"], pose: ["hooklying", "bridge"] },
        { key: "puente-una", phase: 2, name: "Puente a una pierna", goal: "Aumentar la carga sobre la pierna lesionada.", sets: "3", reps: "8–12 por pierna", rest: "90 s", pain: PAIN, errors: ["Dejar caer la pelvis del lado libre", "Impulsarte con un tirón"], pose: ["bridge", "bridge1"] },
        { key: "puente-largo", phase: 2, name: "Puente con talones alejados", goal: "Fortalecer el músculo en posición alargada.", sets: "3", reps: "8–10, bajando en 4 s", rest: "90 s", pain: PAIN, errors: ["Alejar los pies más de lo tolerable", "Perder la altura de la cadera"], pose: ["bridge", "bridgeslide"] },
        { key: "bisagra", phase: 2, name: "Bisagra de cadera con carga", goal: "Trabajo excéntrico de isquiotibiales en un gesto funcional.", sets: "3", reps: "8–10, bajando en 3 s", rest: "2 min", pain: PAIN, errors: ["Redondear la espalda para llegar más abajo", "Doblar tanto las rodillas que se convierte en sentadilla"], pose: ["stand", "hinge"] },
        { key: "carrera", phase: 3, name: "Carrera progresiva por tramos", goal: "Recuperar la velocidad de forma gradual.", sets: "6–8 tramos", reps: "40–60 m, del 50 % al 90 % de velocidad a lo largo de las semanas", rest: "Volver andando", pain: "Sin dolor: 0/10 al acelerar", errors: ["Saltar del trote al sprint", "Subir la velocidad con molestias el día anterior"], pose: ["stride"] }
      ]
    }
  },
  {
    title: "Recuperación de suelo pélvico", body_region: "Suelo pélvico", pathology_type: "Prevención y ergonomía", price_cents: 1900,
    description: "Entrenamiento de la musculatura del suelo pélvico para las pérdidas de orina y la recuperación tras el parto.",
    sheet: {
      what_is: "El suelo pélvico es el conjunto de músculos que cierra la pelvis por abajo y sostiene la vejiga, el útero y el recto. Cuando pierde fuerza o coordinación pueden aparecer pérdidas de orina al toser, reír o saltar, o sensación de peso. Como cualquier músculo, se entrena: el ejercicio supervisado es el tratamiento de primera elección para la incontinencia de esfuerzo.",
      duration: "al menos 12 semanas de entrenamiento diario para notar cambios estables",
      phases: [
        { name: "Conciencia y control", weeks: "Semanas 1–3", goals: ["Localizar y contraer correctamente la musculatura", "Aprender a relajar del todo tras cada contracción", "Coordinar con la respiración"] },
        { name: "Fuerza y resistencia", weeks: "Semanas 3–12", goals: ["Aumentar el tiempo de contracción mantenida", "Añadir contracciones rápidas", "Entrenar sentada y de pie"] },
        { name: "Integración funcional", weeks: "A partir de la semana 12", goals: ["Contraer antes de toser, estornudar o levantar peso", "Volver al impacto de forma gradual", "Mantener un programa de sostén"] }
      ],
      red_flags: ["Sensación de bulto o peso en la vagina que va a más", "Dolor pélvico, o dolor durante los ejercicios o las relaciones", "Sangre en la orina, escozor o fiebre", "Dificultad para vaciar la vejiga o pérdida brusca del control de esfínteres", "Tras el parto: sangrado abundante, fiebre o dolor intenso en la herida"],
      advice: ["Si no notas la contracción o tienes dolor, necesitas una valoración individual: apretar más no siempre es lo indicado.", "No practiques cortando el chorro de orina; sirve como prueba puntual, no como ejercicio.", "Evita empujar hacia abajo o contener la respiración al contraer."],
      sources: ["Dumoulin C. et al. Pelvic floor muscle training versus no treatment, or inactive control treatments, for urinary incontinence in women. Cochrane Database of Systematic Reviews, 2018.", "NICE. Pelvic floor dysfunction: prevention and non-surgical management (NG210), 2021."],
      exercises: [
        { key: "respiracion", phase: 1, name: "Respiración diafragmática tumbada", goal: "Coordinar respiración y suelo pélvico, y aprender a relajarlo.", sets: "2", reps: "8–10 respiraciones lentas", rest: "—", pain: "Sin dolor", errors: ["Empujar el abdomen hacia fuera con fuerza", "Contener el aire"], pose: ["hooklying"] },
        { key: "lentas", phase: 1, name: "Contracciones mantenidas", goal: "Ganar fuerza y resistencia.", sets: "3 al día", reps: "8–12, manteniendo 6–8 s y relajando otros tantos", rest: "1 min", pain: "Sin dolor", errors: ["Apretar glúteos o muslos", "No relajar del todo entre repeticiones", "Empujar hacia abajo"], pose: ["hooklying"] },
        { key: "rapidas", phase: 2, name: "Contracciones rápidas sentada", goal: "Mejorar la respuesta ante la tos o el estornudo.", sets: "3 al día", reps: "10 contracciones de 1 s", rest: "1 min", pain: "Sin dolor", errors: ["Perder calidad por ir deprisa", "Contener la respiración"], pose: ["chairsit"] },
        { key: "puente", phase: 2, name: "Puente con activación previa", goal: "Integrar el suelo pélvico con glúteos y abdomen.", sets: "3", reps: "10, contrayendo antes de subir", rest: "60 s", pain: "Sin dolor", errors: ["Subir sin contraer antes", "Arquear la zona lumbar"], pose: ["hooklying", "bridge"] },
        { key: "sentadilla", phase: 3, name: "Sentadilla con contracción anticipada", goal: "Trasladar el control a los esfuerzos del día a día.", sets: "3", reps: "10, soltando el aire y contrayendo al subir", rest: "90 s", pain: "Sin dolor ni pérdidas", errors: ["Aguantar el aire y empujar", "Añadir impacto antes de controlar este gesto"], pose: ["squat", "stand"] }
      ]
    }
  }
];
