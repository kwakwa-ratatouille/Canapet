// Pétards Mouillés : arène en grille, on pose des pétards qui éclatent en croix d'éclaboussures.
// Stick = bouger · A = poser un pétard · B = shooter dans un pétard. Le dernier au sec gagne.
import { drawCharacter } from '../shared/characters';
import { sfx } from '../shared/sound';
import { roundRectText } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const GW = 15;
const GH = 11;
const FUSE = 2.5;
const FLAME = 0.55;
const MAX_TIME = 150;

type Cell = 0 | 1 | 2; // vide, pilier, gelée
type Bonus = 'bomb' | 'fire' | 'speed' | 'shield';

/** Plans de l'arène : chaque partie en tire un au hasard. */
const LAYOUTS: { name: { fr: string; en: string }; pillar: (x: number, y: number) => boolean; crates: number; free?: (x: number, y: number) => boolean; floor: [string, string] }[] = [
  { name: { fr: 'Le Classique', en: 'The Classic' }, pillar: (x, y) => x % 2 === 0 && y % 2 === 0, crates: 0.62, floor: ['#fff0f7', '#ffe1ef'] },
  { name: { fr: 'L’Arène ouverte', en: 'The Open Arena' }, pillar: (x, y) => x % 4 === 0 && y % 4 === 0, crates: 0.72, floor: ['#effaf3', '#dcf5e6'] },
  {
    name: { fr: 'La Croix', en: 'The Cross' },
    pillar: (x, y) => x % 2 === 0 && y % 2 === 0 && !(x === 7 || y === 5),
    crates: 0.55,
    free: (x, y) => Math.abs(x - 7) <= 2 && Math.abs(y - 5) <= 1,
    floor: ['#f1edff', '#e4dcff'],
  },
];

interface Bomb {
  x: number;
  y: number;
  t: number;
  range: number;
  owner: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
}

interface P extends Runner {
  x: number;
  y: number;
  alive: boolean;
  out: number;
  bombs: number;
  range: number;
  speed: number;
  inp: { x: number; y: number };
  dropReq: boolean;
  kickReq: boolean;
  lastA: boolean;
  lastB: boolean;
  dir: 1 | -1;
  face: [number, number];
  pass: Set<string>;
  botPath: [number, number][];
  botT: number;
  shield: number;
  invuln: number;
}

const SPAWNS: [number, number][] = [
  [1, 1], [13, 9], [13, 1], [1, 9], [7, 1], [7, 9], [1, 5], [13, 5],
];

const key = (x: number, y: number) => `${x},${y}`;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
  const grid: Cell[][] = [];
  for (let y = 0; y < GH; y++) {
    grid.push([]);
    for (let x = 0; x < GW; x++) {
      const wall = x === 0 || y === 0 || x === GW - 1 || y === GH - 1 || layout.pillar(x, y);
      grid[y].push(wall ? 1 : layout.free?.(x, y) ? 0 : Math.random() < layout.crates ? 2 : 0);
    }
  }
  const players: P[] = runners.slice(0, SPAWNS.length).map((r, i) => {
    const [sx, sy] = SPAWNS[i];
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const x = sx + dx;
      const y = sy + dy;
      if (x > 0 && y > 0 && x < GW - 1 && y < GH - 1 && grid[y][x] === 2) grid[y][x] = 0;
    }
    return {
      ...r,
      x: sx,
      y: sy,
      alive: true,
      out: 0,
      bombs: 1,
      range: 2,
      speed: 3.6,
      inp: { x: 0, y: 0 },
      dropReq: false,
      kickReq: false,
      lastA: false,
      lastB: false,
      dir: 1,
      face: [1, 0],
      pass: new Set(),
      botPath: [],
      botT: 0,
      shield: 0,
      invuln: 0,
    };
  });
  let bombs: Bomb[] = [];
  const flames = new Map<string, number>();
  const bonuses = new Map<string, Bonus>();
  let time = 0;
  let outCount = 0;
  let endDelay = -1;

  const bombAt = (x: number, y: number) => bombs.find((b) => Math.round(b.x) === x && Math.round(b.y) === y);
  const solid = (x: number, y: number) => x < 0 || y < 0 || x >= GW || y >= GH || grid[y][x] !== 0;

  /** Cases que les pétards vont éclabousser (pour les bots). */
  function dangerMap(): Set<string> {
    const d = new Set<string>(flames.keys());
    for (const b of bombs) for (const c of blast(Math.round(b.x), Math.round(b.y), b.range, false)) d.add(c);
    return d;
  }

  function blast(bx: number, by: number, range: number, apply: boolean): string[] {
    const cells = [key(bx, by)];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let k = 1; k <= range; k++) {
        const x = bx + dx * k;
        const y = by + dy * k;
        if (x < 0 || y < 0 || x >= GW || y >= GH || grid[y][x] === 1) break;
        cells.push(key(x, y));
        if (grid[y][x] === 2) {
          if (apply) {
            grid[y][x] = 0;
            if (Math.random() < 0.32) bonuses.set(key(x, y), (['bomb', 'fire', 'speed', 'bomb', 'fire', 'shield'] as Bonus[])[Math.floor(Math.random() * 6)]);
          }
          break;
        }
        if (apply) bonuses.delete(key(x, y));
      }
    }
    return cells;
  }

  function explode(b: Bomb) {
    bombs = bombs.filter((x) => x !== b);
    const bx = Math.round(b.x);
    const by = Math.round(b.y);
    for (const c of blast(bx, by, b.range, true)) {
      flames.set(c, FLAME);
      const other = bombs.find((o) => key(Math.round(o.x), Math.round(o.y)) === c);
      if (other) other.t = Math.min(other.t, 0.06);
    }
    sfx.pop();
    if (!ctx.light) sfx.step();
  }

  function moveP(p: P, dt: number) {
    let ix = p.inp.x;
    let iy = p.inp.y;
    if (Math.abs(ix) < 0.3) ix = 0;
    if (Math.abs(iy) < 0.3) iy = 0;
    // Une seule direction à la fois, la plus franche : c'est plus précis dans les couloirs.
    if (Math.abs(ix) > Math.abs(iy)) iy = 0;
    else ix = 0;
    if (!ix && !iy) return;
    const sx = Math.sign(ix);
    const sy = Math.sign(iy);
    p.face = [sx, sy];
    if (sx) p.dir = sx as 1 | -1;
    const sp = p.speed * dt;
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    const blocked = (x: number, y: number) => {
      if (solid(x, y)) return true;
      const b = bombAt(x, y);
      return !!b && !p.pass.has(key(x, y));
    };
    if (sx) {
      // Recentrage sur la ligne pour passer les coins
      if (Math.abs(p.y - cy) > 0.02) {
        p.y += Math.sign(cy - p.y) * Math.min(sp, Math.abs(cy - p.y));
        if (Math.abs(p.y - cy) > 0.3) return;
      }
      const nx = p.x + sx * sp;
      const front = Math.round(nx + sx * 0.49);
      if (front !== cx && blocked(front, cy)) {
        p.x = cx;
        if (p.kickReq) kick(front, cy, sx, 0);
        return;
      }
      p.x = nx;
    } else {
      if (Math.abs(p.x - cx) > 0.02) {
        p.x += Math.sign(cx - p.x) * Math.min(sp, Math.abs(cx - p.x));
        if (Math.abs(p.x - cx) > 0.3) return;
      }
      const ny = p.y + sy * sp;
      const front = Math.round(ny + sy * 0.49);
      if (front !== cy && blocked(cx, front)) {
        p.y = cy;
        if (p.kickReq) kick(cx, front, 0, sy);
        return;
      }
      p.y = ny;
    }
  }

  function kick(x: number, y: number, dx: number, dy: number) {
    const b = bombAt(x, y);
    if (b && !b.vx && !b.vy) {
      b.vx = dx * 7;
      b.vy = dy * 7;
      sfx.boing();
    }
  }

  function bot(p: P, i: number, dt: number) {
    p.botT -= dt;
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    const danger = dangerMap();
    const free = (x: number, y: number) => !solid(x, y) && !bombAt(x, y);
    const bfs = (goal: (x: number, y: number) => boolean, avoid: Set<string>) => {
      const prev = new Map<string, string | null>([[key(cx, cy), null]]);
      const q: [number, number][] = [[cx, cy]];
      while (q.length) {
        const [x, y] = q.shift()!;
        if (goal(x, y)) {
          const path: [number, number][] = [];
          let k: string | null = key(x, y);
          while (k) {
            const [a, b] = k.split(',').map(Number);
            path.unshift([a, b]);
            k = prev.get(k) ?? null;
          }
          return path.slice(1);
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          const k2 = key(nx, ny);
          if (prev.has(k2) || !free(nx, ny) || avoid.has(k2) && !danger.has(key(x, y))) continue;
          if (flames.has(k2)) continue;
          prev.set(k2, key(x, y));
          q.push([nx, ny]);
        }
      }
      return null;
    };
    if (p.botT <= 0 || !p.botPath.length) {
      p.botT = rnd(0.25, 0.5);
      if (danger.has(key(cx, cy))) {
        p.botPath = bfs((x, y) => !danger.has(key(x, y)), new Set()) ?? [];
      } else {
        const nearCrate = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[cy + dy]?.[cx + dx] === 2);
        const nearFoe = players.some(
          (o, j) => j !== i && o.alive && (Math.round(o.x) === cx || Math.round(o.y) === cy) && Math.abs(o.x - cx) + Math.abs(o.y - cy) <= p.range,
        );
        const mine = bombs.filter((b) => b.owner === i).length;
        if ((nearCrate || nearFoe) && mine < p.bombs && Math.random() < 0.7) {
          // On ne pose que si une case sûre reste atteignable.
          const fake = new Set(danger);
          for (const c of blast(cx, cy, p.range, false)) fake.add(c);
          const escape = bfs((x, y) => !fake.has(key(x, y)), new Set());
          if (escape && escape.length <= 4) {
            p.dropReq = true;
            p.botPath = escape;
            return;
          }
        }
        const target = bfs(
          (x, y) =>
            (x !== cx || y !== cy) &&
            (bonuses.has(key(x, y)) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy]?.[x + dx] === 2) ||
              players.some((o, j) => j !== i && o.alive && Math.abs(Math.round(o.x) - x) + Math.abs(Math.round(o.y) - y) <= 1)),
          danger,
        );
        p.botPath = target ? target.slice(0, 3) : [];
      }
    }
    const nxt = p.botPath[0];
    if (!nxt) {
      p.inp = { x: 0, y: 0 };
      return;
    }
    if (Math.abs(p.x - nxt[0]) < 0.08 && Math.abs(p.y - nxt[1]) < 0.08) {
      p.botPath.shift();
      return;
    }
    p.inp = { x: Math.abs(nxt[0] - p.x) > 0.05 ? Math.sign(nxt[0] - p.x) : 0, y: Math.abs(nxt[1] - p.y) > 0.05 ? Math.sign(nxt[1] - p.y) : 0 };
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const p = players.find((x) => x.pid === pid);
      if (!p) return;
      if (m.a && !p.lastA) p.dropReq = true;
      p.lastA = m.a;
      p.kickReq = m.b;
      p.inp = { x: m.x, y: m.y };
    },
    update(dt) {
      time += dt;
      players.forEach((p, i) => {
        if (!p.alive) return;
        if (p.bot) bot(p, i, dt);
        const cx = Math.round(p.x);
        const cy = Math.round(p.y);
        if (p.dropReq && !bombAt(cx, cy) && bombs.filter((b) => b.owner === i).length < p.bombs) {
          bombs.push({ x: cx, y: cy, t: FUSE, range: p.range, owner: i, vx: 0, vy: 0, fx: 0, fy: 0 });
          players.forEach((o) => {
            if (Math.round(o.x) === cx && Math.round(o.y) === cy) o.pass.add(key(cx, cy));
          });
          sfx.click();
        }
        p.dropReq = false;
        moveP(p, dt);
        // On peut sortir du pétard qu'on vient de poser, pas y revenir.
        for (const k of [...p.pass]) {
          const [x, y] = k.split(',').map(Number);
          if (Math.abs(p.x - x) >= 0.9 || Math.abs(p.y - y) >= 0.9) p.pass.delete(k);
        }
        const bk = key(Math.round(p.x), Math.round(p.y));
        const bonus = bonuses.get(bk);
        if (bonus) {
          bonuses.delete(bk);
          if (bonus === 'bomb') p.bombs = Math.min(6, p.bombs + 1);
          if (bonus === 'fire') p.range = Math.min(7, p.range + 1);
          if (bonus === 'speed') p.speed = Math.min(6, p.speed + 0.5);
          if (bonus === 'shield') p.shield = 1;
          sfx.join();
          if (!p.bot) ctx.buzz(p.pid, 60);
        }
      });
      // Pétards qui glissent quand on shoote dedans
      for (const b of bombs) {
        if (!b.vx && !b.vy) continue;
        const nx = b.x + b.vx * dt;
        const ny = b.y + b.vy * dt;
        const fx = Math.round(nx + Math.sign(b.vx) * 0.5);
        const fy = Math.round(ny + Math.sign(b.vy) * 0.5);
        const hitP = players.some((p) => p.alive && Math.round(p.x) === fx && Math.round(p.y) === fy && (fx !== Math.round(b.x) || fy !== Math.round(b.y)));
        if (solid(fx, fy) || bombs.some((o) => o !== b && Math.round(o.x) === fx && Math.round(o.y) === fy) || hitP) {
          b.x = Math.round(b.x);
          b.y = Math.round(b.y);
          b.vx = b.vy = 0;
        } else {
          b.x = nx;
          b.y = ny;
        }
      }
      for (const b of [...bombs]) if ((b.t -= dt) <= 0) explode(b);
      for (const [k, v] of flames) {
        if (v - dt <= 0) flames.delete(k);
        else flames.set(k, v - dt);
      }
      players.forEach((p) => {
        p.invuln = Math.max(0, p.invuln - dt);
        if (p.alive && p.invuln <= 0 && flames.has(key(Math.round(p.x), Math.round(p.y)))) {
          // Le bouclier encaisse une éclaboussure.
          if (p.shield) {
            p.shield = 0;
            p.invuln = 1;
            sfx.boing();
            return;
          }
          p.alive = false;
          p.out = ++outCount;
          sfx.pet();
          if (!p.bot) ctx.buzz(p.pid, 500);
        }
      });
      const left = players.filter((p) => p.alive).length;
      if (endDelay < 0 && (left <= 1 || time > MAX_TIME)) endDelay = 2;
      if (endDelay >= 0 && (endDelay -= dt) <= 0) game.over = true;
    },
    render(g, t) {
      const cs = Math.min(1840 / GW, 940 / GH);
      const ox = (1920 - cs * GW) / 2;
      const oy = 120 + (940 - cs * GH) / 2;
      g.fillStyle = '#d7f0ff';
      g.fillRect(0, 0, 1920, 1080);
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < GW; x++) {
          const px = ox + x * cs;
          const py = oy + y * cs;
          g.fillStyle = (x + y) % 2 ? layout.floor[0] : layout.floor[1];
          g.fillRect(px, py, cs, cs);
        }
      for (const [k, b] of bonuses) {
        const [x, y] = k.split(',').map(Number);
        g.font = `${cs * 0.6}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(b === 'bomb' ? '🧨' : b === 'fire' ? '💦' : b === 'shield' ? '🛡️' : '👟', ox + (x + 0.5) * cs, oy + (y + 0.5) * cs + Math.sin(t * 4) * 3);
        g.textBaseline = 'alphabetic';
      }
      g.strokeStyle = INK;
      g.lineWidth = 3;
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < GW; x++) {
          const c = grid[y][x];
          if (!c) continue;
          const px = ox + x * cs;
          const py = oy + y * cs;
          if (c === 1) {
            g.fillStyle = '#9b5cff';
            g.beginPath();
            g.roundRect(px + 2, py + 2, cs - 4, cs - 4, 12);
            g.fill();
            g.stroke();
            g.fillStyle = 'rgba(255,255,255,0.3)';
            g.fillRect(px + 10, py + 8, cs * 0.35, 6);
          } else {
            g.fillStyle = 'rgba(123,209,59,0.85)';
            g.beginPath();
            g.roundRect(px + 6, py + 6, cs - 12, cs - 12, 16);
            g.fill();
            g.stroke();
            g.fillStyle = 'rgba(255,255,255,0.5)';
            g.beginPath();
            g.ellipse(px + cs * 0.35, py + cs * 0.3, 8, 4, -0.4, 0, Math.PI * 2);
            g.fill();
          }
        }
      for (const [k, v] of flames) {
        const [x, y] = k.split(',').map(Number);
        const cxp = ox + (x + 0.5) * cs;
        const cyp = oy + (y + 0.5) * cs;
        const s = (v / FLAME) * cs * 0.55;
        g.fillStyle = '#2ec5ff';
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(cxp, cyp, s, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        // Gouttelettes qui s'envolent
        const spread = 1 - v / FLAME;
        for (let d = 0; d < 5; d++) {
          const a = d * 1.26 + x;
          g.beginPath();
          g.arc(cxp + Math.cos(a) * s * (0.8 + spread * 0.8), cyp + Math.sin(a) * s * (0.8 + spread * 0.8), s * 0.22, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath();
        g.arc(cxp - s * 0.3, cyp - s * 0.3, s * 0.32, 0, Math.PI * 2);
        g.fill();
      }
      for (const b of bombs) {
        const px = ox + (b.x + 0.5) * cs;
        const py = oy + (b.y + 0.5) * cs;
        const pulse = 1 + Math.sin(t * (b.t < 0.8 ? 30 : 10)) * 0.06;
        g.save();
        g.translate(px, py);
        g.scale(pulse, pulse);
        g.fillStyle = '#ff3b3b';
        g.beginPath();
        g.roundRect(-cs * 0.22, -cs * 0.3, cs * 0.44, cs * 0.6, 8);
        g.fill();
        g.stroke();
        g.fillStyle = '#fff';
        g.fillRect(-cs * 0.22, -cs * 0.05, cs * 0.44, cs * 0.1);
        g.beginPath();
        g.moveTo(0, -cs * 0.3);
        g.quadraticCurveTo(cs * 0.1, -cs * 0.42, cs * 0.05, -cs * 0.48);
        g.stroke();
        g.fillStyle = Math.floor(t * 20) % 2 ? '#ffd60a' : '#ff9a1f';
        g.beginPath();
        g.arc(cs * 0.05, -cs * 0.48, 6, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      const order = players.map((_, i) => i).sort((a, b) => players[a].y - players[b].y);
      for (const i of order) {
        const p = players[i];
        if (!p.alive) continue;
        drawCharacter(g, ox + (p.x + 0.5) * cs, oy + (p.y + 0.92) * cs, cs * 0.95, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          selfie: p.selfie,
          t: t + i,
          dir: p.dir,
          run: p.inp.x || p.inp.y ? 0.6 : 0,
        });
        if (p.shield || p.invuln > 0) {
          g.strokeStyle = p.invuln > 0 ? 'rgba(46,197,255,0.4)' : 'rgba(46,197,255,0.85)';
          g.lineWidth = 5;
          g.beginPath();
          g.arc(ox + (p.x + 0.5) * cs, oy + (p.y + 0.5) * cs, cs * 0.55, 0, Math.PI * 2);
          g.stroke();
        }
      }
      const w = Math.min(220, 1840 / players.length);
      players.forEach((p, i) => {
        g.globalAlpha = p.alive ? 1 : 0.35;
        roundRectText(g, `${p.profile.name}`, 40 + i * w, 46, w - 10, 28, p.profile.color);
        g.font = '28px sans-serif';
        g.textAlign = 'center';
        g.fillStyle = INK;
        g.fillText(p.alive ? `🧨${p.bombs} 💦${p.range}${p.shield ? ' 🛡️' : ''}` : ctx.family ? '💦' : '💦 KO', 40 + i * w + (w - 10) / 2, 96);
        g.globalAlpha = 1;
      });
    },
    mapName: layout.name,
    ranking() {
      return [...players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.out - a.out).map((p) => p.pid);
    },
    leader() {
      const left = players.filter((p) => p.alive);
      return left.length === 1 ? left[0].profile.name : null;
    },
  };
  return game;
}

export const bombsGame: GameBase = {
  id: 'bombes',
  emoji: '🧨',
  name: { fr: 'Pétards Mouillés', en: 'Soggy Bangers' },
  how: {
    fr: 'Stick pour bouger · A pose un pétard · B shoote dedans',
    en: 'Stick to move · A drops a banger · B kicks it',
  },
  inspired: 'Bomberman',
  layout: 'stick',
  min: 2,
  max: 8,
  botFill: 4,
  music: 'tumble',
  create,
};
