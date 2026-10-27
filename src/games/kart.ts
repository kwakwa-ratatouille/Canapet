// Mini Bolides : course de karts vue de dessus sur un circuit en bonbon, 3 tours.
// Le stick indique la direction voulue (le kart tourne et accélère), A = objet, B = frein.
import { drawCharacter } from '../shared/characters';
import { sfx } from '../shared/sound';
import { roundRectText } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const LAPS = 3;
const ROAD = 150;
const MAX_V = 540;
const OFF_V = 230;
const ACC = 950;
const TURN = 3.4;
const KART_R = 28;
const MAX_TIME = 200;
const AFTER_FIRST = 22;

/** Circuits : chaque course en tire un au hasard. */
const CIRCUITS: {
  name: { fr: string; en: string };
  ctrl: [number, number][];
  grass: string;
  dots: string;
  road: string;
  panel: [number, number];
}[] = [
  {
    name: { fr: 'Le Bonbon', en: 'The Candy' },
    grass: '#bff0d4',
    dots: '#a6e6c1',
    road: '#ffd9ea',
    panel: [330, 300],
    ctrl: [
  [240, 330], [620, 170], [1100, 240], [1600, 170], [1760, 430], [1480, 560], [1160, 470],
  [880, 640], [1200, 790], [1640, 780], [1730, 950], [1100, 1000], [500, 970], [240, 760],
    ],
  },
  {
    name: { fr: 'Le Huit', en: 'Figure Eight' },
    grass: '#fff1d6',
    dots: '#ffe3b0',
    road: '#e8b98a',
    panel: [760, 30],
    ctrl: [
      [960, 540], [1300, 330], [1680, 300], [1800, 560], [1680, 820], [1300, 800],
      [960, 545], [620, 330], [240, 300], [120, 560], [240, 820], [620, 800],
    ],
  },
  {
    name: { fr: 'L’Ovale Express', en: 'Oval Express' },
    grass: '#dff1ff',
    dots: '#c7e6ff',
    road: '#d9ccff',
    panel: [750, 380],
    ctrl: [
      [300, 300], [960, 200], [1620, 300], [1800, 540], [1620, 820], [1250, 880], [1060, 760],
      [860, 760], [670, 880], [300, 820], [120, 540],
    ],
  },
];

type Item = 'turbo' | 'sirop' | 'petard';

interface K extends Runner {
  x: number;
  y: number;
  a: number;
  v: number;
  vx: number;
  vy: number;
  idx: number;
  lap: number;
  done: number;
  item: Item | null;
  turbo: number;
  spin: number;
  inp: { x: number; y: number; b: boolean };
  useReq: boolean;
  lastA: boolean;
  botItemT: number;
  botLane: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function catmull(points: [number, number][], per: number): [number, number][] {
  const out: [number, number][] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

// Circuit de la partie en cours (une seule course à la fois).
let PATH: [number, number][] = [];
let N = 0;

function nearest(x: number, y: number, hint: number) {
  let best = hint;
  let bd = Infinity;
  for (let k = -25; k <= 25; k++) {
    const i = (hint + k + N) % N;
    const d = (PATH[i][0] - x) ** 2 + (PATH[i][1] - y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return { i: best, d: Math.sqrt(bd) };
}

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const circuit = CIRCUITS[Math.floor(Math.random() * CIRCUITS.length)];
  PATH = catmull(circuit.ctrl, 30);
  N = PATH.length;
  const fr = ctx.lang === 'fr';
  const [sx, sy] = PATH[N - 6];
  const [tx, ty] = PATH[0];
  const a0 = Math.atan2(ty - sy, tx - sx);
  const ks: K[] = runners.slice(0, 8).map((r, i) => {
    const row = Math.floor(i / 2);
    const side = i % 2 ? 1 : -1;
    const back = PATH[(N - 4 - row * 3) % N];
    return {
      ...r,
      x: back[0] + Math.cos(a0 + Math.PI / 2) * side * 34,
      y: back[1] + Math.sin(a0 + Math.PI / 2) * side * 34,
      a: a0,
      v: 0,
      vx: 0,
      vy: 0,
      idx: N - 4 - row * 3,
      lap: -1,
      done: 0,
      item: null,
      turbo: 0,
      spin: 0,
      inp: { x: 0, y: 0, b: false },
      useReq: false,
      lastA: false,
      botItemT: rnd(1, 3),
      botLane: rnd(-40, 40),
    };
  });
  const boxes = [0.18, 0.47, 0.74].flatMap((f) => {
    const i = Math.floor(f * N);
    const [x, y] = PATH[i];
    const [x2, y2] = PATH[(i + 1) % N];
    const na = Math.atan2(y2 - y, x2 - x) + Math.PI / 2;
    return [-45, 0, 45].map((o) => ({ x: x + Math.cos(na) * o, y: y + Math.sin(na) * o, t: 0 }));
  });
  const puddles: { x: number; y: number; t: number }[] = [];
  const shots: { idx: number; x: number; y: number; owner: number; t: number }[] = [];
  let time = 0;
  let order = 0;
  let firstAt = -1;
  let endDelay = -1;

  const progress = (k: K) => k.lap * N + k.idx;

  function useItem(k: K, i: number) {
    if (!k.item) return;
    if (k.item === 'turbo') {
      k.turbo = 1.3;
      sfx.go();
    } else if (k.item === 'sirop') {
      puddles.push({ x: k.x - Math.cos(k.a) * 50, y: k.y - Math.sin(k.a) * 50, t: 12 });
      sfx.pop();
    } else {
      shots.push({ idx: k.idx, x: k.x, y: k.y, owner: i, t: 3 });
      sfx.boing();
    }
    k.item = null;
  }

  function spinOut(k: K) {
    if (k.spin > 0) return;
    k.spin = 1.1;
    k.v *= 0.3;
    sfx.pet();
    if (!k.bot) ctx.buzz(k.pid, 300);
  }

  function bot(k: K, dt: number) {
    const [px, py] = PATH[(k.idx + 14) % N];
    const [qx, qy] = PATH[(k.idx + 15) % N];
    const na = Math.atan2(qy - py, qx - px) + Math.PI / 2;
    const gx = px + Math.cos(na) * k.botLane - k.x;
    const gy = py + Math.sin(na) * k.botLane - k.y;
    const l = Math.hypot(gx, gy) || 1;
    k.inp = { x: gx / l, y: gy / l, b: false };
    if (k.item && (k.botItemT -= dt) <= 0) {
      k.useReq = true;
      k.botItemT = rnd(1, 3);
    }
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const k = ks.find((x) => x.pid === pid);
      if (!k) return;
      if (m.a && !k.lastA) k.useReq = true;
      k.lastA = m.a;
      k.inp = { x: m.x, y: m.y, b: m.b };
    },
    update(dt) {
      time += dt;
      ks.forEach((k, i) => {
        if (k.bot && !k.done) bot(k, dt);
        if (k.done) k.inp = { x: Math.cos(k.a) * 0.4, y: Math.sin(k.a) * 0.4, b: false };
        k.turbo = Math.max(0, k.turbo - dt);
        if (k.useReq) useItem(k, i);
        k.useReq = false;
        const near = nearest(k.x, k.y, k.idx);
        const off = near.d > ROAD / 2;
        if (k.spin > 0) {
          k.spin -= dt;
          k.a += dt * 12;
          k.v *= Math.pow(0.2, dt);
        } else {
          const mag = Math.min(1, Math.hypot(k.inp.x, k.inp.y));
          if (mag > 0.25) {
            const want = Math.atan2(k.inp.y, k.inp.x);
            let d = want - k.a;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            const turn = TURN * dt * (0.4 + 0.6 * Math.min(1, Math.abs(k.v) / 200));
            k.a += Math.max(-turn, Math.min(turn, d));
            // On ralentit si on demande un demi-tour
            const thr = Math.abs(d) > 2 ? 0.2 : mag;
            k.v += ACC * thr * dt;
          }
          if (k.inp.b) k.v -= ACC * 1.4 * dt;
        }
        const max = (off ? OFF_V : MAX_V) * (k.turbo > 0 ? 1.45 : 1);
        k.v = Math.max(-150, Math.min(max, k.v));
        if (mag0(k)) k.v *= Math.pow(0.45, dt);
        const tx = Math.cos(k.a) * k.v;
        const ty = Math.sin(k.a) * k.v;
        const grip = Math.min(1, dt * 7);
        k.vx += (tx - k.vx) * grip;
        k.vy += (ty - k.vy) * grip;
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        k.x = Math.max(20, Math.min(1900, k.x));
        k.y = Math.max(20, Math.min(1060, k.y));

        // Tours : passage de la ligne dans le bon sens
        const prev = k.idx;
        k.idx = nearest(k.x, k.y, k.idx).i;
        if (prev > N * 0.85 && k.idx < N * 0.15) k.lap++;
        if (prev < N * 0.15 && k.idx > N * 0.85) k.lap--;
        if (!k.done && k.lap >= LAPS) {
          k.done = ++order;
          if (firstAt < 0) firstAt = time;
          sfx.finish();
          if (!k.bot) ctx.buzz(k.pid, 300);
        }

        for (const b of boxes)
          if (b.t <= 0 && !k.item && Math.hypot(b.x - k.x, b.y - k.y) < 38) {
            b.t = 4;
            const ahead = ks.filter((o) => progress(o) > progress(k)).length;
            const pool: Item[] = ahead === 0 ? ['sirop', 'sirop', 'petard'] : ahead > 2 ? ['turbo', 'turbo', 'petard'] : ['turbo', 'sirop', 'petard'];
            k.item = pool[Math.floor(Math.random() * pool.length)];
            sfx.join();
          }
        for (const p of puddles) if (Math.hypot(p.x - k.x, p.y - k.y) < 40) spinOut(k);
      });
      for (const b of boxes) b.t -= dt;
      for (const p of puddles) p.t -= dt;
      while (puddles.length && puddles[0].t <= 0) puddles.shift();
      for (const s of shots) {
        s.t -= dt;
        s.idx = (s.idx + 1) % N;
        const [px, py] = PATH[(s.idx + 2) % N];
        s.x += (px - s.x) * Math.min(1, dt * 14);
        s.y += (py - s.y) * Math.min(1, dt * 14);
        for (const [j, k] of ks.entries())
          if (j !== s.owner && Math.hypot(k.x - s.x, k.y - s.y) < 40) {
            spinOut(k);
            s.t = 0;
          }
      }
      for (let i = shots.length - 1; i >= 0; i--) if (shots[i].t <= 0) shots.splice(i, 1);
      // Chocs entre karts
      for (let i = 0; i < ks.length; i++)
        for (let j = i + 1; j < ks.length; j++) {
          const a = ks[i];
          const b = ks[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < KART_R * 2) {
            const o = (KART_R * 2 - d) / 2;
            a.x -= (dx / d) * o;
            a.y -= (dy / d) * o;
            b.x += (dx / d) * o;
            b.y += (dy / d) * o;
          }
        }
      const humansDone = ks.some((k) => !k.bot) ? ks.every((k) => k.bot || k.done) : ks.every((k) => k.done);
      if (endDelay < 0 && (humansDone || time > MAX_TIME || (firstAt >= 0 && time - firstAt > AFTER_FIRST))) endDelay = 2;
      if (endDelay >= 0 && (endDelay -= dt) <= 0) game.over = true;
    },
    render(g, t) {
      g.fillStyle = circuit.grass;
      g.fillRect(0, 0, 1920, 1080);
      if (!ctx.light) {
        g.fillStyle = circuit.dots;
        for (let i = 0; i < 40; i++) {
          g.beginPath();
          g.arc((i * 397) % 1920, (i * 233) % 1080, 18, 0, Math.PI * 2);
          g.fill();
        }
      }
      const loop = () => {
        g.beginPath();
        PATH.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
      };
      g.lineJoin = 'round';
      g.lineCap = 'round';
      loop();
      g.strokeStyle = INK;
      g.lineWidth = ROAD + 22;
      g.stroke();
      loop();
      g.strokeStyle = '#fff';
      g.lineWidth = ROAD + 14;
      g.setLineDash([26, 26]);
      g.stroke();
      g.setLineDash([]);
      loop();
      g.strokeStyle = '#ff6b9a';
      g.lineWidth = ROAD + 14;
      g.setLineDash([26, 26]);
      g.lineDashOffset = 26;
      g.stroke();
      g.setLineDash([]);
      g.lineDashOffset = 0;
      loop();
      g.strokeStyle = circuit.road;
      g.lineWidth = ROAD;
      g.stroke();
      loop();
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 4;
      g.setLineDash([30, 30]);
      g.stroke();
      g.setLineDash([]);

      // Ligne d'arrivée
      const [fx, fy] = PATH[0];
      const [gx, gy] = PATH[1];
      const fa = Math.atan2(gy - fy, gx - fx);
      g.save();
      g.translate(fx, fy);
      g.rotate(fa);
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 8; c++) {
          g.fillStyle = (r + c) % 2 ? INK : '#fff';
          g.fillRect(-12 + r * 12, -ROAD / 2 + c * (ROAD / 8), 12, ROAD / 8);
        }
      g.restore();

      for (const b of boxes) {
        if (b.t > 0) continue;
        g.save();
        g.translate(b.x, b.y);
        g.rotate(Math.sin(t * 2) * 0.2);
        g.fillStyle = '#9b5cff';
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.beginPath();
        g.roundRect(-18, -18, 36, 36, 8);
        g.fill();
        g.stroke();
        g.fillStyle = '#fff';
        g.font = '700 28px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillText('?', 0, 9);
        g.restore();
      }
      for (const p of puddles) {
        g.fillStyle = 'rgba(160,100,58,0.75)';
        g.beginPath();
        g.ellipse(p.x, p.y, 40, 26, 0.3, 0, Math.PI * 2);
        g.fill();
      }
      for (const s of shots) {
        g.fillStyle = '#ff3b3b';
        g.beginPath();
        g.arc(s.x, s.y, 12, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#ffd60a';
        g.beginPath();
        g.arc(s.x - 8, s.y - 8, 5 + Math.sin(t * 40) * 2, 0, Math.PI * 2);
        g.fill();
      }

      const zs = ks.map((_, i) => i).sort((a, b) => ks[a].y - ks[b].y);
      for (const i of zs) {
        const k = ks[i];
        g.save();
        g.translate(k.x, k.y);
        g.rotate(k.a);
        g.fillStyle = INK;
        for (const [wx, wy] of [[-18, -22], [18, -22], [-18, 22], [18, 22]]) g.fillRect(wx - 8, wy - 5, 16, 10);
        g.fillStyle = k.profile.color;
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(-30, -18, 60, 36, 12);
        g.fill();
        g.stroke();
        if (k.turbo > 0) {
          g.fillStyle = '#ffd60a';
          g.beginPath();
          g.moveTo(-30, -10);
          g.lineTo(-52 - Math.random() * 14, 0);
          g.lineTo(-30, 10);
          g.fill();
        }
        g.restore();
        drawCharacter(g, k.x, k.y + 10, 58, {
          food: k.profile.food,
          color: k.profile.color,
          hat: k.profile.hat,
          acc: k.profile.acc,
          selfie: k.selfie,
          t: t + i,
          dir: Math.cos(k.a) >= 0 ? 1 : -1,
          mood: k.spin > 0 ? 'wow' : 'happy',
        });
        if (k.item) {
          g.font = '28px sans-serif';
          g.textAlign = 'center';
          g.fillText(k.item === 'turbo' ? '⚡' : k.item === 'sirop' ? '🍯' : '🧨', k.x + 30, k.y - 52);
        }
      }

      // Classement en direct
      const ranked = [...ks].sort((a, b) => (a.done || 99) - (b.done || 99) || progress(b) - progress(a));
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.beginPath();
      const [px, py] = circuit.panel;
      g.roundRect(px, py, 420, 30 + ranked.length * 44, 18);
      g.fill();
      g.stroke();
      ranked.forEach((k, r) => {
        g.fillStyle = INK;
        g.font = '700 28px Fredoka, sans-serif';
        g.textAlign = 'left';
        g.fillText(`${r + 1}`, px + 20, py + 42 + r * 44);
        roundRectText(g, k.profile.name, px + 55, py + 33 + r * 44, 200, 26, k.profile.color);
        g.fillStyle = INK;
        g.font = '600 28px Fredoka, sans-serif';
        g.textAlign = 'left';
        const lapTxt = k.done ? '🏁' : `${fr ? 'Tour' : 'Lap'} ${Math.max(1, Math.min(LAPS, k.lap + 1))}/${LAPS}`;
        g.fillText(lapTxt, px + 270, py + 42 + r * 44);
      });
    },
    mapName: circuit.name,
    ranking() {
      return [...ks].sort((a, b) => (a.done || 99) - (b.done || 99) || progress(b) - progress(a)).map((k) => k.pid);
    },
    leader() {
      return ks.find((k) => k.done === 1)?.profile.name ?? null;
    },
  };
  return game;
}

function mag0(k: K) {
  return Math.hypot(k.inp.x, k.inp.y) < 0.25 && !k.inp.b;
}

export const kart: GameBase = {
  id: 'kart',
  emoji: '🏎️',
  name: { fr: 'Mini Bolides', en: 'Tiny Racers' },
  how: {
    fr: 'Pointe le stick où tu veux aller · A objet · B frein · 3 tours',
    en: 'Point the stick where to go · A item · B brake · 3 laps',
  },
  inspired: 'Micro Machines',
  layout: 'stick',
  min: 1,
  max: 8,
  botFill: 4,
  music: 'race',
  create,
};
