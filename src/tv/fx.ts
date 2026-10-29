// Calques de la télé : réactions qui s'envolent et ralenti de fin de partie.
import { REACTIONS } from '../shared/reactions';
import { INK } from '../shared/palette';
import { REPLAY, type FlyingReaction, type Session } from './session';
import { stickerText } from './TvApp';

const W = 1920;
const H = 1080;
/** Durée de vol d'une réaction (secondes). */
const LIFE = 3.2;

export function drawReactions(g: CanvasRenderingContext2D, session: Session, now: number) {
  const fr = session.lang() === 'fr';
  for (const r of session.reactions) {
    const a = (now - r.born) / 1000;
    if (a < 0 || a > LIFE) continue;
    drawOne(g, r, a, fr);
  }
  const c = session.combo;
  if (c && now - c.born < 2800) drawCombo(g, c.i, (now - c.born) / 1000, fr);
}

function drawOne(g: CanvasRenderingContext2D, r: FlyingReaction, a: number, fr: boolean) {
  const re = REACTIONS[r.i];
  // Apparition qui « pop », montée en zigzag, disparition en fondu
  const pop = a < 0.16 ? (a / 0.16) * 1.35 : Math.max(1, 1.35 - (a - 0.16) * 2);
  const x = r.x + Math.sin(a * 3.2 + r.born) * 46;
  const y = H - 90 - a * 290 - Math.min(1, a * 3) * 60;
  g.save();
  g.globalAlpha = Math.min(1, (LIFE - a) / 0.6);
  g.translate(x, y);
  // Le doigt d'honneur tremble de rage
  g.rotate(re.e === '🖕' ? Math.sin(a * 42) * 0.18 : Math.sin(a * 2.4 + r.born) * 0.12);
  g.scale(pop, pop);
  if (re.txt) {
    stickerText(g, re.txt[fr ? 'fr' : 'en'], 0, 0, 62, r.color);
  } else {
    const size = re.rude ? 132 : 104;
    g.font = `${size}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(re.e, 0, -10);
  }
  // Étiquette au nom de l'envoyeur
  g.font = '700 28px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const w = g.measureText(r.name).width + 28;
  g.fillStyle = INK;
  g.beginPath();
  g.roundRect(-w / 2, 52, w, 40, 20);
  g.fill();
  g.fillStyle = r.color;
  g.beginPath();
  g.roundRect(-w / 2 + 4, 52, w - 8, 34, 17);
  g.fill();
  g.fillStyle = '#fff';
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  g.strokeText(r.name, 0, 70);
  g.fillText(r.name, 0, 70);
  g.restore();
}

/** « PLUIE DE 😂 ! » : l'emoji tombe du ciel en masse. */
function drawCombo(g: CanvasRenderingContext2D, i: number, a: number, fr: boolean) {
  const re = REACTIONS[i];
  const k = Math.min(1, a * 5, (2.8 - a) * 3);
  g.save();
  g.globalAlpha = Math.max(0, k);
  g.font = '90px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (!re.txt)
    for (let n = 0; n < 26; n++) {
      const x = ((n * 211) % 1840) + 40;
      const y = -100 + ((a * (520 + (n % 5) * 90) + n * 97) % 1300);
      g.save();
      g.translate(x, y);
      g.rotate(Math.sin(a * 3 + n) * 0.4);
      g.fillText(re.e, 0, 0);
      g.restore();
    }
  g.translate(W / 2, 250);
  g.rotate(-0.04 + Math.sin(a * 10) * 0.02);
  const s = 1 + Math.max(0, 0.3 - a) * 2;
  g.scale(s, s);
  if (re.txt) stickerText(g, (fr ? 'PLUIE DE « ' : 'RAIN OF “') + re.txt[fr ? 'fr' : 'en'] + (fr ? ' » !' : '”!'), 0, 0, 96, '#ffd60a');
  else {
    // L'emoji à part, en très grand (le contour du texte le salirait)
    stickerText(g, fr ? 'PLUIE DE' : 'RAIN OF', 0, 0, 96, '#ffd60a');
    g.font = '170px sans-serif';
    g.fillText(re.e, 0, 150);
  }
  g.restore();
}

// ——— Ralenti ———

/** Images gardées pour le ralenti : 64 images de 768×432, une toutes les 50 ms (les 3,2 dernières secondes). */
const RW = 768;
const RH = 432;
const COUNT = 64;
export class ReplayRecorder {
  private frames: HTMLCanvasElement[] = [];
  private head = 0;
  private filled = 0;
  private last = 0;
  private game: unknown = null;

  /** À appeler après avoir dessiné le jeu : garde une image de temps en temps. */
  capture(src: HTMLCanvasElement, session: Session, now: number) {
    if (session.game !== this.game) {
      this.game = session.game;
      this.filled = 0;
      this.head = 0;
    }
    if (now - this.last < 50) return;
    this.last = now;
    let c = this.frames[this.head];
    if (!c) {
      c = document.createElement('canvas');
      c.width = RW;
      c.height = RH;
      this.frames[this.head] = c;
    }
    c.getContext('2d', { alpha: false })!.drawImage(src, 0, 0, RW, RH);
    this.head = (this.head + 1) % COUNT;
    this.filled = Math.min(COUNT, this.filled + 1);
    session.canReplay = this.filled >= 30;
  }

  /** Dessine le ralenti en plein écran, avec bandes noires, REC et petit zoom. */
  draw(g: CanvasRenderingContext2D, session: Session, t: number) {
    if (!this.filled) return;
    const p = Math.max(0, Math.min(1, 1 - session.replay / REPLAY));
    const idx = Math.min(this.filled - 1, Math.floor(p * this.filled));
    const start = (this.head - this.filled + COUNT) % COUNT;
    const img = this.frames[(start + idx) % COUNT];
    const z = 1 + p * 0.12;
    g.save();
    g.imageSmoothingEnabled = true;
    g.translate(W / 2, H / 2);
    g.scale(z, z);
    g.drawImage(img, -W / 2, -H / 2, W, H);
    g.restore();
    // Voile bleuté façon souvenir + bandes de cinéma
    g.fillStyle = 'rgba(46,125,255,0.12)';
    g.fillRect(0, 0, W, H);
    g.fillStyle = INK;
    g.fillRect(0, 0, W, 96);
    g.fillRect(0, H - 96, W, 96);
    // Flash blanc au début, fondu à la fin
    if (p < 0.08) {
      g.fillStyle = `rgba(255,255,255,${1 - p / 0.08})`;
      g.fillRect(0, 0, W, H);
    }
    g.fillStyle = '#ff2a2a';
    if (Math.floor(t * 2) % 2) {
      g.beginPath();
      g.arc(80, 48, 18, 0, Math.PI * 2);
      g.fill();
    }
    g.font = '700 40px Fredoka, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText('REC', 112, 50);
    const fr = session.lang() === 'fr';
    stickerText(g, fr ? '🎬 RALENTI' : '🎬 SLOW-MO', W / 2, 66, 64, '#ffd60a');
    g.font = '600 32px Nunito, sans-serif';
    g.textAlign = 'right';
    g.fillStyle = '#fff';
    g.fillText(fr ? '× 0,6' : '× 0.6', W - 60, H - 48);
    if (p > 0.9) {
      g.fillStyle = `rgba(58,33,64,${(p - 0.9) * 10})`;
      g.fillRect(0, 0, W, H);
    }
  }
}
