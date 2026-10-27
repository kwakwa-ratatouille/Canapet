// Coussin Foot : petit match vu de dessus, deux équipes, un ballon-coussin et deux buts.
// Stick = courir, A = tirer (ou passer), B = sprint/tacle qui chipe le ballon.
import { drawCharacter } from '../shared/characters';
import { INK, MENTHE, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { candy, roundRectText } from './draw';
import { TEAMS } from './teams';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';

const F = { x: 140, y: 170, w: 1640, h: 820 };
const GOAL = 260;
const R = 30;
const BALL_R = 22;
const RUN = 390;
const KICK = 1150;
const MAX_TIME = 180;

interface P extends Runner {
  side: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  fx: number;
  fy: number;
  inp: { x: number; y: number };
  kickReq: boolean;
  dash: number;
  dashCd: number;
  stun: number;
  goals: number;
  lastA: boolean;
  lastB: boolean;
  botT: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  // Équipes : celles du mode équipes, sinon un sur deux
  const ps: P[] = runners.map((r, i) => ({
    ...r,
    side: (r.team ?? i % 2) as 0 | 1,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    dir: 1,
    fx: 1,
    fy: 0,
    inp: { x: 0, y: 0 },
    kickReq: false,
    dash: 0,
    dashCd: 0,
    stun: 0,
    goals: 0,
    lastA: false,
    lastB: false,
    botT: 0,
  }));
  if (ps.every((p) => p.side === ps[0].side) && ps.length > 1) ps.forEach((p, i) => (p.side = (i % 2) as 0 | 1));
  const score: [number, number] = [0, 0];
  const ball = { x: 960, y: 580, vx: 0, vy: 0, spin: 0 };
  let time = 0;
  let pause = 2;
  let banner = fr ? 'Coup d’envoi !' : 'Kick-off!';
  let endDelay = -1;
  let lastTouch: P | null = null;
  let shake = 0;
  const parts: { x: number; y: number; vx: number; vy: number; t: number; c: string }[] = [];

  function kickoff() {
    ball.x = F.x + F.w / 2;
    ball.y = F.y + F.h / 2;
    ball.vx = ball.vy = 0;
    for (const side of [0, 1] as const) {
      const team = ps.filter((p) => p.side === side);
      team.forEach((p, k) => {
        const col = Math.floor(k / 3);
        const row = k % 3;
        const dx = 200 + col * 200;
        p.x = F.x + F.w / 2 + (side === 0 ? -dx : dx);
        p.y = F.y + F.h * (0.25 + row * 0.25);
        p.vx = p.vy = 0;
        p.dir = side === 0 ? 1 : -1;
        p.fx = p.dir;
        p.fy = 0;
      });
    }
    pause = 1.8;
  }
  kickoff();

  const goalTop = F.y + F.h / 2 - GOAL / 2;
  const goalBot = F.y + F.h / 2 + GOAL / 2;

  function kick(p: P) {
    const d = Math.hypot(ball.x - p.x, ball.y - p.y);
    if (d > R + BALL_R + 26) return;
    let kx = p.fx;
    let ky = p.fy;
    const l = Math.hypot(kx, ky) || 1;
    kx /= l;
    ky /= l;
    ball.vx = kx * KICK + p.vx * 0.3;
    ball.vy = ky * KICK + p.vy * 0.3;
    lastTouch = p;
    sfx.boing();
    if (!p.bot) ctx.buzz(p.pid, 40);
  }

  function bot(p: P, dt: number) {
    p.botT -= dt;
    const mates = ps.filter((o) => o.side === p.side);
    const chaser = mates.sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y))[0];
    const goalX = p.side === 0 ? F.x + F.w : F.x;
    let tx: number;
    let ty: number;
    if (chaser === p) {
      // Se placer derrière le ballon, côté de son propre but, puis pousser vers le but adverse
      const gx = goalX - ball.x;
      const gy = F.y + F.h / 2 - ball.y;
      const gl = Math.hypot(gx, gy) || 1;
      tx = ball.x - (gx / gl) * 40;
      ty = ball.y - (gy / gl) * 40;
      if (Math.hypot(ball.x - p.x, ball.y - p.y) < R + BALL_R + 20) {
        p.fx = gx / gl;
        p.fy = gy / gl;
        if (p.botT <= 0) {
          p.kickReq = true;
          p.botT = rnd(0.3, 0.8);
        }
      }
    } else {
      // Les autres gardent leur poste
      const home = p.side === 0 ? F.x + F.w * 0.3 : F.x + F.w * 0.7;
      tx = home + (ball.x - (F.x + F.w / 2)) * 0.4;
      ty = F.y + F.h * (0.3 + (mates.indexOf(p) % 3) * 0.2);
    }
    const dx = tx - p.x;
    const dy = ty - p.y;
    const l = Math.hypot(dx, dy);
    p.inp = l > 12 ? { x: dx / l, y: dy / l } : { x: 0, y: 0 };
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const p = ps.find((x) => x.pid === pid);
      if (!p) return;
      if (m.a && !p.lastA) p.kickReq = true;
      if (m.b && !p.lastB && p.dashCd <= 0) {
        p.dash = 0.25;
        p.dashCd = 1.3;
      }
      p.lastA = m.a;
      p.lastB = m.b;
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
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) {
          if (endDelay >= 0) game.over = true;
          banner = '';
        }
        return;
      }
      for (const p of ps) {
        if (p.bot) bot(p, dt);
        p.dash = Math.max(0, p.dash - dt);
        p.dashCd = Math.max(0, p.dashCd - dt);
        p.stun = Math.max(0, p.stun - dt);
        const mag = Math.min(1, Math.hypot(p.inp.x, p.inp.y));
        if (mag > 0.2) {
          p.fx = p.inp.x;
          p.fy = p.inp.y;
          if (Math.abs(p.inp.x) > 0.2) p.dir = p.inp.x > 0 ? 1 : -1;
        }
        const sp = p.stun > 0 ? 0 : RUN * (p.dash > 0 ? 2.1 : 1);
        const tvx = mag > 0.2 ? (p.inp.x / Math.max(mag, 1)) * sp : 0;
        const tvy = mag > 0.2 ? (p.inp.y / Math.max(mag, 1)) * sp : 0;
        const k = Math.min(1, dt * 10);
        p.vx += (tvx - p.vx) * k;
        p.vy += (tvy - p.vy) * k;
        p.x = Math.max(F.x + R, Math.min(F.x + F.w - R, p.x + p.vx * dt));
        p.y = Math.max(F.y + R, Math.min(F.y + F.h - R, p.y + p.vy * dt));
        if (p.kickReq) kick(p);
        p.kickReq = false;
        // Le ballon colle un peu au pied quand on court dessus
        const d = Math.hypot(ball.x - p.x, ball.y - p.y);
        if (d < R + BALL_R) {
          const nx = (ball.x - p.x) / (d || 1);
          const ny = (ball.y - p.y) / (d || 1);
          ball.x = p.x + nx * (R + BALL_R);
          ball.y = p.y + ny * (R + BALL_R);
          ball.vx += nx * 120 + p.vx * 0.15;
          ball.vy += ny * 120 + p.vy * 0.15;
          lastTouch = p;
        }
      }
      // Tacles et bousculades
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
            for (const [x, y] of [[a, b], [b, a]] as [P, P][])
              if (x.dash > 0 && x.side !== y.side && y.stun <= 0) {
                y.stun = 0.7;
                y.vx = (dx / d) * (x === a ? 500 : -500);
                y.vy = (dy / d) * (x === a ? 500 : -500);
                sfx.boing();
                shake = 6;
              }
          }
        }
      // Ballon
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      const fric = Math.pow(0.45, dt);
      ball.vx *= fric;
      ball.vy *= fric;
      ball.spin += Math.hypot(ball.vx, ball.vy) * dt * 0.02;
      if (ball.y < F.y + BALL_R) {
        ball.y = F.y + BALL_R;
        ball.vy = Math.abs(ball.vy) * 0.8;
      }
      if (ball.y > F.y + F.h - BALL_R) {
        ball.y = F.y + F.h - BALL_R;
        ball.vy = -Math.abs(ball.vy) * 0.8;
      }
      const inMouth = ball.y > goalTop && ball.y < goalBot;
      for (const side of [0, 1] as const) {
        const edge = side === 0 ? F.x : F.x + F.w;
        const past = side === 0 ? ball.x < edge : ball.x > edge;
        if (!past) continue;
        if (inMouth && Math.abs(ball.x - edge) > BALL_R) {
          // BUT ! Le côté 0 défend à gauche
          const scorer = side === 0 ? 1 : 0;
          score[scorer]++;
          if (lastTouch && lastTouch.side === scorer) lastTouch.goals++;
          const tn = TEAMS[scorer].name[ctx.lang];
          banner = fr ? `BUUUT ! ${tn}` : `GOAL! ${tn}`;
          speak(fr ? 'But !' : 'Goal!', ctx.lang);
          sfx.win();
          shake = 14;
          for (let k = 0; k < 40; k++)
            parts.push({ x: edge, y: ball.y, vx: rnd(-500, 500), vy: rnd(-700, -100), t: rnd(0.6, 1.2), c: [ROSE, SOLEIL, MENTHE, '#2ec5ff'][k % 4] });
          ps.forEach((p) => !p.bot && ctx.buzz(p.pid, p.side === scorer ? 200 : 60));
          kickoff();
          pause = 2.4;
          break;
        } else if (!inMouth) {
          ball.x = side === 0 ? edge + BALL_R : edge - BALL_R;
          ball.vx = -ball.vx * 0.8;
        }
      }
      if (time > MAX_TIME && endDelay < 0) {
        endDelay = 0;
        banner = score[0] === score[1] ? (fr ? 'Match nul !' : 'Draw!') : `${TEAMS[score[0] > score[1] ? 0 : 1].name[ctx.lang]} ${fr ? 'gagne !' : 'wins!'}`;
        pause = 3;
      }
    },
    render(g, t) {
      g.save();
      if (shake) g.translate(rnd(-shake, shake), rnd(-shake, shake));
      g.fillStyle = '#ffe3f1';
      g.fillRect(0, 0, 1920, 1080);
      // Pelouse en bandes bonbon
      for (let i = 0; i < 10; i++) {
        g.fillStyle = i % 2 ? '#7bd13b' : '#8fe04a';
        g.fillRect(F.x + (i * F.w) / 10, F.y, F.w / 10 + 1, F.h);
      }
      candy(g, F.x, F.y, F.w, F.h, 30);
      g.strokeStyle = '#fff';
      g.lineWidth = 8;
      g.strokeRect(F.x + 10, F.y + 10, F.w - 20, F.h - 20);
      g.beginPath();
      g.moveTo(F.x + F.w / 2, F.y + 10);
      g.lineTo(F.x + F.w / 2, F.y + F.h - 10);
      g.stroke();
      g.beginPath();
      g.arc(F.x + F.w / 2, F.y + F.h / 2, 120, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.strokeRect(F.x, F.y, F.w, F.h);
      // Buts aux couleurs des équipes
      for (const side of [0, 1] as const) {
        const x = side === 0 ? F.x - 70 : F.x + F.w;
        g.fillStyle = TEAMS[side].color;
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(x, goalTop, 70, GOAL, 14);
        g.fill();
        candy(g, x, goalTop, 70, GOAL, 14);
        g.beginPath();
        g.roundRect(x, goalTop, 70, GOAL, 14);
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.6)';
        g.lineWidth = 3;
        for (let k = 1; k < 6; k++) {
          g.beginPath();
          g.moveTo(x + 6, goalTop + (k * GOAL) / 6);
          g.lineTo(x + 64, goalTop + (k * GOAL) / 6);
          g.stroke();
        }
      }
      // Joueurs (triés par y pour la profondeur)
      const order = [...ps].sort((a, b) => a.y - b.y);
      for (const p of order) {
        g.fillStyle = TEAMS[p.side].color;
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.ellipse(p.x, p.y + 4, 34, 11, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        drawCharacter(g, p.x, p.y, 84, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          selfie: p.selfie,
          t: t + p.x * 0.001,
          dir: p.dir,
          run: Math.min(1, Math.hypot(p.vx, p.vy) / RUN),
          mood: p.stun > 0 ? 'wow' : 'happy',
        });
        g.font = '700 28px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 6;
        g.strokeStyle = INK;
        g.strokeText(p.profile.name, p.x, p.y - 104);
        g.fillStyle = TEAMS[p.side].color;
        g.fillText(p.profile.name, p.x, p.y - 104);
      }
      // Ballon-coussin
      g.fillStyle = 'rgba(58,33,64,0.2)';
      g.beginPath();
      g.ellipse(ball.x, ball.y + BALL_R, BALL_R, 7, 0, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.translate(ball.x, ball.y);
      g.rotate(ball.spin);
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(0, 0, BALL_R, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = ROSE;
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.arc(Math.cos((k * Math.PI * 2) / 5) * 11, Math.sin((k * Math.PI * 2) / 5) * 11, 5, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      for (const q of parts) {
        g.globalAlpha = Math.min(1, q.t * 2);
        g.fillStyle = q.c;
        g.fillRect(q.x - 6, q.y - 4, 12, 8);
      }
      g.globalAlpha = 1;
      g.restore();
      // Tableau des scores
      g.fillStyle = INK;
      g.beginPath();
      g.roundRect(700, 28, 520, 100, 50);
      g.fill();
      for (const side of [0, 1] as const) {
        roundRectText(g, `${TEAMS[side].emoji} ${score[side]}`, side === 0 ? 720 : 970, 76, 230, 40, TEAMS[side].color);
      }
      if (banner) {
        g.font = '700 110px Fredoka, sans-serif';
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
      const win = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
      return [...ps].sort((a, b) => Number(b.side === win) - Number(a.side === win) || b.goals - a.goals).map((p) => p.pid);
    },
    leader() {
      return null;
    },
  };
  return game;
}

export const foot: GameBase = {
  id: 'foot',
  emoji: '⚽',
  name: { fr: 'Coussin Foot', en: 'Cushion Soccer' },
  how: {
    fr: 'Stick pour courir · A pour tirer · B pour sprinter et tacler. Marque dans le but adverse !',
    en: 'Stick to run · A to shoot · B to sprint and tackle. Score in the other goal!',
  },
  inspired: 'Foot en salle',
  layout: 'stick',
  min: 2,
  max: 12,
  botFill: 4,
  music: 'race',
  limit: 150,
  create,
};
