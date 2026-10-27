import { TEAMS, allies, sidesLeft, winnerName } from './teams';
// Bagarre Molle : persos tout mous qui se baffent, s'attrapent et se jettent dans la mer de crème.
// A = saut · B court = baffe · B maintenu = attraper, relâcher = jeter (direction du stick). Trop de baffes = sonné.
// Premier à 2 manches. Chaque carte a son piège : vent, gouttes de sirop, plateformes qui bougent.
import { drawCharacter } from '../shared/characters';
import { INK, MENTHE, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { drawSky, roundRectText } from './draw';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

const GRAV = 2200;
const RUN = 340;
const JUMP = 840;
const HW = 24;
const SIZE = 100;
const WIN_ROUNDS = 2;
const MAX_TIME = 240;
const SEA_Y = 960;
/** Au bout de 40 s, la crème monte pour départager tout le monde. */
const RISE_AT = 40;
const RISE_SPEED = 14;

type Plat = { x: number; y: number; w: number; by: number; ay: number; freq: number; ph: number; dy: number };
type Hazard = 'bob' | 'wind' | 'drops' | 'stools';

interface MapDef {
  name: { fr: string; en: string };
  hazard: Hazard;
  sky: [string, string];
  sea: string;
  seaLine: string;
  plat: string;
  plats: [number, number, number, number?][]; // x, y, largeur, amplitude verticale
}

/** Cartes : chaque bagarre en tire une au hasard, avec son piège. */
const MAPS: MapDef[] = [
  {
    name: { fr: 'Les Nénuphars', en: 'The Lily Pads' },
    hazard: 'bob',
    sky: ['#ffc6a8', '#ffe9f3'],
    sea: '#fff6e0',
    seaLine: '#f0d9a8',
    plat: '#7bd13b',
    plats: [[360, 760, 1200], [110, 560, 270, 70], [1540, 560, 270, 70], [780, 470, 360, 50]],
  },
  {
    name: { fr: 'Le Pont venteux', en: 'The Windy Bridge' },
    hazard: 'wind',
    sky: ['#9fe3ff', '#e3f2ff'],
    sea: '#e9f9ff',
    seaLine: '#bfe6ff',
    plat: '#c98a5a',
    plats: [[240, 760, 560], [900, 760, 120], [1120, 760, 560], [700, 560, 520]],
  },
  {
    name: { fr: 'La Pile de Crêpes', en: 'The Pancake Stack' },
    hazard: 'drops',
    sky: ['#ffe08a', '#ffe9f3'],
    sea: '#fff2d6',
    seaLine: '#f0c98a',
    plat: '#f0b45a',
    plats: [[460, 800, 1000], [620, 620, 680], [800, 440, 320]],
  },
  {
    name: { fr: 'Les Tabourets', en: 'The Stools' },
    hazard: 'stools',
    sky: ['#ffd6ea', '#e3f2ff'],
    sea: '#e9fbf4',
    seaLine: '#bff0e4',
    plat: '#9b72ff',
    plats: [[260, 760, 300, 90], [700, 820, 240, 110], [1060, 820, 240, 110], [1440, 760, 300, 90], [780, 560, 360]],
  },
];

interface B extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  plat: Plat | null;
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
  lastC: boolean;
  kos: number;
  wins: number;
  lastHitBy: number;
  botCd: number;
  flying: number;
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
  kind: 'star' | 'drop' | 'smoke' | 'ring';
}

interface Drop {
  x: number;
  y: number;
  vy: number;
  warn: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const SLAPS = { fr: ['PAF !', 'BAFFE !', 'TCHAC !', 'BIM !'], en: ['SLAP!', 'WHAP!', 'BAM!', 'BONK!'] };

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const map = MAPS[Math.floor(Math.random() * MAPS.length)];
  const plats: Plat[] = map.plats.map(([x, y, w, ay]) => ({ x, y, w, by: y, ay: ay ?? 0, freq: rnd(0.35, 0.55), ph: rnd(0, 6), dy: 0 }));
  const fr = ctx.lang === 'fr';
  const bs: B[] = runners.slice(0, 8).map((r, i) => ({
    ...r,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    onGround: true,
    plat: null,
    dir: (i % 2 ? -1 : 1) as 1 | -1,
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
    lastC: false,
    kos: 0,
    wins: 0,
    lastHitBy: -1,
    botCd: rnd(0.3, 0.8),
    flying: 0,
  }));
  const parts: Part[] = [];
  const pops: { x: number; y: number; text: string; color: string; t: number; size: number }[] = [];
  let drops: Drop[] = [];
  let time = 0;
  let roundTime = 0;
  let riseWarned = false;
  const seaLevel = () => SEA_Y - Math.max(0, roundTime - RISE_AT) * RISE_SPEED;
  let round = 0;
  let outCount = 0;
  let pause = 0;
  let roundOver = false;
  let endDelay = -1;
  let banner = '';
  let shake = 0;
  let freeze = 0;
  // Vent : alerte puis bourrasque
  let windT = 7;
  let windDir = 1;
  let windOn = 0;
  let dropT = 3;
  const maxParts = ctx.light ? 60 : 220;

  function burst(x: number, y: number, n: number, kind: Part['kind'], color: string, speed = 300, size = 10, up = 0) {
    for (let k = 0; k < n && parts.length < maxParts; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * rnd(0.4, 1);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, t: 0, max: rnd(0.4, 0.8), size: size * rnd(0.6, 1.3), color, kind });
    }
  }
  const pop = (x: number, y: number, text: string, color: string, size = 44) => pops.push({ x, y, text, color, t: 1, size });

  function startRound() {
    round++;
    roundTime = 0;
    riseWarned = false;
    drops = [];
    windOn = 0;
    windT = 7;
    const n = bs.length;
    bs.forEach((b, i) => {
      const p = plats[i % plats.length];
      b.x = p.x + 40 + ((i * 137 + round * 61) % Math.max(1, p.w - 80));
      b.y = p.y;
      b.vx = b.vy = 0;
      b.alive = true;
      b.holding = b.heldBy = -1;
      b.ko = b.dizzy = 0;
      b.tilt = b.tiltV = 0;
      b.flying = 0;
      b.dir = b.x < 960 ? 1 : -1;
      void n;
    });
    banner = fr ? `Manche ${round}` : `Round ${round}`;
    pause = 1.5;
    speak(banner, ctx.lang);
  }

  function nearest(i: number, range: number) {
    const b = bs[i];
    let best = -1;
    let bd = range;
    bs.forEach((o, j) => {
      if (j === i || !o.alive || o.heldBy >= 0 || allies(o, b)) return;
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
      const up = b.inp.y < -0.4 ? 1.35 : 1;
      o.vx = dx * 980;
      o.vy = -560 * up;
      o.tiltV += dx * 16;
      o.lastHitBy = i;
      o.flying = 0.8;
      freeze = 0.07;
      shake = Math.max(shake, 16);
      burst(o.x, o.y - 50, 8, 'star', SOLEIL, 420, 12);
      pop(o.x, o.y - 140, fr ? 'HOP !' : 'YEET!', ROSE, 50);
      sfx.boing();
      if (!o.bot) ctx.buzz(o.pid, 220);
    }
    b.holding = -1;
  }

  function grab(i: number) {
    const b = bs[i];
    if (b.holding >= 0 || b.ko > 0 || b.heldBy >= 0) return;
    const j = nearest(i, 100);
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
    const plat = plats.find((p) => b.x > p.x - 10 && b.x < p.x + p.w + 10 && Math.abs(b.y - p.y) < 8);
    if (b.holding >= 0) {
      // Porter la victime vers le bord le plus proche puis la jeter.
      const p = plat ?? plats[0];
      const toLeft = b.x - p.x < p.x + p.w - b.x;
      b.inp.x = toLeft ? -1 : 1;
      b.bHeld = !((toLeft && b.x < p.x + 80) || (!toLeft && b.x > p.x + p.w - 80));
      return;
    }
    // Éviter les gouttes de sirop qui vont tomber pile dessus
    const danger = drops.find((d) => Math.abs(d.x - b.x) < 90);
    if (danger) {
      b.inp.x = b.x < danger.x ? -1 : 1;
      return;
    }
    let best = -1;
    let bd = 1e9;
    bs.forEach((o, j) => {
      if (j === i || !o.alive || o.heldBy >= 0 || allies(o, b)) return;
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
    // Contre le vent : on avance quand même
    if (windOn > 0 && plat) b.inp.x = b.inp.x || -windDir;
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

  function stepHazards(dt: number) {
    for (const p of plats) {
      if (!p.ay) {
        p.dy = 0;
        continue;
      }
      const ny = p.by + Math.sin(roundTime * p.freq * Math.PI * 2 + p.ph) * p.ay;
      p.dy = ny - p.y;
      p.y = ny;
    }
    if (map.hazard === 'wind') {
      windT -= dt;
      if (windOn > 0) windOn -= dt;
      if (windT <= 0) {
        windT = rnd(8, 11);
        windDir = Math.random() < 0.5 ? -1 : 1;
        windOn = 5;
        banner = fr ? 'Coup de vent !' : 'Gust of wind!';
        sfx.tick();
      }
      if (windOn > 0 && windOn < 3.2) for (const b of bs) if (b.alive && b.heldBy < 0) b.vx += windDir * (b.onGround ? 520 : 760) * dt;
      if (windOn <= 3 && banner.startsWith(fr ? 'Coup' : 'Gust')) banner = '';
    }
    if (map.hazard === 'drops') {
      dropT -= dt;
      if (dropT <= 0) {
        dropT = rnd(1.8, 3);
        const p = plats[Math.floor(Math.random() * plats.length)];
        drops.push({ x: p.x + rnd(40, p.w - 40), y: -120, vy: 0, warn: 1.1 });
      }
      for (const d of drops) {
        if (d.warn > 0) {
          d.warn -= dt;
          continue;
        }
        d.vy += GRAV * dt;
        d.y += d.vy * dt;
        for (const b of bs)
          if (b.alive && b.heldBy < 0 && Math.abs(b.x - d.x) < 52 && d.y > b.y - 110 && d.y < b.y) {
            b.vx = (b.x < d.x ? -1 : 1) * 420;
            b.vy = 200;
            b.dizzy += 2;
            if (b.dizzy >= 4 && b.ko <= 0) {
              b.ko = 2.5;
              b.dizzy = 0;
            }
            d.y = 99999;
            burst(b.x, b.y - 60, 10, 'drop', '#c97a35', 380, 14, 200);
            pop(b.x, b.y - 150, fr ? 'SPLOTCH !' : 'SPLAT!', '#c97a35');
            shake = Math.max(shake, 10);
            sfx.pop();
          }
        const top = plats.find((p) => d.x > p.x && d.x < p.x + p.w && d.y >= p.y && d.y - d.vy * dt < p.y + 4);
        if (top) {
          burst(d.x, top.y, 8, 'drop', '#c97a35', 300, 12, 150);
          d.y = 99999;
        }
      }
      drops = drops.filter((d) => d.y < 2000);
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
      // X : attraper (relâcher pour lancer)
      if (m.c && !b.lastC) {
        if (b.heldBy >= 0) b.grip -= 1;
        else grab(i);
      }
      if (!m.c && b.lastC && b.holding >= 0) release(i, true);
      b.lastC = !!m.c;
      b.bHeld = m.b;
      b.lastA = m.a;
      b.lastB = m.b;
      b.inp = { x: m.x, y: m.y };
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
      roundTime += dt;
      if (roundTime > RISE_AT && !riseWarned) {
        riseWarned = true;
        banner = fr ? 'La crème monte !' : 'The cream is rising!';
        setTimeout(() => banner.startsWith(fr ? 'La crème' : 'The cream') && (banner = ''), 2000);
        sfx.tick();
      }
      stepHazards(dt);
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
        b.flying = Math.max(0, b.flying - dt);
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
          pop(b.x, b.y - 150, fr ? 'LIBRE !' : 'FREE!', MENTHE, 40);
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
        if (b.onGround && b.plat) b.y += b.plat.dy;
        const control = b.ko <= 0;
        const mx = control && Math.abs(b.inp.x) > 0.25 ? Math.sign(b.inp.x) : 0;
        if (mx) b.dir = mx as 1 | -1;
        const speed = RUN * (b.holding >= 0 ? 0.6 : 1) * (b.dizzy > 2 ? 0.6 : 1);
        const acc = (b.onGround ? 2600 : 1400) * dt;
        if (control && b.flying <= 0) b.vx += Math.max(-acc, Math.min(acc, mx * speed - b.vx));
        else if (b.onGround) b.vx *= Math.pow(0.2, dt);
        if (b.jumpReq && control && b.onGround) {
          b.vy = -JUMP;
          b.onGround = false;
          b.tiltV -= b.dir * 3;
        }
        b.jumpReq = false;
        b.vy = Math.min(b.vy + GRAV * dt, 1500);
        // Traînée quand on vole après un lancer
        if (b.flying > 0 && !ctx.light && Math.random() < 0.7) parts.push({ x: b.x, y: b.y - 50, vx: 0, vy: 0, t: 0, max: 0.4, size: 22, color: '#ffffff', kind: 'smoke' });
        const prevY = b.y;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.onGround = false;
        b.plat = null;
        for (const p of plats)
          if (b.x + HW > p.x && b.x - HW < p.x + p.w && b.vy >= 0 && prevY <= p.y + 4 + Math.max(0, p.dy) && b.y >= p.y) {
            if (b.vy > 700) {
              burst(b.x, p.y, 4, 'smoke', '#ffffff', 160, 14);
              b.tiltV += b.dir * 6;
            }
            b.y = p.y;
            b.vy = 0;
            b.onGround = true;
            b.plat = p;
            b.flying = 0;
          }
        // Le corps mou se balance : ressort vers la verticale (couché si sonné)
        const rest = b.ko > 0 ? b.dir * -1.45 : 0;
        b.tiltV += (-(b.tilt - rest) * 60 - b.tiltV * 6 + b.vx * 0.015 * (b.onGround ? 1 : 0.3)) * dt;
        b.tilt += b.tiltV * dt;
        // Baffe
        if (b.punchT > 0 && b.punchT < 0.2 && !b.punchHit) {
          const j = nearest(i, 95);
          if (j >= 0) {
            const o = bs[j];
            b.punchHit = true;
            o.vx += b.dir * 420;
            o.vy -= 180;
            o.tiltV += b.dir * 12;
            o.dizzy += 1;
            o.lastHitBy = i;
            freeze = Math.max(freeze, 0.045);
            shake = Math.max(shake, 6);
            burst(o.x - b.dir * 10, o.y - 60, 6, 'star', SOLEIL, 360, 11);
            parts.push({ x: o.x, y: o.y - 60, vx: 0, vy: 0, t: 0, max: 0.25, size: 50, color: '#fff', kind: 'ring' });
            if (o.dizzy >= 4 && o.ko <= 0) {
              o.ko = 3;
              o.dizzy = 0;
              pop(o.x, o.y - 160, fr ? 'SONNÉ !' : 'DIZZY!', SOLEIL, 52);
              sfx.pet();
            } else {
              if (Math.random() < 0.6) pop(o.x, o.y - 150, SLAPS[ctx.lang][Math.floor(Math.random() * 4)], '#fff', 40);
              sfx.pop();
            }
            if (!o.bot) ctx.buzz(o.pid, 80);
          }
        }
        if (b.y > seaLevel() + 40 || b.x < -250 || b.x > 2170) {
          b.alive = false;
          b.out = ++outCount;
          if (b.holding >= 0) release(i, false);
          if (b.lastHitBy >= 0) bs[b.lastHitBy].kos++;
          const sx = Math.max(60, Math.min(1860, b.x));
          burst(sx, seaLevel(), 18, 'drop', map.sea === '#fff6e0' ? '#fff' : map.sea, 640, 16, 500);
          parts.push({ x: sx, y: seaLevel(), vx: 0, vy: 0, t: 0, max: 0.5, size: 120, color: '#fff', kind: 'ring' });
          pop(sx, seaLevel() - 120, ctx.family ? (fr ? 'Oups !' : 'Oops!') : fr ? 'PLOUF !' : 'SPLASH!', b.profile.color, 60);
          shake = Math.max(shake, 14);
          sfx.boing();
          if (!b.bot) ctx.buzz(b.pid, 500);
        }
      });
      const left = bs.filter((b) => b.alive);
      if (sidesLeft(left) <= 1 && !roundOver) {
        const w = left[0];
        if (w) {
          bs.forEach((o) => (o === w || allies(o, w)) && o.wins++);
          const name = winnerName(w, ctx.lang);
          banner = fr ? `${name} gagne la manche !` : `${name} wins the round!`;
          sfx.win();
        } else banner = fr ? 'Égalité !' : 'Draw!';
        speak(banner, ctx.lang);
        pause = 2.6;
        roundOver = true;
        if ((w && w.wins >= WIN_ROUNDS) || time > MAX_TIME) endDelay = 0;
      }
      if (time > MAX_TIME + 60 && endDelay < 0) {
        endDelay = 0;
        pause = 1;
      }
    },
    render(g, t) {
      drawSky(g, t, ctx.light, map.sky[0], map.sky[1]);
      g.save();
      if (shake) g.translate(rnd(-shake, shake), rnd(-shake, shake));
      // Vent : traits qui filent
      if (windOn > 0 && windOn < 3.2 && !ctx.light) {
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 6;
        for (let k = 0; k < 14; k++) {
          const x = (((t * 1400 * windDir + k * 271) % 2200) + 2200) % 2200 - 140;
          const y = 140 + ((k * 97) % 700);
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - windDir * 120, y);
          g.stroke();
        }
      }
      if (windOn >= 3.2) {
        // Alerte : grosses flèches dans le sens du vent
        g.font = '120px sans-serif';
        g.textAlign = 'center';
        g.globalAlpha = 0.5 + Math.sin(t * 12) * 0.3;
        g.fillText(windDir > 0 ? '➡️' : '⬅️', 960, 330);
        g.globalAlpha = 1;
      }
      // Mer de crème
      g.fillStyle = map.sea;
      g.beginPath();
      g.moveTo(0, 1080);
      for (let x = 0; x <= 1920; x += 40) g.lineTo(x, seaLevel() + Math.sin(x / 120 + t * 1.5) * 16);
      g.lineTo(1920, 1080);
      g.fill();
      g.strokeStyle = map.seaLine;
      g.lineWidth = 8;
      g.stroke();
      g.strokeStyle = INK;
      g.lineWidth = 4;
      g.stroke();
      // Plateformes (contour prune, ombre plate)
      for (const p of plats) {
        const wob = p.ay ? 0 : Math.sin(t * 2 + p.x) * 3;
        if (map.hazard === 'stools' && p.ay) {
          g.fillStyle = '#c9a6ff';
          g.fillRect(p.x + p.w / 2 - 16, p.y + 40, 32, SEA_Y - p.y);
          g.strokeRect(p.x + p.w / 2 - 16, p.y + 40, 32, SEA_Y - p.y);
        }
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(p.x, p.y + wob + 8, p.w, 46, 22);
        g.fill();
        g.fillStyle = map.plat;
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.roundRect(p.x, p.y + wob, p.w, 46, 22);
        g.fill();
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.beginPath();
        g.roundRect(p.x + 20, p.y + 8 + wob, p.w - 40, 8, 4);
        g.fill();
        if (map.hazard === 'bob' && p.ay) {
          // Fleur de nénuphar
          g.fillStyle = '#ff9ccf';
          g.beginPath();
          g.arc(p.x + p.w - 40, p.y + wob + 6, 14, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
      }
      // Gouttes de sirop : ombre d'alerte puis chute
      for (const d of drops) {
        const p = plats.find((q) => d.x > q.x && d.x < q.x + q.w);
        if (d.warn > 0 && p) {
          g.fillStyle = `rgba(160,100,58,${0.25 + Math.sin(t * 20) * 0.15})`;
          g.beginPath();
          g.ellipse(d.x, p.y + 4, 50, 12, 0, 0, Math.PI * 2);
          g.fill();
        } else if (d.warn <= 0) {
          g.fillStyle = '#c97a35';
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(d.x, d.y - 60);
          g.quadraticCurveTo(d.x + 32, d.y - 10, d.x, d.y);
          g.quadraticCurveTo(d.x - 32, d.y - 10, d.x, d.y - 60);
          g.fill();
          g.stroke();
        }
      }
      bs.forEach((b, i) => {
        if (!b.alive) return;
        // Bras en spaghetti
        const sx = b.x;
        const sy = b.y - 52;
        const reach = b.punchT > 0.1 ? 78 : b.holding >= 0 ? 52 : 26;
        for (const side of [-1, 1]) {
          const fx = sx + b.dir * reach + side * 6;
          const fy = sy + (b.holding >= 0 ? -10 : 10 + side * 6) + Math.sin(t * 8 + side + i) * 4;
          g.strokeStyle = INK;
          g.lineWidth = 14;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(sx + side * 14, sy);
          g.quadraticCurveTo(sx + b.dir * reach * 0.5, sy + 30, fx, fy);
          g.stroke();
          g.strokeStyle = b.profile.color;
          g.lineWidth = 8;
          g.stroke();
          g.fillStyle = '#fff';
          g.strokeStyle = INK;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(fx, fy, b.punchT > 0.1 && side > 0 ? 14 : 10, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.tilt * 0.6);
        g.scale(1 + Math.sin(t * 9 + i) * 0.04, 1 - Math.sin(t * 9 + i) * 0.04);
        drawCharacter(g, 0, 0, SIZE, {
          food: b.profile.food,
          color: b.profile.color,
          hat: b.profile.hat,
          acc: b.profile.acc,
          selfie: b.selfie,
          t: t + i,
          dir: b.dir,
          run: b.onGround ? Math.min(1, Math.abs(b.vx) / RUN) : 0.2,
          mood: b.ko > 0 ? 'sad' : b.heldBy >= 0 || b.flying > 0 ? 'wow' : b.holding >= 0 ? 'win' : 'happy',
        });
        g.restore();
        // Étoiles qui tournent quand on est sonné
        if (b.ko > 0 || b.dizzy > 2) {
          g.fillStyle = SOLEIL;
          g.strokeStyle = INK;
          g.lineWidth = 2;
          const n = b.ko > 0 ? 4 : 2;
          for (let k = 0; k < n; k++) {
            const a = t * 5 + (k * Math.PI * 2) / n;
            g.beginPath();
            g.arc(b.x + Math.cos(a) * 34, b.y - 124 + Math.sin(a) * 10, 8, 0, Math.PI * 2);
            g.fill();
            g.stroke();
          }
        }
        // Celui qu'on tient : il peut se débattre
        if (b.heldBy >= 0 && !b.bot) {
          g.font = '700 28px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.lineWidth = 6;
          g.strokeStyle = INK;
          g.strokeText(fr ? 'Martèle A/B !' : 'Mash A/B!', b.x, b.y - 170);
          g.fillStyle = '#fff';
          g.fillText(fr ? 'Martèle A/B !' : 'Mash A/B!', b.x, b.y - 170);
        }
        g.font = '700 28px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 6;
        g.strokeStyle = INK;
        g.strokeText(b.profile.name, b.x, b.y - 142);
        g.fillStyle = b.team !== undefined ? TEAMS[b.team].color : b.profile.color;
        g.fillText(b.profile.name, b.x, b.y - 142);
      });
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

      // Cartes des joueurs en haut
      const w = Math.min(230, 1800 / bs.length);
      const x0 = 960 - (w * bs.length) / 2;
      bs.forEach((b, i) => {
        const x = x0 + i * w;
        g.globalAlpha = b.alive ? 1 : 0.45;
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(x + 6, 22, w - 12, 96, 22);
        g.fill();
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.roundRect(x + 6, 14, w - 12, 96, 22);
        g.fill();
        g.stroke();
        drawCharacter(g, x + 46, 104, 60, {
          food: b.profile.food,
          color: b.profile.color,
          hat: b.profile.hat,
          acc: b.profile.acc,
          selfie: b.selfie,
          t,
          mood: !b.alive ? 'sad' : b.ko > 0 ? 'wow' : 'happy',
        });
        roundRectText(g, b.profile.name, x + 80, 44, w - 96, 22, b.team !== undefined ? TEAMS[b.team].color : b.profile.color);
        for (let k = 0; k < WIN_ROUNDS; k++) {
          g.fillStyle = k < b.wins ? SOLEIL : '#eee3f3';
          g.strokeStyle = INK;
          g.lineWidth = 3;
          g.beginPath();
          const cx = x + 100 + k * 34;
          for (let s = 0; s < 10; s++) {
            const r = s % 2 ? 6 : 14;
            g.lineTo(cx + Math.cos((s * Math.PI) / 5 - Math.PI / 2) * r, 86 + Math.sin((s * Math.PI) / 5 - Math.PI / 2) * r);
          }
          g.closePath();
          g.fill();
          g.stroke();
        }
        g.globalAlpha = 1;
      });
      if (banner) {
        g.font = '700 84px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 18;
        g.strokeStyle = INK;
        g.strokeText(banner, 960, 560);
        g.fillStyle = SOLEIL;
        g.fillText(banner, 960, 560);
      }
    },
    mapName: map.name,
    ranking() {
      return [...bs].sort((a, b) => b.wins - a.wins || Number(b.alive) - Number(a.alive) || b.out - a.out || b.kos - a.kos).map((b) => b.pid);
    },
    leader() {
      const w = bs.find((b) => b.wins >= WIN_ROUNDS);
      return w ? winnerName(w, ctx.lang) : null;
    },
  };
  startRound();
  return game;
}

export const brawl: GameBase = {
  id: 'bagarre',
  emoji: '🤼',
  name: { fr: 'Bagarre Molle', en: 'Wobbly Brawl' },
  how: {
    fr: 'B court = baffe · B maintenu = attraper puis jeter · A = saut · premier à 2 manches',
    en: 'Tap B = slap · Hold B = grab then throw · A = jump · first to 2 rounds',
  },
  inspired: 'Gang Beasts',
  layout: 'stick',
  min: 2,
  max: 8,
  botFill: 4,
  music: 'tumble',
  limit: 150,
  create,
};
