// Tranche de Rire : les aliments du jeu sont lancés en l'air, chaque joueur les tranche avec son doigt.
// Le téléphone envoie la position du doigt : elle est reportée sur tout l'écran. Pièges : coussin péteur et bombe.
// En mode équipes, les points de chacun s'additionnent pour son camp.
import { drawCharacter } from '../shared/characters';
import { INK, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { TEAMS } from './teams';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

export interface SlicePadData {
  color: string;
  score: number;
  /** Secondes pendant lesquelles la lame est sonnée. */
  stun: boolean;
}

const GRAV = 1150;
const FRUITS: { food: string; juice: string }[] = [
  { food: 'pasteque', juice: '#ff4a5a' },
  { food: 'ananas', juice: '#ffc933' },
  { food: 'banane', juice: '#ffe066' },
  { food: 'tomate', juice: '#ff4a3a' },
  { food: 'cookie', juice: '#a0643a' },
  { food: 'pizza', juice: '#ffcf6b' },
  { food: 'cornichon', juice: '#7bb33b' },
  { food: 'fromage', juice: '#ffd23a' },
  { food: 'beignet', juice: '#ff9ccf' },
  { food: 'tartine', juice: '#d9883e' },
  { food: 'sushi', juice: '#ff8a5a' },
  { food: 'burger', juice: '#7a4a2a' },
  { food: 'avocat', juice: '#7bbf4a' },
  { food: 'glace', juice: '#ffc6e3' },
];
type Kind = 'fruit' | 'gold' | 'coussin' | 'bombe';
interface Item {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  kind: Kind;
  food: string;
  juice: string;
  r: number;
}
interface Half {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  food: string;
  side: 1 | -1;
  life: number;
}
interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: string;
  life: number;
}
interface Pop {
  x: number;
  y: number;
  text: string;
  c: string;
  life: number;
}
interface Pl extends Runner {
  score: number;
  x: number;
  y: number;
  down: boolean;
  trail: { x: number; y: number; at: number }[];
  stun: number;
  /** Tranchés dans le même geste, pour le combo. */
  combo: number;
  comboAt: number;
  botAim: Item | null;
  botPause: number;
}

/** Distance entre un point et un segment. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  const k = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - dx * k, py - ay - dy * k);
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls: Pl[] = runners.map((r, i) => ({ ...r, score: 0, x: 200 + i * 120, y: 500, down: false, trail: [], stun: 0, combo: 0, comboAt: 0, botAim: null, botPause: 0 }));
  const teams = pls.some((p) => p.team !== undefined);
  const items: Item[] = [];
  const halves: Half[] = [];
  const drops: Drop[] = [];
  const pops: Pop[] = [];
  let clock = 0;
  let nextWave = 0.6;
  let shake = 0;
  let last = '';
  const n = pls.length;

  const spawn = (kind: Kind) => {
    const f = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    const x = rnd(220, 1700);
    items.push({
      x,
      y: 1160,
      vx: (960 - x) * rnd(0.12, 0.42),
      vy: -rnd(1240, 1500),
      rot: rnd(-1, 1),
      spin: rnd(-3, 3),
      kind,
      food: kind === 'coussin' ? 'coussin' : f.food,
      juice: f.juice,
      r: kind === 'bombe' ? 62 : 72,
    });
  };

  const wave = () => {
    // Plus de monde = plus de choses à trancher, et ça s'accélère
    const pace = Math.min(1, clock / 50);
    const count = Math.round(rnd(1, 2 + pace * 2) + n / 4);
    for (let i = 0; i < count; i++) spawn(Math.random() < 0.03 + pace * 0.03 ? 'gold' : 'fruit');
    if (clock > 4 && Math.random() < 0.3 + pace * 0.25) spawn(Math.random() < 0.5 ? 'bombe' : 'coussin');
    nextWave = clock + rnd(1.5, 2.2) - pace * 0.8;
  };

  const add = (p: Pl, x: number, y: number, pts: number, c: string, text?: string) => {
    p.score = Math.max(0, p.score + pts);
    pops.push({ x, y, text: text ?? (pts > 0 ? `+${pts}` : String(pts)), c, life: 0.9 });
  };

  const cut = (p: Pl, it: Item) => {
    items.splice(items.indexOf(it), 1);
    if (it.kind === 'bombe' || it.kind === 'coussin') {
      add(p, it.x, it.y, -5, ROSE, it.kind === 'bombe' ? (fr ? 'BOUM ! -5' : 'BOOM! -5') : ctx.family ? 'POUF ! -5' : 'PROUT ! -5');
      p.stun = 1.1;
      p.trail = [];
      p.down = false;
      shake = 0.35;
      if (it.kind === 'bombe') sfx.boom();
      else sfx.pet();
      if (!p.bot) ctx.buzz(p.pid, 300);
      for (let i = 0; i < 14; i++) drops.push({ x: it.x, y: it.y, vx: rnd(-520, 520), vy: rnd(-520, 200), c: it.kind === 'bombe' ? '#3a2140' : '#ff86bd', life: 0.7 });
      ctx.refresh();
      return;
    }
    // Combo : plusieurs d'un coup, dans le même geste
    p.combo = clock - p.comboAt < 0.5 ? p.combo + 1 : 1;
    p.comboAt = clock;
    const base = it.kind === 'gold' ? 5 : 1;
    const bonus = p.combo >= 3 ? 2 : 0;
    add(p, it.x, it.y, base + bonus, it.kind === 'gold' ? SOLEIL : p.profile.color, p.combo >= 3 ? `COMBO ×${p.combo} !` : undefined);
    sfx.pop();
    if (!p.bot) ctx.buzz(p.pid, 25);
    for (const side of [1, -1] as const) halves.push({ x: it.x, y: it.y, vx: it.vx + side * rnd(120, 240), vy: it.vy * 0.5 - 120, rot: it.rot, spin: side * rnd(2, 5), food: it.food, side, life: 1.1 });
    for (let i = 0; i < 9; i++) drops.push({ x: it.x, y: it.y, vx: rnd(-420, 420), vy: rnd(-460, 160), c: it.juice, life: rnd(0.35, 0.7) });
  };

  const swipe = (p: Pl, x: number, y: number) => {
    const ax = p.x;
    const ay = p.y;
    p.x = x;
    p.y = y;
    if (!p.down || p.stun > 0) return;
    p.trail.push({ x, y, at: clock });
    if (Math.hypot(x - ax, y - ay) < 6) return;
    for (const it of [...items]) if (segDist(it.x, it.y, ax, ay, x, y) < it.r) cut(p, it);
  };

  const bot = (p: Pl, dt: number) => {
    if (p.stun > 0) return;
    p.botPause -= dt;
    if (p.botPause > 0) return;
    if (!p.botAim || !items.includes(p.botAim)) {
      const safe = items.filter((i) => (i.kind === 'fruit' || i.kind === 'gold') && i.y < 1000);
      p.botAim = safe[Math.floor(Math.random() * safe.length)] ?? null;
      p.down = false;
      if (!p.botAim) return;
    }
    const a = p.botAim;
    const speed = (900 + ctx.botSkill * 1300) * dt;
    const d = Math.hypot(a.x - p.x, a.y - p.y) || 1;
    p.down = d < 240;
    swipe(p, p.x + ((a.x - p.x) / d) * Math.min(d, speed), p.y + ((a.y - p.y) / d) * Math.min(d, speed));
    // Un petit temps d'hésitation après une découpe, moins long pour les forts
    if (!items.includes(a)) {
      p.botAim = null;
      p.botPause = rnd(0.15, 0.7) * (1.4 - ctx.botSkill);
    }
  };

  const teamScore = (s: number) => pls.filter((p) => p.team === s).reduce((m, p) => m + p.score, 0);

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'cut') return;
      const p = pls.find((x) => x.pid === pid);
      if (!p) return;
      const [nx, ny, st] = m.n ?? [];
      if (typeof nx !== 'number' || typeof ny !== 'number') return;
      const x = (Math.max(0, Math.min(1000, nx)) / 1000) * 1920;
      const y = (Math.max(0, Math.min(1000, ny)) / 1000) * 1080;
      if (st === 1) {
        // Le doigt se pose : pas de trait depuis l'ancienne position
        p.x = x;
        p.y = y;
        p.down = true;
        p.trail = [{ x, y, at: clock }];
        p.combo = 0;
      } else if (st === 0) {
        swipe(p, x, y);
        p.down = false;
      } else {
        if (!p.down && p.stun <= 0) {
          p.x = x;
          p.y = y;
          p.down = true;
        }
        swipe(p, x, y);
      }
    },
    update(dt) {
      clock += dt;
      shake = Math.max(0, shake - dt);
      if (clock >= nextWave) wave();
      for (const it of items) {
        it.vy += GRAV * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.rot += it.spin * dt;
      }
      for (let i = items.length - 1; i >= 0; i--) if (items[i].y > 1240 && items[i].vy > 0) items.splice(i, 1);
      for (const h of halves) {
        h.vy += GRAV * dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.rot += h.spin * dt;
        h.life -= dt;
      }
      for (let i = halves.length - 1; i >= 0; i--) if (halves[i].life <= 0) halves.splice(i, 1);
      for (const d of drops) {
        d.vy += GRAV * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.life -= dt;
      }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].life <= 0) drops.splice(i, 1);
      if (drops.length > 90) drops.splice(0, drops.length - 90);
      for (const o of pops) {
        o.y -= 60 * dt;
        o.life -= dt;
      }
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
      for (const p of pls) {
        if (p.bot) bot(p, dt);
        p.stun = Math.max(0, p.stun - dt);
        while (p.trail.length && clock - p.trail[0].at > 0.22) p.trail.shift();
        if (p.trail.length > 24) p.trail.splice(0, p.trail.length - 24);
      }
      const sum = pls.map((p) => p.score).join();
      if (sum !== last && Math.floor(clock * 2) !== Math.floor((clock - dt) * 2)) {
        last = sum;
        ctx.refresh();
      }
    },
    render(g, t) {
      g.save();
      if (shake > 0) g.translate(rnd(-12, 12) * (shake / 0.35), rnd(-12, 12) * (shake / 0.35));
      // Un plan de travail en bois
      g.fillStyle = '#e8b878';
      g.fillRect(-20, -20, 1960, 1120);
      g.fillStyle = 'rgba(122,74,42,.16)';
      for (let i = 0; i < 6; i++) g.fillRect(-20, 120 + i * 190, 1960, 10);
      if (clock < 3.5) {
        g.fillStyle = INK;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '700 58px Fredoka, sans-serif';
        g.fillText(fr ? '📱 Glisse ton doigt sur le téléphone pour trancher !' : '📱 Swipe on your phone to slice!', 960, 300, 1760);
        g.font = '700 44px Fredoka, sans-serif';
        g.fillText(fr ? 'Évite le coussin rose et la bombe 💣' : 'Avoid the pink cushion and the bomb 💣', 960, 380);
      }
      for (const h of halves) {
        g.save();
        g.translate(h.x, h.y);
        g.rotate(h.rot);
        g.globalAlpha = Math.min(1, h.life * 2);
        g.beginPath();
        g.rect(h.side > 0 ? 0 : -120, -140, 120, 280);
        g.clip();
        drawCharacter(g, 0, 62, 112, { food: h.food, color: '#3a2140', t: 0, mood: 'sad' });
        g.restore();
      }
      for (const it of items) {
        g.save();
        g.translate(it.x, it.y);
        g.rotate(it.rot);
        if (it.kind === 'bombe') {
          g.fillStyle = '#2b2730';
          g.strokeStyle = INK;
          g.lineWidth = 6;
          g.beginPath();
          g.arc(0, 0, 54, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,.3)';
          g.beginPath();
          g.arc(-18, -20, 13, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#a0643a';
          g.lineWidth = 9;
          g.beginPath();
          g.moveTo(16, -48);
          g.quadraticCurveTo(38, -80, 60, -66);
          g.stroke();
          g.fillStyle = Math.sin(t * 24) > 0 ? '#ffd60a' : '#ff5a1f';
          g.beginPath();
          g.arc(62, -66, 13, 0, Math.PI * 2);
          g.fill();
        } else {
          if (it.kind === 'gold') {
            g.fillStyle = 'rgba(255,214,10,.55)';
            g.beginPath();
            g.arc(0, 0, 92 + Math.sin(t * 10) * 8, 0, Math.PI * 2);
            g.fill();
          }
          if (it.kind === 'coussin') {
            g.strokeStyle = '#ff3b5c';
            g.lineWidth = 9;
            g.setLineDash([16, 12]);
            g.beginPath();
            g.arc(0, 0, 88, 0, Math.PI * 2);
            g.stroke();
            g.setLineDash([]);
          }
          drawCharacter(g, 0, 62, 112, { food: it.food, color: '#3a2140', t: 0, mood: it.kind === 'coussin' ? 'win' : 'wow' });
        }
        g.restore();
      }
      for (const d of drops) {
        g.globalAlpha = Math.min(1, d.life * 2);
        g.fillStyle = d.c;
        g.beginPath();
        g.arc(d.x, d.y, 9, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      // Les lames : une couleur par joueur, épaisses puis fines
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const p of pls) {
        if (p.trail.length > 1) {
          for (const [w, c] of [[20, INK], [13, p.profile.color]] as [number, string][]) {
            g.strokeStyle = c;
            g.lineWidth = w;
            g.beginPath();
            p.trail.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
            g.stroke();
          }
        }
        // Le curseur du joueur, pour savoir où est son doigt
        g.globalAlpha = p.stun > 0 ? 0.35 : p.down ? 1 : 0.55;
        g.fillStyle = p.profile.color;
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(p.x, p.y, p.down ? 14 : 18, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.globalAlpha = 1;
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '700 46px Fredoka, sans-serif';
      for (const o of pops) {
        g.globalAlpha = Math.min(1, o.life * 2);
        g.lineWidth = 8;
        g.strokeStyle = INK;
        g.strokeText(o.text, o.x, o.y);
        g.fillStyle = o.c;
        g.fillText(o.text, o.x, o.y);
      }
      g.globalAlpha = 1;
      // Les scores, en haut
      if (teams) {
        [0, 1].forEach((s) => {
          const x = s ? 1420 : 500;
          g.fillStyle = TEAMS[s].color;
          g.strokeStyle = INK;
          g.lineWidth = 6;
          g.beginPath();
          g.roundRect(x - 240, 12, 480, 78, 24);
          g.fill();
          g.stroke();
          g.fillStyle = '#fff';
          g.font = '700 46px Fredoka, sans-serif';
          g.fillText(`${TEAMS[s].emoji} ${teamScore(s)}`, x, 54);
        });
      }
      const w = Math.min(240, 1880 / n);
      const top = teams ? 98 : 14;
      pls.forEach((p, i) => {
        const x = (1920 - n * w) / 2 + i * w;
        g.fillStyle = p.profile.color;
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(x + 4, top, w - 8, 52, 18);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.font = '700 28px Fredoka, sans-serif';
        g.fillText(`${p.profile.name.slice(0, w < 170 ? 5 : 9)} · ${p.score}`, x + w / 2, top + 28, w - 20);
      });
      g.restore();
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): SlicePadData {
      const p = pls.find((x) => x.pid === pid)!;
      return { color: p.profile.color, score: p.score, stun: p.stun > 0 };
    },
  };
  speak(fr ? 'Tranchez tout, sauf les pièges !' : 'Slice everything, except the traps!', ctx.lang);
  return game;
}

export const slice: GameBase = {
  id: 'tranche',
  emoji: '🔪',
  name: { fr: 'Tranche de Rire', en: 'Slice of Laughs' },
  how: {
    fr: 'Glisse ton doigt sur le téléphone pour trancher les aliments à l’écran. Gare au coussin péteur et aux bombes !',
    en: 'Swipe on your phone to slice the food on screen. Watch out for the whoopee cushion and the bombs!',
  },
  layout: 'buttons',
  min: 1,
  max: 12,
  botFill: 3,
  music: 'arcade',
  limit: 60,
  timerCorner: true,
  create,
};
