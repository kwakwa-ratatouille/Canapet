// Flèches à Ventouse : petite arène, les bords se rejoignent. Une flèche (ou un saut sur la tête) = KO.
// Stick = courir et viser · A = sauter · B = tirer. 3 flèches à ramasser. Premier à 3 manches.
import { drawCharacter } from '../shared/characters';
import { sfx, speak } from '../shared/sound';
import { drawSky, roundRectText, candy } from './draw';
import { TEAMS, allies, side, sidesLeft, winnerName } from './teams';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const T = 60;
const W = 1920;
const H = 1080;
const GRAV = 2400;
const RUN = 390;
const JUMP = 1200;
const HW = 18;
const BH = 56;
const ARROW_V = 1350;
const WIN_ROUNDS = 3;
const MAX_TIME = 150;
/** Chrono d'une manche : mort subite à 30 s, fin à 45 s (plus de camping sans fin). */
const SUDDEN = 30;
const ROUND_TIME = 45;

// Bords communs : plafond et sol troués au milieu, murs troués (on passe d'un côté à l'autre).
const BORDERS: [number, number, number, number][] = [
  [0, 0, 10, 1], [22, 0, 10, 1], [0, 17, 10, 1], [22, 17, 10, 1],
  [0, 0, 1, 6], [0, 8, 1, 10], [31, 0, 1, 6], [31, 8, 1, 10],
];
/** Arènes : chaque partie en tire une au hasard. */
const MAPS: { name: { fr: string; en: string }; rects: [number, number, number, number][]; spawns: [number, number][]; sky: [string, string]; body?: string; top?: string }[] = [
  {
    name: { fr: 'La Tour', en: 'The Tower' },
    sky: ['#8fd8ff', '#ffd6ec'],
    rects: [
  [0, 0, 10, 1], [22, 0, 10, 1], [0, 17, 10, 1], [22, 17, 10, 1],
  [0, 0, 1, 6], [0, 8, 1, 10], [31, 0, 1, 6], [31, 8, 1, 10],
  [5, 3, 6, 1], [21, 3, 6, 1], [10, 6, 12, 1], [5, 9, 4, 1], [23, 9, 4, 1],
  [12, 11, 8, 1], [0, 14, 6, 1], [26, 14, 6, 1], [14, 14, 4, 3],
],
    spawns: [
  [150, 840], [1770, 840], [480, 180], [1440, 180], [420, 540], [1500, 540], [720, 360], [1200, 360],
],
  },
  {
    name: { fr: 'Les Étagères', en: 'The Shelves' },
    sky: ['#ffe9c7', '#ffd6ec'],
    body: '#f6e3c4',
    top: '#c98a5a',
    rects: [...BORDERS, [3, 4, 7, 1], [22, 4, 7, 1], [12, 7, 8, 1], [2, 10, 6, 1], [24, 10, 6, 1], [9, 13, 5, 1], [18, 13, 5, 1]],
    spawns: [[360, 240], [1560, 240], [960, 420], [300, 600], [1620, 600], [690, 780], [1230, 780], [300, 1020]],
  },
  {
    name: { fr: 'Le Puits', en: 'The Well' },
    sky: ['#d7d0ff', '#ffe3f1'],
    body: '#e3dbff',
    top: '#9b72ff',
    rects: [...BORDERS, [14, 5, 4, 8], [4, 5, 6, 1], [22, 5, 6, 1], [6, 9, 5, 1], [21, 9, 5, 1], [3, 13, 7, 1], [22, 13, 7, 1]],
    spawns: [[960, 300], [420, 300], [1500, 300], [510, 540], [1410, 540], [390, 780], [1530, 780], [1620, 1020]],
  },
  {
    name: { fr: 'La Cabane', en: 'The Treehouse' },
    sky: ['#bff0d4', '#fff1c9'],
    body: '#f6e3c4',
    top: '#7bd13b',
    rects: [...BORDERS, [4, 5, 5, 1], [23, 5, 5, 1], [11, 8, 10, 1], [4, 12, 6, 1], [22, 12, 6, 1], [14, 4, 4, 1], [14, 14, 4, 1]],
    spawns: [[390, 300], [1530, 300], [780, 480], [1140, 480], [420, 720], [1500, 720], [960, 240], [960, 840]],
  },
];
// Arène de la partie en cours (une seule partie à la fois).
let SOLIDS: { x: number; y: number; w: number; h: number }[] = [];
let SPAWNS: [number, number][] = [];

interface Arrow {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number;
  stuck: boolean;
  age: number;
}

interface P extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  alive: boolean;
  arrows: number;
  dir: 1 | -1;
  inp: { x: number; y: number; a: boolean };
  jumpReq: number;
  shootReq: boolean;
  lastA: boolean;
  lastB: boolean;
  lastC: boolean;
  /** Esquive en cours (on traverse les flèches et on peut en attraper une). */
  dodge: number;
  dodgeCool: number;
  /** Protection : début de manche ou bulle ramassée. */
  shield: number;
  bubble: boolean;
  wins: number;
  kills: number;
  cool: number;
  botT: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const wrap = (v: number, m: number) => ((v % m) + m) % m;
const hitSolid = (x: number, y: number) => SOLIDS.find((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const map = MAPS[Math.floor(Math.random() * MAPS.length)];
  SOLIDS = map.rects.map(([x, y, w, h]) => ({ x: x * T, y: y * T, w: w * T, h: h * T }));
  SPAWNS = map.spawns;
  const fr = ctx.lang === 'fr';
  const ps: P[] = runners.slice(0, SPAWNS.length).map((r) => ({
    ...r,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    onGround: false,
    alive: true,
    arrows: 3,
    dir: 1,
    inp: { x: 0, y: 0, a: false },
    jumpReq: 0,
    shootReq: false,
    lastA: false,
    lastB: false,
    lastC: false,
    dodge: 0,
    dodgeCool: 0,
    shield: 0,
    bubble: false,
    wins: 0,
    kills: 0,
    cool: 0,
    botT: 0,
  }));
  let arrows: Arrow[] = [];
  let time = 0;
  let round = 0;
  let pause = 0;
  let banner = '';
  let endDelay = -1;
  let roundOver = false;
  let roundTime = 0;
  let suddenSaid = false;
  let freeze = 0;
  let shake = 0;
  type Part = { x: number; y: number; vx: number; vy: number; t: number; c: string; r: number };
  const parts: Part[] = [];
  const pops: { x: number; y: number; text: string; c: string; t: number }[] = [];
  let chest: { x: number; y: number; t: number } | null = null;
  let chestT = 10;
  const burst = (x: number, y: number, n: number, c: string | string[], sp = 400, r = 8) => {
    if (ctx.light) n = Math.ceil(n / 3);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = sp * rnd(0.3, 1);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, t: rnd(0.4, 0.8), c: Array.isArray(c) ? c[k % c.length] : c, r: r * rnd(0.6, 1.3) });
    }
  };

  function startRound() {
    round++;
    roundTime = 0;
    suddenSaid = false;
    arrows = [];
    const spots = [...SPAWNS].sort(() => Math.random() - 0.5);
    ps.forEach((p, i) => {
      [p.x, p.y] = spots[i];
      p.vx = p.vy = 0;
      p.alive = true;
      p.arrows = 3;
      p.dir = p.x < W / 2 ? 1 : -1;
      p.shield = 1.5;
      p.bubble = false;
      p.dodge = 0;
    });
    chest = null;
    chestT = rnd(8, 12);
    banner = fr ? `Manche ${round}` : `Round ${round}`;
    pause = 1.4;
  }

  function kill(p: P, by: number) {
    if (!p.alive || p.shield > 0 || p.dodge > 0) return;
    if (p.bubble) {
      // La bulle encaisse le coup
      p.bubble = false;
      p.shield = 0.8;
      burst(p.x, p.y - BH / 2, 14, ['#bfe9ff', '#fff'], 380, 9);
      pops.push({ x: p.x, y: p.y - 100, text: 'PLOP !', c: '#2ec5ff', t: 0.9 });
      sfx.pop();
      return;
    }
    p.alive = false;
    freeze = 0.12;
    shake = 12;
    burst(p.x, p.y - BH / 2, 22, [p.profile.color, '#ffd60a', '#fff'], 520, 10);
    pops.push({ x: p.x, y: p.y - 90, text: ctx.family ? 'Touché !' : 'SPLOTCH !', c: '#ff4f9a', t: 1.1 });
    if (by >= 0 && ps[by] !== p) pops.push({ x: ps[by].x, y: ps[by].y - 110, text: '+1', c: '#ffd60a', t: 0.9 });
    if (by >= 0 && ps[by] !== p) ps[by].kills++;
    sfx.pet();
    // On laisse tomber ses flèches
    for (let k = 0; k < p.arrows; k++) arrows.push({ x: p.x + rnd(-20, 20), y: p.y - 20, vx: rnd(-200, 200), vy: -300, owner: -1, stuck: false, age: 1 });
    p.arrows = 0;
    if (!p.bot) ctx.buzz(p.pid, 400);
  }

  function collide(p: P) {
    for (const s of SOLIDS) {
      if (p.x + HW <= s.x || p.x - HW >= s.x + s.w || p.y <= s.y || p.y - BH >= s.y + s.h) continue;
      // Sortie par le plus petit chevauchement
      const ups = p.y - s.y;
      const downs = s.y + s.h - (p.y - BH);
      const lefts = p.x + HW - s.x;
      const rights = s.x + s.w - (p.x - HW);
      const m = Math.min(ups, downs, lefts, rights);
      if (m === ups && p.vy >= 0) {
        p.y = s.y;
        p.vy = 0;
        p.onGround = true;
      } else if (m === downs && p.vy < 0) {
        p.y = s.y + s.h + BH;
        p.vy = 0;
      } else if (m === lefts) {
        p.x = s.x - HW;
        p.vx = 0;
      } else if (m === rights) {
        p.x = s.x + s.w + HW;
        p.vx = 0;
      } else if (m === ups) {
        p.y = s.y;
      } else p.y = s.y + s.h + BH;
    }
  }

  function bot(p: P, i: number, dt: number) {
    p.botT -= dt;
    for (const a of arrows)
      if (!a.stuck && a.owner >= 0 && a.owner !== i && p.dodgeCool <= 0 && Math.hypot(a.x - p.x, a.y - p.y) < 170 && Math.random() < 0.12) {
        startDodge(p, Math.sign(-a.vy || 1) * 0, -1);
        break;
      }
    let target: { x: number; y: number } | null = null;
    if (p.arrows === 0) {
      const a = arrows.filter((a) => a.stuck).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (a) target = a;
    }
    const foes = ps.filter((o, j) => j !== i && o.alive && !allies(o, p));
    const foe = foes.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!target && foe) target = foe;
    if (!target) return;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    p.inp.x = Math.abs(dx) > 30 ? Math.sign(dx) : 0;
    p.inp.y = 0;
    p.inp.a = false;
    if (p.onGround && (dy < -80 || hitSolid(p.x + p.inp.x * 40, p.y - 20)) && Math.random() < 0.08) p.jumpReq = 0.1;
    if (p.botT <= 0 && foe && p.arrows > 0) {
      const fdx = foe.x - p.x;
      const fdy = foe.y - p.y;
      const aligned = Math.abs(fdy) < 50 || Math.abs(fdx) < 40 || Math.abs(Math.abs(fdx) - Math.abs(fdy)) < 60;
      if (aligned && Math.hypot(fdx, fdy) < 900 && Math.random() < 0.5) {
        p.inp.x = Math.abs(fdx) > 40 ? Math.sign(fdx) : 0;
        p.inp.y = Math.abs(fdy) > 50 ? Math.sign(fdy) : 0;
        p.shootReq = true;
        p.botT = rnd(0.6, 1.2);
      } else p.botT = rnd(0.15, 0.35);
    }
  }

  function startDodge(p: P, ix: number, iy: number) {
    if (p.dodgeCool > 0) return;
    let dx = Math.abs(ix) > 0.3 ? Math.sign(ix) : 0;
    let dy = Math.abs(iy) > 0.3 ? Math.sign(iy) : 0;
    if (!dx && !dy) dx = p.dir;
    const l = Math.hypot(dx, dy);
    p.vx = (dx / l) * 1050;
    p.vy = (dy / l) * 1050;
    p.dodge = 0.22;
    p.dodgeCool = 0.9;
    burst(p.x, p.y - BH / 2, 6, '#fff', 200, 7);
    sfx.step();
  }

  function shoot(p: P, i: number) {
    if (p.arrows <= 0 || p.cool > 0) return;
    let ax = Math.abs(p.inp.x) > 0.35 ? Math.sign(p.inp.x) : 0;
    let ay = Math.abs(p.inp.y) > 0.35 ? Math.sign(p.inp.y) : 0;
    if (!ax && !ay) ax = p.dir;
    const l = Math.hypot(ax, ay);
    ax /= l;
    ay /= l;
    arrows.push({ x: p.x + ax * 30, y: p.y - BH / 2 + ay * 30, vx: ax * ARROW_V, vy: ay * ARROW_V, owner: i, stuck: false, age: 0 });
    p.arrows--;
    p.cool = 0.25;
    p.shield = 0;
    sfx.boing();
  }

  function drawPlatforms(g: CanvasRenderingContext2D) {
    g.strokeStyle = INK;
    g.lineWidth = 5;
    const body = map.body ?? '#ffd9ea';
    const top = map.top ?? '#ff7eb6';
    for (const s of SOLIDS) {
      // Ombre plate puis bloc avec un nappage sur le dessus
      g.fillStyle = 'rgba(58,33,64,0.18)';
      g.beginPath();
      g.roundRect(s.x + 1, s.y + 7, s.w - 2, s.h - 2, 12);
      g.fill();
      g.fillStyle = body;
      g.beginPath();
      g.roundRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2, 12);
      g.fill();
      candy(g, s.x + 1, s.y + 1, s.w - 2, s.h - 2, 12);
      g.fillStyle = top;
      g.beginPath();
      g.roundRect(s.x + 1, s.y + 1, s.w - 2, Math.min(18, s.h - 2), [12, 12, 4, 4]);
      g.fill();
      if (!ctx.light && s.w > 80)
        for (let x = s.x + 24; x < s.x + s.w - 14; x += 44) {
          g.beginPath();
          g.arc(x, s.y + 18, 8, 0, Math.PI);
          g.fill();
        }
      g.beginPath();
      g.roundRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2, 12);
      g.stroke();
    }
  }
  let platforms: HTMLCanvasElement | null = null;

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const p = ps.find((x) => x.pid === pid);
      if (!p) return;
      if (m.a && !p.lastA) p.jumpReq = 0.12;
      if (m.b && !p.lastB) p.shootReq = true;
      if (m.c && !p.lastC && p.alive) startDodge(p, m.x, m.y);
      p.lastC = !!m.c;
      p.lastA = m.a;
      p.lastB = m.b;
      p.inp = { x: m.x, y: m.y, a: m.a };
    },
    update(dt) {
      time += dt;
      for (const q of parts) {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vy += 900 * dt;
        q.t -= dt;
      }
      for (let k = parts.length - 1; k >= 0; k--) if (parts[k].t <= 0) parts.splice(k, 1);
      for (const q of pops) {
        q.t -= dt;
        q.y -= 60 * dt;
      }
      for (let k = pops.length - 1; k >= 0; k--) if (pops[k].t <= 0) pops.splice(k, 1);
      shake = Math.max(0, shake - dt * 50);
      if (freeze > 0) {
        freeze -= dt;
        return;
      }
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) {
          if (endDelay >= 0) game.over = true;
          else if (roundOver) {
            roundOver = false;
            startRound();
          } else banner = '';
        }
        return;
      }
      ps.forEach((p, i) => {
        if (!p.alive) return;
        if (p.bot) bot(p, i, dt);
        p.cool = Math.max(0, p.cool - dt);
        p.dodgeCool = Math.max(0, p.dodgeCool - dt);
        p.shield = Math.max(0, p.shield - dt);
        p.jumpReq = Math.max(0, p.jumpReq - dt);
        const mx = Math.abs(p.inp.x) > 0.25 ? Math.sign(p.inp.x) : 0;
        if (mx) p.dir = mx as 1 | -1;
        const target = mx * RUN;
        const acc = (p.onGround ? 4000 : 2400) * dt;
        if (p.dodge > 0) p.dodge -= dt;
        else p.vx += Math.max(-acc, Math.min(acc, target - p.vx));
        if (p.jumpReq > 0 && p.onGround) {
          p.vy = -JUMP;
          p.jumpReq = 0;
          p.onGround = false;
        }
        if (p.shootReq) shoot(p, i);
        p.shootReq = false;
        if (p.dodge <= 0) p.vy += GRAV * dt * (p.vy < 0 && !p.inp.a && !p.bot ? 1.8 : 1);
        else p.vy *= Math.pow(0.02, dt);
        p.vy = Math.min(p.vy, 1500);
        p.x = wrap(p.x + p.vx * dt, W);
        p.y += p.vy * dt;
        if (p.y > H + BH) p.y -= H + BH;
        if (p.y < 0) p.y += H;
        p.onGround = false;
        collide(p);
        // Ramasser une flèche plantée
        for (const a of arrows)
          if ((a.stuck || a.owner < 0) && Math.hypot(a.x - p.x, a.y - (p.y - BH / 2)) < 44) {
            a.age = -1;
            p.arrows = Math.min(5, p.arrows + 1);
            sfx.click();
          }
        // Coffre : +2 flèches et une bulle protectrice
        if (chest && Math.hypot(chest.x - p.x, chest.y - (p.y - 20)) < 60) {
          p.arrows = Math.min(5, p.arrows + 2);
          p.bubble = true;
          burst(chest.x, chest.y, 18, ['#ffd60a', '#ff4f9a', '#fff'], 420, 9);
          pops.push({ x: chest.x, y: chest.y - 60, text: fr ? 'BULLE + 2 🏹' : 'BUBBLE + 2 🏹', c: '#2ec5ff', t: 1.2 });
          sfx.win();
          chest = null;
          chestT = rnd(9, 14);
        }
      });
      arrows = arrows.filter((a) => a.age >= 0);
      if (!chest && (chestT -= dt) <= 0) {
        const [cx, cy] = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
        chest = { x: cx, y: cy - 30, t: 0 };
        sfx.join();
      }
      if (chest) chest.t += dt;
      for (const a of arrows) {
        a.age += dt;
        if (a.stuck) continue;
        a.vy += (a.owner < 0 ? GRAV : 500) * dt;
        const steps = 3;
        for (let s = 0; s < steps; s++) {
          a.x = wrap(a.x + (a.vx * dt) / steps, W);
          a.y = wrap(a.y + (a.vy * dt) / steps, H);
          if (hitSolid(a.x, a.y)) {
            a.x -= (a.vx * dt) / steps;
            a.y -= (a.vy * dt) / steps;
            a.stuck = true;
            if (a.owner < 0) {
              a.vx = 0;
            }
            break;
          }
          if (a.owner < 0) continue;
          for (const [j, p] of ps.entries()) {
            if (!p.alive || (j === a.owner && a.age < 0.15) || a.owner < 0 || allies(p, ps[a.owner])) continue;
            if (Math.abs(a.x - p.x) < HW + 6 && a.y > p.y - BH - 4 && a.y < p.y + 4) {
              if (p.dodge > 0 && p.arrows < 5) {
                // Rattrapée au vol !
                p.arrows++;
                a.age = -1;
                a.stuck = true;
                pops.push({ x: p.x, y: p.y - 100, text: fr ? 'ATTRAPÉE !' : 'CAUGHT!', c: '#1fc9a0', t: 1 });
                sfx.join();
                break;
              }
              kill(p, a.owner);
              a.stuck = true;
              a.vx = a.vy = 0;
              a.owner = -1;
            }
          }
        }
      }
      // Saut sur la tête
      for (const [i, a] of ps.entries())
        for (const [j, b] of ps.entries()) {
          if (i === j || !a.alive || !b.alive || a.vy <= 100 || allies(a, b) || b.dodge > 0) continue;
          if (Math.abs(a.x - b.x) < HW * 2 && a.y > b.y - BH - 6 && a.y < b.y - BH + 18) {
            kill(b, i);
            a.vy = -JUMP * 0.7;
          }
        }
      roundTime += dt;
      if (roundTime > SUDDEN && !suddenSaid) {
        suddenSaid = true;
        banner = fr ? 'Mort subite !' : 'Sudden death!';
        speak(banner, ctx.lang);
        setTimeout(() => banner === (fr ? 'Mort subite !' : 'Sudden death!') && (banner = ''), 1600);
        // Tout le monde recharge : ça va vite se finir
        ps.forEach((p) => p.alive && (p.arrows = 5));
      }
      const alive = ps.filter((p) => p.alive);
      const timeUp = roundTime > ROUND_TIME;
      if ((sidesLeft(alive) <= 1 || timeUp) && pause <= 0) {
        // Temps écoulé : le camp avec le plus de survivants gagne, sinon égalité
        let w: P | undefined = alive[0];
        if (timeUp && sidesLeft(alive) > 1) {
          const n = new Map<string, number>();
          alive.forEach((p) => n.set(side(p), (n.get(side(p)) ?? 0) + 1));
          const best = [...n.entries()].sort((a, b) => b[1] - a[1]);
          w = best[0][1] > best[1][1] ? alive.find((p) => side(p) === best[0][0]) : undefined;
        }
        if (w) {
          const wn = w;
          ps.forEach((p) => (p === wn || allies(p, wn)) && p.wins++);
          const name = winnerName(w, ctx.lang);
          banner = fr ? `${name} gagne la manche !` : `${name} wins the round!`;
          burst(w.x, w.y - 60, 30, ['#ff4f9a', '#ffd60a', '#1fc9a0', '#2ec5ff'], 600, 9);
          speak(banner, ctx.lang);
          sfx.win();
        } else banner = timeUp ? (fr ? 'Temps écoulé : égalité !' : 'Time up: draw!') : fr ? 'Égalité !' : 'Draw!';
        pause = 2.4;
        roundOver = true;
        if ((w && w.wins >= WIN_ROUNDS) || time > MAX_TIME) endDelay = 0;
      }
    },
    render(g, t) {
      drawSky(g, t, ctx.light, map.sky[0], map.sky[1]);
      g.save();
      if (shake) g.translate(rnd(-shake, shake), rnd(-shake, shake));
      g.strokeStyle = INK;
      g.lineWidth = 5;
      // Les plateformes ne bougent pas : dessinées une fois dans une image, puis recopiées
      if (!platforms) {
        platforms = document.createElement('canvas');
        platforms.width = W;
        platforms.height = H;
        const pg = platforms.getContext('2d')!;
        drawPlatforms(pg);
      }
      g.drawImage(platforms, 0, 0);
      if (chest) {
        const bob = Math.sin(chest.t * 4) * 6;
        g.save();
        g.translate(chest.x, chest.y + bob);
        g.fillStyle = '#ffd60a';
        g.globalAlpha = 0.35 + Math.sin(chest.t * 6) * 0.15;
        g.beginPath();
        g.arc(0, 0, 58, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
        g.fillStyle = '#c98a5a';
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(-30, -18, 60, 40, 8);
        g.fill();
        g.stroke();
        g.fillStyle = '#e8b98a';
        g.beginPath();
        g.roundRect(-32, -30, 64, 18, [10, 10, 2, 2]);
        g.fill();
        g.stroke();
        g.fillStyle = '#ffd60a';
        g.fillRect(-6, -14, 12, 14);
        g.strokeRect(-6, -14, 12, 14);
        g.restore();
      }
      for (const a of arrows) {
        if (!a.stuck && a.owner >= 0 && !ctx.light) {
          const sp = Math.hypot(a.vx, a.vy) || 1;
          g.strokeStyle = ps[a.owner].profile.color;
          g.globalAlpha = 0.5;
          g.lineWidth = 8;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(a.x - (a.vx / sp) * 40, a.y - (a.vy / sp) * 40);
          g.lineTo(a.x - (a.vx / sp) * 130, a.y - (a.vy / sp) * 130);
          g.stroke();
          g.globalAlpha = 1;
        }
        const ang = a.stuck && a.owner >= 0 ? Math.atan2(a.vy, a.vx) : a.stuck ? 0.3 : Math.atan2(a.vy, a.vx);
        g.save();
        g.translate(a.x, a.y);
        g.rotate(ang);
        if (a.stuck) {
          // Flèche à ramasser : petit halo
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.beginPath();
          g.arc(-20, 0, 26 + Math.sin(t * 5) * 3, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = INK;
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(-42, 0);
        g.lineTo(0, 0);
        g.stroke();
        g.strokeStyle = '#ffd9a0';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(-40, 0);
        g.lineTo(0, 0);
        g.stroke();
        g.fillStyle = '#ff3b3b';
        g.beginPath();
        g.ellipse(4, 0, 6, 10, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#7bd13b';
        g.fillRect(-44, -6, 10, 12);
        g.restore();
      }
      ps.forEach((p, i) => {
        if (!p.alive) return;
        if (p.team !== undefined) {
          g.fillStyle = TEAMS[p.team].color;
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.beginPath();
          g.ellipse(p.x, p.y + 2, 30, 9, 0, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
        if (p.dodge > 0) g.globalAlpha = 0.55;
        else if (p.shield > 0 && Math.floor(t * 12) % 2) g.globalAlpha = 0.6;
        // Visée : petite flèche dans la direction du stick
        if (!p.bot && p.arrows > 0 && (Math.abs(p.inp.x) > 0.35 || Math.abs(p.inp.y) > 0.35)) {
          const ax = Math.abs(p.inp.x) > 0.35 ? Math.sign(p.inp.x) : 0;
          const ay = Math.abs(p.inp.y) > 0.35 ? Math.sign(p.inp.y) : 0;
          const l = Math.hypot(ax, ay);
          const cx = p.x + (ax / l) * 70;
          const cy = p.y - BH / 2 + (ay / l) * 70;
          g.save();
          g.translate(cx, cy);
          g.rotate(Math.atan2(ay, ax));
          g.fillStyle = p.profile.color;
          g.strokeStyle = INK;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(14, 0);
          g.lineTo(-8, -11);
          g.lineTo(-8, 11);
          g.closePath();
          g.fill();
          g.stroke();
          g.restore();
        }
        drawCharacter(g, p.x, p.y, 76, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          dir: p.dir,
          run: p.onGround ? Math.min(1, Math.abs(p.vx) / RUN) : 0.3,
        });
        g.globalAlpha = 1;
        if (p.bubble) {
          g.strokeStyle = '#2ec5ff';
          g.fillStyle = 'rgba(191,233,255,0.25)';
          g.lineWidth = 4;
          g.beginPath();
          g.arc(p.x, p.y - BH / 2 - 6, 56 + Math.sin(t * 5) * 3, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
        // Carquois : une flèche par trait au-dessus de la tête
        for (let k = 0; k < p.arrows; k++) {
          const ax = p.x - (p.arrows - 1) * 7 + k * 14;
          g.strokeStyle = INK;
          g.lineWidth = 6;
          g.beginPath();
          g.moveTo(ax, p.y - 112);
          g.lineTo(ax, p.y - 90);
          g.stroke();
          g.fillStyle = '#ff3b3b';
          g.beginPath();
          g.arc(ax, p.y - 114, 5, 0, Math.PI * 2);
          g.fill();
        }
      });
      for (const q of parts) {
        g.globalAlpha = Math.min(1, q.t * 2);
        g.fillStyle = q.c;
        g.beginPath();
        g.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      for (const q of pops) {
        g.globalAlpha = Math.min(1, q.t * 3);
        g.font = '700 46px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 10;
        g.strokeStyle = INK;
        g.strokeText(q.text, q.x, q.y);
        g.fillStyle = q.c;
        g.fillText(q.text, q.x, q.y);
      }
      g.globalAlpha = 1;
      g.restore();
      // Cartes des joueurs, en bas sur le sol
      const cw = Math.min(230, 1500 / ps.length);
      const x0 = 960 - (cw * ps.length) / 2;
      ps.forEach((p, i) => {
        const x = x0 + i * cw + 4;
        const y = 1024;
        g.globalAlpha = p.alive ? 1 : 0.5;
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(x, y, cw - 8, 52, 26);
        g.fill();
        g.stroke();
        g.fillStyle = p.team !== undefined ? TEAMS[p.team].color : p.profile.color;
        g.beginPath();
        g.arc(x + 26, y + 26, 16, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.font = '700 28px Fredoka, sans-serif';
        g.textAlign = 'left';
        g.fillText(p.profile.name.slice(0, 8), x + 50, y + 36);
        g.textAlign = 'right';
        g.fillText('★'.repeat(p.wins) + '☆'.repeat(Math.max(0, WIN_ROUNDS - p.wins)), x + cw - 20, y + 36);
        g.globalAlpha = 1;
      });
      if (pause <= 0) {
        const left = Math.max(0, Math.ceil(ROUND_TIME - roundTime));
        const hot = roundTime > SUDDEN;
        g.font = '700 44px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = hot ? '#ff4f9a' : '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(1160, 4, 230, 60, 30);
        g.fill();
        g.stroke();
        g.fillStyle = hot ? '#fff' : INK;
        g.font = '700 34px Fredoka, sans-serif';
        g.fillText(`${fr ? 'Manche' : 'Round'} ${left}s`, 1275, 46);
      }
      if (banner) {
        g.font = '700 90px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineJoin = 'round';
        g.lineWidth = 22;
        g.strokeStyle = INK;
        g.strokeText(banner, 960, 560);
        g.fillStyle = '#ffd60a';
        g.fillText(banner, 960, 560);
      }
    },
    mapName: map.name,
    ranking() {
      return [...ps].sort((a, b) => b.wins - a.wins || b.kills - a.kills).map((p) => p.pid);
    },
    leader() {
      const w = ps.find((p) => p.wins >= WIN_ROUNDS);
      return w ? winnerName(w, ctx.lang) : null;
    },
  };
  startRound();
  return game;
}

export const archers: GameBase = {
  id: 'archers',
  emoji: '🏹',
  name: { fr: 'Flèches à Ventouse', en: 'Sucker Arrows' },
  how: {
    fr: 'Stick pour courir et viser · A saute · B tire. Premier à 3 manches !',
    en: 'Stick to run and aim · A jumps · B shoots. First to 3 rounds!',
  },
  inspired: 'TowerFall',
  layout: 'stick',
  min: 2,
  max: 8,
  botFill: 4,
  music: 'tumble',
  limit: 150,
  timerTop: true,
  create,
};
