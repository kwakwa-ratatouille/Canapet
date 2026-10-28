// Course de pouces : les persos courent tout seuls. Bouton gauche = SAUTER les haies, bouton droit = GLISSER sous les barres.
// Mauvais bouton ou trop tard = on trébuche ; pile au bon moment = PARFAIT (petit turbo). Pas de spam : chaque geste dure un moment.
import { drawCharacter } from '../shared/characters';
import { sfx } from '../shared/sound';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { drawSky, roundRectText, candy } from './draw';
import { INK, SOLEIL } from '../shared/palette';

const TRACK = 8200;
const SPEED = 340;
const RUNNER_X = 420;
const ACT = 0.55;
const COOLDOWN = 0.22;
const MAX_TIME = 45;
const AFTER_FIRST = 8;

type Kind = 'haie' | 'barre';

interface R extends Runner {
  pos: number;
  v: number;
  jump: number;
  slide: number;
  cd: number;
  trip: number;
  boost: number;
  done: number;
  /** Dernier obstacle déjà franchi ou raté (pour ne compter chacun qu'une fois). */
  passed: number;
  combo: number;
  pop: { text: string; t: number; c: string } | null;
  botPlan: number;
  botAt: number;
  botSide: 0 | 1;
}

/** Décors : chaque course en tire un au hasard. */
const THEMES = [
  { name: { fr: 'La Plage', en: 'The Beach' }, sky: ['#7fd6ff', '#fff1c9'], lanes: ['#ffe9b8', '#fff3d1'], post: '#2ec5ff' },
  { name: { fr: 'La Neige', en: 'The Snow' }, sky: ['#bfe3ff', '#f4f9ff'], lanes: ['#ffffff', '#eef6ff'], post: '#ff4f9a' },
  { name: { fr: 'Le Parc', en: 'The Park' }, sky: ['#8fd8ff', '#ffd6ec'], lanes: ['#d9f7c4', '#e8fbd9'], post: '#9b5cff' },
  { name: { fr: 'La Nuit étoilée', en: 'The Starry Night' }, sky: ['#2a1838', '#6a4bd8'], lanes: ['#c9b6ff', '#ddd0ff'], post: '#ffd60a' },
  { name: { fr: 'Le Gâteau', en: 'The Cake' }, sky: ['#ffd6ec', '#fff1c9'], lanes: ['#fff0f7', '#ffe1ef'], post: '#1fc9a0' },
];

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  // Même parcours pour tout le monde : obstacles de plus en plus serrés
  const obs: { x: number; k: Kind }[] = [];
  for (let x = 900; x < TRACK - 400; ) {
    obs.push({ x, k: Math.random() < 0.5 ? 'haie' : 'barre' });
    const prog = x / TRACK;
    x += 640 - prog * 300 + Math.random() * 220;
  }
  const rs: R[] = runners.map((r) => ({ ...r, pos: 0, v: 0, jump: 0, slide: 0, cd: 0, trip: 0, boost: 0, done: 0, passed: -1, combo: 0, pop: null, botPlan: -1, botAt: -1, botSide: 0 }));
  let time = 0;
  let order = 0;
  let firstAt = -1;
  let endDelay = -1;

  const nextObs = (r: R) => obs.find((o, k) => k > r.passed && o.x > r.pos - 40);

  function act(r: R, side: 0 | 1) {
    if (r.done || r.trip > 0 || r.cd > 0 || r.jump > 0 || r.slide > 0) return;
    if (side === 0) r.jump = ACT;
    else r.slide = ACT;
    // Pile au bon moment ?
    const o = nextObs(r);
    if (o) {
      const d = o.x - r.pos;
      const good = (side === 0 && o.k === 'haie') || (side === 1 && o.k === 'barre');
      if (good && d > 30 && d < 120) {
        r.combo++;
        r.boost = 0.7;
        r.pop = { text: r.combo >= 3 ? (fr ? `PARFAIT ×${r.combo} !` : `PERFECT ×${r.combo}!`) : fr ? 'PARFAIT !' : 'PERFECT!', t: 0.8, c: SOLEIL };
      }
    }
    if (!r.bot) sfx.click();
  }

  const lane = (i: number) => {
    const n = rs.length;
    const h = Math.min(150, 840 / n);
    const top = 190 + (840 - n * h) / 2;
    return { y: top + i * h, h };
  };

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'tap') return;
      const r = rs.find((x) => x.pid === pid);
      if (r) act(r, m.side);
    },
    update(dt) {
      time += dt;
      for (const r of rs) {
        if (r.pop && (r.pop.t -= dt) <= 0) r.pop = null;
        if (r.done) {
          r.v *= Math.pow(0.1, dt);
          r.pos += r.v * dt;
          continue;
        }
        r.jump = Math.max(0, r.jump - dt);
        r.slide = Math.max(0, r.slide - dt);
        if (r.jump === 0 && r.slide === 0) r.cd = Math.max(0, r.cd - dt);
        if ((r.jump > 0 && r.jump - dt <= 0) || (r.slide > 0 && r.slide - dt <= 0)) r.cd = COOLDOWN;
        r.boost = Math.max(0, r.boost - dt);
        if (r.trip > 0) {
          r.trip -= dt;
          r.v = 0;
        } else {
          const want = SPEED * (r.boost > 0 ? 1.3 : 1);
          r.v += (want - r.v) * Math.min(1, dt * 3);
        }
        // Bots : ils réagissent quand l'obstacle approche (plus ou moins bien selon leur niveau)
        if (r.bot) {
          const o = nextObs(r);
          const k = o ? obs.indexOf(o) : -1;
          if (o && k !== r.botPlan && o.x - r.pos < 150) {
            r.botPlan = k;
            const skill = 0.55 + 0.4 * ctx.botSkill;
            const delay = (o.x - r.pos - (50 + Math.random() * 60)) / Math.max(1, r.v);
            const side: 0 | 1 = Math.random() < skill ? (o.k === 'haie' ? 0 : 1) : o.k === 'haie' ? 1 : 0;
            r.botAt = time + Math.max(0, delay);
            r.botSide = side;
          }
        }
        if (r.botAt >= 0 && time >= r.botAt) {
          r.botAt = -1;
          act(r, r.botSide);
        }
        r.pos += r.v * dt;
        // Obstacles franchis ou percutés
        obs.forEach((o, k) => {
          if (k <= r.passed || Math.abs(o.x - r.pos) > 26) return;
          const ok = o.k === 'haie' ? r.jump > 0.1 && r.jump < ACT - 0.05 : r.slide > 0;
          r.passed = k;
          if (ok) return;
          r.trip = 0.9;
          r.combo = 0;
          r.jump = r.slide = 0;
          r.pop = { text: fr ? 'AÏE !' : 'OUCH!', t: 0.9, c: '#ff3b3b' };
          sfx.boing();
          if (!r.bot) ctx.buzz(r.pid, 200);
        });
        if (r.pos >= TRACK) {
          r.done = ++order;
          if (firstAt < 0) firstAt = time;
          sfx.finish();
          if (!r.bot) ctx.buzz(r.pid, 250);
        }
      }
      const humansDone = rs.some((r) => !r.bot) ? rs.every((r) => r.bot || r.done) : rs.every((r) => r.done);
      if (endDelay < 0 && (humansDone || time > MAX_TIME || (firstAt >= 0 && time - firstAt > AFTER_FIRST))) endDelay = 1.8;
      if (endDelay >= 0 && (endDelay -= dt) <= 0) game.over = true;
    },
    render(g, t) {
      drawSky(g, t, ctx.light, theme.sky[0], theme.sky[1]);
      // Progression de tout le monde
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.beginPath();
      g.roundRect(360, 112, 1200, 34, 17);
      g.fill();
      g.stroke();
      g.font = '28px sans-serif';
      g.textAlign = 'center';
      g.fillText('🏁', 1590, 140);
      rs.forEach((r) => {
        g.fillStyle = r.profile.color;
        g.beginPath();
        g.arc(375 + Math.min(1, r.pos / TRACK) * 1170, 129, 14, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      });

      rs.forEach((r, i) => {
        const { y, h } = lane(i);
        const ground = y + h - 14;
        const cam = r.pos - (RUNNER_X - 60);
        g.save();
        g.beginPath();
        g.roundRect(60, y + 4, 1800, h - 8, 18);
        g.clip();
        g.fillStyle = i % 2 ? theme.lanes[0] : theme.lanes[1];
        g.fillRect(60, y + 4, 1800, h - 8);
        // Bandes au sol qui défilent
        g.fillStyle = 'rgba(58,33,64,0.08)';
        for (let x = -((cam * 1) % 120); x < 1900; x += 120) g.fillRect(60 + x, ground - 4, 60, 8);
        // Arrivée
        const fx = 60 + TRACK - cam;
        if (fx < 1900) {
          const sq = Math.max(8, (h - 8) / 6);
          for (let k = 0; k < Math.ceil((h - 8) / sq); k++)
            for (let c = 0; c < 2; c++) {
              g.fillStyle = (k + c) % 2 ? INK : '#fff';
              g.fillRect(fx + c * sq, y + 4 + k * sq, sq, sq);
            }
        }
        // Obstacles
        const s = h / 130;
        for (const o of obs) {
          const ox = 60 + o.x - cam;
          if (ox < 0 || ox > 1900) continue;
          g.strokeStyle = INK;
          g.lineWidth = 4;
          if (o.k === 'haie') {
            // Haie basse : à sauter
            g.fillStyle = '#fff';
            g.fillRect(ox - 22 * s, ground - 40 * s, 6 * s, 40 * s);
            g.fillRect(ox + 16 * s, ground - 40 * s, 6 * s, 40 * s);
            g.fillStyle = '#ff4f9a';
            g.beginPath();
            g.roundRect(ox - 30 * s, ground - 50 * s, 60 * s, 18 * s, 6);
            g.fill();
            g.stroke();
            g.fillStyle = '#fff';
            g.fillRect(ox - 10 * s, ground - 50 * s, 8 * s, 18 * s);
            g.fillRect(ox + 8 * s, ground - 50 * s, 8 * s, 18 * s);
          } else {
            // Barre haute : à passer en glissant
            g.fillStyle = theme.post;
            g.fillRect(ox - 4 * s, y + 6, 8 * s, ground - 66 * s - y);
            g.fillStyle = '#ffd60a';
            g.beginPath();
            g.roundRect(ox - 40 * s, ground - 78 * s, 80 * s, 18 * s, 8);
            g.fill();
            g.stroke();
            g.fillStyle = INK;
            g.fillRect(ox - 20 * s, ground - 78 * s, 8 * s, 18 * s);
            g.fillRect(ox + 12 * s, ground - 78 * s, 8 * s, 18 * s);
          }
          // Indice sur l'obstacle qui arrive : quel bouton
          if (o === nextObs(r) && o.x - r.pos < 500 && !r.done) {
            g.font = `700 ${Math.max(28, 34 * s)}px Fredoka, sans-serif`;
            g.textAlign = 'center';
            g.fillStyle = o.k === 'haie' ? '#ff4f9a' : '#e0a800';
            g.fillText(o.k === 'haie' ? '⬆' : '⬇', ox, y + 34 * s + 8);
          }
        }
        g.restore();
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.beginPath();
        g.roundRect(60, y + 4, 1800, h - 8, 18);
        g.stroke();
        candy(g, 60, y + 4, 1800, h - 8, 18);
        // Le coureur
        const jy = r.jump > 0 ? Math.sin(((ACT - r.jump) / ACT) * Math.PI) * 70 * s : 0;
        const x = 60 + RUNNER_X - 60 + (r.done ? r.pos - cam - (RUNNER_X - 60) : 0);
        g.save();
        g.translate(x, ground);
        if (r.slide > 0) g.scale(1.25, 0.55);
        if (r.trip > 0) g.rotate(0.9);
        drawCharacter(g, 0, -jy / (r.slide > 0 ? 0.55 : 1), h * 0.85, {
          food: r.profile.food,
          color: r.profile.color,
          hat: r.profile.hat,
          acc: r.profile.acc,
          eyes: r.profile.eyes,
          pose: r.profile.pose,
          selfie: r.selfie,
          t: t + i * 0.37,
          run: r.done || r.trip > 0 ? 0 : 1,
          mood: r.trip > 0 ? 'sad' : r.done === 1 ? 'win' : r.boost > 0 ? 'wow' : 'happy',
        });
        g.restore();
        if (r.boost > 0 && !ctx.light) {
          g.fillStyle = 'rgba(255,214,10,0.6)';
          for (let k = 0; k < 3; k++) g.fillRect(x - 60 - k * 26, ground - 30 * s - k * 10, 20, 6);
        }
        roundRectText(g, r.profile.name || '?', 70, y + 12, 200, Math.min(40, h * 0.3), r.profile.color);
        if (r.pop) {
          g.font = `700 ${Math.max(28, 40 * s)}px Fredoka, sans-serif`;
          g.textAlign = 'left';
          g.lineWidth = 7;
          g.strokeStyle = INK;
          g.strokeText(r.pop.text, x + 50, y + h * 0.45);
          g.fillStyle = r.pop.c;
          g.fillText(r.pop.text, x + 50, y + h * 0.45);
        }
        if (r.done) {
          g.font = `700 ${Math.max(28, Math.min(48, h * 0.4))}px Fredoka, sans-serif`;
          g.textAlign = 'right';
          g.fillStyle = r.done === 1 ? '#ff9a1f' : INK;
          g.fillText(fr ? (r.done === 1 ? '🏆 1er' : `${r.done}e`) : `#${r.done}`, 1840, y + h / 2 + 14);
        }
      });
      // Départ bien visible
      if (time < 1.3) {
        const k = 1 + (1.3 - time) * 0.4;
        g.save();
        g.translate(960, 560);
        g.scale(k, k);
        g.globalAlpha = Math.min(1, (1.3 - time) * 2);
        g.font = '700 200px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 22;
        g.strokeStyle = INK;
        g.strokeText(fr ? 'GO !' : 'GO!', 0, 70);
        g.fillStyle = '#1fc9a0';
        g.fillText(fr ? 'GO !' : 'GO!', 0, 70);
        g.restore();
      }
    },
    mapName: theme.name,
    ranking() {
      return [...rs].sort((a, b) => (a.done || 99) - (b.done || 99) || b.pos - a.pos).map((r) => r.pid);
    },
    leader() {
      return rs.find((r) => r.done === 1)?.profile.name ?? null;
    },
  };
  return game;
}

export const thumbRace: GameBase = {
  id: 'pouces',
  emoji: '👍',
  name: { fr: 'Course de pouces', en: 'Thumb Dash' },
  how: {
    fr: 'Ça court tout seul : ⬆ SAUTE les haies roses, ⬇ GLISSE sous les barres jaunes, pile au bon moment !',
    en: 'You run by yourself: ⬆ JUMP the pink hurdles, ⬇ SLIDE under the yellow bars, right on time!',
  },
  inspired: '',
  layout: 'tap',
  min: 1,
  max: 12,
  botFill: 4,
  music: 'race',
  limit: 45,
  create,
};
