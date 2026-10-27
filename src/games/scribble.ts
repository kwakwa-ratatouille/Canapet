// Gribouillis : un joueur dessine sur son téléphone un mot secret, le dessin s'affiche en direct sur la télé,
// les autres tapent leurs propositions. Plus on trouve vite, plus on marque.
import { drawCharacter } from '../shared/characters';
import { sfx, speak } from '../shared/sound';
import { roundRectText } from './draw';
import { INK_COLORS, norm, type ScribblePadData } from './scribbleShared';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const DRAW_TIME = 70;
const MAX_TURNS = 8;

const WORDS: [string, string][] = [
  ['banane', 'banana'], ['pizza', 'pizza'], ['fantôme', 'ghost'], ['dragon', 'dragon'], ['vélo', 'bike'],
  ['château', 'castle'], ['requin', 'shark'], ['fusée', 'rocket'], ['parapluie', 'umbrella'], ['pingouin', 'penguin'],
  ['volcan', 'volcano'], ['sirène', 'mermaid'], ['licorne', 'unicorn'], ['escargot', 'snail'], ['bonhomme de neige', 'snowman'],
  ['toilettes', 'toilet'], ['dentiste', 'dentist'], ['chaussette', 'sock'], ['pirate', 'pirate'], ['robot', 'robot'],
  ['arc-en-ciel', 'rainbow'], ['girafe', 'giraffe'], ['hamburger', 'hamburger'], ['canapé', 'couch'], ['télécommande', 'remote'],
  ['moustache', 'moustache'], ['cactus', 'cactus'], ['araignée', 'spider'], ['tracteur', 'tractor'], ['sous-marin', 'submarine'],
  ['vampire', 'vampire'], ['crocodile', 'crocodile'], ['éléphant', 'elephant'], ['hélicoptère', 'helicopter'], ['guitare', 'guitar'],
  ['papillon', 'butterfly'], ['tortue', 'turtle'], ['soleil', 'sun'], ['lunettes', 'glasses'], ['frigo', 'fridge'],
  ['ninja', 'ninja'], ['dinosaure', 'dinosaur'], ['sapin de noël', 'christmas tree'], ['œuf au plat', 'fried egg'], ['poulpe', 'octopus'],
  ['baleine', 'whale'], ['trampoline', 'trampoline'], ['magicien', 'wizard'], ['bougie', 'candle'], ['clown', 'clown'],
  ['kangourou', 'kangaroo'], ['astronaute', 'astronaut'], ['croissant', 'croissant'], ['brosse à dents', 'toothbrush'], ['parachute', 'parachute'],
  ['tour eiffel', 'eiffel tower'], ['pieuvre', 'squid'], ['bonhomme', 'stickman'], ['cerf-volant', 'kite'], ['marteau', 'hammer'],
  ['sirop', 'syrup'], ['hérisson', 'hedgehog'], ['télévision', 'television'], ['gâteau', 'cake'], ['moto', 'motorbike'],
  ['phare', 'lighthouse'], ['zombie', 'zombie'], ['boussole', 'compass'], ['lama', 'llama'], ['igloo', 'igloo'],
  ['bateau', 'boat'], ['cheval', 'horse'], ['citrouille', 'pumpkin'], ['taupe', 'mole'], ['pompier', 'firefighter'],
  ['ballon', 'balloon'], ['fourchette', 'fork'], ['cascade', 'waterfall'], ['dauphin', 'dolphin'], ['épouvantail', 'scarecrow'],
  ['chameau', 'camel'], ['loupe', 'magnifying glass'], ['sorcière', 'witch'], ['hamac', 'hammock'], ['coussin', 'cushion'],
];

interface Stroke {
  c: string;
  w: number;
  pts: number[];
}

interface Pl extends Runner {
  score: number;
  found: boolean;
  note: string;
}

const lev = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls: Pl[] = runners.map((r) => ({ ...r, score: 0, found: false, note: '' }));
  // Seuls les humains dessinent ; les bots devinent parfois.
  const drawers = pls.map((p, i) => (p.bot ? -1 : i)).filter((i) => i >= 0);
  if (!drawers.length) drawers.push(0);
  const turns = Math.min(MAX_TURNS, drawers.length * (drawers.length <= 3 ? 2 : 1));
  const words = [...WORDS].sort(() => Math.random() - 0.5);
  let turn = -1;
  let drawer = 0;
  let word: [string, string] = words[0];
  let strokes: Stroke[] = [];
  let timer = 0;
  let phase: 'draw' | 'reveal' | 'end' = 'draw';
  let foundCount = 0;
  let feed: { text: string; color: string; t: number }[] = [];
  let time = 0;
  let botGuessAt: number[] = [];
  let hintLetters = new Set<number>();

  const target = () => norm(fr ? word[0] : word[1]);
  const shown = () => (fr ? word[0] : word[1]);

  function hint(): string {
    return [...shown()]
      .map((ch, i) => (ch === ' ' || ch === '-' ? ch : hintLetters.has(i) ? ch : '_'))
      .join(' ');
  }

  function nextTurn() {
    turn++;
    if (turn >= turns) {
      phase = 'end';
      timer = 4;
      const best = [...pls].sort((a, b) => b.score - a.score)[0];
      speak(fr ? `Champion du gribouillis : ${best.profile.name} !` : `Scribble champion: ${best.profile.name}!`, ctx.lang);
      ctx.refresh();
      return;
    }
    drawer = drawers[turn % drawers.length];
    word = words[turn % words.length];
    strokes = [];
    timer = DRAW_TIME;
    phase = 'draw';
    foundCount = 0;
    hintLetters = new Set();
    pls.forEach((p) => {
      p.found = false;
      p.note = '';
    });
    botGuessAt = pls.map((p, i) => (p.bot && i !== drawer && Math.random() < 0.55 ? 15 + Math.random() * 45 : -1));
    feed = [];
    speak(fr ? `À ${pls[drawer].profile.name} de dessiner !` : `${pls[drawer].profile.name}, draw!`, ctx.lang);
    if (!pls[drawer].bot) ctx.buzz(pls[drawer].pid, 300);
    ctx.refresh();
  }

  function correct(i: number) {
    const p = pls[i];
    p.found = true;
    foundCount++;
    p.score += Math.max(3, 10 - (foundCount - 1) * 2) + Math.round(timer / 15);
    pls[drawer].score += 3;
    feed.unshift({ text: fr ? `${p.profile.name} a trouvé !` : `${p.profile.name} got it!`, color: p.profile.color, t: 4 });
    sfx.join();
    if (!p.bot) ctx.buzz(p.pid, 150);
    const guessers = pls.filter((_, k) => k !== drawer);
    if (guessers.every((g) => g.found)) timer = Math.min(timer, 0.01);
    ctx.refresh();
  }

  function guess(i: number, text: string) {
    if (phase !== 'draw' || i === drawer || pls[i].found) return;
    const g = norm(text).slice(0, 40);
    if (!g) return;
    const w = target();
    if (g === w || g.replace(/ /g, '') === w.replace(/ /g, '')) return correct(i);
    const close = w.length >= 5 && lev(g, w) <= 1;
    pls[i].note = close ? (fr ? 'Presque !' : 'So close!') : '';
    // Les mauvaises réponses s'affichent sur la télé (c'est la moitié du fun).
    feed.unshift({ text: `${pls[i].profile.name} : ${text.slice(0, 24)}`, color: '#fff', t: 4 });
    feed = feed.slice(0, 7);
    ctx.refresh();
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const i = pls.findIndex((p) => p.pid === pid);
      if (i < 0) return;
      if (m.a === 'guess' && m.s) return guess(i, m.s);
      if (i !== drawer || phase !== 'draw') return;
      const n = m.n ?? [];
      if (m.a === 's' && n.length >= 4) strokes.push({ c: INK_COLORS[n[0]] ?? INK, w: Math.max(2, Math.min(40, n[1])), pts: [n[2], n[3]] });
      if (m.a === 'p' && strokes.length) {
        const s = strokes[strokes.length - 1];
        if (s.pts.length < 4000) s.pts.push(...n.slice(0, 200));
      }
      if (m.a === 'undo') strokes.pop();
      if (m.a === 'clear') strokes = [];
      if (m.a === 'skip') timer = 0.01;
    },
    update(dt) {
      time += dt;
      timer -= dt;
      for (const f of feed) f.t -= dt;
      if (phase === 'draw') {
        // Indice : une lettre se dévoile à mi-temps puis à 20 s de la fin.
        const L = shown().length;
        if ((timer < DRAW_TIME / 2 && hintLetters.size < 1) || (timer < 20 && hintLetters.size < 2)) {
          const free = [...Array(L).keys()].filter((k) => !hintLetters.has(k) && shown()[k] !== ' ');
          if (free.length) hintLetters.add(free[Math.floor(Math.random() * free.length)]);
          ctx.refresh();
        }
        pls.forEach((p, i) => {
          if (botGuessAt[i] > 0 && DRAW_TIME - timer > botGuessAt[i] && !p.found) correct(i);
        });
        if (timer <= 0) {
          phase = 'reveal';
          timer = 4;
          sfx.finish();
          speak(fr ? `C'était : ${shown()}` : `It was: ${shown()}`, ctx.lang);
          ctx.refresh();
        }
      } else if (phase === 'reveal' && timer <= 0) nextTurn();
      else if (phase === 'end' && timer <= 0) game.over = true;
    },
    render(g, t) {
      g.fillStyle = '#ffe6f2';
      g.fillRect(0, 0, 1920, 1080);
      // Tableau
      const bx = 380;
      const by = 150;
      const bw = 1160;
      const bh = 790;
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 8;
      g.beginPath();
      g.roundRect(bx, by, bw, bh, 26);
      g.fill();
      g.stroke();
      g.save();
      g.beginPath();
      g.roundRect(bx + 4, by + 4, bw - 8, bh - 8, 22);
      g.clip();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const s of strokes) {
        g.strokeStyle = s.c;
        g.lineWidth = (s.w * bw) / 1000;
        g.beginPath();
        for (let k = 0; k < s.pts.length; k += 2) {
          const x = bx + (s.pts[k] / 1000) * bw;
          const y = by + (s.pts[k + 1] / 1000) * bh;
          if (k) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        if (s.pts.length === 2) g.lineTo(bx + (s.pts[0] / 1000) * bw + 0.1, by + (s.pts[1] / 1000) * bh);
        g.stroke();
      }
      g.restore();

      const d = pls[drawer];
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.font = '700 46px Fredoka, sans-serif';
      if (phase === 'end') g.fillText(fr ? 'Fin des gribouillis !' : 'That’s all, scribblers!', 960, 100);
      else g.fillText(phase === 'reveal' ? `${fr ? 'C’était' : 'It was'} : ${shown().toUpperCase()}` : hint(), 960, 100);
      g.font = '600 30px Fredoka, sans-serif';
      g.fillText(
        `✏️ ${d.profile.name} · ${fr ? 'tour' : 'turn'} ${Math.min(turn + 1, turns)}/${turns}${phase === 'draw' ? ` · ⏱ ${Math.ceil(Math.max(0, timer))}` : ''}`,
        960,
        1000,
      );

      // Joueurs à gauche et à droite
      pls.forEach((p, i) => {
        const left = i % 2 === 0;
        const row = Math.floor(i / 2);
        const x = left ? 190 : 1730;
        const y = 210 + row * 135;
        drawCharacter(g, x - 90, y + 50, 80, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          selfie: p.selfie,
          t: t + i,
          mood: p.found ? 'wow' : 'happy',
        });
        roundRectText(g, p.profile.name, x - 40, y + 4, 180, 28, p.profile.color);
        g.fillStyle = INK;
        g.font = '700 28px Fredoka, sans-serif';
        g.textAlign = 'left';
        g.fillText(`${p.score} ${i === drawer ? '✏️' : p.found ? '✅' : ''}`, x - 34, y + 50);
      });

      // Propositions qui défilent
      feed.forEach((f, k) => {
        if (f.t <= 0) return;
        g.globalAlpha = Math.min(1, f.t);
        g.fillStyle = 'rgba(58,33,64,0.8)';
        g.beginPath();
        g.roundRect(bx + 20, by + bh - 70 - k * 56, 520, 46, 23);
        g.fill();
        g.fillStyle = f.color === '#fff' ? '#fff' : f.color;
        g.font = '600 28px Fredoka, sans-serif';
        g.textAlign = 'left';
        g.fillText(f.text, bx + 40, by + bh - 37 - k * 56);
        g.globalAlpha = 1;
      });
    },
    ranking() {
      return [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid);
    },
    leader() {
      return phase === 'end' ? [...pls].sort((a, b) => b.score - a.score)[0].profile.name : null;
    },
    padData(pid): ScribblePadData {
      const i = pls.findIndex((p) => p.pid === pid);
      const p = pls[i];
      return {
        role: phase !== 'draw' ? 'wait' : i === drawer ? 'draw' : 'guess',
        word: i === drawer || phase !== 'draw' ? shown() : '',
        hint: hint(),
        drawer: pls[drawer]?.profile.name ?? '',
        found: !!p?.found,
        note: p?.note ?? '',
        turn: turn + 1,
        turns,
      };
    },
  };
  nextTurn();
  return game;
}

export const scribble: GameBase = {
  id: 'dessin',
  emoji: '✏️',
  name: { fr: 'Gribouillis', en: 'Scribbles' },
  how: {
    fr: 'Dessine le mot secret sur ton téléphone, les autres devinent !',
    en: 'Draw the secret word on your phone, the others guess!',
  },
  inspired: 'Jackbox',
  layout: 'buttons',
  min: 3,
  max: 12,
  botFill: 0,
  music: 'lobby',
  create,
};
