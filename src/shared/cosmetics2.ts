// Deuxième vague de cosmétiques : traînées, cadres animés, styles de nom, titres, réactions, annonces d'entrée,
// thèmes de manette et collections de saison. Tout passe par les données : rien à dessiner à la main.
import type { Lang } from './protocol';

type Name = Record<Lang, string>;
type R = 'commun' | 'rare' | 'epique' | 'legendaire' | 'mythique';
const n = (fr: string, en: string): Name => ({ fr, en });

// ——— Saisons : reviennent chaque année, aux mêmes dates ———
export interface Season {
  id: string;
  name: Name;
  emoji: string;
  color: string;
  from: [number, number];
  to: [number, number];
}
export const SEASONS: Season[] = [
  { id: 'noel', name: n('Noël', 'Christmas'), emoji: '🎄', color: '#d9213c', from: [12, 1], to: [1, 6] },
  { id: 'amour', name: n('Saint-Valentin', 'Valentine’s'), emoji: '💘', color: '#ff4f9a', from: [2, 1], to: [2, 20] },
  { id: 'printemps', name: n('Printemps', 'Spring'), emoji: '🌸', color: '#6fcf5a', from: [3, 20], to: [4, 30] },
  { id: 'ete', name: n('Été', 'Summer'), emoji: '🏖️', color: '#1fb6d9', from: [6, 15], to: [8, 31] },
  { id: 'halloween', name: n('Halloween', 'Halloween'), emoji: '🎃', color: '#ff8a1f', from: [10, 10], to: [11, 10] },
];

const inRange = (s: Season, d: Date) => {
  const v = (d.getMonth() + 1) * 100 + d.getDate();
  const a = s.from[0] * 100 + s.from[1];
  const b = s.to[0] * 100 + s.to[1];
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
};
/** La saison en cours (`?saison=noel` pour la tester). */
export function currentSeason(now = Date.now()): Season | null {
  const forced = /[?&]saison=(\w+)/.exec(location.search + location.hash)?.[1];
  if (forced) return SEASONS.find((s) => s.id === forced) ?? null;
  return SEASONS.find((s) => inRange(s, new Date(now))) ?? null;
}
/** Jours restants de la saison (au moins 1). */
export function seasonDaysLeft(s: Season, now = Date.now()) {
  const d = new Date(now);
  let y = d.getFullYear();
  if (s.to[0] < s.from[0] && d.getMonth() + 1 >= s.from[0]) y++;
  return Math.max(1, Math.ceil((new Date(y, s.to[0] - 1, s.to[1], 23, 59).getTime() - now) / 86400000));
}
export const seasonEnd = (s: Season, lang: Lang) => new Date(2000, s.to[0] - 1, s.to[1]).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });
export const seasonStart = (s: Season, lang: Lang) => new Date(2000, s.from[0] - 1, s.from[1]).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });

// ——— Traînées ———
export interface TrailDef {
  id: string;
  name: Name;
  emoji: string;
  r: R;
  /** Emojis qui tombent derrière le perso… */
  icons?: string[];
  /** …ou des ronds colorés. */
  colors?: string[];
  season?: string;
  /** Se débloque à ce niveau (pas dans les boîtes). */
  level?: number;
}
export const TRAILS: TrailDef[] = [
  { id: 'poussiere', name: n('Poussière', 'Dust'), emoji: '💨', r: 'commun', colors: ['#d8c9b5', '#b8a68f'] },
  { id: 'bulles', name: n('Bulles', 'Bubbles'), emoji: '🫧', r: 'commun', colors: ['#bfeaff', '#ffffff'] },
  { id: 'miettes', name: n('Miettes', 'Crumbs'), emoji: '🍪', r: 'commun', colors: ['#c98f4f', '#8a5a2b'] },
  { id: 'etincelles', name: n('Étincelles', 'Sparks'), emoji: '✨', r: 'rare', colors: ['#ffe680', '#ffb300', '#ffffff'] },
  { id: 'bonbons', name: n('Bonbons', 'Candies'), emoji: '🍬', r: 'rare', icons: ['🍬', '🍭'] },
  { id: 'notes', name: n('Notes de musique', 'Music notes'), emoji: '🎶', r: 'rare', icons: ['🎵', '🎶'] },
  { id: 'feu', name: n('Traînée de feu', 'Fire trail'), emoji: '🔥', r: 'epique', icons: ['🔥'] },
  { id: 'arcenciel', name: n('Arc-en-ciel', 'Rainbow'), emoji: '🌈', r: 'epique', colors: ['#ff3b5c', '#ff9d0a', '#ffe600', '#27d96b', '#2e9bff', '#9b5cff'] },
  { id: 'prout', name: n('Turbo prout', 'Turbo toot'), emoji: '🍑', r: 'epique', icons: ['💨', '💨', '🍑'] },
  { id: 'eclair', name: n('Éclairs', 'Lightning'), emoji: '⚡', r: 'legendaire', icons: ['⚡'] },
  { id: 'billets', name: n('Pluie de billets', 'Money trail'), emoji: '💸', r: 'legendaire', icons: ['💸', '🪙'] },
  { id: 'comete', name: n('Comète', 'Comet'), emoji: '☄️', r: 'mythique', icons: ['☄️', '✨', '⭐'] },
  { id: 'galaxie', name: n('Poussière d’étoiles', 'Stardust'), emoji: '🪐', r: 'mythique', icons: ['🪐', '✨', '🌟'] },
  { id: 'confettis', name: n('Confettis du fidèle', 'Loyal confetti'), emoji: '🎊', r: 'rare', level: 7, colors: ['#ff4f9a', '#ffd60a', '#2ec5ff', '#22c99a'] },
  { id: 'flocons', name: n('Flocons', 'Snowflakes'), emoji: '❄️', r: 'rare', icons: ['❄️'], season: 'noel' },
  { id: 'cupidon', name: n('Cœurs de Cupidon', 'Cupid hearts'), emoji: '💘', r: 'rare', icons: ['💘', '💖'], season: 'amour' },
  { id: 'petales', name: n('Pétales', 'Petals'), emoji: '🌸', r: 'rare', icons: ['🌸', '🌼'], season: 'printemps' },
  { id: 'vagues', name: n('Vagues', 'Waves'), emoji: '🌊', r: 'rare', icons: ['🌊', '🫧'], season: 'ete' },
  { id: 'chauves', name: n('Nuée de chauves-souris', 'Bat swarm'), emoji: '🦇', r: 'rare', icons: ['🦇', '🕸️'], season: 'halloween' },
];

/** La traînée s'adapte au jeu. Les jeux absents n'en ont pas (cartes, quiz, votes : personne ne court). */
export type TrailMode = 'kart' | 'lane' | 'run' | 'top';
export const TRAIL_MODE: Record<string, TrailMode> = {
  cri: 'lane',
  kart: 'kart', // Deux lignes derrière le bolide, grosses et longues
  pouces: 'lane', // Le coureur reste au milieu de son couloir : ça file vers l'arrière
  obstacles: 'run',
  maree: 'run',
  combat: 'run',
  bagarre: 'run',
  archers: 'run',
  foot: 'top', // Vu de dessus : petit et discret
  sumo: 'top',
  bombes: 'top',
  chaises: 'top',
  patate: 'top',
  pluie: 'top',
  couleur: 'top',
  pixel: 'top',
  lave: 'top',
  trappe: 'top',
};

// ——— Cadres animés autour du perso ———
export interface FrameDef {
  id: string;
  name: Name;
  emoji: string;
  r: R;
  /** Dégradé de l'anneau (couleurs qui tournent). */
  ring?: string[];
  /** Tour complet en secondes. */
  spin?: number;
  /** Petits emojis en orbite. */
  orbit?: string[];
  /** Emoji qui rebondit au-dessus. */
  top?: string;
  season?: string;
  level?: number;
}
export const FRAMES: FrameDef[] = [
  { id: 'menthe', name: n('Anneau menthe', 'Mint ring'), emoji: '🟢', r: 'commun', ring: ['#22c99a', '#bff5e3'], spin: 5 },
  { id: 'citron', name: n('Anneau citron', 'Lemon ring'), emoji: '🟡', r: 'commun', ring: ['#ffd60a', '#fff6b3'], spin: 5 },
  { id: 'sucette', name: n('Sucre d’orge', 'Candy cane'), emoji: '🍭', r: 'commun', ring: ['#ff4f9a', '#ffffff', '#ff4f9a', '#ffffff', '#ff4f9a', '#ffffff'], spin: 6 },
  { id: 'etoiles', name: n('Ronde d’étoiles', 'Star ring'), emoji: '⭐', r: 'rare', orbit: ['⭐', '⭐', '⭐'] },
  { id: 'bulles', name: n('Ronde de bulles', 'Bubble ring'), emoji: '🫧', r: 'rare', ring: ['#7fdcff', '#ffffff'], spin: 4, orbit: ['🫧', '🫧'] },
  { id: 'neon', name: n('Néon', 'Neon'), emoji: '💠', r: 'epique', ring: ['#00f0ff', '#ff17c4', '#00f0ff'], spin: 2 },
  { id: 'coeurs', name: n('Ronde de cœurs', 'Heart ring'), emoji: '💞', r: 'epique', ring: ['#ff4f9a', '#ffc2dd'], spin: 3, orbit: ['💖', '💖', '💖', '💖'] },
  { id: 'feu', name: n('Cercle de feu', 'Ring of fire'), emoji: '🔥', r: 'epique', ring: ['#ffd60a', '#ff5a00', '#b3001b', '#ff5a00', '#ffd60a'], spin: 1.6, orbit: ['🔥', '🔥', '🔥'] },
  { id: 'or', name: n('Cadre d’or', 'Golden frame'), emoji: '🏅', r: 'legendaire', ring: ['#fff3a6', '#ffc400', '#fff0a0', '#c98a00', '#fff3a6'], spin: 2.4, orbit: ['✨', '✨'] },
  { id: 'arcenciel', name: n('Anneau arc-en-ciel', 'Rainbow ring'), emoji: '🌈', r: 'legendaire', ring: ['#ff3b5c', '#ff9d0a', '#ffe600', '#27d96b', '#2e9bff', '#9b5cff', '#ff3b5c'], spin: 1.6 },
  { id: 'couronne', name: n('Sacre royal', 'Royal crowning'), emoji: '👑', r: 'mythique', ring: ['#fff3a6', '#9b5cff', '#ffc400', '#9b5cff', '#fff3a6'], spin: 2, top: '👑', orbit: ['💎', '💎', '💎'] },
  { id: 'cosmos', name: n('Système solaire', 'Solar system'), emoji: '🌌', r: 'mythique', ring: ['#14c8ff', '#6a3dff', '#ff4fd8', '#14c8ff'], spin: 1.4, orbit: ['🪐', '🌍', '☄️', '🌟'] },
  { id: 'bronze', name: n('Médaille de bronze', 'Bronze medal'), emoji: '🥉', r: 'rare', level: 5, ring: ['#c97b3a', '#f2c08a', '#c97b3a'], spin: 4 },
  { id: 'argent', name: n('Médaille d’argent', 'Silver medal'), emoji: '🥈', r: 'epique', level: 15, ring: ['#aab4c0', '#ffffff', '#aab4c0'], spin: 3, orbit: ['✨', '✨'] },
  { id: 'laurier', name: n('Couronne de laurier', 'Laurel wreath'), emoji: '🏅', r: 'legendaire', level: 25, ring: ['#ffc400', '#fff3a6', '#7bd13b', '#ffc400'], spin: 2.2, orbit: ['🌿', '⭐', '🌿', '⭐'] },
  { id: 'gui', name: n('Couronne de houx', 'Holly wreath'), emoji: '🎄', r: 'epique', ring: ['#0f8f4f', '#d9213c', '#0f8f4f', '#d9213c', '#0f8f4f'], spin: 4, orbit: ['❄️', '🎁'], season: 'noel' },
  { id: 'cupidon', name: n('Flèche de Cupidon', 'Cupid’s arrow'), emoji: '💘', r: 'epique', ring: ['#ff4f9a', '#fff', '#ff4f9a'], spin: 3, orbit: ['💘', '💌'], season: 'amour' },
  { id: 'jardin', name: n('Couronne de fleurs', 'Flower crown'), emoji: '🌼', r: 'epique', ring: ['#9ee66b', '#fff27a', '#9ee66b'], spin: 5, orbit: ['🌸', '🌼', '🦋'], season: 'printemps' },
  { id: 'plage', name: n('Bouée de plage', 'Beach ring'), emoji: '🏖️', r: 'epique', ring: ['#1fb6d9', '#fff', '#ff5a5a', '#fff', '#1fb6d9'], spin: 4, orbit: ['☀️', '🐚'], season: 'ete' },
  { id: 'toile', name: n('Cercle hanté', 'Haunted ring'), emoji: '🕸️', r: 'epique', ring: ['#ff8a1f', '#2b2238', '#ff8a1f'], spin: 3, orbit: ['🎃', '👻', '🦇'], season: 'halloween' },
];

// ——— Styles de nom (dégradé qui bouge) ———
export interface PlateDef {
  id: string;
  name: Name;
  emoji: string;
  r: R;
  colors: string[];
  /** Vitesse de défilement en secondes (0 : immobile). */
  speed?: number;
  season?: string;
  level?: number;
}
export const PLATES: PlateDef[] = [
  { id: 'bonbon', name: n('Nom bonbon', 'Candy name'), emoji: '🍬', r: 'commun', colors: ['#ff4f9a', '#ff8ac0'] },
  { id: 'ciel', name: n('Nom ciel', 'Sky name'), emoji: '🌤️', r: 'commun', colors: ['#2e9bff', '#14c8ff'] },
  { id: 'foret', name: n('Nom forêt', 'Forest name'), emoji: '🌲', r: 'rare', colors: ['#0a9d63', '#7bd13b'] },
  { id: 'coucher', name: n('Coucher de soleil', 'Sunset name'), emoji: '🌇', r: 'rare', colors: ['#ff9a1f', '#ff3b5c', '#9b5cff'], speed: 4 },
  { id: 'neon', name: n('Nom néon', 'Neon name'), emoji: '💡', r: 'epique', colors: ['#00d5e8', '#ff17c4', '#00d5e8'], speed: 2.4 },
  { id: 'feu', name: n('Nom en feu', 'Burning name'), emoji: '🔥', r: 'epique', colors: ['#ffb300', '#ff5a00', '#c4122d', '#ffb300'], speed: 1.6 },
  { id: 'or', name: n('Lettres d’or', 'Golden letters'), emoji: '🏆', r: 'legendaire', colors: ['#c98a00', '#ffe680', '#c98a00', '#ffe680', '#c98a00'], speed: 2.2 },
  { id: 'arcenciel', name: n('Nom arc-en-ciel', 'Rainbow name'), emoji: '🌈', r: 'legendaire', colors: ['#ff3b5c', '#ff9d0a', '#e6c800', '#27d96b', '#2e9bff', '#9b5cff', '#ff3b5c'], speed: 1.8 },
  { id: 'cosmos', name: n('Nom cosmique', 'Cosmic name'), emoji: '🌌', r: 'mythique', colors: ['#14c8ff', '#6a3dff', '#ff4fd8', '#14c8ff', '#6a3dff'], speed: 1.2 },
  { id: 'veteran', name: n('Nom de vétéran', 'Veteran name'), emoji: '🎖️', r: 'epique', level: 18, colors: ['#7a4fd0', '#ff4f9a', '#7a4fd0'], speed: 2.6 },
  { id: 'noel', name: n('Sucre de Noël', 'Christmas sugar'), emoji: '🎅', r: 'legendaire', colors: ['#d9213c', '#0f8f4f', '#d9213c'], speed: 2.5, season: 'noel' },
  { id: 'amour', name: n('Lettres d’amour', 'Love letters'), emoji: '💌', r: 'legendaire', colors: ['#ff4f9a', '#c4125f', '#ff4f9a'], speed: 2.5, season: 'amour' },
  { id: 'printemps', name: n('Nom bourgeon', 'Budding name'), emoji: '🌱', r: 'legendaire', colors: ['#6fcf5a', '#ff8ac0', '#6fcf5a'], speed: 2.5, season: 'printemps' },
  { id: 'ete', name: n('Nom tropical', 'Tropical name'), emoji: '🌴', r: 'legendaire', colors: ['#1fb6d9', '#ff9a1f', '#1fb6d9'], speed: 2.5, season: 'ete' },
  { id: 'halloween', name: n('Nom maudit', 'Cursed name'), emoji: '💀', r: 'legendaire', colors: ['#ff8a1f', '#6a1fa8', '#ff8a1f'], speed: 2, season: 'halloween' },
];

// ——— Titres ———
export interface TitleDef {
  id: string;
  name: Name;
  r: R;
  season?: string;
  level?: number;
}
export const TITLES: TitleDef[] = [
  { id: 'patate', name: n('La Patate du Canapé', 'The Couch Potato'), r: 'commun' },
  { id: 'miettes', name: n('Ramasseur de miettes', 'Crumb Collector'), r: 'commun' },
  { id: 'perdant', name: n('Mauvais perdant', 'Sore Loser'), r: 'commun' },
  { id: 'debutant', name: n('Le Bleu', 'The Rookie'), r: 'commun' },
  { id: 'telecommande', name: n('Maître de la télécommande', 'Remote Master'), r: 'rare' },
  { id: 'dimanche', name: n('Champion du dimanche', 'Sunday Champion'), r: 'rare' },
  { id: 'bobards', name: n('Expert en bobards', 'Fibbing Expert'), r: 'rare' },
  { id: 'coussins', name: n('Star des coussins', 'Pillow Star'), r: 'rare' },
  { id: 'terreur', name: n('La Terreur du Salon', 'Living Room Terror'), r: 'epique' },
  { id: 'buffet', name: n('Légende du buffet', 'Buffet Legend'), r: 'epique' },
  { id: 'prout', name: n('Virtuose du coussin péteur', 'Whoopee Virtuoso'), r: 'epique' },
  { id: 'boss', name: n('Le Boss Final', 'The Final Boss'), r: 'legendaire' },
  { id: 'empereur', name: n('Majesté du Canapé', 'Couch Majesty'), r: 'legendaire' },
  { id: 'createur', name: n('Au-delà du Salon', 'Beyond the Living Room'), r: 'mythique' },
  { id: 'dieu', name: n('Divinité du Goûter', 'Snack Deity'), r: 'mythique' },
  { id: 'habitue', name: n('Habitué du Canapé', 'Couch Regular'), r: 'commun', level: 3 },
  { id: 'pilier', name: n('Pilier de Salon', 'Living Room Pillar'), r: 'rare', level: 12 },
  { id: 'lutin', name: n('Lutin en chef', 'Head Elf'), r: 'rare', season: 'noel' },
  { id: 'cupidon', name: n('Cupidon du salon', 'Living Room Cupid'), r: 'rare', season: 'amour' },
  { id: 'chocolat', name: n('Chasseur de chocolat', 'Chocolate Hunter'), r: 'rare', season: 'printemps' },
  { id: 'plage', name: n('Star de la plage', 'Beach Star'), r: 'rare', season: 'ete' },
  { id: 'revenant', name: n('Le Revenant', 'The Revenant'), r: 'rare', season: 'halloween' },
];

// ——— Annonces d'entrée : le présentateur t'annonce quand tu arrives ———
export interface EntryDef {
  id: string;
  name: Name;
  emoji: string;
  r: R;
  line: Name;
  /** Voix : vitesse et hauteur. */
  rate?: number;
  pitch?: number;
  sound?: string;
}
export const ENTRIES: EntryDef[] = [
  { id: 'salut', name: n('Salut tranquille', 'Casual hello'), emoji: '👋', r: 'commun', line: n('{n} est dans la place !', '{n} is in the house!') },
  { id: 'coucou', name: n('Coucou', 'Hey there'), emoji: '🙋', r: 'commun', line: n('Coucou {n} ! Installe-toi.', 'Hey {n}! Take a seat.'), pitch: 1.3 },
  { id: 'catch', name: n('Soirée catch', 'Wrestling night'), emoji: '🤼', r: 'rare', line: n('Et dans le coin droit du canapé… {n} !', 'And in the right corner of the couch… {n}!'), rate: 1.05, pitch: 0.8, sound: 'cor' },
  { id: 'vip', name: n('Entrée VIP', 'VIP entrance'), emoji: '🕶️', r: 'rare', line: n('Attention, VIP ! Laissez passer {n} !', 'Heads up, VIP! Make way for {n}!'), sound: 'cloches' },
  { id: 'ecureuil', name: n('Voix d’écureuil', 'Squirrel voice'), emoji: '🐿️', r: 'rare', line: n('Salut salut salut, c’est {n} !', 'Hi hi hi, it’s {n}!'), rate: 1.5, pitch: 2 },
  { id: 'film', name: n('Bande-annonce', 'Movie trailer'), emoji: '🎬', r: 'epique', line: n('Cet hiver, sur votre canapé… {n}.', 'This winter, on your couch… {n}.'), rate: 0.75, pitch: 0.3, sound: 'orgue' },
  { id: 'prout', name: n('Entrée parfumée', 'Scented entrance'), emoji: '💨', r: 'epique', line: n('Vous sentez ça ? C’est {n} qui arrive !', 'Can you smell that? {n} is coming!'), sound: 'petroyal' },
  { id: 'robot', name: n('Intelligence supérieure', 'Superior AI'), emoji: '🤖', r: 'epique', line: n('Analyse terminée. {n} va tous vous battre.', 'Scan complete. {n} will beat you all.'), rate: 0.8, pitch: 0.1, sound: 'bit8' },
  { id: 'roi', name: n('Entrée royale', 'Royal entrance'), emoji: '👑', r: 'legendaire', line: n('Levez-vous ! Voici sa majesté {n} !', 'All rise! Here comes their majesty {n}!'), rate: 0.9, pitch: 0.7, sound: 'fanfare' },
  { id: 'dieu', name: n('Descente céleste', 'Heavenly descent'), emoji: '👼', r: 'mythique', line: n('Les cieux s’ouvrent. {n} descend sur le canapé.', 'The heavens open. {n} descends upon the couch.'), rate: 0.7, pitch: 0.5, sound: 'choeur' },
];

// ——— Thèmes de manette ———
export interface PadThemeDef {
  id: string;
  name: Name;
  emoji: string;
  r: R;
  /** Fond de la manette et couleur des poignées. */
  bg: string;
  grip: string;
  ink: string;
  anim?: boolean;
  level?: number;
}
export const PAD_THEMES: PadThemeDef[] = [
  { id: 'menthe', name: n('Menthe à l’eau', 'Mint water'), emoji: '🧊', r: 'commun', bg: '#e3fbf2', grip: '#8fe8ca', ink: '#3a2140' },
  { id: 'citron', name: n('Limonade', 'Lemonade'), emoji: '🍋', r: 'commun', bg: '#fffbd6', grip: '#ffe66b', ink: '#3a2140' },
  { id: 'fraise', name: n('Fraise écrasée', 'Crushed strawberry'), emoji: '🍓', r: 'commun', bg: '#ffe6ef', grip: '#ff9ec0', ink: '#3a2140' },
  { id: 'bois', name: n('Vieux bois', 'Old wood'), emoji: '🪵', r: 'rare', bg: 'repeating-linear-gradient(95deg,#c98f4f 0 26px,#b57c3f 26px 34px,#d19a5c 34px 70px)', grip: '#7a4d22', ink: '#3a2140' },
  { id: 'retro', name: n('Console rétro', 'Retro console'), emoji: '🕹️', r: 'rare', bg: '#d9d4c7', grip: '#8d8778', ink: '#3a2140' },
  { id: 'jean', name: n('Jean délavé', 'Washed denim'), emoji: '👖', r: 'rare', bg: 'repeating-linear-gradient(45deg,#4b76b5 0 4px,#3f689f 4px 8px)', grip: '#27456f', ink: '#ffffff' },
  { id: 'champion', name: n('Manette du champion', 'Champion’s controller'), emoji: '🏆', r: 'epique', level: 10, bg: 'linear-gradient(135deg,#ffe680,#ff9d0a)', grip: '#c96a00', ink: '#3a2140' },
  { id: 'nuit', name: n('Minuit', 'Midnight'), emoji: '🌙', r: 'epique', bg: 'linear-gradient(160deg,#241a66,#100b33)', grip: '#3d2fa8', ink: '#ffffff' },
  { id: 'neon', name: n('Salle d’arcade', 'Arcade room'), emoji: '👾', r: 'epique', bg: 'linear-gradient(120deg,#1a0f2e,#34105c 50%,#1a0f2e)', grip: '#ff17c4', ink: '#ffffff' },
  { id: 'or', name: n('Manette en or', 'Golden controller'), emoji: '🥇', r: 'legendaire', bg: 'linear-gradient(115deg,#c98a00,#ffe680 30%,#ffc400 50%,#fff3a6 70%,#c98a00)', grip: '#8f6300', ink: '#3a2140', anim: true },
  { id: 'lave', name: n('Coulée de lave', 'Lava flow'), emoji: '🌋', r: 'legendaire', bg: 'linear-gradient(120deg,#2b0a0a,#b3001b 30%,#ff5a00 50%,#b3001b 70%,#2b0a0a)', grip: '#ff9d0a', ink: '#ffffff', anim: true },
  { id: 'galaxie', name: n('Galaxie', 'Galaxy'), emoji: '🌌', r: 'mythique', bg: 'radial-gradient(circle at 20% 30%,#fff 0 2px,transparent 3px),radial-gradient(circle at 70% 60%,#fff 0 2px,transparent 3px),radial-gradient(circle at 40% 80%,#fff 0 1.5px,transparent 3px),linear-gradient(120deg,#12082e,#3a1a8c 40%,#a01f9c 60%,#12082e)', grip: '#6a3dff', ink: '#ffffff', anim: true },
];

// ——— Réactions à débloquer (ajoutées après les réactions gratuites) ———
export interface ReactDef {
  id: string;
  name: Name;
  r: R;
  e: string;
  txt?: Name;
  /** Plus gros à l'écran. */
  big?: boolean;
  /** Tout l'écran en profite. */
  rain?: boolean;
  sound?: string;
}
export const REACT_ITEMS: ReactDef[] = [
  { id: 'canard', name: n('Coin coin', 'Quack'), r: 'commun', e: '🦆' },
  { id: 'banane', name: n('Banane', 'Banana'), r: 'commun', e: '🍌' },
  { id: 'cerveau', name: n('Gros cerveau', 'Big brain'), r: 'commun', e: '🧠' },
  { id: 'chaud', name: n('Il fait chaud', 'So hot'), r: 'commun', e: '🥶', txt: n('GLACIAL', 'ICE COLD') },
  { id: 'cent', name: n('100 %', '100%'), r: 'rare', e: '💯', big: true },
  { id: 'lose', name: n('La lose', 'Loser'), r: 'rare', e: '💬', txt: n('LA LOSE', 'LOSER') },
  { id: 'trop', name: n('Trop fort', 'Too good'), r: 'rare', e: '💬', txt: n('TROP FORT', 'TOO GOOD') },
  { id: 'revoir', name: n('Au revoir', 'Bye bye'), r: 'rare', e: '💬', txt: n('AU REVOIR !', 'BYE BYE!') },
  { id: 'clown', name: n('Grand clown', 'Big clown'), r: 'epique', e: '🤡', big: true, sound: 'boing' },
  { id: 'couronne', name: n('Couronne géante', 'Giant crown'), r: 'epique', e: '👑', big: true, sound: 'cloches' },
  { id: 'corne', name: n('Corne de brume', 'Air horn'), r: 'epique', e: '📯', big: true, sound: 'cor' },
  { id: 'boom', name: n('Méga BOUM', 'Mega BOOM'), r: 'legendaire', e: '💥', big: true, rain: true, sound: 'boom' },
  { id: 'pluieprout', name: n('Tempête de prouts', 'Toot storm'), r: 'legendaire', e: '💨', big: true, rain: true, sound: 'pet' },
  { id: 'trone', name: n('Sur le trône', 'On the throne'), r: 'mythique', e: '🚽', big: true, rain: true, sound: 'petroyal' },
  { id: 'meteore', name: n('Météorite', 'Meteor'), r: 'mythique', e: '☄️', big: true, rain: true, sound: 'boom' },
];

/** Effets et titres de saison pour la pluie d'écran. */
export const SEASON_WIN_FX: { id: string; name: Name; emoji: string; icons: string[]; season: string }[] = [
  { id: 'neige', name: n('Tempête de neige', 'Snowstorm'), emoji: '☃️', icons: ['❄️', '⛄', '🎁'], season: 'noel' },
  { id: 'valentin', name: n('Pluie de lettres d’amour', 'Love letter rain'), emoji: '💌', icons: ['💌', '💘', '🌹'], season: 'amour' },
  { id: 'oeufs', name: n('Chasse aux œufs', 'Egg hunt'), emoji: '🥚', icons: ['🥚', '🐣', '🍫'], season: 'printemps' },
  { id: 'tropiques', name: n('Sous les tropiques', 'Tropical rain'), emoji: '🌴', icons: ['🌴', '🍹', '🕶️'], season: 'ete' },
  { id: 'citrouilles', name: n('Pluie de citrouilles', 'Pumpkin rain'), emoji: '🎃', icons: ['🎃', '👻', '🍬'], season: 'halloween' },
];
