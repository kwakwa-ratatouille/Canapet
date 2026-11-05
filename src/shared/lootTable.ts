// Cosmétiques et boîtes : rareté de chaque objet, contenu et chances des boîtes.
// Règles : jamais de doublon tant qu'il reste quelque chose à gagner, chances affichées, aucun avantage en jeu, rien à revendre.
import { ENTRIES, FRAMES, PAD_THEMES, PLATES, REACT_ITEMS, SEASON_WIN_FX, SEASONS, TITLES, TRAILS, currentSeason } from './cosmetics2';
import type { Lang } from './protocol';

type Name = Record<Lang, string>;

export type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire' | 'mythique';
export const RARITY_ORDER: Rarity[] = ['commun', 'rare', 'epique', 'legendaire', 'mythique'];

/** `price` = achat direct en bonbons. Règle simple : de commun à épique on peut acheter, légendaire et mythique seulement dans les boîtes. */
export const RARITIES: Record<Rarity, { name: Name; color: string; price: number }> = {
  commun: { name: { fr: 'Commun', en: 'Common' }, color: '#8fa3b5', price: 150 },
  rare: { name: { fr: 'Rare', en: 'Rare' }, color: '#2e9bff', price: 450 },
  epique: { name: { fr: 'Épique', en: 'Epic' }, color: '#9b5cff', price: 1200 },
  legendaire: { name: { fr: 'Légendaire', en: 'Legendary' }, color: '#ff9d0a', price: 0 },
  mythique: { name: { fr: 'Mythique', en: 'Mythic' }, color: '#ff2f7e', price: 0 },
};

export type LootKind = 'food' | 'hat' | 'acc' | 'color' | 'eyes' | 'skin' | 'pose' | 'winpose' | 'winsound' | 'ko' | 'winfx' | 'trail' | 'frame' | 'plate' | 'title' | 'react' | 'entry' | 'padtheme';

/** 6 de chaque de base : le reste s'obtient dans les boîtes. */
export const BASE = {
  food: ['coussin', 'tartine', 'cornichon', 'oeuf', 'fromage', 'tomate'],
  hat: ['casquette', 'bob', 'noeud', 'antenne', 'fete', 'fleur'],
  acc: ['lunettes', 'moustache', 'rougir', 'soleil', 'bisou', 'clown'],
  color: ['#ff4f9a', '#ff3b3b', '#ff9a1f', '#ffd60a', '#7bd13b', '#1fc9a0'],
};
/** Couleurs à gagner (baskets et marque du joueur). */
export const COLOR_ITEMS: { id: string; name: Name; r: Rarity }[] = [
  { id: '#2ec5ff', name: { fr: 'Ciel', en: 'Sky' }, r: 'commun' },
  { id: '#3a6bff', name: { fr: 'Bleu', en: 'Blue' }, r: 'commun' },
  { id: '#9b5cff', name: { fr: 'Violet', en: 'Purple' }, r: 'commun' },
  { id: '#e08bff', name: { fr: 'Lilas', en: 'Lilac' }, r: 'commun' },
  { id: '#ff7f6b', name: { fr: 'Corail', en: 'Coral' }, r: 'commun' },
  { id: '#ffb38a', name: { fr: 'Pêche', en: 'Peach' }, r: 'commun' },
  { id: '#c6f000', name: { fr: 'Citron vert', en: 'Lime' }, r: 'commun' },
  { id: '#a0643a', name: { fr: 'Noisette', en: 'Hazelnut' }, r: 'rare' },
  { id: '#f2f2f2', name: { fr: 'Blanc', en: 'White' }, r: 'rare' },
  { id: '#00c2c7', name: { fr: 'Turquoise', en: 'Turquoise' }, r: 'rare' },
  { id: '#c4125f', name: { fr: 'Framboise', en: 'Raspberry' }, r: 'rare' },
  { id: '#0a9d63', name: { fr: 'Émeraude', en: 'Emerald' }, r: 'rare' },
  { id: '#4a2fbd', name: { fr: 'Indigo', en: 'Indigo' }, r: 'rare' },
  { id: '#2b2238', name: { fr: 'Réglisse', en: 'Liquorice' }, r: 'epique' },
  { id: '#7a1230', name: { fr: 'Bordeaux', en: 'Burgundy' }, r: 'epique' },
  { id: '#aab4c0', name: { fr: 'Argent', en: 'Silver' }, r: 'epique' },
  { id: '#ff17c4', name: { fr: 'Rose néon', en: 'Neon pink' }, r: 'legendaire' },
  { id: '#00f0ff', name: { fr: 'Cyan néon', en: 'Neon cyan' }, r: 'legendaire' },
  { id: '#d9a400', name: { fr: 'Doré', en: 'Golden' }, r: 'legendaire' },
];
const colorsOf = (r: Rarity) => COLOR_ITEMS.filter((c) => c.r === r).map((c) => `color:${c.id}`);

// ——— Nouvelles catégories ———

export interface SkinDef {
  id: string;
  name: Name;
  colors: string[];
  /** Assombrit (0-1). */
  dark?: number;
  shine?: boolean;
  stars?: boolean;
  /** Transparence du perso (1 = opaque). */
  alpha?: number;
}
export const SKINS: SkinDef[] = [
  { id: 'fraise', name: { fr: 'Fraise', en: 'Strawberry' }, colors: ['#ff6fa8', '#ff3d7f'] },
  { id: 'menthe', name: { fr: 'Menthe', en: 'Mint' }, colors: ['#7df0c5', '#22c99a'] },
  { id: 'ciel', name: { fr: 'Ciel', en: 'Sky' }, colors: ['#8fdcff', '#3aa6ff'] },
  { id: 'lavande', name: { fr: 'Lavande', en: 'Lavender' }, colors: ['#cdb2ff', '#9b6cff'] },
  { id: 'citron', name: { fr: 'Citron', en: 'Lemon' }, colors: ['#fff27a', '#ffd60a'] },
  { id: 'neon', name: { fr: 'Néon', en: 'Neon' }, colors: ['#00ffd5', '#ff00c8'], shine: true },
  { id: 'nuit', name: { fr: 'Minuit', en: 'Midnight' }, colors: ['#4a5bd6', '#241a66'], dark: 0.25 },
  { id: 'lave', name: { fr: 'Lave', en: 'Lava' }, colors: ['#ffd60a', '#ff5a00', '#b3001b'], shine: true },
  { id: 'fantome', name: { fr: 'Fantôme', en: 'Ghost' }, colors: ['#ffffff', '#cfe9ff'], alpha: 0.62 },
  { id: 'chrome', name: { fr: 'Chrome', en: 'Chrome' }, colors: ['#ffffff', '#8c98a8', '#eef2f7', '#6d7887'], shine: true },
  { id: 'or', name: { fr: 'Or massif', en: 'Solid gold' }, colors: ['#fff3a6', '#ffc400', '#fff0a0', '#c98a00'], shine: true },
  { id: 'arcenciel', name: { fr: 'Arc-en-ciel', en: 'Rainbow' }, colors: ['#ff3b5c', '#ff9d0a', '#ffe600', '#27d96b', '#2e9bff', '#9b5cff'], shine: true },
  { id: 'galaxie', name: { fr: 'Galaxie', en: 'Galaxy' }, colors: ['#ff4fd8', '#6a3dff', '#14c8ff'], dark: 0.4, stars: true },
  { id: 'diamant', name: { fr: 'Diamant', en: 'Diamond' }, colors: ['#ffffff', '#a6f4ff', '#e6fbff', '#6fd6ff'], shine: true, stars: true },
];

/** Pose de victoire (podium) : les bras + une petite danse. */
export const WIN_POSES: { id: string; name: Name; emoji: string; pose: string; anim: string }[] = [
  { id: 'bras', name: { fr: 'Bras en l’air', en: 'Arms up' }, emoji: '🙌', pose: '', anim: 'wp-jump' },
  { id: 'coucou', name: { fr: 'Coucou la foule', en: 'Crowd wave' }, emoji: '👋', pose: 'wave', anim: 'wp-sway' },
  { id: 'peace', name: { fr: 'Peace tranquille', en: 'Chill peace' }, emoji: '✌️', pose: 'peace', anim: 'wp-sway' },
  { id: 'muscle', name: { fr: 'Gonflette', en: 'Muscle show' }, emoji: '💪', pose: 'flex', anim: 'wp-pump' },
  { id: 'dab', name: { fr: 'Dab sauté', en: 'Jump dab' }, emoji: '🤸', pose: 'dab', anim: 'wp-jump' },
  { id: 'rock', name: { fr: 'Rockstar', en: 'Rockstar' }, emoji: '🤘', pose: 'rock', anim: 'wp-pump' },
  { id: 'disco', name: { fr: 'Disco Fever', en: 'Disco Fever' }, emoji: '🕺', pose: 'disco', anim: 'wp-spin' },
  { id: 'heros', name: { fr: 'Super-héros volant', en: 'Flying hero' }, emoji: '🦸', pose: 'hero', anim: 'wp-float' },
  { id: 'toupie', name: { fr: 'La toupie', en: 'The spinner' }, emoji: '🌀', pose: 'hero', anim: 'wp-spin-fast' },
  { id: 'lacroix', name: { fr: 'Salto arrière', en: 'Backflip' }, emoji: '🤾', pose: 'flex', anim: 'wp-flip' },
];

/** Son de victoire : joué à la télé quand on gagne. */
export const WIN_SOUNDS: { id: string; name: Name; emoji: string }[] = [
  { id: 'jingle', name: { fr: 'Petit jingle', en: 'Little jingle' }, emoji: '🎵' },
  { id: 'sifflet', name: { fr: 'Sifflet', en: 'Whistle' }, emoji: '😗' },
  { id: 'bit8', name: { fr: 'Arcade 8 bits', en: '8-bit arcade' }, emoji: '👾' },
  { id: 'cloches', name: { fr: 'Clochettes', en: 'Bells' }, emoji: '🔔' },
  { id: 'cor', name: { fr: 'Corne de brume', en: 'Air horn' }, emoji: '📯' },
  { id: 'petroyal', name: { fr: 'Pet royal', en: 'Royal toot' }, emoji: '💨' },
  { id: 'orgue', name: { fr: 'Grand orgue', en: 'Grand organ' }, emoji: '🎹' },
  { id: 'fanfare', name: { fr: 'Fanfare du château', en: 'Castle fanfare' }, emoji: '🎺' },
  { id: 'choeur', name: { fr: 'Chœur céleste', en: 'Heavenly choir' }, emoji: '👼' },
];

/** Effet d'élimination : apparaît à la télé quand on sort du jeu. */
export const KO_FX: { id: string; name: Name; emoji: string; icons: string[]; rise?: boolean }[] = [
  { id: 'pouf', name: { fr: 'Pouf', en: 'Poof' }, emoji: '💨', icons: ['💨', '☁️'] },
  { id: 'plouf', name: { fr: 'Plouf', en: 'Splash' }, emoji: '💦', icons: ['💦', '🫧'] },
  { id: 'banane', name: { fr: 'Peau de banane', en: 'Banana peel' }, emoji: '🍌', icons: ['🍌', '💫'] },
  { id: 'etoiles', name: { fr: 'Tête qui tourne', en: 'Seeing stars' }, emoji: '💫', icons: ['💫', '⭐'] },
  { id: 'explosion', name: { fr: 'Explosion', en: 'Explosion' }, emoji: '💥', icons: ['💥', '🔥'] },
  { id: 'eclair', name: { fr: 'Foudroyé', en: 'Thunderstruck' }, emoji: '⚡', icons: ['⚡', '🌩️'] },
  { id: 'fantome', name: { fr: 'Fantôme qui monte', en: 'Rising ghost' }, emoji: '👻', icons: ['👻'], rise: true },
  { id: 'ange', name: { fr: 'Monté au ciel', en: 'Off to heaven' }, emoji: '😇', icons: ['😇', '🪽'], rise: true },
  { id: 'trou', name: { fr: 'Trou noir', en: 'Black hole' }, emoji: '🕳️', icons: ['🕳️', '🌀', '🪐'] },
];

/** Effet d'écran : pluie sur toute la télé quand on gagne. */
export const WIN_FX: { id: string; name: Name; emoji: string; icons: string[]; season?: string }[] = [
  ...SEASON_WIN_FX,
  { id: 'bonbons', name: { fr: 'Pluie de bonbons', en: 'Candy rain' }, emoji: '🍬', icons: ['🍬', '🍭'] },
  { id: 'ballons', name: { fr: 'Ballons', en: 'Balloons' }, emoji: '🎈', icons: ['🎈', '🎉'] },
  { id: 'pizza', name: { fr: 'Pluie de pizza', en: 'Pizza rain' }, emoji: '🍕', icons: ['🍕'] },
  { id: 'coeurs', name: { fr: 'Pluie de cœurs', en: 'Heart rain' }, emoji: '💖', icons: ['💖', '💘'] },
  { id: 'etoiles', name: { fr: 'Pluie d’étoiles', en: 'Star rain' }, emoji: '🌟', icons: ['🌟', '✨'] },
  { id: 'pets', name: { fr: 'Pluie de prouts', en: 'Toot rain' }, emoji: '💨', icons: ['💨', '🍑'] },
  { id: 'billets', name: { fr: 'Pluie de billets', en: 'Money rain' }, emoji: '💸', icons: ['💸', '🪙'] },
  { id: 'feu', name: { fr: 'En feu', en: 'On fire' }, emoji: '🔥', icons: ['🔥', '🧨'] },
  { id: 'disco', name: { fr: 'Soirée disco', en: 'Disco night' }, emoji: '🪩', icons: ['🪩', '🎶', '✨'] },
  { id: 'cosmos', name: { fr: 'Cosmos', en: 'Cosmos' }, emoji: '🪐', icons: ['🪐', '💫', '🛸'] },
];

/** Bouton « essayer » et étiquette des objets sans dessin. */
export const iconOf = (key: string): string => {
  const [kind, id] = key.split(':');
  const list: { id: string; emoji: string }[] = kind === 'winpose' ? WIN_POSES : kind === 'winsound' ? WIN_SOUNDS : kind === 'ko' ? KO_FX : kind === 'winfx' ? WIN_FX : kind === 'trail' ? TRAILS : kind === 'entry' ? ENTRIES : kind === 'frame' ? FRAMES : kind === 'plate' ? PLATES : kind === 'padtheme' ? PAD_THEMES : [];
  return list.find((x) => x.id === id)?.emoji ?? '🎁';
};

// ——— Rareté de chaque objet, selon sa beauté et le succès qu'il devrait avoir ———

const list = (kind: LootKind, ids: string) => ids.split(' ').map((id) => `${kind}:${id}`);

export const TABLE: Record<Rarity, string[]> = {
  commun: [
    ...list('food', 'beignet brocoli patate cookie yaourt cupcake sushi frites bonbon oeufplat tasse chaussette'),
    ...list('hat', 'bonnet ninja bandana chat paille'),
    ...list('acc', 'pansement'),
    ...colorsOf('commun'),
    ...list('skin', 'fraise menthe ciel lavande citron'),
    ...list('pose', 'point flex peace shrug'),
    ...list('winpose', 'coucou peace'),
    ...list('winsound', 'jingle sifflet'),
    ...list('ko', 'pouf plouf'),
    ...list('winfx', 'bonbons ballons'),
  ],
  rare: [
    ...list('food', 'pizza glace avocat macaron banane croque chewing ravioli oignon champi ketchup gaufre'),
    ...list('hat', 'lapin chantier cornes haut toque cowboy dj frites pizzahat sombrero'),
    ...list('acc', 'monocle barbe masque echarpe crocs tuba'),
    ...list('skin', 'neon nuit'),
    ...list('pose', 'double think salute dab'),
    ...list('eyes', 'star'),
    ...colorsOf('rare'),
    ...list('winpose', 'bras muscle'),
    ...list('winsound', 'bit8 cloches cor'),
    ...list('ko', 'banane etoiles'),
    ...list('winfx', 'pizza coeurs'),
  ],
  epique: [
    ...list('food', 'nuage popcorn saucisse pasteque nouilles'),
    ...list('hat', 'pirate sorciere viking afro pere renne citrouille chauve ananas requin astronaute neon'),
    ...list('acc', 'etoiles coeurs cape vr'),
    ...list('skin', 'lave fantome chrome'),
    ...list('pose', 'rock disco hero'),
    ...colorsOf('epique'),
    ...list('winpose', 'dab rock'),
    ...list('winsound', 'petroyal orgue'),
    ...list('ko', 'explosion eclair'),
    ...list('winfx', 'etoiles pets billets'),
  ],
  legendaire: [
    ...list('hat', 'couronne aureole licorne flammes samourai pharaon'),
    ...list('acc', 'ailes cyborg'),
    ...list('skin', 'or arcenciel'),
    ...colorsOf('legendaire'),
    ...list('winpose', 'disco heros'),
    ...list('winsound', 'fanfare'),
    ...list('ko', 'fantome ange'),
    ...list('winfx', 'feu disco'),
  ],
  mythique: [
    ...list('hat', 'dragon cosmique'),
    ...list('acc', 'ailesdragon'),
    ...list('skin', 'galaxie diamant'),
    ...list('winpose', 'toupie lacroix'),
    ...list('winsound', 'choeur'),
    ...list('ko', 'trou'),
    ...list('winfx', 'cosmos'),
  ],
};

// Deuxième vague : chaque objet porte sa rareté
const WAVE2: [LootKind, { id: string; r: Rarity }[]][] = [['trail', TRAILS], ['frame', FRAMES], ['plate', PLATES], ['title', TITLES], ['react', REACT_ITEMS], ['entry', ENTRIES], ['padtheme', PAD_THEMES]];
for (const [kind, items] of WAVE2) for (const it of items as { id: string; r: Rarity; level?: number }[]) if (!it.level) TABLE[it.r].push(`${kind}:${it.id}`);
/** Objets qui se débloquent en montant de niveau : ni boîte ni achat. */
export const LEVEL_UNLOCKS: { level: number; key: string; rarity: Rarity }[] = WAVE2.flatMap(([kind, items]) => (items as { id: string; r: Rarity; level?: number }[]).filter((it) => it.level).map((it) => ({ level: it.level!, key: `${kind}:${it.id}`, rarity: it.r }))).sort((a, b) => a.level - b.level);
const SEASON_FX_RARITY: Rarity = 'epique';
for (const fx of SEASON_WIN_FX) TABLE[SEASON_FX_RARITY].push(`winfx:${fx.id}`);

/** Objets de saison : on ne les gagne que pendant leur saison, dans la boîte de saison. */
export const SEASON_OF: Record<string, string> = {};
for (const [kind, items] of WAVE2) for (const it of items as { id: string; season?: string }[]) if (it.season) SEASON_OF[`${kind}:${it.id}`] = it.season;
for (const fx of SEASON_WIN_FX) SEASON_OF[`winfx:${fx.id}`] = fx.season;
export const seasonOf = (key: string) => SEASONS.find((s) => s.id === SEASON_OF[key]) ?? null;

export const rarityOf = (key: string): Rarity | null => RARITY_ORDER.find((r) => TABLE[r].includes(key)) ?? LEVEL_UNLOCKS.find((l) => l.key === key)?.rarity ?? null;
export const levelOf = (key: string) => LEVEL_UNLOCKS.find((l) => l.key === key)?.level ?? 0;

/** Objets déjà vendus en collection (Pass Soirée à part) : on peut aussi les gagner dans les boîtes. */
const COLL: Record<string, string> = {
  'hat:pere': 'coll_noel',
  'hat:renne': 'coll_noel',
  'acc:echarpe': 'coll_noel',
  'hat:citrouille': 'coll_halloween',
  'hat:chauve': 'coll_halloween',
  'acc:crocs': 'coll_halloween',
  'hat:ananas': 'coll_plage',
  'hat:requin': 'coll_plage',
  'acc:tuba': 'coll_plage',
};

/** Prix d'achat direct (ce qui n'est pas listé est gratuit). */
export const LOOT_PRICES: Record<string, { price: number; rarity: Rarity; coll?: string; level?: number }> = Object.fromEntries([
  ...RARITY_ORDER.flatMap((r) => TABLE[r].map((key) => [key, { price: RARITIES[r].price, rarity: r, coll: COLL[key] }])),
  ...LEVEL_UNLOCKS.map((l) => [l.key, { price: 0, rarity: l.rarity, level: l.level }]),
]);

// ——— Boîtes ———

export type BoxId = 'petite' | 'moyenne' | 'grosse' | 'coffre' | 'saison';

export interface BoxDef {
  id: BoxId;
  name: Name;
  emoji: string;
  color: string;
  /** Prix en bonbons (0 : il faut une clé). */
  price: number;
  /** Chances en %, total 100. */
  odds: Partial<Record<Rarity, number>>;
  /** Le meilleur niveau est garanti au bout de ce nombre de boîtes sans l'avoir eu. */
  pity: number;
  top: Rarity;
  /** Taille du dessin. */
  scale: number;
  /** Ne donne que les objets de cette saison. */
  season?: string;
}

export const BOXES: BoxDef[] = [
  { id: 'petite', name: { fr: 'Petite boîte', en: 'Small box' }, emoji: '🎁', color: '#2ec5a0', price: 120, odds: { commun: 78, rare: 19, epique: 3 }, pity: 15, top: 'epique', scale: 0.74 },
  { id: 'moyenne', name: { fr: 'Boîte moyenne', en: 'Medium box' }, emoji: '🎁', color: '#2e9bff', price: 350, odds: { rare: 72, epique: 24, legendaire: 4 }, pity: 15, top: 'legendaire', scale: 0.88 },
  { id: 'grosse', name: { fr: 'Grosse boîte', en: 'Big box' }, emoji: '🎁', color: '#9b5cff', price: 900, odds: { epique: 70, legendaire: 27, mythique: 3 }, pity: 20, top: 'mythique', scale: 1 },
  { id: 'coffre', name: { fr: 'Coffre à clé', en: 'Key chest' }, emoji: '🧰', color: '#ff2f7e', price: 0, odds: { legendaire: 88, mythique: 12 }, pity: 8, top: 'mythique', scale: 1.08 },
];
/** Les boîtes du moment : la boîte de saison n'existe que pendant la saison. */
export function boxesNow(now = Date.now()): BoxDef[] {
  const s = currentSeason(now);
  if (!s) return BOXES;
  return [{ id: 'saison', name: { fr: `Boîte ${s.name.fr}`, en: `${s.name.en} box` }, emoji: s.emoji, color: s.color, price: 400, odds: { rare: 62, epique: 30, legendaire: 8 }, pity: 12, top: 'legendaire', scale: 0.95, season: s.id }, ...BOXES];
}
/** Ce qu'une boîte peut donner dans cette rareté. */
export const poolOf = (box: BoxDef, r: Rarity) => TABLE[r].filter((k) => (box.season ? SEASON_OF[k] === box.season : !SEASON_OF[k]));

/** Clé d'essai tant que les ventes sont coupées (en bonbons). */
export const TEST_KEY_PRICE = 500;

const pickRarity = (box: BoxDef, rng: () => number): Rarity => {
  let n = rng() * 100;
  for (const r of RARITY_ORDER) {
    const v = box.odds[r] ?? 0;
    if (v && (n -= v) < 0) return r;
  }
  return box.top;
};
const pickOf = <T,>(a: T[], rng: () => number) => a[Math.floor(rng() * a.length)];

export interface BoxRoll {
  key: string | null;
  rarity: Rarity;
  /** Bonbons rendus si on possède déjà tout ce que cette boîte peut donner. */
  refund: number;
  pity: number;
}

/** Ouvre une boîte : tire la rareté, puis un objet qu'on n'a pas encore. */
export function rollBox(box: BoxDef, owned: string[], pity: number, rng: () => number = Math.random): BoxRoll {
  const left = (r: Rarity) => poolOf(box, r).filter((k) => !owned.includes(k));
  const count = pity + 1;
  const wanted = count >= box.pity ? box.top : pickRarity(box, rng);
  const tiers = RARITY_ORDER.filter((r) => box.odds[r]);
  // Plus rien dans cette rareté : d'abord la rareté au-dessus, sinon en dessous
  const i = tiers.indexOf(wanted);
  const order = [...tiers.slice(i), ...tiers.slice(0, i).reverse()];
  const rarity = order.find((r) => left(r).length);
  if (!rarity) return { key: null, rarity: wanted, refund: box.price ? Math.round(box.price / 2) : TEST_KEY_PRICE, pity: count };
  return { key: pickOf(left(rarity), rng), rarity, refund: 0, pity: rarity === box.top ? 0 : count };
}

/** Bandeau qui défile : des objets tirés avec les vraies chances de la boîte, le gagnant à la place `at`. */
export function reelItems(box: BoxDef, winner: string | null, winnerRarity: Rarity, at: number, length: number): { key: string; rarity: Rarity }[] {
  const out = Array.from({ length }, () => {
    const r = pickRarity(box, Math.random);
    return { key: pickOf(poolOf(box, r), Math.random), rarity: r };
  });
  if (winner) out[at] = { key: winner, rarity: winnerRarity };
  return out;
}
