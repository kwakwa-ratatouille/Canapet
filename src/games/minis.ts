// Mini-jeux de fête, courts et nerveux (inspirés des grands classiques des jeux de soirée, tout est original) :
// Chaises musicales, Patate chaude, Pluie de bonbons, Le sol est de la lave. Vue de dessus, stick pour bouger.
import { dozing } from './botSkill';
import { drawCharacter } from '../shared/characters';
import { INK, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { candy, roundRectText } from './draw';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

// Aire de jeu commune (repère télé 1920 × 1080)
const AX = 220;
const AY = 220;
const AW = 1480;
const AH = 800;
const BODY = 34;

interface P extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  inp: { x: number; y: number };
  a: boolean;
  b: boolean;
  lastA: boolean;
  lastB: boolean;
  alive: boolean;
  out: number;
  dir: 1 | -1;
  stun: number;
  score: number;
  cd: number;
  /** Petit saut (lave) : temps restant. */
  hop: number;
  botT: number;
  tx: number;
  ty: number;
  pop: { text: string; t: number; c: string } | null;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function makePlayers(runners: Runner[]): P[] {
  const n = runners.length;
  return runners.slice(0, 8).map((r, i) => {
    const a = (i / n) * Math.PI * 2;
    return {
      ...r,
      x: 960 + Math.cos(a) * 320,
      y: 620 + Math.sin(a) * 240,
      vx: 0,
      vy: 0,
      inp: { x: 0, y: 0 },
      a: false,
      b: false,
      lastA: false,
      lastB: false,
      alive: true,
      out: 0,
      dir: 1,
      stun: 0,
      score: 0,
      cd: 0,
      hop: 0,
      botT: 0,
      tx: 960,
      ty: 620,
      pop: null,
    };
  });
}

/** Déplacement de dessus : accélération vers la direction du stick, rebond sur les bords, chocs entre joueurs. */
function step(ps: P[], dt: number, speed: (p: P) => number) {
  for (const p of ps) {
    if (!p.alive) continue;
    p.cd = Math.max(0, p.cd - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.hop = Math.max(0, p.hop - dt);
    if (p.pop && (p.pop.t -= dt) <= 0) p.pop = null;
    let ix = p.stun > 0 ? 0 : p.inp.x;
    let iy = p.stun > 0 ? 0 : p.inp.y;
    const m = Math.hypot(ix, iy);
    if (m > 1) {
      ix /= m;
      iy /= m;
    }
    if (m < 0.2) ix = iy = 0;
    const v = speed(p);
    const k = Math.min(1, dt * 9);
    p.vx += (ix * v - p.vx) * k;
    p.vy += (iy * v - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (Math.abs(p.vx) > 20) p.dir = p.vx > 0 ? 1 : -1;
    p.x = Math.max(AX + BODY, Math.min(AX + AW - BODY, p.x));
    p.y = Math.max(AY + BODY, Math.min(AY + AH - 8, p.y));
  }
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i];
      const b = ps[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x;
      const dy = (b.y - a.y) * 1.4;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < BODY * 2) {
        const o = (BODY * 2 - d) / 2;
        a.x -= (dx / d) * o;
        a.y -= (dy / d) * o * 0.7;
        b.x += (dx / d) * o;
        b.y += (dy / d) * o * 0.7;
      }
    }
}

/** Poussée (B) : envoie valser les voisins, recharge 1,2 s. */
function shove(ps: P[], p: P, ctx: GameCtx) {
  if (p.cd > 0 || p.stun > 0) return;
  p.cd = 1.2;
  if (!p.bot) ctx.cool(p.pid, 'b', 1.2);
  sfx.whoosh();
  for (const o of ps) {
    if (o === p || !o.alive) continue;
    const dx = o.x - p.x;
    const dy = o.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 120 && d > 0) {
      o.vx += (dx / d) * 900;
      o.vy += (dy / d) * 900;
      o.stun = 0.35;
      o.pop = { text: 'POUF !', t: 0.6, c: '#fff' };
      if (!o.bot) ctx.buzz(o.pid, 120);
    }
  }
}

function readInput(ps: P[], pid: string, m: { t: string; x?: number; y?: number; a?: boolean; b?: boolean }) {
  if (m.t !== 'in') return null;
  const p = ps.find((x) => x.pid === pid);
  if (!p) return null;
  p.inp = { x: m.x ?? 0, y: m.y ?? 0 };
  p.a = !!m.a;
  p.b = !!m.b;
  return p;
}

function drawFloor(g: CanvasRenderingContext2D, c1: string, c2: string, bg: string) {
  g.fillStyle = bg;
  g.fillRect(0, 0, 1920, 1080);
  g.fillStyle = INK;
  g.beginPath();
  g.roundRect(AX - 14, AY - 14 + 10, AW + 28, AH + 28, 40);
  g.fill();
  g.fillStyle = c1;
  g.beginPath();
  g.roundRect(AX - 14, AY - 14, AW + 28, AH + 28, 40);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.stroke();
  g.fillStyle = c2;
  for (let y = 0; y < AH; y += 100) for (let x = (y / 100) % 2 ? 100 : 0; x < AW; x += 200) g.fillRect(AX + x, AY + y, 100, 100);
}

function drawP(g: CanvasRenderingContext2D, p: P, t: number, i: number, extra: { lift?: number; size?: number; mood?: 'happy' | 'wow' | 'sad' | 'win' } = {}) {
  if (!p.alive) return;
  drawCharacter(g, p.x, p.y - (extra.lift ?? 0), extra.size ?? 96, {
    food: p.profile.food,
    color: p.profile.color,
    hat: p.profile.hat,
    acc: p.profile.acc,
    eyes: p.profile.eyes,
    pose: p.profile.pose,
    selfie: p.selfie,
    t: t + i,
    dir: p.dir,
    run: Math.min(1, Math.hypot(p.vx, p.vy) / 300),
    mood: extra.mood ?? (p.stun > 0 ? 'wow' : 'happy'),
  });
  if (p.pop) {
    g.font = '700 34px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 7;
    g.strokeStyle = INK;
    const y = p.y - 120 - (0.8 - p.pop.t) * 40;
    g.strokeText(p.pop.text, p.x, y);
    g.fillStyle = p.pop.c;
    g.fillText(p.pop.text, p.x, y);
  }
}

/** Bandeau du haut : les joueurs (barrés s'ils sont éliminés) avec leur score éventuel. */
function hud(g: CanvasRenderingContext2D, ps: P[], score: boolean) {
  const w = Math.min(220, 1840 / ps.length);
  ps.forEach((p, i) => {
    g.globalAlpha = p.alive ? 1 : 0.35;
    roundRectText(g, p.profile.name, 40 + i * w, 30, w - 10, 28, p.profile.color);
    if (score) {
      g.font = '700 30px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = INK;
      g.fillText(`🍬 ${p.score}`, 40 + i * w + (w - 10) / 2, 92);
    }
    g.globalAlpha = 1;
  });
}

function bigText(g: CanvasRenderingContext2D, text: string, color: string, k = 1, y = 560) {
  g.save();
  g.translate(960, y);
  g.scale(k, k);
  g.font = '700 120px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.lineJoin = 'round';
  g.lineWidth = 18;
  g.strokeStyle = INK;
  g.strokeText(text, 0, 40);
  g.fillStyle = color;
  g.fillText(text, 0, 40);
  g.restore();
}

/** Classement des jeux « dernier debout » : vivants d'abord, puis ceux éliminés le plus tard. */
const byOut = (ps: P[]) => [...ps].sort((a, b) => Number(b.alive) - Number(a.alive) || b.out - a.out).map((p) => p.pid);
const byScore = (ps: P[]) => [...ps].sort((a, b) => b.score - a.score).map((p) => p.pid);

/** Bot : va vers (tx, ty), en hésitant selon son niveau. */
function botGo(p: P, ctx: GameCtx, dt: number) {
  if (dozing(p, ctx.botSkill, dt)) {
    p.inp = { x: 0, y: 0 };
    return;
  }
  const dx = p.tx - p.x;
  const dy = p.ty - p.y;
  const d = Math.hypot(dx, dy);
  p.inp = d < 12 ? { x: 0, y: 0 } : { x: dx / d, y: dy / d };
}

// ————————————————————————————————————————— Chaises musicales —————————————————————————————————————————

function chairs(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const ps = makePlayers(runners);
  let phase: 'music' | 'rush' | 'result' = 'music';
  let timer = rnd(4, 8);
  let outCount = 0;
  let seats: { x: number; y: number; by: number; t: number }[] = [];
  let loser = -1;
  let flash = 0;
  const alive = () => ps.filter((p) => p.alive);

  function stopMusic() {
    phase = 'rush';
    timer = 7;
    flash = 1;
    const n = alive().length - 1;
    // Les coussins jaillissent du sol, n'importe où : impossible de camper
    seats = [];
    for (let k = 0; k < 300 && seats.length < n; k++) {
      const x = rnd(AX + 120, AX + AW - 120);
      const y = rnd(AY + 120, AY + AH - 60);
      if (seats.every((s) => Math.hypot(s.x - x, s.y - y) > 220)) seats.push({ x, y, by: -1, t: 0 });
    }
    sfx.boom();
    speak(fr ? 'Stop ! Assis !' : 'Stop! Sit down!', ctx.lang);
    // Les bots réagissent plus ou moins vite
    ps.forEach((p) => (p.botT = rnd(0.15, 0.7) * (1.4 - ctx.botSkill)));
  }

  function endRush() {
    phase = 'result';
    timer = 2.6;
    const l = ps.findIndex((p) => p.alive && !seats.some((s) => s.by === ps.indexOf(p)));
    loser = l;
    if (l >= 0) {
      ps[l].alive = false;
      ps[l].out = ++outCount;
      sfx.pet();
      speak(fr ? `${ps[l].profile.name} est debout : éliminé !` : `${ps[l].profile.name} is left standing: out!`, ctx.lang);
      if (!ps[l].bot) ctx.buzz(ps[l].pid, 500);
    }
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      const p = readInput(ps, pid, m as never);
      if (p && p.b && !p.lastB) shove(ps, p, ctx);
      if (p) p.lastB = p.b;
    },
    update(dt) {
      timer -= dt;
      flash = Math.max(0, flash - dt);
      for (const p of ps) {
        if (!p.bot || !p.alive) continue;
        if (phase === 'music') {
          // Promenade en rond
          const a = Date.now() / 1400 + ps.indexOf(p);
          p.tx = 960 + Math.cos(a) * 420;
          p.ty = 620 + Math.sin(a) * 260;
        } else if (phase === 'rush') {
          if ((p.botT -= dt) > 0) {
            p.inp = { x: 0, y: 0 };
            continue;
          }
          const free = seats.filter((s) => s.by < 0).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
          if (free) {
            p.tx = free.x;
            p.ty = free.y;
          }
          const near = ps.find((o) => o !== p && o.alive && Math.hypot(o.x - p.x, o.y - p.y) < 90);
          if (near && Math.random() < 0.03) shove(ps, p, ctx);
        }
        botGo(p, ctx, dt);
      }
      // Assis = immobile sur son coussin
      step(ps, dt, (p) => (seats.some((s) => s.by === ps.indexOf(p)) ? 0 : 430));
      if (phase === 'rush') {
        for (const s of seats) {
          if (s.by >= 0) {
            const o = ps[s.by];
            o.x = s.x;
            o.y = s.y + 6;
            continue;
          }
          const p = ps.find((q, i) => q.alive && q.stun <= 0 && !seats.some((x) => x.by === i) && Math.hypot(q.x - s.x, (q.y - s.y) * 1.3) < 56);
          if (p) {
            s.by = ps.indexOf(p);
            s.t = 0;
            sfx.pop();
            p.pop = { text: fr ? 'ASSIS !' : 'SEATED!', t: 0.8, c: SOLEIL };
          }
        }
        if (seats.every((s) => s.by >= 0) || timer <= 0) endRush();
      } else if (phase === 'music' && timer <= 0) stopMusic();
      else if (phase === 'result' && timer <= 0) {
        if (alive().length <= 1) game.over = true;
        else {
          phase = 'music';
          timer = rnd(4, 9);
          seats = [];
          loser = -1;
          sfx.go();
        }
      }
    },
    render(g, t) {
      drawFloor(g, '#ffe1ef', '#ffd0e6', phase === 'music' && !ctx.light && Math.floor(t * 2) % 2 ? '#fff1c9' : '#ffe9b8');
      // Notes qui dansent pendant la musique
      if (phase === 'music') {
        g.font = '60px sans-serif';
        g.textAlign = 'center';
        for (let k = 0; k < 6; k++) g.fillText(k % 2 ? '♪' : '♫', 300 + k * 270, 190 + Math.sin(t * 4 + k) * 14);
      }
      for (const s of seats) {
        g.fillStyle = INK;
        g.beginPath();
        g.ellipse(s.x, s.y + 6, 62, 30, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = s.by >= 0 ? ps[s.by].profile.color : ROSE;
        g.beginPath();
        g.ellipse(s.x, s.y, 58, 28, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.stroke();
      }
      const order = ps.map((_, i) => i).sort((a, b) => ps[a].y - ps[b].y);
      for (const i of order) drawP(g, ps[i], t, i, { mood: i === loser ? 'sad' : undefined });
      hud(g, ps, false);
      if (phase === 'music') bigText(g, fr ? '🎵 Promène-toi…' : '🎵 Walk around…', '#fff', 0.55, 130);
      if (phase === 'rush' && flash > 0) bigText(g, 'STOP !', ROSE, 1 + flash * 0.4);
      if (phase === 'rush') bigText(g, fr ? `Assieds-toi ! ${seats.filter((s) => s.by < 0).length} coussin(s) libre(s)` : `Sit down! ${seats.filter((s) => s.by < 0).length} free`, SOLEIL, 0.5, 130);
      if (phase === 'result' && loser >= 0) bigText(g, fr ? `${ps[loser].profile.name} éliminé !` : `${ps[loser].profile.name} is out!`, '#fff', 0.7);
    },
    out: (pid) => !!ps.find((p) => p.pid === pid && !p.alive),
    ranking: () => byOut(ps),
    leader() {
      const a = alive();
      return a.length === 1 ? a[0].profile.name : null;
    },
  };
  return game;
}

// ————————————————————————————————————————— Patate chaude —————————————————————————————————————————

function potato(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const ps = makePlayers(runners);
  let holder = Math.floor(Math.random() * ps.length);
  let fuse = rnd(9, 15);
  let fuseMax = fuse;
  let immune = -1;
  let immuneT = 0;
  let outCount = 0;
  let pause = 0;
  let boomAt: { x: number; y: number; t: number } | null = null;
  const alive = () => ps.filter((p) => p.alive);

  function newRound() {
    const a = alive();
    holder = ps.indexOf(a[Math.floor(Math.random() * a.length)]);
    fuse = fuseMax = rnd(8, 14);
    immune = -1;
    speak(fr ? `${ps[holder].profile.name} a la patate !` : `${ps[holder].profile.name} has the potato!`, ctx.lang);
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      const p = readInput(ps, pid, m as never);
      if (p && p.b && !p.lastB) shove(ps, p, ctx);
      if (p) p.lastB = p.b;
    },
    update(dt) {
      if (boomAt) boomAt.t -= dt;
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) {
          if (alive().length <= 1) game.over = true;
          else newRound();
        }
        return;
      }
      fuse -= dt;
      immuneT -= dt;
      const h = ps[holder];
      for (const p of ps) {
        if (!p.bot || !p.alive) continue;
        if (p === h) {
          // Le porteur fonce sur le plus proche
          const target = ps.filter((o) => o.alive && o !== p && ps.indexOf(o) !== immune).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
          if (target) {
            p.tx = target.x;
            p.ty = target.y;
          }
        } else {
          // Les autres fuient
          const dx = p.x - h.x;
          const dy = p.y - h.y;
          const d = Math.hypot(dx, dy) || 1;
          p.tx = Math.max(AX + 60, Math.min(AX + AW - 60, p.x + (dx / d) * 300 + (p.x < 400 || p.x > 1500 ? (960 - p.x) * 0.5 : 0)));
          p.ty = Math.max(AY + 60, Math.min(AY + AH - 60, p.y + (dy / d) * 300 + (p.y < 300 || p.y > 940 ? (620 - p.y) * 0.5 : 0)));
          if (d < 110 && Math.random() < 0.04) shove(ps, p, ctx);
        }
        botGo(p, ctx, dt);
      }
      step(ps, dt, (p) => (p === h ? 470 : 420));
      // Passe : on touche quelqu'un (pas celui qui vient de nous la donner, pendant 0,6 s)
      for (const o of ps) {
        if (o === h || !o.alive || (ps.indexOf(o) === immune && immuneT > 0)) continue;
        if (Math.hypot(o.x - h.x, (o.y - h.y) * 1.3) < BODY * 2 + 6) {
          immune = holder;
          immuneT = 0.6;
          holder = ps.indexOf(o);
          o.pop = { text: fr ? 'À TOI !' : 'TAG!', t: 0.7, c: '#ff8a3d' };
          sfx.boing();
          if (!o.bot) ctx.buzz(o.pid, 150);
          break;
        }
      }
      if (fuse <= 0) {
        const p = ps[holder];
        p.alive = false;
        p.out = ++outCount;
        boomAt = { x: p.x, y: p.y, t: 1 };
        sfx.boom();
        if (!p.bot) ctx.buzz(p.pid, 600);
        speak(ctx.family ? (fr ? 'Pouf !' : 'Poof!') : fr ? 'Boum !' : 'Boom!', ctx.lang);
        pause = 2.2;
      }
    },
    render(g, t) {
      drawFloor(g, '#fff1c9', '#ffe6a6', '#ffd6a0');
      const order = ps.map((_, i) => i).sort((a, b) => ps[a].y - ps[b].y);
      for (const i of order) {
        const p = ps[i];
        drawP(g, p, t, i, { mood: i === holder && p.alive ? 'wow' : undefined });
        if (i === holder && p.alive && pause <= 0) {
          // La patate qui fume, de plus en plus rouge et qui tremble
          const heat = 1 - fuse / fuseMax;
          const sh = heat * 6;
          const px = p.x + rnd(-sh, sh);
          const py = p.y - 140 + rnd(-sh, sh);
          g.fillStyle = heat > 0.7 && Math.floor(t * 12) % 2 ? '#ff3b3b' : '#c98a3a';
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.beginPath();
          g.ellipse(px, py, 34, 26, 0.3, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.7)';
          for (let k = 0; k < 3; k++) {
            const q = (t * 1.5 + k / 3) % 1;
            g.globalAlpha = 1 - q;
            g.beginPath();
            g.arc(px - 10 + k * 10, py - 30 - q * 50, 8 + q * 8, 0, Math.PI * 2);
            g.fill();
          }
          g.globalAlpha = 1;
        }
      }
      if (boomAt && boomAt.t > 0) {
        g.fillStyle = `rgba(255,140,40,${boomAt.t})`;
        g.beginPath();
        g.arc(boomAt.x, boomAt.y - 60, 80 + (1 - boomAt.t) * 160, 0, Math.PI * 2);
        g.fill();
        bigText(g, ctx.family ? 'POUF !' : 'BOUM !', '#ff8a3d', 1 + boomAt.t * 0.3, 300);
      }
      hud(g, ps, false);
      if (pause <= 0) bigText(g, fr ? `🥔 ${ps[holder].profile.name} a la patate ! Touche quelqu'un !` : `🥔 ${ps[holder].profile.name} has it! Tag someone!`, SOLEIL, 0.45, 130);
    },
    out: (pid) => !!ps.find((p) => p.pid === pid && !p.alive),
    ranking: () => byOut(ps),
    leader() {
      const a = alive();
      return a.length === 1 ? a[0].profile.name : null;
    },
  };
  newRound();
  return game;
}

// ————————————————————————————————————————— Pluie de bonbons —————————————————————————————————————————

function candyRain(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const ps = makePlayers(runners);
  type Drop = { x: number; y: number; t: number; max: number; kind: 'bonbon' | 'or' | 'enclume' };
  let drops: Drop[] = [];
  const ground: { x: number; y: number; kind: 'bonbon' | 'or'; life: number }[] = [];
  let spawn = 0;
  let time = 0;
  const COLORS = ['#ff4f9a', '#2ec5ff', '#ffd60a', '#1fc9a0', '#9b5cff'];

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      const p = readInput(ps, pid, m as never);
      if (p && p.b && !p.lastB) shove(ps, p, ctx);
      if (p) p.lastB = p.b;
    },
    update(dt) {
      time += dt;
      spawn -= dt;
      // Ça tombe de plus en plus, avec de plus en plus d'enclumes
      if (spawn <= 0) {
        spawn = Math.max(0.12, 0.45 - time * 0.006);
        const r = Math.random();
        const anvil = r < 0.18 + time * 0.004;
        drops.push({ x: rnd(AX + 40, AX + AW - 40), y: rnd(AY + 60, AY + AH - 30), t: anvil ? 1.3 : 1, max: anvil ? 1.3 : 1, kind: anvil ? 'enclume' : r > 0.93 ? 'or' : 'bonbon' });
      }
      for (const d of drops) {
        d.t -= dt;
        if (d.t > 0) continue;
        if (d.kind === 'enclume') {
          sfx.step();
          for (const p of ps)
            if (p.alive && p.stun <= 0 && Math.hypot(p.x - d.x, (p.y - d.y) * 1.3) < 70) {
              p.stun = 1.6;
              const lost = Math.min(3, p.score);
              p.score -= lost;
              for (let k = 0; k < lost; k++) ground.push({ x: p.x + rnd(-90, 90), y: p.y + rnd(-60, 60), kind: 'bonbon', life: 6 });
              p.pop = { text: fr ? `BONK ! -${lost}` : `BONK! -${lost}`, t: 0.9, c: '#ff3b3b' };
              sfx.boing();
              if (!p.bot) ctx.buzz(p.pid, 300);
            }
        } else ground.push({ x: d.x, y: d.y, kind: d.kind, life: 7 });
      }
      drops = drops.filter((d) => d.t > 0);
      for (const c of ground) c.life -= dt;
      // Bots : le bonbon le plus proche, en évitant les ombres d'enclume
      for (const p of ps) {
        if (!p.bot) continue;
        const danger = drops.find((d) => d.kind === 'enclume' && d.t < 0.8 && Math.hypot(p.x - d.x, p.y - d.y) < 110);
        if (danger) {
          p.tx = p.x + (p.x - danger.x) * 2;
          p.ty = p.y + (p.y - danger.y) * 2;
        } else {
          const best = ground.filter((c) => c.life > 0).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - (a.kind === 'or' ? 200 : 0) - (Math.hypot(b.x - p.x, b.y - p.y) - (b.kind === 'or' ? 200 : 0)))[0];
          if (best) {
            p.tx = best.x;
            p.ty = best.y;
          }
        }
        botGo(p, ctx, dt);
      }
      step(ps, dt, () => 440);
      for (const c of ground) {
        if (c.life <= 0) continue;
        const p = ps.find((q) => q.stun <= 0 && Math.hypot(q.x - c.x, (q.y - c.y) * 1.3) < 52);
        if (p) {
          c.life = 0;
          const v = c.kind === 'or' ? 5 : 1;
          p.score += v;
          if (v > 1) p.pop = { text: '+5 ⭐', t: 0.8, c: SOLEIL };
          sfx.pop();
        }
      }
      for (let k = ground.length - 1; k >= 0; k--) if (ground[k].life <= 0) ground.splice(k, 1);
    },
    render(g, t) {
      drawFloor(g, '#e3f7ff', '#cfeeff', '#bfe6ff');
      // Ombres de ce qui va tomber
      for (const d of drops) {
        const k = 1 - d.t / d.max;
        g.fillStyle = d.kind === 'enclume' ? `rgba(255,59,59,${0.25 + k * 0.4})` : 'rgba(58,33,64,0.18)';
        g.beginPath();
        g.ellipse(d.x, d.y, (d.kind === 'enclume' ? 70 : 26) * (0.4 + k * 0.6), (d.kind === 'enclume' ? 34 : 13) * (0.4 + k * 0.6), 0, 0, Math.PI * 2);
        g.fill();
        // L'objet qui tombe
        const fy = d.y - d.t * 700;
        if (d.kind === 'enclume') {
          g.fillStyle = '#6b6b7b';
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.beginPath();
          g.roundRect(d.x - 40, fy - 50, 80, 50, 8);
          g.fill();
          g.stroke();
          g.fillStyle = '#fff';
          g.font = '700 28px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.fillText('10T', d.x, fy - 15);
        } else {
          g.font = d.kind === 'or' ? '46px sans-serif' : '38px sans-serif';
          g.textAlign = 'center';
          g.fillText(d.kind === 'or' ? '⭐' : '🍬', d.x, fy);
        }
      }
      for (const c of ground) {
        g.globalAlpha = Math.min(1, c.life);
        g.font = c.kind === 'or' ? '50px sans-serif' : '40px sans-serif';
        g.textAlign = 'center';
        g.fillText(c.kind === 'or' ? '⭐' : '🍬', c.x, c.y + 12 + Math.sin(t * 4 + c.x) * 3);
        g.globalAlpha = 1;
        void COLORS;
      }
      const order = ps.map((_, i) => i).sort((a, b) => ps[a].y - ps[b].y);
      for (const i of order) drawP(g, ps[i], t, i, { mood: ps[i].stun > 0 ? 'sad' : undefined });
      for (const p of ps)
        if (p.stun > 0) {
          g.font = '34px sans-serif';
          g.textAlign = 'center';
          g.fillText('💫', p.x + Math.cos(t * 8) * 30, p.y - 120);
        }
      hud(g, ps, true);
    },
    ranking: () => byScore(ps),
    leader() {
      return null;
    },
  };
  return game;
}

// ————————————————————————————————————————— Le sol est de la lave —————————————————————————————————————————

function lava(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const ps = makePlayers(runners);
  const CS = 100;
  const GW = Math.floor(AW / CS);
  const GH = Math.floor(AH / CS);
  // Grille centrée dans l'aire de jeu
  const OX = AX + (AW - GW * CS) / 2;
  // État des dalles : 0 = solide, >0 = craquelle (temps avant la chute), -1 = tombée
  const tiles: number[][] = Array.from({ length: GH }, () => Array(GW).fill(0));
  let outCount = 0;
  let time = 0;
  const alive = () => ps.filter((p) => p.alive);
  const cell = (x: number, y: number) => [Math.floor((x - OX) / CS), Math.floor((y - 10 - AY) / CS)];
  const solid = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < GW && cy < GH && tiles[cy][cx] >= 0;

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      const p = readInput(ps, pid, m as never);
      if (!p) return;
      // A : petit saut (on franchit un trou d'une case)
      if (p.a && !p.lastA && p.hop <= 0 && p.cd <= 0 && p.alive) {
        p.hop = 0.5;
        p.cd = 1.1;
        if (!p.bot) ctx.cool(p.pid, 'a', 1.1);
        sfx.boing();
      }
      p.lastA = p.a;
    },
    update(dt) {
      time += dt;
      // Les dalles qu'on piétine craquellent puis tombent
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < GW; x++)
          if (tiles[y][x] > 0) {
            tiles[y][x] -= dt;
            if (tiles[y][x] <= 0) tiles[y][x] = -1;
          }
      // Au bout de 30 s, des dalles au hasard tombent toutes seules
      if (time > 30 && Math.random() < dt * (0.6 + (time - 30) * 0.05)) {
        const x = Math.floor(Math.random() * GW);
        const y = Math.floor(Math.random() * GH);
        if (tiles[y][x] === 0) tiles[y][x] = 1;
      }
      for (const p of ps) {
        if (!p.bot || !p.alive) continue;
        // Bot : vise la dalle solide la plus sûre autour de lui
        if ((p.botT -= dt) <= 0) {
          p.botT = rnd(0.25, 0.6);
          let best = { x: p.x, y: p.y, s: -1 };
          for (let k = 0; k < 14; k++) {
            const tx = p.x + rnd(-260, 260);
            const ty = p.y + rnd(-200, 200);
            const [cx, cy] = cell(tx, ty);
            if (!solid(cx, cy) || tiles[cy][cx] > 0) continue;
            let s = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (solid(cx + dx, cy + dy) && tiles[cy + dy][cx + dx] === 0) s++;
            if (s > best.s) best = { x: OX + cx * CS + 50, y: AY + cy * CS + 60, s };
          }
          p.tx = best.x;
          p.ty = best.y;
        }
        // Ici, rêvasser = tomber : les bots bougent toujours
        const ddx = p.tx - p.x;
        const ddy = p.ty - p.y;
        const dd = Math.hypot(ddx, ddy) || 1;
        p.inp = { x: ddx / dd, y: ddy / dd };
        const [ax, ay] = cell(p.x + p.vx * 0.25, p.y + p.vy * 0.25);
        if (!solid(ax, ay) && p.hop <= 0 && p.cd <= 0 && Math.random() < 0.5 * (0.4 + ctx.botSkill)) {
          p.hop = 0.5;
          p.cd = 1.1;
        }
      }
      step(ps, dt, (p) => (p.hop > 0 ? 520 : 400));
      for (const p of ps) {
        if (!p.alive || p.hop > 0) continue;
        const [cx, cy] = cell(p.x, p.y);
        if (!solid(cx, cy)) {
          p.alive = false;
          p.out = ++outCount;
          sfx.pet();
          if (!p.bot) ctx.buzz(p.pid, 500);
          continue;
        }
        if (tiles[cy][cx] === 0 && time > 1.5) tiles[cy][cx] = 1.6;
      }
      if (alive().length <= (ps.length > 1 ? 1 : 0)) game.over = true;
    },
    render(g, t) {
      g.fillStyle = '#2a1838';
      g.fillRect(0, 0, 1920, 1080);
      // La lave qui bouillonne
      g.fillStyle = '#ff5a1f';
      g.fillRect(AX - 20, AY - 20, AW + 40, AH + 40);
      if (!ctx.light) {
        g.fillStyle = '#ffb21f';
        for (let k = 0; k < 18; k++) {
          const q = (t * 0.6 + k * 0.37) % 1;
          g.globalAlpha = 1 - q;
          g.beginPath();
          g.arc(AX + ((k * 271) % AW), AY + ((k * 157) % AH), 10 + q * 26, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
      }
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < GW; x++) {
          const v = tiles[y][x];
          if (v < 0) continue;
          const shake = v > 0 ? rnd(-3, 3) : 0;
          const px = OX + x * CS + 4 + shake;
          const py = AY + y * CS + 4;
          g.fillStyle = INK;
          g.fillRect(px, py + 8, CS - 8, CS - 8);
          g.fillStyle = v > 0 ? (v < 0.5 ? '#c98a5a' : '#e0b48a') : (x + y) % 2 ? '#fff1c9' : '#ffe6a6';
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.beginPath();
          g.roundRect(px, py, CS - 8, CS - 8, 10);
          g.fill();
          g.stroke();
          if (v > 0) {
            g.beginPath();
            g.moveTo(px + 20, py + 20);
            g.lineTo(px + 50, py + 46);
            g.lineTo(px + 40, py + 76);
            g.stroke();
          }
        }
      const order = ps.map((_, i) => i).sort((a, b) => ps[a].y - ps[b].y);
      for (const i of order) {
        const p = ps[i];
        const lift = p.hop > 0 ? Math.sin((p.hop / 0.5) * Math.PI) * 60 : 0;
        if (lift && p.alive) {
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.beginPath();
          g.ellipse(p.x, p.y, 34, 12, 0, 0, Math.PI * 2);
          g.fill();
        }
        drawP(g, p, t, i, { lift });
      }
      hud(g, ps, false);
      bigText(g, fr ? '🌋 Ne reste pas en place ! A = sauter un trou' : '🌋 Keep moving! A = jump a hole', '#fff', 0.42, 130);
    },
    out: (pid) => !!ps.find((p) => p.pid === pid && !p.alive),
    ranking: () => byOut(ps),
    leader() {
      const a = alive();
      return a.length === 1 ? a[0].profile.name : null;
    },
  };
  return game;
}

// ————————————————————————————————————————— Bloc de Couleur —————————————————————————————————————————
// Une couleur est annoncée : cours sur une dalle de cette couleur avant que toutes les autres tombent.

const BLOCK_COLORS = [
  { c: '#ff4f9a', n: { fr: 'ROSE', en: 'PINK' } },
  { c: '#ffd60a', n: { fr: 'JAUNE', en: 'YELLOW' } },
  { c: '#2ec5ff', n: { fr: 'BLEU', en: 'BLUE' } },
  { c: '#7bd13b', n: { fr: 'VERT', en: 'GREEN' } },
  { c: '#9b5cff', n: { fr: 'VIOLET', en: 'PURPLE' } },
  { c: '#ff9a1f', n: { fr: 'ORANGE', en: 'ORANGE' } },
];

function colorBlock(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const ps = makePlayers(runners);
  const CS = 160;
  const GW = Math.floor(AW / CS);
  const GH = Math.floor(AH / CS);
  const OX = AX + (AW - GW * CS) / 2;
  const OY = AY + (AH - GH * CS) / 2;
  let grid: number[][] = [];
  let phase: 'call' | 'drop' | 'back' = 'back';
  let pt = 1.5;
  let callLen = 4;
  let target = 0;
  let rounds = 0;
  let outCount = 0;
  const alive = () => ps.filter((p) => p.alive);
  const shuffle = () => {
    // Chaque couleur au moins deux fois, le reste au hasard
    const cells: number[] = [];
    for (let i = 0; i < GW * GH; i++) cells.push(i < BLOCK_COLORS.length * 2 ? i % BLOCK_COLORS.length : Math.floor(Math.random() * BLOCK_COLORS.length));
    cells.sort(() => Math.random() - 0.5);
    grid = Array.from({ length: GH }, (_, y) => cells.slice(y * GW, y * GW + GW));
  };
  const cell = (x: number, y: number) => [Math.floor((x - OX) / CS), Math.floor((y - 10 - OY) / CS)];
  shuffle();

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      const p = readInput(ps, pid, m as never);
      if (!p) return;
      if (p.b && !p.lastB && p.alive) shove(ps, p, ctx);
      p.lastB = p.b;
    },
    update(dt) {
      pt -= dt;
      if (phase === 'back' && pt <= 0) {
        rounds++;
        shuffle();
        target = Math.floor(Math.random() * BLOCK_COLORS.length);
        // De plus en plus vite
        callLen = Math.max(1.6, 4 - rounds * 0.25);
        phase = 'call';
        pt = callLen;
        speak(BLOCK_COLORS[target].n[ctx.lang], ctx.lang);
        sfx.go();
        for (const p of ps) p.botT = rnd(0.15, 1.1 - ctx.botSkill * 0.8);
      } else if (phase === 'call') {
        if (Math.ceil(pt) !== Math.ceil(pt + dt) && pt > 0) sfx.tick();
        if (pt <= 0) {
          phase = 'drop';
          pt = 1.4;
          sfx.boom();
        }
      } else if (phase === 'drop' && pt <= 0) {
        phase = 'back';
        pt = 1;
      }
      for (const p of ps) {
        if (!p.bot || !p.alive) continue;
        if (phase === 'call' && p.botT > 0 && (p.botT -= dt) <= 0) {
          // Le bot repère la dalle de la bonne couleur la plus proche (ou se trompe parfois)
          let best = { x: p.x, y: p.y, d: 1e9 };
          const ok = Math.random() < 0.55 + 0.4 * ctx.botSkill;
          for (let y = 0; y < GH; y++)
            for (let x = 0; x < GW; x++) {
              if (ok ? grid[y][x] !== target : grid[y][x] === target) continue;
              const cx = OX + x * CS + CS / 2;
              const cy = OY + y * CS + CS / 2;
              const d = Math.hypot(cx - p.x, cy - p.y);
              if (d < best.d) best = { x: cx, y: cy, d };
            }
          p.tx = best.x;
          p.ty = best.y;
        }
        botGo(p, ctx, dt);
      }
      step(ps, dt, () => 430);
      if (phase === 'drop' && pt < 1.25) {
        for (const p of ps) {
          if (!p.alive) continue;
          const [cx, cy] = cell(p.x, p.y);
          const safe = cx >= 0 && cy >= 0 && cx < GW && cy < GH && grid[cy][cx] === target;
          if (!safe) {
            p.alive = false;
            p.out = ++outCount;
            sfx.pet();
            if (!p.bot) ctx.buzz(p.pid, 500);
          }
        }
      }
      if (alive().length <= (ps.length > 1 ? 1 : 0)) game.over = true;
    },
    render(g, t) {
      g.fillStyle = '#1d0f26';
      g.fillRect(0, 0, 1920, 1080);
      // Le vide, avec des étoiles qui défilent
      if (!ctx.light) {
        g.fillStyle = 'rgba(255,255,255,0.5)';
        for (let k = 0; k < 60; k++) g.fillRect((k * 337) % 1920, (k * 211 + t * 20 * (1 + (k % 3))) % 1080, 3, 3);
      }
      const dropK = phase === 'drop' ? Math.min(1, (1.4 - pt) / 0.3) : 0;
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < GW; x++) {
          const v = grid[y][x];
          const k = phase === 'drop' && v !== target ? dropK : 0;
          const s = 1 - k * 0.7;
          const px = OX + x * CS + CS / 2;
          const py = OY + y * CS + CS / 2 + k * 60;
          const w = (CS - 12) * s;
          g.globalAlpha = 1 - k;
          g.fillStyle = INK;
          g.beginPath();
          g.roundRect(px - w / 2, py - w / 2 + 10, w, w, 18 * s);
          g.fill();
          const calling = phase === 'call' && v === target;
          g.fillStyle = BLOCK_COLORS[v].c;
          g.strokeStyle = calling && Math.floor(t * 6) % 2 ? '#fff' : INK;
          g.lineWidth = calling ? 8 : 5;
          g.beginPath();
          g.roundRect(px - w / 2, py - w / 2, w, w, 18 * s);
          g.fill();
          g.stroke();
          candy(g, px - w / 2, py - w / 2, w, w, 18 * s);
          g.globalAlpha = 1;
        }
      const order = ps.map((_, i) => i).sort((a, b) => ps[a].y - ps[b].y);
      for (const i of order) drawP(g, ps[i], t, i, { mood: phase === 'call' && pt < 1 ? 'wow' : undefined });
      hud(g, ps, false);
      if (phase === 'call') {
        const C = BLOCK_COLORS[target];
        const k = Math.max(0, pt / callLen);
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(660, 120 + 8, 600, 110, 30);
        g.fill();
        g.fillStyle = C.c;
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(660, 120, 600, 110, 30);
        g.fill();
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(680, 206, 560 * k, 12);
        bigText(g, C.n[ctx.lang], '#fff', 0.7, 150);
      } else bigText(g, fr ? '🎨 Attends la couleur…' : '🎨 Wait for the color…', '#fff', 0.42, 160);
    },
    out: (pid) => !!ps.find((p) => p.pid === pid && !p.alive),
    ranking: () => byOut(ps),
    leader() {
      const a = alive();
      return a.length === 1 ? a[0].profile.name : null;
    },
  };
  return game;
}

// ————————————————————————————————————————— Fiches des jeux —————————————————————————————————————————

const base = { inspired: 'Jeux de fête classiques', layout: 'stick' as const, min: 2, max: 8, botFill: 4 };

export const chairsGame: GameBase = {
  ...base,
  id: 'chaises',
  emoji: '🪑',
  name: { fr: 'Chaises Musicales', en: 'Musical Cushions' },
  how: { fr: 'Promène-toi, et au STOP fonce sur un coussin ! Il en manque toujours un · B = pousser', en: 'Walk around, and at STOP rush to a cushion! One is always missing · B = shove' },
  music: 'party',
  limit: 120,
  create: chairs,
};
export const potatoGame: GameBase = {
  ...base,
  id: 'patate',
  emoji: '🥔',
  name: { fr: 'Patate Chaude', en: 'Hot Potato' },
  how: { fr: 'Tu as la patate ? Touche quelqu’un avant qu’elle explose ! · B = pousser', en: 'Got the potato? Tag someone before it blows! · B = shove' },
  music: 'arcade',
  limit: 120,
  create: potato,
};
export const rainGame: GameBase = {
  ...base,
  id: 'pluie',
  emoji: '🍬',
  name: { fr: 'Pluie de Bonbons', en: 'Candy Rain' },
  how: { fr: 'Ramasse le plus de bonbons (⭐ = 5) et évite les ombres rouges des enclumes · B = pousser', en: 'Grab the most candy (⭐ = 5) and dodge the red anvil shadows · B = shove' },
  music: 'party',
  limit: 45,
  create: candyRain,
};
export const colorGame: GameBase = {
  ...base,
  id: 'couleur',
  emoji: '🎨',
  name: { fr: 'Bloc de Couleur', en: 'Color Block' },
  how: { fr: 'Une couleur est annoncée : fonce sur une dalle de cette couleur, les autres tombent ! · B = pousser', en: 'A color is called: run onto a tile of that color, the rest drop! · B = shove' },
  music: 'arcade',
  limit: 120,
  create: colorBlock,
};
export const lavaGame: GameBase = {
  ...base,
  id: 'lave',
  emoji: '🌋',
  name: { fr: 'Le Sol est de la Lave', en: 'The Floor is Lava' },
  how: { fr: 'Les dalles s’effondrent après ton passage : bouge sans arrêt ! A = sauter un trou', en: 'Tiles crumble after you step on them: keep moving! A = jump a hole' },
  music: 'fight',
  limit: 90,
  create: lava,
};
