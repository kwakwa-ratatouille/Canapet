import { INK } from '../shared/palette';
// Petits outils de dessin partagés par les jeux.

export function drawSky(g: CanvasRenderingContext2D, t: number, light: boolean, top = '#8fd8ff', bottom = '#ffd6ec', sun = '#fff3a8') {
  const sky = g.createLinearGradient(0, 0, 0, 1080);
  sky.addColorStop(0, top);
  sky.addColorStop(1, bottom);
  g.fillStyle = sky;
  g.fillRect(0, 0, 1920, 1080);
  g.fillStyle = sun;
  g.beginPath();
  g.arc(1700, 120, 70, 0, Math.PI * 2);
  g.fill();
  if (light) return;
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 5; i++) {
    const x = ((i * 470 + t * (14 + i * 4)) % 2300) - 200;
    const y = 60 + (i % 3) * 45;
    g.beginPath();
    g.arc(x, y, 34, 0, Math.PI * 2);
    g.arc(x + 40, y - 14, 42, 0, Math.PI * 2);
    g.arc(x + 86, y, 32, 0, Math.PI * 2);
    g.fill();
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
