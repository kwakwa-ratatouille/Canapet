// Flèches à Ventouse : petite arène, les bords se rejoignent. Une flèche (ou un saut sur la tête) = KO.
// Stick = courir et viser · A = sauter · B = tirer. 3 flèches à ramasser. Premier à 3 manches.
import { drawCharacter } from '../shared/characters';
import { sfx, speak } from '../shared/sound';
import { drawSky, roundRectText } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const T = 60;
const W = 1920;
const H = 1080;
const GRAV = 2400;
const RUN = 390;
const JUMP = 880;
const HW = 18;
const BH = 56;
const ARROW_V = 1350;
const WIN_ROUNDS = 3;
const MAX_TIME = 170;

// Bords communs : plafond et sol troués au milieu, murs troués (on passe d'un côté à l'autre).
const BORDERS: [number, number, number, number][] = [
  [0, 0, 10, 1], [22, 0, 10, 1], [0, 17, 10, 1], [22, 17, 10, 1],
  [0, 0, 1, 6], [0, 8, 1, 10], [31, 0, 1, 6], [31, 8, 1, 10],
];
/** Arènes : chaque partie en tire une au hasard. */
const MAPS: { name: { fr: string; en: string }; rects: [number, number, number, number][]; spawns: [number, number][]; sky: [string, string] }[] = [
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
    rects: [...BORDERS, [3, 4, 7, 1], [22, 4, 7, 1], [12, 7, 8, 1], [2, 10, 6, 1], [24, 10, 6, 1], [9, 13, 5, 1], [18, 13, 5, 1]],
    spawns: [[360, 240], [1560, 240], [960, 420], [300, 600], [1620, 600], [690, 780], [1230, 780], [300, 1020]],
  },
  {
    name: { fr: 'Le Puits', en: 'The Well' },
    sky: ['#d7d0ff', '#ffe3f1'],
    rects: [...BORDERS, [14, 5, 4, 8], [4, 5, 6, 1], [22, 5, 6, 1], [6, 9, 5, 1], [21, 9, 5, 1], [3, 13, 7, 1], [22, 13, 7, 1]],
    spawns: [[960, 300], [420, 300], [1500, 300], [510, 540], [1410, 540], [390, 780], [1530, 780], [1620, 1020]],
  },
  {
    name: { fr: 'La Cabane', en: 'The Treehouse' },
    sky: ['#bff0d4', '#fff1c9'],
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

  function startRound() {
    round++;
    arrows = [];
    const spots = [...SPAWNS].sort(() => Math.random() - 0.5);
    ps.forEach((p, i) => {
      [p.x, p.y] = spots[i];
      p.vx = p.vy = 0;
      p.alive = true;
      p.arrows = 3;
      p.dir = p.x < W / 2 ? 1 : -1;
    });
    banner = fr ? `Manche ${round}` : `Round ${round}`;
    pause = 1.4;
  }

  function kill(p: P, by: number) {
    if (!p.alive) return;
    p.alive = false;
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
    let target: { x: number; y: number } | null = null;
    if (p.arrows === 0) {
      const a = arrows.filter((a) => a.stuck).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (a) target = a;
    }
    const foes = ps.filter((o, j) => j !== i && o.alive);
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
    sfx.boing();
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const p = ps.find((x) => x.pid === pid);
      if (!p) return;
      if (m.a && !p.lastA) p.jumpReq = 0.12;
      if (m.b && !p.lastB) p.shootReq = true;
      p.lastA = m.a;
      p.lastB = m.b;
      p.inp = { x: m.x, y: m.y, a: m.a };
    },
    update(dt) {
      time += dt;
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
        p.jumpReq = Math.max(0, p.jumpReq - dt);
        const mx = Math.abs(p.inp.x) > 0.25 ? Math.sign(p.inp.x) : 0;
        if (mx) p.dir = mx as 1 | -1;
        const target = mx * RUN;
        const acc = (p.onGround ? 4000 : 2400) * dt;
        p.vx += Math.max(-acc, Math.min(acc, target - p.vx));
        if (p.jumpReq > 0 && p.onGround) {
          p.vy = -JUMP;
          p.jumpReq = 0;
          p.onGround = false;
        }
        if (p.shootReq) shoot(p, i);
        p.shootReq = false;
        p.vy += GRAV * dt * (p.vy < 0 && !p.inp.a && !p.bot ? 1.8 : 1);
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
      });
      arrows = arrows.filter((a) => a.age >= 0);
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
            if (!p.alive || (j === a.owner && a.age < 0.15)) continue;
            if (Math.abs(a.x - p.x) < HW + 6 && a.y > p.y - BH - 4 && a.y < p.y + 4) {
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
          if (i === j || !a.alive || !b.alive || a.vy <= 100) continue;
          if (Math.abs(a.x - b.x) < HW * 2 && a.y > b.y - BH - 6 && a.y < b.y - BH + 18) {
            kill(b, i);
            a.vy = -JUMP * 0.7;
          }
        }
      const alive = ps.filter((p) => p.alive);
      if (alive.length <= 1 && pause <= 0) {
        const w = alive[0];
        if (w) {
          w.wins++;
          banner = fr ? `${w.profile.name} gagne la manche !` : `${w.profile.name} wins the round!`;
          speak(banner, ctx.lang);
          sfx.win();
        } else banner = fr ? 'Égalité !' : 'Draw!';
        pause = 2.4;
        roundOver = true;
        if ((w && w.wins >= WIN_ROUNDS) || time > MAX_TIME) endDelay = 0;
      }
    },
    render(g, t) {
      drawSky(g, t, ctx.light, map.sky[0], map.sky[1]);
      g.strokeStyle = INK;
      g.lineWidth = 4;
      for (const s of SOLIDS) {
        g.fillStyle = '#ffd9ea';
        g.beginPath();
        g.roundRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2, 10);
        g.fill();
        g.stroke();
        g.fillStyle = '#ff7eb6';
        g.fillRect(s.x + 3, s.y + 3, s.w - 6, 12);
      }
      for (const a of arrows) {
        const ang = a.stuck && a.owner >= 0 ? Math.atan2(a.vy, a.vx) : a.stuck ? 0.3 : Math.atan2(a.vy, a.vx);
        g.save();
        g.translate(a.x, a.y);
        g.rotate(ang);
        g.strokeStyle = '#a0643a';
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
        drawCharacter(g, p.x, p.y, 72, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          selfie: p.selfie,
          t: t + i,
          dir: p.dir,
          run: p.onGround ? Math.min(1, Math.abs(p.vx) / RUN) : 0.3,
        });
        g.fillStyle = '#a0643a';
        for (let k = 0; k < p.arrows; k++) g.fillRect(p.x - 14 + k * 10, p.y - 96, 5, 16);
      });
      const w = Math.min(220, 1700 / ps.length);
      ps.forEach((p, i) => {
        const x = 110 + i * w;
        g.globalAlpha = p.alive ? 1 : 0.45;
        roundRectText(g, p.profile.name, x, 100, w - 12, 24, p.profile.color);
        g.globalAlpha = 1;
        g.font = '28px sans-serif';
        g.textAlign = 'center';
        g.fillText('⭐'.repeat(p.wins) || '·', x + (w - 12) / 2, 140);
      });
      if (banner) {
        g.font = '700 90px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 10;
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
      return ps.find((p) => p.wins >= WIN_ROUNDS)?.profile.name ?? null;
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
  create,
};
