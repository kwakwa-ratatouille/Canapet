import { TEAMS, allies, sidesLeft, winnerName } from './teams';
// Coussin Clash : combat de plateforme dans le salon. Plus on a de %, plus on vole loin.
// A = saut (double saut) · B = coup selon la direction du stick (neutre, côté, haut, bas) · bas + B jauge pleine = super coup.
// La caméra suit les joueurs ; des objets tombent du ciel (tapette, coussin-bombe, cœur, étoile).
import { drawCharacter } from '../shared/characters';
import { INK, MENTHE, ROSE, SOLEIL, VIOLET } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { roundRectText, candy } from './draw';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

const GRAV = 2400;
const RUN = 470;
const JUMP = 950;
const HW = 24;
const BH = 78;
const SIZE = 104;
const STOCKS = 3;
const MAX_TIME = 200;

type Plat = { x: number; y: number; w: number; move?: { ax: number; ay: number; freq: number; ph: number }; bx?: number; by?: number; dx?: number; dy?: number };
type Box = { x: number; y: number; w: number; h: number };

interface Stage {
  id: string;
  name: { fr: string; en: string };
  wall: [string, string];
  main: Box;
  plats: Plat[];
}

/** Scènes : chaque combat en tire une au hasard (repère monde, la caméra suit). */
const STAGES: Stage[] = [
  {
    id: 'canape',
    name: { fr: 'Le Canapé', en: 'The Couch' },
    wall: ['#ffd6ea', '#e9d8ff'],
    main: { x: 800, y: 900, w: 1200, h: 150 },
    plats: [
      { x: 900, y: 700, w: 280 },
      { x: 1620, y: 700, w: 280 },
      { x: 1260, y: 510, w: 280 },
    ],
  },
  {
    id: 'etagere',
    name: { fr: 'L’Étagère', en: 'The Bookshelf' },
    wall: ['#ffe2c4', '#ffd0b0'],
    main: { x: 900, y: 920, w: 1000, h: 130 },
    plats: [
      { x: 560, y: 770, w: 260 },
      { x: 1980, y: 770, w: 260 },
      { x: 1100, y: 710, w: 300 },
      { x: 1400, y: 530, w: 300 },
      { x: 820, y: 470, w: 240 },
      { x: 1760, y: 470, w: 240 },
    ],
  },
  {
    id: 'frigo',
    name: { fr: 'Le Frigo', en: 'The Fridge' },
    wall: ['#dff4ff', '#c9ecff'],
    main: { x: 950, y: 960, w: 900, h: 150 },
    plats: [
      { x: 740, y: 790, w: 240 },
      { x: 1820, y: 790, w: 240 },
      { x: 1150, y: 630, w: 500 },
      { x: 1300, y: 450, w: 200 },
    ],
  },
  {
    id: 'lustre',
    name: { fr: 'Le Lustre', en: 'The Chandelier' },
    wall: ['#2a1838', '#6a4bd8'],
    main: { x: 1050, y: 940, w: 700, h: 130 },
    plats: [
      { x: 700, y: 730, w: 260, move: { ax: 200, ay: 0, freq: 0.5, ph: 0 } },
      { x: 1840, y: 730, w: 260, move: { ax: 200, ay: 0, freq: 0.5, ph: Math.PI } },
      { x: 1270, y: 520, w: 260, move: { ax: 0, ay: 90, freq: 0.7, ph: 0 } },
    ],
  },
  {
    id: 'bain',
    name: { fr: 'La Baignoire', en: 'The Bathtub' },
    wall: ['#cff6ec', '#e3f2ff'],
    main: { x: 850, y: 930, w: 1100, h: 170 },
    plats: [
      { x: 880, y: 740, w: 210, move: { ax: 0, ay: 120, freq: 0.6, ph: 0 } },
      { x: 1295, y: 600, w: 210, move: { ax: 0, ay: 130, freq: 0.5, ph: 1 } },
      { x: 1710, y: 740, w: 210, move: { ax: 0, ay: 120, freq: 0.6, ph: 2 } },
    ],
  },
];

type Move = 'jab' | 'side' | 'up' | 'down' | 'spike' | 'super' | 'batte';

interface MoveDef {
  dur: number;
  from: number;
  to: number;
  dx: number;
  dy: number;
  w: number;
  h: number;
  dmg: number;
  base: number;
  growth: number;
  ang: number;
}

const MOVES: Record<Move, MoveDef> = {
  jab: { dur: 0.24, from: 0.05, to: 0.14, dx: 52, dy: -46, w: 66, h: 48, dmg: 4, base: 200, growth: 2.6, ang: 25 },
  side: { dur: 0.48, from: 0.15, to: 0.3, dx: 68, dy: -46, w: 96, h: 60, dmg: 12, base: 320, growth: 6, ang: 35 },
  up: { dur: 0.42, from: 0.06, to: 0.28, dx: 0, dy: -96, w: 96, h: 84, dmg: 9, base: 340, growth: 4.6, ang: 88 },
  down: { dur: 0.42, from: 0.12, to: 0.26, dx: 0, dy: -18, w: 170, h: 46, dmg: 8, base: 290, growth: 4.2, ang: 62 },
  spike: { dur: 0.42, from: 0.08, to: 0.3, dx: 0, dy: 4, w: 78, h: 60, dmg: 10, base: 260, growth: 4.6, ang: -80 },
  super: { dur: 0.8, from: 0.3, to: 0.45, dx: 0, dy: -40, w: 460, h: 330, dmg: 20, base: 600, growth: 7, ang: 45 },
  batte: { dur: 0.5, from: 0.14, to: 0.3, dx: 80, dy: -50, w: 130, h: 80, dmg: 17, base: 430, growth: 7.5, ang: 40 },
};

type ItemKind = 'batte' | 'bombe' | 'coeur' | 'etoile';
interface Item {
  kind: ItemKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  thrownBy: number;
  fuse: number;
  rot: number;
}

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  max: number;
  size: number;
  color: string;
  kind: 'dust' | 'smoke' | 'star' | 'ring';
}

interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  size: number;
}

interface F extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  plat: Plat | null;
  dropT: number;
  jumps: number;
  dir: 1 | -1;
  dmg: number;
  stocks: number;
  stun: number;
  invuln: number;
  star: number;
  respawn: number;
  meter: number;
  move: Move | null;
  moveT: number;
  hitSet: Set<number>;
  upUsed: boolean;
  inp: { x: number; y: number };
  jumpReq: boolean;
  atkReq: boolean;
  lastA: boolean;
  lastB: boolean;
  lastD: boolean;
  superReq: boolean;
  out: number;
  kos: number;
  lastHitBy: number;
  botCd: number;
  item: ItemKind | null;
  uses: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const stage = STAGES[Math.floor(Math.random() * STAGES.length)];
  const MAIN = stage.main;
  const PLATS: Plat[] = stage.plats.map((p) => ({ ...p, bx: p.x, by: p.y, dx: 0, dy: 0 }));
  const BLAST = { l: MAIN.x - 700, r: MAIN.x + MAIN.w + 700, t: MAIN.y - 1250, b: MAIN.y + 600 };
  const fr = ctx.lang === 'fr';
  const n = Math.min(8, runners.length);
  const fs: F[] = runners.slice(0, 8).map((r, i) => ({
    ...r,
    x: MAIN.x + 120 + (i * (MAIN.w - 240)) / Math.max(1, n - 1),
    y: MAIN.y,
    vx: 0,
    vy: 0,
    onGround: true,
    plat: null,
    dropT: 0,
    jumps: 2,
    dir: i < n / 2 ? 1 : -1,
    dmg: 0,
    stocks: STOCKS,
    stun: 0,
    invuln: 1.5,
    star: 0,
    respawn: 0,
    meter: 0,
    move: null,
    moveT: 0,
    hitSet: new Set(),
    upUsed: false,
    inp: { x: 0, y: 0 },
    jumpReq: false,
    atkReq: false,
    lastA: false,
    lastB: false,
    lastD: false,
    superReq: false,
    out: 0,
    kos: 0,
    lastHitBy: -1,
    botCd: rnd(0.3, 0.8),
    item: null,
    uses: 0,
  }));
  let items: Item[] = [];
  const parts: Part[] = [];
  const pops: Pop[] = [];
  let time = 0;
  let outCount = 0;
  let endDelay = -1;
  let flash = 0;
  let freeze = 0;
  let shake = 0;
  let nextItem = rnd(5, 8);
  const cam = { x: MAIN.x + MAIN.w / 2, y: MAIN.y - 250, z: 0.85 };

  const alive = (f: F) => f.stocks > 0 && f.respawn <= 0;
  const maxParts = ctx.light ? 60 : 220;

  function burst(x: number, y: number, n: number, kind: Part['kind'], color: string, speed = 300, size = 10) {
    for (let k = 0; k < n && parts.length < maxParts; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * rnd(0.4, 1);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, max: rnd(0.3, 0.7), size: size * rnd(0.6, 1.3), color, kind });
    }
  }

  function startMove(f: F, i: number) {
    if (f.move || f.stun > 0) return;
    // Objet en main : B sert à l'utiliser
    if (f.item === 'bombe') {
      items.push({ kind: 'bombe', x: f.x + f.dir * 30, y: f.y - BH, vx: f.dir * 950 + f.vx * 0.3, vy: f.inp.y < -0.5 ? -950 : -480, life: 99, thrownBy: i, fuse: 2.2, rot: 0 });
      f.item = null;
      sfx.boing();
      return;
    }
    const up = f.inp.y < -0.5;
    const down = f.inp.y > 0.5 || f.superReq;
    f.superReq = false;
    const side = Math.abs(f.inp.x) > 0.5;
    let m: Move = 'jab';
    if (f.item === 'batte') m = 'batte';
    else if (down && f.onGround && f.meter >= 100) m = 'super';
    else if (up) m = 'up';
    else if (down) m = f.onGround ? 'down' : 'spike';
    else if (side) m = 'side';
    if (side) f.dir = f.inp.x > 0 ? 1 : -1;
    f.move = m;
    f.moveT = 0;
    f.hitSet = new Set([i]);
    if (m === 'side') f.vx += f.dir * 320;
    if (m === 'up' && !f.onGround && !f.upUsed) {
      f.vy = -1020;
      f.upUsed = true;
    }
    if (m === 'spike') f.vy = Math.max(f.vy, 350);
    if (m === 'batte' && --f.uses <= 0) setTimeout(() => (f.item = null), 450);
    if (m === 'super') {
      f.meter = 0;
      speak(ctx.family ? (fr ? 'Pouf cosmique !' : 'Cosmic poof!') : fr ? 'Prout cosmique !' : 'Cosmic toot!', ctx.lang);
    }
    if (!ctx.light) sfx.step();
  }

  function hitbox(f: F) {
    const d = MOVES[f.move!];
    const cx = f.x + d.dx * f.dir;
    const cy = f.y + d.dy;
    return { x: cx - d.w / 2, y: cy - d.h / 2, w: d.w, h: d.h, cx, cy };
  }

  /** Applique un coup : dégâts, éjection, arrêt sur image et tremblement selon la force. */
  function strike(o: F, j: number, by: number, d: { dmg: number; base: number; growth: number }, ang: number, dirX: number) {
    if (o.star > 0) return;
    o.dmg = Math.min(999, o.dmg + d.dmg);
    const kb = d.base + o.dmg * d.growth;
    o.vx = Math.cos(ang) * kb * dirX;
    o.vy = -Math.sin(ang) * kb;
    if (o.vy < 0) o.onGround = false;
    o.stun = Math.min(1.6, kb / 1000);
    o.move = null;
    o.lastHitBy = by;
    if (o.item && o.item !== 'bombe') {
      items.push({ kind: o.item, x: o.x, y: o.y - BH, vx: rnd(-200, 200), vy: -500, life: 10, thrownBy: -1, fuse: 0, rot: 0 });
      o.item = null;
    }
    if (by >= 0) fs[by].meter = Math.min(100, fs[by].meter + d.dmg * 2.4);
    o.meter = Math.min(100, o.meter + d.dmg * 1.4);
    const strong = kb > 650;
    freeze = Math.max(freeze, strong ? 0.11 : 0.04);
    shake = Math.max(shake, strong ? 22 : 8);
    burst(o.x, o.y - BH / 2, strong ? 12 : 5, 'star', strong ? '#fff' : SOLEIL, strong ? 620 : 340, strong ? 14 : 10);
    parts.push({ x: o.x, y: o.y - BH / 2, vx: 0, vy: 0, t: 0, max: 0.3, size: strong ? 110 : 60, color: '#fff', kind: 'ring' });
    pops.push({ x: o.x, y: o.y - BH - 30, text: `+${d.dmg}%`, color: strong ? '#ff3b3b' : ROSE, t: 0.9, size: strong ? 46 : 34 });
    if (strong) {
      sfx.boing();
      flash = 0.06;
    } else sfx.pop();
    if (!o.bot) ctx.buzz(o.pid, strong ? 220 : 60);
    void j;
  }

  function applyHits(f: F, i: number) {
    if (!f.move) return;
    const d = MOVES[f.move];
    if (f.moveT < d.from || f.moveT > d.to) return;
    const hb = hitbox(f);
    fs.forEach((o, j) => {
      if (f.hitSet.has(j) || !alive(o) || o.invuln > 0 || allies(o, f)) return;
      if (o.x + HW < hb.x || o.x - HW > hb.x + hb.w || o.y < hb.y || o.y - BH > hb.y + hb.h) return;
      f.hitSet.add(j);
      let dirX: number = f.dir;
      if (f.move === 'down' || f.move === 'super') dirX = o.x >= f.x ? 1 : -1;
      if (f.move === 'up') dirX = o.x >= f.x ? 0.3 : -0.3;
      strike(o, j, i, d, (d.ang * Math.PI) / 180, dirX);
    });
  }

  function explode(it: Item) {
    shake = 30;
    freeze = 0.08;
    burst(it.x, it.y, 18, 'smoke', ctx.family ? '#bfe6ff' : '#b9e07a', 500, 30);
    burst(it.x, it.y, 10, 'star', SOLEIL, 700, 14);
    sfx.pet();
    fs.forEach((o, j) => {
      if (!alive(o) || o.invuln > 0 || (it.thrownBy >= 0 && allies(o, fs[it.thrownBy]))) return;
      const dx = o.x - it.x;
      const dy = o.y - BH / 2 - it.y;
      if (Math.hypot(dx, dy) < 170) strike(o, j, it.thrownBy, { dmg: 15, base: 440, growth: 6.5 }, 0.9, dx >= 0 ? 1 : -1);
    });
  }

  function respawnAt(f: F) {
    f.x = MAIN.x + MAIN.w / 2 + rnd(-200, 200);
    f.y = MAIN.y - 600;
    f.vx = f.vy = 0;
    f.dmg = 0;
    f.invuln = 2.2;
    f.stun = 0;
    f.move = null;
    f.jumps = 2;
    f.upUsed = false;
    f.item = null;
  }

  function bot(f: F, i: number, dt: number) {
    f.botCd -= dt;
    const off = f.x < MAIN.x - 10 || f.x > MAIN.x + MAIN.w + 10;
    f.inp = { x: 0, y: 0 };
    if (off || f.y > MAIN.y + 40) {
      f.inp.x = f.x < MAIN.x + MAIN.w / 2 ? 1 : -1;
      if (f.vy > 0 && f.y > MAIN.y - 160) {
        if (f.jumps > 0) f.jumpReq = true;
        else if (!f.upUsed) {
          f.inp.y = -1;
          f.atkReq = true;
        }
      }
      return;
    }
    // Un objet pas loin et les mains vides : on va le chercher.
    if (!f.item) {
      const it = items.find((x) => x.thrownBy < 0 && Math.abs(x.x - f.x) < 520 && Math.abs(x.y - f.y) < 260);
      if (it) {
        f.inp.x = Math.abs(it.x - f.x) > 20 ? Math.sign(it.x - f.x) : 0;
        if (it.y < f.y - 120 && f.onGround && Math.random() < 0.05) f.jumpReq = true;
        return;
      }
    }
    let best = -1;
    let bd = 1e9;
    fs.forEach((o, j) => {
      if (j === i || !alive(o) || allies(o, f)) return;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    if (best < 0) return;
    const o = fs[best];
    const dx = o.x - f.x;
    const dy = o.y - f.y;
    if (f.item === 'bombe' && Math.abs(dx) < 650 && Math.abs(dy) < 200 && f.botCd <= 0) {
      f.dir = dx >= 0 ? 1 : -1;
      f.atkReq = true;
      f.botCd = 1;
      return;
    }
    if (Math.abs(dx) > 80) f.inp.x = Math.sign(dx);
    else f.dir = dx >= 0 ? 1 : -1;
    // Ne pas se jeter dans le vide
    if ((f.x < MAIN.x + 60 && f.inp.x < 0) || (f.x > MAIN.x + MAIN.w - 60 && f.inp.x > 0)) f.inp.x = 0;
    if (dy < -120 && f.onGround && Math.random() < 0.04) f.jumpReq = true;
    if (f.botCd <= 0 && Math.abs(dx) < 120 && Math.abs(dy) < 90) {
      f.botCd = rnd(0.3, 0.8);
      const r = Math.random();
      if (f.meter >= 100 && f.onGround) f.inp.y = 1;
      else if (r < 0.4) f.inp = { x: 0, y: 0 };
      else if (r < 0.8) f.inp = { x: Math.sign(dx) || f.dir, y: 0 };
      else f.inp = { x: 0, y: dy < -30 ? -1 : 1 };
      f.atkReq = true;
    }
  }

  function physics(f: F, dt: number) {
    if (f.move) {
      f.moveT += dt;
      if (f.moveT >= MOVES[f.move].dur) f.move = null;
    }
    f.stun = Math.max(0, f.stun - dt);
    f.invuln = Math.max(0, f.invuln - dt);
    f.star = Math.max(0, f.star - dt);
    f.dropT = Math.max(0, f.dropT - dt);
    // Plateforme mobile : elle nous emporte
    if (f.onGround && f.plat?.move) {
      f.x += f.plat.dx ?? 0;
      f.y += f.plat.dy ?? 0;
    }
    const control = f.stun <= 0;
    const mx = control && Math.abs(f.inp.x) > 0.25 ? Math.sign(f.inp.x) : 0;
    if (control && !f.move && mx) f.dir = mx as 1 | -1;
    const speed = RUN * (f.star > 0 ? 1.35 : 1);
    if (control) {
      const busy = f.move && f.onGround ? 0.3 : 1;
      const acc = (f.onGround ? 4400 : 2600) * dt;
      f.vx += Math.max(-acc, Math.min(acc, mx * speed * busy - f.vx));
      if (f.onGround && mx && !ctx.light && Math.random() < 0.15) burst(f.x - f.dir * 20, f.y - 6, 1, 'dust', '#ffffff', 60, 12);
    } else f.vx *= Math.pow(0.6, dt);
    if (f.jumpReq && control && f.jumps > 0) {
      f.vy = -JUMP * (f.jumps === 2 ? 1 : 0.92);
      f.jumps--;
      f.onGround = false;
      if (!ctx.light) burst(f.x, f.y - 4, 4, 'dust', '#ffffff', 160, 14);
    }
    f.jumpReq = false;
    if (f.onGround && f.plat && f.inp.y > 0.75 && control && !f.move) {
      f.dropT = 0.3;
      f.onGround = false;
    }
    const fast = !f.onGround && control && f.inp.y > 0.6 && f.vy > 0 ? 1.8 : 1;
    f.vy = Math.min(f.vy + GRAV * fast * dt, f.stun > 0 ? 2400 : 1350);
    // Traînée quand on est éjecté fort
    if (f.stun > 0 && Math.hypot(f.vx, f.vy) > 900 && parts.length < maxParts && Math.random() < (ctx.light ? 0.3 : 0.8))
      parts.push({ x: f.x, y: f.y - BH / 2, vx: 0, vy: 0, t: 0, max: 0.45, size: 26, color: '#ffffff', kind: 'smoke' });
    const prevY = f.y;
    f.x += f.vx * dt;
    if (f.y > MAIN.y + 2 && f.y - BH < MAIN.y + MAIN.h && f.x + HW > MAIN.x && f.x - HW < MAIN.x + MAIN.w) {
      f.x = f.x < MAIN.x + MAIN.w / 2 ? MAIN.x - HW : MAIN.x + MAIN.w + HW;
      f.vx = 0;
    }
    f.y += f.vy * dt;
    const wasGround = f.onGround;
    f.onGround = false;
    f.plat = null;
    if (f.x + HW > MAIN.x && f.x - HW < MAIN.x + MAIN.w) {
      if (f.vy >= 0 && prevY <= MAIN.y + 4 && f.y >= MAIN.y) land(f, MAIN.y, null, wasGround);
      else if (f.vy < 0 && f.y - BH < MAIN.y + MAIN.h && prevY - BH >= MAIN.y + MAIN.h - 4) {
        f.y = MAIN.y + MAIN.h + BH;
        f.vy = 0;
      }
    }
    if (f.dropT <= 0)
      for (const p of PLATS)
        if (f.x > p.x && f.x < p.x + p.w && f.vy >= 0 && prevY <= p.y + 4 + Math.max(0, p.dy ?? 0) && f.y >= p.y) land(f, p.y, p, wasGround);
  }

  function land(f: F, y: number, plat: Plat | null, wasGround: boolean) {
    // Gros choc au sol en étant sonné : on rebondit un peu
    if (f.stun > 0 && f.vy > 900) {
      f.y = y;
      f.vy = -f.vy * 0.4;
      shake = Math.max(shake, 6);
      burst(f.x, y, 6, 'dust', '#ffffff', 260, 16);
      return;
    }
    if (!wasGround && f.vy > 600 && !ctx.light) burst(f.x, y - 4, 5, 'dust', '#ffffff', 200, 14);
    f.y = y;
    f.vy = 0;
    f.onGround = true;
    f.plat = plat;
    f.jumps = 2;
    f.upUsed = false;
    if (f.move === 'spike') f.move = null;
  }

  function stepItems(dt: number) {
    nextItem -= dt;
    if (nextItem <= 0 && items.filter((x) => x.thrownBy < 0).length < 3) {
      nextItem = rnd(6, 10);
      const pool: ItemKind[] = ['batte', 'bombe', 'bombe', 'coeur', 'etoile'];
      items.push({ kind: pool[Math.floor(Math.random() * pool.length)], x: MAIN.x + rnd(80, MAIN.w - 80), y: MAIN.y - 1100, vx: 0, vy: 0, life: 15, thrownBy: -1, fuse: 0, rot: 0 });
      sfx.tick();
    }
    for (const it of items) {
      const prevY = it.y;
      it.vy = Math.min(it.vy + GRAV * 0.7 * dt, 900);
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rot += it.vx * dt * 0.01;
      it.life -= dt;
      const tops: { x: number; w: number; y: number; dx: number }[] = [{ x: MAIN.x, w: MAIN.w, y: MAIN.y, dx: 0 }, ...PLATS.map((p) => ({ x: p.x, w: p.w, y: p.y, dx: p.dx ?? 0 }))];
      for (const s of tops)
        if (it.x > s.x && it.x < s.x + s.w && it.vy >= 0 && prevY <= s.y + 6 && it.y >= s.y) {
          if (it.thrownBy >= 0 && it.kind === 'bombe') it.fuse = Math.min(it.fuse, 0.05);
          it.y = s.y;
          it.vy = 0;
          it.vx *= 0.6;
          it.x += s.dx;
        }
      if (it.kind === 'bombe' && it.thrownBy >= 0) {
        it.fuse -= dt;
        for (const [j, o] of fs.entries())
          if (j !== it.thrownBy && alive(o) && Math.hypot(o.x - it.x, o.y - BH / 2 - it.y) < 60) it.fuse = 0;
        if (it.fuse <= 0) {
          explode(it);
          it.life = 0;
        }
      }
      if (it.y > BLAST.b) it.life = 0;
    }
    // Ramassage
    for (const f of fs) {
      if (!alive(f)) continue;
      for (const it of items) {
        if (it.life <= 0 || it.thrownBy >= 0 || Math.hypot(f.x - it.x, f.y - BH / 2 - it.y) > 70) continue;
        if (it.kind === 'coeur') {
          f.dmg = Math.max(0, f.dmg - 40);
          pops.push({ x: f.x, y: f.y - BH - 30, text: '-40%', color: MENTHE, t: 1, size: 40 });
          burst(f.x, f.y - BH / 2, 8, 'star', ROSE, 300, 12);
          sfx.join();
        } else if (it.kind === 'etoile') {
          f.star = 6;
          pops.push({ x: f.x, y: f.y - BH - 30, text: '★', color: SOLEIL, t: 1, size: 60 });
          sfx.win();
        } else if (!f.item) {
          f.item = it.kind;
          f.uses = it.kind === 'batte' ? 6 : 1;
          sfx.click();
        } else continue;
        it.life = 0;
        if (!f.bot) ctx.buzz(f.pid, 80);
      }
    }
    items = items.filter((x) => x.life > 0);
  }

  function stepCamera(dt: number) {
    const live = fs.filter(alive);
    let x0 = MAIN.x;
    let x1 = MAIN.x + MAIN.w;
    let y0 = MAIN.y - 500;
    let y1 = MAIN.y + 150;
    for (const f of live) {
      x0 = Math.min(x0, f.x - 260);
      x1 = Math.max(x1, f.x + 260);
      y0 = Math.min(y0, f.y - BH - 260);
      y1 = Math.max(y1, f.y + 160);
    }
    x0 = Math.max(x0, BLAST.l);
    x1 = Math.min(x1, BLAST.r);
    y0 = Math.max(y0, BLAST.t);
    y1 = Math.min(y1, BLAST.b);
    const z = Math.max(0.5, Math.min(1.05, Math.min(1920 / (x1 - x0), 940 / (y1 - y0))));
    const k = Math.min(1, dt * 3);
    cam.x += ((x0 + x1) / 2 - cam.x) * k;
    cam.y += ((y0 + y1) / 2 + 40 - cam.y) * k;
    cam.z += (z - cam.z) * k;
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const f = fs.find((x) => x.pid === pid);
      if (!f) return;
      if (m.a && !f.lastA) f.jumpReq = true;
      if (m.b && !f.lastB) f.atkReq = true;
      // Y : super coup direct quand la jauge est pleine
      if (m.d && !f.lastD && f.meter >= 100 && f.onGround) {
        f.superReq = true;
        f.atkReq = true;
      }
      f.lastD = !!m.d;
      f.lastA = m.a;
      f.lastB = m.b;
      f.inp = { x: m.x, y: m.y };
    },
    update(dt) {
      flash = Math.max(0, flash - dt);
      shake = Math.max(0, shake - dt * 60);
      for (const p of pops) {
        p.t -= dt;
        p.y -= 60 * dt;
      }
      while (pops.length && pops[0].t <= 0) pops.shift();
      for (const p of parts) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.1, dt);
        p.vy *= Math.pow(0.1, dt);
      }
      for (let k = parts.length - 1; k >= 0; k--) if (parts[k].t >= parts[k].max) parts.splice(k, 1);
      // Arrêt sur image après un gros coup
      if (freeze > 0) {
        freeze -= dt;
        return;
      }
      time += dt;
      for (const p of PLATS) {
        if (!p.move) continue;
        const nx = p.bx! + Math.sin(time * p.move.freq * Math.PI * 2 + p.move.ph) * p.move.ax;
        const ny = p.by! + Math.sin(time * p.move.freq * Math.PI * 2 + p.move.ph) * p.move.ay;
        p.dx = nx - p.x;
        p.dy = ny - p.y;
        p.x = nx;
        p.y = ny;
      }
      fs.forEach((f, i) => {
        if (f.stocks <= 0) return;
        if (f.respawn > 0) {
          if ((f.respawn -= dt) <= 0) respawnAt(f);
          return;
        }
        if (f.bot) bot(f, i, dt);
        if (f.atkReq) startMove(f, i);
        f.atkReq = false;
        physics(f, dt);
        if (f.x < BLAST.l || f.x > BLAST.r || f.y > BLAST.b || f.y < BLAST.t) {
          f.stocks--;
          if (f.lastHitBy >= 0) fs[f.lastHitBy].kos++;
          f.lastHitBy = -1;
          const bx = Math.max(BLAST.l + 120, Math.min(BLAST.r - 120, f.x));
          const by = Math.max(BLAST.t + 120, Math.min(BLAST.b - 120, f.y));
          burst(bx, by, 26, 'star', f.profile.color, 900, 18);
          parts.push({ x: bx, y: by, vx: 0, vy: 0, t: 0, max: 0.5, size: 260, color: f.profile.color, kind: 'ring' });
          pops.push({ x: bx, y: by - 60, text: 'KO !', color: f.profile.color, t: 1.2, size: 80 });
          sfx.pet();
          flash = 0.12;
          shake = 34;
          if (!f.bot) ctx.buzz(f.pid, 500);
          if (f.stocks <= 0) f.out = ++outCount;
          else f.respawn = 1.4;
          f.item = null;
        }
      });
      fs.forEach((f, i) => alive(f) && applyHits(f, i));
      stepItems(dt);
      stepCamera(dt);
      const left = sidesLeft(fs.filter((f) => f.stocks > 0));
      if (endDelay < 0 && (left <= 1 || time > MAX_TIME)) endDelay = 2.4;
      if (endDelay >= 0 && (endDelay -= dt) <= 0) game.over = true;
    },
    render(g, t) {
      drawBackdrop(g, stage, cam, t, ctx.light);
      g.save();
      const sx = shake ? rnd(-shake, shake) : 0;
      const sy = shake ? rnd(-shake, shake) : 0;
      g.translate(960 + sx, 540 + sy);
      g.scale(cam.z, cam.z);
      g.translate(-cam.x, -cam.y);

      drawStage(g, stage, MAIN, PLATS, t);

      // Objets
      for (const it of items) drawItem(g, it, t);

      fs.forEach((f, i) => {
        if (!alive(f)) return;
        if (f.invuln > 0 && Math.floor(t * 12) % 2) g.globalAlpha = 0.5;
        // Étoile : halo arc-en-ciel
        if (f.star > 0) {
          g.strokeStyle = `hsl(${(t * 400) % 360},90%,60%)`;
          g.lineWidth = 8;
          g.beginPath();
          g.ellipse(f.x, f.y - BH / 2, 62, 74, 0, 0, Math.PI * 2);
          g.stroke();
        }
        g.save();
        if (f.stun > 0.15) {
          g.translate(f.x, f.y - 40);
          g.rotate(Math.sin(t * 30) * 0.5 + (f.stun > 0.6 ? t * 12 * Math.sign(f.vx || 1) : 0));
          g.translate(-f.x, -(f.y - 40));
        }
        drawCharacter(g, f.x, f.y, SIZE, {
          food: f.profile.food,
          color: f.profile.color,
          hat: f.profile.hat,
          acc: f.profile.acc,
          selfie: f.selfie,
          t: t + i,
          dir: f.dir,
          run: f.onGround ? Math.min(1, Math.abs(f.vx) / RUN) : 0.2,
          mood: f.stun > 0 ? 'wow' : f.move ? 'win' : 'happy',
        });
        g.restore();
        g.globalAlpha = 1;
        // Objet tenu
        if (f.item) drawItem(g, { kind: f.item, x: f.x + f.dir * 40, y: f.y - BH * 0.6, vx: 0, vy: 0, life: 9, thrownBy: -1, fuse: 0, rot: f.move === 'batte' ? f.dir * (f.moveT * 8 - 1) : f.dir * -0.6 }, t, true);
        // Coup en cours : coussin brandi
        if (f.move && f.move !== 'batte') {
          const d = MOVES[f.move];
          const active = f.moveT >= d.from && f.moveT <= d.to;
          const hb = hitbox(f);
          if (f.move === 'super') {
            const k = Math.min(1, f.moveT / d.to);
            g.fillStyle = ctx.family ? 'rgba(191,230,255,0.6)' : 'rgba(150,215,90,0.55)';
            g.beginPath();
            g.ellipse(hb.cx, hb.cy, (d.w / 2) * k, (d.h / 2) * k, 0, 0, Math.PI * 2);
            g.fill();
          } else {
            g.save();
            g.translate(hb.cx, hb.cy);
            g.rotate((f.move === 'up' ? -Math.PI / 2 : f.move === 'spike' ? Math.PI / 2 : 0) + (active ? 0 : -0.6 * f.dir));
            g.fillStyle = active ? f.profile.color : 'rgba(255,255,255,0.7)';
            g.strokeStyle = INK;
            g.lineWidth = 5;
            g.beginPath();
            g.roundRect(-32, -21, 64, 42, 14);
            g.fill();
            g.stroke();
            if (active) {
              // Traits de vitesse
              g.strokeStyle = '#fff';
              g.lineWidth = 5;
              for (let k = 0; k < 3; k++) {
                g.beginPath();
                g.moveTo(-50 - k * 12, -14 + k * 14);
                g.lineTo(-80 - k * 12, -14 + k * 14);
                g.stroke();
              }
            }
            g.restore();
          }
        }
        // Pseudo au-dessus de la tête
        g.font = '700 28px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 6;
        g.strokeStyle = INK;
        g.strokeText(f.profile.name, f.x, f.y - SIZE - 34);
        g.fillStyle = f.team !== undefined ? TEAMS[f.team].color : f.profile.color;
        g.fillText(f.profile.name, f.x, f.y - SIZE - 34);
        if (f.meter >= 100) {
          g.font = '36px sans-serif';
          g.fillText('🌟', f.x + 50, f.y - SIZE - 30 + Math.sin(t * 6) * 4);
        }
      });

      // Particules
      for (const p of parts) {
        const k = p.t / p.max;
        g.globalAlpha = 1 - k;
        if (p.kind === 'ring') {
          g.strokeStyle = p.color;
          g.lineWidth = 10 * (1 - k) + 2;
          g.beginPath();
          g.arc(p.x, p.y, p.size * (0.3 + k), 0, Math.PI * 2);
          g.stroke();
        } else if (p.kind === 'star') {
          g.fillStyle = p.color;
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.t * 8);
          g.beginPath();
          for (let s = 0; s < 10; s++) {
            const r = s % 2 ? p.size * 0.45 : p.size;
            g.lineTo(Math.cos((s * Math.PI) / 5) * r, Math.sin((s * Math.PI) / 5) * r);
          }
          g.fill();
          g.strokeStyle = INK;
          g.lineWidth = 2;
          g.stroke();
          g.restore();
        } else {
          g.fillStyle = p.color;
          g.beginPath();
          g.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 0.6 + k : 1 - k * 0.5), 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
      // Textes qui sautent (+12 %, KO !)
      for (const p of pops) {
        g.globalAlpha = Math.min(1, p.t * 2);
        g.font = `700 ${p.size}px Fredoka, sans-serif`;
        g.textAlign = 'center';
        g.lineWidth = p.size * 0.22;
        g.strokeStyle = INK;
        g.strokeText(p.text, p.x, p.y);
        g.fillStyle = p.color;
        g.fillText(p.text, p.x, p.y);
      }
      g.globalAlpha = 1;
      g.restore();

      if (flash > 0) {
        g.fillStyle = `rgba(255,255,255,${flash * 4})`;
        g.fillRect(0, 0, 1920, 1080);
      }
      drawHud(g, fs, t);
    },
    mapName: stage.name,
    ranking() {
      return [...fs].sort((a, b) => b.stocks - a.stocks || (b.out || 99) - (a.out || 99) || a.dmg - b.dmg || b.kos - a.kos).map((f) => f.pid);
    },
    leader() {
      const left = fs.filter((f) => f.stocks > 0);
      return left.length && sidesLeft(left) === 1 ? winnerName(left[0], ctx.lang) : null;
    },
  };
  return game;
}

// ——— Dessin ———

/** Fond du salon, en léger décalage avec la caméra (effet de profondeur). */
function drawBackdrop(g: CanvasRenderingContext2D, stage: Stage, cam: { x: number; y: number; z: number }, t: number, light: boolean) {
  const bg = g.createLinearGradient(0, 0, 0, 1080);
  bg.addColorStop(0, stage.wall[0]);
  bg.addColorStop(1, stage.wall[1]);
  g.fillStyle = bg;
  g.fillRect(0, 0, 1920, 1080);
  const px = -(cam.x - 1400) * 0.25;
  const py = -(cam.y - 650) * 0.15;
  g.save();
  g.translate(px, py);
  g.strokeStyle = INK;
  g.lineWidth = 6;
  if (stage.id === 'lustre') {
    // Nuit étoilée par la grande fenêtre
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 50; i++) g.fillRect((i * 431) % 2400 - 200, (i * 197) % 700, 4, 4);
    g.fillStyle = '#fff6c2';
    g.beginPath();
    g.arc(1500, 180, 70, 0, Math.PI * 2);
    g.fill();
    // Lustre
    g.beginPath();
    g.moveTo(960, -100);
    g.lineTo(960, 120);
    g.stroke();
    g.fillStyle = SOLEIL;
    g.beginPath();
    g.ellipse(960, 150, 160, 40, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    for (let k = -2; k <= 2; k++) {
      g.fillStyle = '#fff3a8';
      g.beginPath();
      g.arc(960 + k * 70, 190, 14, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // Fenêtre avec ciel et nuages
    g.fillStyle = '#fff';
    g.beginPath();
    g.roundRect(240, 140, 420, 340, 30);
    g.fill();
    g.stroke();
    g.fillStyle = stage.id === 'bain' ? '#bfe6ff' : '#9fdcff';
    g.beginPath();
    g.roundRect(264, 164, 372, 292, 20);
    g.fill();
    if (!light) {
      g.fillStyle = '#fff';
      const cx = 300 + ((t * 20) % 380);
      g.beginPath();
      g.arc(cx, 260, 30, 0, Math.PI * 2);
      g.arc(cx + 36, 248, 38, 0, Math.PI * 2);
      g.arc(cx + 76, 262, 28, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.moveTo(450, 164);
    g.lineTo(450, 456);
    g.moveTo(264, 310);
    g.lineTo(636, 310);
    g.stroke();
    // Cadres au mur
    const frames: [number, number, number, number, string][] = [
      [1300, 160, 200, 150, ROSE],
      [1560, 220, 160, 200, VIOLET],
      [1080, 260, 140, 110, MENTHE],
    ];
    for (const [x, y, w, h, c] of frames) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.roundRect(x, y, w, h, 14);
      g.fill();
      g.stroke();
      g.fillStyle = c;
      g.beginPath();
      g.roundRect(x + 16, y + 16, w - 32, h - 32, 8);
      g.fill();
    }
    // Lampe
    g.fillStyle = SOLEIL;
    g.beginPath();
    g.moveTo(1780, 520);
    g.lineTo(1880, 520);
    g.lineTo(1850, 430);
    g.lineTo(1810, 430);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(1830, 520);
    g.lineTo(1830, 900);
    g.stroke();
  }
  g.restore();
}

function stickerRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  g.fillStyle = INK;
  g.beginPath();
  g.roundRect(x, y + 10, w, h, r);
  g.fill();
  g.fillStyle = fill;
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
  candy(g, x, y, w, h, r);
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.stroke();
}

function drawStage(g: CanvasRenderingContext2D, stage: Stage, M: Box, plats: Plat[], t: number) {
  g.strokeStyle = INK;
  g.lineWidth = 6;
  switch (stage.id) {
    case 'canape': {
      stickerRect(g, M.x - 70, M.y - 190, M.w + 140, 200, 44, '#7b4dff');
      stickerRect(g, M.x - 110, M.y - 70, 130, 230, 34, '#9b72ff');
      stickerRect(g, M.x + M.w - 20, M.y - 70, 130, 230, 34, '#9b72ff');
      stickerRect(g, M.x, M.y, M.w, M.h, 30, '#ff8fb7');
      for (let k = 1; k < 3; k++) {
        g.beginPath();
        g.moveTo(M.x + (k * M.w) / 3, M.y + 10);
        g.lineTo(M.x + (k * M.w) / 3, M.y + M.h - 34);
        g.stroke();
      }
      g.fillStyle = INK;
      g.fillRect(M.x + 50, M.y + M.h, 30, 70);
      g.fillRect(M.x + M.w - 80, M.y + M.h, 30, 70);
      break;
    }
    case 'etagere': {
      stickerRect(g, M.x, M.y, M.w, M.h, 18, '#c98a5a');
      const books = [ROSE, '#2ec5ff', SOLEIL, VIOLET, MENTHE];
      for (let k = 0; k < 16; k++) {
        g.fillStyle = books[k % books.length];
        g.fillRect(M.x + 30 + k * 60, M.y + 24, 44, M.h - 46);
        g.strokeRect(M.x + 30 + k * 60, M.y + 24, 44, M.h - 46);
      }
      g.fillStyle = '#a0643a';
      g.fillRect(M.x + 40, M.y + M.h, 30, 260);
      g.fillRect(M.x + M.w - 70, M.y + M.h, 30, 260);
      break;
    }
    case 'frigo': {
      stickerRect(g, M.x, M.y, M.w, M.h + 320, 34, '#ffffff');
      g.fillStyle = '#b8c6dd';
      g.fillRect(M.x + M.w - 70, M.y + 40, 18, 140);
      const mags: [number, number, string][] = [
        [M.x + 90, M.y + 70, ROSE],
        [M.x + 200, M.y + 120, SOLEIL],
        [M.x + 330, M.y + 80, MENTHE],
      ];
      for (const [mx, my, mc] of mags) {
        g.fillStyle = mc;
        g.beginPath();
        g.arc(mx, my, 22, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      break;
    }
    case 'lustre': {
      stickerRect(g, M.x, M.y, M.w, M.h, 40, '#ffd60a');
      g.fillStyle = '#fff3a8';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.arc(M.x + 70 + k * 112, M.y + M.h - 10, 16, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      break;
    }
    case 'bain': {
      stickerRect(g, M.x, M.y, M.w, M.h, 70, '#ffffff');
      g.fillStyle = '#9fdcff';
      g.beginPath();
      g.roundRect(M.x + 30, M.y + 20, M.w - 60, 40, 20);
      g.fill();
      // Mousse
      g.fillStyle = '#fff';
      for (let k = 0; k < 12; k++) {
        g.beginPath();
        g.arc(M.x + 60 + k * 90, M.y + 8 + Math.sin(t * 2 + k) * 4, 26, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      // Canard
      g.fillStyle = SOLEIL;
      g.beginPath();
      g.ellipse(M.x + M.w - 150, M.y - 30, 50, 34, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(M.x + M.w - 115, M.y - 70, 26, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#ff9a1f';
      g.beginPath();
      g.moveTo(M.x + M.w - 92, M.y - 72);
      g.lineTo(M.x + M.w - 66, M.y - 64);
      g.lineTo(M.x + M.w - 92, M.y - 58);
      g.fill();
      g.fillStyle = INK;
      g.beginPath();
      g.arc(M.x + M.w - 110, M.y - 76, 4, 0, Math.PI * 2);
      g.fill();
      break;
    }
  }
  const platColor: Record<string, string> = { canape: SOLEIL, etagere: '#e8b98a', frigo: '#bff0e4', lustre: '#c9a6ff', bain: '#bfe6ff' };
  for (const p of plats) {
    if (stage.id === 'bain') {
      // Bulles de savon géantes
      g.fillStyle = 'rgba(191,230,255,0.85)';
      g.beginPath();
      g.roundRect(p.x, p.y - 6, p.w, 40, 20);
      g.fill();
      g.stroke();
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(p.x + 40, p.y + 4, 18, 6, 0, 0, Math.PI * 2);
      g.fill();
      continue;
    }
    if (p.move && stage.id === 'lustre') {
      g.beginPath();
      g.moveTo(p.x + p.w / 2, p.y - 600);
      g.lineTo(p.x + p.w / 2, p.y);
      g.stroke();
    }
    stickerRect(g, p.x, p.y - 6, p.w, 38, 19, platColor[stage.id] ?? SOLEIL);
  }
}

function drawItem(g: CanvasRenderingContext2D, it: Item, t: number, held = false) {
  g.save();
  g.translate(it.x, it.y);
  if (!held && it.life < 3 && Math.floor(t * 10) % 2) g.globalAlpha = 0.4;
  g.rotate(it.rot);
  g.strokeStyle = INK;
  g.lineWidth = 5;
  const bob = held ? 0 : Math.sin(t * 4) * 4;
  switch (it.kind) {
    case 'batte': {
      // Tapette géante
      g.fillStyle = '#a0643a';
      g.fillRect(-6, -10 + bob, 12, 70);
      g.strokeRect(-6, -10 + bob, 12, 70);
      g.fillStyle = ROSE;
      g.beginPath();
      g.roundRect(-34, -66 + bob, 68, 60, 14);
      g.fill();
      g.stroke();
      g.strokeStyle = '#fff';
      g.lineWidth = 3;
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(-24, -36 + k * 16 + bob);
        g.lineTo(24, -36 + k * 16 + bob);
        g.stroke();
      }
      break;
    }
    case 'bombe': {
      g.fillStyle = VIOLET;
      g.beginPath();
      g.ellipse(0, -26 + bob, 34, 28, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(10, -52 + bob);
      g.quadraticCurveTo(22, -70 + bob, 30, -64 + bob);
      g.stroke();
      g.fillStyle = it.thrownBy >= 0 && Math.floor(t * 16) % 2 ? '#ff3b3b' : SOLEIL;
      g.beginPath();
      g.arc(32, -66 + bob, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = '700 30px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillText('!', 0, -14 + bob);
      break;
    }
    case 'coeur': {
      g.fillStyle = '#ff3b6b';
      g.beginPath();
      g.moveTo(0, -4 + bob);
      g.bezierCurveTo(-46, -34 + bob, -26, -78 + bob, 0, -54 + bob);
      g.bezierCurveTo(26, -78 + bob, 46, -34 + bob, 0, -4 + bob);
      g.fill();
      g.stroke();
      break;
    }
    case 'etoile': {
      g.fillStyle = SOLEIL;
      g.beginPath();
      for (let s = 0; s < 10; s++) {
        const r = s % 2 ? 16 : 38;
        g.lineTo(Math.cos((s * Math.PI) / 5 - Math.PI / 2) * r, -36 + bob + Math.sin((s * Math.PI) / 5 - Math.PI / 2) * r);
      }
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }
  }
  g.restore();
}

function drawHud(g: CanvasRenderingContext2D, fs: F[], t: number) {
  const w = Math.min(232, 1840 / fs.length);
  const x0 = 960 - (w * fs.length) / 2;
  fs.forEach((f, i) => {
    const x = x0 + i * w;
    g.globalAlpha = f.stocks > 0 ? 1 : 0.45;
    g.fillStyle = INK;
    g.beginPath();
    g.roundRect(x + 6, 928, w - 12, 138, 24);
    g.fill();
    g.fillStyle = '#fff';
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.roundRect(x + 6, 920, w - 12, 138, 24);
    g.fill();
    g.stroke();
    drawCharacter(g, x + 52, 1034, 66, {
      food: f.profile.food,
      color: f.profile.color,
      hat: f.profile.hat,
      acc: f.profile.acc,
      selfie: f.selfie,
      t,
      mood: f.stocks <= 0 ? 'sad' : f.stun > 0 ? 'wow' : 'happy',
    });
    roundRectText(g, f.profile.name, x + 16, 944, w - 32, 22, f.team !== undefined ? TEAMS[f.team].color : f.profile.color);
    const heat = Math.min(1, f.dmg / 150);
    g.fillStyle = `rgb(${Math.round(255)},${Math.round(214 - heat * 180)},${Math.round(10 + heat * 50)})`;
    g.font = `700 ${50 + Math.min(14, f.dmg / 12)}px Fredoka, sans-serif`;
    g.textAlign = 'center';
    g.lineWidth = 8;
    g.strokeStyle = INK;
    const shake = f.stun > 0 ? Math.sin(t * 60) * 3 : 0;
    g.strokeText(`${Math.round(f.dmg)}%`, x + w / 2 + 34 + shake, 1020);
    g.fillText(`${Math.round(f.dmg)}%`, x + w / 2 + 34 + shake, 1020);
    for (let k = 0; k < f.stocks; k++) {
      g.fillStyle = f.profile.color;
      g.beginPath();
      g.arc(x + w / 2 + 6 + k * 26, 1040, 10, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 3;
      g.stroke();
    }
    g.fillStyle = '#eee3f3';
    g.beginPath();
    g.roundRect(x + 100, 1046, w - 120, 10, 5);
    g.fill();
    g.fillStyle = f.meter >= 100 ? MENTHE : SOLEIL;
    g.beginPath();
    g.roundRect(x + 100, 1046, ((w - 120) * f.meter) / 100, 10, 5);
    g.fill();
    if (f.item) {
      g.font = '28px sans-serif';
      g.fillText(f.item === 'batte' ? '🏏' : '💣', x + w - 30, 960);
    }
    g.globalAlpha = 1;
  });
}

export const clash: GameBase = {
  id: 'combat',
  emoji: '🥊',
  name: { fr: 'Coussin Clash', en: 'Cushion Clash' },
  how: {
    fr: 'A saute · B frappe (+ stick pour varier) · objets à ramasser · bas + B jauge pleine = super !',
    en: 'A jumps · B hits (+ stick to vary) · grab items · down + B with full meter = super!',
  },
  inspired: 'Smash Bros',
  layout: 'stick',
  min: 2,
  max: 8,
  botFill: 4,
  music: 'tumble',
  limit: 150,
  timerTop: true,
  create,
};
