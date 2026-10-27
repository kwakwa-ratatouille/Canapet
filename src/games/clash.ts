// Coussin Clash : combat de plateforme sur un canapé géant. Plus on a de %, plus on vole loin.
// A = saut (double saut) · B = coup selon la direction du stick (neutre, côté, haut, bas) · bas + B jauge pleine = super coup.
import { drawCharacter } from '../shared/characters';
import { sfx, speak } from '../shared/sound';
import { roundRectText } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const GRAV = 2300;
const RUN = 430;
const JUMP = 900;
const HW = 22;
const BH = 70;
const STOCKS = 3;
const MAX_TIME = 180;
type Plat = { x: number; y: number; w: number };
/** Scènes : chaque combat en tire une au hasard. */
const STAGES: { id: string; name: { fr: string; en: string }; main: { x: number; y: number; w: number; h: number }; plats: Plat[]; bg: [string, string] }[] = [
  {
    id: 'canape',
    name: { fr: 'Le Canapé', en: 'The Couch' },
    bg: ['#6a4bd8', '#ff9ccc'],
    main: { x: 460, y: 700, w: 1000, h: 130 },
    plats: [
      { x: 560, y: 530, w: 240 },
      { x: 1120, y: 530, w: 240 },
      { x: 840, y: 370, w: 240 },
    ],
  },
  {
    id: 'etagere',
    name: { fr: 'L’Étagère', en: 'The Bookshelf' },
    bg: ['#ffb58a', '#ffe9c7'],
    main: { x: 560, y: 720, w: 800, h: 110 },
    plats: [
      { x: 300, y: 560, w: 220 },
      { x: 1400, y: 560, w: 220 },
      { x: 820, y: 500, w: 280 },
      { x: 600, y: 330, w: 200 },
      { x: 1120, y: 330, w: 200 },
    ],
  },
  {
    id: 'frigo',
    name: { fr: 'Le Frigo', en: 'The Fridge' },
    bg: ['#9fe3ff', '#e3f2ff'],
    main: { x: 610, y: 760, w: 700, h: 120 },
    plats: [
      { x: 470, y: 600, w: 200 },
      { x: 1250, y: 600, w: 200 },
      { x: 760, y: 450, w: 400 },
      { x: 860, y: 290, w: 200 },
    ],
  },
];
// Scène du combat en cours (un seul combat à la fois).
let MAIN = STAGES[0].main;
let PLATS: Plat[] = STAGES[0].plats;
const BLAST = { l: -260, r: 2180, t: -360, b: 1320 };

type Move = 'jab' | 'side' | 'up' | 'down' | 'spike' | 'super';

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
  jab: { dur: 0.26, from: 0.05, to: 0.15, dx: 48, dy: -42, w: 60, h: 44, dmg: 3, base: 170, growth: 2.4, ang: 25 },
  side: { dur: 0.5, from: 0.16, to: 0.3, dx: 62, dy: -42, w: 86, h: 54, dmg: 11, base: 270, growth: 5.2, ang: 35 },
  up: { dur: 0.45, from: 0.06, to: 0.3, dx: 0, dy: -90, w: 86, h: 76, dmg: 8, base: 300, growth: 4, ang: 88 },
  down: { dur: 0.45, from: 0.12, to: 0.26, dx: 0, dy: -16, w: 150, h: 40, dmg: 7, base: 250, growth: 3.6, ang: 62 },
  spike: { dur: 0.45, from: 0.08, to: 0.32, dx: 0, dy: 4, w: 70, h: 54, dmg: 9, base: 220, growth: 4, ang: -80 },
  super: { dur: 0.8, from: 0.3, to: 0.45, dx: 0, dy: -35, w: 400, h: 300, dmg: 18, base: 520, growth: 6, ang: 45 },
};

interface F extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  onPlat: boolean;
  dropT: number;
  jumps: number;
  dir: 1 | -1;
  dmg: number;
  stocks: number;
  stun: number;
  invuln: number;
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
  out: number;
  kos: number;
  lastHitBy: number;
  botCd: number;
}

interface Spark {
  x: number;
  y: number;
  t: number;
  big: boolean;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const stage = STAGES[Math.floor(Math.random() * STAGES.length)];
  MAIN = stage.main;
  PLATS = stage.plats;
  const fr = ctx.lang === 'fr';
  const n = runners.length;
  const fs: F[] = runners.slice(0, 8).map((r, i) => ({
    ...r,
    x: MAIN.x + 120 + (i * (MAIN.w - 240)) / Math.max(1, n - 1),
    y: MAIN.y,
    vx: 0,
    vy: 0,
    onGround: true,
    onPlat: false,
    dropT: 0,
    jumps: 2,
    dir: i < n / 2 ? 1 : -1,
    dmg: 0,
    stocks: STOCKS,
    stun: 0,
    invuln: 1.5,
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
    out: 0,
    kos: 0,
    lastHitBy: -1,
    botCd: rnd(0.3, 0.8),
  }));
  const sparks: Spark[] = [];
  let time = 0;
  let outCount = 0;
  let endDelay = -1;
  let flash = 0;

  const alive = (f: F) => f.stocks > 0 && f.respawn <= 0;

  function startMove(f: F, i: number) {
    if (f.move || f.stun > 0) return;
    const up = f.inp.y < -0.5;
    const down = f.inp.y > 0.5;
    const side = Math.abs(f.inp.x) > 0.5;
    let m: Move = 'jab';
    if (down && f.onGround && f.meter >= 100) m = 'super';
    else if (up) m = 'up';
    else if (down) m = f.onGround ? 'down' : 'spike';
    else if (side) m = 'side';
    if (side) f.dir = f.inp.x > 0 ? 1 : -1;
    f.move = m;
    f.moveT = 0;
    f.hitSet = new Set([i]);
    if (m === 'side') f.vx += f.dir * 260;
    if (m === 'up' && !f.onGround && !f.upUsed) {
      f.vy = -980;
      f.upUsed = true;
    }
    if (m === 'spike') f.vy = Math.max(f.vy, 300);
    if (m === 'super') {
      f.meter = 0;
      speak(fr ? 'Prout cosmique !' : 'Cosmic toot!', ctx.lang);
    }
    if (!ctx.light) sfx.step();
  }

  function hitbox(f: F) {
    const d = MOVES[f.move!];
    const cx = f.x + d.dx * f.dir;
    const cy = f.y + d.dy;
    return { x: cx - d.w / 2, y: cy - d.h / 2, w: d.w, h: d.h, cx, cy };
  }

  function applyHits(f: F, i: number) {
    if (!f.move) return;
    const d = MOVES[f.move];
    if (f.moveT < d.from || f.moveT > d.to) return;
    const hb = hitbox(f);
    fs.forEach((o, j) => {
      if (f.hitSet.has(j) || !alive(o) || o.invuln > 0) return;
      if (o.x + HW < hb.x || o.x - HW > hb.x + hb.w || o.y < hb.y || o.y - BH > hb.y + hb.h) return;
      f.hitSet.add(j);
      o.dmg = Math.min(999, o.dmg + d.dmg);
      const kb = d.base + o.dmg * d.growth;
      let ang = (d.ang * Math.PI) / 180;
      let dirX: number = f.dir;
      if (f.move === 'down' || f.move === 'super') dirX = o.x >= f.x ? 1 : -1;
      if (f.move === 'up') dirX = o.x >= f.x ? 0.3 : -0.3;
      o.vx = Math.cos(ang) * kb * dirX;
      o.vy = -Math.sin(ang) * kb;
      if (o.vy < 0) o.onGround = false;
      o.stun = Math.min(1.4, kb / 1100);
      o.move = null;
      o.lastHitBy = i;
      f.meter = Math.min(100, f.meter + d.dmg * 2.4);
      o.meter = Math.min(100, o.meter + d.dmg * 1.4);
      const big = kb > 700;
      sparks.push({ x: o.x, y: o.y - BH / 2, t: big ? 0.5 : 0.25, big });
      if (big) {
        sfx.boing();
        flash = 0.08;
      } else sfx.pop();
      if (!o.bot) ctx.buzz(o.pid, big ? 200 : 60);
      ang = 0;
    });
  }

  function respawnAt(f: F) {
    f.x = 960;
    f.y = 240;
    f.vx = f.vy = 0;
    f.dmg = 0;
    f.invuln = 2;
    f.stun = 0;
    f.move = null;
    f.jumps = 2;
    f.upUsed = false;
  }

  function bot(f: F, i: number, dt: number) {
    f.botCd -= dt;
    const off = f.x < MAIN.x - 10 || f.x > MAIN.x + MAIN.w + 10;
    f.inp = { x: 0, y: 0 };
    if (off || f.y > MAIN.y + 40) {
      f.inp.x = f.x < 960 ? 1 : -1;
      if (f.vy > 0 && f.y > MAIN.y - 140) {
        if (f.jumps > 0) f.jumpReq = true;
        else if (!f.upUsed) {
          f.inp.y = -1;
          f.atkReq = true;
        }
      }
      return;
    }
    let best = -1;
    let bd = 1e9;
    fs.forEach((o, j) => {
      if (j === i || !alive(o)) return;
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
    if (Math.abs(dx) > 70) f.inp.x = Math.sign(dx);
    else f.dir = dx >= 0 ? 1 : -1;
    // Ne pas se jeter du canapé
    if ((f.x < MAIN.x + 60 && f.inp.x < 0) || (f.x > MAIN.x + MAIN.w - 60 && f.inp.x > 0)) f.inp.x = 0;
    if (dy < -120 && f.onGround && Math.random() < 0.04) f.jumpReq = true;
    if (f.botCd <= 0 && Math.abs(dx) < 110 && Math.abs(dy) < 80) {
      f.botCd = rnd(0.35, 0.9);
      const r = Math.random();
      if (f.meter >= 100 && f.onGround) f.inp.y = 1;
      else if (r < 0.45) f.inp = { x: 0, y: 0 };
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
    f.dropT = Math.max(0, f.dropT - dt);
    const control = f.stun <= 0;
    const mx = control && Math.abs(f.inp.x) > 0.25 ? Math.sign(f.inp.x) : 0;
    if (control && !f.move && mx) f.dir = mx as 1 | -1;
    if (control) {
      const busy = f.move && f.onGround ? 0.25 : 1;
      const target = mx * RUN * busy;
      const acc = (f.onGround ? 4200 : 2200) * dt;
      f.vx += Math.max(-acc, Math.min(acc, target - f.vx));
    } else f.vx *= Math.pow(0.55, dt);
    if (f.jumpReq && control && f.jumps > 0) {
      f.vy = -JUMP * (f.jumps === 2 ? 1 : 0.9);
      f.jumps--;
      f.onGround = false;
    }
    f.jumpReq = false;
    if (f.onPlat && f.inp.y > 0.75 && control && !f.move) {
      f.dropT = 0.3;
      f.onGround = false;
    }
    const fast = !f.onGround && control && f.inp.y > 0.6 && f.vy > 0 ? 1.8 : 1;
    f.vy = Math.min(f.vy + GRAV * fast * dt, f.stun > 0 ? 2200 : 1300);
    const prevY = f.y;
    f.x += f.vx * dt;
    // Canapé : bloc plein
    if (f.y > MAIN.y + 2 && f.y - BH < MAIN.y + MAIN.h && f.x + HW > MAIN.x && f.x - HW < MAIN.x + MAIN.w) {
      f.x = f.x < MAIN.x + MAIN.w / 2 ? MAIN.x - HW : MAIN.x + MAIN.w + HW;
      f.vx = 0;
    }
    f.y += f.vy * dt;
    f.onGround = false;
    f.onPlat = false;
    if (f.x + HW > MAIN.x && f.x - HW < MAIN.x + MAIN.w) {
      if (f.vy >= 0 && prevY <= MAIN.y + 4 && f.y >= MAIN.y) land(f, MAIN.y, false);
      else if (f.vy < 0 && f.y - BH < MAIN.y + MAIN.h && prevY - BH >= MAIN.y + MAIN.h - 4) {
        f.y = MAIN.y + MAIN.h + BH;
        f.vy = 0;
      }
    }
    if (f.dropT <= 0)
      for (const p of PLATS)
        if (f.x > p.x && f.x < p.x + p.w && f.vy >= 0 && prevY <= p.y + 4 && f.y >= p.y) land(f, p.y, true);
  }

  function land(f: F, y: number, plat: boolean) {
    // Gros choc au sol en étant sonné : on rebondit un peu
    if (f.stun > 0 && f.vy > 900) {
      f.y = y;
      f.vy = -f.vy * 0.4;
      return;
    }
    f.y = y;
    f.vy = 0;
    f.onGround = true;
    f.onPlat = plat;
    f.jumps = 2;
    f.upUsed = false;
    if (f.move === 'spike') f.move = null;
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const f = fs.find((x) => x.pid === pid);
      if (!f) return;
      if (m.a && !f.lastA) f.jumpReq = true;
      if (m.b && !f.lastB) f.atkReq = true;
      f.lastA = m.a;
      f.lastB = m.b;
      f.inp = { x: m.x, y: m.y };
    },
    update(dt) {
      time += dt;
      flash = Math.max(0, flash - dt);
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
          sparks.push({ x: Math.max(40, Math.min(1880, f.x)), y: Math.max(40, Math.min(1040, f.y)), t: 0.8, big: true });
          sfx.pet();
          flash = 0.12;
          if (!f.bot) ctx.buzz(f.pid, 500);
          if (f.stocks <= 0) f.out = ++outCount;
          else f.respawn = 1.4;
        }
      });
      fs.forEach((f, i) => alive(f) && applyHits(f, i));
      for (const s of sparks) s.t -= dt;
      while (sparks.length && sparks[0].t <= 0) sparks.shift();
      const left = fs.filter((f) => f.stocks > 0).length;
      if (endDelay < 0 && (left <= 1 || time > MAX_TIME)) endDelay = 2.2;
      if (endDelay >= 0 && (endDelay -= dt) <= 0) game.over = true;
    },
    render(g, t) {
      const bg = g.createLinearGradient(0, 0, 0, 1080);
      bg.addColorStop(0, stage.bg[0]);
      bg.addColorStop(1, stage.bg[1]);
      g.fillStyle = bg;
      g.fillRect(0, 0, 1920, 1080);
      if (!ctx.light) {
        g.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 40; i++) {
          const x = (i * 431) % 1920;
          const y = (i * 197) % 600;
          g.fillRect(x, y, 3, 3);
        }
      }
      g.strokeStyle = INK;
      g.lineWidth = 6;
      if (stage.id === 'etagere') {
        // Étagère en bois avec des livres
        g.fillStyle = '#c98a5a';
        g.beginPath();
        g.roundRect(MAIN.x, MAIN.y, MAIN.w, MAIN.h, 18);
        g.fill();
        g.stroke();
        const books = ['#ff4f9a', '#2ec5ff', '#ffd60a', '#7b4dff', '#1fc9a0'];
        for (let k = 0; k < 14; k++) {
          g.fillStyle = books[k % books.length];
          g.fillRect(MAIN.x + 30 + k * 54, MAIN.y + 22, 40, MAIN.h - 40);
        }
        g.fillStyle = '#a0643a';
        g.fillRect(MAIN.x + 30, MAIN.y + MAIN.h, 26, 200);
        g.fillRect(MAIN.x + MAIN.w - 56, MAIN.y + MAIN.h, 26, 200);
      } else if (stage.id === 'frigo') {
        // Frigo : portes blanches, poignées, magnets
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.roundRect(MAIN.x, MAIN.y, MAIN.w, MAIN.h + 300, 30);
        g.fill();
        g.stroke();
        g.fillStyle = '#b8c6dd';
        g.fillRect(MAIN.x + MAIN.w - 60, MAIN.y + 40, 16, 120);
        for (const [mx, my, mc] of [[MAIN.x + 80, MAIN.y + 60, '#ff4f9a'], [MAIN.x + 180, MAIN.y + 110, '#ffd60a'], [MAIN.x + 300, MAIN.y + 70, '#1fc9a0']] as [number, number, string][]) {
          g.fillStyle = mc;
          g.beginPath();
          g.arc(mx, my, 20, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
      }
      if (stage.id === 'canape') {
      g.fillStyle = '#e0457b';
      g.beginPath();
      g.roundRect(MAIN.x - 60, MAIN.y - 170, MAIN.w + 120, 180, 40);
      g.fill();
      g.stroke();
      g.fillStyle = '#ff6b9a';
      g.beginPath();
      g.roundRect(MAIN.x - 90, MAIN.y - 60, 110, 200, 30);
      g.roundRect(MAIN.x + MAIN.w - 20, MAIN.y - 60, 110, 200, 30);
      g.fill();
      g.stroke();
      g.fillStyle = '#ff8fb7';
      g.beginPath();
      g.roundRect(MAIN.x, MAIN.y, MAIN.w, MAIN.h, 26);
      g.fill();
      g.stroke();
      for (let k = 1; k < 3; k++) {
        g.beginPath();
        g.moveTo(MAIN.x + (k * MAIN.w) / 3, MAIN.y + 8);
        g.lineTo(MAIN.x + (k * MAIN.w) / 3, MAIN.y + MAIN.h - 30);
        g.stroke();
      }
      g.fillStyle = '#a0643a';
      g.fillRect(MAIN.x + 40, MAIN.y + MAIN.h, 30, 60);
      g.fillRect(MAIN.x + MAIN.w - 70, MAIN.y + MAIN.h, 30, 60);
      }
      for (const p of PLATS) {
        g.fillStyle = stage.id === 'frigo' ? '#bff0e4' : stage.id === 'etagere' ? '#e8b98a' : '#ffd60a';
        g.beginPath();
        g.roundRect(p.x, p.y - 4, p.w, 34, 17);
        g.fill();
        g.stroke();
      }

      fs.forEach((f, i) => {
        if (!alive(f)) return;
        if (f.invuln > 0 && Math.floor(t * 12) % 2) g.globalAlpha = 0.5;
        g.save();
        if (f.stun > 0.15) {
          g.translate(f.x, f.y - 40);
          g.rotate(Math.sin(t * 30) * 0.5);
          g.translate(-f.x, -(f.y - 40));
        }
        drawCharacter(g, f.x, f.y, 92, {
          food: f.profile.food,
          color: f.profile.color,
          hat: f.profile.hat,
          acc: f.profile.acc,
          selfie: f.selfie,
          t: t + i,
          dir: f.dir,
          run: f.onGround ? Math.min(1, Math.abs(f.vx) / RUN) : 0.2,
          mood: f.stun > 0 ? 'wow' : 'happy',
        });
        g.restore();
        g.globalAlpha = 1;
        // Coup en cours : coussin brandi
        if (f.move) {
          const d = MOVES[f.move];
          const active = f.moveT >= d.from && f.moveT <= d.to;
          const hb = hitbox(f);
          if (f.move === 'super') {
            if (active || f.moveT > d.from - 0.1) {
              g.fillStyle = 'rgba(140,210,80,0.55)';
              g.beginPath();
              g.ellipse(hb.cx, hb.cy, (d.w / 2) * Math.min(1, f.moveT / d.to), (d.h / 2) * Math.min(1, f.moveT / d.to), 0, 0, Math.PI * 2);
              g.fill();
            }
          } else {
            g.save();
            g.translate(hb.cx, hb.cy);
            g.rotate((f.move === 'up' ? -Math.PI / 2 : f.move === 'spike' ? Math.PI / 2 : 0) + (active ? 0 : -0.6 * f.dir));
            g.fillStyle = active ? f.profile.color : 'rgba(255,255,255,0.6)';
            g.strokeStyle = INK;
            g.lineWidth = 4;
            g.beginPath();
            g.roundRect(-28, -18, 56, 36, 12);
            g.fill();
            g.stroke();
            g.restore();
          }
        }
        if (f.meter >= 100) {
          g.font = '28px sans-serif';
          g.textAlign = 'center';
          g.fillText('🌟', f.x, f.y - 112 + Math.sin(t * 6) * 4);
        }
      });
      for (const s of sparks) {
        const r = (s.big ? 90 : 40) * (1 - s.t);
        g.strokeStyle = s.big ? '#fff' : '#ffd60a';
        g.lineWidth = s.big ? 10 : 6;
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          g.beginPath();
          g.moveTo(s.x + Math.cos(a) * r * 0.4, s.y + Math.sin(a) * r * 0.4);
          g.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
          g.stroke();
        }
      }
      if (flash > 0) {
        g.fillStyle = `rgba(255,255,255,${flash * 4})`;
        g.fillRect(0, 0, 1920, 1080);
      }
      // Cartes des joueurs en bas
      const w = Math.min(230, 1840 / fs.length);
      const x0 = 960 - (w * fs.length) / 2;
      fs.forEach((f, i) => {
        const x = x0 + i * w;
        g.globalAlpha = f.stocks > 0 ? 1 : 0.4;
        g.fillStyle = 'rgba(255,255,255,0.88)';
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.beginPath();
        g.roundRect(x + 4, 930, w - 8, 130, 18);
        g.fill();
        g.stroke();
        roundRectText(g, f.profile.name, x + 12, 952, w - 24, 24, f.profile.color);
        const heat = Math.min(1, f.dmg / 150);
        g.fillStyle = `rgb(${200 + heat * 55},${Math.round(80 - heat * 60 + (1 - heat) * 120)},${Math.round(90 - heat * 70)})`;
        g.font = '700 52px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 6;
        g.strokeText(`${Math.round(f.dmg)}%`, x + w / 2, 1025);
        g.fillText(`${Math.round(f.dmg)}%`, x + w / 2, 1025);
        g.font = '28px sans-serif';
        g.fillStyle = INK;
        g.fillText('❤️'.repeat(f.stocks), x + w / 2, 1052);
        g.fillStyle = '#ddd';
        g.fillRect(x + 16, 1034, w - 32, 6);
        g.fillStyle = f.meter >= 100 ? '#7bd13b' : '#ffd60a';
        g.fillRect(x + 16, 1034, ((w - 32) * f.meter) / 100, 6);
        g.globalAlpha = 1;
      });
    },
    mapName: stage.name,
    ranking() {
      return [...fs].sort((a, b) => b.stocks - a.stocks || (b.out || 99) - (a.out || 99) || a.dmg - b.dmg || b.kos - a.kos).map((f) => f.pid);
    },
    leader() {
      const left = fs.filter((f) => f.stocks > 0);
      return left.length === 1 ? left[0].profile.name : null;
    },
  };
  return game;
}

export const clash: GameBase = {
  id: 'combat',
  emoji: '🥊',
  name: { fr: 'Coussin Clash', en: 'Cushion Clash' },
  how: {
    fr: 'A saute · B frappe (+ stick pour varier) · bas + B jauge pleine = super !',
    en: 'A jumps · B hits (+ stick to vary) · down + B with full meter = super!',
  },
  inspired: 'Smash Bros',
  layout: 'stick',
  min: 2,
  max: 8,
  botFill: 4,
  music: 'tumble',
  create,
};
