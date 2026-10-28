// Réflexes Éclair : une suite d'épreuves de 10 secondes, toutes différentes.
// Attendre le vert, trouver l'intrus, compter, la couleur piège, marteler, stopper la jauge…
import { dozing } from './botSkill';
import { drawCharacter } from '../shared/characters';
import { INK, MENTHE, ROSE, SOLEIL, VIOLET } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { candy, roundRectText } from './draw';
import type { ReflexPadData } from './reflexShared';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';

type Kind = 'vert' | 'intrus' | 'compte' | 'couleur' | 'marteau' | 'jauge' | 'calcul' | 'plus';
const KINDS: Kind[] = ['vert', 'intrus', 'compte', 'couleur', 'marteau', 'jauge', 'calcul', 'plus'];
const FRUITS = ['🍓', '🍋', '🍇', '🍑'];
const ROUNDS = 7;
const POINTS = [5, 3, 2, 1];
const COLS = [
  { fr: 'ROUGE', en: 'RED', c: '#ff3b3b' },
  { fr: 'BLEU', en: 'BLUE', c: '#3a6bff' },
  { fr: 'VERT', en: 'GREEN', c: '#1fc9a0' },
  { fr: 'JAUNE', en: 'YELLOW', c: '#ffd60a' },
];
const QUAD = [ROSE, VIOLET, MENTHE, SOLEIL];
const EMOJI = [['🍩', '🍪'], ['🐱', '🐯'], ['🍓', '🍒'], ['😀', '😃'], ['🌝', '🌚'], ['🍋', '🍊'], ['🐸', '🐢'], ['⚽', '🏀']];

interface Pl extends Runner {
  score: number;
  answer: number;
  at: number;
  taps: number;
  out: boolean;
  gain: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls: Pl[] = runners.map((r) => ({ ...r, score: 0, answer: -1, at: 0, taps: 0, out: false, gain: 0 }));
  const order = [...KINDS].sort(() => Math.random() - 0.5);
  const plan: Kind[] = Array.from({ length: ROUNDS }, (_, i) => order[i % order.length]);
  let round = -1;
  let kind: Kind = plan[0];
  let phase: 'intro' | 'play' | 'result' | 'end' = 'intro';
  let timer = 0;
  let t0 = 0; // temps de jeu de l'épreuve
  let goAt = 0; // vert : moment où ça passe au vert
  let correct = 0;
  let quad: { e: [string, string]; odd: number; pos: number[] } = { e: ['', ''], odd: 0, pos: [] };
  let count = 0;
  let countOpts: number[] = [];
  let word = 0;
  let ink = 0;
  let gauge = 0;
  let target = 0.7;
  let headline = '';
  let calc = { a: 0, b: 0, opts: [] as number[] };
  let crowd: number[] = [];

  const titles: Record<Kind, [string, string]> = {
    vert: ['Attends le VERT… puis tape !', 'Wait for GREEN… then tap!'],
    intrus: ['Trouve le coin avec l’intrus !', 'Find the corner with the odd one!'],
    compte: ['Combien y en a-t-il ?', 'How many are there?'],
    couleur: ['Touche la COULEUR du mot (pas ce qui est écrit !)', 'Tap the word’s COLOR (not what it says!)'],
    marteau: ['Martèle le bouton !', 'Mash the button!'],
    jauge: ['Arrête la jauge sur la ligne !', 'Stop the bar on the line!'],
    calcul: ['Calcul éclair !', 'Quick maths!'],
    plus: ['Lequel est le plus nombreux ?', 'Which one is the most?'],
  };

  function next() {
    round++;
    if (round >= ROUNDS) {
      phase = 'end';
      timer = 5;
      const best = [...pls].sort((a, b) => b.score - a.score)[0];
      headline = fr ? `${best.profile.name} a les meilleurs réflexes !` : `${best.profile.name} has the best reflexes!`;
      speak(headline, ctx.lang);
      sfx.win();
      ctx.refresh();
      return;
    }
    kind = plan[round];
    pls.forEach((p) => {
      p.answer = -1;
      p.at = 0;
      p.taps = 0;
      p.out = false;
      p.gain = 0;
    });
    headline = titles[kind][fr ? 0 : 1];
    phase = 'intro';
    timer = 2.2;
    speak(headline, ctx.lang);
    // Préparer l'épreuve
    if (kind === 'vert') goAt = rnd(1.5, 4.5);
    if (kind === 'intrus') {
      const e = EMOJI[Math.floor(Math.random() * EMOJI.length)] as [string, string];
      const odd = Math.floor(Math.random() * 4);
      const pos = Array.from({ length: 4 * 9 }, () => 0);
      pos[odd * 9 + Math.floor(Math.random() * 9)] = 1;
      quad = { e, odd, pos };
      correct = odd;
    }
    if (kind === 'compte') {
      count = 5 + Math.floor(Math.random() * 9);
      const set = new Set([count]);
      while (set.size < 4) set.add(Math.max(2, count + Math.floor(rnd(-4, 5))));
      countOpts = [...set].sort(() => Math.random() - 0.5);
      correct = countOpts.indexOf(count);
    }
    if (kind === 'couleur') {
      word = Math.floor(Math.random() * 4);
      ink = (word + 1 + Math.floor(Math.random() * 3)) % 4;
      correct = ink;
    }
    if (kind === 'calcul') {
      const a = 3 + Math.floor(Math.random() * 17);
      const b = 2 + Math.floor(Math.random() * 12);
      const set = new Set([a + b]);
      while (set.size < 4) set.add(a + b + Math.floor(rnd(-5, 6)));
      const opts = [...set].sort(() => Math.random() - 0.5);
      calc = { a, b, opts };
      correct = opts.indexOf(a + b);
    }
    if (kind === 'plus') {
      // 4 fruits, l’un un peu plus nombreux que les autres
      const win = Math.floor(Math.random() * 4);
      crowd = [];
      for (let f = 0; f < 4; f++) for (let k = 0; k < (f === win ? 8 : 4 + Math.floor(Math.random() * 3)); k++) crowd.push(f);
      crowd.sort(() => Math.random() - 0.5);
      correct = win;
    }
    if (kind === 'jauge') {
      gauge = 0;
      target = rnd(0.45, 0.85);
    }
    ctx.refresh();
  }

  function finish() {
    // Classement de l'épreuve
    let ranked: Pl[] = [];
    if (kind === 'marteau') ranked = [...pls].filter((p) => p.taps > 0).sort((a, b) => b.taps - a.taps);
    else if (kind === 'jauge') ranked = [...pls].filter((p) => p.answer >= 0).sort((a, b) => Math.abs(a.answer / 1000 - target) - Math.abs(b.answer / 1000 - target));
    else if (kind === 'vert') ranked = [...pls].filter((p) => !p.out && p.answer >= 0).sort((a, b) => a.at - b.at);
    else ranked = [...pls].filter((p) => p.answer === correct).sort((a, b) => a.at - b.at);
    ranked.forEach((p, i) => {
      p.gain = POINTS[i] ?? 1;
      p.score += p.gain;
      if (!p.bot) ctx.buzz(p.pid, 80);
    });
    const w = ranked[0];
    headline = w ? (fr ? `${w.profile.name} est le plus rapide !` : `${w.profile.name} is the fastest!`) : fr ? 'Personne ! 😅' : 'Nobody! 😅';
    sfx.win();
    phase = 'result';
    timer = 3;
    ctx.refresh();
  }

  function bots(dt: number) {
    for (const p of pls) {
      if (!p.bot || dozing(p, ctx.botSkill, dt)) continue;
      if (kind === 'marteau' && Math.random() < dt * rnd(4, 9)) p.taps++;
      if (p.answer >= 0 || p.out) continue;
      if (kind === 'vert' && t0 > goAt + rnd(0.3, 0.6) && Math.random() < 0.1) {
        p.answer = 0;
        p.at = t0 - goAt;
      }
      if ((kind === 'intrus' || kind === 'compte' || kind === 'couleur' || kind === 'calcul' || kind === 'plus') && t0 > rnd(1.5, 5) && Math.random() < 0.05) {
        p.answer = Math.random() < 0.6 ? correct : Math.floor(Math.random() * 4);
        p.at = t0;
      }
      if (kind === 'jauge' && gauge > target - 0.12 && Math.random() < 0.08) p.answer = Math.round(gauge * 1000);
    }
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || phase !== 'play') return;
      const p = pls.find((x) => x.pid === pid);
      if (!p || p.out) return;
      if (m.a === 'tap') {
        if (kind === 'marteau') {
          p.taps++;
          return;
        }
        if (kind === 'vert') {
          if (p.answer >= 0) return;
          if (t0 < goAt) {
            // Trop tôt : piégé !
            p.out = true;
            sfx.pet();
            ctx.buzz(pid, 300);
          } else {
            p.answer = 0;
            p.at = t0 - goAt;
            sfx.click();
          }
          ctx.refresh();
          return;
        }
        if (kind === 'jauge' && p.answer < 0) {
          p.answer = Math.round(gauge * 1000);
          sfx.click();
          ctx.refresh();
        }
      }
      if (m.a === 'pick' && p.answer < 0) {
        p.answer = m.n?.[0] ?? -1;
        p.at = t0;
        sfx.click();
        ctx.refresh();
      }
    },
    update(dt) {
      timer -= dt;
      if (phase === 'intro') {
        if (timer <= 0) {
          phase = 'play';
          t0 = 0;
          timer = kind === 'marteau' ? 5 : kind === 'vert' ? goAt + 3 : kind === 'jauge' ? 6 : 8;
          sfx.go();
          ctx.refresh();
        }
        return;
      }
      if (phase === 'play') {
        t0 += dt;
        if (kind === 'jauge') gauge = Math.min(1, gauge + dt / 4.5);
        if (kind === 'vert' && t0 >= goAt && t0 - dt < goAt) {
          sfx.go();
          ctx.refresh();
        }
        bots(dt);
        const humans = pls.filter((p) => !p.bot);
        const allDone = kind !== 'marteau' && pls.every((p) => p.answer >= 0 || p.out);
        if (timer <= 0 || (allDone && humans.length)) finish();
        return;
      }
      if (phase === 'result' && timer <= 0) next();
      if (phase === 'end' && timer <= 0) game.over = true;
    },
    render(g, t) {
      const green = kind === 'vert' && phase === 'play' && t0 >= goAt;
      g.fillStyle = kind === 'vert' && phase === 'play' ? (green ? '#1fc9a0' : '#ff3b3b') : '#ffe3f1';
      g.fillRect(0, 0, 1920, 1080);
      g.textAlign = 'center';
      g.fillStyle = INK;
      g.font = '700 34px Fredoka, sans-serif';
      if (phase !== 'end') g.fillText(`${fr ? 'Épreuve' : 'Round'} ${round + 1} / ${ROUNDS}`, 960, 60);
      g.font = '700 64px Fredoka, sans-serif';
      g.fillText(headline, 960, 140);
      const showPlay = phase === 'play' || phase === 'result';
      if (showPlay && kind === 'vert') {
        g.font = '700 220px Fredoka, sans-serif';
        g.fillStyle = '#fff';
        g.fillText(green ? (fr ? 'TAPE !' : 'TAP!') : '…', 960, 560);
      }
      if (showPlay && kind === 'intrus') {
        // 4 coins colorés, chacun 3×3 dessins ; un seul intrus
        quad.pos.forEach((v, i) => {
          const q = Math.floor(i / 9);
          const k = i % 9;
          const qx = 420 + (q % 2) * 560;
          const qy = 200 + Math.floor(q / 2) * 380;
          if (k === 0) {
            g.fillStyle = QUAD[q];
            g.strokeStyle = INK;
            g.lineWidth = 6;
            g.beginPath();
            g.roundRect(qx, qy, 520, 350, 30);
            g.fill();
            candy(g, qx, qy, 520, 350, 30);
            g.beginPath();
            g.roundRect(qx, qy, 520, 350, 30);
            g.stroke();
          }
          g.font = '80px sans-serif';
          g.fillText(quad.e[v], qx + 100 + (k % 3) * 160, qy + 110 + Math.floor(k / 3) * 105);
        });
      }
      if (showPlay && kind === 'compte') {
        // Les objets ne s'affichent que 2 secondes
        if (phase === 'result' || t0 < 2) {
          g.font = '96px sans-serif';
          for (let i = 0; i < count; i++) g.fillText('🍬', 300 + ((i * 397) % 1300), 330 + ((i * 211) % 520));
        } else {
          g.font = '700 90px Fredoka, sans-serif';
          g.fillText('?', 960, 560);
        }
        if (phase === 'result') {
          g.font = '700 80px Fredoka, sans-serif';
          g.fillText(`= ${count}`, 960, 980);
        }
      }
      if (showPlay && kind === 'couleur') {
        g.font = '700 260px Fredoka, sans-serif';
        g.lineWidth = 16;
        g.strokeStyle = INK;
        g.strokeText(COLS[word][fr ? 'fr' : 'en'], 960, 620);
        g.fillStyle = COLS[ink].c;
        g.fillText(COLS[word][fr ? 'fr' : 'en'], 960, 620);
      }
      if (showPlay && kind === 'calcul') {
        g.font = '700 220px Fredoka, sans-serif';
        g.fillStyle = INK;
        g.fillText(`${calc.a} + ${calc.b}`, 960, 600);
        if (phase === 'result') {
          g.font = '700 90px Fredoka, sans-serif';
          g.fillText(`= ${calc.a + calc.b}`, 960, 760);
        }
      }
      if (showPlay && kind === 'plus') {
        if (phase === 'result' || t0 < 2.5) {
          g.font = '80px sans-serif';
          crowd.forEach((f, i) => g.fillText(FRUITS[f], 260 + ((i * 397) % 1400), 300 + ((i * 211) % 520)));
        } else {
          g.font = '700 90px Fredoka, sans-serif';
          g.fillText('?', 960, 560);
        }
      }
      if (showPlay && kind === 'marteau') {
        g.font = '700 180px Fredoka, sans-serif';
        g.fillText(phase === 'play' ? `${Math.ceil(Math.max(0, timer))}` : '🔨', 960, 560);
      }
      if (showPlay && kind === 'jauge') {
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 8;
        g.beginPath();
        g.roundRect(360, 420, 1200, 120, 60);
        g.fill();
        g.stroke();
        g.fillStyle = ROSE;
        g.beginPath();
        g.roundRect(360, 420, Math.max(60, 1200 * gauge), 120, 60);
        g.fill();
        g.fillStyle = INK;
        g.fillRect(360 + 1200 * target - 6, 390, 12, 180);
        // Les arrêts des joueurs
        pls.forEach((p) => {
          if (p.answer < 0) return;
          g.fillStyle = p.profile.color;
          g.beginPath();
          g.arc(360 + 1200 * (p.answer / 1000), 600, 16, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        });
      }
      // Joueurs en bas
      const cw = Math.min(200, 1800 / pls.length);
      pls.forEach((p, i) => {
        const x = 960 + (i - (pls.length - 1) / 2) * cw;
        drawCharacter(g, x, 1000, 90, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          mood: p.out ? 'sad' : phase === 'result' && p.gain ? 'win' : p.answer >= 0 || p.taps ? 'wow' : 'happy',
        });
        roundRectText(g, `${p.profile.name} · ${p.score}`, x - cw / 2 + 6, 1030, cw - 12, 22, p.profile.color);
        g.font = '700 40px Fredoka, sans-serif';
        if (kind === 'marteau' && phase !== 'intro') {
          g.fillStyle = INK;
          g.fillText(`${p.taps}`, x, 880);
        } else if (p.out) g.fillText('💥', x, 880);
        else if (phase === 'result' && p.gain) {
          g.fillStyle = SOLEIL;
          g.lineWidth = 8;
          g.strokeStyle = INK;
          g.strokeText(`+${p.gain}`, x, 880);
          g.fillText(`+${p.gain}`, x, 880);
        } else if (p.answer >= 0) {
          g.fillStyle = MENTHE;
          g.fillText('✓', x, 880);
        }
      });
    },
    ranking() {
      return [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid);
    },
    leader() {
      return null;
    },
    padData(pid): ReflexPadData {
      const p = pls.find((x) => x.pid === pid)!;
      const play = phase === 'play';
      let k: ReflexPadData['kind'] = 'wait';
      let options: ReflexPadData['options'] = [];
      if (play && (kind === 'vert' || kind === 'jauge')) k = 'buzz';
      if (play && kind === 'marteau') k = 'mash';
      if (play && kind === 'intrus') {
        k = 'choice';
        options = QUAD.map((c, i) => ({ label: fr ? ['Haut gauche', 'Haut droite', 'Bas gauche', 'Bas droite'][i] : ['Top left', 'Top right', 'Bottom left', 'Bottom right'][i], color: c }));
      }
      if (play && kind === 'compte') {
        k = 'choice';
        options = countOpts.map((n, i) => ({ label: String(n), color: QUAD[i] }));
      }
      if (play && kind === 'calcul') {
        k = 'choice';
        options = calc.opts.map((n, i) => ({ label: String(n), color: QUAD[i] }));
      }
      if (play && kind === 'plus') {
        k = 'choice';
        options = FRUITS.map((e, i) => ({ label: e, color: QUAD[i] }));
      }
      if (play && kind === 'couleur') {
        k = 'choice';
        options = COLS.map((c) => ({ label: c[fr ? 'fr' : 'en'], color: c.c }));
      }
      return {
        kind: k,
        title: headline,
        options,
        locked: p.out || (kind !== 'marteau' && p.answer >= 0),
        note: p.out ? (fr ? 'Trop tôt ! Piégé 💥' : 'Too early! Gotcha 💥') : '',
        score: p.score,
      };
    },
  };
  next();
  return game;
}

export const reflex: GameBase = {
  id: 'reflexes',
  emoji: '⚡',
  name: { fr: 'Réflexes Éclair', en: 'Lightning Reflexes' },
  how: {
    fr: '7 épreuves éclair : attends le vert, trouve l’intrus, compte, couleur piège, martèle, stoppe la jauge !',
    en: '7 lightning rounds: wait for green, find the odd one, count, tricky color, mash, stop the bar!',
  },
  inspired: 'WarioWare',
  layout: 'buttons',
  min: 1,
  max: 12,
  botFill: 3,
  music: 'race',
  limit: 150,
  create,
};
