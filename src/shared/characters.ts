// Personnages de Cana'pet : dessinés par le module de la DA (canapet-art.js), convertis une seule fois
// en image puis gardés en cache (un dessin par perso, couleur, chapeau, accessoire et humeur).
// Repère d'appel inchangé : pieds en (x, y), hauteur ~ s.

import { characterSvg, faceSlot, PLAYER_COLORS, CHARACTERS } from './art/canapet-art.js';
import { LIGHT } from './device';
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
  { id: 'fete', name: { fr: 'Chapeau de fête', en: 'Party hat' } },
  { id: 'fleur', name: { fr: 'Fleur', en: 'Flower' } },
  { id: 'toque', name: { fr: 'Toque de chef', en: 'Chef hat' } },
  { id: 'pirate', name: { fr: 'Pirate', en: 'Pirate' } },
  { id: 'sorciere', name: { fr: 'Sorcière', en: 'Witch hat' } },
  { id: 'aureole', name: { fr: 'Auréole', en: 'Halo' } },
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
  { id: 'coeurs', name: { fr: 'Lunettes cœur', en: 'Heart glasses' } },
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
  const key = `${o.food}|${o.color}|${hat}|${acc}|${mood}|${selfie}|${!!o.arms}|${o.eyes ?? ''}|${o.pose ?? ''}`;
  if (sprites.has(key)) return sprites.get(key)!;
  sprites.set(key, null);
  const svg = characterSvg(CHARACTERS[o.food] ? o.food : 'coussin', o.color, {
    hat: hat || undefined,
    acc: acc || undefined,
    mood,
    selfie,
    arms: o.arms,
    eyes: o.eyes,
    pose: o.pose,
  }).replace('<svg ', `<svg width="${VB.w * RES}" height="${VB.h * RES}" `);
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
    const cy = (f.cy - FEET_Y) * k;
    const r = f.r * k;
    g.save();
    if ((o.dir ?? 1) < 0) g.scale(-1, 1);
    g.beginPath();
    g.arc((o.dir ?? 1) < 0 ? -cx : cx, cy, r, 0, Math.PI * 2);
    g.clip();
    g.drawImage(o.selfie, ((o.dir ?? 1) < 0 ? -cx : cx) - r, cy - r, r * 2, r * 2);
    g.restore();
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
