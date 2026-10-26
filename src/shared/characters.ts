// Personnages originaux de Cana'pet : des aliments et objets vivants, dessinés au Canvas 2D.
// Repère : pieds en (0, 0), hauteur ~100 unités, mise à l'échelle par `s`.

import type { Lang } from './protocol';

type Name = Record<Lang, string>;

export const FOODS: { id: string; name: Name }[] = [
  { id: 'coussin', name: { fr: 'Coussin péteur', en: 'Whoopee' } },
  { id: 'tartine', name: { fr: 'Tartine', en: 'Toast' } },
  { id: 'cornichon', name: { fr: 'Cornichon', en: 'Pickle' } },
  { id: 'beignet', name: { fr: 'Beignet', en: 'Donut' } },
  { id: 'oeuf', name: { fr: 'Œuf', en: 'Egg' } },
  { id: 'fromage', name: { fr: 'Fromage', en: 'Cheese' } },
  { id: 'tomate', name: { fr: 'Tomate', en: 'Tomato' } },
  { id: 'brocoli', name: { fr: 'Brocoli', en: 'Broccoli' } },
  { id: 'cupcake', name: { fr: 'Cupcake', en: 'Cupcake' } },
  { id: 'sushi', name: { fr: 'Sushi', en: 'Sushi' } },
  { id: 'frites', name: { fr: 'Frites', en: 'Fries' } },
  { id: 'bonbon', name: { fr: 'Bonbon', en: 'Candy' } },
  { id: 'chaussette', name: { fr: 'Chaussette', en: 'Sock' } },
];

export const COLORS = [
  '#ff4f9a', '#ff3b3b', '#ff9a1f', '#ffd60a', '#7bd13b', '#1fc9a0',
  '#2ec5ff', '#3a6bff', '#9b5cff', '#e08bff', '#a0643a', '#f2f2f2',
];

export const HATS: { id: string; name: Name }[] = [
  { id: 'aucun', name: { fr: 'Aucun', en: 'None' } },
  { id: 'couronne', name: { fr: 'Couronne', en: 'Crown' } },
  { id: 'casquette', name: { fr: 'Casquette', en: 'Cap' } },
  { id: 'haut', name: { fr: 'Haut-de-forme', en: 'Top hat' } },
  { id: 'bob', name: { fr: 'Bob', en: 'Bucket hat' } },
  { id: 'cornes', name: { fr: 'Cornes', en: 'Horns' } },
  { id: 'antenne', name: { fr: 'Antenne', en: 'Antenna' } },
  { id: 'noeud', name: { fr: 'Nœud', en: 'Bow' } },
];

export const ACCS: { id: string; name: Name }[] = [
  { id: 'aucun', name: { fr: 'Aucun', en: 'None' } },
  { id: 'lunettes', name: { fr: 'Lunettes', en: 'Glasses' } },
  { id: 'soleil', name: { fr: 'Lunettes de soleil', en: 'Sunglasses' } },
  { id: 'moustache', name: { fr: 'Moustache', en: 'Moustache' } },
  { id: 'monocle', name: { fr: 'Monocle', en: 'Monocle' } },
  { id: 'bisou', name: { fr: 'Bisou', en: 'Kiss' } },
];

const INK = '#3a2140';

interface Look {
  face: [number, number, number]; // x, y, rayon du visage
  top: number; // y du sommet de la tête (pour le chapeau)
}

const LOOKS: Record<string, Look> = {
  coussin: { face: [0, -52, 22], top: -86 },
  tartine: { face: [0, -50, 22], top: -92 },
  cornichon: { face: [0, -58, 18], top: -96 },
  beignet: { face: [0, -52, 20], top: -92 },
  oeuf: { face: [0, -52, 22], top: -97 },
  fromage: { face: [0, -42, 18], top: -78 },
  tomate: { face: [0, -50, 22], top: -100 },
  brocoli: { face: [0, -66, 18], top: -104 },
  cupcake: { face: [0, -64, 20], top: -112 },
  sushi: { face: [0, -38, 16], top: -76 },
  frites: { face: [0, -38, 18], top: -102 },
  bonbon: { face: [0, -52, 20], top: -82 },
  chaussette: { face: [-3, -64, 17], top: -96 },
};

export interface DrawOpts {
  food: string;
  color: string;
  hat?: string;
  acc?: string;
  selfie?: HTMLImageElement | null;
  /** Temps en secondes, pour l'animation. */
  t: number;
  /** Vitesse de course 0..1 (jambes et rebond). */
  run?: number;
  dir?: 1 | -1;
  mood?: 'happy' | 'sad' | 'wow';
  /** Joueur déconnecté : tout grisé. */
  ghost?: boolean;
}

function path(g: CanvasRenderingContext2D, fill: string, draw: () => void, stroke = true) {
  g.beginPath();
  draw();
  g.fillStyle = fill;
  g.fill();
  if (stroke) g.stroke();
}

function body(g: CanvasRenderingContext2D, food: string, t: number) {
  switch (food) {
    case 'coussin':
      path(g, '#ff7eb3', () => g.ellipse(0, -50, 42, 36, 0, 0, Math.PI * 2));
      path(g, '#ff5c9e', () => g.roundRect(30, -30, 22, 12, 5));
      path(g, '#ffb3d1', () => g.ellipse(-16, -70, 10, 5, -0.4, 0, Math.PI * 2), false);
      break;
    case 'tartine':
      path(g, '#c9853a', () => {
        g.moveTo(-36, -14);
        g.lineTo(-36, -70);
        g.arc(-18, -74, 20, Math.PI, Math.PI * 1.6);
        g.quadraticCurveTo(0, -98, 18 * 0.6, -92);
        g.arc(18, -74, 20, Math.PI * 1.4, 0);
        g.lineTo(36, -14);
        g.closePath();
      });
      path(g, '#f6d48e', () => g.roundRect(-28, -80, 56, 60, 12), false);
      break;
    case 'cornichon':
      path(g, '#6aa84f', () => g.ellipse(0, -54, 26, 44, 0, 0, Math.PI * 2));
      g.fillStyle = '#4e8a37';
      for (const [x, y] of [[-12, -84], [10, -76], [-14, -30], [12, -28], [16, -50]]) {
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'beignet':
      path(g, '#e0a060', () => g.arc(0, -52, 40, 0, Math.PI * 2));
      path(g, '#ff8fc8', () => {
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const r = 33 + Math.sin(i * 2.7) * 3;
          g.lineTo(Math.cos(a) * r, -52 + Math.sin(a) * r);
        }
      }, false);
      for (let i = 0; i < 10; i++) {
        const a = i * 2.4;
        g.save();
        g.translate(Math.cos(a) * 28, -52 + Math.sin(a) * 28);
        g.rotate(a);
        g.fillStyle = ['#fff', '#7bd13b', '#2ec5ff', '#ffd60a'][i % 4];
        g.fillRect(-4, -1.5, 8, 3);
        g.restore();
      }
      break;
    case 'oeuf':
      path(g, '#fff8e7', () => {
        g.moveTo(0, -97);
        g.bezierCurveTo(30, -97, 38, -40, 34, -30);
        g.bezierCurveTo(28, -10, -28, -10, -34, -30);
        g.bezierCurveTo(-38, -40, -30, -97, 0, -97);
      });
      break;
    case 'fromage':
      path(g, '#ffd23f', () => {
        g.moveTo(-42, -14);
        g.lineTo(42, -14);
        g.lineTo(42, -58);
        g.lineTo(-42, -78);
        g.closePath();
      });
      g.fillStyle = '#e6b800';
      for (const [x, y, r] of [[-28, -30, 6], [26, -46, 7], [30, -24, 4], [-30, -62, 4]]) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'tomate':
      path(g, '#ff4b3e', () => g.ellipse(0, -50, 42, 38, 0, 0, Math.PI * 2));
      path(g, '#3fae49', () => {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 ? 6 : 16;
          g.lineTo(Math.cos(a) * r, -88 + Math.sin(a) * r * 0.6);
        }
      });
      path(g, '#3fae49', () => g.roundRect(-3, -102, 6, 14, 3));
      break;
    case 'brocoli':
      path(g, '#9ccc65', () => g.roundRect(-16, -54, 32, 42, 8));
      path(g, '#3f9b3f', () => {
        g.arc(-24, -70, 20, 0, Math.PI * 2);
        g.moveTo(44, -70);
        g.arc(24, -70, 20, 0, Math.PI * 2);
        g.moveTo(22, -86);
        g.arc(0, -86, 22, 0, Math.PI * 2);
        g.moveTo(22, -62);
        g.arc(0, -62, 22, 0, Math.PI * 2);
      });
      g.fillStyle = '#3f9b3f';
      g.beginPath();
      g.arc(0, -70, 24, 0, Math.PI * 2);
      g.fill();
      break;
    case 'cupcake':
      path(g, '#6fc3ff', () => {
        g.moveTo(-28, -14);
        g.lineTo(28, -14);
        g.lineTo(36, -50);
        g.lineTo(-36, -50);
        g.closePath();
      });
      path(g, '#ffb3d9', () => g.ellipse(0, -64, 40, 22, 0, 0, Math.PI * 2));
      path(g, '#ffb3d9', () => g.ellipse(0, -86, 26, 16, 0, 0, Math.PI * 2));
      path(g, '#ff2d55', () => g.arc(0, -104, 8, 0, Math.PI * 2));
      break;
    case 'sushi':
      path(g, '#fbfbf6', () => g.roundRect(-38, -60, 76, 48, 16));
      path(g, '#ff8a5c', () => g.roundRect(-44, -78, 88, 26, 12));
      g.strokeStyle = '#ffd0b8';
      g.lineWidth = 3;
      for (const x of [-22, 0, 22]) {
        g.beginPath();
        g.moveTo(x - 6, -74);
        g.lineTo(x + 6, -56);
        g.stroke();
      }
      g.strokeStyle = INK;
      g.lineWidth = 4;
      break;
    case 'frites': {
      const fries = [[-26, -94], [-14, -102], [-2, -96], [10, -104], [22, -92]];
      for (const [x, y] of fries) path(g, '#ffd54f', () => g.roundRect(x - 5, y, 10, 50, 3));
      path(g, '#e53935', () => {
        g.moveTo(-30, -14);
        g.lineTo(30, -14);
        g.lineTo(38, -62);
        g.lineTo(-38, -62);
        g.closePath();
      });
      break;
    }
    case 'bonbon':
      path(g, '#b388ff', () => {
        g.moveTo(-30, -52);
        g.lineTo(-54, -70);
        g.lineTo(-50, -34);
        g.closePath();
        g.moveTo(30, -52);
        g.lineTo(54, -70);
        g.lineTo(50, -34);
        g.closePath();
      });
      path(g, '#c9a6ff', () => g.arc(0, -52, 32, 0, Math.PI * 2));
      g.save();
      g.beginPath();
      g.arc(0, -52, 30, 0, Math.PI * 2);
      g.clip();
      g.strokeStyle = '#fff';
      g.lineWidth = 6;
      for (let i = -3; i <= 3; i++) {
        g.beginPath();
        g.moveTo(i * 16 - 30, -90);
        g.lineTo(i * 16 + 30, -14);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = INK;
      g.lineWidth = 4;
      break;
    case 'chaussette':
    default:
      path(g, '#fdfdfd', () => {
        g.moveTo(-24, -96);
        g.lineTo(18, -96);
        g.lineTo(18, -48);
        g.lineTo(36, -42);
        g.quadraticCurveTo(52, -34, 46, -20);
        g.quadraticCurveTo(42, -10, 24, -12);
        g.lineTo(-8, -14);
        g.quadraticCurveTo(-26, -16, -24, -36);
        g.closePath();
      });
      g.fillStyle = '#ff3b5c';
      g.fillRect(-22, -92, 38, 6);
      g.fillRect(-22, -82, 38, 6);
      break;
  }
  void t;
}

function face(g: CanvasRenderingContext2D, look: Look, o: DrawOpts) {
  const [fx, fy, fr] = look.face;
  if (o.selfie && o.selfie.complete && o.selfie.naturalWidth) {
    g.save();
    g.beginPath();
    g.arc(fx, fy, fr + 4, 0, Math.PI * 2);
    g.clip();
    g.drawImage(o.selfie, fx - fr - 4, fy - fr - 4, (fr + 4) * 2, (fr + 4) * 2);
    g.restore();
    g.beginPath();
    g.arc(fx, fy, fr + 4, 0, Math.PI * 2);
    g.stroke();
    return;
  }
  const blink = Math.sin(o.t * 1.3 + fx) > 0.985;
  for (const sx of [-1, 1]) {
    const ex = fx + sx * fr * 0.42;
    const ey = fy - fr * 0.18;
    if (blink) {
      g.beginPath();
      g.moveTo(ex - 5, ey);
      g.lineTo(ex + 5, ey);
      g.stroke();
      continue;
    }
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(ex, ey, 6, 7.5, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(ex + (o.dir ?? 1) * 1.5, ey + 1, 3.4, 0, Math.PI * 2);
    g.fill();
  }
  g.lineWidth = 3;
  g.fillStyle = 'rgba(255,90,140,0.35)';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(fx + sx * fr * 0.72, fy + fr * 0.22, 5, 3, 0, 0, Math.PI * 2);
    g.fill();
  }
  const my = fy + fr * 0.32;
  g.beginPath();
  if (o.mood === 'wow') {
    g.fillStyle = INK;
    g.ellipse(fx, my + 2, 4, 5, 0, 0, Math.PI * 2);
    g.fill();
  } else if (o.mood === 'sad') {
    g.arc(fx, my + 7, 7, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  } else {
    g.arc(fx, my - 2, 7, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
  }
  g.lineWidth = 4;
}

function hat(g: CanvasRenderingContext2D, id: string, top: number, color: string) {
  g.save();
  g.translate(0, top);
  switch (id) {
    case 'couronne':
      path(g, '#ffcf33', () => {
        g.moveTo(-20, 2);
        g.lineTo(-22, -20);
        g.lineTo(-11, -10);
        g.lineTo(0, -24);
        g.lineTo(11, -10);
        g.lineTo(22, -20);
        g.lineTo(20, 2);
        g.closePath();
      });
      g.fillStyle = '#ff2d55';
      g.beginPath();
      g.arc(0, -6, 3.5, 0, Math.PI * 2);
      g.fill();
      break;
    case 'casquette':
      path(g, color, () => g.arc(0, 4, 22, Math.PI, 0));
      path(g, color, () => g.roundRect(8, -2, 30, 7, 3));
      break;
    case 'haut':
      path(g, '#2b2b3a', () => g.roundRect(-26, -2, 52, 8, 3));
      path(g, '#2b2b3a', () => g.roundRect(-16, -38, 32, 38, 3));
      g.fillStyle = color;
      g.fillRect(-16, -12, 32, 6);
      break;
    case 'bob':
      path(g, '#e9d8a6', () => g.ellipse(0, 2, 32, 8, 0, 0, Math.PI * 2));
      path(g, '#e9d8a6', () => g.ellipse(0, -6, 20, 14, 0, Math.PI, 0));
      break;
    case 'cornes':
      for (const s of [-1, 1])
        path(g, '#ff3b3b', () => {
          g.moveTo(s * 10, 6);
          g.quadraticCurveTo(s * 22, -4, s * 20, -22);
          g.quadraticCurveTo(s * 14, -6, s * 2, 4);
          g.closePath();
        });
      break;
    case 'antenne':
      g.beginPath();
      g.moveTo(0, 4);
      g.quadraticCurveTo(8, -14, 2, -26);
      g.stroke();
      path(g, color, () => g.arc(2, -30, 7, 0, Math.PI * 2));
      break;
    case 'noeud':
      path(g, '#ff6fb5', () => {
        g.moveTo(0, -2);
        g.lineTo(-22, -14);
        g.lineTo(-22, 10);
        g.closePath();
        g.moveTo(0, -2);
        g.lineTo(22, -14);
        g.lineTo(22, 10);
        g.closePath();
      });
      path(g, '#ff6fb5', () => g.arc(0, -2, 6, 0, Math.PI * 2));
      break;
  }
  g.restore();
}

function accessory(g: CanvasRenderingContext2D, id: string, look: Look) {
  const [fx, fy, fr] = look.face;
  const ey = fy - fr * 0.18;
  const dx = fr * 0.42;
  g.save();
  switch (id) {
    case 'lunettes':
    case 'soleil':
      g.fillStyle = id === 'soleil' ? 'rgba(20,20,30,0.92)' : 'rgba(255,255,255,0.15)';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(fx + s * dx, ey, 9, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      g.beginPath();
      g.moveTo(fx - dx + 9, ey);
      g.lineTo(fx + dx - 9, ey);
      g.stroke();
      break;
    case 'monocle':
      g.lineWidth = 3;
      g.strokeStyle = '#d4a017';
      g.beginPath();
      g.arc(fx + dx, ey, 9, 0, Math.PI * 2);
      g.moveTo(fx + dx + 7, ey + 6);
      g.lineTo(fx + dx + 10, ey + 26);
      g.stroke();
      break;
    case 'moustache':
      g.fillStyle = '#5a3a22';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(fx + s * 8, fy + fr * 0.2, 9, 4.5, s * 0.35, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'bisou':
      g.fillStyle = '#ff2d55';
      g.beginPath();
      g.ellipse(fx - 3, fy + fr * 0.32, 4, 3.5, 0, 0, Math.PI * 2);
      g.ellipse(fx + 3, fy + fr * 0.32, 4, 3.5, 0, 0, Math.PI * 2);
      g.fill();
      break;
  }
  g.restore();
}

export function drawCharacter(g: CanvasRenderingContext2D, x: number, y: number, s: number, o: DrawOpts) {
  const look = LOOKS[o.food] ?? LOOKS.coussin;
  const run = o.run ?? 0;
  const step = o.t * (8 + run * 14);
  const bob = run > 0.05 ? Math.abs(Math.sin(step)) * 6 * run : Math.sin(o.t * 3) * 1.5;
  g.save();
  g.translate(x, y);
  g.scale((s / 100) * (o.dir ?? 1), s / 100);
  if (o.ghost) g.globalAlpha = 0.35;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = INK;
  g.lineWidth = 4;

  // Ombre
  g.fillStyle = 'rgba(58,33,64,0.18)';
  g.beginPath();
  g.ellipse(0, 0, 34, 7, 0, 0, Math.PI * 2);
  g.fill();

  // Baskets dans la couleur du joueur : c'est ce qui le distingue des autres.
  for (const sx of [-1, 1]) {
    const lift = run > 0.05 ? Math.max(0, Math.sin(step + (sx > 0 ? Math.PI : 0))) * 10 * run : 0;
    const fwd = run > 0.05 ? Math.cos(step + (sx > 0 ? Math.PI : 0)) * 8 * run : 0;
    path(g, o.color, () => g.ellipse(sx * 15 + fwd, -6 - lift, 13, 8, 0, 0, Math.PI * 2));
  }

  g.translate(0, -bob);
  const squash = run > 0.05 ? 1 + Math.sin(step * 2) * 0.03 * run : 1 + Math.sin(o.t * 3) * 0.015;
  g.scale(1 / squash, squash);
  body(g, o.food, o.t);
  face(g, look, o);
  if (o.acc && o.acc !== 'aucun') accessory(g, o.acc, look);
  if (o.hat && o.hat !== 'aucun') hat(g, o.hat, look.top, o.color);
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
