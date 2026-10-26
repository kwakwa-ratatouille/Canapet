import type { Lang } from './protocol';

const fr = {
  tagline: 'Les jeux de soirée sur ta télé. Ton téléphone est la manette.',
  tvBtn: 'Afficher sur la télé',
  tvBtnSub: 'Sur le PC branché à la télé, ou le Chromecast',
  joinBtn: 'Rejoindre une partie',
  joinSub: 'Tape le code affiché sur la télé',
  join: 'Rejoindre',
  howTv: 'Comment afficher sur ma télé ?',
  back: 'Retour',
  joinWith: 'Rejoins avec ton téléphone',
  scanOr: 'Scanne le QR code ou va sur',
  andType: 'et tape le code',
  waitingPlayers: 'En attente des joueurs…',
  hostStarts: "L'hôte {crown} lance la partie depuis son téléphone",
  players: '{n} joueur(s)',
  connecting: 'Connexion au serveur…',
  netError: 'Problème de connexion : {e}. Nouvel essai…',
  soundOn: 'Cliquer pour activer le son',
  fullscreen: 'Plein écran',
  joinCorner: 'Rejoindre',
  results: 'Résultats',
  podium: 'Podium de la soirée',
  gameStep: 'Jeu {i} sur {n}',
  hostChooses: "L'hôte choisit la suite sur son téléphone",
  pts: 'pts',
  bot: 'Bot',
  ready: 'Prêts ?',
  go: 'PARTEZ !',
  finish: 'Arrivée !',
  // Manette
  connectingTv: 'Connexion à la télé…',
  notFound: 'Aucune télé avec le code {code}. Vérifie le code affiché.',
  lost: 'Connexion perdue, on réessaie…',
  youHost: 'Tu es l’hôte',
  waitHost: 'En attente que {name} lance la partie',
  tournament: 'Tournoi',
  tournamentSub: '5 jeux au hasard, podium à la fin',
  pickGame: 'Choisir un jeu',
  pickGameSub: 'Tu choisis chaque jeu',
  soon: 'Bientôt',
  editChar: 'Modifier mon perso',
  yourName: 'Ton pseudo',
  character: 'Personnage',
  color: 'Couleur',
  hat: 'Chapeau',
  acc: 'Accessoire',
  selfie: 'Prendre un selfie',
  removeSelfie: 'Retirer le selfie',
  language: 'Langue',
  ok: 'OK',
  left: 'GAUCHE',
  right: 'DROITE',
  tapHint: 'Tapote gauche, droite, gauche, droite… le plus vite possible !',
  waitNext: 'Partie en cours : tu joues à la prochaine !',
  yourRank: 'Tu finis {rank}',
  plusPts: '+{p} points · total {t}',
  replay: 'Rejouer',
  nextGame: 'Jeu suivant',
  toPodium: 'Voir le podium',
  toLobby: 'Retour au salon',
  rotate: 'Tourne ton téléphone',
  ping: '{ms} ms',
  helpTitle: 'Comment afficher Cana’pet sur ma télé',
  helpPc: 'PC branché en HDMI',
  helpPcText:
    'Branche le PC à la télé, ouvre ce site dans Chrome ou Edge, clique sur « Afficher sur la télé » puis sur Plein écran. Une appli PC (.exe) arrive bientôt.',
  helpCast: 'Chromecast (Android ou PC)',
  helpCastText:
    'Bientôt : un bouton Cast sur la page télé. En attendant, dans Chrome sur le PC : menu ⋮ → Caster → choisis ton Chromecast.',
  helpIphone: 'iPhone',
  helpIphoneText:
    'Safari ne peut pas lancer un Chromecast. Utilise la recopie d’écran AirPlay (Apple TV) ou le PC en HDMI. Les manettes, elles, marchent sur tous les téléphones.',
};

const en: typeof fr = {
  tagline: 'Party games on your TV. Your phone is the controller.',
  tvBtn: 'Show on the TV',
  tvBtnSub: 'On the PC plugged into the TV, or Chromecast',
  joinBtn: 'Join a game',
  joinSub: 'Type the code shown on the TV',
  join: 'Join',
  howTv: 'How do I show it on my TV?',
  back: 'Back',
  joinWith: 'Join with your phone',
  scanOr: 'Scan the QR code or go to',
  andType: 'and type the code',
  waitingPlayers: 'Waiting for players…',
  hostStarts: 'The host {crown} starts the game from their phone',
  players: '{n} player(s)',
  connecting: 'Connecting to the server…',
  netError: 'Connection problem: {e}. Retrying…',
  soundOn: 'Click to turn sound on',
  fullscreen: 'Full screen',
  joinCorner: 'Join',
  results: 'Results',
  podium: 'Party podium',
  gameStep: 'Game {i} of {n}',
  hostChooses: 'The host picks what’s next on their phone',
  pts: 'pts',
  bot: 'Bot',
  ready: 'Ready?',
  go: 'GO!',
  finish: 'Finish!',
  connectingTv: 'Connecting to the TV…',
  notFound: 'No TV with code {code}. Check the code on screen.',
  lost: 'Connection lost, retrying…',
  youHost: 'You are the host',
  waitHost: 'Waiting for {name} to start',
  tournament: 'Tournament',
  tournamentSub: '5 random games, podium at the end',
  pickGame: 'Pick a game',
  pickGameSub: 'You choose each game',
  soon: 'Soon',
  editChar: 'Edit my character',
  yourName: 'Your name',
  character: 'Character',
  color: 'Color',
  hat: 'Hat',
  acc: 'Accessory',
  selfie: 'Take a selfie',
  removeSelfie: 'Remove selfie',
  language: 'Language',
  ok: 'OK',
  left: 'LEFT',
  right: 'RIGHT',
  tapHint: 'Tap left, right, left, right… as fast as you can!',
  waitNext: 'Game in progress: you’ll play the next one!',
  yourRank: 'You finished {rank}',
  plusPts: '+{p} points · total {t}',
  replay: 'Play again',
  nextGame: 'Next game',
  toPodium: 'See the podium',
  toLobby: 'Back to lobby',
  rotate: 'Rotate your phone',
  ping: '{ms} ms',
  helpTitle: 'How to show Cana’pet on my TV',
  helpPc: 'PC plugged in with HDMI',
  helpPcText:
    'Plug the PC into the TV, open this site in Chrome or Edge, click “Show on the TV” then Full screen. A PC app (.exe) is coming soon.',
  helpCast: 'Chromecast (Android or PC)',
  helpCastText: 'Coming soon: a Cast button on the TV page. Meanwhile, in Chrome on PC: menu ⋮ → Cast → pick your Chromecast.',
  helpIphone: 'iPhone',
  helpIphoneText:
    'Safari can’t start a Chromecast. Use AirPlay screen mirroring (Apple TV) or the PC with HDMI. Controllers work on every phone.',
};

export type Key = keyof typeof fr;
const dict = { fr, en };

export function t(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = dict[lang][key];
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
  return s;
}

export function ordinal(lang: Lang, n: number): string {
  if (lang === 'fr') return n === 1 ? '1er' : `${n}e`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function defaultLang(): Lang {
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
