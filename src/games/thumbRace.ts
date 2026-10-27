// Course de pouces : on tapote gauche/droite le plus vite possible. Sert à valider la latence télé ↔ téléphones.
import { drawCharacter } from '../shared/characters';
import { sfx } from '../shared/sound';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { drawSky, roundRectText } from './draw';

const STEPS = 60;
const START_X = 300;
const FINISH_X = 1770;
const MAX_TIME = 45;
const AFTER_FIRST = 10;

interface R extends Runner {
  pos: number;
  disp: number;
  lastSide: -1 | 0 | 1;
  taps: number[];
  done: number; // ordre d'arrivée (0 = pas arrivé)
  botRate: number;
  botNext: number;
}

interface Puff {
  x: number;
  y: number;
  life: number;
}

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const rs: R[] = runners.map((r) => ({
    ...r,
    pos: 0,
    disp: 0,
    lastSide: -1,
    taps: [],
    done: 0,
    botRate: 5.2 + Math.random() * 2.6,
    botNext: 0.2 + Math.random() * 0.3,
  }));
  let time = 0;
  let order = 0;
  let firstAt = -1;
  let endDelay = -1;
  const puffs: Puff[] = [];

  function lane(i: number) {
    const n = rs.length;
    const h = Math.min(132, 860 / n);
    const top = 180 + (860 - n * h) / 2;
    return { y: top + i * h, h };
  }

  function step(r: R, side: 0 | 1, i: number) {
    if (r.done) return;
    r.pos += side !== r.lastSide ? 1 : 0.3;
    r.lastSide = side;
    r.taps.push(time);
    if (!ctx.light && puffs.length < 60) {
      const l = lane(i);
      puffs.push({ x: START_X + (r.disp / STEPS) * (FINISH_X - START_X) - 20, y: l.y + l.h - 10, life: 0.4 });
    }
    if (r.pos >= STEPS) {
      r.pos = STEPS;
      r.done = ++order;
      if (firstAt < 0) firstAt = time;
      sfx.finish();
      if (!r.bot) ctx.buzz(r.pid, 250);
    }
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'tap') return;
      const i = rs.findIndex((r) => r.pid === pid);
      if (i >= 0) step(rs[i], m.side, i);
    },
    update(dt) {
      time += dt;
      rs.forEach((r, i) => {
        if (r.bot && !r.done) {
          r.botNext -= dt;
          if (r.botNext <= 0) {
            step(r, r.lastSide === 0 ? 1 : 0, i);
            const stumble = Math.random() < 0.02 ? 0.5 : 0;
            r.botNext = 1 / (r.botRate * (0.8 + Math.random() * 0.4)) + stumble;
          }
        }
        r.disp += (r.pos - r.disp) * Math.min(1, dt * 12);
        while (r.taps.length && r.taps[0] < time - 0.6) r.taps.shift();
      });
      for (const p of puffs) p.life -= dt;
      while (puffs.length && puffs[0].life <= 0) puffs.shift();
      const humansDone = rs.some((r) => !r.bot) ? rs.every((r) => r.bot || r.done) : rs.every((r) => r.done);
      if (endDelay < 0 && (humansDone || time > MAX_TIME || (firstAt >= 0 && time - firstAt > AFTER_FIRST))) endDelay = 1.8;
      if (endDelay >= 0) {
        endDelay -= dt;
        if (endDelay <= 0) game.over = true;
      }
    },
    render(g, t) {
      drawSky(g, t, ctx.light);
      // Temps écoulé
      g.fillStyle = '#3a2140';
      g.font = '700 54px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillText(`${time.toFixed(1)} s`, 960, 130);

      rs.forEach((r, i) => {
        const { y, h } = lane(i);
        g.fillStyle = i % 2 ? '#ffd3e8' : '#ffe6f2';
        g.beginPath();
        g.roundRect(60, y + 4, 1800, h - 8, 18);
        g.fill();
        roundRectText(g, r.profile.name || '?', 70, y + h / 2, 210, Math.min(46, h * 0.5), r.profile.color);
        // Ligne d'arrivée en damier
        const sq = Math.max(8, (h - 8) / 6);
        for (let k = 0; k < Math.ceil((h - 8) / sq); k++)
          for (let c = 0; c < 2; c++) {
            g.fillStyle = (k + c) % 2 ? '#3a2140' : '#fff';
            g.fillRect(FINISH_X + c * sq, y + 4 + k * sq, sq, Math.min(sq, y + h - 4 - (y + 4 + k * sq)));
          }
        g.fillStyle = 'rgba(58,33,64,0.25)';
        g.fillRect(START_X - 4, y + 8, 4, h - 16);
      });

      for (const p of puffs) {
        g.fillStyle = `rgba(255,255,255,${p.life * 2})`;
        g.beginPath();
        g.arc(p.x, p.y, 14 * (1.2 - p.life), 0, Math.PI * 2);
        g.fill();
      }

      rs.forEach((r, i) => {
        const { y, h } = lane(i);
        const rate = r.taps.length / 0.6;
        const x = START_X + 20 + (r.disp / STEPS) * (FINISH_X - START_X - 40);
        drawCharacter(g, x, y + h - 10, h * 0.95, {
          food: r.profile.food,
          color: r.profile.color,
          hat: r.profile.hat,
          acc: r.profile.acc,
          selfie: r.selfie,
          t: t + i * 0.37,
          run: r.done ? 0 : Math.min(1, rate / 7),
          mood: r.done === 1 ? 'wow' : 'happy',
        });
        if (r.done) {
          g.font = `700 ${Math.max(28, Math.min(48, h * 0.45))}px Fredoka, sans-serif`;
          g.textAlign = 'left';
          g.fillStyle = r.done === 1 ? '#ff9a1f' : '#3a2140';
          g.fillText(ctx.lang === 'fr' ? (r.done === 1 ? '1er' : `${r.done}e`) : `#${r.done}`, FINISH_X + 50, y + h / 2 + 14);
        }
      });
    },
    ranking() {
      return [...rs]
        .sort((a, b) => (a.done || 99) - (b.done || 99) || b.pos - a.pos)
        .map((r) => r.pid);
    },
    leader() {
      const w = rs.find((r) => r.done === 1);
      return w ? w.profile.name : null;
    },
  };
  return game;
}

export const thumbRace: GameBase = {
  id: 'pouces',
  emoji: '👍',
  name: { fr: 'Course de pouces', en: 'Thumb Dash' },
  how: {
    fr: 'Tapote GAUCHE puis DROITE le plus vite possible !',
    en: 'Tap LEFT then RIGHT as fast as you can!',
  },
  inspired: '',
  layout: 'tap',
  min: 1,
  max: 12,
  botFill: 4,
  music: 'race',
  create,
};
