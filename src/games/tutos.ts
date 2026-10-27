// Tutos affichés sur la télé avant chaque jeu : le but, puis 3 étapes illustrées (icône + texte court).
import type { Lang } from '../shared/protocol';

export interface Tuto {
  goal: string;
  steps: [string, string][];
}

export const TUTOS: Record<string, Record<Lang, Tuto>> = {
  pouces: {
    fr: {
      goal: 'Arrive le premier au bout de la piste !',
      steps: [
        ['👈👉', 'Tapote GAUCHE puis DROITE, en alternant'],
        ['🐌', 'Dans la boue, tes pas sont plus courts'],
        ['⚡', 'Sur le tapis turbo, tu fonces !'],
      ],
    },
    en: {
      goal: 'Reach the end of the track first!',
      steps: [
        ['👈👉', 'Tap LEFT then RIGHT, alternating'],
        ['🐌', 'In the mud, your steps are shorter'],
        ['⚡', 'On the boost pad, you fly!'],
      ],
    },
  },
  obstacles: {
    fr: {
      goal: 'Seuls les premiers arrivés sont qualifiés. 3 vies : tomber ou traîner derrière en coûte une !',
      steps: [
        ['🕹️', 'Stick : courir à gauche et à droite'],
        ['🅰️', 'A : sauter (garde appuyé pour sauter plus haut)'],
        ['🚪', 'B : plongeon. Portes « ? » : une seule casse, devine laquelle !'],
      ],
    },
    en: {
      goal: 'Only the first ones qualify. 3 lives: falling or lagging behind costs one!',
      steps: [
        ['🕹️', 'Stick: run left and right'],
        ['🅰️', 'A: jump (hold to jump higher)'],
        ['🚪', 'B: dive. “?” doors: only one breaks, guess which!'],
      ],
    },
  },
  bluff: {
    fr: {
      goal: 'Bluffe sans te faire griller, et reste le dernier debout !',
      steps: [
        ['🃏', 'Ta main est sur ton téléphone. Pose 1 à 3 cartes « de la carte du tour »… vrai ou faux'],
        ['📣', 'Tu doutes du joueur d’avant ? Crie MENTEUR !'],
        ['💨', 'Le perdant appuie sur son coussin : 1 sur 6 fait éliminer'],
      ],
    },
    en: {
      goal: 'Bluff without getting caught, be the last one standing!',
      steps: [
        ['🃏', 'Your hand is on your phone. Play 1 to 3 cards “of the round card”… true or not'],
        ['📣', 'Doubt the previous player? Shout LIAR!'],
        ['💨', 'The loser squeezes their cushion: 1 in 6 knocks them out'],
      ],
    },
  },
  bombes: {
    fr: {
      goal: 'Sois le dernier au sec dans l’arène !',
      steps: [
        ['🕹️', 'Stick : se déplacer dans les couloirs'],
        ['🧨', 'A : poser un pétard (il éclate en croix)'],
        ['🛡️', 'Casse les blocs pour gagner des bonus, B pour shooter un pétard'],
      ],
    },
    en: {
      goal: 'Be the last one dry in the arena!',
      steps: [
        ['🕹️', 'Stick: move through the corridors'],
        ['🧨', 'A: drop a banger (it splashes in a cross)'],
        ['🛡️', 'Break blocks for power-ups, B to kick a banger'],
      ],
    },
  },
  sumo: {
    fr: {
      goal: 'Pousse les autres hors de l’arène. 3 vies chacun !',
      steps: [
        ['🕹️', 'Stick : rouler dans ta bouée'],
        ['💥', 'A : turbo. Maintiens A pour le charger, relâche pour foncer'],
        ['🌶️', 'B : ancre (tu deviens lourd). Ramasse les bonus : piment, bouclier, géant'],
      ],
    },
    en: {
      goal: 'Push the others off the arena. 3 lives each!',
      steps: [
        ['🕹️', 'Stick: roll in your rubber ring'],
        ['💥', 'A: boost. Hold A to charge it, release to ram'],
        ['🌶️', 'B: anchor (you get heavy). Grab power-ups: chili, shield, giant'],
      ],
    },
  },
  kart: {
    fr: {
      goal: 'Fais 5 tours avant tout le monde ! Les tapis jaunes donnent un turbo',
      steps: [
        ['🕹️', 'Pointe le stick là où tu veux aller : le kart accélère tout seul'],
        ['❓', 'Roule sur les boîtes pour gagner un objet'],
        ['🅰️', 'A : utiliser l’objet (turbo, sirop, pétard) · B : freiner'],
      ],
    },
    en: {
      goal: 'Finish 5 laps before everyone else! Yellow pads give a boost',
      steps: [
        ['🕹️', 'Point the stick where you want to go: the kart speeds up by itself'],
        ['❓', 'Drive over boxes to get an item'],
        ['🅰️', 'A: use the item (boost, syrup, banger) · B: brake'],
      ],
    },
  },
  archers: {
    fr: {
      goal: 'Une flèche ou un saut sur la tête, et c’est perdu. Premier à 3 manches !',
      steps: [
        ['🕹️', 'Stick : courir et viser (8 directions)'],
        ['🅰️', 'A : sauter · B : tirer · X : esquive (attrape une flèche au vol !)'],
        ['🎁', 'Ramasse tes flèches plantées et le coffre (bulle + 2 flèches). Mort subite à 30 s !'],
      ],
    },
    en: {
      goal: 'One arrow or a stomp and you’re out. First to 3 rounds!',
      steps: [
        ['🕹️', 'Stick: run and aim (8 directions)'],
        ['🅰️', 'A: jump · B: shoot · X: dodge (catch an arrow mid-air!)'],
        ['🎁', 'Pick up stuck arrows and the chest (bubble + 2 arrows). Sudden death at 30 s!'],
      ],
    },
  },
  bagarre: {
    fr: {
      goal: 'Jette tout le monde dans la crème ! Premier à 2 manches, attention aux pièges de la carte',
      steps: [
        ['👋', 'B (appui court) : une baffe. 4 baffes et l’autre est sonné'],
        ['🤲', 'B (maintenu) : attraper quelqu’un'],
        ['🚀', 'Relâche B pour le jeter, dans la direction du stick'],
      ],
    },
    en: {
      goal: 'Throw everyone into the cream! First to 2 rounds, watch out for the map’s traps',
      steps: [
        ['👋', 'Tap B: a slap. 4 slaps and they’re dizzy'],
        ['🤲', 'Hold B: grab someone'],
        ['🚀', 'Release B to throw them, in the stick’s direction'],
      ],
    },
  },
  reflexes: {
    fr: {
      goal: '7 épreuves éclair : le plus rapide marque le plus de points !',
      steps: [
        ['🟢', 'Attends que l’écran passe au VERT pour taper. Trop tôt = piégé !'],
        ['🔎', 'Trouve l’intrus, compte les bonbons, touche la COULEUR du mot…'],
        ['🔨', 'Martèle le bouton, puis arrête la jauge pile sur la ligne'],
      ],
    },
    en: {
      goal: '7 lightning rounds: the fastest scores the most!',
      steps: [
        ['🟢', 'Wait for the screen to turn GREEN to tap. Too early = gotcha!'],
        ['🔎', 'Find the odd one, count the candies, tap the word’s COLOR…'],
        ['🔨', 'Mash the button, then stop the bar right on the line'],
      ],
    },
  },
  foot: {
    fr: {
      goal: 'Deux équipes, un ballon-coussin : marque dans le but adverse !',
      steps: [
        ['🕹️', 'Stick : courir. Le ballon colle à tes pieds quand tu cours dessus'],
        ['🅰️', 'A : tirer dans la direction du stick'],
        ['💨', 'B : sprint ! Fonce dans un adversaire pour le faire tomber'],
      ],
    },
    en: {
      goal: 'Two teams, one cushion ball: score in the other goal!',
      steps: [
        ['🕹️', 'Stick: run. The ball sticks to your feet when you run into it'],
        ['🅰️', 'A: shoot in the stick’s direction'],
        ['💨', 'B: sprint! Ram an opponent to knock them over'],
      ],
    },
  },
  traitre: {
    fr: {
      goal: 'Les Gourmands doivent démasquer les Pique-assiettes cachés parmi eux',
      steps: [
        ['🤫', 'Regarde ton rôle en secret sur ton téléphone'],
        ['🌙', 'La nuit, les Pique-assiettes choisissent une victime'],
        ['🗳️', 'Le jour, on débat à voix haute puis on vote'],
      ],
    },
    en: {
      goal: 'The Foodies must unmask the Moochers hiding among them',
      steps: [
        ['🤫', 'Check your role in secret on your phone'],
        ['🌙', 'At night, the Moochers pick a victim'],
        ['🗳️', 'By day, debate out loud then vote'],
      ],
    },
  },
  undercover: {
    fr: {
      goal: 'Chacun a un mot secret… sauf l’Undercover (un mot proche) et Mr White (aucun mot) !',
      steps: [
        ['🤫', 'Regarde ton mot en secret sur ton téléphone'],
        ['💬', 'À ton tour, tape UN mot comme indice : il s’affiche sur la télé'],
        ['🗳️', 'Débattez puis votez. Mr White éliminé peut encore gagner en devinant le mot !'],
      ],
    },
    en: {
      goal: 'Everyone has a secret word… except the Undercover (a close word) and Mr White (no word)!',
      steps: [
        ['🤫', 'Check your word in secret on your phone'],
        ['💬', 'On your turn, type ONE word as a clue: it shows on the TV'],
        ['🗳️', 'Debate then vote. Mr White, if voted out, can still win by guessing the word!'],
      ],
    },
  },
  roulette: {
    fr: {
      goal: 'Devine de quel téléphone viennent les photos et vidéos !',
      steps: [
        ['📷', 'Choisis jusqu’à 8 photos ou petites vidéos dans ta galerie'],
        ['📺', 'La télé en montre une à la fois, tirées au hasard'],
        ['🤔', 'Devine à qui elle est sur ton téléphone : vite = plus de points. Si c’est la tienne, bluffe !'],
      ],
    },
    en: {
      goal: 'Guess which phone the photos and videos came from!',
      steps: [
        ['📷', 'Pick up to 8 photos or short videos from your gallery'],
        ['📺', 'The TV shows them one at a time, at random'],
        ['🤔', 'Guess whose it is on your phone: faster = more points. If it’s yours, bluff!'],
      ],
    },
  },
  dessin: {
    fr: {
      goal: 'Fais deviner ton dessin… ou devine celui des autres !',
      steps: [
        ['✏️', 'Le dessinateur voit un mot secret et dessine du doigt'],
        ['📺', 'Le dessin apparaît en direct sur la télé'],
        ['⌨️', 'Les autres tapent leurs réponses : vite = plus de points'],
      ],
    },
    en: {
      goal: 'Get your drawing guessed… or guess the others’!',
      steps: [
        ['✏️', 'The artist sees a secret word and draws with a finger'],
        ['📺', 'The drawing appears live on the TV'],
        ['⌨️', 'Everyone else types guesses: faster = more points'],
      ],
    },
  },
  plateau: {
    fr: {
      goal: 'Récolte le plus de Coussins d’or en 5 tours !',
      steps: [
        ['🎲', 'À ton tour, lance le dé sur ton téléphone'],
        ['🍬', 'Gagne des bonbons, et passe sur l’étoile ⭐ avec 20 bonbons'],
        ['🎮', 'Après chaque tour : un mini-jeu pour gagner des bonbons'],
      ],
    },
    en: {
      goal: 'Collect the most Golden Cushions in 5 rounds!',
      steps: [
        ['🎲', 'On your turn, roll the die on your phone'],
        ['🍬', 'Earn candies, and pass the star ⭐ with 20 candies'],
        ['🎮', 'After each round: a mini-game to win candies'],
      ],
    },
  },
  combat: {
    fr: {
      goal: 'Éjecte les autres hors de l’écran. 3 vies chacun !',
      steps: [
        ['🕹️', 'Stick : se déplacer · A : sauter (double saut)'],
        ['👊', 'B : frapper. Le stick change le coup (côté, haut, bas). Plus de % = on vole plus loin'],
        ['🎁', 'Des objets tombent : touche-les pour les ramasser, B pour s’en servir'],
      ],
    },
    en: {
      goal: 'Knock the others off the screen. 3 lives each!',
      steps: [
        ['🕹️', 'Stick: move · A: jump (double jump)'],
        ['👊', 'B: hit. The stick changes the move (side, up, down). More % = fly further'],
        ['🎁', 'Items fall from the sky: touch them to pick up, B to use'],
      ],
    },
  },
};
