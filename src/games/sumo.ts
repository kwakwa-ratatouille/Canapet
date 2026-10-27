// Sumo Tamponneur : chacun dans sa bouée sur une arène qui rétrécit. On se pousse dans la limonade.
// Stick = avancer · A = turbo (maintenir pour charger) · B = ancre (lourd et freiné). 3 vies, le dernier debout gagne.
// Des bonus apparaissent : piment (pousse 2× plus fort), bouclier (on ne recule presque plus), géant (gros et lourd).
import { drawCharacter } from '../shared/characters';
import { INK, ROSE, SOLEIL } from '../shared/palette';
import { sfx } from '../shared/sound';
import { roundRectText } from './draw';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

const R0 = 520;
const R_MIN = 280;
const SHRINK_TIME = 70;
const BODY = 46;
const ACC = 1500;
const MAX_V = 520;
const DASH_MIN = 640;
const DASH_MAX = 1350;
const CHARGE_TIME = 0.9;
const DASH_CD = 1.2;
const LIVES = 3;
const MAX_TIME = 120;
const SX = 1.32;
const SY = 0.78;
const CX = 960;
const CY = 610;

type Bonus = 'piment' | 'bouclier' | 'geant';
const BONUS_ICON: Record<Bonus, string> = { piment: '🌶️', bouclier: '🛡️', geant: '🍔' };

interface S extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lives: number;
  falling: number;
  respawn: number;
  invuln: number;
  dashCd: number;
  heavy: number;
  anchor: boolean;
  inp: { x: number; y: number };
  aHeld: boolean;
  charge: number;
  dashReq: number;
  lastA: boolean;
  lastHit: { by: number; at: number } | null;
  kos: number;
  out: number;
  face: 1 | -1;
  botT: number;
  botTarget: number;
  bonus: Bonus | null;
  bonusT: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Arènes : chaque partie en tire une au hasard. */
const MAPS = [
  { id: 'assiette', name: { fr: 'L’Assiette', en: 'The Plate' }, shrink: true, grip: 0.3, acc: 1, plate: '#ffd1ea', rim: '#fff', under: '#c9b8e8', bumpers: [] as [number, number][] },
  { id: 'glace', name: { fr: 'La Patinoire', en: 'The Ice Rink' }, shrink: false, grip: 0.82, acc: 0.6, plate: '#dff4ff', rim: '#ffffff', under: '#9fd2ee', bumpers: [] as [number, number][] },
  {
    id: 'pizza',
    name: { fr: 'La Pizza Flipper', en: 'Pinball Pizza' },
    shrink: true,
    grip: 0.3,
    acc: 1,
    plate: '#ffcf6b',
    rim: '#e39b45',
    under: '#c9783a',
    bumpers: [[-230, 0], [230, 0], [0, -190], [0, 190]] as [number, number][],
  },
  {
    id: 'gateau',
    name: { fr: 'Le Gâteau d’anniversaire', en: 'The Birthday Cake' },
    shrink: true,
    grip: 0.3,
    acc: 1,
    plate: '#fff0f7',
    rim: '#ff9ccf',
    under: '#ff4f9a',
    bumpers: [0, 1, 2, 3, 4, 5].map((k) => [Math.cos((k * Math.PI) / 3) * 300, Math.sin((k * Math.PI) / 3) * 300]) as [number, number][],
  },
];
const BUMPER_R = 52;

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  max: number;
  size: number;
  color: string;
  kind: 'star' | 'drop' | 'smoke' | 'ring';
}

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const n = runners.length;
  const map = MAPS[Math.floor(Math.random() * MAPS.length)];
  const ss: S[] = runners.map((r, i) => {
    const a = (i / n) * Math.PI * 2;
    return {
      ...r,
      x: Math.cos(a) * R0 * 0.6,
      y: Math.sin(a) * R0 * 0.6,
      vx: 0,
      vy: 0,
      lives: LIVES,
      falling: 0,
      respawn: 0,
      invuln: 1,
      dashCd: 0,
      heavy: 0,
      anchor: false,
      inp: { x: 0, y: 0 },
      aHeld: false,
      charge: 0,
      dashReq: 0,
      lastA: false,
      lastHit: null,
      kos: 0,
      out: 0,
      face: 1,
      botT: 0,
      botTarget: -1,
      bonus: null,
      bonusT: 0,
    };
  });
  let time = 0;
  let outCount = 0;
  let endDelay = -1;
  let shake = 0;
  let freeze = 0;
  let pickup: { x: number; y: number; kind: Bonus; t: number } | null = null;
  let nextPickup = rnd(6, 9);
  const parts: Part[] = [];
  const pops: { x: number; y: number; text: string; color: string; t: number; size: number }[] = [];
  const maxParts = ctx.light ? 60 : 220;
  const radius = () => (map.shrink ? R0 - (R0 - R_MIN) * Math.min(1, time / SHRINK_TIME) : R0 - 40);
  const inPlay = (s: S) => s.lives > 0 && s.falling <= 0 && s.respawn <= 0;
  const scr = (x: number, y: number) => [CX + x * SX, CY + y * SY] as const;
  const bodyR = (s: S) => BODY * (s.bonus === 'geant' ? 1.4 : 1);
  const mass = (s: S) => (s.anchor ? 4 : s.heavy > 0 ? 2.2 : 1) * (s.bonus === 'geant' ? 2 : 1) * (s.bonus === 'bouclier' ? 3 : 1);

  function burst(x: number, y: number, k: number, kind: Part['kind'], color: string, speed = 300, size = 10, up = 0) {
    for (let i = 0; i < k && parts.length < maxParts; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * rnd(0.4, 1);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, t: 0, max: rnd(0.4, 0.8), size: size * rnd(0.6, 1.3), color, kind });
    }
  }
  const pop = (x: number, y: number, text: string, color: string, size = 46) => pops.push({ x, y, text, color, t: 1, size });

  function bot(s: S, i: number, dt: number) {
    s.botT -= dt;
    const R = radius();
    const d = Math.hypot(s.x, s.y);
    if (s.botT <= 0) {
      s.botT = rnd(0.4, 0.9);
      let best = -1;
      let score = -1e9;
      ss.forEach((o, j) => {
        if (j === i || !inPlay(o) || allies(o, s)) return;
        const sc = Math.hypot(o.x, o.y) * 1.2 - Math.hypot(o.x - s.x, o.y - s.y);
        if (sc > score) {
          score = sc;
          best = j;
        }
      });
      s.botTarget = best;
    }
    let tx = 0;
    let ty = 0;
    if (d > R - 110) {
      tx = -s.x;
      ty = -s.y;
    } else if (pickup && !s.bonus && Math.hypot(pickup.x - s.x, pickup.y - s.y) < 400) {
      tx = pickup.x - s.x;
      ty = pickup.y - s.y;
    } else if (s.botTarget >= 0) {
      const o = ss[s.botTarget];
      tx = o.x - s.x;
      ty = o.y - s.y;
      const dist = Math.hypot(tx, ty);
      // Charge le turbo quand la cible est à bonne distance
      if (dist < 340 && s.dashCd <= 0 && !s.aHeld && Math.random() < 0.04) s.aHeld = true;
      if (s.aHeld && (s.charge > rnd(0.3, 0.8) || dist < 140)) {
        s.aHeld = false;
        s.dashReq = Math.min(1, s.charge / CHARGE_TIME);
        s.charge = 0;
      }
    }
    const l = Math.hypot(tx, ty) || 1;
    s.inp = { x: tx / l, y: ty / l };
    s.anchor = d > R - 70 && Math.random() < 0.5;
  }

  function step(dt: number) {
    time += dt;
    const R = radius();
    // Bonus sur l'arène
    nextPickup -= dt;
    if (!pickup && nextPickup <= 0) {
      const a = rnd(0, Math.PI * 2);
      const r = rnd(0, R * 0.55);
      pickup = { x: Math.cos(a) * r, y: Math.sin(a) * r, kind: (['piment', 'bouclier', 'geant'] as Bonus[])[Math.floor(Math.random() * 3)], t: 10 };
      nextPickup = rnd(8, 12);
    }
    if (pickup && (pickup.t -= dt) <= 0) pickup = null;

    ss.forEach((s, i) => {
      if (s.lives <= 0) return;
      if (s.respawn > 0) {
        s.respawn -= dt;
        if (s.respawn <= 0) {
          const a = rnd(0, Math.PI * 2);
          s.x = Math.cos(a) * 60;
          s.y = Math.sin(a) * 60;
          s.vx = s.vy = 0;
          s.invuln = 1.6;
        }
        return;
      }
      if (s.falling > 0) {
        s.falling -= dt;
        if (s.falling <= 0) {
          s.lives--;
          if (s.lastHit && time - s.lastHit.at < 4) ss[s.lastHit.by].kos++;
          s.lastHit = null;
          if (s.lives <= 0) s.out = ++outCount;
          else s.respawn = 1.6;
        }
        return;
      }
      if (s.bot) bot(s, i, dt);
      s.invuln = Math.max(0, s.invuln - dt);
      s.dashCd = Math.max(0, s.dashCd - dt);
      s.heavy = Math.max(0, s.heavy - dt);
      if (s.bonus && (s.bonusT -= dt) <= 0) s.bonus = null;
      // Charge du turbo (A maintenu)
      if (s.aHeld && s.dashCd <= 0 && !s.anchor) s.charge = Math.min(CHARGE_TIME * 1.2, s.charge + dt);
      const il = Math.hypot(s.inp.x, s.inp.y);
      const ix = il > 0.2 ? s.inp.x / Math.max(1, il) : 0;
      const iy = il > 0.2 ? s.inp.y / Math.max(1, il) : 0;
      if (ix) s.face = ix > 0 ? 1 : -1;
      const slow = s.aHeld && s.charge > 0.1 ? 0.35 : 1;
      if (!s.anchor) {
        s.vx += ix * ACC * map.acc * slow * dt;
        s.vy += iy * ACC * map.acc * slow * dt;
      }
      if (s.dashReq > 0 && s.dashCd <= 0 && !s.anchor) {
        const power = DASH_MIN + (DASH_MAX - DASH_MIN) * s.dashReq;
        const dl = Math.hypot(ix, iy) > 0.1 ? Math.hypot(ix, iy) : 0;
        const dx = dl ? ix / dl : s.face;
        const dy = dl ? iy / dl : 0;
        s.vx += dx * power;
        s.vy += dy * power;
        s.dashCd = DASH_CD;
        s.heavy = 0.25 + s.dashReq * 0.3;
        const [px, py] = scr(s.x, s.y);
        if (s.dashReq > 0.6) {
          burst(px, py, 6, 'smoke', '#ffffff', 200, 18);
          shake = Math.max(shake, 5);
        }
        sfx.step();
      }
      s.dashReq = 0;
      const sp = Math.hypot(s.vx, s.vy);
      const max = s.heavy > 0 ? MAX_V + DASH_MAX : MAX_V;
      if (sp > max) {
        s.vx *= max / sp;
        s.vy *= max / sp;
      }
      // Traînée de vitesse
      if (sp > 750 && !ctx.light && Math.random() < 0.6) {
        const [px, py] = scr(s.x, s.y);
        parts.push({ x: px, y: py, vx: 0, vy: 0, t: 0, max: 0.35, size: 26, color: s.profile.color, kind: 'smoke' });
      }
      const damp = Math.pow(s.anchor ? 0.02 : map.grip, dt);
      s.vx *= damp;
      s.vy *= damp;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // Ramasser le bonus
      if (pickup && Math.hypot(pickup.x - s.x, pickup.y - s.y) < bodyR(s) + 40) {
        s.bonus = pickup.kind;
        s.bonusT = pickup.kind === 'bouclier' ? 5 : 7;
        const [px, py] = scr(s.x, s.y);
        pop(px, py - 140, `${BONUS_ICON[pickup.kind]} ${fr ? { piment: 'PIMENT !', bouclier: 'BOUCLIER !', geant: 'GÉANT !' }[pickup.kind] : { piment: 'SPICY!', bouclier: 'SHIELD!', geant: 'GIANT!' }[pickup.kind]}`, SOLEIL, 44);
        burst(px, py - 40, 10, 'star', SOLEIL, 320, 12);
        sfx.join();
        if (!s.bot) ctx.buzz(s.pid, 100);
        pickup = null;
      }
      if (Math.hypot(s.x, s.y) > R + bodyR(s) * 0.3) {
        s.falling = 0.75;
        s.bonus = null;
        const [px, py] = scr(s.x, s.y);
        burst(px, py + 20, 16, 'drop', '#ffe066', 520, 14, 380);
        parts.push({ x: px, y: py + 20, vx: 0, vy: 0, t: 0, max: 0.5, size: 110, color: '#fff', kind: 'ring' });
        pop(px, py - 80, ctx.family ? (fr ? 'Oups !' : 'Oops!') : fr ? 'PLOUF !' : 'SPLASH!', s.profile.color, 58);
        shake = Math.max(shake, 12);
        sfx.pet();
        if (!s.bot) ctx.buzz(s.pid, 400);
      }
    });

    // Champignons / bougies : ils renvoient fort
    for (const s of ss) {
      if (!inPlay(s)) continue;
      for (const [bx, by] of map.bumpers) {
        const dx = s.x - bx;
        const dy = s.y - by;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < BUMPER_R + bodyR(s)) {
          const nx = dx / d;
          const ny = dy / d;
          s.x = bx + nx * (BUMPER_R + bodyR(s));
          s.y = by + ny * (BUMPER_R + bodyR(s));
          s.vx = nx * 820;
          s.vy = ny * 820;
          const [px, py] = scr(bx + nx * BUMPER_R, by + ny * BUMPER_R);
          burst(px, py, 5, 'star', '#fff', 260, 9);
          sfx.boing();
          if (!s.bot) ctx.buzz(s.pid, 60);
        }
      }
    }

    // Chocs entre bouées
    for (let i = 0; i < ss.length; i++)
      for (let j = i + 1; j < ss.length; j++) {
        const a = ss[i];
        const b = ss[j];
        if (!inPlay(a) || !inPlay(b)) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const rr = bodyR(a) + bodyR(b);
        if (d >= rr || d === 0) continue;
        dx /= d;
        dy /= d;
        const ma = mass(a);
        const mb = mass(b);
        const over = rr - d;
        a.x -= dx * over * (mb / (ma + mb));
        a.y -= dy * over * (mb / (ma + mb));
        b.x += dx * over * (ma / (ma + mb));
        b.y += dy * over * (ma / (ma + mb));
        const rel = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
        if (rel >= 0) continue;
        // Le piment double la poussée de celui qui l'a
        const spiceA = a.bonus === 'piment' ? 1.9 : 1;
        const spiceB = b.bonus === 'piment' ? 1.9 : 1;
        const j2 = (-(1 + 1.1) * rel) / (1 / ma + 1 / mb) + 90;
        if (a.invuln <= 0) {
          a.vx -= ((j2 * spiceB) / ma) * dx;
          a.vy -= ((j2 * spiceB) / ma) * dy;
        }
        if (b.invuln <= 0) {
          b.vx += ((j2 * spiceA) / mb) * dx;
          b.vy += ((j2 * spiceA) / mb) * dy;
        }
        a.lastHit = { by: j, at: time };
        b.lastHit = { by: i, at: time };
        const force = -rel;
        if (force > 250) {
          const [px, py] = scr((a.x + b.x) / 2, (a.y + b.y) / 2);
          const big = force > 850 || a.bonus === 'piment' || b.bonus === 'piment';
          burst(px, py - 30, big ? 12 : 5, 'star', big ? '#fff' : SOLEIL, big ? 560 : 320, big ? 14 : 10);
          parts.push({ x: px, y: py - 30, vx: 0, vy: 0, t: 0, max: 0.3, size: big ? 110 : 60, color: '#fff', kind: 'ring' });
          if (big) {
            freeze = 0.08;
            shake = Math.max(shake, 18);
            pop(px, py - 120, fr ? 'BOING !' : 'BOING!', ROSE, 54);
          }
          sfx.boing();
          if (!a.bot) ctx.buzz(a.pid, big ? 180 : 60);
          if (!b.bot) ctx.buzz(b.pid, big ? 180 : 60);
        }
      }
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const s = ss.find((x) => x.pid === pid);
      if (!s) return;
      // A maintenu = charge ; relâché = turbo proportionnel à la charge (un simple appui = petit turbo).
      if (m.a && !s.lastA) {
        s.aHeld = true;
        s.charge = 0;
      }
      if (!m.a && s.lastA) {
        s.aHeld = false;
        s.dashReq = Math.max(0.05, Math.min(1, s.charge / CHARGE_TIME));
        s.charge = 0;
      }
      s.lastA = m.a;
      s.anchor = m.b;
      s.inp = { x: m.x, y: m.y };
    },
    update(dt) {
      shake = Math.max(0, shake - dt * 50);
      for (const q of parts) {
        q.t += dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= Math.pow(0.25, dt);
        q.vy = q.vy * Math.pow(0.25, dt) + (q.kind === 'drop' ? 1200 * dt : 0);
      }
      for (let k = parts.length - 1; k >= 0; k--) if (parts[k].t >= parts[k].max) parts.splice(k, 1);
      for (const q of pops) {
        q.t -= dt;
        q.y -= 50 * dt;
      }
      while (pops.length && pops[0].t <= 0) pops.shift();
      if (freeze > 0) {
        freeze -= dt;
        return;
      }
      step(dt);
      const left = sidesLeft(ss.filter((s) => s.lives > 0));
      if (endDelay < 0 && (left <= 1 || time > MAX_TIME)) endDelay = 2;
      if (endDelay >= 0 && (endDelay -= dt) <= 0) game.over = true;
    },
    render(g, t) {
      g.save();
      if (shake) g.translate(rnd(-shake, shake), rnd(-shake, shake));
      // Piscine de limonade
      g.fillStyle = '#fff3a0';
      g.fillRect(-40, -40, 2000, 1160);
      if (!ctx.light) {
        g.strokeStyle = 'rgba(255,200,60,0.5)';
        g.lineWidth = 6;
        for (let k = 0; k < 9; k++) {
          const y = 80 + k * 120 + Math.sin(t + k) * 10;
          g.beginPath();
          for (let x = 0; x <= 1920; x += 40) g.lineTo(x, y + Math.sin(x / 90 + t * 2 + k) * 10);
          g.stroke();
        }
        // Glaçons et rondelles de citron qui flottent
        for (let k = 0; k < 8; k++) {
          const x = ((k * 263 + t * 18 * (k % 2 ? 1 : -1)) % 2100 + 2100) % 2100 - 90;
          const y = k % 2 ? 90 + (k * 37) % 120 : 960 + (k * 29) % 90;
          g.save();
          g.translate(x, y);
          g.rotate(Math.sin(t + k) * 0.3);
          g.strokeStyle = INK;
          g.lineWidth = 4;
          if (k % 3 === 0) {
            g.fillStyle = 'rgba(255,255,255,0.85)';
            g.beginPath();
            g.roundRect(-30, -30, 60, 60, 12);
            g.fill();
            g.stroke();
          } else {
            g.fillStyle = '#ffe066';
            g.beginPath();
            g.arc(0, 0, 34, 0, Math.PI * 2);
            g.fill();
            g.stroke();
            g.strokeStyle = '#fff6c2';
            g.lineWidth = 3;
            for (let r = 0; r < 6; r++) {
              g.beginPath();
              g.moveTo(0, 0);
              g.lineTo(Math.cos((r * Math.PI) / 3) * 26, Math.sin((r * Math.PI) / 3) * 26);
              g.stroke();
            }
          }
          g.restore();
        }
      }
      // Arène
      const R = radius();
      g.fillStyle = INK;
      g.beginPath();
      g.ellipse(CX, CY + 34, R * SX + 22, R * SY + 22, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = map.under;
      g.beginPath();
      g.ellipse(CX, CY + 24, R * SX + 18, R * SY + 18, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = map.rim;
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(CX, CY, R * SX + 14, R * SY + 10, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = map.plate;
      g.beginPath();
      g.ellipse(CX, CY, R * SX - 10, R * SY - 8, 0, 0, Math.PI * 2);
      g.fill();
      if (map.id === 'pizza') {
        g.fillStyle = '#e8453c';
        for (let k = 0; k < 9; k++) {
          const a = k * 2.3;
          const r = (0.3 + (k % 3) * 0.2) * R;
          g.beginPath();
          g.ellipse(CX + Math.cos(a) * r * SX, CY + Math.sin(a) * r * SY, 26, 18, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (map.id === 'glace') {
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 5;
        for (let k = 0; k < 6; k++) {
          g.beginPath();
          g.arc(CX + (k - 2.5) * 120, CY + Math.sin(k) * 60, 80 + k * 6, 0.3, 1.4);
          g.stroke();
        }
      }
      g.strokeStyle = 'rgba(255,79,154,0.3)';
      g.lineWidth = 4;
      g.setLineDash([18, 14]);
      g.beginPath();
      g.ellipse(CX, CY, R * SX * 0.55, R * SY * 0.55, 0, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      for (const [bx, by] of map.bumpers) {
        const [px, py] = scr(bx, by);
        g.fillStyle = INK;
        g.beginPath();
        g.ellipse(px, py + 10, BUMPER_R * SX, BUMPER_R * SY, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = map.id === 'gateau' ? ['#2ec5ff', '#ffd60a', '#1fc9a0'][Math.abs(Math.round(bx + by)) % 3] : '#3a3a46';
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.ellipse(px, py, BUMPER_R * SX, BUMPER_R * SY, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = map.id === 'gateau' ? (Math.sin(t * 12 + bx) > 0 ? '#ff9a1f' : '#ffd60a') : '#7bd13b';
        g.beginPath();
        g.ellipse(px, py, BUMPER_R * SX * 0.4, BUMPER_R * SY * 0.4, 0, 0, Math.PI * 2);
        g.fill();
      }
      // Bonus à ramasser
      if (pickup) {
        const [px, py] = scr(pickup.x, pickup.y);
        const bob = Math.sin(t * 4) * 8;
        g.globalAlpha = pickup.t < 2 && Math.floor(t * 10) % 2 ? 0.4 : 1;
        g.fillStyle = 'rgba(58,33,64,0.2)';
        g.beginPath();
        g.ellipse(px, py + 20, 40, 12, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.arc(px, py - 30 + bob, 40, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.font = '46px sans-serif';
        g.textAlign = 'center';
        g.fillText(BONUS_ICON[pickup.kind], px, py - 14 + bob);
        g.globalAlpha = 1;
      }

      const order = ss.map((s, i) => i).sort((a, b) => ss[a].y - ss[b].y);
      for (const i of order) {
        const s = ss[i];
        if (s.lives <= 0 || s.respawn > 0) continue;
        const [px, py] = scr(s.x, s.y);
        const k = s.falling > 0 ? s.falling / 0.75 : 1;
        const big = s.bonus === 'geant' ? 1.4 : 1;
        if (s.invuln > 0 && Math.floor(t * 10) % 2) g.globalAlpha = 0.5;
        g.save();
        g.translate(px, py + (1 - k) * 70);
        g.scale(k * big, k * big);
        // Ombre
        g.fillStyle = 'rgba(58,33,64,0.18)';
        g.beginPath();
        g.ellipse(0, 18, BODY * SX + 6, BODY * SY + 4, 0, 0, Math.PI * 2);
        g.fill();
        // Bouée en volume
        g.fillStyle = s.profile.color;
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.ellipse(0, 6, BODY * SX, BODY * SY + 8, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = 'rgba(58,33,64,0.15)';
        g.beginPath();
        g.ellipse(0, 16, BODY * SX * 0.92, BODY * SY * 0.75, 0, 0, Math.PI);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.beginPath();
        g.ellipse(-22, -10, 18, 6, -0.3, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#fff';
        g.lineWidth = 6;
        for (const a of [0.6, 2.2, 3.8, 5.3]) {
          g.beginPath();
          g.ellipse(0, 6, BODY * SX, BODY * SY + 8, 0, a, a + 0.25);
          g.stroke();
        }
        // Jauge de charge du turbo
        if (s.aHeld && s.charge > 0.05) {
          const c = Math.min(1, s.charge / CHARGE_TIME);
          g.strokeStyle = c >= 1 ? '#ff3b3b' : SOLEIL;
          g.lineWidth = 10;
          g.beginPath();
          g.ellipse(0, 6, BODY * SX + 16, BODY * SY + 22, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c);
          g.stroke();
        }
        if (s.bonus === 'bouclier') {
          g.strokeStyle = 'rgba(46,197,255,0.85)';
          g.lineWidth = 8;
          g.beginPath();
          g.ellipse(0, -30, BODY * SX + 18, 90, 0, 0, Math.PI * 2);
          g.stroke();
        }
        if (s.anchor) {
          g.font = '40px sans-serif';
          g.textAlign = 'center';
          g.fillText('⚓', 52, 34);
        }
        drawCharacter(g, 0, 10, 100, {
          food: s.profile.food,
          color: s.profile.color,
          hat: s.profile.hat,
          acc: s.profile.acc,
          selfie: s.selfie,
          t: t + i,
          dir: s.face,
          mood: s.falling > 0 ? 'wow' : s.bonus === 'piment' ? 'win' : s.heavy > 0 ? 'wow' : 'happy',
        });
        if (s.bonus === 'piment' && !ctx.light) {
          g.font = '30px sans-serif';
          g.textAlign = 'center';
          g.fillText('🔥', -30 + Math.sin(t * 20) * 4, -98);
          g.fillText('🔥', 30 + Math.cos(t * 20) * 4, -98);
        }
        g.restore();
        g.globalAlpha = 1;
        if (s.falling <= 0) {
          g.font = '700 28px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.lineWidth = 6;
          g.strokeStyle = INK;
          g.strokeText(s.profile.name, px, py - 120 * big);
          g.fillStyle = s.team !== undefined ? TEAMS[s.team].color : s.profile.color;
          g.fillText(s.profile.name, px, py - 120 * big);
        }
      }

      // Particules
      for (const q of parts) {
        const k = q.t / q.max;
        g.globalAlpha = 1 - k;
        g.fillStyle = q.color;
        if (q.kind === 'ring') {
          g.strokeStyle = q.color;
          g.lineWidth = 8 * (1 - k) + 2;
          g.beginPath();
          g.ellipse(q.x, q.y, q.size * (0.3 + k), q.size * (0.3 + k) * 0.6, 0, 0, Math.PI * 2);
          g.stroke();
        } else if (q.kind === 'star') {
          g.save();
          g.translate(q.x, q.y);
          g.rotate(q.t * 8);
          g.beginPath();
          for (let s = 0; s < 10; s++) {
            const r = s % 2 ? q.size * 0.45 : q.size;
            g.lineTo(Math.cos((s * Math.PI) / 5) * r, Math.sin((s * Math.PI) / 5) * r);
          }
          g.fill();
          g.strokeStyle = INK;
          g.lineWidth = 2;
          g.stroke();
          g.restore();
        } else {
          g.beginPath();
          g.arc(q.x, q.y, q.size * (q.kind === 'smoke' ? 0.6 + k : 1 - k * 0.4), 0, Math.PI * 2);
          g.fill();
          if (q.kind === 'drop') {
            g.strokeStyle = INK;
            g.lineWidth = 2;
            g.stroke();
          }
        }
      }
      g.globalAlpha = 1;
      for (const q of pops) {
        g.globalAlpha = Math.min(1, q.t * 2);
        g.font = `700 ${q.size}px Fredoka, sans-serif`;
        g.textAlign = 'center';
        g.lineWidth = q.size * 0.24;
        g.strokeStyle = INK;
        g.strokeText(q.text, q.x, q.y);
        g.fillStyle = q.color;
        g.fillText(q.text, q.x, q.y);
      }
      g.globalAlpha = 1;
      g.restore();

      // Cartes des joueurs (portrait, vies, bonus)
      const w = Math.min(220, 1840 / ss.length);
      const x0 = 960 - (w * ss.length) / 2;
      ss.forEach((s, i) => {
        const x = x0 + i * w;
        g.globalAlpha = s.lives > 0 ? 1 : 0.45;
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(x + 6, 20, w - 12, 92, 22);
        g.fill();
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.roundRect(x + 6, 12, w - 12, 92, 22);
        g.fill();
        g.stroke();
        drawCharacter(g, x + 44, 100, 56, {
          food: s.profile.food,
          color: s.profile.color,
          hat: s.profile.hat,
          acc: s.profile.acc,
          selfie: s.selfie,
          t,
          mood: s.lives <= 0 ? 'sad' : s.falling > 0 ? 'wow' : 'happy',
        });
        roundRectText(g, s.profile.name, x + 76, 40, w - 92, 22, s.team !== undefined ? TEAMS[s.team].color : s.profile.color);
        for (let k = 0; k < LIVES; k++) {
          g.fillStyle = k < s.lives ? '#ff3b6b' : '#eee3f3';
          g.strokeStyle = INK;
          g.lineWidth = 3;
          const cx = x + 96 + k * 30;
          g.beginPath();
          g.moveTo(cx, 92);
          g.bezierCurveTo(cx - 16, 82, cx - 10, 66, cx, 74);
          g.bezierCurveTo(cx + 10, 66, cx + 16, 82, cx, 92);
          g.fill();
          g.stroke();
        }
        if (s.bonus) {
          g.font = '28px sans-serif';
          g.textAlign = 'center';
          g.fillText(BONUS_ICON[s.bonus], x + w - 30, 92);
        }
        g.globalAlpha = 1;
      });
      if (map.shrink) {
        g.fillStyle = INK;
        g.font = '700 34px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 8;
        g.strokeStyle = '#fff';
        const msg = fr ? 'L’arène rétrécit !' : 'The arena is shrinking!';
        g.strokeText(msg, CX, 1056);
        g.fillText(msg, CX, 1056);
      }
    },
    mapName: map.name,
    ranking() {
      return ss
        .map((s, i) => ({ s, i }))
        .sort((a, b) => b.s.lives - a.s.lives || (b.s.out || 99) - (a.s.out || 99) || b.s.kos - a.s.kos)
        .map((x) => x.s.pid);
    },
    leader() {
      const left = ss.filter((s) => s.lives > 0);
      return left.length && sidesLeft(left) === 1 ? winnerName(left[0], ctx.lang) : null;
    },
  };
  return game;
}

export const sumo: GameBase = {
  id: 'sumo',
  emoji: '🛞',
  name: { fr: 'Sumo Tamponneur', en: 'Bumper Sumo' },
  how: {
    fr: 'Stick pour rouler · A turbo (maintiens pour charger) · B ancre. Pousse-les dans la limonade !',
    en: 'Stick to roll · A boost (hold to charge) · B anchor. Push them into the lemonade!',
  },
  inspired: 'auto-tamponneuses',
  layout: 'stick',
  min: 2,
  max: 12,
  botFill: 4,
  music: 'race',
  create,
};import { TEAMS, allies, sidesLeft, winnerName } from './teams';

