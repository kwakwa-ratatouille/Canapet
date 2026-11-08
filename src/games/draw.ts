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

/** Relief « bonbon » sur un bloc arrondi déjà peint : reflet clair en haut, bas un peu plus sombre. */
export function candy(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 16 || h < 12) return;
  const rr = Math.max(2, Math.min(r * 0.7, h * 0.2));
  g.fillStyle = 'rgba(58,33,64,0.13)';
  g.beginPath();
  g.roundRect(x + 4, y + h * 0.66, w - 8, h * 0.3, rr);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.42)';
  g.beginPath();
  g.roundRect(x + Math.min(10, w * 0.12), y + Math.min(6, h * 0.12), w - Math.min(20, w * 0.24), Math.max(5, h * 0.2), rr);
  g.fill();
}

/** Anneau de la couleur du joueur sous ses pieds : on repère son perso d'un coup d'œil. */
export function playerRing(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.save();
  g.fillStyle = color;
  g.globalAlpha = 0.55;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.stroke();
  g.restore();
}

/** Petite étiquette avec le pseudo et une pointe vers le perso. */
export function playerTag(g: CanvasRenderingContext2D, x: number, y: number, name: string, color: string) {
  g.save();
  g.font = '700 28px Fredoka, sans-serif';
  const w = Math.min(220, g.measureText(name).width + 24);
  // Toujours en entier à l'écran, même quand le joueur est au bord
  const k = g.canvas.width / 1920;
  const m = g.getTransform();
  const zoom = m.a / k || 1;
  const onScreen = (m.a * x + m.e) / k;
  x += (Math.max(w / 2 + 6, Math.min(1914 - w / 2, onScreen)) - onScreen) / zoom;
  g.fillStyle = color;
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(x - w / 2, y - 40, w, 36, 18);
  g.moveTo(x - 9, y - 5);
  g.lineTo(x, y + 8);
  g.lineTo(x + 9, y - 5);
  g.fill();
  g.stroke();
  g.fillStyle = luminance(color) > 0.6 ? INK : '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let s = name;
  while (s.length > 1 && g.measureText(s).width > w - 16) s = s.slice(0, -1);
  g.fillText(s, x, y - 21);
  g.restore();
}

/** Raccourcit un texte pour qu'il tienne dans maxW avec la police en cours (jamais de noms qui se chevauchent). */
export function fitText(g: CanvasRenderingContext2D, s: string, maxW: number): string {
  if (g.measureText(s).width <= maxW) return s;
  let t = s;
  while (t.length > 2 && g.measureText(t + '.').width > maxW) t = t.slice(0, -1);
  return t + '.';
}

// ——— Décors partagés (dessinés une fois, puis recopiés) ———

/** Petite étincelle à 4 branches (style Y2K). */
export function spark(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

/** Scène de cabaret : rideau du fond plissé, lambrequin, rideaux rouges retenus, plancher et rampe de lumières. */
export function stageBackdrop(g: CanvasRenderingContext2D, t: number, light: boolean) {
  const bg = cached('stage', 1920, 1080, (c) => {
    // Rideau du fond, plissé
    const wall = c.createLinearGradient(0, 0, 0, 900);
    wall.addColorStop(0, '#4a24b8');
    wall.addColorStop(1, '#241052');
    c.fillStyle = wall;
    c.fillRect(0, 0, 1920, 1080);
    for (let x = 0; x < 1920; x += 96) {
      const f = c.createLinearGradient(x, 0, x + 96, 0);
      f.addColorStop(0, 'rgba(0,0,0,0.22)');
      f.addColorStop(0.45, 'rgba(255,255,255,0.07)');
      f.addColorStop(1, 'rgba(0,0,0,0.22)');
      c.fillStyle = f;
      c.fillRect(x, 0, 96, 900);
    }
    // Halo chaud au centre
    const halo = c.createRadialGradient(960, 620, 40, 960, 620, 760);
    halo.addColorStop(0, 'rgba(255,200,120,0.35)');
    halo.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, 1920, 900);
    // Plancher en bois
    c.fillStyle = '#e9a866';
    c.fillRect(0, 900, 1920, 180);
    const rows = [900, 928, 962, 1004, 1054, 1080];
    for (let r = 0; r < rows.length - 1; r++) {
      c.fillStyle = r % 2 ? 'rgba(122,74,42,0.10)' : 'rgba(255,255,255,0.10)';
      c.fillRect(0, rows[r], 1920, rows[r + 1] - rows[r]);
      c.fillStyle = 'rgba(122,74,42,0.35)';
      c.fillRect(0, rows[r + 1] - 3, 1920, 3);
      const step = 150 + r * 40;
      for (let x = (r * 97) % step; x < 1920; x += step) c.fillRect(x, rows[r], 3, rows[r + 1] - rows[r]);
    }
    c.fillStyle = '#ffd59a';
    c.fillRect(0, 900, 1920, 12);
    c.fillStyle = INK;
    c.fillRect(0, 896, 1920, 6);
    // Rideaux rouges retenus par une cordelière
    [0, 1].forEach((k) => {
      const x = k ? 1920 : 0;
      const d = k ? -1 : 1;
      const cg = c.createLinearGradient(x, 0, x + d * 290, 0);
      for (let i = 0; i <= 6; i++) cg.addColorStop(i / 6, i % 2 ? '#a50e4c' : '#e0246f');
      c.fillStyle = cg;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + d * 290, 0);
      c.quadraticCurveTo(x + d * 250, 380, x + d * 120, 560);
      c.quadraticCurveTo(x + d * 210, 760, x + d * 170, 1080);
      c.lineTo(x, 1080);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 6;
      c.stroke();
      // Cordelière dorée
      c.fillStyle = '#ffc93c';
      c.beginPath();
      c.ellipse(x + d * 128, 562, 46, 16, d * 0.3, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(x + d * 150, 600, 14, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });
    // Lambrequin festonné en haut, avec franges dorées
    c.fillStyle = '#c4125f';
    c.strokeStyle = INK;
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(1920, 0);
    c.lineTo(1920, 70);
    for (let x = 1920; x > 0; x -= 160) c.quadraticCurveTo(x - 80, 150, x - 160, 70);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = '#ffc93c';
    c.lineWidth = 5;
    c.beginPath();
    for (let x = 0; x < 1920; x += 160) {
      c.moveTo(x, 80);
      c.quadraticCurveTo(x + 80, 152, x + 160, 80);
    }
    c.stroke();
  });
  g.drawImage(bg, 0, 0);
  // Rampe de lumières au bord de la scène
  for (let i = 0; i < 16; i++) {
    const x = 60 + i * 120;
    const on = light ? 1 : 0.65 + 0.35 * Math.sin(t * 3 + i * 1.7);
    g.fillStyle = `rgba(255,236,140,${0.35 * on})`;
    g.beginPath();
    g.ellipse(x, 1078, 52, 26, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff3b0';
    g.beginPath();
    g.ellipse(x, 1080, 22, 12, 0, Math.PI, Math.PI * 2);
    g.fill();
  }
}

/** Plateau de jeu télé : mur pastel, rayons, cadre d'ampoules qui clignotent, estrade brillante. */
export function studioBackdrop(g: CanvasRenderingContext2D, t: number, light: boolean, top = '#efe4ff', bottom = '#ffe0f0', floor = '#c9a6ff') {
  const bg = cached('studio' + top + bottom + floor, 1920, 1080, (c) => {
    const wall = c.createLinearGradient(0, 0, 0, 1080);
    wall.addColorStop(0, top);
    wall.addColorStop(1, bottom);
    c.fillStyle = wall;
    c.fillRect(0, 0, 1920, 1080);
    // Rayons qui partent du centre
    c.fillStyle = 'rgba(255,255,255,0.38)';
    for (let i = 0; i < 28; i += 2) {
      const a0 = (i / 28) * Math.PI * 2;
      const a1 = ((i + 1) / 28) * Math.PI * 2;
      c.beginPath();
      c.moveTo(960, 560);
      c.lineTo(960 + Math.cos(a0) * 2200, 560 + Math.sin(a0) * 2200);
      c.lineTo(960 + Math.cos(a1) * 2200, 560 + Math.sin(a1) * 2200);
      c.closePath();
      c.fill();
    }
    // Étincelles dans les coins
    [[150, 170, 26], [1770, 190, 30], [110, 760, 22], [1810, 720, 24], [330, 90, 14], [1600, 100, 16]].forEach(([x, y, r]) => spark(c, x, y, r, 'rgba(255,255,255,0.9)'));
    // Estrade brillante
    c.fillStyle = INK;
    c.fillRect(0, 1000, 1920, 80);
    c.fillStyle = floor;
    c.fillRect(0, 1008, 1920, 72);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillRect(0, 1014, 1920, 8);
    for (let x = 40; x < 1920; x += 140) c.fillRect(x, 1030, 70, 5);
  });
  g.drawImage(bg, 0, 0);
  // Cadre d'ampoules (elles clignotent à tour de rôle)
  const step = Math.floor(t * 3);
  g.strokeStyle = INK;
  g.lineWidth = 3;
  let i = 0;
  const bulb = (x: number, y: number) => {
    const on = light || (i++ + step) % 3 !== 0;
    g.fillStyle = on ? '#ffd60a' : '#fff6cf';
    g.beginPath();
    g.arc(x, y, 9, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  };
  for (let x = 30; x <= 1890; x += 62) bulb(x, 22);
  for (let y = 84; y <= 960; y += 62) {
    bulb(22, y);
    bulb(1898, y);
  }
}

/** Papier peint du salon autour d'une arène (rayures douces + étincelles). */
export function roomBackdrop(g: CanvasRenderingContext2D, bg: string) {
  const img = cached('room' + bg, 1920, 1080, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, 1920, 1080);
    c.fillStyle = 'rgba(58,33,64,0.045)';
    for (let x = -1080; x < 1920; x += 120) {
      c.beginPath();
      c.moveTo(x, 1080);
      c.lineTo(x + 60, 1080);
      c.lineTo(x + 60 + 1080, 0);
      c.lineTo(x + 1080, 0);
      c.closePath();
      c.fill();
    }
    for (let i = 0; i < 26; i++) spark(c, (i * 389 + 70) % 1920, (i * 233 + 50) % 1080, 10 + (i % 3) * 6, 'rgba(255,255,255,0.75)');
  });
  g.drawImage(img, 0, 0);
}

/** Planche à découper en bois (lattes, veines, nœuds). Déborde un peu pour les tremblements d'écran. */
export function woodBoard(g: CanvasRenderingContext2D) {
  const img = cached('wood', 1960, 1120, (c) => {
    c.fillStyle = '#e8b878';
    c.fillRect(0, 0, 1960, 1120);
    for (let i = 0; i < 6; i++) {
      const y = i * 190;
      c.fillStyle = i % 2 ? 'rgba(122,74,42,0.07)' : 'rgba(255,255,255,0.08)';
      c.fillRect(0, y, 1960, 190);
      c.fillStyle = 'rgba(122,74,42,0.25)';
      c.fillRect(0, y + 180, 1960, 10);
      c.strokeStyle = 'rgba(122,74,42,0.14)';
      c.lineWidth = 3;
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        const yy = y + 30 + k * 38;
        c.moveTo(0, yy);
        for (let x = 0; x <= 1960; x += 120) c.quadraticCurveTo(x + 60, yy + ((x / 120 + k + i) % 2 ? 9 : -9), x + 120, yy);
        c.stroke();
      }
      c.fillStyle = 'rgba(122,74,42,0.22)';
      c.beginPath();
      c.ellipse(((i * 613) % 1700) + 120, y + 90, 26, 12, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
  g.drawImage(img, -20, -20);
}

/** Mur de cuisine en carrelage (pour La Bataille des Fusions). */
export function tileWall(g: CanvasRenderingContext2D, bg: string) {
  const img = cached('tiles' + bg, 1920, 1080, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, 1920, 1080);
    for (let y = 0; y < 1080; y += 90)
      for (let x = 0; x < 1920; x += 90) {
        if (((x + y) / 90) % 2) {
          c.fillStyle = 'rgba(255,255,255,0.35)';
          c.fillRect(x, y, 90, 90);
        }
      }
    c.fillStyle = 'rgba(58,33,64,0.08)';
    for (let x = 0; x < 1920; x += 90) c.fillRect(x, 0, 4, 1080);
    for (let y = 0; y < 1080; y += 90) c.fillRect(0, y, 1920, 4);
  });
  g.drawImage(img, 0, 0);
}

/** Mélange une couleur #rrggbb avec une autre (k = 0 → a, 1 → b). */
export function mixHex(a: string, b: string, k: number) {
  const h = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const x = h(a);
  const y = h(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

/** Paysage du fond (collines, sucettes, maisons en pain d'épices), teinté avec les couleurs du ciel. Dessiné une fois. */
export function scenery(g: CanvasRenderingContext2D, top: string, bottom: string) {
  const img = cached('scenery' + top + bottom, 1920, 1080, (c) => {
    const far = mixHex(top, '#3a2140', 0.18);
    const near = mixHex(bottom, '#3a2140', 0.12);
    // Collines du fond
    c.fillStyle = far;
    c.globalAlpha = 0.55;
    c.beginPath();
    c.moveTo(0, 1080);
    c.lineTo(0, 760);
    for (let x = 0; x <= 1920; x += 320) c.quadraticCurveTo(x + 160, 640 + ((x / 320) % 2) * 60, x + 320, 760);
    c.lineTo(1920, 1080);
    c.closePath();
    c.fill();
    // Sucettes et maisons sur les collines du fond
    for (let i = 0; i < 7; i++) {
      const x = 130 + i * 280 + ((i * 53) % 70);
      const y = 740 + ((i * 37) % 40);
      if (i % 3 === 1) {
        // Maison en pain d'épices
        c.fillRect(x - 46, y - 70, 92, 70);
        c.beginPath();
        c.moveTo(x - 62, y - 66);
        c.lineTo(x, y - 122);
        c.lineTo(x + 62, y - 66);
        c.closePath();
        c.fill();
      } else {
        c.fillRect(x - 5, y - 120, 10, 120);
        c.beginPath();
        c.arc(x, y - 140, 40, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Collines devant
    c.globalAlpha = 0.5;
    c.fillStyle = near;
    c.beginPath();
    c.moveTo(0, 1080);
    c.lineTo(0, 860);
    for (let x = 0; x <= 1920; x += 480) c.quadraticCurveTo(x + 240, 760 + ((x / 480) % 2) * 50, x + 480, 860);
    c.lineTo(1920, 1080);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
    // Petites étincelles dans le ciel
    for (let i = 0; i < 10; i++) spark(c, (i * 457 + 90) % 1920, 220 + ((i * 173) % 380), 8 + (i % 3) * 4, 'rgba(255,255,255,0.8)');
  });
  g.drawImage(img, 0, 0);
}

/** Glaçage qui coule sur le haut d'une plateforme (gouttes arrondies, contour prune). */
export function frosting(g: CanvasRenderingContext2D, x: number, y: number, w: number, color: string, r = 12, light = false) {
  const band = 14;
  const base = y + band;
  const n = Math.max(1, Math.floor((w - 2 * r) / 62));
  const step = (w - 2 * r) / n;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + Math.min(r, band));
  g.lineTo(x + w, base);
  // Bord du bas : plat, avec des gouttes en « U » de longueurs différentes (de droite à gauche)
  for (let i = n - 1; i >= 0; i--) {
    const cx = x + r + i * step + step / 2;
    const hw = 11;
    const len = light ? 0 : 4 + ((((x / 7) | 0) + i * 5) % 3) * 5;
    if (len <= 0) continue;
    g.lineTo(cx + hw, base);
    g.lineTo(cx + hw, base + len);
    g.arc(cx, base + len, hw, 0, Math.PI);
    g.lineTo(cx - hw, base);
  }
  g.lineTo(x, base);
  g.lineTo(x, y + Math.min(r, band));
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.stroke();
  // Reflet
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.beginPath();
  g.roundRect(x + r + 4, y + 4, Math.max(10, w * 0.28), 5, 3);
  g.fill();
}

// ——— Emojis rapides ———
// Dessiner un emoji en texte coûte très cher (le navigateur le refait à chaque image et à chaque taille) : c'est ce qui
// faisait ramer les pluies d'emojis. Ici, tout fillText qui ne contient QU'UN emoji est remplacé par une petite image
// dessinée une seule fois (par taille arrondie et par ligne de base), puis recopiée : même rendu, bien plus rapide.
// Les textes normaux, les chiffres et les symboles qui prennent la couleur du texte (★, ✓…) ne sont pas touchés.
const PICTO = /\p{Extended_Pictographic}/gu;
const ONLY_EMOJI = /^(?:\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u{E0020}-\u{E007F}️‍])+$/u;
const PRESENT = /\p{Emoji_Presentation}|️/u;
const REGIONAL = /[\u{1F1E6}-\u{1F1FF}]/gu;
type EmojiSprite = { c: HTMLCanvasElement; base: number; half: number; w: number };
const emojiSprites = new Map<string, EmojiSprite>();
function oneEmoji(s: string) {
  if (s.length > 16 || !ONLY_EMOJI.test(s) || !PRESENT.test(s)) return false;
  const pic = (s.match(PICTO) ?? []).length;
  const zwj = (s.match(/‍/g) ?? []).length;
  const flags = (s.match(REGIONAL) ?? []).length;
  return (pic - zwj === 1 && flags === 0) || (pic === 0 && flags === 2);
}
function installFastEmoji() {
  if (typeof CanvasRenderingContext2D === 'undefined') return;
  const proto = CanvasRenderingContext2D.prototype as CanvasRenderingContext2D & { __fastEmoji?: boolean };
  if (proto.__fastEmoji) return;
  proto.__fastEmoji = true;
  const orig = proto.fillText;
  proto.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
    if (typeof text === 'string' && oneEmoji(text)) {
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font);
      const size = m ? +m[1] : 10;
      if (size >= 14) {
        const base = size <= 72 ? 72 : 144;
        const bl = this.textBaseline;
        const key = text + '|' + base + '|' + bl;
        let sp = emojiSprites.get(key);
        if (!sp) {
          const half = Math.ceil(base * 1.3);
          const c = document.createElement('canvas');
          c.width = half * 2;
          c.height = half * 2;
          const x2 = c.getContext('2d')!;
          x2.font = `${base}px sans-serif`;
          x2.textAlign = 'center';
          x2.textBaseline = bl;
          orig.call(x2, text, half, half);
          const w = x2.measureText(text).width;
          if (emojiSprites.size > 160) emojiSprites.clear();
          sp = { c, base, half, w };
          emojiSprites.set(key, sp);
        }
        const k = size / sp.base;
        const al = this.textAlign;
        const cx = al === 'left' || al === 'start' ? x + (sp.w * k) / 2 : al === 'right' || al === 'end' ? x - (sp.w * k) / 2 : x;
        this.drawImage(sp.c, cx - sp.half * k, y - sp.half * k, sp.half * 2 * k, sp.half * 2 * k);
        return;
      }
    }
    if (maxWidth === undefined) orig.call(this, text, x, y);
    else orig.call(this, text, x, y, maxWidth);
  };
}
installFastEmoji();
