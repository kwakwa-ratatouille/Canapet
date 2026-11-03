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

/** Une vraie chaise vue de trois quarts : dossier, assise, pieds. La place libre brille. */
function drawChair(g: CanvasRenderingContext2D, x: number, y: number, color: string, free: boolean, rush: boolean, t: number) {
  if (free && rush) {
    // Cible au sol : c'est ici qu'il faut aller
    g.strokeStyle = SOLEIL;
    g.lineWidth = 8;
    g.globalAlpha = 0.6 + Math.sin(t * 10) * 0.3;
    g.beginPath();
    g.ellipse(x, y + 10, 70, 30, 0, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  // Pieds
  g.fillStyle = '#a0643a';
  for (const [dx, dy] of [[-34, 0], [34, 0], [-26, 14], [26, 14]]) {
    g.beginPath();
    g.roundRect(x + dx - 5, y + dy - 6, 10, 32, 4);
    g.fill();
    g.stroke();
  }
  // Dossier
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(x - 40, y - 78, 80, 62, 14);
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(x - 28, y - 70, 56, 10);
  // Assise
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(x - 46, y - 20, 92, 30, 12);
  g.fill();
  g.stroke();
  candy(g, x - 46, y - 20, 92, 30, 12);
}

function chairs(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const ps = makePlayers(runners);
  let phase: 'music' | 'rush' | 'result' = 'music';
  let timer = rnd(5, 9);
  let outCount = 0;
  let seats: { x: number; y: number; by: number; c: string }[] = [];
  // Obstacles (plantes en pot, poufs) : ils bloquent le passage, changent à chaque manche
  let props: { x: number; y: number; r: number; kind: 'plante' | 'pouf' }[] = [];
  let loser = -1;
  let flash = 0;
  const SEAT_COLORS = ['#ff4f9a', '#2ec5ff', '#ffd60a', '#1fc9a0', '#9b5cff', '#ff9a1f', '#7bd13b'];
  const alive = () => ps.filter((p) => p.alive);

  /** Nouveaux obstacles à chaque manche, posés au hasard (jamais sur un joueur). */
  function placeProps() {
    props = [];
    const want = 5 + Math.floor(Math.random() * 3);
    for (let k = 0; k < 400 && props.length < want; k++) {
      const x = rnd(AX + 90, AX + AW - 90);
      const y = rnd(AY + 110, AY + AH - 40);
      if (props.every((q) => Math.hypot(q.x - x, q.y - y) > 230) && ps.every((o) => !o.alive || Math.hypot(o.x - x, o.y - y) > 120))
        props.push({ x, y, r: 46, kind: Math.random() < 0.5 ? 'pouf' : 'plante' });
    }
  }
  /** Au STOP, les chaises surgissent n'importe où (une de moins que de joueurs) : impossible de camper. */
  function placeChairs() {
    const n = Math.max(1, alive().length - 1);
    seats = [];
    for (let k = 0; k < 400 && seats.length < n; k++) {
      const x = rnd(AX + 110, AX + AW - 110);
      const y = rnd(AY + 130, AY + AH - 50);
      if (seats.every((q) => Math.hypot(q.x - x, q.y - y) > 230) && props.every((q) => Math.hypot(q.x - x, q.y - y) > 130))
        seats.push({ x, y, by: -1, c: SEAT_COLORS[seats.length % SEAT_COLORS.length] });
    }
  }
  placeProps();

  function stopMusic() {
    phase = 'rush';
    placeChairs();
    timer = 7;
    flash = 1;
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
          // On tourne autour des chaises, comme à une vraie fête
          if ((p.botT -= dt) <= 0) {
            p.botT = rnd(1, 2.5);
            p.tx = rnd(AX + 100, AX + AW - 100);
            p.ty = rnd(AY + 120, AY + AH - 60);
          }
        } else if (phase === 'rush') {
          if ((p.botT -= dt) > 0) {
            p.inp = { x: 0, y: 0 };
            continue;
          }
          const free = seats.filter((q) => q.by < 0).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
          if (free) {
            p.tx = free.x;
            p.ty = free.y;
          }
          const near = ps.find((o) => o !== p && o.alive && Math.hypot(o.x - p.x, o.y - p.y) < 90);
          if (near && Math.random() < 0.03) shove(ps, p, ctx);
        }
        botGo(p, ctx, dt);
      }
      // Assis = immobile sur sa chaise
      step(ps, dt, (p) => (seats.some((q) => q.by === ps.indexOf(p)) ? 0 : 430));
      // Les obstacles repoussent
      for (const p of ps) {
        if (!p.alive) continue;
        for (const q of props) {
          const dx = p.x - q.x;
          const dy = (p.y - q.y) * 1.3;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < q.r + BODY) {
            p.x = q.x + (dx / d) * (q.r + BODY);
            p.y = q.y + ((dy / d) * (q.r + BODY)) / 1.3;
          }
        }
      }
      if (phase === 'rush') {
        for (const q of seats) {
          if (q.by >= 0) {
            const o = ps[q.by];
            o.x = q.x;
            o.y = q.y + 4;
            continue;
          }
          const p = ps.find((o, i) => o.alive && o.stun <= 0 && !seats.some((x) => x.by === i) && Math.hypot(o.x - q.x, (o.y - q.y) * 1.3) < 60);
          if (p) {
            q.by = ps.indexOf(p);
            sfx.pop();
            p.pop = { text: fr ? 'ASSIS !' : 'SEATED!', t: 0.8, c: SOLEIL };
          }
        }
        if (seats.every((q) => q.by >= 0) || timer <= 0) endRush();
      } else if (phase === 'music' && timer <= 0) stopMusic();
      else if (phase === 'result' && timer <= 0) {
        if (alive().length <= 1) game.over = true;
        else {
          phase = 'music';
          timer = rnd(5, 10);
          loser = -1;
          seats = [];
          placeProps();
          sfx.go();
        }
      }
    },
    render(g, t) {
      drawFloor(g, '#ffe1ef', '#ffd0e6', phase === 'music' && !ctx.light && Math.floor(t * 2) % 2 ? '#fff1c9' : '#ffe9b8');
      if (phase === 'music') {
        g.textAlign = 'center';
        g.fillStyle = INK;
        g.font = '60px sans-serif';
        for (let k = 0; k < 6; k++) g.fillText(k % 2 ? '♪' : '♫', 300 + k * 270, 190 + Math.sin(t * 4 + k) * 14);
      }
      // Obstacles, chaises et joueurs triés du fond vers le devant
      type Item = { y: number; draw: () => void };
      const items: Item[] = [];
      for (const q of props)
        items.push({
          y: q.y,
          draw: () => {
            g.strokeStyle = INK;
            g.lineWidth = 5;
            if (q.kind === 'plante') {
              g.fillStyle = '#d9654a';
              g.beginPath();
              g.roundRect(q.x - 34, q.y - 40, 68, 52, 10);
              g.fill();
              g.stroke();
              g.fillStyle = '#3fa34a';
              for (const [dx, dy, r] of [[-22, -60, 26], [20, -64, 24], [0, -86, 26]]) {
                g.beginPath();
                g.arc(q.x + dx, q.y + dy, r, 0, Math.PI * 2);
                g.fill();
                g.stroke();
              }
            } else {
              g.fillStyle = '#9b5cff';
              g.beginPath();
              g.ellipse(q.x, q.y - 16, 50, 34, 0, 0, Math.PI * 2);
              g.fill();
              g.stroke();
              candy(g, q.x - 50, q.y - 50, 100, 68, 30);
            }
          },
        });
      const pop = phase === 'rush' ? Math.min(1, (7 - timer) / 0.35) : 1;
      for (const q of seats)
        items.push({
          y: q.y - 1,
          draw: () => {
            g.save();
            g.translate(q.x, q.y);
            g.scale(pop, pop * (pop < 1 ? 1.2 : 1));
            drawChair(g, 0, 0, q.by >= 0 ? ps[q.by].profile.color : q.c, q.by < 0, phase === 'rush', t);
            g.restore();
          },
        });
      ps.forEach((p, i) => items.push({ y: p.y, draw: () => drawP(g, p, t, i, { mood: i === loser ? 'sad' : undefined, lift: seats.some((q) => q.by === i) ? 14 : 0 }) }));
      items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
      hud(g, ps, false);
      if (phase === 'music') bigText(g, fr ? '🎵 Promène-toi… les chaises arrivent au STOP !' : '🎵 Walk around… chairs pop up at STOP!', '#fff', 0.45, 130);
      if (phase === 'rush' && flash > 0) bigText(g, 'STOP !', ROSE, 1 + flash * 0.4);
      if (phase === 'rush') bigText(g, fr ? `Assieds-toi ! ${seats.filter((q) => q.by < 0).length} chaise(s) libre(s)` : `Sit down! ${seats.filter((q) => q.by < 0).length} free`, SOLEIL, 0.5, 130);
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
  let toss: { x: number; y: number; t: number } | null = null;
  const debris: { x: number; y: number; vx: number; vy: number; t: number; c: string }[] = [];
  const alive = () => ps.filter((p) => p.alive);
  // Carte tirée au hasard à chaque partie : estrade (deux rampes = on peut faire la boucle),
  // meubles qui bloquent, flaques de sirop qui ralentissent, deux tuyaux qui téléportent.
  type Box = { x: number; y: number; w: number; h: number };
  const hit = (q: Box, list: Box[], m = 70) => list.some((o) => q.x < o.x + o.w + m && q.x + q.w + m > o.x && q.y < o.y + o.h + m && q.y + q.h + m > o.y);
  const STW = 340;
  const STH = 260;
  // L'estrade se pose loin du milieu (là où tout le monde commence)
  let ST: Box = { x: AX + 80, y: AY + 60, w: STW, h: STH };
  for (let k = 0; k < 200; k++) {
    ST = { x: rnd(AX + 80, AX + AW - STW - 80), y: rnd(AY + 80, AY + AH - STH - 90), w: STW, h: STH };
    if (!hit(ST, [{ x: 960 - 360, y: 620 - 260, w: 720, h: 520 }], 20)) break;
  }
  const GAP = 120;
  // Rampes : une en haut à gauche, une en bas à droite (ou l'inverse)
  const flip = Math.random() < 0.5;
  const ramps = [
    { x: flip ? ST.x + ST.w - GAP : ST.x, side: 'top' as const },
    { x: flip ? ST.x : ST.x + ST.w - GAP, side: 'bottom' as const },
  ];
  const walls: (Box & { kind: 'canape' | 'table' | 'bord' })[] = [
    { x: ST.x - 16, y: ST.y, w: 16, h: ST.h, kind: 'bord' },
    { x: ST.x + ST.w, y: ST.y, w: 16, h: ST.h, kind: 'bord' },
    { x: ramps[0].x === ST.x ? ST.x + GAP : ST.x, y: ST.y - 16, w: ST.w - GAP, h: 16, kind: 'bord' },
    { x: ramps[1].x === ST.x ? ST.x + GAP : ST.x, y: ST.y + ST.h, w: ST.w - GAP, h: 16, kind: 'bord' },
  ];
  const taken: Box[] = [{ x: ST.x - 40, y: ST.y - 80, w: ST.w + 80, h: ST.h + 160 }];
  // Personne ne commence dans un meuble : on garde libre la zone de départ au milieu
  taken.push({ x: 960 - 360, y: 620 - 260, w: 720, h: 520 });
  const furniture: (Box & { kind: 'canape' | 'table' })[] = [];
  for (let k = 0; k < 300 && furniture.length < 4; k++) {
    const kind = furniture.length % 2 ? 'table' : 'canape';
    const w = kind === 'canape' ? 240 : 140;
    const h = kind === 'canape' ? 70 : 100;
    const q = { x: rnd(AX + 40, AX + AW - w - 40), y: rnd(AY + 40, AY + AH - h - 40), w, h, kind } as const;
    if (!hit(q, taken)) {
      furniture.push(q);
      taken.push(q);
    }
  }
  walls.push(...furniture);
  const puddles: { x: number; y: number; r: number }[] = [];
  for (let k = 0; k < 300 && puddles.length < 3; k++) {
    const q = { x: rnd(AX + 120, AX + AW - 120), y: rnd(AY + 100, AY + AH - 80), r: 90 };
    if (!hit({ x: q.x - q.r, y: q.y - q.r / 2, w: q.r * 2, h: q.r }, taken, 20)) {
      puddles.push(q);
      taken.push({ x: q.x - q.r, y: q.y - q.r / 2, w: q.r * 2, h: q.r });
    }
  }
  const inSyrup = (pl: P) => puddles.some((q) => Math.hypot(pl.x - q.x, (pl.y - q.y) * 1.8) < q.r);
  const pipes: { x: number; y: number }[] = [];
  for (let k = 0; k < 300 && pipes.length < 2; k++) {
    const q = { x: rnd(AX + 90, AX + AW - 90), y: rnd(AY + 80, AY + AH - 60) };
    const box = { x: q.x - 60, y: q.y - 40, w: 120, h: 80 };
    if (!hit(box, taken, 30) && (!pipes.length || Math.hypot(q.x - pipes[0].x, q.y - pipes[0].y) > 550)) {
      pipes.push(q);
      taken.push(box);
    }
  }
  const pipeCd = new Map<P, number>();
  const blockWalls = () => {
    for (const p of ps) {
      if (!p.alive) continue;
      for (const w of walls) {
        const cx = Math.max(w.x, Math.min(w.x + w.w, p.x));
        const cy = Math.max(w.y, Math.min(w.y + w.h, p.y));
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.hypot(dx, dy);
        const R = 26;
        if (d < R) {
          if (d === 0) p.y = w.y + w.h + R;
          else {
            p.x = cx + (dx / d) * R;
            p.y = cy + (dy / d) * R;
          }
        }
      }
    }
  };

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
      if (toss) toss.t += dt;
      for (const d of debris) {
        d.vy += 1400 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.t -= dt;
      }
      for (let k = debris.length - 1; k >= 0; k--) if (debris[k].t <= 0) debris.splice(k, 1);
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
          if (Math.hypot(p.vx, p.vy) < 40 && Math.random() < 0.05) {
            p.tx = rnd(AX + 80, AX + AW - 80);
            p.ty = rnd(AY + 80, AY + AH - 60);
          }
        }
        botGo(p, ctx, dt);
      }
      step(ps, dt, (p) => (inSyrup(p) ? 200 : p === h ? 470 : 420));
      blockWalls();
      for (const p of ps) {
        if (!p.alive) continue;
        const cd = (pipeCd.get(p) ?? 0) - dt;
        pipeCd.set(p, cd);
        if (cd > 0) continue;
        const k = pipes.findIndex((q) => Math.hypot(p.x - q.x, (p.y - q.y) * 1.3) < 40);
        if (k >= 0) {
          const out = pipes[1 - k];
          p.x = out.x + 70;
          p.y = out.y + 10;
          pipeCd.set(p, 1.6);
          p.pop = { text: 'BLOOP !', t: 0.7, c: '#7bd13b' };
          sfx.pop();
        }
      }
      // Passe : on touche quelqu'un (pas celui qui vient de nous la donner, pendant 0,6 s)
      for (const o of ps) {
        if (o === h || !o.alive || (ps.indexOf(o) === immune && immuneT > 0)) continue;
        if (Math.hypot(o.x - h.x, (o.y - h.y) * 1.3) < BODY * 2 + 6) {
          toss = { x: h.x, y: h.y - 140, t: 0 };
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
        if (!ctx.light)
          for (let k = 0; k < 26; k++) {
            const a = Math.random() * Math.PI * 2;
            const v = rnd(250, 700);
            debris.push({ x: p.x, y: p.y - 60, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 300, t: 1.2, c: k % 3 ? '#c98a3a' : '#ffd60a' });
          }
        sfx.boom();
        if (!p.bot) ctx.buzz(p.pid, 600);
        speak(ctx.family ? (fr ? 'Pouf !' : 'Poof!') : fr ? 'Boum !' : 'Boom!', ctx.lang);
        pause = 2.2;
      }
    },
    render(g, t) {
      drawFloor(g, '#fff1c9', '#ffe6a6', '#ffd6a0');
      // Estrade surélevée (on y monte par la rampe en bas à droite)
      g.fillStyle = INK;
      g.beginPath();
      g.roundRect(ST.x, ST.y + 14, ST.w, ST.h, 20);
      g.fill();
      g.fillStyle = '#ffd0e6';
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.beginPath();
      g.roundRect(ST.x, ST.y, ST.w, ST.h, 20);
      g.fill();
      g.stroke();
      candy(g, ST.x, ST.y, ST.w, ST.h, 20);
      for (const rp of ramps) {
        const y0 = rp.side === 'top' ? ST.y : ST.y + ST.h;
        const y1 = rp.side === 'top' ? ST.y - 60 : ST.y + ST.h + 60;
        g.fillStyle = '#ff9cc8';
        g.beginPath();
        g.moveTo(rp.x, y0);
        g.lineTo(rp.x + GAP, y0);
        g.lineTo(rp.x + GAP + 10, y1);
        g.lineTo(rp.x - 10, y1);
        g.closePath();
        g.fill();
        g.stroke();
        g.font = '700 28px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = INK;
        g.fillText(fr ? 'RAMPE' : 'RAMP', rp.x + GAP / 2, (y0 + y1) / 2 + 10);
      }
      // Flaques de sirop : on y colle
      for (const q of puddles) {
        g.fillStyle = '#c96a1f';
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.ellipse(q.x, q.y, q.r, q.r / 1.8, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = '#f0a040';
        g.beginPath();
        g.ellipse(q.x - 8, q.y - 5, q.r * 0.68, q.r / 2.9, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.beginPath();
        g.ellipse(q.x - q.r * 0.35, q.y - q.r * 0.18, 16, 6, -0.3, 0, Math.PI * 2);
        g.fill();
      }
      // Tuyaux verts
      for (const q of pipes) {
        g.fillStyle = INK;
        g.beginPath();
        g.ellipse(q.x, q.y + 8, 46, 22, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#3fa34a';
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.ellipse(q.x, q.y, 46, 22, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = '#1d3a1f';
        g.beginPath();
        g.ellipse(q.x, q.y, 30, 13, 0, 0, Math.PI * 2);
        g.fill();
      }
      // Meubles et rebords
      for (const w of walls) {
        if (w.kind === 'bord') {
          g.fillStyle = '#c94f8a';
          g.fillRect(w.x, w.y, w.w, w.h);
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.strokeRect(w.x, w.y, w.w, w.h);
          continue;
        }
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(w.x, w.y + 12, w.w, w.h, 18);
        g.fill();
        g.fillStyle = w.kind === 'canape' ? '#7b4dff' : '#a0643a';
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.roundRect(w.x, w.y, w.w, w.h, 18);
        g.fill();
        g.stroke();
        candy(g, w.x, w.y, w.w, w.h, 18);
        if (w.kind === 'table') {
          g.font = '44px sans-serif';
          g.textAlign = 'center';
          g.fillText('🍿', w.x + w.w / 2, w.y + w.h / 2 + 14);
        }
      }
      const order = ps.map((_, i) => i).sort((a, b) => ps[a].y - ps[b].y);
      for (const i of order) {
        const p = ps[i];
        drawP(g, p, t, i, { mood: i === holder && p.alive ? 'wow' : undefined });
        if (i === holder && p.alive && pause <= 0) {
          // La patate qui fume, de plus en plus rouge et qui tremble
          const heat = 1 - fuse / fuseMax;
          const sh = heat * 6;
          let px = p.x + rnd(-sh, sh);
          let py = p.y - 140 + rnd(-sh, sh);
          if (toss && toss.t < 0.28) {
            const k = toss.t / 0.28;
            px = toss.x + (px - toss.x) * k;
            py = toss.y + (py - toss.y) * k - Math.sin(k * Math.PI) * 90;
          }
          // Sueur du porteur
          g.fillStyle = '#9fe2ff';
          for (let k = 0; k < 2; k++) {
            const q = (t * 2 + k * 0.5) % 1;
            g.globalAlpha = 1 - q;
            g.beginPath();
            g.arc(p.x + (k ? 40 : -40), p.y - 90 + q * 30, 6, 0, Math.PI * 2);
            g.fill();
          }
          g.globalAlpha = 1;
          // Mèche qui crépite
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(px + 20, py - 18);
          g.quadraticCurveTo(px + 34, py - 40, px + 44, py - 36);
          g.stroke();
          g.fillStyle = Math.floor(t * 18) % 2 ? SOLEIL : '#ff3b3b';
          g.beginPath();
          g.arc(px + 46, py - 37, 7 + Math.sin(t * 30) * 2, 0, Math.PI * 2);
          g.fill();
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
      for (const d of debris) {
        g.globalAlpha = Math.min(1, d.t);
        g.fillStyle = d.c;
        g.beginPath();
        g.arc(d.x, d.y, 9, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      // Les 3 dernières secondes : bords rouges qui battent et TIC TAC
      if (pause <= 0 && fuse < 3) {
        const k = 0.25 + Math.abs(Math.sin(t * (6 + (3 - fuse) * 4))) * 0.35;
        g.strokeStyle = `rgba(255,59,59,${k})`;
        g.lineWidth = 40;
        g.strokeRect(0, 0, 1920, 1080);
        bigText(g, Math.floor(t * 4) % 2 ? 'TIC' : 'TAC', '#ff3b3b', 0.5, 210);
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

/** Bonbon dessiné (plus d'émojis, qui sortaient gris sur certains PC) : papillote, étoile dorée ou bonbon piégé. */
function drawCandy(g: CanvasRenderingContext2D, x: number, y: number, s: number, kind: 'bonbon' | 'or' | 'piege', color: string, t: number) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineJoin = 'round';
  g.strokeStyle = INK;
  g.lineWidth = 4;
  if (kind === 'or') {
    g.rotate(Math.sin(t * 3 + x) * 0.2);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const r = i % 2 ? 11 : 26;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = SOLEIL;
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.arc(-6, -8, 4, 0, Math.PI * 2);
    g.fill();
  } else {
    const c = kind === 'piege' ? '#5a7a2a' : color;
    // Papillote : deux bouts en éventail et un bonbon rond rayé
    for (const k of [-1, 1]) {
      g.beginPath();
      g.moveTo(k * 14, 0);
      g.lineTo(k * 32, -13);
      g.lineTo(k * 32, 13);
      g.closePath();
      g.fillStyle = c;
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 0, 17, 0, Math.PI * 2);
    g.fillStyle = c;
    g.fill();
    g.stroke();
    g.strokeStyle = kind === 'piege' ? '#b8e05a' : 'rgba(255,255,255,0.85)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-9, -12);
    g.quadraticCurveTo(-2, 0, -9, 12);
    g.moveTo(3, -15);
    g.quadraticCurveTo(10, 0, 3, 15);
    g.stroke();
    if (kind === 'piege') {
      // Petite tête de mort verte : on ne le mange pas !
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, -30, 10, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = INK;
      g.fillRect(-5, -33, 3, 3);
      g.fillRect(2, -33, 3, 3);
    } else {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.beginPath();
      g.arc(-7, -7, 4, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

function candyRain(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const ps = makePlayers(runners);
  type Kind = 'bonbon' | 'or' | 'enclume' | 'sirop' | 'piege';
  type Drop = { x: number; y: number; t: number; max: number; kind: Kind; c: string };
  let drops: Drop[] = [];
  const ground: { x: number; y: number; kind: 'bonbon' | 'or' | 'piege'; life: number; c: string; land: number }[] = [];
  // Flaques de sirop : on y avance au ralenti
  const puddles: { x: number; y: number; r: number; life: number }[] = [];
  let spawn = 0;
  let time = 0;
  // Ruée vers l'or : quelques secondes où il pleut des étoiles
  let rush = 0;
  let nextRush = rnd(18, 26);
  const COLORS = ['#ff4f9a', '#2ec5ff', '#ffd60a', '#1fc9a0', '#9b5cff', '#ff9a1f'];
  const inSyrup = (p: P) => puddles.some((q) => Math.hypot(p.x - q.x, (p.y - q.y) * 1.6) < q.r);

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
      if (rush > 0) rush -= dt;
      else if ((nextRush -= dt) <= 0) {
        rush = 4;
        nextRush = rnd(20, 28);
        speak(fr ? 'Pluie d’étoiles !' : 'Star shower!', ctx.lang);
        sfx.win();
      }
      // Ça tombe de plus en plus, avec de plus en plus d'enclumes
      if (spawn <= 0) {
        spawn = rush > 0 ? 0.08 : Math.max(0.12, 0.45 - time * 0.006);
        const r = Math.random();
        const anvil = rush <= 0 && r < 0.16 + time * 0.004;
        const kind: Kind = rush > 0 ? (r < 0.7 ? 'or' : 'bonbon') : anvil ? 'enclume' : r > 0.95 ? 'or' : r > 0.89 ? 'sirop' : r > 0.8 ? 'piege' : 'bonbon';
        const fall = kind === 'enclume' ? 1.3 : kind === 'sirop' ? 1.1 : 1;
        drops.push({ x: rnd(AX + 40, AX + AW - 40), y: rnd(AY + 60, AY + AH - 30), t: fall, max: fall, kind, c: COLORS[Math.floor(Math.random() * COLORS.length)] });
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
              for (let k = 0; k < lost; k++) ground.push({ x: p.x + rnd(-90, 90), y: p.y + rnd(-60, 60), kind: 'bonbon', life: 6, c: COLORS[k % COLORS.length], land: 0 });
              p.pop = { text: fr ? `BONK ! -${lost}` : `BONK! -${lost}`, t: 0.9, c: '#ff3b3b' };
              sfx.boing();
              if (!p.bot) ctx.buzz(p.pid, 300);
            }
        } else if (d.kind === 'sirop') {
          sfx.pop();
          puddles.push({ x: d.x, y: d.y, r: 110, life: 9 });
        } else ground.push({ x: d.x, y: d.y, kind: d.kind, life: d.kind === 'piege' ? 20 : 7, c: d.c, land: 0 });
      }
      drops = drops.filter((d) => d.t > 0);
      for (const c of ground) {
        c.life -= dt;
        c.land += dt;
      }
      for (const q of puddles) q.life -= dt;
      for (let k = puddles.length - 1; k >= 0; k--) if (puddles[k].life <= 0) puddles.splice(k, 1);
      // Bots : le bonbon le plus proche, en évitant les ombres d'enclume et les bonbons piégés
      for (const p of ps) {
        if (!p.bot) continue;
        const danger = drops.find((d) => d.kind === 'enclume' && d.t < 0.8 && Math.hypot(p.x - d.x, p.y - d.y) < 110);
        if (danger) {
          p.tx = p.x + (p.x - danger.x) * 2;
          p.ty = p.y + (p.y - danger.y) * 2;
        } else {
          const val = (c: (typeof ground)[number]) => Math.hypot(c.x - p.x, c.y - p.y) - (c.kind === 'or' ? 200 : 0);
          const best = ground.filter((c) => c.life > 0 && c.kind !== 'piege').sort((x, y) => val(x) - val(y))[0];
          if (best) {
            p.tx = best.x;
            p.ty = best.y;
          }
        }
        botGo(p, ctx, dt);
      }
      step(ps, dt, (p) => (inSyrup(p) ? 190 : 440));
      for (const c of ground) {
        if (c.life <= 0 || c.land < 0.15) continue;
        const p = ps.find((q) => q.stun <= 0 && Math.hypot(q.x - c.x, (q.y - c.y) * 1.3) < 52);
        if (!p) continue;
        c.life = 0;
        if (c.kind === 'piege') {
          const lost = Math.min(3, p.score);
          p.score -= lost;
          p.stun = 0.9;
          p.pop = { text: fr ? `BEURK ! -${lost}` : `YUCK! -${lost}`, t: 1, c: '#b8e05a' };
          sfx.pet();
          if (!p.bot) ctx.buzz(p.pid, 250);
          continue;
        }
        const v = c.kind === 'or' ? 5 : 1;
        p.score += v;
        if (v > 1) p.pop = { text: '+5 ⭐', t: 0.8, c: SOLEIL };
        sfx.pop();
      }
      for (let k = ground.length - 1; k >= 0; k--) if (ground[k].life <= 0) ground.splice(k, 1);
    },
    render(g, t) {
      drawFloor(g, '#e3f7ff', '#cfeeff', '#bfe6ff');
      // Flaques de sirop (brillantes, elles collent)
      for (const q of puddles) {
        const k = Math.min(1, q.life / 1.2);
        g.globalAlpha = k;
        g.fillStyle = '#c96a1f';
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.ellipse(q.x, q.y, q.r, q.r / 1.6, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = '#f0a040';
        g.beginPath();
        g.ellipse(q.x - 10, q.y - 6, q.r * 0.7, q.r / 2.6, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.beginPath();
        g.ellipse(q.x - q.r * 0.35, q.y - q.r * 0.2, 16, 6, -0.3, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      // Ce qui est au sol : en couleur, qui sautille, avec un petit rebond à l'atterrissage
      for (const c of ground) {
        g.globalAlpha = c.life < 1 ? Math.max(0, c.life) * (Math.floor(t * 10) % 2 ? 1 : 0.5) : 1;
        const bounce = c.land < 0.3 ? Math.sin((c.land / 0.3) * Math.PI) * 14 : Math.sin(t * 4 + c.x) * 2;
        g.fillStyle = 'rgba(58,33,64,0.22)';
        g.beginPath();
        g.ellipse(c.x, c.y + 18, 26, 9, 0, 0, Math.PI * 2);
        g.fill();
        if (c.kind === 'or') {
          g.fillStyle = 'rgba(255,214,10,0.35)';
          g.beginPath();
          g.arc(c.x, c.y, 36 + Math.sin(t * 6) * 4, 0, Math.PI * 2);
          g.fill();
        }
        drawCandy(g, c.x, c.y - bounce, c.kind === 'or' ? 1.15 : 1, c.kind, c.c, t);
        g.globalAlpha = 1;
      }
      // Ombres de ce qui va tomber + l'objet en l'air (plus petit et plus haut tant qu'il est loin)
      for (const d of drops) {
        const k = 1 - d.t / d.max;
        const big = d.kind === 'enclume' || d.kind === 'sirop';
        g.fillStyle = d.kind === 'enclume' ? `rgba(255,59,59,${0.25 + k * 0.4})` : d.kind === 'sirop' ? `rgba(201,106,31,${0.2 + k * 0.3})` : 'rgba(58,33,64,0.22)';
        g.beginPath();
        g.ellipse(d.x, d.y, (big ? 70 : 26) * (0.4 + k * 0.6), (big ? 34 : 13) * (0.4 + k * 0.6), 0, 0, Math.PI * 2);
        g.fill();
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
        } else if (d.kind === 'sirop') {
          // Pot de sirop qui tombe
          g.fillStyle = '#f0a040';
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.beginPath();
          g.roundRect(d.x - 26, fy - 56, 52, 56, 12);
          g.fill();
          g.stroke();
          g.fillStyle = '#ff4f9a';
          g.fillRect(d.x - 28, fy - 62, 56, 12);
          g.strokeRect(d.x - 28, fy - 62, 56, 12);
        } else drawCandy(g, d.x, fy - 10, 0.75 + k * 0.25, d.kind as 'bonbon' | 'or' | 'piege', d.c, t);
      }
      const order = ps.map((_, i) => i).sort((a, b) => ps[a].y - ps[b].y);
      for (const i of order) drawP(g, ps[i], t, i, { mood: ps[i].stun > 0 ? 'sad' : inSyrup(ps[i]) ? 'wow' : undefined });
      for (const p of ps)
        if (p.stun > 0) {
          g.font = '34px sans-serif';
          g.textAlign = 'center';
          g.fillText('💫', p.x + Math.cos(t * 8) * 30, p.y - 120);
        }
      hud(g, ps, true);
      if (rush > 0) bigText(g, fr ? '⭐ PLUIE D’ÉTOILES ! ⭐' : '⭐ STAR SHOWER! ⭐', SOLEIL, 0.6 + Math.sin(t * 10) * 0.03, 170);
      else bigText(g, fr ? 'Évite les bonbons verts 💀 et le sirop !' : 'Avoid green candy 💀 and syrup!', '#fff', 0.36, 170);
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
  // Dalles qui viennent de tomber : petite chute animée (temps écoulé depuis la chute)
  const falling: { x: number; y: number; t: number }[] = [];
  // Joueurs en train de fondre dans la lave (temps écoulé)
  const melting = new Map<P, number>();
  const MELT = 1.5;
  const embers: { x: number; y: number; vy: number; t: number }[] = [];
  let outCount = 0;
  let time = 0;
  let shake = 0;
  const alive = () => ps.filter((p) => p.alive);
  const cell = (x: number, y: number) => [Math.floor((x - OX) / CS), Math.floor((y - 10 - AY) / CS)];
  const solid = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < GW && cy < GH && tiles[cy][cx] >= 0;

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      const p = readInput(ps, pid, m as never);
      if (!p || melting.has(p)) return;
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
      shake = Math.max(0, shake - dt * 2);
      // Les dalles qu'on piétine craquellent puis tombent
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < GW; x++)
          if (tiles[y][x] > 0) {
            tiles[y][x] -= dt;
            if (tiles[y][x] <= 0) {
              tiles[y][x] = -1;
              falling.push({ x, y, t: 0 });
            }
          }
      for (const f of falling) f.t += dt;
      while (falling.length && falling[0].t > 0.6) falling.shift();
      // Au bout de 30 s, des dalles au hasard tombent toutes seules
      if (time > 30 && Math.random() < dt * (0.6 + (time - 30) * 0.05)) {
        const x = Math.floor(Math.random() * GW);
        const y = Math.floor(Math.random() * GH);
        if (tiles[y][x] === 0) tiles[y][x] = 1;
      }
      for (const p of ps) {
        if (!p.bot || !p.alive || melting.has(p)) continue;
        // Bot : vise la dalle solide la plus sûre autour de lui
        if ((p.botT -= dt) <= 0) {
          p.botT = rnd(0.25, 0.6);
          let best = { x: p.x, y: p.y, s: -1 };
          for (let k = 0; k < 14; k++) {
            const tx = p.x + rnd(-260, 260);
            const ty = p.y + rnd(-200, 200);
            const [cx, cy] = cell(tx, ty);
            if (!solid(cx, cy) || tiles[cy][cx] > 0) continue;
            let sc = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (solid(cx + dx, cy + dy) && tiles[cy + dy][cx + dx] === 0) sc++;
            if (sc > best.s) best = { x: OX + cx * CS + 50, y: AY + cy * CS + 60, s: sc };
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
      for (const p of melting.keys()) p.inp = { x: 0, y: 0 };
      step(ps, dt, (p) => (melting.has(p) ? 0 : p.hop > 0 ? 520 : 400));
      // Les bords du plateau sont des murs : on ne tombe plus en allant tout au bord
      for (const p of ps) {
        if (!p.alive || melting.has(p)) continue;
        p.x = Math.max(OX + 26, Math.min(OX + GW * CS - 26, p.x));
        p.y = Math.max(AY + 30, Math.min(AY + GH * CS - 4, p.y));
      }
      for (const p of ps) {
        if (!p.alive) continue;
        const m = melting.get(p);
        if (m !== undefined) {
          // On fond doucement… puis on est éliminé
          melting.set(p, m + dt);
          p.vx = p.vy = 0;
          if (!ctx.light && Math.random() < dt * 14) embers.push({ x: p.x + rnd(-30, 30), y: p.y - rnd(0, 20), vy: rnd(-160, -60), t: 1 });
          if (m + dt >= MELT) {
            melting.delete(p);
            p.alive = false;
            p.out = ++outCount;
          }
          continue;
        }
        if (p.hop > 0) continue;
        const [cx, cy] = cell(p.x, p.y);
        if (!solid(cx, cy)) {
          // Plouf dans la lave : on recentre sur le trou et on commence à fondre
          melting.set(p, 0);
          p.x = OX + cx * CS + CS / 2;
          p.y = AY + cy * CS + CS / 2 + 14;
          p.pop = { text: fr ? 'AÏE AÏE AÏE !' : 'OUCH OUCH!', t: 1.2, c: '#ffd60a' };
          shake = 0.6;
          sfx.pet();
          if (!p.bot) ctx.buzz(p.pid, 600);
          continue;
        }
        if (tiles[cy][cx] === 0 && time > 1.5) tiles[cy][cx] = 1.6;
      }
      for (const e of embers) {
        e.y += e.vy * dt;
        e.t -= dt;
      }
      for (let i = embers.length - 1; i >= 0; i--) if (embers[i].t <= 0) embers.splice(i, 1);
      if (alive().length <= (ps.length > 1 ? 1 : 0) && !melting.size) game.over = true;
    },
    render(g, t) {
      g.save();
      if (shake > 0) g.translate(rnd(-1, 1) * shake * 14, rnd(-1, 1) * shake * 14);
      g.fillStyle = '#2a1838';
      g.fillRect(-40, -40, 2000, 1160);
      // La lave qui bouillonne, avec des vagues de lumière
      const lavaG = g.createLinearGradient(0, AY, 0, AY + AH);
      lavaG.addColorStop(0, '#ff7a1f');
      lavaG.addColorStop(0.5, '#ff4a1a');
      lavaG.addColorStop(1, '#d92e12');
      g.fillStyle = lavaG;
      g.beginPath();
      g.roundRect(AX - 20, AY - 20, AW + 40, AH + 40, 30);
      g.fill();
      if (!ctx.light) {
        g.strokeStyle = 'rgba(255,214,10,0.45)';
        g.lineWidth = 6;
        for (let k = 0; k < 7; k++) {
          const y = AY + 40 + k * 115;
          g.beginPath();
          for (let x = AX - 20; x <= AX + AW + 20; x += 40) g.lineTo(x, y + Math.sin(x / 70 + t * 2 + k) * 10);
          g.stroke();
        }
        g.fillStyle = '#ffd60a';
        for (let k = 0; k < 22; k++) {
          const q = (t * 0.6 + k * 0.37) % 1;
          g.globalAlpha = 1 - q;
          g.beginPath();
          g.arc(AX + ((k * 271) % AW), AY + ((k * 157) % AH), 8 + q * 24, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
      }
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < GW; x++) {
          const v = tiles[y][x];
          if (v < 0) continue;
          const shk = v > 0 && v < 0.8 ? rnd(-3, 3) : 0;
          const px = OX + x * CS + 4 + shk;
          const py = AY + y * CS + 4;
          g.fillStyle = INK;
          g.fillRect(px, py + 8, CS - 8, CS - 8);
          // Dalle qui craquelle : elle rougit en chauffant
          const heat = v > 0 ? 1 - v / 1.6 : 0;
          g.fillStyle = v > 0 ? (heat > 0.6 ? '#ff8a4a' : heat > 0.3 ? '#f0b07a' : '#f5d2a0') : (x + y) % 2 ? '#fff1c9' : '#ffe6a6';
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.beginPath();
          g.roundRect(px, py, CS - 8, CS - 8, 12);
          g.fill();
          g.stroke();
          candy(g, px, py, CS - 8, CS - 8, 12);
          if (v > 0) {
            g.lineWidth = 3;
            g.beginPath();
            g.moveTo(px + 20, py + 20);
            g.lineTo(px + 50, py + 46);
            g.lineTo(px + 40, py + 76);
            if (heat > 0.4) {
              g.moveTo(px + 50, py + 46);
              g.lineTo(px + 76, py + 40);
            }
            g.stroke();
          }
        }
      // Dalles qui s'enfoncent dans la lave
      for (const f of falling) {
        const k = f.t / 0.6;
        const w = (CS - 8) * (1 - k * 0.5);
        const cx = OX + f.x * CS + CS / 2;
        const cy = AY + f.y * CS + CS / 2 + k * 20;
        g.globalAlpha = 1 - k;
        g.fillStyle = '#c98a5a';
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(cx - w / 2, cy - w / 2, w, w, 10);
        g.fill();
        g.stroke();
        g.globalAlpha = 1;
      }
      const order = ps.map((_, i) => i).sort((a, b) => ps[a].y - ps[b].y);
      for (const i of order) {
        const p = ps[i];
        if (!p.alive) continue;
        const m = melting.get(p);
        if (m !== undefined) {
          // Il s'enfonce dans la lave en fondant : coupé au ras de la surface, bulles et fumée
          const k = m / MELT;
          g.fillStyle = 'rgba(255,214,10,0.6)';
          g.beginPath();
          g.ellipse(p.x, p.y + 4, 46 + Math.sin(t * 12) * 4, 16, 0, 0, Math.PI * 2);
          g.fill();
          g.save();
          g.beginPath();
          g.rect(p.x - 100, p.y - 220, 200, 222);
          g.clip();
          g.translate(p.x, p.y + k * 110);
          g.rotate(Math.sin(t * 10) * 0.12 * (1 - k));
          g.globalAlpha = 1 - k * 0.4;
          drawCharacter(g, 0, 0, 96 * (1 - k * 0.25), {
            food: p.profile.food,
            color: p.profile.color,
            hat: p.profile.hat,
            acc: p.profile.acc,
            eyes: p.profile.eyes,
            pose: p.profile.pose,
            selfie: p.selfie,
            t: t + i,
            dir: p.dir,
            mood: k < 0.25 ? 'wow' : 'sad',
          });
          g.restore();
          // Rougeoiement de la lave sur le perso + anneau d'éclaboussure
          g.strokeStyle = '#ffd60a';
          g.lineWidth = 6 * (1 - k);
          g.beginPath();
          g.ellipse(p.x, p.y + 4, 30 + k * 60, 10 + k * 18, 0, 0, Math.PI * 2);
          g.stroke();
          continue;
        }
        const lift = p.hop > 0 ? Math.sin((p.hop / 0.5) * Math.PI) * 60 : 0;
        if (lift) {
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.beginPath();
          g.ellipse(p.x, p.y, 34, 12, 0, 0, Math.PI * 2);
          g.fill();
        }
        drawP(g, p, t, i, { lift });
      }
      // Fumée et braises de ceux qui fondent
      for (const e of embers) {
        g.globalAlpha = e.t;
        g.fillStyle = e.t > 0.6 ? '#ffd60a' : '#9a8a9e';
        g.beginPath();
        g.arc(e.x, e.y, 6 + (1 - e.t) * 14, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      // Texte « AÏE » au-dessus de ceux qui fondent
      for (const p of melting.keys()) {
        if (!p.pop) continue;
        g.font = '700 40px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 8;
        g.strokeStyle = INK;
        const y = p.y - 150 - (1.2 - p.pop.t) * 40;
        g.strokeText(p.pop.text, p.x, y);
        g.fillStyle = p.pop.c;
        g.fillText(p.pop.text, p.x, y);
      }
      g.restore();
      hud(g, ps, false);
      bigText(g, fr ? '🌋 Ne reste pas en place ! A = sauter un trou' : '🌋 Keep moving! A = jump a hole', '#fff', 0.42, 130);
    },
    out: (pid) => !!ps.find((p) => p.pid === pid && !p.alive),
    ranking: () => byOut(ps),
    leader() {
      const a = alive().filter((p) => !melting.has(p));
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
