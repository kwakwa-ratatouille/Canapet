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
        ['🔫', 'Le perdant joue à la roulette russe : 1 balle sur 6, puis 2, puis 3… pour tout le monde'],
      ],
    },
    en: {
      goal: 'Bluff without getting caught, be the last one standing!',
      steps: [
        ['🃏', 'Your hand is on your phone. Play 1 to 3 cards “of the round card”… true or not'],
        ['📣', 'Doubt the previous player? Shout LIAR!'],
        ['🔫', 'The loser plays Russian roulette: 1 bullet in 6, then 2, then 3… for everyone'],
      ],
    },
  },
  bombes: {
    fr: {
      goal: 'Sois le dernier au sec dans l’arène !',
      steps: [
        ['🕹️', 'Stick : se déplacer dans les couloirs'],
        ['🧨', 'A : poser un pétard. Il grossit avec le temps, et à la fin il éclabousse toute la ligne !'],
        ['🛡️', 'Casse les blocs pour gagner des bonus, B pour shooter un pétard'],
      ],
    },
    en: {
      goal: 'Be the last one dry in the arena!',
      steps: [
        ['🕹️', 'Stick: move through the corridors'],
        ['🧨', 'A: drop a banger. They grow over time, and at the end they splash the whole line!'],
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
      goal: 'Fais 5 tours avant tout le monde ! Suis les flèches blanches sur la piste',
      steps: [
        ['🕹️', 'Pointe le stick là où tu veux aller : le kart accélère tout seul'],
        ['⚠️', 'Évite les plots, la boue et les bonbons qui roulent'],
        ['❓', 'Boîtes = objets (⚡🍯🧨🍌🛡️🌩️🚀), A pour s’en servir · B : freiner'],
      ],
    },
    en: {
      goal: 'Finish 5 laps before everyone else! Follow the white arrows on the track',
      steps: [
        ['🕹️', 'Point the stick where you want to go: the kart speeds up by itself'],
        ['⚠️', 'Avoid cones, mud and rolling candies'],
        ['❓', 'Boxes = items (⚡🍯🧨🍌🛡️🌩️🚀), A to use · B: brake'],
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
        ['👋', 'B : baffe. 3 d’affilée = MANDALE qui fait voler'],
        ['💨', 'Y : charge épaule ; en l’air, bas + B : plongeon fessier'],
        ['🤲', 'X : attraper, relâche pour jeter (direction du stick)'],
      ],
    },
    en: {
      goal: 'Throw everyone into the cream! First to 2 rounds, watch out for the map’s traps',
      steps: [
        ['👋', 'B: slap. 3 in a row = MEGA SLAP that sends them flying'],
        ['💨', 'Y: shoulder charge; in the air, down + B: butt slam'],
        ['🤲', 'X: grab, release to throw (stick direction)'],
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
        ['🅰️', 'A : tirer (maintiens pour une frappe de mule en feu 🔥) · X : attraper une passe ou un ballon, puis A pour le lancer'],
        ['💨', 'B : sprint ! Il envoie le ballon très loin et vole le ballon d’un porteur'],
      ],
    },
    en: {
      goal: 'Two teams, one cushion ball: score in the other goal!',
      steps: [
        ['🕹️', 'Stick: run. The ball sticks to your feet when you run into it'],
        ['🅰️', 'A: shoot (hold for a fiery thunder shot 🔥) · X: catch a pass or a ball, then A to throw it'],
        ['💨', 'B: sprint! It sends the ball flying and steals it from a carrier'],
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
        ['📷', 'Sélectionne plein de photos de ta galerie : 16 sont tirées au hasard, tu peux retirer ou en changer une'],
        ['📺', 'La télé en montre une à la fois, tirées au hasard'],
        ['🤔', 'Devine à qui elle est sur ton téléphone : vite = plus de points. Si c’est la tienne, bluffe !'],
      ],
    },
    en: {
      goal: 'Guess which phone the photos and videos came from!',
      steps: [
        ['📷', 'Select lots of photos from your gallery: 16 are drawn at random, redraw or swap any'],
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
  combat: {
    fr: {
      goal: 'Éjecte les autres hors de l’écran. 3 vies chacun !',
      steps: [
        ['🕹️', 'Stick : se déplacer · A : sauter (double saut)'],
        ['👊', 'B : coup normal, différent selon la direction, au sol comme en l’air. X : attaque lourde (maintiens pour charger) ; en l’air, X te fait remonter'],
        ['🌀', 'Y : esquive (roulade, intouchable un instant) ; jauge pleine = super coup. Des objets tombent : B pour s’en servir'],
      ],
    },
    en: {
      goal: 'Knock the others off the screen. 3 lives each!',
      steps: [
        ['🕹️', 'Stick: move · A: jump (double jump)'],
        ['👊', 'B: normal attack, different per direction, on the ground and in the air. X: heavy attack (hold to charge); in the air, X sends you back up'],
        ['🌀', 'Y: dodge (roll, briefly untouchable); full meter = super move. Items fall: B to use them'],
      ],
    },
  },
};
