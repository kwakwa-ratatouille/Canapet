// La Dégringolade : course d'obstacles vue de côté, inspirée des courses de jeux télé géants.
// La caméra suit le joueur en tête ; qui sort de l'écran par la gauche est replacé plus loin.
import { drawCharacter } from '../shared/characters';
import { sfx } from '../shared/sound';
import { drawSky } from './draw';
import type { GameCtx, GameDef, GameInstance, Runner } from './types';

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
const MAX_TIME = 150;
const AFTER_FIRST = 25;
const INK = '#3a2140';

type Kind = 'ground' | 'block' | 'tile' | 'bounce' | 'conveyor' | 'mover';

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
}

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

interface Level {
  solids: Solid[];
  sweepers: Sweeper[];
  hammers: Hammer[];
  spawners: Spawner[];
  balls: Ball[];
  checkpoints: { x: number; y: number }[];
  finishX: number;
  length: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ——— Fabrication du parcours : une suite de tronçons tirés au hasard ———

function buildLevel(): Level {
  const L: Level = { solids: [], sweepers: [], hammers: [], spawners: [], balls: [], checkpoints: [], finishX: 0, length: 0 };
  let x = 0;
  let y = BASE_Y;
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
      L.sweepers.push({ cx: x + 330, cy: y - 150, len: 175, speed: 1.7, ang: rnd(0, 6) });
      L.sweepers.push({ cx: x + 720, cy: y - 150, len: 175, speed: -1.9, ang: rnd(0, 6) });
      x += 1000;
    },
    marteaux() {
      entry();
      solid(x, y, 1100);
      for (let i = 0; i < 3; i++)
        L.hammers.push({ cx: x + 280 + i * 280, cy: y - 400, len: 330, amp: 1.05, freq: rnd(1.4, 1.9), ph: rnd(0, 6), ang: 0, vel: 0 });
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
      L.spawners.push({ x: x - 40, y, minX: start - 200, every: rnd(1.3, 1.7), t: 0.5 });
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
  const keys = Object.keys(segments).sort(() => Math.random() - 0.5).slice(0, 7);
  for (const k of keys) segments[k]();
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
  let order = 0;
  let firstAt = -1;
  let endDelay = -1;

  /** Plateformes fines : on les traverse par en dessous, on atterrit dessus. */
  const oneWay = (s: Solid) => s.kind === 'block' || s.kind === 'mover' || s.kind === 'tile';
  const active = (s: Solid) => !(s.kind === 'tile' && s.gone !== undefined);
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
    if (p.bot && !p.done) botThink(p, dt);
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
      const a = (p.onGround ? ACC : AIR_ACC) * dt;
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

    // Saut plus court si on relâche A
    p.vy += GRAV * dt * (p.vy < 0 && !p.inp.a && p.diving <= 0 ? 1.7 : 1);
    p.vy = Math.min(p.vy, 1700);

    // Déplacement horizontal puis vertical, avec collisions
    p.x += p.vx * dt;
    for (const s of L.solids) {
      if (!active(s) || oneWay(s)) continue;
      if (p.x + HALF_W > s.x && p.x - HALF_W < s.x + s.w && p.y > s.y + 2 && p.y - BODY_H < s.y + s.h) {
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
        p.vy = 0;
        p.onGround = true;
        p.ground = s;
        if (s.kind === 'tile' && s.touched === undefined) s.touched = time;
      } else if (!oneWay(s) && p.vy < 0 && p.y - BODY_H < s.y + s.h && prevY - BODY_H >= s.y + s.h - 4) {
        p.y = s.y + s.h + BODY_H;
        p.vy = 0;
      }
    }
    if (wasGround && !p.onGround && p.vy >= 0) p.coyote = 0.1;
    if (!p.onGround) p.ground = null;
    if (p.onGround && p.diving > 0 && Math.abs(p.vx) < 60) p.diving = 0;

    // Points de reprise
    while (p.cp + 1 < L.checkpoints.length && p.x > L.checkpoints[p.cp + 1].x) p.cp++;

    // Chute dans le vide
    if (p.y > DEATH_Y) {
      respawn(p, p.cp);
      if (!p.bot) ctx.buzz(p.pid, 300);
      if (!ctx.light) sfx.pet();
    }

    // Arrivée
    if (!p.done && p.x >= L.finishX) {
      p.done = ++order;
      if (firstAt < 0) firstAt = time;
      sfx.finish();
      if (!p.bot) ctx.buzz(p.pid, 300);
    }
  }

  function hazards(p: P) {
    if (p.invuln > 0 || p.done) return;
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
      if (s.kind === 'tile') {
        if (s.touched !== undefined && s.gone === undefined && time - s.touched > 0.55) s.gone = time;
        if (s.gone !== undefined && time - s.gone > 3.5) s.touched = s.gone = undefined;
      }
      if (s.squash) s.squash = Math.max(0, s.squash - dt * 4);
    }
    for (const s of L.sweepers) s.ang += s.speed * dt;
    for (const h of L.hammers) {
      const prev = h.ang;
      h.ang = Math.sin(time * h.freq + h.ph) * h.amp;
      h.vel = (h.ang - prev) / dt;
    }
    for (const sp of L.spawners) {
      sp.t -= dt;
      if (sp.t <= 0 && sp.x < camX + VIEW_W + 600) {
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
    const racing = ps.filter((p) => !p.done);
    const lead = Math.max(...(racing.length ? racing : ps).map((p) => p.x));
    const target = Math.min(L.length - VIEW_W, Math.max(0, lead - VIEW_W * 0.58));
    if (target > camX) camX += (target - camX) * Math.min(1, dt * 3);
    // Trop loin derrière : replacé au premier point de reprise visible.
    for (const p of ps) {
      if (p.done || p.x > camX - 40) continue;
      let idx = L.checkpoints.findIndex((c) => c.x > camX + 80);
      if (idx < 0) idx = L.checkpoints.length - 1;
      respawn(p, idx);
      p.stun = 0.9;
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
      stepWorld(dt);
      for (const p of ps) stepPlayer(p, dt);
      for (const p of ps) hazards(p);
      // Les joueurs se bousculent
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i];
          const b = ps[j];
          if (a.done || b.done) continue;
          const dx = b.x - a.x;
          if (Math.abs(dx) < 36 && Math.abs(b.y - a.y) < 20) {
            const push = (36 - Math.abs(dx)) / 2;
            const s = dx >= 0 ? 1 : -1;
            a.x -= s * push;
            b.x += s * push;
          }
        }
      stepCamera(dt);
      const humansDone = ps.some((p) => !p.bot) ? ps.every((p) => p.bot || p.done) : ps.every((p) => p.done);
      if (endDelay < 0 && (humansDone || time > MAX_TIME || (firstAt >= 0 && time - firstAt > AFTER_FIRST))) endDelay = 2;
      if (endDelay >= 0) {
        endDelay -= dt;
        if (endDelay <= 0) game.over = true;
      }
    },
    render(g, t) {
      drawSky(g, t, ctx.light);
      drawHills(g, camX);
      g.save();
      g.translate(-Math.round(camX), 0);
      const x0 = camX - 200;
      const x1 = camX + VIEW_W + 200;
      drawFinish(g, L.finishX, L.solids, ctx.lang);
      for (const c of L.checkpoints) if (c.x > x0 && c.x < x1) drawFlag(g, c.x - 60, c.y);
      for (const s of L.solids) if (s.x + s.w > x0 && s.x < x1) drawSolid(g, s, time, ctx.light);
      for (const h of L.hammers) if (Math.abs(h.cx - camX - VIEW_W / 2) < VIEW_W) drawHammer(g, h);
      for (const s of L.sweepers) if (Math.abs(s.cx - camX - VIEW_W / 2) < VIEW_W) drawSweeper(g, s);
      for (const b of L.balls) if (b.x > x0 && b.x < x1) drawBall(g, b);
      ps.forEach((p, i) => drawPlayer(g, p, t + i * 0.3));
      g.restore();
      drawHud(g, ps, L, time, order, ctx.lang);
    },
    ranking() {
      return [...ps].sort((a, b) => (a.done || 99) - (b.done || 99) || b.x - a.x).map((p) => p.pid);
    },
    leader() {
      return ps.find((p) => p.done === 1)?.profile.name ?? null;
    },
  };
  return game;
}

// ——— Dessin ———

function drawHills(g: CanvasRenderingContext2D, camX: number) {
  g.fillStyle = '#bfe8c4';
  const off = (camX * 0.25) % 700;
  for (let i = -1; i < 5; i++) {
    g.beginPath();
    g.ellipse(i * 700 - off + 200, 1000, 420, 300, 0, Math.PI, 0);
    g.fill();
  }
  g.fillStyle = '#ffc6e0';
  const off2 = (camX * 0.45) % 560;
  for (let i = -1; i < 6; i++) {
    g.beginPath();
    g.ellipse(i * 560 - off2 + 60, 1080, 300, 230, 0, Math.PI, 0);
    g.fill();
  }
}

function drawSolid(g: CanvasRenderingContext2D, s: Solid, time: number, light: boolean) {
  g.lineWidth = 4;
  g.strokeStyle = INK;
  const h = Math.min(s.h, 1300 - s.y);
  switch (s.kind) {
    case 'ground':
    case 'block': {
      g.fillStyle = '#ffd9ea';
      g.beginPath();
      g.roundRect(s.x, s.y, s.w, h, s.kind === 'block' ? 12 : [14, 14, 0, 0]);
      g.fill();
      g.stroke();
      g.fillStyle = '#ff7eb6';
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

function drawFlag(g: CanvasRenderingContext2D, x: number, y: number) {
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - 90);
  g.stroke();
  g.fillStyle = '#7bd13b';
  g.beginPath();
  g.moveTo(x, y - 90);
  g.lineTo(x + 40, y - 76);
  g.lineTo(x, y - 62);
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
  drawCharacter(g, p.x, p.y, 86, {
    food: p.profile.food,
    color: p.profile.color,
    hat: p.profile.hat,
    acc: p.profile.acc,
    selfie: p.selfie,
    t,
    run: p.onGround ? Math.min(1, Math.abs(p.vx) / RUN) : 0.3,
    dir: p.dir,
    mood: p.stun > 0 ? 'wow' : 'happy',
  });
  g.restore();
  g.globalAlpha = 1;
  // Étoiles quand on est sonné
  if (p.stun > 0.05) {
    g.fillStyle = '#ffd60a';
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i * Math.PI * 2) / 3;
      g.beginPath();
      g.arc(p.x + Math.cos(a) * 26, p.y - 100 + Math.sin(a) * 8, 6, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Pseudo au-dessus de la tête
  g.font = '700 22px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 5;
  g.strokeStyle = INK;
  g.strokeText(p.profile.name, p.x, p.y - 112);
  g.fillStyle = p.profile.color;
  g.fillText(p.profile.name, p.x, p.y - 112);
}

function drawHud(g: CanvasRenderingContext2D, ps: P[], L: Level, time: number, done: number, lang: string) {
  const x0 = 360;
  const x1 = 1560;
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(x0 - 30, 24, x1 - x0 + 60, 44, 22);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.font = '28px sans-serif';
  g.textAlign = 'center';
  g.fillText('🏁', x1 + 6, 58);
  for (const p of ps) {
    const k = Math.min(1, Math.max(0, p.x / L.finishX));
    g.fillStyle = p.profile.color;
    g.beginPath();
    g.arc(x0 + k * (x1 - x0 - 40), 46, 12, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 3;
    g.stroke();
  }
  g.font = '700 40px Fredoka, sans-serif';
  g.textAlign = 'left';
  g.fillStyle = INK;
  g.fillText(`${Math.floor(time)} s`, 60, 62);
  g.textAlign = 'right';
  g.fillText(`${lang === 'fr' ? 'Arrivés' : 'Finished'} ${done}/${ps.length}`, 1880, 62);
}

export const tumble: GameDef = {
  id: 'obstacles',
  emoji: '🏃',
  name: { fr: 'La Dégringolade', en: 'Tumble Run' },
  how: {
    fr: 'Stick pour courir · A pour sauter · B pour plonger',
    en: 'Stick to run · A to jump · B to dive',
  },
  inspired: 'Fall Guys',
  layout: 'stick',
  min: 1,
  max: 12,
  botFill: 4,
  music: 'tumble',
  create,
};
