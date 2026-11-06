// Deux jeux de tours, chacun la sienne, côte à côte.
// « La Tour Branlante » : des pièces de bonbon qui tombent et penchent pour de vrai (physique Matter.js). Le premier à la ligne gagne.
// « Le Gâteau qui Penche » : l'étage passe de gauche à droite, on appuie au bon moment ; ce qui dépasse est coupé. Plus d'étage, c'est perdu.
import Matter from 'matter-js';
import { drawCharacter } from '../shared/characters';
import { INK, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import type { CakePadData } from './cakeShared';
import { candy, smileSun, stickerCloud } from './draw';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

const { Engine, Bodies, Body, Composite, Events } = Matter;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Une petite étiquette de joueur en bas de sa colonne. */
function laneChip(g: CanvasRenderingContext2D, x: number, w: number, y: number, p: Runner, text: string, dim = false) {
  g.globalAlpha = dim ? 0.5 : 1;
  g.fillStyle = p.profile.color;
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(x + 4, y, w - 8, 56, 16);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 28px Fredoka, sans-serif';
  g.fillText(text, x + w / 2, y + 29, w - 18);
  g.globalAlpha = 1;
}

// ——— La Tour Branlante ———
const CELL = 34;
const GOAL = 1000;
const TRAY = 250;
/** Largeur d'une colonne : assez proche pour qu'une tour qui tombe touche la voisine. */
const LANE = 380;
/** Jusqu'où on peut déplacer sa pièce depuis le centre de son plateau. */
const REACH = 175;
const SHAPES: [number, number][][] = [
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
];
const BIG: [number, number][] = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
const COLORS = ['#ff4f9a', '#2ec5ff', '#ffd60a', '#9b5cff', '#ff9a1f', '#22c99a', '#ff3b5c'];

interface Tw extends Runner {
  /** Centre de son plateau dans le monde. */
  cx: number;
  cur: Matter.Body | null;
  wait: number;
  height: number;
  x: number;
  rot: boolean;
  fast: boolean;
  big: boolean;
  hit: number;
  safe: number;
  botX: number;
  botT: number;
  banner: { t: number; text: string; c: string } | null;
}

function createTower(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  let clock = 0;
  let best = 0;
  let record = 200;
  let endT = -1;
  let shake = 0;
  let crashAt = -9;
  // Un seul monde : les plateaux sont côte à côte, ce qui tombe d'une tour peut renverser la voisine
  const engine = Engine.create({ positionIterations: 10, velocityIterations: 8, enableSleeping: true });
  engine.gravity.y = 1;
  const list = runners.slice(0, 8);
  const pls: Tw[] = list.map((r, i) => {
    const cx = (i - (list.length - 1) / 2) * LANE;
    Composite.add(engine.world, Bodies.rectangle(cx, 15, TRAY, 30, { isStatic: true, friction: 1 }));
    return { ...r, cx, cur: null, wait: 0.2 + i * 0.05, height: 0, x: 0, rot: false, fast: false, big: false, hit: 0, safe: 0, botX: 0, botT: 0, banner: null };
  });
  const pieces: Matter.Body[] = [];
  const owner = new Map<Matter.Body, Tw>();
  const colors = new Map<Matter.Body, string>();
  const born = new Map<Matter.Body, number>();
  /** Le joueur sur le plateau duquel se trouve ce point. */
  const laneOf = (x: number) => pls.find((p) => Math.abs(x - p.cx) <= LANE / 2);

  Events.on(engine, 'collisionStart', (e: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of e.pairs) {
      const A = pair.bodyA.parent;
      const B = pair.bodyB.parent;
      for (const p of pls) if (p.cur && (A === p.cur || B === p.cur)) release(p);
      // Une pièce d'un autre joueur vient cogner une tour : tout le monde le voit
      const oa = owner.get(A);
      const ob = owner.get(B);
      if (oa && ob && oa !== ob && Math.max(A.speed, B.speed) > 2.2 && clock - crashAt > 0.8) {
        crashAt = clock;
        const victim = laneOf(A.speed > B.speed ? B.position.x : A.position.x);
        if (victim) {
          victim.banner = { t: 1.6, text: fr ? '💥 Ça cogne !' : '💥 Crash!', c: ROSE };
          if (!victim.bot) ctx.buzz(victim.pid, 120);
        }
        shake = 0.25;
        sfx.boing();
      }
    }
  });

  function release(p: Tw) {
    if (!p.cur) return;
    born.set(p.cur, clock);
    // Posée doucement, elle ne bouge presque rien ; lâchée à toute vitesse, elle cogne et fait trembler la pile
    Body.setVelocity(p.cur, { x: 0, y: Math.min(p.fast ? 7 : 1.5, p.cur.velocity.y) });
    p.cur = null;
    p.wait = 0.3;
    sfx.step();
  }
  function spawn(p: Tw) {
    const cells = p.big ? BIG : SHAPES[Math.floor(Math.random() * SHAPES.length)];
    p.big = false;
    const parts = cells.map(([cx, cy]) => Bodies.rectangle(cx * CELL, cy * CELL, CELL, CELL, { friction: 0.9, frictionStatic: 1.2, restitution: 0, density: 0.002 }));
    const body = Body.create({ parts, friction: 0.9, frictionStatic: 1.2, restitution: 0, frictionAir: 0.02, sleepThreshold: 40 });
    Body.setInertia(body, body.inertia * 3);
    // Le bloc apparaît n'importe où sur la ligne : il faut le ramener, on ne peut pas juste tout faire tomber au même endroit
    Body.setPosition(body, { x: p.cx + rnd(-REACH + 25, REACH - 25), y: -Math.min(p.height + 430, GOAL + 180) });
    if (Math.random() < 0.5) Body.rotate(body, Math.PI / 2);
    Composite.add(engine.world, body);
    pieces.push(body);
    owner.set(body, p);
    colors.set(body, COLORS[Math.floor(Math.random() * COLORS.length)]);
    p.cur = body;
    if (p.bot) {
      // Le bot met la pièce à plat et vise le creux le plus proche du centre de son plateau
      const wide = body.bounds.max.x - body.bounds.min.x;
      const tall = body.bounds.max.y - body.bounds.min.y;
      if (tall > wide) Body.rotate(body, Math.PI / 2);
      const half = Math.max(wide, tall) / 2;
      let bestX = 0;
      let bestV = Infinity;
      for (let x = -TRAY / 2 + half; x <= TRAY / 2 - half + 0.1; x += 17) {
        let top = 0;
        for (const b of pieces) {
          if (b !== body && b.bounds.max.x > p.cx + x - half && b.bounds.min.x < p.cx + x + half) top = Math.max(top, -b.bounds.min.y);
        }
        const v = top + Math.abs(x) * 0.5 + rnd(0, 34) * (1.25 - ctx.botSkill);
        if (v < bestV) {
          bestV = v;
          bestX = x;
        }
      }
      p.botX = bestX + rnd(-12, 12) * (1.2 - ctx.botSkill);
    }
    p.botT = rnd(0.3, 0.9);
  }
  /** Une pièce tombe dans le vide : pas de punition, juste le temps perdu (et ça se voit). */
  const pieceLost = (p: Tw) => {
    if (p.safe > 0) return;
    p.safe = 1.2;
    p.hit = 0.5;
    // Une pièce perdue, c'est du temps perdu
    p.wait = Math.max(p.wait, 1.2);
    sfx.boing();
    if (!p.bot) ctx.buzz(p.pid, 120);
  };

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const p = pls.find((x) => x.pid === pid);
      if (!p) return;
      p.x = Math.max(-1, Math.min(1, m.x));
      if (m.a && !p.rot && p.cur) {
        Body.rotate(p.cur, Math.PI / 2);
        sfx.click();
      }
      p.rot = m.a;
      p.fast = m.b || m.y > 0.6;
    },
    update(dt) {
      clock += dt;
      shake = Math.max(0, shake - dt);
      if (endT >= 0) {
        endT -= dt;
        if (endT <= 0) game.over = true;
        return;
      }
      for (const p of pls) {
        p.hit = Math.max(0, p.hit - dt);
        p.safe = Math.max(0, p.safe - dt);
        if (p.banner && (p.banner.t -= dt) <= 0) p.banner = null;
        if (p.bot) {
          // Le bot se place, puis accélère
          p.botT -= dt;
          if (p.cur) {
            const d = p.cx + p.botX - p.cur.position.x;
            p.x = Math.max(-1, Math.min(1, d / 40));
            p.fast = Math.abs(d) < 8 && p.botT <= 0 && -p.cur.position.y > p.height + 170;
          }
        }
        if (!p.cur && (p.wait -= dt) <= 0) spawn(p);
        if (p.cur) {
          // La pièce qui descend se pilote ; elle redevient libre au premier contact
          Body.setVelocity(p.cur, { x: p.bot ? p.x * 3.4 : p.x * 4.6, y: p.fast ? 7.5 : 2.6 + Math.min(1.6, clock / 60) });
          Body.setAngularVelocity(p.cur, 0);
          const off = p.cur.position.x - p.cx;
          if (Math.abs(off) > REACH) Body.setPosition(p.cur, { x: p.cx + Math.sign(off) * REACH, y: p.cur.position.y });
        }
      }
      Engine.update(engine, 1000 / 60);
      for (const b of [...pieces]) {
        if (b.position.y <= 260) continue;
        const o = owner.get(b);
        if (o && o.cur === b) o.cur = null;
        Composite.remove(engine.world, b);
        pieces.splice(pieces.indexOf(b), 1);
        owner.delete(b);
        colors.delete(b);
        born.delete(b);
        if (o) pieceLost(o);
      }
      // La hauteur de chacun : ce qui tient au-dessus de SON plateau, même si ça vient d'ailleurs
      for (const p of pls) {
        let top = 0;
        for (const b of pieces) {
          if (owner.get(b)?.cur === b) continue;
          if (Math.abs(b.position.x - p.cx) > LANE / 2) continue;
          if (clock - (born.get(b) ?? clock) > 0.8 && b.speed < 0.6) top = Math.max(top, -b.bounds.min.y);
        }
        p.height = top;
      }
      best = Math.max(...pls.map((p) => p.height));
      // Nouveau palier : les autres reçoivent une grosse pièce
      if (best > record) {
        record += 200;
        const lead = pls.find((p) => p.height === best);
        pls.forEach((o) => {
          if (o !== lead) {
            o.big = true;
            o.banner = { t: 2, text: fr ? '😈 Gros bloc !' : '😈 Big block!', c: SOLEIL };
          }
        });
        sfx.hurry();
      }
      // Une seule façon de gagner : arriver à la ligne (sinon, le plus haut quand le temps est écoulé)
      if (best >= GOAL) {
        endT = 3;
        sfx.win();
        if (best >= GOAL) speak(fr ? 'Quelle tour !' : 'What a tower!', ctx.lang);
      }
    },
    render(g, t) {
      const sky = g.createLinearGradient(0, 0, 0, 1080);
      sky.addColorStop(0, '#7fd6ff');
      sky.addColorStop(1, '#ffe9f2');
      g.fillStyle = sky;
      g.fillRect(0, 0, 1920, 1080);
      smileSun(g, 1720, 190, 80, SOLEIL, t);
      stickerCloud(g, 320 + Math.sin(t * 0.1) * 60, 200, 1.1);
      stickerCloud(g, 1060 - Math.sin(t * 0.08) * 70, 290, 0.8);
      g.save();
      if (shake > 0) g.translate(Math.sin(t * 70) * shake * 40, Math.cos(t * 55) * shake * 24);
      const n = pls.length;
      const s = Math.min(0.85, 1900 / (n * LANE));
      const w = LANE * s;
      const left = 960 - (n * w) / 2;
      const base = 980;
      const sx = (x: number) => 960 + x * s;
      const sy = (y: number) => base + y * s;
      // La ligne d'arrivée, d'un bord à l'autre
      const gy = sy(-GOAL);
      for (let k = 0; k * 24 < 1920; k++) {
        g.fillStyle = k % 2 ? '#fff' : INK;
        g.fillRect(k * 24, gy - 8, 24, 16);
      }
      pls.forEach((p, i) => {
        const lx = left + i * w;
        if (i) {
          g.fillStyle = 'rgba(58,33,64,.18)';
          g.fillRect(lx - 2, 90, 4, 990);
        }
        // Les paliers de hauteur
        g.fillStyle = 'rgba(58,33,64,.45)';
        g.font = '700 28px Fredoka, sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        for (let h = 200; h < GOAL; h += 200) {
          const y = sy(-h);
          g.fillRect(lx, y, 16, 3);
          g.fillText(String(h / 10), lx + 22, y);
        }
        // Le plateau, avec le perso qui regarde
        const ty = sy(0);
        g.fillStyle = '#ffd76a';
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(sx(p.cx - TRAY / 2), ty, TRAY * s, 30 * s, 12);
        g.fill();
        g.stroke();
        candy(g, sx(p.cx - TRAY / 2), ty, TRAY * s, 30 * s, 12);
        drawCharacter(g, sx(p.cx - TRAY / 2 - 34), Math.min(1076, ty + 90 * s), 56 * s + 26, { food: p.profile.food, color: p.profile.color, hat: p.profile.hat, acc: p.profile.acc, eyes: p.profile.eyes, pose: p.profile.pose, selfie: p.selfie, t: t + i, mood: p.hit > 0 ? 'sad' : p.height > 300 ? 'win' : 'wow' });
      });
      // Les pièces, par-dessus tout : elles passent d'une colonne à l'autre quand ça tombe
      for (const b of pieces) {
        const col = colors.get(b) ?? ROSE;
        for (let k = 1; k < b.parts.length; k++) {
          const q = b.parts[k];
          g.fillStyle = col;
          g.strokeStyle = INK;
          g.lineWidth = 3;
          g.beginPath();
          q.vertices.forEach((v, j) => (j ? g.lineTo(sx(v.x), sy(v.y)) : g.moveTo(sx(v.x), sy(v.y))));
          g.closePath();
          g.fill();
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,.35)';
          g.beginPath();
          g.arc(sx(q.position.x) - 6 * s, sy(q.position.y) - 6 * s, 5 * s, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
      pls.forEach((p, i) => {
        const lx = left + i * w;
        if (p.banner) {
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.font = '700 42px Fredoka, sans-serif';
          g.lineWidth = 7;
          g.strokeStyle = INK;
          g.strokeText(p.banner.text, lx + w / 2, 140, w - 16);
          g.fillStyle = p.banner.c;
          g.fillText(p.banner.text, lx + w / 2, 140, w - 16);
        }
        laneChip(g, lx, w, 12, p, `${p.profile.name.slice(0, w < 260 ? 6 : 10)} · ${Math.round(p.height / 10)}`);
      });
    },
    ranking: () => [...pls].sort((a, b) => b.height - a.height).map((p) => p.pid),
    leader: () => null,
  };
  speak(fr ? 'Empilez, et que ça tienne !' : 'Stack it, and make it hold!', ctx.lang);
  return game;
}

export const tower: GameBase = {
  id: 'tour',
  emoji: '🧱',
  name: { fr: 'La Tour Branlante', en: 'The Wobbly Tower' },
  how: {
    fr: 'Chacun sa tour, côte à côte : ça penche vraiment, et une tour qui s’écroule peut renverser la voisine ! Stick = déplacer, A = tourner, B = descendre vite. Ce qui tombe part dans le vide : le premier à la ligne gagne !',
    en: 'Towers side by side: they really wobble, and a falling tower can knock over its neighbour! Stick = move, A = rotate, B = drop fast. Whatever falls is gone: first to the line wins!',
  },
  layout: 'stick',
  min: 1,
  max: 8,
  botFill: 3,
  music: 'tumble',
  limit: 150,
  timerCorner: true,
  create: createTower,
};

// ——— Le Gâteau qui Penche ———
const CAKE_W = 300;
const LAYER = 38;
const SWING = 170;
const SPONGES = ['#ffd9a0', '#f6c6d8', '#8a5a35', '#fff0c9', '#c8e8a8', '#e8c0f0'];
const ICINGS = ['#ff86bd', '#fffaf2', '#ffd60a', '#9b5cff', '#22c99a', '#ff9a1f'];

interface Layer {
  x: number;
  w: number;
  c: number;
}
interface Crumb {
  x: number;
  w: number;
  y: number;
  vy: number;
  rot: number;
  c: number;
  side: number;
}
interface Ck extends Runner {
  layers: Layer[];
  x: number;
  w: number;
  dir: number;
  speed: number;
  done: boolean;
  score: number;
  combo: number;
  crumbs: Crumb[];
  pop: { text: string; t: number; c: string } | null;
  cam: number;
  botAim: number;
  flash: number;
}

function createCake(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls: Ck[] = runners.map((r) => ({ ...r, layers: [{ x: 0, w: CAKE_W, c: 0 }], x: -SWING - CAKE_W / 2, w: CAKE_W, dir: 1, speed: 250, done: false, score: 0, combo: 0, crumbs: [], pop: null, cam: 0, botAim: rnd(-20, 20), flash: 0 }));
  let endT = -1;
  // Les étages restent bien épais même à 12 joueurs
  const vs = Math.max(0.85, Math.min(1.5, 1920 / pls.length / 660));
  const nextLayer = (p: Ck) => {
    const top = p.layers[p.layers.length - 1];
    p.w = top.w;
    p.dir = Math.random() < 0.5 ? 1 : -1;
    p.x = -p.dir * (SWING + p.w / 2);
    // De plus en plus vite
    p.speed = Math.min(640, 250 + p.layers.length * 17);
    // Le bot rate plus ou moins selon son niveau
    p.botAim = top.x + rnd(-1, 1) * (1.3 - ctx.botSkill) * 40;
    ctx.refresh();
  };
  const pose = (p: Ck) => {
    if (p.done) return;
    const top = p.layers[p.layers.length - 1];
    const dx = p.x - top.x;
    const c = p.layers.length;
    if (Math.abs(dx) >= p.w) {
      // Complètement à côté : l'étage tombe, c'est fini pour ce gâteau
      p.crumbs.push({ x: p.x, w: p.w, y: -c * LAYER, vy: 0, rot: 0, c, side: Math.sign(dx) || 1 });
      p.done = true;
      p.pop = { text: fr ? 'RATÉ !' : 'MISSED!', t: 1.4, c: ROSE };
      sfx.boom();
      if (!p.bot) ctx.buzz(p.pid, 300);
      ctx.refresh();
      return;
    }
    if (Math.abs(dx) < 7) {
      // Pile dessus : rien n'est coupé, et trois de suite font regrossir l'étage
      p.combo++;
      let w = top.w;
      if (p.combo >= 3) w = Math.min(CAKE_W, w + 12);
      p.layers.push({ x: top.x, w, c });
      p.score += 3;
      p.pop = { text: p.combo >= 3 ? `${fr ? 'PARFAIT' : 'PERFECT'} ×${p.combo} !` : fr ? 'PARFAIT !' : 'PERFECT!', t: 0.8, c: SOLEIL };
      p.flash = 0.25;
      sfx.pop();
      if (!p.bot) ctx.buzz(p.pid, 40);
    } else {
      // Ce qui dépasse est coupé et tombe
      const keep = p.w - Math.abs(dx);
      const nx = top.x + dx / 2;
      const side = Math.sign(dx);
      p.crumbs.push({ x: nx + (side * p.w) / 2, w: Math.abs(dx), y: -c * LAYER, vy: 0, rot: 0, c, side });
      p.layers.push({ x: nx, w: keep, c });
      p.combo = 0;
      p.score += 1;
      sfx.step();
    }
    nextLayer(p);
  };
  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'pose' || endT >= 0) return;
      const p = pls.find((x) => x.pid === pid);
      if (p) pose(p);
    },
    update(dt) {
      if (endT >= 0) {
        endT -= dt;
        if (endT <= 0) game.over = true;
      }
      for (const p of pls) {
        if (p.pop && (p.pop.t -= dt) <= 0) p.pop = null;
        p.flash = Math.max(0, p.flash - dt);
        for (const c of p.crumbs) {
          c.vy += 1500 * dt;
          c.y += c.vy * dt;
          c.x += c.side * 90 * dt;
          c.rot += c.side * 3 * dt;
        }
        p.crumbs = p.crumbs.filter((c) => c.y < p.cam + 500);
        // La vue monte avec le gâteau
        const want = Math.max(0, (p.layers.length + 3) * LAYER - 800 / vs);
        p.cam += (want - p.cam) * Math.min(1, dt * 5);
        if (!p.done && !p.bot && ctx.away(p.pid)) {
          p.done = true;
          ctx.refresh();
        }
        if (p.done || endT >= 0) continue;
        p.x += p.dir * p.speed * dt;
        const lim = SWING + p.w / 2;
        if (Math.abs(p.x) > lim) {
          p.x = Math.sign(p.x) * lim;
          p.dir = -p.dir;
        }
        if (p.bot && Math.abs(p.x - p.botAim) < (p.speed * dt) / 1.2 + 1) pose(p);
      }
      if (endT < 0) {
        const humans = pls.filter((p) => !p.bot);
        if (pls.every((p) => p.done) || (humans.length > 0 && humans.every((p) => p.done))) {
          endT = 2.5;
          sfx.win();
          ctx.refresh();
        }
      }
    },
    render(g, t) {
      g.fillStyle = '#fff1f8';
      g.fillRect(0, 0, 1920, 1080);
      // Une nappe à carreaux en bas
      for (let x = 0; x < 1920; x += 60) {
        for (let y = 960; y < 1080; y += 60) {
          g.fillStyle = (x + y) % 120 ? '#ffd1e6' : '#fff';
          g.fillRect(x, y, 60, 60);
        }
      }
      const n = pls.length;
      const w = 1920 / n;
      const s = Math.min(1.5, w / 430);
      const ground = 950;
      pls.forEach((p, i) => {
        const cx = i * w + w / 2;
        g.save();
        g.beginPath();
        g.rect(i * w, 70, w, 1010);
        g.clip();
        if (i) {
          g.fillStyle = 'rgba(58,33,64,.15)';
          g.fillRect(i * w - 2, 0, 4, 1080);
        }
        const yOf = (k: number) => ground + (-(k + 1) * LAYER + p.cam) * vs;
        const slab = (x: number, top: number, wd: number, c: number) => {
          const px = cx + (x - wd / 2) * s;
          const pw = wd * s;
          const ph = LAYER * vs;
          g.fillStyle = SPONGES[c % SPONGES.length];
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.beginPath();
          g.roundRect(px, top, pw, ph, 7);
          g.fill();
          g.stroke();
          // Le glaçage
          g.fillStyle = ICINGS[c % ICINGS.length];
          g.beginPath();
          g.roundRect(px + 2, top + 2, pw - 4, ph * 0.36, 5);
          g.fill();
          // Le nappage qui coule
          for (let d = 12; d < pw - 10; d += 26) {
            g.beginPath();
            g.arc(px + d, top + ph * 0.36, 6 + ((d * 7 + c * 5) % 5), 0, Math.PI);
            g.fill();
          }
        };
        // L'assiette
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.ellipse(cx, ground + 6 + p.cam * vs, 190 * s, 20 * s, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        p.layers.forEach((l, k) => {
          const y = yOf(k);
          if (y < -60 || y > 1080) return;
          slab(l.x, y, l.w, l.c);
        });
        // Ce qui a été coupé, qui tombe
        for (const c of p.crumbs) {
          const y = ground + (c.y + p.cam) * vs;
          g.save();
          g.translate(cx + c.x * s, y);
          g.rotate(c.rot);
          g.translate(-cx - c.x * s, -y);
          slab(c.x, y, c.w, c.c);
          g.restore();
        }
        if (!p.done) {
          // L'étage qui passe
          const y = yOf(p.layers.length);
          slab(p.x, y, p.w, p.layers.length);
          // Le guide : où il faudrait poser
          const top = p.layers[p.layers.length - 1];
          g.strokeStyle = 'rgba(58,33,64,.35)';
          g.lineWidth = 3;
          g.setLineDash([8, 8]);
          g.strokeRect(cx + (top.x - top.w / 2) * s, y, top.w * s, LAYER * vs);
          g.setLineDash([]);
        } else {
          // Le gâteau fini : une bougie et une cerise
          const top = p.layers[p.layers.length - 1];
          const y = yOf(p.layers.length - 1);
          g.fillStyle = '#ff3b5c';
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.beginPath();
          g.arc(cx + top.x * s, y - 14 * s, 16 * s, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
        drawCharacter(g, cx - (190 * s + 6), ground + 8 + p.cam * vs, 62 * s + 30, { food: p.profile.food, color: p.profile.color, hat: p.profile.hat, acc: p.profile.acc, eyes: p.profile.eyes, pose: p.profile.pose, selfie: p.selfie, t: t + i, mood: p.done ? 'sad' : p.combo >= 2 ? 'win' : 'wow' });
        if (p.flash > 0) {
          g.globalAlpha = p.flash * 2;
          g.fillStyle = '#fff';
          g.fillRect(i * w, 70, w, 1010);
          g.globalAlpha = 1;
        }
        if (p.pop) {
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.font = `700 ${Math.max(28, Math.round(46 * s))}px Fredoka, sans-serif`;
          g.lineWidth = 7;
          g.strokeStyle = INK;
          g.strokeText(p.pop.text, cx, 180, w - 16);
          g.fillStyle = p.pop.c;
          g.fillText(p.pop.text, cx, 180, w - 16);
        }
        g.restore();
        laneChip(g, i * w, w, 10, p, `${p.profile.name.slice(0, w < 200 ? 4 : 9)} · ${p.score}`, p.done);
      });
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score || b.layers.length - a.layers.length).map((p) => p.pid),
    out: (pid) => !!pls.find((p) => p.pid === pid)?.done,
    leader: () => null,
    padData(pid): CakePadData {
      const p = pls.find((x) => x.pid === pid)!;
      return { color: p.profile.color, score: p.score, floors: p.layers.length - 1, done: p.done, combo: p.combo };
    },
  };
  speak(fr ? 'Appuyez au bon moment, ce qui dépasse est coupé !' : 'Tap at the right moment, whatever sticks out gets cut!', ctx.lang);
  return game;
}

export const cake: GameBase = {
  id: 'gateau',
  emoji: '🎂',
  name: { fr: 'Le Gâteau qui Penche', en: 'The Leaning Cake' },
  how: {
    fr: 'Chacun son gâteau : appuie quand l’étage passe au-dessus. Ce qui dépasse est coupé, et ça va de plus en plus vite. Le plus haut gâteau gagne !',
    en: 'Everyone has a cake: tap when the layer is above it. Whatever sticks out gets cut, and it keeps speeding up. The tallest cake wins!',
  },
  layout: 'buttons',
  min: 1,
  max: 12,
  botFill: 3,
  music: 'party',
  limit: 120,
  timerCorner: true,
  create: createCake,
};
