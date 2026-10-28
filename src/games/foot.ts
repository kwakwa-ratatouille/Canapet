// Coussin Foot : match vu de dessus. 2 équipes (2 buts) ou 4 équipes (4 buts, terrain carré), 1 à 3 ballons.
// Stick = courir · A = tirer (ou lancer le ballon qu'on tient) · B = sprint (envoie le ballon loin, vole le ballon du porteur)
// X = attraper le ballon (une passe d'un coéquipier, ou un ballon libre). Un tir sur un porteur lui fait lâcher le ballon.
import { dozing } from './botSkill';
import { drawCharacter } from '../shared/characters';
import { INK, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { candy, roundRectText } from './draw';
import { TEAMS } from './teams';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';

const R = 30;
const BALL_R = 22;
const RUN = 390;
const KICK = 1150;
const DASH_KICK = 1650;
const GOAL = 240;
const MAX_TIME = 180;
const HOLD_MAX = 4;
/** Rayon des coins arrondis du terrain (le ballon ne peut plus s’y coincer). */
const CORNER = 150;

/** Couleurs et noms des 4 équipes (les 2 premières = celles du mode équipes). */
const SQUADS = [
  { color: TEAMS[0].color, emoji: TEAMS[0].emoji, name: TEAMS[0].name },
  { color: TEAMS[1].color, emoji: TEAMS[1].emoji, name: TEAMS[1].name },
  { color: '#2ec5ff', emoji: '🫐', name: { fr: 'Équipe Myrtille', en: 'Team Blueberry' } },
  { color: '#ffd60a', emoji: '🍋', name: { fr: 'Équipe Citron', en: 'Team Lemon' } },
];

interface P extends Runner {
  side: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  fx: number;
  fy: number;
  inp: { x: number; y: number };
  kickReq: boolean;
  /** Tir chargé : A maintenu (secondes), relâcher pour frapper. */
  charge: number;
  charging: boolean;
  catchT: number;
  dash: number;
  dashCd: number;
  stun: number;
  goals: number;
  lastA: boolean;
  lastB: boolean;
  lastC: boolean;
  botT: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  holder: P | null;
  holdT: number;
  /** Dernier joueur à l'avoir touché (pour le but) et lanceur (pour les passes et les tirs sur porteur). */
  touch: P | null;
  thrower: P | null;
  throwT: number;
  /** Frappe de mule : ballon en feu, il traverse les joueurs. */
  fire: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Terrains tirés au hasard : couleurs, et ballon qui glisse plus ou moins. */
const PITCHES = [
  { name: { fr: 'La Pelouse', en: 'The Lawn' }, a: '#7bd13b', b: '#8fe04a', bg: '#ffe3f1', fric: 0.45 },
  { name: { fr: 'La Plage', en: 'The Beach' }, a: '#ffd98a', b: '#ffe3a8', bg: '#bfe9ff', fric: 0.3 },
  { name: { fr: 'La Patinoire', en: 'The Ice Rink' }, a: '#cdeeff', b: '#e3f6ff', bg: '#e9e3ff', fric: 0.75 },
  { name: { fr: 'Le Tapis du salon', en: 'The Living-room Rug' }, a: '#c9a8ff', b: '#d9c2ff', bg: '#fff1c9', fric: 0.5 },
];

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const pitch = PITCHES[Math.floor(Math.random() * PITCHES.length)];
  const fr = ctx.lang === 'fr';
  const nTeams = ctx.opts.teams === 4 ? 4 : 2;
  const nBalls = Math.max(1, Math.min(3, ctx.opts.balls ?? 1));
  // Terrain : large à 2 équipes, carré à 4
  const F = nTeams === 4 ? { x: 300, y: 95, w: 1340, h: 800 } : { x: 140, y: 170, w: 1640, h: 820 };
  const cx = F.x + F.w / 2;
  const cy = F.y + F.h / 2;
  /** But de chaque équipe : 0 gauche, 1 droite, 2 haut, 3 bas. */
  const goals = [
    { x: F.x, y: cy, horiz: false },
    { x: F.x + F.w, y: cy, horiz: false },
    { x: cx, y: F.y, horiz: true },
    { x: cx, y: F.y + F.h, horiz: true },
  ].slice(0, nTeams);

  const ps: P[] = runners.map((r, i) => ({
    ...r,
    side: nTeams === 2 && r.team !== undefined ? r.team : i % nTeams,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    dir: 1,
    fx: 1,
    fy: 0,
    inp: { x: 0, y: 0 },
    kickReq: false,
    charge: 0,
    charging: false,
    catchT: 0,
    dash: 0,
    dashCd: 0,
    stun: 0,
    goals: 0,
    lastA: false,
    lastB: false,
    lastC: false,
    botT: 0,
  }));
  if (nTeams === 2 && ps.length > 1 && ps.every((p) => p.side === ps[0].side)) ps.forEach((p, i) => (p.side = i % 2));
  const score = Array.from({ length: nTeams }, () => 0);
  const balls: Ball[] = Array.from({ length: nBalls }, () => ({ x: cx, y: cy, vx: 0, vy: 0, spin: 0, fire: 0, holder: null, holdT: 0, touch: null, thrower: null, throwT: 0 }));
  let time = 0;
  let pause = 2;
  let banner = fr ? 'Coup d’envoi !' : 'Kick-off!';
  let endDelay = -1;
  let shake = 0;
  const parts: { x: number; y: number; vx: number; vy: number; t: number; c: string }[] = [];
  const pops: { x: number; y: number; text: string; t: number }[] = [];

  /** Point de départ d'une équipe (devant son but). */
  const home = (side: number, k: number, n: number) => {
    const g = goals[side];
    const spread = (k - (n - 1) / 2) * 110;
    if (g.horiz) return { x: cx + spread, y: g.y + (g.y < cy ? 200 : -200) };
    return { x: g.x + (g.x < cx ? 220 : -220), y: cy + spread };
  };

  function kickoff() {
    balls.forEach((b, i) => {
      b.x = cx + (i - (nBalls - 1) / 2) * 120;
      b.y = cy;
      b.vx = b.vy = 0;
      b.holder = b.thrower = null;
    });
    for (let side = 0; side < nTeams; side++) {
      const team = ps.filter((p) => p.side === side);
      team.forEach((p, k) => {
        const h = home(side, k, team.length);
        p.x = h.x;
        p.y = h.y;
        p.vx = p.vy = 0;
        p.dir = p.x < cx ? 1 : -1;
      });
    }
    pause = 1.8;
  }
  kickoff();

  const pop = (x: number, y: number, text: string) => pops.push({ x, y, text, t: 1 });

  /** Coins arrondis : si l’objet dépasse l’arc, on le remet dedans et on le fait rebondir. */
  function corner(o: { x: number; y: number; vx: number; vy: number }, rad: number, bounce: number) {
    const ccx = o.x < F.x + CORNER ? F.x + CORNER : o.x > F.x + F.w - CORNER ? F.x + F.w - CORNER : null;
    const ccy = o.y < F.y + CORNER ? F.y + CORNER : o.y > F.y + F.h - CORNER ? F.y + F.h - CORNER : null;
    if (ccx === null || ccy === null) return;
    const dx = o.x - ccx;
    const dy = o.y - ccy;
    const d = Math.hypot(dx, dy);
    const lim = CORNER - rad;
    if (d <= lim) return;
    const nx = dx / d;
    const ny = dy / d;
    o.x = ccx + nx * lim;
    o.y = ccy + ny * lim;
    const vn = o.vx * nx + o.vy * ny;
    if (vn > 0) {
      o.vx -= (1 + bounce) * vn * nx;
      o.vy -= (1 + bounce) * vn * ny;
    }
  }

  function throwBall(p: P, b: Ball, power: number) {
    let kx = p.fx;
    let ky = p.fy;
    const l = Math.hypot(kx, ky) || 1;
    kx /= l;
    ky /= l;
    b.holder = null;
    b.x = p.x + kx * (R + BALL_R + 4);
    b.y = p.y + ky * (R + BALL_R + 4);
    b.vx = kx * power + p.vx * 0.3;
    b.vy = ky * power + p.vy * 0.3;
    b.touch = b.thrower = p;
    b.throwT = 0.8;
    sfx.boing();
    if (!p.bot) ctx.buzz(p.pid, 40);
  }

  function kick(p: P) {
    const c = Math.min(1, p.charge / 0.9);
    p.charge = 0;
    const held = balls.find((b) => b.holder === p);
    const b = held ?? balls.find((b) => !b.holder && Math.hypot(b.x - p.x, b.y - p.y) < R + BALL_R + 26);
    if (!b) return;
    throwBall(p, b, KICK * (held ? 1.05 : 1) * (1 + 0.65 * c));
    if (c >= 1) {
      b.fire = 1.2;
      shake = 10;
      pop(p.x, p.y - 130, fr ? 'FRAPPE DE MULE !' : 'THUNDER SHOT!');
      sfx.pop();
      if (!p.bot) ctx.buzz(p.pid, 120);
    }
  }

  function tryCatch(p: P) {
    if (balls.some((b) => b.holder === p)) return;
    const b = balls
      .filter((b) => !b.holder && Math.hypot(b.x - p.x, b.y - p.y) < R + BALL_R + 40)
      .sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y))[0];
    if (!b) return;
    b.holder = p;
    b.holdT = 0;
    b.touch = p;
    b.vx = b.vy = 0;
    if (b.thrower && b.thrower !== p && b.thrower.side === p.side) pop(p.x, p.y - 120, fr ? 'PASSE !' : 'PASS!');
    sfx.click();
  }

  function bot(p: P, dt: number) {
    p.botT -= dt;
    const held = balls.find((b) => b.holder === p);
    // Le but adverse le plus proche
    const target = goals
      .map((g, i) => ({ g, i }))
      .filter((x) => x.i !== p.side)
      .sort((a, b) => Math.hypot(a.g.x - p.x, a.g.y - p.y) - Math.hypot(b.g.x - p.x, b.g.y - p.y))[0].g;
    if (held) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const l = Math.hypot(dx, dy) || 1;
      p.inp = { x: dx / l, y: dy / l };
      p.fx = dx / l;
      p.fy = dy / l;
      if (l < 600 || held.holdT > 2.5) p.kickReq = true;
      return;
    }
    const mates = ps.filter((o) => o.side === p.side);
    const free = balls.filter((b) => b.holder?.side !== p.side);
    const near = free.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    const chaser = near && mates.sort((a, b) => Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y))[0];
    let tx: number;
    let ty: number;
    if (near && chaser === p) {
      tx = near.x;
      ty = near.y;
      const d = Math.hypot(near.x - p.x, near.y - p.y);
      if (near.holder && d < 140 && p.dashCd <= 0) {
        p.dash = 0.25;
        p.dashCd = 1.4;
      }
      if (!near.holder && d < R + BALL_R + 24 && p.botT <= 0) {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const l = Math.hypot(dx, dy) || 1;
        p.fx = dx / l;
        p.fy = dy / l;
        if (Math.random() < 0.3) tryCatch(p);
        else p.kickReq = true;
        p.botT = rnd(0.3, 0.8);
      }
    } else {
      const h = home(p.side, mates.indexOf(p), mates.length);
      tx = (h.x + cx) / 2;
      ty = (h.y + cy) / 2;
    }
    const dx = tx - p.x;
    const dy = ty - p.y;
    const l = Math.hypot(dx, dy);
    p.inp = l > 12 ? { x: dx / l, y: dy / l } : { x: 0, y: 0 };
  }

  function goal(b: Ball, side: number) {
    const t = b.touch;
    const scorer = t && t.side !== side ? t.side : -1;
    if (scorer >= 0) {
      score[scorer]++;
      t!.goals++;
      const tn = SQUADS[scorer].name[ctx.lang];
      banner = fr ? `BUUUT ! ${tn}` : `GOAL! ${tn}`;
      speak(fr ? `But de ${t!.profile.name} !` : `Goal by ${t!.profile.name}!`, ctx.lang);
    } else {
      // Contre son camp : un point pour chacune des autres équipes (ou pour l’autre s’il n’y en a qu’une)
      for (let k = 0; k < nTeams; k++) if (k !== side) score[k]++;
      banner = fr ? (nTeams > 2 ? 'Contre son camp ! +1 pour les autres 🙈' : 'Contre son camp ! 🙈') : nTeams > 2 ? 'Own goal! +1 for everyone else 🙈' : 'Own goal! 🙈';
      speak(fr ? 'Contre son camp !' : 'Own goal!', ctx.lang);
    }
    sfx.win();
    shake = 14;
    for (let k = 0; k < 40; k++)
      parts.push({ x: b.x, y: b.y, vx: rnd(-500, 500), vy: rnd(-700, -100), t: rnd(0.6, 1.2), c: SQUADS[k % nTeams].color });
    ps.forEach((p) => !p.bot && ctx.buzz(p.pid, p.side === scorer || (scorer < 0 && p.side !== side) ? 200 : 60));
    kickoff();
    pause = 2.4;
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const p = ps.find((x) => x.pid === pid);
      if (!p) return;
      // A : appui court = tir, maintenu = tir chargé au relâcher
      if (m.a && !p.lastA) {
        p.charging = true;
        p.charge = 0;
      }
      if (!m.a && p.lastA && p.charging) {
        p.charging = false;
        p.kickReq = true;
      }
      if (m.b && !p.lastB && p.dashCd <= 0) {
        p.dash = 0.25;
        p.dashCd = 1.3;
      }
      if (m.c && !p.lastC) p.catchT = 0.3;
      p.lastA = m.a;
      p.lastB = m.b;
      p.lastC = !!m.c;
      p.inp = { x: m.x, y: m.y };
    },
    update(dt) {
      time += dt;
      shake = Math.max(0, shake - dt * 40);
      for (const q of parts) {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vy += 600 * dt;
        q.t -= dt;
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t <= 0) parts.splice(i, 1);
      for (const q of pops) {
        q.t -= dt;
        q.y -= 60 * dt;
      }
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].t <= 0) pops.splice(i, 1);
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) {
          if (endDelay >= 0) game.over = true;
          banner = '';
        }
        return;
      }
      for (const p of ps) {
        if (p.bot) {
          if (dozing(p, ctx.botSkill, dt)) p.inp = { x: 0, y: 0 };
          else bot(p, dt);
        }
        p.dash = Math.max(0, p.dash - dt);
        p.dashCd = Math.max(0, p.dashCd - dt);
        p.stun = Math.max(0, p.stun - dt);
        if (p.catchT > 0) {
          p.catchT -= dt;
          tryCatch(p);
        }
        const mag = Math.min(1, Math.hypot(p.inp.x, p.inp.y));
        if (mag > 0.2) {
          p.fx = p.inp.x;
          p.fy = p.inp.y;
          if (Math.abs(p.inp.x) > 0.2) p.dir = p.inp.x > 0 ? 1 : -1;
        }
        const carrying = balls.some((b) => b.holder === p);
        const sp = p.stun > 0 ? 0 : RUN * (p.dash > 0 ? 2.1 : carrying ? 0.85 : 1);
        const tvx = mag > 0.2 ? (p.inp.x / Math.max(mag, 1)) * sp : 0;
        const tvy = mag > 0.2 ? (p.inp.y / Math.max(mag, 1)) * sp : 0;
        const k = Math.min(1, dt * 10);
        p.vx += (tvx - p.vx) * k;
        p.vy += (tvy - p.vy) * k;
        p.x = Math.max(F.x + R, Math.min(F.x + F.w - R, p.x + p.vx * dt));
        p.y = Math.max(F.y + R, Math.min(F.y + F.h - R, p.y + p.vy * dt));
        corner(p, R, 0);
        if (p.charging) p.charge += dt;
        // Le bot charge parfois une frappe de mule quand il est loin du but
        if (p.bot && p.kickReq && balls.some((b) => b.holder === p) && Math.random() < 0.35) p.charge = 1;
        if (p.stun > 0) p.charging = false;
        if (p.kickReq && p.stun <= 0) kick(p);
        p.kickReq = false;
      }
      // Contacts entre joueurs : bousculade, et sprint qui fait tomber / vole le ballon
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i];
          const b = ps[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < R * 2) {
            const o = (R * 2 - d) / 2;
            a.x -= (dx / d) * o;
            a.y -= (dy / d) * o;
            b.x += (dx / d) * o;
            b.y += (dy / d) * o;
            for (const [x, y, sgn] of [[a, b, 1], [b, a, -1]] as [P, P, number][])
              if (x.dash > 0 && x.side !== y.side && y.stun <= 0) {
                y.stun = 0.45;
                y.vx = (dx / d) * 500 * sgn;
                y.vy = (dy / d) * 500 * sgn;
                sfx.boing();
                shake = 6;
                const stolen = balls.find((bl) => bl.holder === y);
                if (stolen && !balls.some((bl) => bl.holder === x)) {
                  stolen.holder = x;
                  stolen.holdT = 0;
                  stolen.touch = x;
                  pop(x.x, x.y - 120, fr ? 'VOLÉ !' : 'STOLEN!');
                }
              }
          }
        }
      // Sprint : on chipe le ballon d un porteur adverse tout proche, quel que soit le côté
      for (const x of ps) {
        if (x.dash <= 0 || balls.some((bl) => bl.holder === x)) continue;
        for (const bl of balls) {
          const y = bl.holder;
          if (!y || y.side === x.side || Math.hypot(y.x - x.x, y.y - x.y) > R * 2 + 40) continue;
          bl.holder = x;
          bl.holdT = 0;
          bl.touch = x;
          // Le voleur garde son élan, la victime est poussée sur le côté (pas d’arrêt net des deux)
          const ax = y.x - x.x;
          const ay = y.y - x.y;
          const al = Math.hypot(ax, ay) || 1;
          const sx = -x.vy / (Math.hypot(x.vx, x.vy) || 1);
          const sy = x.vx / (Math.hypot(x.vx, x.vy) || 1);
          const side = ax * sx + ay * sy >= 0 ? 1 : -1;
          y.vx = (sx * side + ax / al) * 380;
          y.vy = (sy * side + ay / al) * 380;
          y.stun = 0.35;
          x.dash = Math.max(x.dash, 0.12);
          pop(x.x, x.y - 120, fr ? 'VOLÉ !' : 'STOLEN!');
          sfx.boing();
          break;
        }
      }
      // Ballons
      for (const b of balls) {
        if (b.holder) {
          const h = b.holder;
          b.holdT += dt;
          const fl = Math.hypot(h.fx, h.fy) || 1;
          b.x = h.x + (h.fx / fl) * (R + BALL_R - 4);
          b.y = h.y - 4 + (h.fy / fl) * 12;
          // On ne peut pas garder le ballon indéfiniment
          if (b.holdT > HOLD_MAX) throwBall(h, b, 500);
          continue;
        }
        b.throwT = Math.max(0, b.throwT - dt);
        b.fire = Math.max(0, b.fire - dt);
        if (b.fire > 0) parts.push({ x: b.x, y: b.y, vx: rnd(-80, 80), vy: rnd(-120, 0), t: 0.35, c: Math.random() < 0.5 ? '#ff8a00' : '#ffd60a' });
        const fast = Math.hypot(b.vx, b.vy) > 520;
        for (const p of ps) {
          const d = Math.hypot(b.x - p.x, b.y - p.y);
          if (d >= R + BALL_R) continue;
          // Tir sur un porteur adverse : il lâche son ballon
          const theirs = balls.find((o) => o.holder === p);
          if (fast && b.thrower && b.thrower !== p && b.thrower.side !== p.side && theirs) {
            theirs.holder = null;
            const bx = b.thrower.x - p.x;
            const by = b.thrower.y - p.y;
            const bl = Math.hypot(bx, by) || 1;
            theirs.vx = (bx / bl) * 900;
            theirs.vy = (by / bl) * 900;
            theirs.touch = b.thrower;
            theirs.thrower = null;
            theirs.throwT = 0.3;
            p.stun = 0.5;
            pop(p.x, p.y - 120, fr ? 'LÂCHÉ !' : 'DROPPED!');
          }
          if (b.fire > 0 && b.thrower !== p) {
            p.stun = 0.6;
            p.vx = b.vx * 0.5;
            p.vy = b.vy * 0.5;
            pop(p.x, p.y - 120, 'OUCH !');
            continue;
          }
          // Sprint dans le ballon : il part très loin
          if (p.dash > 0 && b.throwT <= 0) {
            p.fx = p.vx || p.fx;
            p.fy = p.vy || p.fy;
            throwBall(p, b, DASH_KICK);
            pop(b.x, b.y - 50, 'BAM !');
            continue;
          }
          const nx = (b.x - p.x) / (d || 1);
          const ny = (b.y - p.y) / (d || 1);
          b.x = p.x + nx * (R + BALL_R);
          b.y = p.y + ny * (R + BALL_R);
          b.vx += nx * 120 + p.vx * 0.15;
          b.vy += ny * 120 + p.vy * 0.15;
          b.touch = p;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const fric = Math.pow(pitch.fric, dt);
        b.vx *= fric;
        b.vy *= fric;
        b.spin += Math.hypot(b.vx, b.vy) * dt * 0.02;
        // Murs et buts
        let scored = -1;
        for (const [side, g] of goals.entries()) {
          if (!g.horiz) {
            const past = g.x === F.x ? b.x < F.x + BALL_R : b.x > F.x + F.w - BALL_R;
            if (!past) continue;
            if (Math.abs(b.y - cy) < GOAL / 2) {
              if (g.x === F.x ? b.x < F.x - BALL_R : b.x > F.x + F.w + BALL_R) scored = side;
            } else {
              b.x = g.x === F.x ? F.x + BALL_R : F.x + F.w - BALL_R;
              b.vx = -b.vx * 0.8;
            }
          } else {
            const past = g.y === F.y ? b.y < F.y + BALL_R : b.y > F.y + F.h - BALL_R;
            if (!past) continue;
            if (Math.abs(b.x - cx) < GOAL / 2) {
              if (g.y === F.y ? b.y < F.y - BALL_R : b.y > F.y + F.h + BALL_R) scored = side;
            } else {
              b.y = g.y === F.y ? F.y + BALL_R : F.y + F.h - BALL_R;
              b.vy = -b.vy * 0.8;
            }
          }
        }
        // À 2 équipes, le haut et le bas sont des murs
        if (nTeams === 2) {
          if (b.y < F.y + BALL_R) {
            b.y = F.y + BALL_R;
            b.vy = Math.abs(b.vy) * 0.8;
          }
          if (b.y > F.y + F.h - BALL_R) {
            b.y = F.y + F.h - BALL_R;
            b.vy = -Math.abs(b.vy) * 0.8;
          }
        }
        corner(b, BALL_R, 0.8);
        if (scored >= 0) {
          goal(b, scored);
          break;
        }
      }
      if (time > MAX_TIME && endDelay < 0) {
        endDelay = 0;
        const best = Math.max(...score);
        const winners = score.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
        banner = winners.length > 1 ? (fr ? 'Match nul !' : 'Draw!') : `${SQUADS[winners[0]].name[ctx.lang]} ${fr ? 'gagne !' : 'wins!'}`;
        pause = 3;
      }
    },
    render(g, t) {
      g.save();
      if (shake) g.translate(rnd(-shake, shake), rnd(-shake, shake));
      g.fillStyle = pitch.bg;
      g.fillRect(0, 0, 1920, 1080);
      g.save();
      g.beginPath();
      g.roundRect(F.x, F.y, F.w, F.h, CORNER);
      g.clip();
      for (let i = 0; i < 10; i++) {
        g.fillStyle = i % 2 ? pitch.a : pitch.b;
        g.fillRect(F.x + (i * F.w) / 10, F.y, F.w / 10 + 1, F.h);
      }
      g.restore();
      candy(g, F.x, F.y, F.w, F.h, 30);
      g.strokeStyle = '#fff';
      g.lineWidth = 8;
      g.beginPath();
      g.roundRect(F.x + 10, F.y + 10, F.w - 20, F.h - 20, CORNER - 10);
      g.stroke();
      g.beginPath();
      if (nTeams === 2) {
        g.moveTo(cx, F.y + 10);
        g.lineTo(cx, F.y + F.h - 10);
      } else {
        g.moveTo(F.x + 10, F.y + 10);
        g.lineTo(F.x + F.w - 10, F.y + F.h - 10);
        g.moveTo(F.x + F.w - 10, F.y + 10);
        g.lineTo(F.x + 10, F.y + F.h - 10);
      }
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, 120, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(F.x, F.y, F.w, F.h, CORNER);
      g.stroke();
      // Buts aux couleurs des équipes
      goals.forEach((gl, side) => {
        const [x, y, w, h] = gl.horiz
          ? [cx - GOAL / 2, gl.y === F.y ? F.y - 70 : F.y + F.h, GOAL, 70]
          : [gl.x === F.x ? F.x - 70 : F.x + F.w, cy - GOAL / 2, 70, GOAL];
        g.fillStyle = SQUADS[side].color;
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(x, y, w, h, 14);
        g.fill();
        candy(g, x, y, w, h, 14);
        g.beginPath();
        g.roundRect(x, y, w, h, 14);
        g.stroke();
      });
      const order = [...ps].sort((a, b) => a.y - b.y);
      for (const p of order) {
        g.fillStyle = SQUADS[p.side].color;
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.ellipse(p.x, p.y + 4, 34, 11, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        if (p.dash > 0) {
          g.fillStyle = 'rgba(255,255,255,0.6)';
          g.beginPath();
          g.arc(p.x - p.vx * 0.06, p.y - 30 - p.vy * 0.06, 30, 0, Math.PI * 2);
          g.fill();
        }
        if (p.charging && p.charge > 0.12) {
          const c = Math.min(1, p.charge / 0.9);
          g.strokeStyle = c >= 1 ? (Math.floor(t * 12) % 2 ? '#ffd60a' : '#ff8a00') : '#fff';
          g.lineWidth = 8;
          g.beginPath();
          g.arc(p.x, p.y - 40, 62, -Math.PI / 2, -Math.PI / 2 + c * Math.PI * 2);
          g.stroke();
        }
        drawCharacter(g, p.x, p.y, 84, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + p.x * 0.001,
          dir: p.dir,
          run: Math.min(1, Math.hypot(p.vx, p.vy) / RUN),
          mood: p.stun > 0 ? 'wow' : balls.some((b) => b.holder === p) ? 'win' : 'happy',
        });
        g.font = '700 28px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 6;
        g.strokeStyle = INK;
        g.strokeText(p.profile.name, p.x, p.y - 104);
        g.fillStyle = SQUADS[p.side].color;
        g.fillText(p.profile.name, p.x, p.y - 104);
      }
      for (const b of balls) {
        g.fillStyle = 'rgba(58,33,64,0.2)';
        g.beginPath();
        g.ellipse(b.x, (b.holder ? b.holder.y : b.y) + BALL_R, BALL_R, 7, 0, 0, Math.PI * 2);
        g.fill();
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.spin);
        g.fillStyle = b.fire > 0 ? '#ffd60a' : '#fff';
        g.strokeStyle = b.fire > 0 ? '#ff4b1f' : b.holder ? SQUADS[b.holder.side].color : INK;
        g.lineWidth = b.holder ? 7 : 4;
        g.beginPath();
        g.arc(0, 0, BALL_R, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = '#ff4f9a';
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.arc(Math.cos((k * Math.PI * 2) / 5) * 11, Math.sin((k * Math.PI * 2) / 5) * 11, 5, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
      for (const q of parts) {
        g.globalAlpha = Math.min(1, q.t * 2);
        g.fillStyle = q.c;
        g.fillRect(q.x - 6, q.y - 4, 12, 8);
      }
      g.globalAlpha = 1;
      for (const q of pops) {
        g.globalAlpha = Math.min(1, q.t * 2);
        g.font = '700 44px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 9;
        g.strokeStyle = INK;
        g.strokeText(q.text, q.x, q.y);
        g.fillStyle = SOLEIL;
        g.fillText(q.text, q.x, q.y);
      }
      g.globalAlpha = 1;
      g.restore();
      // Scores
      const sw = nTeams === 2 ? 250 : 180;
      const sx = nTeams === 2 ? 710 : 40;
      score.forEach((s, side) => {
        const x = nTeams === 2 ? sx + side * (sw + 10) : sx;
        const y = nTeams === 2 ? 76 : 160 + side * 90;
        roundRectText(g, `${SQUADS[side].emoji} ${s}`, x, y, sw - 10, 40, SQUADS[side].color);
      });
      if (banner) {
        g.font = '700 100px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineJoin = 'round';
        g.lineWidth = 24;
        g.strokeStyle = INK;
        g.strokeText(banner, 960, 600);
        g.fillStyle = SOLEIL;
        g.fillText(banner, 960, 600);
      }
    },
    ranking() {
      return [...ps].sort((a, b) => score[b.side] - score[a.side] || b.goals - a.goals).map((p) => p.pid);
    },
    leader() {
      return null;
    },
    mapName: pitch.name,
  };
  return game;
}

export const foot: GameBase = {
  id: 'foot',
  emoji: '⚽',
  name: { fr: 'Coussin Foot', en: 'Cushion Soccer' },
  how: {
    fr: 'Stick : courir · A : tirer · B : sprint (vole le ballon, l’envoie loin) · X : attraper une passe',
    en: 'Stick: run · A: shoot · B: sprint (steals the ball, sends it far) · X: catch a pass',
  },
  inspired: 'Foot en salle',
  layout: 'stick',
  min: 2,
  max: 12,
  botFill: 4,
  music: 'race',
  limit: 150,
  options: [
    {
      id: 'teams',
      label: { fr: 'Terrain', en: 'Pitch' },
      choices: [
        { v: 2, label: { fr: '2 équipes', en: '2 teams' } },
        { v: 4, label: { fr: '4 équipes, 4 buts', en: '4 teams, 4 goals' } },
      ],
    },
    {
      id: 'balls',
      label: { fr: 'Ballons', en: 'Balls' },
      choices: [
        { v: 1, label: { fr: '1 ballon', en: '1 ball' } },
        { v: 2, label: { fr: '2 ballons', en: '2 balls' } },
        { v: 3, label: { fr: '3 ballons', en: '3 balls' } },
      ],
    },
  ],
  create,
};
