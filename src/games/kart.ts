// Mini Bolides : course de karts vue de dessus sur un circuit en bonbon, 5 tours, bordures, tapis turbo.
// Le stick indique la direction voulue (le kart tourne et accélère), A = objet, B = frein.
import { drawCharacter } from '../shared/characters';
import { sfx, speak } from '../shared/sound';
import { roundRectText } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const LAPS = 5;
const ROAD = 150;
const MAX_V = 470;
/** Le kart reste sur la piste : des bordures en guimauve le renvoient. */
const WALL = ROAD / 2 - 20;
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
  {
    name: { fr: 'Le Serpentin', en: 'The Wiggle' },
    grass: '#ffe9f3',
    dots: '#ffd6ea',
    road: '#cfe9ff',
    panel: [1080, 560],
    ctrl: [
      [200, 900], [200, 260], [520, 180], [700, 420], [900, 640], [1100, 420], [1300, 200], [1600, 220],
      [1760, 480], [1650, 760], [1400, 960], [900, 990], [560, 960],
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
  /** Protection après une glissade (pas de tête-à-queue en boucle). */
  safe: number;
  padT: number;
  bumpT: number;
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
      safe: 0,
      padT: 0,
      bumpT: 0,
      inp: { x: 0, y: 0, b: false },
      useReq: false,
      lastA: false,
      botItemT: rnd(1, 3),
      botLane: rnd(-40, 40),
    };
  });
  // Décor au bord de la piste : sucettes géantes, buissons et fleurs, jamais sur la route.
  const decor: { x: number; y: number; kind: number; c: string }[] = [];
  for (let k = 0; k < 400 && decor.length < 26; k++) {
    const x = 60 + Math.random() * 1800;
    const y = 60 + Math.random() * 960;
    let d = Infinity;
    for (let j = 0; j < N; j += 4) d = Math.min(d, Math.hypot(PATH[j][0] - x, PATH[j][1] - y));
    if (d > ROAD * 0.5 + 70 && decor.every((o) => Math.hypot(o.x - x, o.y - y) > 110))
      decor.push({ x, y, kind: k % 3, c: ['#ff4f9a', '#2ec5ff', '#ffd60a', '#1fc9a0', '#9b5cff'][k % 5] });
  }
  const boxes = [0.18, 0.47, 0.74].flatMap((f) => {
    const i = Math.floor(f * N);
    const [x, y] = PATH[i];
    const [x2, y2] = PATH[(i + 1) % N];
    const na = Math.atan2(y2 - y, x2 - x) + Math.PI / 2;
    return [-45, 0, 45].map((o) => ({ x: x + Math.cos(na) * o, y: y + Math.sin(na) * o, t: 0 }));
  });
  // Tapis turbo au milieu de la piste
  const pads = [0.08, 0.36, 0.62, 0.88].map((f) => {
    const i = Math.floor(f * N);
    const [x, y] = PATH[i];
    const [x2, y2] = PATH[(i + 1) % N];
    return { x, y, a: Math.atan2(y2 - y, x2 - x) };
  });
  const parts: { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; r: number }[] = [];
  const pops: { x: number; y: number; text: string; c: string; t: number }[] = [];
  let banner = '';
  let bannerT = 0;
  let lastLapSaid = false;
  let shake = 0;
  const puff = (x: number, y: number, n: number, c: string, sp: number, r: number) => {
    if (ctx.light) n = Math.ceil(n / 3);
    for (let q = 0; q < n; q++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * sp;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, max: 0.9, c, r: r * (0.6 + Math.random() * 0.6) });
    }
  };
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
    if (k.spin > 0 || k.safe > 0) return;
    k.spin = 0.9;
    k.safe = 0.9 + 1.6;
    k.v *= 0.3;
    puff(k.x, k.y, 12, '#ffd60a', 260, 8);
    pops.push({ x: k.x, y: k.y - 60, text: ctx.family ? 'Oups !' : 'GLISSADE !', c: '#ff4f9a', t: 1 });
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
        k.safe = Math.max(0, k.safe - dt);
        k.padT = Math.max(0, k.padT - dt);
        k.bumpT = Math.max(0, k.bumpT - dt);
        if (k.useReq) useItem(k, i);
        k.useReq = false;
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
        // Les derniers vont un poil plus vite : la course reste serrée
        const behind = ks.filter((o) => progress(o) > progress(k) + 10).length;
        const max = MAX_V * (1 + behind * 0.035) * (k.turbo > 0 ? 1.45 : 1);
        k.v = Math.max(-150, Math.min(max, k.v));
        if (mag0(k)) k.v *= Math.pow(0.45, dt);
        const tx = Math.cos(k.a) * k.v;
        const ty = Math.sin(k.a) * k.v;
        const grip = Math.min(1, dt * 7);
        k.vx += (tx - k.vx) * grip;
        k.vy += (ty - k.vy) * grip;
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        // Bordures : on rebondit vers le milieu de la piste
        const nb = nearest(k.x, k.y, k.idx);
        if (nb.d > WALL) {
          const [cx, cy] = PATH[nb.i];
          const nx = (k.x - cx) / nb.d;
          const ny = (k.y - cy) / nb.d;
          k.x = cx + nx * WALL;
          k.y = cy + ny * WALL;
          const vn = k.vx * nx + k.vy * ny;
          if (vn > 0) {
            k.vx -= 1.5 * vn * nx;
            k.vy -= 1.5 * vn * ny;
            k.v *= vn > 220 ? 0.7 : 0.92;
            if (vn > 160 && k.bumpT <= 0) {
              k.bumpT = 0.3;
              puff(k.x + nx * 20, k.y + ny * 20, 8, '#fff', 220, 7);
              sfx.boing();
              if (vn > 300) {
                shake = Math.max(shake, 6);
                pops.push({ x: k.x, y: k.y - 50, text: 'BOING !', c: '#2ec5ff', t: 0.8 });
              }
              if (!k.bot) ctx.buzz(k.pid, 60);
            }
          }
        }
        for (const pd of pads)
          if (k.padT <= 0 && Math.hypot(pd.x - k.x, pd.y - k.y) < 52) {
            k.padT = 0.8;
            k.turbo = Math.max(k.turbo, 0.75);
            k.v = Math.max(k.v, MAX_V);
            puff(k.x, k.y, 8, '#ffd60a', 200, 7);
            if (!k.bot) {
              sfx.go();
              ctx.buzz(k.pid, 40);
            }
          }
        // Fumée et flammes
        if (!ctx.light && (k.turbo > 0 || Math.random() < Math.abs(k.v) / 3000))
          parts.push({
            x: k.x - Math.cos(k.a) * 30,
            y: k.y - Math.sin(k.a) * 30,
            vx: -Math.cos(k.a) * 60 + rnd(-30, 30),
            vy: -Math.sin(k.a) * 60 + rnd(-30, 30),
            life: 0.4,
            max: 0.4,
            c: k.turbo > 0 ? (Math.random() < 0.5 ? '#ffd60a' : '#ff8a3d') : '#ffffff',
            r: k.turbo > 0 ? 9 : 6,
          });

        // Tours : passage de la ligne dans le bon sens
        const prev = k.idx;
        k.idx = nearest(k.x, k.y, k.idx).i;
        if (prev > N * 0.85 && k.idx < N * 0.15) k.lap++;
        if (prev < N * 0.15 && k.idx > N * 0.85) k.lap--;
        if (!k.done && k.lap === LAPS - 1 && !lastLapSaid) {
          lastLapSaid = true;
          banner = fr ? 'DERNIER TOUR !' : 'FINAL LAP!';
          bannerT = 2;
          speak(fr ? 'Dernier tour !' : 'Final lap!', ctx.lang);
          sfx.hurry();
        }
        if (!k.done && k.lap >= LAPS) {
          k.done = ++order;
          pops.push({ x: k.x, y: k.y - 70, text: k.done === 1 ? '🏆 1er !' : `${k.done}e`, c: '#ffd60a', t: 1.4 });
          puff(k.x, k.y, 20, ['#ff4f9a', '#ffd60a', '#1fc9a0', '#2ec5ff'][k.done % 4], 380, 9);
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
            puff(b.x, b.y, 10, '#9b5cff', 240, 7);
            sfx.join();
          }
        for (const p of puddles)
          if (p.t > 0 && k.safe <= 0 && Math.hypot(p.x - k.x, p.y - k.y) < 40) {
            spinOut(k);
            p.t = 0;
          }
      });
      for (const b of boxes) b.t -= dt;
      for (const p of puddles) p.t -= dt;
      for (let i = puddles.length - 1; i >= 0; i--) if (puddles[i].t <= 0) puddles.splice(i, 1);
      for (const q of parts) {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= 0.92;
        q.vy *= 0.92;
        q.life -= dt;
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      for (const q of pops) q.t -= dt;
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].t <= 0) pops.splice(i, 1);
      bannerT = Math.max(0, bannerT - dt);
      shake = Math.max(0, shake - dt * 30);
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
      g.save();
      if (shake) g.translate(rnd(-shake, shake), rnd(-shake, shake));
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
      g.strokeStyle = INK;
      g.lineWidth = 4;
      for (const d of decor) {
        if (d.kind === 0) {
          // Sucette géante
          g.fillStyle = '#fff';
          g.fillRect(d.x - 5, d.y - 10, 10, 60);
          g.strokeRect(d.x - 5, d.y - 10, 10, 60);
          g.fillStyle = d.c;
          g.beginPath();
          g.arc(d.x, d.y - 30, 34, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.strokeStyle = '#fff';
          g.lineWidth = 6;
          g.beginPath();
          g.arc(d.x, d.y - 30, 18, 0, Math.PI * 1.5);
          g.stroke();
          g.strokeStyle = INK;
          g.lineWidth = 4;
        } else if (d.kind === 1) {
          // Buisson
          g.fillStyle = '#7bd13b';
          g.beginPath();
          g.arc(d.x - 26, d.y, 24, 0, Math.PI * 2);
          g.arc(d.x, d.y - 14, 30, 0, Math.PI * 2);
          g.arc(d.x + 26, d.y, 24, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.fillStyle = '#7bd13b';
          g.fillRect(d.x - 40, d.y - 4, 80, 20);
          g.fillStyle = d.c;
          g.beginPath();
          g.arc(d.x - 8, d.y - 18, 6, 0, Math.PI * 2);
          g.arc(d.x + 16, d.y - 4, 6, 0, Math.PI * 2);
          g.fill();
        } else {
          // Fleur
          g.fillStyle = d.c;
          for (let k = 0; k < 5; k++) {
            g.beginPath();
            g.arc(d.x + Math.cos((k * Math.PI * 2) / 5) * 14, d.y + Math.sin((k * Math.PI * 2) / 5) * 14, 11, 0, Math.PI * 2);
            g.fill();
            g.stroke();
          }
          g.fillStyle = '#ffd60a';
          g.beginPath();
          g.arc(d.x, d.y, 9, 0, Math.PI * 2);
          g.fill();
          g.stroke();
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
      // Bordures en guimauve (on ne sort plus de la piste)
      loop();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = ROAD - 8;
      g.setLineDash([]);
      g.stroke();
      loop();
      g.strokeStyle = circuit.road;
      g.lineWidth = ROAD - 18;
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

      for (const pd of pads) {
        g.save();
        g.translate(pd.x, pd.y);
        g.rotate(pd.a);
        g.fillStyle = '#ffd60a';
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(-40, -34, 80, 68, 14);
        g.fill();
        g.stroke();
        g.fillStyle = '#ff8a3d';
        for (let c = 0; c < 2; c++) {
          const o = ((t * 60) % 26) - 20 + c * 24;
          g.beginPath();
          g.moveTo(o - 6, -20);
          g.lineTo(o + 10, 0);
          g.lineTo(o - 6, 20);
          g.lineTo(o + 2, 0);
          g.closePath();
          g.fill();
        }
        g.restore();
      }
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
        g.fillStyle = '#c98a3a';
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(p.x, p.y, 42, 28, 0.3, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.beginPath();
        g.ellipse(p.x - 12, p.y - 8, 12, 6, 0.3, 0, Math.PI * 2);
        g.fill();
      }
      for (const q of parts) {
        g.globalAlpha = Math.max(0, q.life / q.max);
        g.fillStyle = q.c;
        g.beginPath();
        g.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
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

      const leaderK = [...ks].sort((a, b) => (a.done || 99) - (b.done || 99) || progress(b) - progress(a))[0];
      const zs = ks.map((_, i) => i).sort((a, b) => ks[a].y - ks[b].y);
      for (const i of zs) {
        const k = ks[i];
        g.save();
        g.translate(k.x, k.y);
        g.rotate(k.a);
        if (k.safe > 0 && k.spin <= 0 && Math.floor(t * 10) % 2) g.globalAlpha = 0.5;
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
        g.globalAlpha = 1;
        if (k === leaderK && !k.done) {
          g.font = '34px sans-serif';
          g.textAlign = 'center';
          g.fillText('👑', k.x, k.y - 66 + Math.sin(t * 6) * 4);
        }
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
      for (const q of pops) {
        g.save();
        g.globalAlpha = Math.min(1, q.t * 3);
        g.font = '700 40px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 8;
        g.strokeStyle = INK;
        const yy = q.y - (1 - q.t) * 40;
        g.strokeText(q.text, q.x, yy);
        g.fillStyle = q.c;
        g.fillText(q.text, q.x, yy);
        g.restore();
      }
      if (bannerT > 0) {
        g.save();
        g.translate(960, 540);
        g.rotate(-0.05);
        const sc = Math.min(1, (2 - bannerT) * 6) * (1 + Math.sin(t * 10) * 0.03);
        g.scale(sc, sc);
        g.font = '700 130px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineJoin = 'round';
        g.lineWidth = 30;
        g.strokeStyle = INK;
        g.strokeText(banner, 0, 45);
        g.lineWidth = 14;
        g.strokeStyle = '#fff';
        g.strokeText(banner, 0, 40);
        g.fillStyle = '#ff4f9a';
        g.fillText(banner, 0, 40);
        g.restore();
      }
      g.restore();
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
    fr: 'Pointe le stick où tu veux aller · A objet · B frein · 5 tours',
    en: 'Point the stick where to go · A item · B brake · 5 laps',
  },
  inspired: 'Micro Machines',
  layout: 'stick',
  min: 1,
  max: 8,
  botFill: 4,
  music: 'race',
  limit: 180,
  create,
};
