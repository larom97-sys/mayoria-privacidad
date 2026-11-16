/* Mayoría — traducciones de los textos añadidos (rachas, objetivo semanal, noche electoral, ritmo rápido) */
(function (root) {
  const D = root.I18N_DICT = root.I18N_DICT || {};
  const ADD = {
    en: {
      "Próximo desbloqueo:": "Next unlock:", "Segunda habilidad inicial": "Second starting skill",
      "Te falta {0} victoria": "{0} win to go", "Te faltan {0} victorias": "{0} wins to go",
      "Esta semana": "This week", "Semanas seguidas": "Weeks in a row",
      "Cada reto oficial te da capital extra para tu próxima partida normal: más cuanto más larga sea tu racha. Si juegas {0} días en la misma semana, ganas {1} más.": "Each official challenge gives you extra capital for your next normal game: the longer your streak, the more you get. Play {0} days in the same week and you earn {1} more.",
      "Premio de racha:": "Streak reward:", "de capital para tu próxima partida": "capital for your next game",
      "Objetivo semanal cumplido.": "Weekly goal reached.", "Capital extra para esta partida:": "Extra capital for this game:",
      "Noche electoral": "Election night", "Escrutando…": "Counting…", "Ganas": "You win", "Gana el rival": "Rival wins", "Empate": "Tie",
      "Media provisional": "Provisional average", "VER RESULTADO": "SEE RESULT", "Toca para ver todo": "Tap to reveal all",
      "Ritmo rápido: sí": "Fast pace: on", "Ritmo rápido: no": "Fast pace: off"
    },
    fr: {
      "Próximo desbloqueo:": "Prochain déblocage :", "Segunda habilidad inicial": "Deuxième compétence de départ",
      "Te falta {0} victoria": "Encore {0} victoire", "Te faltan {0} victorias": "Encore {0} victoires",
      "Esta semana": "Cette semaine", "Semanas seguidas": "Semaines d'affilée",
      "Cada reto oficial te da capital extra para tu próxima partida normal: más cuanto más larga sea tu racha. Si juegas {0} días en la misma semana, ganas {1} más.": "Chaque défi officiel vous donne du capital en plus pour votre prochaine partie normale : plus votre série est longue, plus vous en recevez. Jouez {0} jours dans la même semaine et vous en gagnez {1} de plus.",
      "Premio de racha:": "Prime de série :", "de capital para tu próxima partida": "de capital pour votre prochaine partie",
      "Objetivo semanal cumplido.": "Objectif de la semaine atteint.", "Capital extra para esta partida:": "Capital en plus pour cette partie :",
      "Noche electoral": "Soirée électorale", "Escrutando…": "Dépouillement…", "Ganas": "Vous gagnez", "Gana el rival": "Le rival gagne", "Empate": "Égalité",
      "Media provisional": "Moyenne provisoire", "VER RESULTADO": "VOIR LE RÉSULTAT", "Toca para ver todo": "Touchez pour tout afficher",
      "Ritmo rápido: sí": "Rythme rapide : oui", "Ritmo rápido: no": "Rythme rapide : non"
    },
    de: {
      "Próximo desbloqueo:": "Nächste Freischaltung:", "Segunda habilidad inicial": "Zweite Startfähigkeit",
      "Te falta {0} victoria": "Noch {0} Sieg", "Te faltan {0} victorias": "Noch {0} Siege",
      "Esta semana": "Diese Woche", "Semanas seguidas": "Wochen in Folge",
      "Cada reto oficial te da capital extra para tu próxima partida normal: más cuanto más larga sea tu racha. Si juegas {0} días en la misma semana, ganas {1} más.": "Jede offizielle Herausforderung bringt dir zusätzliches Kapital für deine nächste normale Partie: je länger deine Serie, desto mehr. Spiele an {0} Tagen derselben Woche und du erhältst {1} zusätzlich.",
      "Premio de racha:": "Serienbonus:", "de capital para tu próxima partida": "Kapital für deine nächste Partie",
      "Objetivo semanal cumplido.": "Wochenziel erreicht.", "Capital extra para esta partida:": "Zusätzliches Kapital für diese Partie:",
      "Noche electoral": "Wahlabend", "Escrutando…": "Auszählung…", "Ganas": "Du gewinnst", "Gana el rival": "Rivale gewinnt", "Empate": "Gleichstand",
      "Media provisional": "Vorläufiger Durchschnitt", "VER RESULTADO": "ERGEBNIS ANSEHEN", "Toca para ver todo": "Tippen, um alles zu zeigen",
      "Ritmo rápido: sí": "Schnelles Tempo: an", "Ritmo rápido: no": "Schnelles Tempo: aus"
    }
  };
  Object.keys(ADD).forEach(l => { D[l] = Object.assign(D[l] || {}, ADD[l]); });
})(typeof window !== 'undefined' ? window : globalThis);
