// Personnages de Cana'pet : dessinés par le module de la DA (canapet-art.js), convertis une seule fois
// en image puis gardés en cache (un dessin par perso, couleur, chapeau, accessoire et humeur).
// Repère d'appel inchangé : pieds en (x, y), hauteur ~ s.

import { characterSvg, faceSlot, PLAYER_COLORS, CHARACTERS, selfieDecoSvg } from './art/canapet-art.js';
import { LIGHT } from './device';
import { SKINS, type SkinDef } from './lootTable';
import { TRAILS, type TrailDef, type TrailMode } from './cosmetics2';
import type { Lang } from './protocol';

type Name = Record<Lang, string>;

const EN: Record<string, string> = {
  coussin: 'Whoopee',
  tartine: 'Toast',
  cornichon: 'Pickle',
  beignet: 'Donut',
  oeuf: 'Egg',
  fromage: 'Cheese',
  tomate: 'Tomato',
  brocoli: 'Broccoli',
  cupcake: 'Cupcake',
  sushi: 'Sushi',
  frites: 'Fries',
  bonbon: 'Candy',
  chaussette: 'Sock',
  pizza: 'Pizza',
  glace: 'Ice cream',
  avocat: 'Avocado',
  macaron: 'Macaron',
  banane: 'Banana',
  nuage: 'Cloud',
  saucisse: 'Sausage',
  champi: 'Mushroom',
  tasse: 'Mug',
  oignon: 'Onion',
  patate: 'Potato',
  popcorn: 'Popcorn',
  chewing: 'Bubble gum',
  croque: 'Croque-monsieur',
  yaourt: 'Yogurt',
  ravioli: 'Ravioli',
  oeufplat: 'Fried egg',
  pasteque: 'Watermelon',
  cookie: 'Cookie',
  ketchup: 'Ketchup',
  nouilles: 'Noodles',
  gaufre: 'Waffle',
};

export const FOODS: { id: string; name: Name }[] = Object.entries(CHARACTERS).map(([id, fr]) => ({
  id,
  name: { fr, en: EN[id] ?? fr },
}));

/** Les 12 couleurs joueurs, dans le même ordre qu'avant (source : tokens de la DA). */
export const COLORS = PLAYER_COLORS;

// Mêmes identifiants que le module de la DA : les profils déjà sauvegardés restent valables.
export const HATS: { id: string; name: Name }[] = [
  { id: 'aucun', name: { fr: 'Aucun', en: 'None' } },
  { id: 'couronne', name: { fr: 'Couronne', en: 'Crown' } },
  { id: 'casquette', name: { fr: 'Casquette', en: 'Cap' } },
  { id: 'haut', name: { fr: 'Haut-de-forme', en: 'Top hat' } },
  { id: 'bob', name: { fr: 'Bob', en: 'Bucket hat' } },
  { id: 'cornes', name: { fr: 'Cornes', en: 'Horns' } },
  { id: 'antenne', name: { fr: 'Antenne', en: 'Antenna' } },
  { id: 'noeud', name: { fr: 'Nœud', en: 'Bow' } },
  { id: 'bonnet', name: { fr: 'Bonnet', en: 'Beanie' } },
  { id: 'sombrero', name: { fr: 'Sombrero', en: 'Sombrero' } },
  { id: 'paille', name: { fr: 'Chapeau de paille', en: 'Straw hat' } },
  { id: 'chat', name: { fr: 'Oreilles de chat', en: 'Cat ears' } },
  { id: 'lapin', name: { fr: 'Oreilles de lapin', en: 'Bunny ears' } },
  { id: 'chantier', name: { fr: 'Casque de chantier', en: 'Hard hat' } },
  { id: 'bandana', name: { fr: 'Bandana', en: 'Bandana' } },
  { id: 'pere', name: { fr: 'Bonnet de Noël', en: 'Santa hat' } },
  { id: 'renne', name: { fr: 'Bois de renne', en: 'Reindeer antlers' } },
  { id: 'citrouille', name: { fr: 'Citrouille', en: 'Pumpkin' } },
  { id: 'chauve', name: { fr: 'Chauve-souris', en: 'Bat' } },
  { id: 'ananas', name: { fr: 'Ananas', en: 'Pineapple' } },
  { id: 'requin', name: { fr: 'Aileron de requin', en: 'Shark fin' } },
  { id: 'fete', name: { fr: 'Chapeau de fête', en: 'Party hat' } },
  { id: 'fleur', name: { fr: 'Fleur', en: 'Flower' } },
  { id: 'toque', name: { fr: 'Toque de chef', en: 'Chef hat' } },
  { id: 'pirate', name: { fr: 'Pirate', en: 'Pirate' } },
  { id: 'sorciere', name: { fr: 'Sorcière', en: 'Witch hat' } },
  { id: 'aureole', name: { fr: 'Auréole', en: 'Halo' } },
  { id: 'viking', name: { fr: 'Casque viking', en: 'Viking helmet' } },
  { id: 'cowboy', name: { fr: 'Chapeau de cowboy', en: 'Cowboy hat' } },
  { id: 'afro', name: { fr: 'Afro', en: 'Afro' } },
  { id: 'licorne', name: { fr: 'Licorne', en: 'Unicorn' } },
  { id: 'ninja', name: { fr: 'Bandeau ninja', en: 'Ninja headband' } },
  { id: 'dj', name: { fr: 'Casque de DJ', en: 'DJ headphones' } },
  { id: 'frites', name: { fr: 'Couronne de frites', en: 'Fry crown' } },
  { id: 'pizzahat', name: { fr: 'Part de pizza', en: 'Pizza slice' } },
  { id: 'astronaute', name: { fr: 'Casque d’astronaute', en: 'Space helmet' } },
  { id: 'neon', name: { fr: 'Halo néon', en: 'Neon halo' } },
  { id: 'flammes', name: { fr: 'Crinière de feu', en: 'Fire mane' } },
  { id: 'samourai', name: { fr: 'Casque samouraï', en: 'Samurai helmet' } },
  { id: 'pharaon', name: { fr: 'Coiffe de pharaon', en: 'Pharaoh headdress' } },
  { id: 'dragon', name: { fr: 'Roi dragon', en: 'Dragon king' } },
  { id: 'cosmique', name: { fr: 'Couronne cosmique', en: 'Cosmic crown' } },
];

export const ACCS: { id: string; name: Name }[] = [
  { id: 'aucun', name: { fr: 'Aucun', en: 'None' } },
  { id: 'lunettes', name: { fr: 'Lunettes', en: 'Glasses' } },
  { id: 'soleil', name: { fr: 'Lunettes de soleil', en: 'Sunglasses' } },
  { id: 'moustache', name: { fr: 'Moustache', en: 'Moustache' } },
  { id: 'monocle', name: { fr: 'Monocle', en: 'Monocle' } },
  { id: 'bisou', name: { fr: 'Bisou', en: 'Kiss' } },
  { id: 'rougir', name: { fr: 'Joues roses', en: 'Blush' } },
  { id: 'barbe', name: { fr: 'Barbe', en: 'Beard' } },
  { id: 'masque', name: { fr: 'Masque', en: 'Mask' } },
  { id: 'clown', name: { fr: 'Nez de clown', en: 'Clown nose' } },
  { id: 'pansement', name: { fr: 'Pansement', en: 'Band-aid' } },
  { id: 'etoiles', name: { fr: 'Lunettes étoiles', en: 'Star glasses' } },
  { id: 'echarpe', name: { fr: 'Écharpe', en: 'Scarf' } },
  { id: 'crocs', name: { fr: 'Crocs de vampire', en: 'Vampire fangs' } },
  { id: 'tuba', name: { fr: 'Masque et tuba', en: 'Snorkel' } },
  { id: 'coeurs', name: { fr: 'Lunettes cœur', en: 'Heart glasses' } },
  { id: 'vr', name: { fr: 'Casque de réalité virtuelle', en: 'VR headset' } },
  { id: 'cape', name: { fr: 'Cape de héros', en: 'Hero cape' } },
  { id: 'cyborg', name: { fr: 'Œil de cyborg', en: 'Cyborg eye' } },
  { id: 'ailes', name: { fr: 'Ailes d’ange', en: 'Angel wings' } },
  { id: 'ailesdragon', name: { fr: 'Ailes de dragon', en: 'Dragon wings' } },
];

export const EYE_LIST: { id: string; name: Name }[] = [
  { id: '', name: { fr: 'Celui du perso', en: 'Default' } },
  { id: 'cool', name: { fr: 'Assuré', en: 'Cool' } },
  { id: 'round', name: { fr: 'Grands yeux', en: 'Big eyes' } },
  { id: 'sleepy', name: { fr: 'Endormi', en: 'Sleepy' } },
  { id: 'angry', name: { fr: 'Énervé', en: 'Angry' } },
  { id: 'wink', name: { fr: 'Clin d’œil', en: 'Wink' } },
  { id: 'star', name: { fr: 'Étoiles', en: 'Stars' } },
];
export const POSE_LIST: { id: string; name: Name }[] = [
  { id: '', name: { fr: 'Celle du perso', en: 'Default' } },
  { id: 'hip', name: { fr: 'Main sur la hanche', en: 'Hand on hip' } },
  { id: 'cross', name: { fr: 'Bras croisés', en: 'Arms crossed' } },
  { id: 'flex', name: { fr: 'Biceps', en: 'Flex' } },
  { id: 'wave', name: { fr: 'Coucou', en: 'Wave' } },
  { id: 'thumbs', name: { fr: 'Pouce levé', en: 'Thumbs up' } },
  { id: 'shy', name: { fr: 'Timide', en: 'Shy' } },
  { id: 'dab', name: { fr: 'Le dab', en: 'Dab' } },
  { id: 'disco', name: { fr: 'Disco', en: 'Disco' } },
  { id: 'peace', name: { fr: 'V de la victoire', en: 'Peace' } },
  { id: 'hero', name: { fr: 'Super-héros', en: 'Superhero' } },
  { id: 'shrug', name: { fr: 'J’sais pas', en: 'Shrug' } },
  { id: 'think', name: { fr: 'Le penseur', en: 'Thinker' } },
  { id: 'salute', name: { fr: 'Salut militaire', en: 'Salute' } },
  { id: 'point', name: { fr: 'Doigt vers le ciel', en: 'Point up' } },
  { id: 'double', name: { fr: 'Salut la foule', en: 'Hello crowd' } },
  { id: 'rock', name: { fr: 'Rock’n’roll', en: 'Rock’n’roll' } },
];

export type Mood = 'happy' | 'sad' | 'wow' | 'win' | 'toot';

export interface DrawOpts {
  food: string;
  color: string;
  hat?: string;
  acc?: string;
  eyes?: string;
  pose?: string;
  selfie?: HTMLImageElement | null;
  /** Temps en secondes, pour l'animation. */
  t: number;
  /** Vitesse de course 0..1 (rebond et balancement). */
  run?: number;
  dir?: 1 | -1;
  mood?: Mood;
  /** Bras levés (podium). */
  arms?: boolean;
  /** Joueur déconnecté ou éliminé : transparent. */
  ghost?: boolean;
  /** Couleur spéciale du corps (sinon celle du joueur qui a cette couleur de baskets). */
  skin?: string;
  /** Pose de victoire. */
  wp?: string;
}

// À la télé, les jeux ne connaissent que la couleur du joueur : elle est unique, elle donne donc aussi son skin.
const roomSkins = new Map<string, string>();
const roomTrails = new Map<string, TrailDef>();
export function setRoomSkins(list: { color: string; skin?: string; trail?: string }[]) {
  roomSkins.clear();
  roomTrails.clear();
  list.forEach((p) => {
    if (p.skin) roomSkins.set(p.color, p.skin);
    const tr = TRAILS.find((x) => x.id === p.trail);
    if (tr) roomTrails.set(p.color, tr);
  });
}

// ——— Traînées : retenues en coordonnées de l'écran, donc les jeux n'ont rien à faire ———
let trailMode: TrailMode | null = null;
/** Réglage de la traînée selon le jeu : rythme (ms), taille, durée (s), écart, vitesse vers l'arrière. */
const MODES: Record<TrailMode, { every: number; size: number; life: number; spread: number; back: number; twin?: boolean }> = {
  kart: { every: 45, size: 0.5, life: 0.75, spread: 0.1, back: 30, twin: true },
  lane: { every: 60, size: 0.42, life: 0.65, spread: 0.18, back: 340 },
  run: { every: 70, size: 0.36, life: 0.55, spread: 0.2, back: 70 },
  top: { every: 95, size: 0.28, life: 0.45, spread: 0.16, back: 30 },
};
export function setTrailMode(m: TrailMode | null) {
  trailMode = LIGHT ? null : m;
  trails.clear();
}
interface Spark { x: number; y: number; vx: number; vy: number; born: number; size: number; icon?: string; color?: string; life: number }
const trails = new Map<string, { x: number; y: number; last: number; parts: Spark[] }>();
const emojiCache = new Map<string, HTMLCanvasElement>();
function emojiBitmap(e: string) {
  let c = emojiCache.get(e);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 72;
    const g = c.getContext('2d')!;
    g.font = '56px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e, 36, 40);
    emojiCache.set(e, c);
  }
  return c;
}
/** Sème et dessine la traînée, juste avant le perso. */
function drawTrail(g: CanvasRenderingContext2D, x: number, y: number, s: number, o: DrawOpts, def: TrailDef) {
  const mode = MODES[trailMode!];
  const m = g.getTransform();
  const sx = m.a * x + m.c * y + m.e;
  const sy = m.b * x + m.d * y + m.f;
  const scale = Math.hypot(m.a, m.b) * s;
  const key = o.color + '|' + Math.round(s);
  const now = performance.now();
  let t = trails.get(key);
  if (!t) trails.set(key, (t = { x: sx, y: sy, last: now, parts: [] }));
  const moved = Math.hypot(sx - t.x, sy - t.y);
  const jump = moved > scale * 2.5;
  const running = !o.ghost && !jump && (moved > 0.8 || (o.run ?? 0) > 0.2);
  if (running && now - t.last > mode.every && t.parts.length < 26) {
    t.last = now;
    const k = Math.hypot(m.a, m.b);
    // Vers l'arrière : le sens du déplacement à l'écran, sinon celui où regarde le perso
    const dx = moved > 0.8 ? (sx - t.x) / moved : o.dir ?? 1;
    const dy = moved > 0.8 ? (sy - t.y) / moved : 0;
    const spawn = (off: number) =>
      t!.parts.push({
        x: sx + (-dy * off) * scale + (Math.random() - 0.5) * scale * mode.spread,
        y: sy - scale * 0.06 + dx * off * scale + (Math.random() - 0.5) * scale * mode.spread * 0.6,
        vx: -dx * mode.back * k + (Math.random() - 0.5) * 40 * k,
        vy: -dy * mode.back * k - 20 * k,
        born: now,
        size: scale * mode.size * (0.7 + Math.random() * 0.5),
        life: mode.life,
        icon: def.icons ? def.icons[Math.floor(Math.random() * def.icons.length)] : undefined,
        color: def.colors ? def.colors[Math.floor(Math.random() * def.colors.length)] : undefined,
      });
    if (mode.twin) {
      spawn(-0.28);
      spawn(0.28);
    } else spawn(0);
  }
  t.x = sx;
  t.y = sy;
  if (!t.parts.length) return;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const keep: Spark[] = [];
  for (const p of t.parts) {
    const a = (now - p.born) / 1000;
    if (a >= p.life) continue;
    keep.push(p);
    const left = 1 - a / p.life;
    const px = p.x + p.vx * a;
    const py = p.y + p.vy * a;
    g.globalAlpha = Math.min(1, left * 1.6);
    if (p.icon) {
      const z = p.size * (0.7 + left * 0.3);
      g.drawImage(emojiBitmap(p.icon), px - z / 2, py - z / 2, z, z);
    } else {
      g.fillStyle = p.color ?? '#fff';
      g.beginPath();
      g.arc(px, py, (p.size / 3) * (0.4 + left * 0.6), 0, Math.PI * 2);
      g.fill();
    }
  }
  t.parts = keep;
  g.restore();
}

/** Repeint le perso une seule fois, sur son image en cache : aucun coût pendant le jeu. */
function paintSkin(c: HTMLCanvasElement, s: SkinDef) {
  const copy = document.createElement('canvas');
  copy.width = c.width;
  copy.height = c.height;
  copy.getContext('2d')!.drawImage(c, 0, 0);
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, c.width * 0.5, c.height);
  s.colors.forEach((col, i) => grad.addColorStop(s.colors.length > 1 ? i / (s.colors.length - 1) : 0, col));
  g.globalCompositeOperation = 'color';
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  if (s.dark) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgba(40,30,110,${s.dark})`;
    g.fillRect(0, 0, c.width, c.height);
  }
  if (s.shine) {
    const band = g.createLinearGradient(0, 0, c.width, c.height);
    band.addColorStop(0.3, 'rgba(255,255,255,0)');
    band.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    band.addColorStop(0.55, 'rgba(255,255,255,0.1)');
    band.addColorStop(0.68, 'rgba(255,255,255,0.5)');
    band.addColorStop(0.78, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'overlay';
    g.fillStyle = band;
    g.fillRect(0, 0, c.width, c.height);
  }
  if (s.stars) {
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#fff';
    // Toujours les mêmes étoiles pour un même perso
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      const r = c.width * (0.004 + rnd() * 0.011);
      g.beginPath();
      g.arc(rnd() * c.width, rnd() * c.height, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  // On ne garde que la forme du perso
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(copy, 0, 0);
  if (s.alpha) {
    g.fillStyle = `rgba(0,0,0,${s.alpha})`;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.globalCompositeOperation = 'source-over';
}

// Repère du module : viewBox -6 -36 132 180, sol à y = 138, centre à x = 60, tête vers y ≈ 24.
const VB = { x: -6, y: -36, w: 132, h: 180 };
const FEET_Y = 138;
const CENTER_X = 60;
const BODY = 112;
const RES = LIGHT ? 1.5 : 2.4;

const sprites = new Map<string, HTMLCanvasElement | null>();
const listeners = new Set<() => void>();

/** Prévient quand un nouveau dessin est prêt (pour redessiner les vignettes immobiles). */
export function onSpriteReady(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function sprite(o: DrawOpts): HTMLCanvasElement | null {
  const hat = o.hat && o.hat !== 'aucun' ? o.hat : '';
  const acc = o.acc && o.acc !== 'aucun' ? o.acc : '';
  const mood = o.mood ?? 'happy';
  const selfie = !!o.selfie;
  const skin = o.skin ?? roomSkins.get(o.color) ?? '';
  const key = `${o.food}|${o.color}|${hat}|${acc}|${mood}|${selfie}|${!!o.arms}|${o.eyes ?? ''}|${o.pose ?? ''}|${skin}|${o.wp ?? ''}`;
  if (sprites.has(key)) return sprites.get(key)!;
  sprites.set(key, null);
  const svg = characterSvg(CHARACTERS[o.food] ? o.food : 'coussin', o.color, {
    // Avec un selfie, le chapeau est posé sur la photo (voir decoSprite)
    hat: selfie ? undefined : hat || undefined,
    acc: acc || undefined,
    mood,
    selfie,
    arms: o.arms,
    eyes: o.eyes,
    pose: o.pose,
    wp: o.wp,
  }).replace('<svg ', `<svg width="${VB.w * RES}" height="${VB.h * RES}" `);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(VB.w * RES);
    c.height = Math.ceil(VB.h * RES);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const def = SKINS.find((x) => x.id === skin);
    if (def) paintSkin(c, def);
    sprites.set(key, c);
    listeners.forEach((f) => f());
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return null;
}

/** Ce qui se pose sur la photo : chapeau, déco, expression. */
function decoSprite(o: DrawOpts): HTMLCanvasElement | null {
  const hat = o.hat && o.hat !== 'aucun' ? o.hat : '';
  const acc = o.acc && o.acc !== 'aucun' ? o.acc : '';
  const mood = o.mood && o.mood !== 'toot' && o.mood !== 'happy' ? o.mood : '';
  if (!hat && !acc && !mood) return null;
  const food = CHARACTERS[o.food] ? o.food : 'coussin';
  const key = `deco|${food}|${o.color}|${hat}|${acc}|${mood}`;
  if (sprites.has(key)) return sprites.get(key)!;
  sprites.set(key, null);
  const svg = selfieDecoSvg(food, o.color, { hat: hat || undefined, acc: acc || undefined, mood }).replace('<svg ', `<svg width="${VB.w * RES}" height="${VB.h * RES}" `);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(VB.w * RES);
    c.height = Math.ceil(VB.h * RES);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    sprites.set(key, c);
    listeners.forEach((f) => f());
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return null;
}

/** Prépare les dessins à l'avance (évite qu'un perso apparaisse avec un temps de retard). */
export function preloadCharacter(o: Omit<DrawOpts, 't'>) {
  sprite({ ...o, t: 0 });
}

export function drawCharacter(g: CanvasRenderingContext2D, x: number, y: number, s: number, o: DrawOpts) {
  if (trailMode) {
    const def = roomTrails.get(o.color);
    if (def) drawTrail(g, x, y, s, o, def);
  }
  // Clignement des yeux de temps en temps (le visage « yeux fermés » de la DA), décalé pour chacun.
  const blink = (!o.mood || o.mood === 'happy') && o.t > 0 && o.t % 4.3 < 0.13;
  const img = sprite(blink ? { ...o, mood: 'toot' } : o);
  const k = s / BODY;
  const run = o.run ?? 0;
  const step = o.t * (8 + run * 14);
  const bob = run > 0.05 ? Math.abs(Math.sin(step)) * 7 * run : Math.sin(o.t * 3) * 1.5;
  // On se penche en avant quand on court, et on respire doucement à l’arrêt
  const sway = (run > 0.05 ? Math.sin(step) * 0.06 * run : 0) + (o.dir ?? 1) * run * 0.11;
  g.save();
  g.translate(x, y);
  if (o.ghost) g.globalAlpha *= 0.35;
  // Ombre au sol
  g.fillStyle = 'rgba(58,33,64,0.16)';
  g.beginPath();
  g.ellipse(0, 0, 38 * k, 8 * k, 0, 0, Math.PI * 2);
  g.fill();
  g.translate(0, -bob);
  g.rotate(sway);
  const squash = run > 0.05 ? 1 + Math.sin(step * 2) * 0.045 * run : 1 + Math.sin(o.t * 2.2) * 0.022;
  g.scale((o.dir ?? 1) / squash, squash);
  if (img) g.drawImage(img, (VB.x - CENTER_X) * k, (VB.y - FEET_Y) * k, VB.w * k, VB.h * k);
  // Selfie : la photo du joueur en rond, à la place du visage.
  if (o.selfie && o.selfie.complete && o.selfie.naturalWidth) {
    const f = faceSlot(CHARACTERS[o.food] ? o.food : 'coussin');
    const cx = (f.cx - CENTER_X) * k;
    // Photo en grand, avec un liseré blanc et un contour
    // La photo couvre tout le corps du perso (on ne voit plus que la photo, les bras, les jambes et le chapeau)
    const r = f.r * k * 2.15;
    const cy = (f.cy - FEET_Y) * k - r * 0.05;
    const fx = (o.dir ?? 1) < 0 ? -cx : cx;
    g.save();
    if ((o.dir ?? 1) < 0) g.scale(-1, 1);
    g.fillStyle = '#3a2140';
    g.beginPath();
    g.arc(fx, cy, r + Math.max(2, r * 0.16), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(fx, cy, r + Math.max(1, r * 0.08), 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(fx, cy, r, 0, Math.PI * 2);
    g.clip();
    // La photo réagit : penchée et plus sombre quand on est triste, étirée de surprise, qui se dandine de joie
    g.translate(fx, cy);
    if (o.mood === 'sad') {
      g.rotate(-0.1);
      g.translate(0, r * 0.08);
    } else if (o.mood === 'wow') g.scale(0.94, 1.12);
    else if (o.mood === 'win') {
      g.rotate(Math.sin(o.t * 7) * 0.09);
      g.scale(1.06, 1.06);
    }
    g.translate(-fx, -cy);
    g.drawImage(o.selfie, fx - r, cy - r, r * 2, r * 2);
    if (o.mood === 'sad') {
      g.fillStyle = 'rgba(60,90,200,0.25)';
      g.fillRect(fx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
    }
    g.restore();
    const deco = decoSprite(o);
    if (deco) g.drawImage(deco, (VB.x - CENTER_X) * k, (VB.y - FEET_Y) * k, VB.w * k, VB.h * k);
  }
  g.restore();
}

/** Charge un selfie (data URL) une seule fois. */
const imgCache = new Map<string, HTMLImageElement>();
export function selfieImage(src?: string): HTMLImageElement | null {
  if (!src) return null;
  let img = imgCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imgCache.set(src, img);
  }
  return img;
}

export function foodName(id: string, lang: Lang) {
  return FOODS.find((f) => f.id === id)?.name[lang] ?? id;
}
