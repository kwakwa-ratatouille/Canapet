import { INK } from '../shared/palette';
// Petits outils de dessin partagés par les jeux.

/** Nuage « autocollant » : contour prune, ombre plate, reflet. */
export function stickerCloud(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const blob = (dy: number) => {
    g.beginPath();
    g.arc(x, y + dy, 34 * s, Math.PI * 0.5, Math.PI * 1.5);
    g.arc(x + 40 * s, y - 16 * s + dy, 42 * s, Math.PI, Math.PI * 2);
    g.arc(x + 88 * s, y + dy, 32 * s, Math.PI * 1.5, Math.PI * 0.5);
    g.closePath();
  };
  g.fillStyle = 'rgba(58,33,64,0.18)';
  blob(10 * s);
  g.fill();
  g.fillStyle = '#fff';
  g.strokeStyle = INK;
  g.lineWidth = 4;
  blob(0);
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(227,242,255,0.9)';
  g.beginPath();
  g.ellipse(x + 30 * s, y + 18 * s, 40 * s, 8 * s, 0, 0, Math.PI * 2);
  g.fill();
}

/** Soleil souriant de la DA. */
export function smileSun(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, t: number) {
  g.save();
  g.translate(x, y);
  g.rotate(t * 0.2);
  g.fillStyle = color;
  g.strokeStyle = INK;
  g.lineWidth = 4;
  for (let k = 0; k < 10; k++) {
    g.save();
    g.rotate((k * Math.PI) / 5);
    g.beginPath();
    g.roundRect(-8, -r - 30, 16, 26, 8);
    g.fill();
    g.stroke();
    g.restore();
  }
  g.restore();
  g.fillStyle = color;
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(x - r * 0.3, y - r * 0.1, r * 0.09, 0, Math.PI * 2);
  g.arc(x + r * 0.3, y - r * 0.1, r * 0.09, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 4;
  g.beginPath();
  g.arc(x, y + r * 0.05, r * 0.32, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();
  g.fillStyle = 'rgba(255,90,140,0.4)';
  g.beginPath();
  g.ellipse(x - r * 0.5, y + r * 0.2, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
  g.ellipse(x + r * 0.5, y + r * 0.2, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
  g.fill();
}

// Le ciel est dessiné une fois dans des images en cache (dégradé, soleil, nuages), puis simplement recopié :
// redessiner tous les arcs à chaque image coûtait ~8 ms et faisait ramer certains jeux.
const skyCache = new Map<string, HTMLCanvasElement>();
const sprite = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return c;
};
function cached(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  let c = skyCache.get(key);
  if (!c) {
    c = sprite(w, h, draw);
    skyCache.set(key, c);
  }
  return c;
}

export function drawSky(g: CanvasRenderingContext2D, t: number, light: boolean, top = '#8fd8ff', bottom = '#ffd6ec', sun = '#fff3a8') {
  // Image pleine taille : la recopier est bien plus rapide que refaire le dégradé (ou l'étirer)
  const bg = cached('bg' + top + bottom, 1920, 1080, (c) => {
    const sky = c.createLinearGradient(0, 0, 0, 1080);
    sky.addColorStop(0, top);
    sky.addColorStop(1, bottom);
    c.fillStyle = sky;
    c.fillRect(0, 0, 1920, 1080);
  });
  g.drawImage(bg, 0, 0);
  // Soleil : image en cache qu'on fait tourner
  const sunImg = cached('sun' + sun, 260, 260, (c) => smileSun(c, 130, 130, 62, sun, 0));
  g.save();
  g.translate(1700, 130);
  if (!light) g.rotate(Math.sin(t * 0.8) * 0.12);
  g.drawImage(sunImg, -130, -130);
  g.restore();
  if (light) return;
  for (let i = 0; i < 5; i++) {
    const sc = 0.8 + (i % 2) * 0.25;
    const cl = cached('cloud' + sc, 210, 140, (c) => stickerCloud(c, 42, 72, sc));
    const x = ((i * 470 + t * (14 + i * 4)) % 2300) - 200;
    const y = 70 + (i % 3) * 50;
    g.drawImage(cl, x - 42, y - 72);
  }
}

/** Étiquette arrondie avec le pseudo, dans la couleur du joueur. */
export function roundRectText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  cy: number,
  w: number,
  size: number,
  color: string,
) {
  const font = Math.max(28, size * 0.8);
  const h = Math.max(size * 1.35, font * 1.3);
  g.fillStyle = color;
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(x, cy - h / 2, w, h, h / 2);
  g.fill();
  g.stroke();
  g.fillStyle = luminance(color) > 0.6 ? INK : '#fff';
  g.font = `700 ${font}px Fredoka, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let s = text;
  while (s.length > 1 && g.measureText(s).width > w - 16) s = s.slice(0, -1);
  g.fillText(s === text ? s : s + '…', x + w / 2, cy + 1);
  g.textBaseline = 'alphabetic';
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const gr = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * gr + 0.114 * b) / 255;
}
