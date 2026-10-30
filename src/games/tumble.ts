// La Dégringolade : course d'obstacles vue de côté, inspirée des courses de jeux télé géants.
// La caméra suit le joueur en tête. 3 vies : tomber ou se faire distancer (sortir de l'écran) en coûte une.
import { dozing } from './botSkill';
import { drawCharacter } from '../shared/characters';
import { sfx } from '../shared/sound';
import { drawSky, candy } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const GRAV = 2600;
const RUN = 430;
const ACC = 3400;
const AIR_ACC = 2000;
const JUMP = 1180;
const BOUNCE = 1750;
const HALF_W = 20;
const BODY_H = 66;
const VIEW_W = 1920;
const DEATH_Y = 1250;
const BASE_Y = 860;
const MAX_TIME = 210;
const LIVES = 3;
const AFTER_FIRST = 25;

type Kind = 'ground' | 'block' | 'tile' | 'bounce' | 'conveyor' | 'mover' | 'sink' | 'door' | 'ice';

interface Solid {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: Kind;
  push?: number;
  touched?: number;
  gone?: number;
  squash?: number;
  move?: { bx: number; by: number; ax: number; ay: number; freq: number; ph: number };
  dx?: number;
  dy?: number;
  baseY?: number;
  /** Porte surprise : vraie (elle casse) ou fausse (on rebondit). */
  real?: boolean;
}

interface Fan {
  x: number;
  w: number;
  y: number;
  force: number;
}

/** Décors : chaque partie en tire un au hasard. */
const THEMES = [
  { name: { fr: 'La Pâtisserie', en: 'The Bakery' }, sky: ['#8fd8ff', '#ffd6ec'], sun: '#fff3a8', hills: ['#bfe8c4', '#ffc6e0'], ground: '#ffd9ea', top: '#ff7eb6' },
  { name: { fr: 'Le Jardin', en: 'The Garden' }, sky: ['#9ee4ff', '#e9ffd9'], sun: '#ffe66b', hills: ['#a5e08c', '#7cc96a'], ground: '#f6e3c4', top: '#7bd13b' },
  { name: { fr: 'La Nuit Pyjama', en: 'Pyjama Night' }, sky: ['#2a1838', '#6a4bd8'], sun: '#fff6c2', hills: ['#43306e', '#5b3f8c'], ground: '#c9b6ff', top: '#9b72ff' },
  { name: { fr: 'La Plage', en: 'The Beach' }, sky: ['#7fd6ff', '#fff1c9'], sun: '#ffe066', hills: ['#9fe3ff', '#ffe3a8'], ground: '#ffe9b8', top: '#ffb84d' },
  { name: { fr: 'Le Pays des Glaces', en: 'Ice Cream Land' }, sky: ['#d9f7ff', '#ffe3f1'], sun: '#fff3a8', hills: ['#ffc6e0', '#c9f5e3'], ground: '#fff6e0', top: '#ff9ccf' },
  { name: { fr: 'Le Volcan en chocolat', en: 'The Chocolate Volcano' }, sky: ['#ffb38a', '#ffe08a'], sun: '#fff3a8', hills: ['#c98a5a', '#a0643a'], ground: '#e8b98a', top: '#7a4a2a' },
];
type Theme = (typeof THEMES)[number];

interface Sweeper {
  cx: number;
  cy: number;
  len: number;
  speed: number;
  ang: number;
}

interface Hammer {
  cx: number;
  cy: number;
  len: number;
  amp: number;
  freq: number;
  ph: number;
  ang: number;
  vel: number;
}

interface Ball {
  x: number;
  y: number;
  r: number;
  vx: number;
  rot: number;
  minX: number;
}

interface Spawner {
  x: number;
  y: number;
  minX: number;
  every: number;
  t: number;
}

/** Gant de boxe qui sort d'un poteau et repousse. */
interface Glove {
  x: number;
  y: number;
  dir: 1 | -1;
  reach: number;
  freq: number;
  ph: number;
  out: number;
}

/** Zone où tombent des bonbons du ciel. */
interface Rain {
  x0: number;
  x1: number;
  y: number;
  every: number;
  t: number;
}

interface Drop {
  x: number;
  y: number;
  vy: number;
  r: number;
  ground: number;
  c: string;
}

interface Level {
  gloves: Glove[];
  rains: Rain[];
  drops: Drop[];
  solids: Solid[];
  sweepers: Sweeper[];
  hammers: Hammer[];
  spawners: Spawner[];
  balls: Ball[];
  checkpoints: { x: number; y: number }[];
  fans: Fan[];
  finishX: number;
  length: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ——— Fabrication du parcours : une suite de tronçons tirés au hasard ———

function buildLevel(): Level {
  const L: Level = { gloves: [], rains: [], drops: [], solids: [], sweepers: [], hammers: [], spawners: [], balls: [], checkpoints: [], fans: [], finishX: 0, length: 0 };
  let x = 0;
  let y = BASE_Y;
  /** 1 au début, plus dur vers la fin. */
  let diff = 1;
  const solid = (sx: number, sy: number, w: number, kind: Kind = 'ground', h?: number) => {
    const s: Solid = { x: sx, y: sy, w, h: h ?? (kind === 'ground' ? 1500 - sy : 34), kind };
    L.solids.push(s);
    return s;
  };
  /** Chaque tronçon commence par un palier sûr avec un point de reprise. */
  const entry = (w = 260) => {
    if (y < 620) y += 260;
    solid(x, y, w);
    L.checkpoints.push({ x: x + 90, y });
    x += w;
  };

  const segments: Record<string, () => void> = {
    trous() {
      entry();
      for (let i = 0; i < 4; i++) {
        x += rnd(120, 185);
        y = Math.min(BASE_Y, Math.max(y - 130, y + rnd(-130, 90)));
        const w = rnd(200, 320);
        solid(x, y, w);
        x += w;
      }
    },
    dalles() {
      entry();
      for (let i = 0; i < 8; i++) solid(x + i * 104, y, 100, 'tile');
      x += 8 * 104;
      solid(x, y, 240);
      x += 240;
    },
    trampoline() {
      entry();
      solid(x + 10, y + 50, 170, 'bounce', 40);
      x += 400;
      y -= 330;
      solid(x, y, 420);
      x += 420;
    },
    moulins() {
      entry();
      solid(x, y, 1000);
      L.sweepers.push({ cx: x + 330, cy: y - 150, len: 175, speed: 1.7 * diff, ang: rnd(0, 6) });
      L.sweepers.push({ cx: x + 720, cy: y - 150, len: 175, speed: -1.9 * diff, ang: rnd(0, 6) });
      x += 1000;
    },
    marteaux() {
      entry();
      solid(x, y, 1100);
      for (let i = 0; i < 3; i++)
        L.hammers.push({ cx: x + 280 + i * 280, cy: y - 400, len: 330, amp: 1.05, freq: rnd(1.4, 1.9) * diff, ph: rnd(0, 6), ang: 0, vel: 0 });
      x += 1100;
    },
    tapis() {
      entry();
      for (let i = 0; i < 3; i++) {
        x += i ? 90 : 0;
        y -= 70;
        const s = solid(x, y, 300, 'conveyor', 1500 - y);
        s.push = -250;
        x += 300;
      }
      solid(x, y, 260);
      x += 260;
    },
    oranges() {
      entry();
      const start = x;
      solid(x, y, 1350);
      x += 1350;
      L.spawners.push({ x: x - 40, y, minX: start - 200, every: rnd(1.3, 1.7) / diff, t: 0.5 });
    },
    nacelles() {
      entry();
      for (let i = 0; i < 3; i++) {
        const bx = x + 140 + i * 280;
        const s = solid(bx, y - 10, 170, 'mover', 30);
        s.move = i % 2 ? { bx, by: y - 10, ax: 0, ay: 80, freq: 1.3, ph: i } : { bx, by: y - 10, ax: 70, ay: 0, freq: 1.2, ph: i };
      }
      x += 140 + 3 * 280 + 60;
      solid(x, y, 260);
      x += 260;
    },
    portes() {
      // Un mur avec deux portes (en bas et en haut) : une vraie qui casse, une fausse qui fait rebondir.
      entry();
      solid(x, y, 1100);
      solid(x + 160, y - 200, 840, 'block');
      for (const wx of [x + 420, x + 760]) {
        const lowReal = Math.random() < 0.5;
        solid(wx, y - 620, 44, 'ground', 310);
        const up = solid(wx, y - 310, 44, 'door', 110);
        up.real = !lowReal;
        solid(wx, y - 200, 44, 'ground', 90);
        const low = solid(wx, y - 110, 44, 'door', 110);
        low.real = lowReal;
      }
      x += 1100;
    },
    ventilos() {
      // Des ventilateurs soufflent vers l'arrière : il faut avancer face au vent.
      entry();
      solid(x, y, 1100);
      L.fans.push({ x: x + 150, w: 380, y, force: -1300 });
      L.fans.push({ x: x + 640, w: 380, y, force: -1600 });
      x += 1100;
    },
    coulantes() {
      // Plateformes de caramel qui s'enfoncent quand on marche dessus.
      entry();
      for (let i = 0; i < 5; i++) {
        x += 110;
        const s = solid(x, y - (i % 2) * 60, 170, 'sink', 34);
        s.baseY = s.y;
        x += 170;
      }
      x += 110;
      solid(x, y, 260);
      x += 260;
    },
    glace() {
      // Sol glacé : on glisse, et deux petits trous à sauter
      entry();
      for (let i = 0; i < 3; i++) {
        solid(x, y, 380, 'ice');
        x += 380 + (i < 2 ? 150 : 0);
      }
      solid(x, y, 200);
      x += 200;
    },
    gants() {
      // Des gants de boxe sortent des poteaux pour repousser vers le vide
      entry();
      for (let i = 0; i < 3; i++) {
        solid(x, y, 300);
        L.gloves.push({ x: x + 150, y: y - 60 - (i % 2) * 70, dir: -1, reach: 150, freq: rnd(1.6, 2.2) * diff, ph: rnd(0, 6), out: 0 });
        x += 300 + 140;
      }
      solid(x, y, 220);
      x += 220;
    },
    pluie() {
      // Pluie de bonbons géants : on regarde les ombres au sol
      entry();
      solid(x, y, 1200);
      L.rains.push({ x0: x + 120, x1: x + 1080, y, every: 0.45 / diff, t: 0 });
      x += 1200;
    },
    escaliers() {
      entry();
      for (let i = 0; i < 6; i++) {
        const up = i < 3 ? 1 : -1;
        y -= up * 85;
        x += 80;
        solid(x, y, 150, 'block', 40);
        x += 150;
      }
      x += 90;
    },
  };

  // Départ
  solid(x, y, 760);
  L.checkpoints.push({ x: 200, y });
  x += 760;
  // Parcours long : 12 tronçons, tous différents puis quelques-uns qui reviennent, de plus en plus durs.
  const all = Object.keys(segments).sort(() => Math.random() - 0.5);
  const keys = [...all, ...all.sort(() => Math.random() - 0.5)].slice(0, 12);
  keys.forEach((k, i) => {
    diff = 1 + i * 0.05;
    segments[k]();
  });
  // Arrivée
  entry(500);
  L.finishX = x - 150;
  solid(x, y, 1500);
  L.length = x + 900;
  return L;
}

// ——— Joueurs ———

interface P extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  onGround: boolean;
  ground: Solid | null;
  coyote: number;
  jumpBuf: number;
  diveReq: boolean;
  diving: number;
  stun: number;
  invuln: number;
  cp: number;
  done: number;
  falls: number;
  lives: number;
  /** Moment de l'élimination (0 = encore en course). */
  out: number;
  inp: { x: number; a: boolean; b: boolean };
  lastA: boolean;
  lastB: boolean;
  // bots
  botHold: number;
  botWait: number;
  stuckX: number;
  stuckT: number;
}

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const L = buildLevel();
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const ps: P[] = runners.map((r, i) => ({
    ...r,
    x: 120 + i * 40,
    y: BASE_Y,
    vx: 0,
    vy: 0,
    dir: 1,
    onGround: true,
    ground: null,
    coyote: 0,
    jumpBuf: 0,
    diveReq: false,
    diving: 0,
    stun: 0,
    invuln: 0,
    cp: 0,
    done: 0,
    falls: 0,
    lives: LIVES,
    out: 0,
    inp: { x: 0, a: false, b: false },
    lastA: false,
    lastB: false,
    botHold: 0,
    botWait: 0,
    stuckX: 0,
    stuckT: 0,
  }));
  let time = 0;
  let camX = 0;
  // Caméra : elle dézoome quand le peloton s'étale (z = 1 : vue normale).
  let camZ = 1;
  const viewW = () => VIEW_W / camZ;
  // Qualification façon émission de jeu : environ 70 % des coureurs passent.
  const quota = ps.length <= 2 ? ps.length : Math.max(1, Math.ceil(ps.length * 0.7));
  let banner = '';
  let bannerT = 0;
  let shake = 0;
  const fr = ctx.lang === 'fr';
  const reached = new Map<number, string>();
  type Part = { x: number; y: number; vx: number; vy: number; t: number; max: number; size: number; color: string; kind: 'dust' | 'star' | 'drop' | 'confetti' | 'ring' };
  const parts: Part[] = [];
  const pops: { x: number; y: number; text: string; color: string; t: number; size: number }[] = [];
  const maxParts = ctx.light ? 50 : 200;
  function burst(x: number, y: number, n: number, kind: Part['kind'], color: string | string[], speed = 300, size = 10, up = 0) {
    for (let k = 0; k < n && parts.length < maxParts; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * rnd(0.4, 1);
      const c = Array.isArray(color) ? color[k % color.length] : color;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, t: 0, max: rnd(0.4, 0.9), size: size * rnd(0.6, 1.3), color: c, kind });
    }
  }
  let order = 0;
  let firstAt = -1;
  let endDelay = -1;

  /** Plateformes fines : on les traverse par en dessous, on atterrit dessus. */
  const oneWay = (s: Solid) => s.kind === 'block' || s.kind === 'mover' || s.kind === 'tile' || s.kind === 'sink';
  const active = (s: Solid) => !((s.kind === 'tile' || s.kind === 'sink' || s.kind === 'door') && s.gone !== undefined);
  const solidAt = (px: number, py: number) =>
    L.solids.find((s) => active(s) && px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h);

  function respawn(p: P, cpIndex: number) {
    const c = L.checkpoints[cpIndex];
    p.cp = cpIndex;
    p.x = c.x + rnd(-40, 40);
    p.y = c.y - 220;
    p.vx = p.vy = 0;
    p.stun = 0.3;
    p.invuln = 1.2;
    p.diving = 0;
    p.ground = null;
    p.falls++;
  }

  /** Une vie en moins ; à zéro, éliminé. Renvoie vrai si le joueur est éliminé. */
  function loseLife(p: P): boolean {
    p.lives--;
    if (!p.bot) ctx.buzz(p.pid, p.lives > 0 ? 300 : 700);
    if (p.lives > 0) {
      pops.push({ x: p.x, y: p.y - 170, text: `-1 ❤️`, color: '#ff4f9a', t: 1.2, size: 46 });
      return false;
    }
    p.out = time || 0.01;
    burst(p.x, p.y - 60, 18, 'star', ['#ff4f9a', '#fff'], 500, 14, 200);
    pops.push({ x: p.x, y: p.y - 170, text: fr ? 'ÉLIMINÉ !' : 'OUT!', color: '#ff4f9a', t: 1.6, size: 60 });
    banner = fr ? `${p.profile.name} est éliminé !` : `${p.profile.name} is out!`;
    bannerT = 1.8;
    sfx.pet();
    return true;
  }

  function hit(p: P, kx: number, power: number) {
    if (p.invuln > 0 || p.done) return;
    p.vx = kx * power;
    p.vy = -620;
    p.stun = 0.55;
    p.invuln = 0.9;
    p.diving = 0;
    p.onGround = false;
    p.ground = null;
    sfx.boing();
    if (!p.bot) ctx.buzz(p.pid, 120);
    shake = Math.max(shake, 12);
    burst(p.x, p.y - BODY_H / 2, 8, 'star', '#ffd60a', 420, 12);
    parts.push({ x: p.x, y: p.y - BODY_H / 2, vx: 0, vy: 0, t: 0, max: 0.3, size: 70, color: '#fff', kind: 'ring' });
  }

  function botThink(p: P, dt: number) {
    p.inp.x = 1;
    // Anti-blocage : un bot qui n'avance plus depuis 3 s passe au point de reprise suivant.
    if (p.x > p.stuckX + 40) {
      p.stuckX = p.x;
      p.stuckT = 0;
    } else if ((p.stuckT += dt) > 4) {
      p.stuckT = 0;
      respawn(p, Math.min(p.cp + 1, L.checkpoints.length - 1));
      p.stuckX = p.x;
      return;
    }
    if (p.botHold > 0) {
      p.botHold -= dt;
      p.inp.a = p.botHold > 0;
      return;
    }
    p.inp.a = false;
    if (!p.onGround || p.stun > 0) return;
    const gapAhead = !solidAt(p.x + 55, p.y + 6);
    const wallAhead = !!solidAt(p.x + 40, p.y - 30);
    let want = wallAhead;
    if (gapAhead) {
      // Y a-t-il un endroit où atterrir ? Sinon on attend (nacelle qui revient).
      const landing = L.solids.some(
        (s) => active(s) && s.x < p.x + 320 && s.x + s.w > p.x + 70 && s.y > p.y - 170 && s.y < p.y + 160,
      );
      const pad = L.solids.some((s) => s.kind === 'bounce' && s.x < p.x + 260 && s.x + s.w > p.x);
      if (pad) want = false;
      else if (landing) want = true;
      else p.inp.x = 0;
    }
    for (const b of L.balls) if (b.x - p.x > 0 && b.x - p.x < 210 && Math.abs(b.y - p.y) < 120) want = true;
    for (const s of L.sweepers)
      if (Math.abs(s.cx - p.x) < 200 && Math.random() < 0.06) want = true;
    for (const h of L.hammers) {
      const hx = h.cx + Math.sin(h.ang) * h.len;
      if (hx - p.x > 0 && hx - p.x < 140 && Math.random() < 0.2) p.inp.x = p.botWait > 0 ? 0 : 1;
    }
    if (want && Math.random() < 0.9) {
      p.jumpBuf = 0.12;
      p.botHold = rnd(0.42, 0.55);
    }
  }

  function stepPlayer(p: P, dt: number) {
    if (p.out) return;
    if (p.bot && !p.done) {
      if (dozing(p, ctx.botSkill, dt)) p.inp = { x: 0, a: false, b: false };
      else botThink(p, dt);
    }
    p.stun = Math.max(0, p.stun - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    p.coyote = Math.max(0, p.coyote - dt);

    // Transporté par une nacelle
    if (p.ground?.kind === 'mover' && p.onGround) {
      p.x += p.ground.dx ?? 0;
      p.y += p.ground.dy ?? 0;
    }

    const control = p.stun <= 0 && !p.done;
    let mx = 0;
    if (control && Math.abs(p.inp.x) > 0.22) mx = Math.sign(p.inp.x) * Math.min(1, (Math.abs(p.inp.x) - 0.1) / 0.6);
    if (p.done) mx = 0.15;
    if (mx) p.dir = mx > 0 ? 1 : -1;
    const push = p.onGround && p.ground?.kind === 'conveyor' ? p.ground.push ?? 0 : 0;

    if (p.diving > 0) {
      p.diving -= dt;
      if (p.onGround) p.vx *= Math.pow(0.05, dt);
    } else if (p.stun <= 0) {
      const target = mx * RUN + push;
      const a = (p.onGround ? (p.ground?.kind === 'ice' ? ACC * 0.16 : ACC) : AIR_ACC) * dt;
      p.vx += Math.max(-a, Math.min(a, target - p.vx));
    } else if (p.onGround) p.vx *= Math.pow(0.02, dt);

    if (control && p.jumpBuf > 0 && (p.onGround || p.coyote > 0) && p.diving <= 0) {
      p.vy = -JUMP;
      p.jumpBuf = 0;
      p.coyote = 0;
      p.onGround = false;
      p.ground = null;
      if (!ctx.light) sfx.step();
    }
    if (control && p.diveReq && p.diving <= 0) {
      p.vx = p.dir * 720;
      p.vy = Math.min(p.vy, -280);
      p.diving = 0.65;
      p.onGround = false;
    }
    p.diveReq = false;
    if (p.onGround && Math.abs(p.vx) > 300 && !ctx.light && Math.random() < 0.12) burst(p.x - p.dir * 20, p.y - 6, 1, 'dust', '#ffffff', 50, 12);

    // Ventilateurs : le vent pousse vers l'arrière (moins fort en l'air au ras du sol)
    for (const fan of L.fans)
      if (p.x > fan.x && p.x < fan.x + fan.w && p.y <= fan.y + 4 && p.y > fan.y - 420) p.vx += fan.force * dt * (p.diving > 0 ? 0.4 : 1);

    // Saut plus court si on relâche A
    p.vy += GRAV * dt * (p.vy < 0 && !p.inp.a && p.diving <= 0 ? 1.7 : 1);
    p.vy = Math.min(p.vy, 1700);

    // Déplacement horizontal puis vertical, avec collisions
    p.x += p.vx * dt;
    for (const s of L.solids) {
      if (!active(s) || oneWay(s)) continue;
      if (p.x + HALF_W > s.x && p.x - HALF_W < s.x + s.w && p.y > s.y + 2 && p.y - BODY_H < s.y + s.h) {
        if (s.kind === 'door') {
          if (s.real) {
            // Vraie porte : elle vole en éclats
            s.gone = time;
            burst(s.x + s.w / 2, s.y + s.h / 2, 14, 'confetti', ['#c98a5a', '#e8b98a', '#fff'], 520, 14);
            sfx.pop();
            shake = Math.max(shake, 8);
            continue;
          }
          // Fausse porte : on rebondit en arrière
          p.x = p.x < s.x + s.w / 2 ? s.x - HALF_W : s.x + s.w + HALF_W;
          p.vx = -p.dir * 520;
          p.vy = -260;
          p.stun = 0.25;
          burst(p.x, p.y - BODY_H / 2, 5, 'star', '#fff', 300, 10);
          sfx.boing();
          continue;
        }
        if (p.x < s.x + s.w / 2) p.x = s.x - HALF_W;
        else p.x = s.x + s.w + HALF_W;
        p.vx = 0;
      }
    }
    const prevY = p.y;
    p.y += p.vy * dt;
    const wasGround = p.onGround;
    p.onGround = false;
    for (const s of L.solids) {
      if (!active(s)) continue;
      if (p.x + HALF_W <= s.x || p.x - HALF_W >= s.x + s.w) continue;
      if (p.vy >= 0 && prevY <= s.y + 4 && p.y >= s.y) {
        p.y = s.y;
        if (s.kind === 'bounce') {
          p.vy = -BOUNCE;
          s.squash = 1;
          sfx.boing();
          continue;
        }
        if (!wasGround && p.vy > 650 && !ctx.light) burst(p.x, s.y - 4, 5, 'dust', '#ffffff', 200, 14);
        p.vy = 0;
        p.onGround = true;
        p.ground = s;
        if ((s.kind === 'tile' || s.kind === 'sink') && s.touched === undefined) s.touched = time;
      } else if (!oneWay(s) && p.vy < 0 && p.y - BODY_H < s.y + s.h && prevY - BODY_H >= s.y + s.h - 4) {
        p.y = s.y + s.h + BODY_H;
        p.vy = 0;
      }
    }
    if (wasGround && !p.onGround && p.vy >= 0) p.coyote = 0.1;
    if (!p.onGround) p.ground = null;
    if (p.onGround && p.diving > 0 && Math.abs(p.vx) < 60) p.diving = 0;

    // Points de reprise
    while (p.cp + 1 < L.checkpoints.length && p.x > L.checkpoints[p.cp + 1].x) {
      p.cp++;
      if (!reached.has(p.cp)) {
        reached.set(p.cp, p.profile.color);
        const c = L.checkpoints[p.cp];
        burst(c.x - 40, c.y - 90, 10, 'star', [p.profile.color, '#ffd60a'], 320, 10, 120);
        if (!p.bot) sfx.tick();
      }
    }

    // Chute dans le vide
    if (p.y > DEATH_Y) {
      burst(p.x, BASE_Y + 120, 14, 'drop', '#2ec5ff', 520, 14, 300);
      pops.push({ x: p.x, y: BASE_Y + 60, text: ctx.family ? 'Oups !' : 'PLOUF !', color: '#2ec5ff', t: 1, size: 56 });
      if (!ctx.light) sfx.pet();
      // Les bots, maladroits, ne perdent une vie qu'une chute sur trois
      if (p.bot && p.falls % 3 !== 2) respawn(p, p.cp);
      else if (!loseLife(p)) respawn(p, p.cp);
    }

    // Arrivée
    if (!p.done && p.x >= L.finishX) {
      p.done = ++order;
      if (firstAt < 0) firstAt = time;
      sfx.finish();
      if (!p.bot) ctx.buzz(p.pid, 300);
      burst(p.x, p.y - 120, 24, 'confetti', ['#ff4f9a', '#ffd60a', '#2ec5ff', '#1fc9a0', '#9b5cff'], 560, 12, 300);
      pops.push({ x: p.x, y: p.y - 150, text: fr ? 'QUALIFIÉ !' : 'QUALIFIED!', color: p.profile.color, t: 1.3, size: 52 });
      if (order === quota) {
        banner = fr ? 'Les places sont prises !' : 'All spots taken!';
        bannerT = 2.5;
      }
    }
  }

  function hazards(p: P) {
    if (p.invuln > 0 || p.done || p.out) return;
    for (const gl of L.gloves) {
      const gx = gl.x + gl.dir * gl.out;
      if (gl.out > 30 && Math.abs(p.x - gx) < 50 && p.y > gl.y - 10 && p.y - BODY_H < gl.y + 40) {
        hit(p, gl.dir === -1 ? (p.x < gl.x ? -1 : 1) : 1, 820);
        return;
      }
    }
    for (const d of L.drops)
      if (Math.hypot(p.x - d.x, p.y - BODY_H / 2 - d.y) < d.r + 26) {
        d.y = d.ground + 999;
        hit(p, Math.random() < 0.5 ? -1 : 1, 380);
        return;
      }
    const pts = [p.y - 12, p.y - BODY_H / 2, p.y - BODY_H + 8];
    for (const s of L.sweepers) {
      const cx = Math.cos(s.ang);
      const sy = Math.sin(s.ang);
      for (const py of pts) {
        // Distance au bâton (deux bras de part et d'autre de l'axe)
        const rx = p.x - s.cx;
        const ry = py - s.cy;
        const tproj = Math.max(-s.len, Math.min(s.len, rx * cx + ry * sy));
        const d = Math.hypot(rx - tproj * cx, ry - tproj * sy);
        if (d < 32) {
          const tangent = -s.speed * (tproj * sy);
          hit(p, Math.sign(tangent) || Math.sign(rx) || -1, 620);
          return;
        }
      }
    }
    for (const h of L.hammers) {
      const hx = h.cx + Math.sin(h.ang) * h.len;
      const hy = h.cy + Math.cos(h.ang) * h.len;
      if (Math.hypot(p.x - hx, p.y - BODY_H / 2 - hy) < 70) {
        hit(p, Math.sign(Math.cos(h.ang) * h.vel) || 1, 900);
        return;
      }
    }
    for (const b of L.balls)
      if (Math.hypot(p.x - b.x, p.y - BODY_H / 2 - b.y) < b.r + 24) {
        hit(p, -1, 560);
        return;
      }
  }

  function stepWorld(dt: number) {
    for (const s of L.solids) {
      if (s.move) {
        const nx = s.move.bx + Math.sin(time * s.move.freq * 2 + s.move.ph) * s.move.ax;
        const ny = s.move.by + Math.sin(time * s.move.freq * 2 + s.move.ph) * s.move.ay;
        s.dx = nx - s.x;
        s.dy = ny - s.y;
        s.x = nx;
        s.y = ny;
      }
      if (s.kind === 'sink' && s.baseY !== undefined) {
        if (s.gone !== undefined) {
          if (time - s.gone > 2.5) {
            s.y = s.baseY;
            s.touched = s.gone = undefined;
          }
        } else if (s.touched !== undefined) {
          s.y += 150 * dt;
          s.dy = 150 * dt;
          if (s.y > s.baseY + 280) s.gone = time;
        }
      }
      if (s.kind === 'tile') {
        if (s.touched !== undefined && s.gone === undefined && time - s.touched > 0.55) s.gone = time;
        if (s.gone !== undefined && time - s.gone > 3.5) s.touched = s.gone = undefined;
      }
      if (s.squash) s.squash = Math.max(0, s.squash - dt * 4);
    }
    for (const s of L.sweepers) s.ang += s.speed * dt;
    // Gants : ils sortent d'un coup puis rentrent doucement
    for (const gl of L.gloves) {
      const ph = ((time * gl.freq + gl.ph) % (Math.PI * 2)) / (Math.PI * 2);
      gl.out = ph < 0.12 ? (ph / 0.12) * gl.reach : ph < 0.4 ? gl.reach : Math.max(0, gl.reach * (1 - (ph - 0.4) / 0.3));
    }
    for (const r of L.rains) {
      r.t -= dt;
      if (r.t <= 0 && r.x0 < camX + viewW() + 300 && r.x1 > camX - 200) {
        r.t = r.every * rnd(0.7, 1.3);
        L.drops.push({ x: rnd(r.x0, r.x1), y: r.y - 1200, vy: 300, r: rnd(28, 40), ground: r.y, c: ['#ff4f9a', '#2ec5ff', '#ffd60a', '#1fc9a0'][Math.floor(Math.random() * 4)] });
      }
    }
    for (const d of L.drops) {
      d.vy += 1400 * dt;
      d.y += d.vy * dt;
      if (d.y > d.ground - d.r && d.y < d.ground + 100) {
        burst(d.x, d.ground - 6, 6, 'confetti', [d.c, '#fff'], 300, 9, 200);
        d.y = d.ground + 999;
      }
    }
    L.drops = L.drops.filter((d) => d.y < d.ground + 500);
    for (const h of L.hammers) {
      const prev = h.ang;
      h.ang = Math.sin(time * h.freq + h.ph) * h.amp;
      h.vel = (h.ang - prev) / dt;
    }
    for (const sp of L.spawners) {
      sp.t -= dt;
      if (sp.t <= 0 && sp.x < camX + viewW() + 600) {
        sp.t = sp.every * rnd(0.8, 1.3);
        const r = rnd(38, 52);
        L.balls.push({ x: sp.x, y: sp.y - r, r, vx: -rnd(360, 460), rot: 0, minX: sp.minX });
      }
    }
    for (const b of L.balls) {
      b.x += b.vx * dt;
      b.rot += (b.vx / b.r) * dt;
    }
    L.balls = L.balls.filter((b) => b.x > b.minX);
  }

  function stepCamera(dt: number) {
    const racing = ps.filter((p) => !p.done && !p.out);
    const pack = racing.length ? racing : ps;
    const lead = Math.max(...pack.map((p) => p.x));
    // Dézoome pour garder le peloton à l'écran (jusqu'à 70 %).
    const back = Math.min(...pack.map((p) => p.x));
    const wantZ = Math.max(0.7, Math.min(1, VIEW_W / (lead - back + 1150)));
    camZ += (wantZ - camZ) * Math.min(1, dt * 1.5);
    const target = Math.min(L.length - viewW(), Math.max(0, lead - viewW() * 0.6));
    if (target > camX) camX += (target - camX) * Math.min(1, dt * 3);
    // Trop loin derrière : replacé au premier point de reprise visible.
    for (const p of ps) {
      if (p.done || p.out || p.invuln > 0 || p.x > camX - 40) continue;
      // Distancé : une vie en moins, et on repart au premier drapeau visible
      pops.push({ x: camX + 160, y: p.y - 120, text: fr ? 'Trop lent !' : 'Too slow!', color: '#ffd60a', t: 1, size: 44 });
      if (loseLife(p)) continue;
      let idx = L.checkpoints.findIndex((c) => c.x > camX + 300);
      if (idx < 0) idx = L.checkpoints.length - 1;
      respawn(p, idx);
      p.stun = 0.6;
      p.invuln = 2.5;
    }
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const p = ps.find((x) => x.pid === pid);
      if (!p) return;
      // Les appuis sont mémorisés même si A est relâché avant la prochaine image.
      if (m.a && !p.lastA) p.jumpBuf = 0.15;
      if (m.b && !p.lastB) p.diveReq = true;
      p.lastA = m.a;
      p.lastB = m.b;
      p.inp = { x: m.x, a: m.a, b: m.b };
    },
    update(dt) {
      time += dt;
      shake = Math.max(0, shake - dt * 50);
      bannerT -= dt;
      for (const q of parts) {
        q.t += dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= Math.pow(0.2, dt);
        q.vy = q.vy * Math.pow(0.2, dt) + (q.kind === 'confetti' || q.kind === 'drop' ? 900 * dt : 0);
      }
      for (let k = parts.length - 1; k >= 0; k--) if (parts[k].t >= parts[k].max) parts.splice(k, 1);
      for (const q of pops) {
        q.t -= dt;
        q.y -= 50 * dt;
      }
      while (pops.length && pops[0].t <= 0) pops.shift();
      stepWorld(dt);
      for (const p of ps) stepPlayer(p, dt);
      for (const p of ps) hazards(p);
      // Les joueurs se bousculent
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i];
          const b = ps[j];
          if (a.done || b.done || a.out || b.out) continue;
          const dx = b.x - a.x;
          if (Math.abs(dx) < 36 && Math.abs(b.y - a.y) < 20) {
            const push = (36 - Math.abs(dx)) / 2;
            const s = dx >= 0 ? 1 : -1;
            a.x -= s * push;
            b.x += s * push;
          }
        }
      stepCamera(dt);
      const humansDone = ps.some((p) => !p.bot) ? ps.every((p) => p.bot || p.done || p.out) : ps.every((p) => p.done || p.out);
      if (endDelay < 0 && (humansDone || ps.every((p) => p.done || p.out) || order >= quota || time > MAX_TIME || (firstAt >= 0 && time - firstAt > AFTER_FIRST))) endDelay = 2.5;
      if (endDelay >= 0) {
        endDelay -= dt;
        if (endDelay <= 0) game.over = true;
      }
    },
    render(g, t) {
      drawSky(g, t, ctx.light, theme.sky[0], theme.sky[1], theme.sun);
      drawHills(g, camX, theme);
      g.save();
      const sx = shake ? rnd(-shake, shake) : 0;
      const sy = shake ? rnd(-shake, shake) : 0;
      // Le sol reste à la même hauteur à l'écran quand on dézoome.
      g.translate(sx, BASE_Y * (1 - camZ) + sy);
      g.scale(camZ, camZ);
      g.translate(-Math.round(camX), 0);
      const x0 = camX - 200;
      const x1 = camX + viewW() + 200;
      drawFinish(g, L.finishX, L.solids, ctx.lang);
      L.checkpoints.forEach((c, i) => {
        if (c.x > x0 && c.x < x1) drawFlag(g, c.x - 60, c.y, reached.get(i), t);
      });
      for (const s of L.solids) if (s.x + s.w > x0 && s.x < x1) drawSolid(g, s, time, ctx.light, theme);
      for (const fan of L.fans) if (fan.x + fan.w > x0 && fan.x < x1) drawFan(g, fan, time, ctx.light);
      for (const h of L.hammers) if (Math.abs(h.cx - camX - viewW() / 2) < viewW()) drawHammer(g, h);
      for (const s of L.sweepers) if (Math.abs(s.cx - camX - viewW() / 2) < viewW()) drawSweeper(g, s);
      for (const b of L.balls) if (b.x > x0 && b.x < x1) drawBall(g, b);
      for (const gl of L.gloves) if (gl.x > x0 && gl.x < x1) drawGlove(g, gl);
      for (const d of L.drops) {
        if (d.x < x0 || d.x > x1) continue;
        // Ombre au sol qui grossit quand le bonbon approche
        const k = Math.max(0, Math.min(1, 1 - (d.ground - d.y) / 1200));
        g.fillStyle = 'rgba(58,33,64,0.25)';
        g.beginPath();
        g.ellipse(d.x, d.ground + 2, d.r * (0.4 + k), 8 + k * 6, 0, 0, Math.PI * 2);
        g.fill();
        drawCandy(g, d);
      }
      ps.forEach((p, i) => !p.out && drawPlayer(g, p, t + i * 0.3));
      // Particules
      for (const q of parts) {
        const k = q.t / q.max;
        g.globalAlpha = 1 - k;
        g.fillStyle = q.color;
        if (q.kind === 'ring') {
          g.strokeStyle = q.color;
          g.lineWidth = 8 * (1 - k) + 2;
          g.beginPath();
          g.arc(q.x, q.y, q.size * (0.3 + k), 0, Math.PI * 2);
          g.stroke();
        } else if (q.kind === 'confetti') {
          g.save();
          g.translate(q.x, q.y);
          g.rotate(q.t * 10);
          g.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
          g.restore();
        } else if (q.kind === 'star') {
          g.save();
          g.translate(q.x, q.y);
          g.rotate(q.t * 8);
          g.beginPath();
          for (let st = 0; st < 10; st++) {
            const r = st % 2 ? q.size * 0.45 : q.size;
            g.lineTo(Math.cos((st * Math.PI) / 5) * r, Math.sin((st * Math.PI) / 5) * r);
          }
          g.fill();
          g.restore();
        } else {
          g.beginPath();
          g.arc(q.x, q.y, q.size * (q.kind === 'dust' ? 0.6 + k : 1 - k * 0.4), 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
      for (const q of pops) {
        g.globalAlpha = Math.min(1, q.t * 2);
        g.font = `700 ${q.size}px Fredoka, sans-serif`;
        g.textAlign = 'center';
        g.lineWidth = q.size * 0.22;
        g.strokeStyle = INK;
        g.strokeText(q.text, q.x, q.y);
        g.fillStyle = q.color;
        g.fillText(q.text, q.x, q.y);
      }
      g.globalAlpha = 1;
      g.restore();
      drawHud(g, ps, L, time, order, quota, ctx.lang, t);
      if (bannerT > 0) {
        g.font = '700 84px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 18;
        g.strokeStyle = INK;
        g.strokeText(banner, 960, 560);
        g.fillStyle = '#ffd60a';
        g.fillText(banner, 960, 560);
      }
    },
    mapName: theme.name,
    /** Éliminé : son téléphone devient un fantôme qui peut se venger. */
    out: (pid) => !!ps.find((p) => p.pid === pid && p.lives <= 0),
    ranking() {
      return [...ps].sort((a, b) => (a.done || 99) - (b.done || 99) || Number(!!a.out) - Number(!!b.out) || b.out - a.out || b.x - a.x).map((p) => p.pid);
    },
    leader() {
      return ps.find((p) => p.done === 1)?.profile.name ?? null;
    },
  };
  return game;
}

// ——— Dessin ———

function drawHills(g: CanvasRenderingContext2D, camX: number, theme: Theme) {
  g.fillStyle = theme.hills[0];
  const off = (camX * 0.25) % 700;
  for (let i = -1; i < 5; i++) {
    g.beginPath();
    g.ellipse(i * 700 - off + 200, 1000, 420, 300, 0, Math.PI, 0);
    g.fill();
  }
  g.fillStyle = theme.hills[1];
  const off2 = (camX * 0.45) % 560;
  for (let i = -1; i < 6; i++) {
    g.beginPath();
    g.ellipse(i * 560 - off2 + 60, 1080, 300, 230, 0, Math.PI, 0);
    g.fill();
  }
}

function drawFan(g: CanvasRenderingContext2D, f: Fan, time: number, light: boolean) {
  // Le ventilateur, au bout de la zone, souffle vers la gauche.
  const x = f.x + f.w + 30;
  const y = f.y - 110;
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.fillStyle = '#b8c6dd';
  g.fillRect(x - 8, y, 16, 110);
  g.strokeRect(x - 8, y, 16, 110);
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(x, y, 26, 70, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#2ec5ff';
  for (let k = 0; k < 3; k++) {
    const a = time * 18 + (k * Math.PI * 2) / 3;
    g.beginPath();
    g.ellipse(x, y + Math.sin(a) * 34, 12, 26 * Math.abs(Math.cos(a)) + 4, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (light) return;
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 5;
  for (let k = 0; k < 6; k++) {
    const wx = f.x + f.w - ((time * 520 + k * 140) % f.w);
    const wy = f.y - 60 - (k % 3) * 100;
    g.beginPath();
    g.moveTo(wx, wy);
    g.lineTo(wx + 70, wy);
    g.stroke();
  }
}

function drawSolid(g: CanvasRenderingContext2D, s: Solid, time: number, light: boolean, theme: Theme) {
  g.lineWidth = 4;
  g.strokeStyle = INK;
  const h = Math.min(s.h, 1300 - s.y);
  switch (s.kind) {
    case 'ice': {
      g.fillStyle = '#d8f3ff';
      g.beginPath();
      g.roundRect(s.x, s.y, s.w, h, [14, 14, 0, 0]);
      g.fill();
      g.stroke();
      g.fillStyle = '#8fdcff';
      g.beginPath();
      g.roundRect(s.x, s.y, s.w, 20, [14, 14, 0, 0]);
      g.fill();
      g.stroke();
      g.strokeStyle = '#fff';
      g.lineWidth = 5;
      for (let x = s.x + 30; x < s.x + s.w - 40; x += 90) {
        g.beginPath();
        g.moveTo(x, s.y + 8);
        g.lineTo(x + 34, s.y + 8);
        g.stroke();
      }
      g.strokeStyle = INK;
      break;
    }
    case 'ground':
    case 'block': {
      g.fillStyle = theme.ground;
      g.beginPath();
      g.roundRect(s.x, s.y, s.w, h, s.kind === 'block' ? 12 : [14, 14, 0, 0]);
      g.fill();
      g.stroke();
      candy(g, s.x, s.y + 16, s.w, Math.min(h - 16, 90), 12);
      g.fillStyle = theme.top;
      g.beginPath();
      g.roundRect(s.x, s.y, s.w, 20, [14, 14, 0, 0]);
      g.fill();
      if (!light) for (let x = s.x + 22; x < s.x + s.w - 10; x += 46) {
        g.beginPath();
        g.arc(x, s.y + 20, 9, 0, Math.PI);
        g.fill();
      }
      g.beginPath();
      g.roundRect(s.x, s.y, s.w, h, s.kind === 'block' ? 12 : [14, 14, 0, 0]);
      g.stroke();
      break;
    }
    case 'door': {
      if (s.gone !== undefined) break;
      // Porte en bois avec un point d'interrogation (vraie et fausse se ressemblent)
      g.fillStyle = '#c98a5a';
      g.beginPath();
      g.roundRect(s.x - 4, s.y, s.w + 8, s.h, 10);
      g.fill();
      g.stroke();
      g.fillStyle = '#fff';
      g.font = '700 40px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillText('?', s.x + s.w / 2, s.y + s.h / 2 + 14);
      break;
    }
    case 'sink': {
      if (s.gone !== undefined) break;
      g.fillStyle = s.touched !== undefined ? '#c27a3a' : '#e09a52';
      g.beginPath();
      g.roundRect(s.x, s.y, s.w, s.h, 14);
      g.fill();
      g.stroke();
      g.fillStyle = '#ffd590';
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(s.x + 30 + k * 55, s.y + s.h, 8 + (k % 2) * 4, 0, Math.PI);
        g.fill();
      }
      break;
    }
    case 'tile': {
      let y = s.y;
      let alpha = 1;
      let shake = 0;
      if (s.gone !== undefined) {
        const k = time - s.gone;
        y += k * k * 900;
        alpha = Math.max(0, 1 - k * 1.5);
      } else if (s.touched !== undefined) shake = Math.sin(time * 70) * 3;
      if (alpha <= 0) break;
      g.globalAlpha = alpha;
      g.fillStyle = s.touched !== undefined ? '#ffb020' : '#ffd60a';
      g.beginPath();
      g.roundRect(s.x + 2 + shake, y, s.w - 4, s.h, 8);
      g.fill();
      g.stroke();
      g.globalAlpha = 1;
      break;
    }
    case 'bounce': {
      const sq = (s.squash ?? 0) * 14;
      g.fillStyle = '#2ec5ff';
      g.beginPath();
      g.ellipse(s.x + s.w / 2, s.y + 16 + sq / 2, s.w / 2, 22 - sq / 2, 0, Math.PI, 0);
      g.lineTo(s.x + s.w, s.y + s.h);
      g.lineTo(s.x, s.y + s.h);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath();
      g.ellipse(s.x + s.w * 0.35, s.y + 8 + sq, 14, 5, -0.3, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'conveyor': {
      g.fillStyle = '#b9a7d9';
      g.beginPath();
      g.roundRect(s.x, s.y, s.w, h, [12, 12, 0, 0]);
      g.fill();
      g.stroke();
      g.fillStyle = '#6e5a99';
      g.fillRect(s.x + 4, s.y + 4, s.w - 8, 18);
      g.strokeStyle = '#fff';
      g.lineWidth = 4;
      const off = ((time * (s.push ?? 0)) % 40 + 40) % 40;
      g.save();
      g.beginPath();
      g.rect(s.x + 4, s.y + 4, s.w - 8, 18);
      g.clip();
      for (let x = s.x + off - 40; x < s.x + s.w + 40; x += 40) {
        g.beginPath();
        g.moveTo(x + 8, s.y + 7);
        g.lineTo(x, s.y + 13);
        g.lineTo(x + 8, s.y + 19);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = INK;
      break;
    }
    case 'mover':
      g.fillStyle = '#9b5cff';
      g.beginPath();
      g.roundRect(s.x, s.y, s.w, s.h, 12);
      g.fill();
      g.stroke();
      g.fillStyle = '#c7a6ff';
      g.fillRect(s.x + 10, s.y + 6, s.w - 20, 6);
      break;
  }
}

function drawSweeper(g: CanvasRenderingContext2D, s: Sweeper) {
  g.save();
  g.translate(s.cx, s.cy);
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.fillStyle = '#b8a1d9';
  g.fillRect(-8, 0, 16, 160);
  g.rotate(s.ang);
  g.fillStyle = '#ff4f9a';
  g.beginPath();
  g.roundRect(-s.len, -13, s.len * 2, 26, 13);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff';
  for (let x = -s.len + 20; x < s.len - 20; x += 44) g.fillRect(x, -13, 16, 26);
  g.beginPath();
  g.roundRect(-s.len, -13, s.len * 2, 26, 13);
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(0, 0, 14, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawHammer(g: CanvasRenderingContext2D, h: Hammer) {
  const hx = h.cx + Math.sin(h.ang) * h.len;
  const hy = h.cy + Math.cos(h.ang) * h.len;
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(h.cx, h.cy);
  g.lineTo(hx, hy);
  g.stroke();
  g.save();
  g.translate(hx, hy);
  g.rotate(-h.ang);
  g.lineWidth = 4;
  g.fillStyle = '#ff9a1f';
  g.beginPath();
  g.roundRect(-70, -42, 140, 84, 30);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff3d6';
  g.fillRect(-20, -42, 40, 84);
  g.beginPath();
  g.roundRect(-70, -42, 140, 84, 30);
  g.stroke();
  g.restore();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(h.cx, h.cy, 12, 0, Math.PI * 2);
  g.fill();
}

function drawGlove(g: CanvasRenderingContext2D, gl: Glove) {
  g.strokeStyle = INK;
  g.lineWidth = 4;
  // Poteau
  g.fillStyle = '#b8a1d9';
  g.beginPath();
  g.roundRect(gl.x - 12, gl.y - 40, 24, 200, 8);
  g.fill();
  g.stroke();
  // Ressort
  const gx = gl.x + gl.dir * gl.out;
  g.strokeStyle = '#6e5a99';
  g.lineWidth = 5;
  g.beginPath();
  for (let k = 0; k <= 10; k++) g.lineTo(gl.x + ((gx - gl.x) * k) / 10, gl.y + 10 + (k % 2 ? -10 : 10));
  g.stroke();
  // Gant
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.fillStyle = '#ff3b3b';
  g.beginPath();
  g.roundRect(gx - 34, gl.y - 20, 68, 60, 26);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(gx - (gl.dir === -1 ? -14 : 30), gl.y - 6, 16, 32, 8);
  g.fill();
  g.stroke();
}

function drawCandy(g: CanvasRenderingContext2D, d: Drop) {
  g.save();
  g.translate(d.x, d.y);
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.fillStyle = d.c;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * d.r * 0.8, 0);
    g.lineTo(s * d.r * 1.5, -d.r * 0.5);
    g.lineTo(s * d.r * 1.5, d.r * 0.5);
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.beginPath();
  g.arc(0, 0, d.r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, d.r * 0.55, 0.3, Math.PI * 1.4);
  g.stroke();
  g.restore();
}

function drawBall(g: CanvasRenderingContext2D, b: Ball) {
  g.save();
  g.translate(b.x, b.y);
  g.rotate(b.rot);
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.fillStyle = '#ff9a1f';
  g.beginPath();
  g.arc(0, 0, b.r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.strokeStyle = '#ffd08a';
  g.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(Math.cos((i * Math.PI) / 4) * b.r * 0.85, Math.sin((i * Math.PI) / 4) * b.r * 0.85);
    g.lineTo(-Math.cos((i * Math.PI) / 4) * b.r * 0.85, -Math.sin((i * Math.PI) / 4) * b.r * 0.85);
    g.stroke();
  }
  g.restore();
}

function drawFlag(g: CanvasRenderingContext2D, x: number, y: number, by: string | undefined, t: number) {
  // Drapeau de point de reprise : il monte et prend la couleur du premier qui passe.
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - 110);
  g.stroke();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(x, y - 114, 7, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  const top = by ? y - 108 : y - 60;
  const wave = Math.sin(t * 6 + x) * 5;
  g.fillStyle = by ?? '#e4e0ef';
  g.beginPath();
  g.moveTo(x, top);
  g.quadraticCurveTo(x + 26, top + 6 + wave, x + 52, top + 16);
  g.lineTo(x, top + 34);
  g.closePath();
  g.fill();
  g.stroke();
}

function drawFinish(g: CanvasRenderingContext2D, fx: number, solids: Solid[], lang: string) {
  const ground = solids.find((s) => fx >= s.x && fx <= s.x + s.w);
  const y = ground?.y ?? BASE_Y;
  g.strokeStyle = INK;
  g.lineWidth = 4;
  for (const px of [fx - 140, fx + 140]) {
    g.fillStyle = '#ff4f9a';
    g.beginPath();
    g.roundRect(px - 16, y - 330, 32, 330, 10);
    g.fill();
    g.stroke();
  }
  const sq = 22;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 14; c++) {
      g.fillStyle = (r + c) % 2 ? INK : '#fff';
      g.fillRect(fx - 154 + c * sq, y - 380 + r * sq, sq, sq);
    }
  g.strokeRect(fx - 154, y - 380, 14 * sq, 3 * sq);
  g.fillStyle = '#fff';
  g.font = '700 46px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 8;
  g.strokeText(lang === 'fr' ? 'ARRIVÉE' : 'FINISH', fx, y - 395);
  g.fillText(lang === 'fr' ? 'ARRIVÉE' : 'FINISH', fx, y - 395);
}

function drawPlayer(g: CanvasRenderingContext2D, p: P, t: number) {
  if (p.invuln > 0 && p.stun <= 0 && Math.floor(t * 12) % 2 === 0) g.globalAlpha = 0.45;
  g.save();
  if (p.diving > 0 && !p.onGround) {
    g.translate(p.x, p.y - 30);
    g.rotate(p.dir * 1.2);
    g.translate(-p.x, -(p.y - 30));
  }
  // Vies au-dessus de la tête
  if (!p.done) {
    g.font = '28px sans-serif';
    g.textAlign = 'center';
    g.fillText('❤️'.repeat(p.lives) + '🤍'.repeat(Math.max(0, LIVES - p.lives)), p.x, p.y - 160);
  }
  drawCharacter(g, p.x, p.y, 98, {
    food: p.profile.food,
    color: p.profile.color,
    hat: p.profile.hat,
    acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
    selfie: p.selfie,
    t,
    run: p.onGround ? Math.min(1, Math.abs(p.vx) / RUN) : 0.3,
    dir: p.dir,
    mood: p.done ? 'win' : p.stun > 0 ? 'wow' : 'happy',
    arms: !!p.done,
  });
  g.restore();
  g.globalAlpha = 1;
  // Étoiles quand on est sonné
  if (p.stun > 0.05) {
    g.fillStyle = '#ffd60a';
    g.strokeStyle = INK;
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i * Math.PI * 2) / 3;
      g.beginPath();
      g.arc(p.x + Math.cos(a) * 30, p.y - 118 + Math.sin(a) * 9, 8, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }
  // Pseudo au-dessus de la tête
  g.font = '700 28px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 6;
  g.strokeStyle = INK;
  g.strokeText(p.profile.name, p.x, p.y - 132);
  g.fillStyle = p.profile.color;
  g.fillText(p.profile.name, p.x, p.y - 132);
}

function pill(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  g.fillStyle = INK;
  g.beginPath();
  g.roundRect(x, y + 6, w, h, h / 2);
  g.fill();
  g.fillStyle = fill;
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.beginPath();
  g.roundRect(x, y, w, h, h / 2);
  g.fill();
  g.stroke();
}

function drawHud(g: CanvasRenderingContext2D, ps: P[], L: Level, time: number, done: number, quota: number, lang: string, t: number) {
  // Barre de progression : chaque coureur est une pastille à sa couleur.
  const x0 = 430;
  const x1 = 1490;
  pill(g, x0 - 40, 26, x1 - x0 + 80, 56, '#fff');
  g.fillStyle = '#f1e6f7';
  g.beginPath();
  g.roundRect(x0, 46, x1 - x0, 16, 8);
  g.fill();
  g.font = '34px sans-serif';
  g.textAlign = 'center';
  g.fillText('🏁', x1 + 8, 68);
  for (const p of [...ps].filter((q) => !q.out).sort((a, b) => a.x - b.x)) {
    const k = Math.min(1, Math.max(0, p.x / L.finishX));
    g.fillStyle = p.profile.color;
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x0 + k * (x1 - x0 - 30), 54, p.bot ? 12 : 16, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // Chrono
  pill(g, 40, 26, 170, 56, '#ffd60a');
  g.fillStyle = INK;
  g.font = '700 36px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.fillText(`⏱ ${Math.floor(time)}`, 125, 67);
  // Qualifiés
  const outN = ps.filter((p) => p.out).length;
  if (outN) {
    pill(g, 230, 26, 150, 56, '#ff4f9a');
    g.fillStyle = '#fff';
    g.font = '700 32px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.fillText(`💀 ${outN}`, 305, 66);
  }
  const full = done >= quota;
  pill(g, 1590, 26, 290, 56, full ? '#1fc9a0' : '#fff');
  g.fillStyle = full ? '#fff' : INK;
  g.font = '700 32px Fredoka, sans-serif';
  const label = `${lang === 'fr' ? 'Qualifiés' : 'Qualified'} ${done}/${quota}`;
  if (full) {
    g.lineWidth = 6;
    g.strokeStyle = INK;
    g.strokeText(label, 1735, 66);
  }
  g.fillText(label, 1735, 66 + (full ? 0 : Math.sin(t * 4) * 0));
}

export const tumble: GameBase = {
  id: 'obstacles',
  emoji: '🏃',
  name: { fr: 'La Dégringolade', en: 'Tumble Run' },
  how: {
    fr: 'Stick pour courir · A pour sauter · B pour plonger · 3 vies',
    en: 'Stick to run · A to jump · B to dive',
  },
  inspired: 'Fall Guys',
  layout: 'stick',
  min: 1,
  max: 12,
  botFill: 4,
  music: 'tumble',
  limit: 180,
  create,
};
