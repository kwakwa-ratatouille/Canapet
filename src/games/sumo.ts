// Sumo Tamponneur : chacun dans sa bouée sur une assiette géante qui rétrécit. On se pousse dans la limonade.
// Stick = avancer · A = turbo · B = ancre (lourd et freiné). 3 vies, le dernier debout gagne.
import { drawCharacter } from '../shared/characters';
import { sfx } from '../shared/sound';
import { roundRectText } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const R0 = 520;
const R_MIN = 280;
const SHRINK_TIME = 70;
const BODY = 46;
const ACC = 1500;
const MAX_V = 520;
const DASH = 780;
const DASH_CD = 1.4;
const LIVES = 3;
const MAX_TIME = 110;
const SX = 1.32;
const SY = 0.78;
const CX = 960;
const CY = 600;

interface S extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lives: number;
  falling: number;
  respawn: number;
  invuln: number;
  dashCd: number;
  heavy: number;
  anchor: boolean;
  inp: { x: number; y: number };
  dashReq: boolean;
  lastA: boolean;
  lastHit: { by: number; at: number } | null;
  kos: number;
  out: number;
  face: 1 | -1;
  botT: number;
  botTarget: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const n = runners.length;
  const ss: S[] = runners.map((r, i) => {
    const a = (i / n) * Math.PI * 2;
    return {
      ...r,
      x: Math.cos(a) * R0 * 0.6,
      y: Math.sin(a) * R0 * 0.6,
      vx: 0,
      vy: 0,
      lives: LIVES,
      falling: 0,
      respawn: 0,
      invuln: 1,
      dashCd: 0,
      heavy: 0,
      anchor: false,
      inp: { x: 0, y: 0 },
      dashReq: false,
      lastA: false,
      lastHit: null,
      kos: 0,
      out: 0,
      face: 1,
      botT: 0,
      botTarget: -1,
    };
  });
  let time = 0;
  let outCount = 0;
  let endDelay = -1;
  const radius = () => R0 - (R0 - R_MIN) * Math.min(1, time / SHRINK_TIME);
  const inPlay = (s: S) => s.lives > 0 && s.falling <= 0 && s.respawn <= 0;

  function bot(s: S, i: number, dt: number) {
    s.botT -= dt;
    const R = radius();
    const d = Math.hypot(s.x, s.y);
    if (s.botT <= 0) {
      s.botT = rnd(0.4, 0.9);
      // Cible : l'adversaire le plus proche du bord parmi les proches.
      let best = -1;
      let score = -1e9;
      ss.forEach((o, j) => {
        if (j === i || !inPlay(o)) return;
        const sc = Math.hypot(o.x, o.y) * 1.2 - Math.hypot(o.x - s.x, o.y - s.y);
        if (sc > score) {
          score = sc;
          best = j;
        }
      });
      s.botTarget = best;
    }
    let tx = 0;
    let ty = 0;
    if (d > R - 110) {
      tx = -s.x;
      ty = -s.y;
    } else if (s.botTarget >= 0) {
      const o = ss[s.botTarget];
      tx = o.x - s.x;
      ty = o.y - s.y;
      const dist = Math.hypot(tx, ty);
      if (dist < 230 && s.dashCd <= 0 && Math.random() < 0.05) s.dashReq = true;
    }
    const l = Math.hypot(tx, ty) || 1;
    s.inp = { x: tx / l, y: ty / l };
    s.anchor = d > R - 70 && Math.random() < 0.5;
  }

  function step(dt: number) {
    time += dt;
    const R = radius();
    ss.forEach((s, i) => {
      if (s.lives <= 0) return;
      if (s.respawn > 0) {
        s.respawn -= dt;
        if (s.respawn <= 0) {
          const a = rnd(0, Math.PI * 2);
          s.x = Math.cos(a) * 60;
          s.y = Math.sin(a) * 60;
          s.vx = s.vy = 0;
          s.invuln = 1.6;
        }
        return;
      }
      if (s.falling > 0) {
        s.falling -= dt;
        if (s.falling <= 0) {
          s.lives--;
          if (s.lastHit && time - s.lastHit.at < 4) ss[s.lastHit.by].kos++;
          s.lastHit = null;
          if (s.lives <= 0) s.out = ++outCount;
          else s.respawn = 1.6;
        }
        return;
      }
      if (s.bot) bot(s, i, dt);
      s.invuln = Math.max(0, s.invuln - dt);
      s.dashCd = Math.max(0, s.dashCd - dt);
      s.heavy = Math.max(0, s.heavy - dt);
      const il = Math.hypot(s.inp.x, s.inp.y);
      const ix = il > 0.2 ? s.inp.x / Math.max(1, il) : 0;
      const iy = il > 0.2 ? s.inp.y / Math.max(1, il) : 0;
      if (ix) s.face = ix > 0 ? 1 : -1;
      if (!s.anchor) {
        s.vx += ix * ACC * dt;
        s.vy += iy * ACC * dt;
      }
      if (s.dashReq && s.dashCd <= 0 && !s.anchor) {
        const dl = Math.hypot(ix, iy) > 0.1 ? Math.hypot(ix, iy) : 0;
        const dx = dl ? ix / dl : s.face;
        const dy = dl ? iy / dl : 0;
        s.vx += dx * DASH;
        s.vy += dy * DASH;
        s.dashCd = DASH_CD;
        s.heavy = 0.35;
        if (!ctx.light) sfx.step();
      }
      s.dashReq = false;
      const sp = Math.hypot(s.vx, s.vy);
      const max = s.heavy > 0 ? MAX_V + DASH : MAX_V;
      if (sp > max) {
        s.vx *= max / sp;
        s.vy *= max / sp;
      }
      const damp = Math.pow(s.anchor ? 0.02 : 0.3, dt);
      s.vx *= damp;
      s.vy *= damp;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (Math.hypot(s.x, s.y) > R + BODY * 0.3) {
        s.falling = 0.7;
        sfx.pet();
        if (!s.bot) ctx.buzz(s.pid, 400);
      }
    });

    // Chocs entre bouées
    for (let i = 0; i < ss.length; i++)
      for (let j = i + 1; j < ss.length; j++) {
        const a = ss[i];
        const b = ss[j];
        if (!inPlay(a) || !inPlay(b)) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= BODY * 2 || d === 0) continue;
        dx /= d;
        dy /= d;
        const ma = a.anchor ? 4 : a.heavy > 0 ? 2.2 : 1;
        const mb = b.anchor ? 4 : b.heavy > 0 ? 2.2 : 1;
        const over = BODY * 2 - d;
        a.x -= dx * over * (mb / (ma + mb));
        a.y -= dy * over * (mb / (ma + mb));
        b.x += dx * over * (ma / (ma + mb));
        b.y += dy * over * (ma / (ma + mb));
        const rel = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
        if (rel >= 0) continue;
        const j2 = (-(1 + 1.1) * rel) / (1 / ma + 1 / mb) + 90;
        if (a.invuln <= 0) {
          a.vx -= (j2 / ma) * dx;
          a.vy -= (j2 / ma) * dy;
        }
        if (b.invuln <= 0) {
          b.vx += (j2 / mb) * dx;
          b.vy += (j2 / mb) * dy;
        }
        a.lastHit = { by: j, at: time };
        b.lastHit = { by: i, at: time };
        if (-rel > 250) {
          sfx.boing();
          if (!a.bot) ctx.buzz(a.pid, 60);
          if (!b.bot) ctx.buzz(b.pid, 60);
        }
      }
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const s = ss.find((x) => x.pid === pid);
      if (!s) return;
      if (m.a && !s.lastA) s.dashReq = true;
      s.lastA = m.a;
      s.anchor = m.b;
      s.inp = { x: m.x, y: m.y };
    },
    update(dt) {
      step(dt);
      const left = ss.filter((s) => s.lives > 0).length;
      if (endDelay < 0 && (left <= 1 || time > MAX_TIME)) endDelay = 2;
      if (endDelay >= 0 && (endDelay -= dt) <= 0) game.over = true;
    },
    render(g, t) {
      // Piscine de limonade
      g.fillStyle = '#fff3a0';
      g.fillRect(0, 0, 1920, 1080);
      if (!ctx.light) {
        g.strokeStyle = 'rgba(255,200,60,0.5)';
        g.lineWidth = 6;
        for (let k = 0; k < 9; k++) {
          const y = 80 + k * 120 + Math.sin(t + k) * 10;
          g.beginPath();
          for (let x = 0; x <= 1920; x += 40) g.lineTo(x, y + Math.sin(x / 90 + t * 2 + k) * 10);
          g.stroke();
        }
      }
      // Assiette
      const R = radius();
      g.fillStyle = '#c9b8e8';
      g.beginPath();
      g.ellipse(CX, CY + 26, R * SX + 20, R * SY + 18, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(CX, CY, R * SX + 14, R * SY + 10, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#ffd1ea';
      g.beginPath();
      g.ellipse(CX, CY, R * SX - 10, R * SY - 8, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,79,154,0.35)';
      g.lineWidth = 4;
      g.beginPath();
      g.ellipse(CX, CY, R * SX * 0.55, R * SY * 0.55, 0, 0, Math.PI * 2);
      g.stroke();

      const order = ss.map((s, i) => i).sort((a, b) => ss[a].y - ss[b].y);
      for (const i of order) {
        const s = ss[i];
        if (s.lives <= 0 || s.respawn > 0) continue;
        const px = CX + s.x * SX;
        const py = CY + s.y * SY;
        const k = s.falling > 0 ? s.falling / 0.7 : 1;
        if (s.invuln > 0 && Math.floor(t * 10) % 2) g.globalAlpha = 0.5;
        g.save();
        g.translate(px, py + (1 - k) * 60);
        g.scale(k, k);
        // Bouée
        g.fillStyle = s.profile.color;
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.ellipse(0, 0, BODY * SX, BODY * SY + 6, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.beginPath();
        g.ellipse(-18, -12, 16, 6, -0.3, 0, Math.PI * 2);
        g.fill();
        if (s.anchor) {
          g.font = '34px sans-serif';
          g.textAlign = 'center';
          g.fillText('⚓', 44, 30);
        }
        drawCharacter(g, 0, 8, 96, {
          food: s.profile.food,
          color: s.profile.color,
          hat: s.profile.hat,
          acc: s.profile.acc,
          selfie: s.selfie,
          t: t + i,
          dir: s.face,
          mood: s.falling > 0 ? 'wow' : 'happy',
        });
        g.restore();
        g.globalAlpha = 1;
      }

      // Bandeau des vies
      const w = Math.min(170, 1840 / ss.length);
      ss.forEach((s, i) => {
        const x = 40 + i * w;
        g.globalAlpha = s.lives > 0 ? 1 : 0.4;
        roundRectText(g, s.profile.name, x, 40, w - 10, 26, s.profile.color);
        g.font = '28px sans-serif';
        g.textAlign = 'center';
        g.fillText('❤️'.repeat(Math.max(0, s.lives)) || '💨', x + (w - 10) / 2, 92);
        g.globalAlpha = 1;
      });
      g.fillStyle = INK;
      g.font = '700 36px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillText(fr ? 'L’assiette rétrécit !' : 'The plate is shrinking!', CX, 1050);
    },
    ranking() {
      return ss
        .map((s, i) => ({ s, i }))
        .sort((a, b) => b.s.lives - a.s.lives || (b.s.out || 99) - (a.s.out || 99) || b.s.kos - a.s.kos)
        .map((x) => x.s.pid);
    },
    leader() {
      const left = ss.filter((s) => s.lives > 0);
      return left.length === 1 ? left[0].profile.name : null;
    },
  };
  return game;
}

export const sumo: GameBase = {
  id: 'sumo',
  emoji: '🛞',
  name: { fr: 'Sumo Tamponneur', en: 'Bumper Sumo' },
  how: {
    fr: 'Stick pour rouler · A turbo · B ancre. Pousse-les dans la limonade !',
    en: 'Stick to roll · A boost · B anchor. Push them into the lemonade!',
  },
  inspired: 'auto-tamponneuses',
  layout: 'stick',
  min: 2,
  max: 12,
  botFill: 4,
  music: 'race',
  create,
};
