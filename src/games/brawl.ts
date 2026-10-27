// Bagarre Molle : persos tout mous qui se baffent, s'attrapent et se jettent dans la mer de crème.
// A = saut · B court = baffe · B maintenu = attraper, relâcher = jeter (direction du stick). Trop de baffes = sonné.
import { drawCharacter } from '../shared/characters';
import { sfx } from '../shared/sound';
import { drawSky, roundRectText } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const GRAV = 2200;
const RUN = 330;
const JUMP = 820;
const HW = 24;
const MAX_TIME = 150;
type Plat = { x: number; y: number; w: number };
/** Cartes : chaque bagarre en tire une au hasard. */
const MAPS: { name: { fr: string; en: string }; plats: Plat[]; sky: [string, string]; sea: string; plat: string }[] = [
  { name: { fr: 'Les Nénuphars', en: 'The Lily Pads' }, sky: ['#ffc6a8', '#ffe9f3'], sea: '#fff6e0', plat: '#7bd13b', plats: [
  { x: 360, y: 760, w: 1200 },
  { x: 110, y: 560, w: 270 },
  { x: 1540, y: 560, w: 270 },
  { x: 780, y: 470, w: 360 },
] },
  {
    name: { fr: 'Le Pont', en: 'The Bridge' },
    sky: ['#9fe3ff', '#e3f2ff'],
    sea: '#e9f9ff',
    plat: '#c98a5a',
    plats: [
      { x: 240, y: 760, w: 560 },
      { x: 900, y: 760, w: 120 },
      { x: 1120, y: 760, w: 560 },
      { x: 700, y: 560, w: 520 },
    ],
  },
  {
    name: { fr: 'La Pile de Crêpes', en: 'The Pancake Stack' },
    sky: ['#ffe08a', '#ffe9f3'],
    sea: '#fff2d6',
    plat: '#f0b45a',
    plats: [
      { x: 460, y: 800, w: 1000 },
      { x: 620, y: 620, w: 680 },
      { x: 800, y: 440, w: 320 },
    ],
  },
];
MAPS.push({
  name: { fr: 'Les Tabourets', en: 'The Stools' },
  sky: ['#ffd6ea', '#e3f2ff'],
  sea: '#e9fbf4',
  plat: '#9b72ff',
  plats: [
    { x: 260, y: 760, w: 300 },
    { x: 700, y: 820, w: 240 },
    { x: 1060, y: 820, w: 240 },
    { x: 1440, y: 760, w: 300 },
    { x: 780, y: 560, w: 360 },
  ],
});
// Carte de la bagarre en cours (une seule à la fois).
let PLATS: Plat[] = MAPS[0].plats;

interface B extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  dir: 1 | -1;
  tilt: number;
  tiltV: number;
  dizzy: number;
  ko: number;
  alive: boolean;
  out: number;
  holding: number;
  heldBy: number;
  grip: number;
  bDown: number;
  punchT: number;
  punchHit: boolean;
  inp: { x: number; y: number };
  jumpReq: boolean;
  bHeld: boolean;
  lastA: boolean;
  lastB: boolean;
  kos: number;
  lastHitBy: number;
  botCd: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const map = MAPS[Math.floor(Math.random() * MAPS.length)];
  PLATS = map.plats;
  const spawnPlat = (i: number) => PLATS[i % PLATS.length];
  const fr = ctx.lang === 'fr';
  const n = runners.length;
  const bs: B[] = runners.slice(0, 8).map((r, i) => ({
    ...r,
    x: spawnPlat(i).x + 40 + ((i * 137) % Math.max(1, spawnPlat(i).w - 80)),
    y: spawnPlat(i).y,
    vx: 0,
    vy: 0,
    onGround: true,
    dir: i < n / 2 ? 1 : -1,
    tilt: 0,
    tiltV: 0,
    dizzy: 0,
    ko: 0,
    alive: true,
    out: 0,
    holding: -1,
    heldBy: -1,
    grip: 0,
    bDown: 0,
    punchT: 0,
    punchHit: false,
    inp: { x: 0, y: 0 },
    jumpReq: false,
    bHeld: false,
    lastA: false,
    lastB: false,
    kos: 0,
    lastHitBy: -1,
    botCd: rnd(0.3, 0.8),
  }));
  let time = 0;
  let outCount = 0;
  let endDelay = -1;

  function nearest(i: number, range: number) {
    const b = bs[i];
    let best = -1;
    let bd = range;
    bs.forEach((o, j) => {
      if (j === i || !o.alive || o.heldBy >= 0) return;
      const d = Math.hypot(o.x - b.x, (o.y - b.y) * 1.5);
      if (d < bd && Math.sign(o.x - b.x || b.dir) === b.dir) {
        bd = d;
        best = j;
      }
    });
    return best;
  }

  function punch(i: number) {
    const b = bs[i];
    if (b.punchT > 0 || b.ko > 0 || b.holding >= 0) return;
    b.punchT = 0.3;
    b.punchHit = false;
  }

  function release(i: number, throwIt: boolean) {
    const b = bs[i];
    if (b.holding < 0) return;
    const o = bs[b.holding];
    o.heldBy = -1;
    if (throwIt) {
      const dx = Math.abs(b.inp.x) > 0.3 ? Math.sign(b.inp.x) : b.dir;
      const up = b.inp.y < -0.4 ? 1.3 : 1;
      o.vx = dx * 900;
      o.vy = -520 * up;
      o.tiltV += dx * 14;
      o.lastHitBy = i;
      sfx.boing();
      if (!o.bot) ctx.buzz(o.pid, 200);
    }
    b.holding = -1;
  }

  function grab(i: number) {
    const b = bs[i];
    if (b.holding >= 0 || b.ko > 0 || b.heldBy >= 0) return;
    const j = nearest(i, 95);
    if (j < 0) return;
    const o = bs[j];
    if (o.holding >= 0) release(j, false);
    b.holding = j;
    o.heldBy = i;
    o.grip = o.ko > 0 ? 8 : 4;
    sfx.click();
  }

  function bot(b: B, i: number, dt: number) {
    b.botCd -= dt;
    b.inp = { x: 0, y: 0 };
    if (b.heldBy >= 0) {
      if (Math.random() < 0.12) b.grip -= 1;
      return;
    }
    const plat = PLATS.find((p) => b.x > p.x - 10 && b.x < p.x + p.w + 10 && Math.abs(b.y - p.y) < 6);
    if (b.holding >= 0) {
      // Porter la victime vers le bord le plus proche puis la jeter.
      const p = plat ?? PLATS[0];
      const toLeft = b.x - p.x < p.x + p.w - b.x;
      b.inp.x = toLeft ? -1 : 1;
      if ((toLeft && b.x < p.x + 80) || (!toLeft && b.x > p.x + p.w - 80)) b.bHeld = false;
      else b.bHeld = true;
      return;
    }
    let best = -1;
    let bd = 1e9;
    bs.forEach((o, j) => {
      if (j === i || !o.alive || o.heldBy >= 0) return;
      const d = Math.hypot(o.x - b.x, o.y - b.y) - (o.ko > 0 ? 300 : 0);
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    if (best < 0) return;
    const o = bs[best];
    const dx = o.x - b.x;
    if (Math.abs(dx) > 60) b.inp.x = Math.sign(dx);
    b.dir = dx >= 0 ? 1 : -1;
    if (plat && ((b.x < plat.x + 40 && b.inp.x < 0) || (b.x > plat.x + plat.w - 40 && b.inp.x > 0))) {
      if (o.y < b.y - 60) b.jumpReq = true;
      else b.inp.x = 0;
    }
    if (o.y < b.y - 120 && b.onGround && Math.random() < 0.03) b.jumpReq = true;
    if (b.botCd <= 0 && Math.abs(dx) < 100 && Math.abs(o.y - b.y) < 60) {
      b.botCd = rnd(0.3, 0.8);
      if (o.ko > 0 || o.dizzy > 2.2 || Math.random() < 0.15) {
        b.bHeld = true;
        grab(i);
      } else punch(i);
    }
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const i = bs.findIndex((x) => x.pid === pid);
      const b = bs[i];
      if (!b) return;
      if (m.a && !b.lastA) {
        b.jumpReq = true;
        if (b.heldBy >= 0) b.grip -= 1;
      }
      if (m.b && !b.lastB) {
        b.bDown = 0;
        if (b.heldBy >= 0) b.grip -= 1;
      }
      if (!m.b && b.lastB) {
        if (b.holding >= 0) release(i, true);
        else if (b.bDown < 0.22) punch(i);
      }
      b.bHeld = m.b;
      b.lastA = m.a;
      b.lastB = m.b;
      b.inp = { x: m.x, y: m.y };
    },
    update(dt) {
      time += dt;
      bs.forEach((b, i) => {
        if (!b.alive) return;
        if (b.bot) {
          const wasHolding = b.holding >= 0;
          bot(b, i, dt);
          if (wasHolding && !b.bHeld) release(i, true);
        }
        b.dizzy = Math.max(0, b.dizzy - dt * 0.5);
        b.ko = Math.max(0, b.ko - dt);
        b.punchT = Math.max(0, b.punchT - dt);
        if (b.bHeld) {
          b.bDown += dt;
          if (b.bDown > 0.22 && b.holding < 0 && b.heldBy < 0) grab(i);
        }
        // Se libérer en martelant
        if (b.heldBy >= 0 && b.grip <= 0 && b.ko <= 0) {
          const h = bs[b.heldBy];
          h.holding = -1;
          b.heldBy = -1;
          b.vy = -500;
          b.vx = -h.dir * 300;
        }
        if (b.heldBy >= 0) {
          const h = bs[b.heldBy];
          b.x = h.x + h.dir * 46;
          b.y = h.y - 56;
          b.vx = h.vx;
          b.vy = 0;
          b.tilt = h.dir * 1.3;
          return;
        }
        const control = b.ko <= 0;
        const mx = control && Math.abs(b.inp.x) > 0.25 ? Math.sign(b.inp.x) : 0;
        if (mx && b.holding < 0) b.dir = mx as 1 | -1;
        if (mx && b.holding >= 0) b.dir = mx as 1 | -1;
        const speed = RUN * (b.holding >= 0 ? 0.6 : 1) * (b.dizzy > 2 ? 0.6 : 1);
        const acc = (b.onGround ? 2600 : 1400) * dt;
        if (control) b.vx += Math.max(-acc, Math.min(acc, mx * speed - b.vx));
        else b.vx *= Math.pow(0.2, dt);
        if (b.jumpReq && control && b.onGround) {
          b.vy = -JUMP;
          b.onGround = false;
          b.tiltV -= b.dir * 3;
        }
        b.jumpReq = false;
        b.vy = Math.min(b.vy + GRAV * dt, 1500);
        const prevY = b.y;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.onGround = false;
        for (const p of PLATS)
          if (b.x + HW > p.x && b.x - HW < p.x + p.w && b.vy >= 0 && prevY <= p.y + 4 && b.y >= p.y) {
            b.y = p.y;
            b.vy = 0;
            b.onGround = true;
          }
        // Le corps mou se balance : ressort vers la verticale (couché si sonné)
        const rest = b.ko > 0 ? b.dir * -1.45 : 0;
        b.tiltV += (-(b.tilt - rest) * 60 - b.tiltV * 6 + b.vx * 0.015 * (b.onGround ? 1 : 0.3)) * dt;
        b.tilt += b.tiltV * dt;
        // Baffe
        if (b.punchT > 0 && b.punchT < 0.2 && !b.punchHit) {
          const j = nearest(i, 90);
          if (j >= 0) {
            const o = bs[j];
            b.punchHit = true;
            o.vx += b.dir * 380;
            o.vy -= 160;
            o.tiltV += b.dir * 10;
            o.dizzy += 1;
            o.lastHitBy = i;
            if (o.dizzy >= 4 && o.ko <= 0) {
              o.ko = 3;
              o.dizzy = 0;
              sfx.pet();
            } else sfx.pop();
            if (!o.bot) ctx.buzz(o.pid, 80);
          }
        }
        if (b.y > 1250 || b.x < -250 || b.x > 2170) {
          b.alive = false;
          b.out = ++outCount;
          if (b.holding >= 0) release(i, false);
          if (b.lastHitBy >= 0) bs[b.lastHitBy].kos++;
          sfx.boing();
          if (!b.bot) ctx.buzz(b.pid, 500);
        }
      });
      const left = bs.filter((b) => b.alive).length;
      if (endDelay < 0 && (left <= 1 || time > MAX_TIME)) endDelay = 2;
      if (endDelay >= 0 && (endDelay -= dt) <= 0) game.over = true;
    },
    render(g, t) {
      drawSky(g, t, ctx.light, map.sky[0], map.sky[1]);
      // Mer de crème
      g.fillStyle = map.sea;
      g.beginPath();
      g.moveTo(0, 1080);
      for (let x = 0; x <= 1920; x += 40) g.lineTo(x, 960 + Math.sin(x / 120 + t * 1.5) * 16);
      g.lineTo(1920, 1080);
      g.fill();
      g.strokeStyle = '#f0d9a8';
      g.lineWidth = 6;
      g.stroke();
      g.strokeStyle = INK;
      g.lineWidth = 5;
      for (const p of PLATS) {
        const wob = Math.sin(t * 2 + p.x) * 3;
        g.fillStyle = map.plat;
        g.beginPath();
        g.roundRect(p.x, p.y + wob, p.w, 46, 22);
        g.fill();
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.fillRect(p.x + 20, p.y + 8 + wob, p.w - 40, 6);
      }
      bs.forEach((b, i) => {
        if (!b.alive) return;
        // Bras en spaghetti
        const sx = b.x;
        const sy = b.y - 50;
        g.strokeStyle = b.profile.color;
        g.lineWidth = 9;
        g.lineCap = 'round';
        const reach = b.punchT > 0.1 ? 70 : b.holding >= 0 ? 50 : 26;
        for (const side of [-1, 1]) {
          const fx = sx + b.dir * reach + side * 6;
          const fy = sy + (b.holding >= 0 ? -10 : 10 + side * 6) + Math.sin(t * 8 + side) * 3;
          g.beginPath();
          g.moveTo(sx + side * 14, sy);
          g.quadraticCurveTo(sx + b.dir * reach * 0.5, sy + 30, fx, fy);
          g.stroke();
          g.fillStyle = '#fff';
          g.beginPath();
          g.arc(fx, fy, 9, 0, Math.PI * 2);
          g.fill();
        }
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.tilt * 0.6);
        g.scale(1 + Math.sin(t * 9 + i) * 0.03, 1 - Math.sin(t * 9 + i) * 0.03);
        drawCharacter(g, 0, 0, 96, {
          food: b.profile.food,
          color: b.profile.color,
          hat: b.profile.hat,
          acc: b.profile.acc,
          selfie: b.selfie,
          t: t + i,
          dir: b.dir,
          run: b.onGround ? Math.min(1, Math.abs(b.vx) / RUN) : 0.2,
          mood: b.ko > 0 ? 'sad' : b.heldBy >= 0 ? 'wow' : 'happy',
        });
        g.restore();
        if (b.ko > 0 || b.dizzy > 2) {
          g.font = '28px sans-serif';
          g.textAlign = 'center';
          g.fillText(b.ko > 0 ? '💫💫' : '💫', b.x, b.y - 118);
        }
        g.font = '700 28px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 5;
        g.strokeStyle = INK;
        g.strokeText(b.profile.name, b.x, b.y - 140);
        g.fillStyle = b.profile.color;
        g.fillText(b.profile.name, b.x, b.y - 140);
      });
      const w = Math.min(220, 1700 / bs.length);
      bs.forEach((b, i) => {
        g.globalAlpha = b.alive ? 1 : 0.35;
        roundRectText(g, b.alive ? b.profile.name : `💦 ${b.profile.name}`, 110 + i * w, 50, w - 12, 26, b.profile.color);
        g.globalAlpha = 1;
      });
      g.fillStyle = INK;
      g.font = '600 28px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillText(fr ? 'B court : baffe · B maintenu : attraper, relâcher : jeter' : 'Tap B: slap · Hold B: grab, release: throw', 960, 1060);
    },
    mapName: map.name,
    ranking() {
      return [...bs].sort((a, b) => Number(b.alive) - Number(a.alive) || b.out - a.out || b.kos - a.kos).map((b) => b.pid);
    },
    leader() {
      const left = bs.filter((b) => b.alive);
      return left.length === 1 ? left[0].profile.name : null;
    },
  };
  return game;
}

export const brawl: GameBase = {
  id: 'bagarre',
  emoji: '🤼',
  name: { fr: 'Bagarre Molle', en: 'Wobbly Brawl' },
  how: {
    fr: 'B court = baffe · B maintenu = attraper puis jeter · A = saut',
    en: 'Tap B = slap · Hold B = grab then throw · A = jump',
  },
  inspired: 'Gang Beasts',
  layout: 'stick',
  min: 2,
  max: 8,
  botFill: 4,
  music: 'tumble',
  create,
};
