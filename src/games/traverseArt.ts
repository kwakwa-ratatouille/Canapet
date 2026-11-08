// Dessins de « Traverse Pas Ici ! » : tout est dessiné une seule fois dans de petites images, puis recopié à chaque image.
import { INK } from '../shared/palette';
import { cachedSprite, mixHex } from './draw';

export const CELL = 112;
const W = 1920;

/** Petit générateur au hasard qui donne toujours la même suite (même décor d'une image à l'autre). */
function seeded(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function shine(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.roundRect(x, y, w, h, h / 2);
  g.fill();
}

// ——— Sols ———

export function grassRow(v: number) {
  return cachedSprite('tv-grass' + v, W, CELL + 1, (g) => {
    g.fillStyle = v % 2 ? '#a8dd7a' : '#9bd46c';
    g.fillRect(0, 0, W, CELL + 1);
    const r = seeded(v + 3);
    // Touffes d'herbe
    g.strokeStyle = mixHex(v % 2 ? '#a8dd7a' : '#9bd46c', '#2e7d32', 0.45);
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = r() * W;
      const y = 20 + r() * (CELL - 30);
      g.beginPath();
      g.moveTo(x - 8, y - 10);
      g.lineTo(x - 2, y);
      g.lineTo(x + 2, y - 14);
      g.lineTo(x + 5, y);
      g.lineTo(x + 11, y - 9);
      g.stroke();
    }
    // Petites fleurs
    const petals = ['#ffffff', '#ff86bd', '#ffd60a', '#b79cff'];
    for (let i = 0; i < 10; i++) {
      const x = r() * W;
      const y = 18 + r() * (CELL - 36);
      g.fillStyle = petals[i % petals.length];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.beginPath();
        g.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ff9a1f';
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

export function roadRow(v: number) {
  return cachedSprite('tv-road' + v, W, CELL + 1, (g) => {
    g.fillStyle = '#5b5166';
    g.fillRect(0, 0, W, CELL + 1);
    const r = seeded(v + 11);
    // Grain du bitume
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 160; i++) g.fillRect(r() * W, r() * CELL, 4, 4);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 120; i++) g.fillRect(r() * W, r() * CELL, 5, 3);
    // Ombre en haut, pointillés en bas
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, 0, W, 8);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let x = (v * 37) % 140; x < W; x += 140) {
      g.beginPath();
      g.roundRect(x, CELL - 7, 70, 6, 3);
      g.fill();
    }
  });
}

/** Trottoir entre l'herbe et la route (posé en haut et en bas d'un groupe de routes). */
export function curb(g: CanvasRenderingContext2D, y: number) {
  g.fillStyle = '#e9e1f0';
  g.fillRect(0, y - 7, W, 14);
  g.fillStyle = 'rgba(58,33,64,0.25)';
  for (let x = 0; x < W; x += 60) g.fillRect(x, y - 7, 4, 14);
  g.fillStyle = INK;
  g.fillRect(0, y + 5, W, 3);
}

export function railRow(v: number) {
  return cachedSprite('tv-rail' + v, W, CELL + 1, (g) => {
    g.fillStyle = '#c9b8a8';
    g.fillRect(0, 0, W, CELL + 1);
    const r = seeded(v + 23);
    // Gravier
    for (let i = 0; i < 260; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(90,70,60,0.25)' : 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.arc(r() * W, r() * CELL, 2 + r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // Traverses en bois
    for (let x = 6; x < W; x += 54) {
      g.fillStyle = '#8a6a4a';
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(x, 14, 22, CELL - 28, 5);
      g.fill();
      g.stroke();
    }
    // Rails brillants
    [30, CELL - 40].forEach((y) => {
      g.fillStyle = INK;
      g.fillRect(0, y - 2, W, 14);
      g.fillStyle = '#9aa0ad';
      g.fillRect(0, y, W, 9);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillRect(0, y + 1, W, 3);
    });
  });
}

// ——— Arbres ———

export function tree(kind: number) {
  return cachedSprite('tv-tree' + kind, 130, 130, (g) => {
    const x = 65;
    g.fillStyle = 'rgba(58,33,64,0.2)';
    g.beginPath();
    g.ellipse(x, 112, 46, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.lineJoin = 'round';
    if (kind === 1) {
      // Sapin
      g.fillStyle = '#a0643a';
      g.fillRect(x - 10, 90, 20, 22);
      g.strokeRect(x - 10, 90, 20, 22);
      [[96, 50], [70, 40], [46, 30]].forEach(([base, half]) => {
        const grd = g.createLinearGradient(x - half, 0, x + half, 0);
        grd.addColorStop(0, '#5cc46a');
        grd.addColorStop(1, '#2f8a43');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(x - half, base);
        g.quadraticCurveTo(x, base + 8, x + half, base);
        g.lineTo(x, base - 44);
        g.closePath();
        g.fill();
        g.stroke();
      });
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.arc(x - 10, 26, 5, 0, Math.PI * 2);
      g.fill();
      return;
    }
    const pink = kind === 2;
    // Tronc
    g.fillStyle = pink ? '#d99a6c' : '#a0643a';
    g.beginPath();
    g.roundRect(x - 11, 70, 22, 42, 6);
    g.fill();
    g.stroke();
    // Feuillage (barbe à papa rose, ou arbre rond)
    const blobs: [number, number, number][] = [
      [x - 26, 60, 28],
      [x + 26, 60, 28],
      [x, 38, 36],
      [x - 14, 30, 22],
    ];
    g.fillStyle = pink ? '#ff9ccf' : '#3fa34a';
    g.beginPath();
    blobs.forEach(([bx, by, br]) => {
      g.moveTo(bx + br, by);
      g.arc(bx, by, br, 0, Math.PI * 2);
    });
    g.fill();
    g.stroke();
    // Relief : dessous plus sombre, reflets
    g.save();
    g.beginPath();
    blobs.forEach(([bx, by, br]) => {
      g.moveTo(bx + br, by);
      g.arc(bx, by, br, 0, Math.PI * 2);
    });
    g.clip();
    g.fillStyle = pink ? 'rgba(196,18,95,0.18)' : 'rgba(20,80,30,0.25)';
    g.fillRect(0, 66, 130, 40);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(x - 12, 22, 12, 7, -0.4, 0, Math.PI * 2);
    g.fill();
    if (!pink) {
      // Quelques pommes
      g.fillStyle = '#ff4f6e';
      [[x + 20, 48], [x - 30, 62], [x + 6, 66]].forEach(([ax, ay]) => {
        g.beginPath();
        g.arc(ax, ay, 6, 0, Math.PI * 2);
        g.fill();
      });
    }
  });
}

// ——— Véhicules ———

function wheel(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = INK;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d9d2e3';
  g.beginPath();
  g.arc(x, y, r * 0.45, 0, Math.PI * 2);
  g.fill();
}

/** Voiture (ou bus si elle est longue), vue de côté, tournée vers la droite si dir > 0. */
export function car(color: string, w: number, dir: number) {
  const pad = 14;
  const SW = Math.ceil(w + pad * 2);
  return cachedSprite('tv-car' + color + (w | 0) + dir, SW, CELL, (g) => {
    if (dir < 0) {
      g.translate(SW, 0);
      g.scale(-1, 1);
    }
    const x = pad;
    const dark = mixHex(color, '#3a2140', 0.25);
    g.fillStyle = 'rgba(30,20,40,0.28)';
    g.beginPath();
    g.ellipse(x + w / 2, CELL - 12, w / 2 + 6, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.lineJoin = 'round';
    const body = (y0: number, y1: number, r: number) => {
      const grd = g.createLinearGradient(0, y0, 0, y1);
      grd.addColorStop(0, mixHex(color, '#ffffff', 0.25));
      grd.addColorStop(1, dark);
      g.fillStyle = grd;
      g.beginPath();
      g.roundRect(x, y0, w, y1 - y0, r);
      g.fill();
      g.stroke();
    };
    if (w > 200) {
      // Bus bonbon
      body(14, CELL - 22, 22);
      g.fillStyle = '#ffffff';
      g.fillRect(x + 6, 64, w - 12, 8);
      const n = Math.floor((w - 70) / 52);
      for (let i = 0; i < n; i++) {
        g.fillStyle = '#d6f4ff';
        g.beginPath();
        g.roundRect(x + 16 + i * 52, 26, 40, 30, 8);
        g.fill();
        g.stroke();
        shine(g, x + 22 + i * 52, 30, 14, 5);
      }
      // Pare-brise à l'avant
      g.fillStyle = '#d6f4ff';
      g.beginPath();
      g.roundRect(x + w - 44, 24, 34, 40, [8, 16, 8, 8]);
      g.fill();
      g.stroke();
      wheel(g, x + 46, CELL - 22, 15);
      wheel(g, x + w - 52, CELL - 22, 15);
    } else {
      // Voiture : caisse + cabine arrondie
      g.fillStyle = mixHex(color, '#ffffff', 0.15);
      g.beginPath();
      g.moveTo(x + w * 0.2, 54);
      g.quadraticCurveTo(x + w * 0.24, 16, x + w * 0.46, 16);
      g.lineTo(x + w * 0.62, 16);
      g.quadraticCurveTo(x + w * 0.78, 18, x + w * 0.84, 54);
      g.closePath();
      g.fill();
      g.stroke();
      // Vitres
      g.fillStyle = '#d6f4ff';
      g.beginPath();
      g.moveTo(x + w * 0.29, 50);
      g.quadraticCurveTo(x + w * 0.31, 26, x + w * 0.47, 26);
      g.lineTo(x + w * 0.5, 26);
      g.lineTo(x + w * 0.5, 50);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(x + w * 0.56, 50);
      g.lineTo(x + w * 0.56, 26);
      g.lineTo(x + w * 0.62, 26);
      g.quadraticCurveTo(x + w * 0.72, 28, x + w * 0.76, 50);
      g.closePath();
      g.fill();
      g.stroke();
      shine(g, x + w * 0.34, 31, 14, 5);
      body(48, CELL - 22, 18);
      // Poignée de porte
      g.fillStyle = INK;
      g.fillRect(x + w * 0.5, 60, 14, 4);
      wheel(g, x + w * 0.24, CELL - 22, 16);
      wheel(g, x + w * 0.76, CELL - 22, 16);
    }
    // Phare devant, feu derrière
    g.fillStyle = '#fff3a8';
    g.beginPath();
    g.arc(x + w - 8, w > 200 ? 74 : 64, 7, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#ff3b3b';
    g.beginPath();
    g.roundRect(x + 1, w > 200 ? 68 : 58, 7, 14, 3);
    g.fill();
    // Reflet sur la caisse
    shine(g, x + 16, w > 200 ? 18 : 52, Math.min(70, w * 0.3), 6);
  });
}

/** Baguette de pain qui flotte sur le sirop. */
export function bread(w: number) {
  const ww = Math.round(w / 10) * 10;
  return cachedSprite('tv-bread' + ww, ww + 10, CELL, (g) => {
    const x = 5;
    g.fillStyle = 'rgba(160,30,90,0.25)';
    g.beginPath();
    g.ellipse(x + ww / 2, CELL - 14, ww / 2, 10, 0, 0, Math.PI * 2);
    g.fill();
    const grd = g.createLinearGradient(0, 14, 0, CELL - 14);
    grd.addColorStop(0, '#f6cf86');
    grd.addColorStop(0.6, '#d9a35a');
    grd.addColorStop(1, '#b97a35');
    g.fillStyle = grd;
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.roundRect(x, 16, ww, CELL - 32, 38);
    g.fill();
    g.stroke();
    // Entailles dorées
    g.lineCap = 'round';
    for (let k = x + 40; k < x + ww - 36; k += 58) {
      g.strokeStyle = '#a86a2a';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(k, 34);
      g.quadraticCurveTo(k + 18, 52, k + 26, CELL - 36);
      g.stroke();
      g.strokeStyle = '#ffe7b0';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(k + 3, 36);
      g.quadraticCurveTo(k + 19, 52, k + 26, CELL - 40);
      g.stroke();
    }
    // Farine
    const r = seeded(ww);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < ww / 14; i++) {
      g.beginPath();
      g.arc(x + 20 + r() * (ww - 40), 24 + r() * 16, 2, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** Le train : locomotive à l'avant et wagons bonbon. Largeur 2200, tourné vers la droite si dir > 0. */
export function train(dir: number) {
  const TW = 2200;
  return cachedSprite('tv-train' + dir, TW + 20, CELL, (g) => {
    if (dir < 0) {
      g.translate(TW + 20, 0);
      g.scale(-1, 1);
    }
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.lineJoin = 'round';
    const cols = ['#ff86bd', '#ffd60a', '#2ec5ff'];
    // Wagons (de l'arrière vers la locomotive)
    for (let i = 0; i < 3; i++) {
      const x = 10 + i * 520;
      const c = cols[i];
      const grd = g.createLinearGradient(0, 12, 0, CELL - 18);
      grd.addColorStop(0, mixHex(c, '#ffffff', 0.25));
      grd.addColorStop(1, mixHex(c, '#3a2140', 0.25));
      g.fillStyle = grd;
      g.beginPath();
      g.roundRect(x, 12, 490, CELL - 30, 18);
      g.fill();
      g.stroke();
      for (let k = 0; k < 6; k++) {
        g.fillStyle = '#fff3c9';
        g.beginPath();
        g.roundRect(x + 24 + k * 78, 26, 54, 30, 8);
        g.fill();
        g.lineWidth = 4;
        g.stroke();
        g.lineWidth = 6;
      }
      shine(g, x + 20, 16, 160, 6);
      // Attache
      g.fillStyle = INK;
      g.fillRect(x + 490, CELL - 44, 30, 10);
      [x + 70, x + 150, x + 340, x + 420].forEach((wx) => wheel(g, wx, CELL - 18, 14));
    }
    // Locomotive
    const lx = 10 + 3 * 520;
    const grd = g.createLinearGradient(0, 8, 0, CELL - 18);
    grd.addColorStop(0, '#ff6b6b');
    grd.addColorStop(1, '#b8233a');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(lx, 8);
    g.lineTo(lx + 380, 8);
    g.quadraticCurveTo(lx + 600, 14, lx + 610, CELL - 18);
    g.lineTo(lx, CELL - 18);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#d6f4ff';
    g.beginPath();
    g.roundRect(lx + 300, 22, 110, 34, 10);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff3a8';
    g.beginPath();
    g.arc(lx + 580, 64, 11, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(lx + 10, 64, 500, 8);
    shine(g, lx + 30, 14, 220, 7);
    [lx + 90, lx + 220, lx + 400, lx + 520].forEach((wx) => wheel(g, wx, CELL - 18, 16));
  });
}
