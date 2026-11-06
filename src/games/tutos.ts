// Tutos affichés sur la télé avant chaque jeu : le but, puis 3 étapes illustrées (icône + texte court).
import type { Lang } from '../shared/protocol';

export interface Tuto {
  goal: string;
  steps: [string, string][];
}

export const TUTOS: Record<string, Record<Lang, Tuto>> = {
  plutot: {
    fr: {
      goal: 'Deux choix absurdes : devine ce que le groupe va préférer !',
      steps: [
        ['📱', 'Touche ton choix sur ton téléphone'],
        ['🗳️', 'Les votes s’affichent sur la télé'],
        ['⭐', 'Avec la majorité = 2 points. Égalité = 1 point'],
      ],
    },
    en: {
      goal: 'Two absurd choices: guess what the group will prefer!',
      steps: [
        ['📱', 'Tap your choice on your phone'],
        ['🗳️', 'The votes appear on the TV'],
        ['⭐', 'With the majority = 2 points. Tie = 1 point'],
      ],
    },
  },
  chiffre: {
    fr: {
      goal: 'Une question, un nombre : le plus proche gagne !',
      steps: [
        ['🔢', 'Tape ton nombre sur ton téléphone'],
        ['📏', 'Le plus proche marque 3 points, le suivant 1 point'],
        ['🎯', 'Pile-poil = 5 points'],
      ],
    },
    en: {
      goal: 'One question, one number: closest wins!',
      steps: [
        ['🔢', 'Type your number on your phone'],
        ['📏', 'Closest scores 3 points, the next 1 point'],
        ['🎯', 'Bullseye = 5 points'],
      ],
    },
  },
  cri: {
    fr: { goal: 'Traverse les plateformes à la voix !', steps: [['🗣️', 'Parle pour marcher, tais-toi pour freiner'], ['📣', 'Crie pour sauter : plus c’est fort, plus c’est haut et loin'], ['❤️', '3 vies : gare aux trous, aux pics et au bord de l’écran']] },
    en: { goal: 'Cross the platforms with your voice!', steps: [['🗣️', 'Talk to walk, go quiet to brake'], ['📣', 'Shout to jump: the louder, the higher and further'], ['❤️', '3 lives: watch the pits, spikes and screen edge']] },
  },
  doublage: {
    fr: { goal: 'Donne ta voix à une scène absurde !', steps: [['🎬', 'Lis la scène jouée par deux marionnettes'], ['🎙️', 'Enregistre toutes les voix, 7 secondes maximum'], ['🗳️', 'La télé joue chaque version : votez pour la plus drôle']] },
    en: { goal: 'Voice an absurd scene!', steps: [['🎬', 'Read the scene played by two puppets'], ['🎙️', 'Record all the voices, 7 seconds max'], ['🗳️', 'The TV plays each version: vote for the funniest']] },
  },
  karaoke: {
    fr: { goal: 'Une mélodie inventée, des paroles absurdes !', steps: [['🎵', 'Écoute la mélodie qui tourne à la télé'], ['🎤', 'Chante les paroles dans ton téléphone'], ['🗳️', 'La télé repasse les chansons : votez pour la star']] },
    en: { goal: 'A made-up tune, absurd lyrics!', steps: [['🎵', 'Listen to the tune playing on the TV'], ['🎤', 'Sing the words into your phone'], ['🗳️', 'The TV replays the songs: vote for the star']] },
  },
  imite: {
    fr: { goal: 'Un défi absurde : ton téléphone est le micro !', steps: [['🎙️', 'Touche Enregistrer et imite ce qui est demandé'], ['📺', 'La télé fait écouter tout le monde'], ['🗳️', 'Votez pour le meilleur : 2 points par voix']] },
    en: { goal: 'An absurd challenge: your phone is the mic!', steps: [['🎙️', 'Tap Record and imitate what’s asked'], ['📺', 'The TV plays everyone back'], ['🗳️', 'Vote for the best: 2 points per vote']] },
  },
  devine: {
    fr: { goal: 'Fais deviner un bruit, sans dire son nom !', steps: [['🤫', 'Chacun son tour reçoit un bruit secret'], ['🔊', 'La télé le fait écouter deux fois'], ['⭐', 'Bien deviné = 3 points, et 2 pour le bruiteur']] },
    en: { goal: 'Make people guess a sound, without naming it!', steps: [['🤫', 'In turn, each player gets a secret sound'], ['🔊', 'The TV plays it twice'], ['⭐', 'Right guess = 3 points, and 2 for the noisemaker']] },
  },
  perroquet: {
    fr: { goal: 'La télé fait un drôle de bruit : imite-le !', steps: [['👂', 'Écoute bien le bruit de la télé'], ['🎙️', 'Enregistre ta meilleure imitation'], ['🗳️', 'Votez pour le plus ressemblant']] },
    en: { goal: 'The TV makes a funny sound: imitate it!', steps: [['👂', 'Listen closely to the TV'], ['🎙️', 'Record your best imitation'], ['🗳️', 'Vote for the closest']] },
  },
  envers: {
    fr: { goal: 'Une phrase secrète, jouée à l’envers !', steps: [['🎙️', 'Un joueur enregistre une phrase secrète'], ['⏪', 'La télé la passe à l’envers'], ['⭐', 'Trouve la bonne phrase, puis écoute-la à l’endroit']] },
    en: { goal: 'A secret sentence, played backwards!', steps: [['🎙️', 'One player records a secret sentence'], ['⏪', 'The TV plays it backwards'], ['⭐', 'Find the right one, then hear it forwards']] },
  },
  voix: {
    fr: { goal: 'Ta voix est déformée : qui parle ?', steps: [['🎙️', 'Tout le monde dit la même phrase'], ['🐿️', 'La télé en passe une, en écureuil ou en ogre'], ['🕵️', 'Trouve qui parle, et trompe les autres avec ta voix']] },
    en: { goal: 'Your voice is distorted: who is it?', steps: [['🎙️', 'Everyone says the same sentence'], ['🐿️', 'The TV plays one, as a squirrel or an ogre'], ['🕵️', 'Find the speaker, and fool the others']] },
  },
  casse: {
    fr: { goal: 'Une phrase passe de téléphone en téléphone !', steps: [['📞', 'Écoute le joueur d’avant sur ton téléphone, en secret'], ['🎙️', 'Répète ce que tu as entendu'], ['😂', 'La télé révèle ce qu’il en reste à l’arrivée']] },
    en: { goal: 'A sentence passes from phone to phone!', steps: [['📞', 'Hear the previous player on your phone, in secret'], ['🎙️', 'Repeat what you heard'], ['😂', 'The TV reveals what’s left at the end']] },
  },
  tribunal: {
    fr: {
      goal: 'Qui de vous serait le premier à… ? Condamnez vos amis !',
      steps: [
        ['📱', 'Lis l’affaire et touche un joueur sur ton téléphone'],
        ['⚖️', 'Le plus désigné est déclaré COUPABLE'],
        ['⭐', 'Voter avec la majorité = 2 points. Le condamné gagne 1 point'],
      ],
    },
    en: {
      goal: 'Which of you would be first to…? Convict your friends!',
      steps: [
        ['📱', 'Read the case and tap a player on your phone'],
        ['⚖️', 'The most voted is found GUILTY'],
        ['⭐', 'Vote with the majority = 2 points. The convict gets 1 point'],
      ],
    },
  },
  dico: {
    fr: {
      goal: 'Un vrai mot rare : invente une fausse définition crédible !',
      steps: [
        ['✍️', 'Tape ta fausse définition sur ton téléphone'],
        ['🔎', 'Cherche la vraie parmi toutes les propositions'],
        ['⭐', 'La vraie trouvée = 3 points. Chaque joueur piégé = 2 points'],
      ],
    },
    en: {
      goal: 'A real rare word: make up a believable fake meaning!',
      steps: [
        ['✍️', 'Type your fake meaning on your phone'],
        ['🔎', 'Find the real one among all the answers'],
        ['⭐', 'Real one found = 3 points. Each player fooled = 2 points'],
      ],
    },
  },
  pouces: {
    fr: {
      goal: 'Arrive le premier ! Ton perso court tout seul, à toi de franchir les obstacles',
      steps: [
        ['⬆', 'Bouton gauche : SAUTE les haies, les trous et le sirop'],
        ['⬇', 'Bouton droit : GLISSE sous les barres. Gare aux obstacles surprises (!)'],
        ['⚡', 'Pile au bon moment = PARFAIT et petit turbo. Trop tôt ou mauvais bouton = tu trébuches'],
      ],
    },
    en: {
      goal: 'Finish first! Your character runs by itself, you handle the obstacles',
      steps: [
        ['⬆', 'Left button: JUMP hurdles, holes and syrup'],
        ['⬇', 'Right button: SLIDE under bars. Watch out for surprises (!)'],
        ['⚡', 'Right on time = PERFECT and a little boost. Too early or wrong button = you trip'],
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
  chaises: {
    fr: {
      goal: 'Ne sois pas celui qui reste debout !',
      steps: [
        ['🎵', 'Pendant la musique, promène-toi'],
        ['🛑', 'Au STOP, des coussins sortent du sol : fonce t’asseoir, il en manque un'],
        ['🅱️', 'B : pousser les autres pour leur piquer la place'],
      ],
    },
    en: {
      goal: 'Don’t be the one left standing!',
      steps: [
        ['🎵', 'While the music plays, walk around'],
        ['🛑', 'At STOP, cushions pop out of the floor: rush to sit, one is missing'],
        ['🅱️', 'B: shove the others to steal their spot'],
      ],
    },
  },
  patate: {
    fr: {
      goal: 'Ne garde pas la patate quand elle explose !',
      steps: [
        ['🥔', 'Celui qui a la patate doit toucher quelqu’un pour la lui refiler'],
        ['💥', 'Elle explose au hasard : son porteur est éliminé'],
        ['🅱️', 'B : pousser (pratique pour s’enfuir)'],
      ],
    },
    en: {
      goal: 'Don’t hold the potato when it blows!',
      steps: [
        ['🥔', 'Whoever has the potato must tag someone to pass it'],
        ['💥', 'It blows at a random moment: its holder is out'],
        ['🅱️', 'B: shove (handy to escape)'],
      ],
    },
  },
  pluie: {
    fr: {
      goal: 'Ramasse le plus de bonbons en 45 secondes !',
      steps: [
        ['🍬', 'Marche sur les bonbons : +1, les étoiles ⭐ : +5'],
        ['🔴', 'Ombre rouge = enclume qui tombe : file ! Sinon tu perds 3 bonbons'],
        ['🅱️', 'B : pousser les autres'],
      ],
    },
    en: {
      goal: 'Grab the most candy in 45 seconds!',
      steps: [
        ['🍬', 'Walk over candy: +1, stars ⭐: +5'],
        ['🔴', 'Red shadow = falling anvil: run! Or you lose 3 candies'],
        ['🅱️', 'B: shove the others'],
      ],
    },
  },
  trappe: {
    fr: {
      goal: 'Sois le dernier debout !',
      steps: [
        ['❓', 'Une question, deux réponses : gauche ou droite'],
        ['🏃', 'Cours du bon côté avant le STOP'],
        ['🕳️', 'La trappe s’ouvre sous le mauvais côté ! B : pousser'],
      ],
    },
    en: {
      goal: 'Be the last one standing!',
      steps: [
        ['❓', 'One question, two answers: left or right'],
        ['🏃', 'Run to the right side before STOP'],
        ['🕳️', 'The trapdoor opens under the wrong side! B: shove'],
      ],
    },
  },
  couleur: {
    fr: {
      goal: 'Sois le dernier debout !',
      steps: [
        ['🎨', 'Une couleur est annoncée en haut'],
        ['🏃', 'Fonce sur une dalle de cette couleur'],
        ['🕳️', 'Toutes les autres tombent ! B : pousser'],
      ],
    },
    en: {
      goal: 'Be the last one standing!',
      steps: [
        ['🎨', 'A color is called at the top'],
        ['🏃', 'Run onto a tile of that color'],
        ['🕳️', 'All the others drop! B: shove'],
      ],
    },
  },
  maree: {
    fr: {
      goal: 'Sois le dernier au sec !',
      steps: [
        ['🌊', 'La mer monte de plus en plus vite'],
        ['🅰️', 'A : sauter de plateforme en plateforme'],
        ['⚠️', 'Les plateformes marron s’effondrent, les violettes bougent · B : pousser'],
      ],
    },
    en: {
      goal: 'Be the last one dry!',
      steps: [
        ['🌊', 'The sea rises faster and faster'],
        ['🅰️', 'A: jump from platform to platform'],
        ['⚠️', 'Brown platforms crumble, purple ones move · B: shove'],
      ],
    },
  },
  pixel: {
    fr: {
      goal: 'Aie le plus de cases à ta couleur !',
      steps: [
        ['🎨', 'Chaque case où tu marches prend ta couleur'],
        ['🔁', 'Repasse sur les cases des autres pour les voler'],
        ['🪣', 'Pot de peinture = grosse éclaboussure · A : glissade · B : pousser'],
      ],
    },
    en: {
      goal: 'Own the most tiles!',
      steps: [
        ['🎨', 'Every tile you walk on takes your color'],
        ['🔁', 'Walk over others’ tiles to steal them'],
        ['🪣', 'Paint pot = big splash · A: slide · B: shove'],
      ],
    },
  },
  lave: {
    fr: {
      goal: 'Sois le dernier debout !',
      steps: [
        ['🧱', 'Chaque dalle où tu passes s’effondre une seconde après'],
        ['🌋', 'Tombe dans la lave et c’est fini : bouge sans arrêt'],
        ['🅰️', 'A : sauter un trou · B : plonger loin (on met du temps à se relever)'],
      ],
    },
    en: {
      goal: 'Be the last one standing!',
      steps: [
        ['🧱', 'Every tile you step on crumbles a second later'],
        ['🌋', 'Fall into the lava and you’re out: keep moving'],
        ['🅰️', 'A: jump a hole · B: dive far (slow to get up)'],
      ],
    },
  },
  president: {
    fr: {
      goal: 'Débarrasse-toi de toutes tes cartes en premier pour devenir Président !',
      steps: [
        ['📱', 'Ta main est sur ton téléphone. Pose autant de cartes que le joueur d’avant, d’une valeur égale ou plus forte, ou passe'],
        ['2️⃣', 'Ordre : 3, 4… Roi, As, puis 2 (le plus fort, il ferme le pli)'],
        ['🤡', 'Manche suivante : le Bouffon donne ses 2 meilleures cartes au Président, le Vice-bouffon 1 au Vice-président'],
      ],
    },
    en: {
      goal: 'Get rid of all your cards first to become President!',
      steps: [
        ['📱', 'Your hand is on your phone. Play as many cards as the previous player, equal or higher, or pass'],
        ['2️⃣', 'Order: 3, 4… King, Ace, then 2 (the highest, it closes the trick)'],
        ['🤡', 'Next round: the Fool gives their 2 best cards to the President, the Vice-fool 1 to the Vice-president'],
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
        ['🎁', 'Une flèche revient toute seule toutes les 5 s. Ramasse aussi les flèches plantées et le coffre !'],
      ],
    },
    en: {
      goal: 'One arrow or a stomp and you’re out. First to 3 rounds!',
      steps: [
        ['🕹️', 'Stick: run and aim (8 directions)'],
        ['🅰️', 'A: jump · B: shoot · X: dodge (catch an arrow mid-air!)'],
        ['🎁', 'An arrow comes back every 5 s. Also grab stuck arrows and the chest!'],
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
      goal: 'Chacun a un mot secret… sauf l’Intrus (un mot proche) et le Sans-Mot (aucun mot) !',
      steps: [
        ['🤫', 'Regarde ton mot en secret sur ton téléphone'],
        ['💬', 'À ton tour, tape UN mot comme indice : il s’affiche sur la télé'],
        ['🗳️', 'Débattez puis votez. Le Sans-Mot éliminé peut encore gagner en devinant le mot !'],
      ],
    },
    en: {
      goal: 'Everyone has a secret word… except the Odd One (a close word) and the Blank (no word)!',
      steps: [
        ['🤫', 'Check your word in secret on your phone'],
        ['💬', 'On your turn, type ONE word as a clue: it shows on the TV'],
        ['🗳️', 'Debate then vote. The Blank, if voted out, can still win by guessing the word!'],
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
