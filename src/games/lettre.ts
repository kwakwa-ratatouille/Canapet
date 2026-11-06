// Deux jeux sur la même réserve de thèmes :
// « Ça Commence Par… » : un thème, une lettre, chacun tape autant de mots qu'il peut (8 au plus). Mot unique = 3 points, mot en commun = 1, le tout premier +1.
//   Un mot de la liste passe tout seul ; les autres, les joueurs peuvent les contester.
// « Les Mots à Trous » : un thème et un mot à moitié caché. Plus c'est dur, moins il y a de lettres et plus ça rapporte.
import { drawCharacter } from '../shared/characters';
import { INK, MENTHE, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { freshDeck } from './decks';
import { candy } from './draw';
import { LETTER_THEMES, type LetterTheme } from './lettreWords';
import type { QuizPadData } from './quizShared';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

/** Sans accents, sans majuscules, sans article, au singulier : pour comparer deux mots. */
export function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/^(le |la |les |un |une |des |du |l'|l’|the |an |a )/, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, '');
}
const wordsOf = (t: LetterTheme, lang: 'fr' | 'en') => t.words[lang].split(' ').filter(Boolean);
const pretty = (w: string) => w.replace(/_/g, ' ');
const themesFor = (ctx: GameCtx) => LETTER_THEMES.filter((t) => !(ctx.family && t.adult));

function drawPlayers(g: CanvasRenderingContext2D, pls: (Runner & { score: number })[], t: number, done: (i: number) => boolean, y = 960) {
  const n = pls.length;
  const gap = Math.min(190, 1800 / n);
  pls.forEach((p, i) => {
    const x = 960 + (i - (n - 1) / 2) * gap;
    drawCharacter(g, x, y, 86, {
      food: p.profile.food,
      color: p.profile.color,
      hat: p.profile.hat,
      acc: p.profile.acc,
      eyes: p.profile.eyes,
      pose: p.profile.pose,
      selfie: p.selfie,
      t: t + i,
      mood: done(i) ? 'happy' : 'wow',
    });
    g.fillStyle = p.profile.color;
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(x - gap / 2 + 6, y + 14, gap - 12, 44, 16);
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.font = '700 28px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`${done(i) ? '✓ ' : ''}${p.profile.name.slice(0, gap < 150 ? 5 : 9)} · ${p.score}`, x, y + 37, gap - 20);
  });
}

function endScreen(g: CanvasRenderingContext2D, title: string, pls: (Runner & { score: number })[], t: number) {
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 76px Fredoka, sans-serif';
  g.fillText(title, 960, 200);
  const order = [...pls].sort((a, b) => b.score - a.score);
  order.slice(0, 8).forEach((p, i) => {
    const x = 960 + (i - (Math.min(8, order.length) - 1) / 2) * 220;
    drawCharacter(g, x, 640, 170, { food: p.profile.food, color: p.profile.color, hat: p.profile.hat, acc: p.profile.acc, eyes: p.profile.eyes, pose: p.profile.pose, selfie: p.selfie, t: t + i, mood: i === 0 ? 'win' : 'happy' });
    g.fillStyle = INK;
    g.font = '700 38px Fredoka, sans-serif';
    g.fillText(p.profile.name.slice(0, 10), x, 690);
    g.fillStyle = i === 0 ? ROSE : INK;
    g.font = '700 54px Fredoka, sans-serif';
    g.fillText(String(p.score), x, 750);
  });
}

// ——— Ça Commence Par… ———
/** Mots qu'un joueur peut donner dans une manche. */
const MAX_WORDS = 8;
interface Entry {
  word: string;
  key: string;
  at: number;
  gain: number;
  refused: boolean;
}
interface Pl extends Runner {
  score: number;
  list: Entry[];
  gain: number;
  /** Ce que le bot va répondre, et quand. */
  botPlan: { at: number; word: string }[];
}
type Phase = 'spin' | 'write' | 'contest' | 'reveal' | 'end';
const ROW_COLORS = [ROSE, '#2ec5ff', SOLEIL, MENTHE, '#9b5cff', '#ff9a1f'];

function createLettre(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const lang = ctx.lang;
  const pls: Pl[] = runners.map((r) => ({ ...r, score: 0, list: [], gain: 0, botPlan: [] }));
  const rounds = ctx.opts.rounds || 6;
  const writeTime = ctx.opts.time || 30;
  const themes = freshDeck(`lettre-${lang}`, themesFor(ctx), rounds, (t) => t.fr);
  const used = new Set<string>();
  let round = -1;
  let phase: Phase = 'spin';
  let timer = 0;
  let clock = 0;
  let theme = themes[0];
  let letter = 'A';
  let known = new Set<string>();
  let doubts: { key: string; word: string; against: Set<string> }[] = [];
  let ideas: string[] = [];
  const notes = new Map<string, string>();

  function next() {
    round++;
    if (round >= themes.length) {
      phase = 'end';
      timer = 6;
      const top = [...pls].sort((a, b) => b.score - a.score)[0];
      speak(fr ? `Le roi du vocabulaire : ${top.profile.name} !` : `The king of words: ${top.profile.name}!`, lang);
      sfx.win();
      ctx.refresh();
      return;
    }
    theme = themes[round];
    const words = wordsOf(theme, lang);
    known = new Set(words.map((w) => norm(pretty(w))));
    // Une lettre pour laquelle la liste a de quoi répondre, et qu'on n'a pas encore eue si possible
    const count = new Map<string, number>();
    words.forEach((w) => {
      const c = norm(pretty(w))[0];
      if (c) count.set(c, (count.get(c) ?? 0) + 1);
    });
    let pool = [...count.entries()].filter((e) => e[1] >= 2).map((e) => e[0]);
    if (!pool.length) pool = [...count.keys()];
    const fresh = pool.filter((c) => !used.has(c));
    const list = fresh.length ? fresh : pool;
    letter = list[Math.floor(Math.random() * list.length)];
    used.add(letter);
    const can = words.filter((w) => norm(pretty(w))[0] === letter);
    ideas = [...can].sort(() => Math.random() - 0.5).map(pretty);
    pls.forEach((p) => {
      p.list = [];
      p.gain = 0;
      p.botPlan = [];
      if (p.bot) {
        // Plus le bot est fort, plus il trouve de mots et vite
        const n = Math.min(can.length, Math.floor(Math.random() * (1 + ctx.botSkill * 3)) + (Math.random() < 0.75 + ctx.botSkill * 0.2 ? 1 : 0));
        p.botPlan = [...can].sort(() => Math.random() - 0.5).slice(0, n).map((w) => ({ word: w, at: 4 + Math.random() * (writeTime - 7) * (1.1 - ctx.botSkill * 0.4) }));
      }
    });
    notes.clear();
    doubts = [];
    phase = 'spin';
    timer = 1.8;
    clock = 0;
    sfx.whoosh();
    ctx.refresh();
  }

  function submit(p: Pl, raw: string) {
    const word = raw.trim().replace(/_/g, ' ').slice(0, 30);
    p.list.push({ word, key: norm(word), at: clock, gain: 0, refused: false });
    sfx.join();
    ctx.refresh();
  }

  function score() {
    const ok = pls.flatMap((p) => p.list).filter((e) => !e.refused);
    const fastest = [...ok].sort((a, b) => a.at - b.at)[0];
    ok.forEach((e) => {
      const same = ok.filter((x) => x.key === e.key).length;
      e.gain = (same > 1 ? 1 : 3) + (e === fastest ? 1 : 0);
    });
    pls.forEach((p) => {
      p.gain = p.list.reduce((n, e) => n + e.gain, 0);
      p.score += p.gain;
    });
    phase = 'reveal';
    timer = 7;
    sfx.boom();
    ctx.refresh();
  }

  function afterWrite() {
    // Les mots hors liste passent devant les autres joueurs, s'il y en a pour les juger
    const humans = pls.filter((p) => !p.bot);
    const out = new Map<string, string>();
    const has = (p: Pl, key: string) => p.list.some((e) => e.key === key);
    pls.forEach((p) => {
      // Inutile de le présenter si personne d'autre ne peut le juger
      p.list.forEach((e) => {
        if (!known.has(e.key) && humans.some((h) => !has(h, e.key))) out.set(e.key, e.word);
      });
    });
    if (out.size && humans.length >= 2) {
      doubts = [...out.entries()].map(([key, word]) => ({ key, word, against: new Set() }));
      phase = 'contest';
      timer = 9;
      speak(fr ? 'Y a-t-il un mot à refuser ?' : 'Any words to reject?', lang);
      sfx.cards();
      ctx.refresh();
      return;
    }
    score();
  }

  function endContest() {
    doubts.forEach((d) => {
      const owners = pls.filter((p) => p.list.some((e) => e.key === d.key));
      const judges = pls.filter((p) => !p.bot && !owners.includes(p)).length;
      if (judges && d.against.size * 2 >= judges && d.against.size > 0) owners.forEach((p) => p.list.forEach((e) => { if (e.key === d.key) e.refused = true; }));
    });
    score();
  }

  next();

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const p = pls.find((x) => x.pid === pid);
      if (!p) return;
      if (m.a === 'text' && phase === 'write' && m.s && p.list.length < MAX_WORDS) {
        const k = norm(m.s);
        if (k.length < 2 || k[0] !== letter) {
          notes.set(pid, fr ? `Il faut un mot en ${letter.toUpperCase()} !` : `It must start with ${letter.toUpperCase()}!`);
          ctx.refresh();
          return;
        }
        if (p.list.some((e) => e.key === k)) {
          notes.set(pid, fr ? 'Tu l’as déjà dit !' : 'You already said that!');
          ctx.refresh();
          return;
        }
        notes.delete(pid);
        submit(p, m.s);
      }
      if (m.a === 'pick' && phase === 'contest') {
        const d = doubts[m.n?.[0] ?? -1];
        if (!d || p.list.some((e) => e.key === d.key)) return;
        if (d.against.has(pid)) d.against.delete(pid);
        else d.against.add(pid);
        sfx.click();
        ctx.refresh();
      }
    },
    update(dt) {
      timer -= dt;
      clock += dt;
      if (phase === 'spin') {
        if (timer <= 0) {
          phase = 'write';
          timer = writeTime;
          clock = 0;
          sfx.go();
          speak(fr ? `${theme.fr}, avec la lettre ${letter.toUpperCase()}` : `${theme.en}, with the letter ${letter.toUpperCase()}`, lang);
          ctx.refresh();
        }
      } else if (phase === 'write') {
        pls.forEach((p) => {
          const due = p.botPlan.find((b) => clock >= b.at);
          if (due) {
            p.botPlan.splice(p.botPlan.indexOf(due), 1);
            submit(p, pretty(due.word));
          }
        });
        // Tout le monde a donné tous ses mots : pas la peine d'attendre
        if (timer <= 0 || pls.every((p) => (p.bot ? !p.botPlan.length : p.list.length >= MAX_WORDS || ctx.away(p.pid)))) afterWrite();
      } else if (phase === 'contest') {
        if (timer <= 0) endContest();
      } else if (phase === 'reveal') {
        if (timer <= 0) next();
      } else if (timer <= 0) game.over = true;
    },
    render(g, t) {
      g.fillStyle = '#e8f6ff';
      g.fillRect(0, 0, 1920, 1080);
      // Papier quadrillé
      g.strokeStyle = 'rgba(46,197,255,0.2)';
      g.lineWidth = 3;
      for (let k = 60; k < 1920; k += 60) {
        g.beginPath();
        g.moveTo(k, 0);
        g.lineTo(k, 1080);
        g.stroke();
      }
      for (let k = 60; k < 1080; k += 60) {
        g.beginPath();
        g.moveTo(0, k);
        g.lineTo(1920, k);
        g.stroke();
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = INK;
      if (phase === 'end') return endScreen(g, fr ? 'Le roi du vocabulaire' : 'The king of words', pls, t);
      g.font = '700 34px Fredoka, sans-serif';
      g.fillText(`${fr ? 'Manche' : 'Round'} ${round + 1}/${themes.length}`, 960, 46);
      g.font = '700 72px Fredoka, sans-serif';
      g.fillText(`${theme.emoji} ${fr ? theme.fr : theme.en}`, 960, 120, 1800);
      // La lettre
      const shown = phase === 'spin' ? 'ABCDEFGHIJLMNOPRSTUV'[Math.floor(t * 18) % 20] : letter.toUpperCase();
      const big = phase === 'write' || phase === 'spin';
      const lx = big ? 960 : 150;
      const ly = big ? 410 : 130;
      const lr = big ? 170 : 90;
      g.fillStyle = SOLEIL;
      g.strokeStyle = INK;
      g.lineWidth = 8;
      g.beginPath();
      g.arc(lx, ly, lr, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = INK;
      g.font = `700 ${big ? 230 : 110}px Fredoka, sans-serif`;
      g.fillText(shown, lx, ly + (big ? 12 : 6));
      if (phase === 'write') {
        g.font = '700 64px Fredoka, sans-serif';
        g.fillStyle = timer < 6 ? ROSE : INK;
        g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 960, 650);
        g.fillStyle = INK;
        g.font = '700 42px Fredoka, sans-serif';
        g.fillText(fr ? `Tape un maximum de mots (${MAX_WORDS} au plus). Mot que toi seul as = 3 points !` : `Type as many words as you can (up to ${MAX_WORDS}). A word only you have = 3 points!`, 960, 730, 1760);
      }
      if (phase === 'contest') {
        g.font = '700 50px Fredoka, sans-serif';
        g.fillText(fr ? '🤔 Ces mots ne sont pas dans ma liste. On les accepte ?' : '🤔 These words aren’t on my list. Accept them?', 960, 240, 1700);
        g.font = '700 36px Fredoka, sans-serif';
        g.fillText(fr ? 'Touche un mot sur ton téléphone pour le refuser' : 'Tap a word on your phone to reject it', 960, 300);
        doubts.forEach((d, k) => {
          const cols = Math.min(3, doubts.length);
          const w = 540;
          const x = 960 + ((k % 3) - (cols - 1) / 2) * (w + 30);
          const y = 400 + Math.floor(k / 3) * 110;
          g.fillStyle = d.against.size ? '#ffd1d9' : '#fff';
          g.strokeStyle = INK;
          g.lineWidth = 6;
          g.beginPath();
          g.roundRect(x - w / 2, y - 45, w, 90, 24);
          g.fill();
          g.stroke();
          g.fillStyle = INK;
          g.font = '700 42px Fredoka, sans-serif';
          g.fillText(`${d.word}${d.against.size ? `  👎 ${d.against.size}` : ''}`, x, y + 2, w - 30);
        });
        g.font = '700 54px Fredoka, sans-serif';
        g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 960, 810);
      }
      if (phase === 'reveal') {
        const rows = pls;
        const cols = rows.length > 6 ? 3 : 2;
        const w = cols === 3 ? 580 : 800;
        const h = Math.min(120, 620 / Math.ceil(rows.length / cols));
        rows.forEach((p, k) => {
          const col = k % cols;
          const x = 960 + (col - (cols - 1) / 2) * (w + 24);
          const y = 250 + Math.floor(k / cols) * (h + 14);
          g.fillStyle = '#fff';
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.beginPath();
          g.roundRect(x - w / 2, y, w, h, 20);
          g.fill();
          g.stroke();
          g.fillStyle = p.profile.color;
          g.beginPath();
          g.arc(x - w / 2 + 34, y + h / 2, 18, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          // Une étiquette par mot : vert = à lui seul, jaune = en commun, gris = refusé
          g.font = '700 28px Fredoka, sans-serif';
          g.textAlign = 'left';
          let cx = x - w / 2 + 62;
          let cy = y + (h >= 96 ? 8 : (h - 40) / 2);
          const right = x + w / 2 - 84;
          if (!p.list.length) {
            g.fillStyle = INK;
            g.fillText(fr ? '— rien —' : '— nothing —', cx, y + h / 2 + 2);
          }
          for (const e of p.list) {
            const tw = Math.min(right - (x - w / 2 + 62), g.measureText(e.word).width + 22);
            if (cx + tw > right) {
              cx = x - w / 2 + 62;
              cy += 44;
              if (cy + 40 > y + h) break;
            }
            g.fillStyle = e.refused ? '#e4d8de' : e.gain >= 3 ? '#a8efc9' : '#ffe680';
            g.strokeStyle = INK;
            g.lineWidth = 3;
            g.beginPath();
            g.roundRect(cx, cy, tw, 40, 12);
            g.fill();
            g.stroke();
            g.fillStyle = INK;
            g.fillText(e.word, cx + 11, cy + 21, tw - 22);
            if (e.refused) g.fillRect(cx + 8, cy + 19, tw - 16, 3);
            cx += tw + 8;
          }
          g.textAlign = 'right';
          g.font = '700 42px Fredoka, sans-serif';
          g.fillStyle = p.gain ? '#0f8f6a' : ROSE;
          g.fillText(p.gain ? `+${p.gain}` : '0', x + w / 2 - 20, y + h / 2 + 2);
          g.textAlign = 'center';
        });
        const idea = ideas.filter((w) => !pls.some((p) => p.list.some((e) => e.key === norm(w)))).slice(0, 3);
        if (idea.length) {
          g.fillStyle = INK;
          g.font = '700 36px Fredoka, sans-serif';
          g.fillText(`${fr ? '💡 On pouvait dire' : '💡 You could say'} : ${idea.join(', ')}`, 1060, 200, 1500);
        }
      }
      drawPlayers(g, pls, t, (i) => pls[i].list.length > 0);
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): QuizPadData {
      const p = pls.find((x) => x.pid === pid)!;
      const label = phase === 'end' ? '' : `${theme.emoji} ${fr ? theme.fr : theme.en}`;
      const L = letter.toUpperCase();
      const mine = doubts.map((d, i) => ({ d, i })).filter((x) => !p.list.some((e) => e.key === x.d.key));
      const full = p.list.length >= MAX_WORDS;
      return {
        phase: phase === 'write' ? 'write' : phase === 'contest' ? 'choose' : phase === 'end' ? 'end' : 'reveal',
        prompt: phase === 'contest' ? (fr ? 'Touche les mots à refuser' : 'Tap the words to reject') : label,
        step: `${fr ? 'Manche' : 'Round'} ${Math.min(round + 1, themes.length)}/${themes.length}`,
        act: phase === 'write' && !full ? 'write' : phase === 'contest' && mine.length ? 'choose' : null,
        options: phase === 'contest' ? mine.map((x) => ({ i: x.i, label: x.d.word, color: ROW_COLORS[x.i % ROW_COLORS.length] })) : [],
        picked: -1,
        pickedAll: phase === 'contest' ? mine.filter((x) => x.d.against.has(pid)).map((x) => x.i) : undefined,
        score: p.score,
        left: phase === 'write' || phase === 'contest' ? Math.ceil(Math.max(0, timer)) : 0,
        note: notes.get(pid) ?? (full && phase === 'write' ? (fr ? 'C’est le maximum, bravo !' : 'That’s the maximum, well done!') : ''),
        hint: fr ? `Un mot en ${L}…` : `A word with ${L}…`,
        big: phase === 'write' ? L : undefined,
        chips: phase === 'write' ? p.list.map((e) => e.word) : undefined,
      };
    },
  };
  return game;
}

export const lettre: GameBase = {
  id: 'lettre',
  emoji: '🔤',
  name: { fr: 'Ça Commence Par…', en: 'Starts With…' },
  how: {
    fr: 'Un thème, une lettre : tape un maximum de mots. Chaque mot que toi seul as vaut 3 points !',
    en: 'A theme, a letter: type as many words as you can. Each word only you have is worth 3 points!',
  },
  layout: 'buttons',
  min: 2,
  max: 12,
  botFill: 3,
  music: 'party',
  options: [
    { id: 'rounds', label: { fr: 'Manches', en: 'Rounds' }, choices: [{ v: 6, label: { fr: '6 manches', en: '6 rounds' } }, { v: 4, label: { fr: '4 manches', en: '4 rounds' } }, { v: 10, label: { fr: '10 manches', en: '10 rounds' } }] },
    { id: 'time', label: { fr: 'Temps', en: 'Time' }, choices: [{ v: 30, label: { fr: '30 s', en: '30 s' } }, { v: 20, label: { fr: '20 s', en: '20 s' } }, { v: 45, label: { fr: '45 s', en: '45 s' } }] },
  ],
  create: createLettre,
};

// ——— Les Mots à Trous ———
interface TPl extends Runner {
  score: number;
  found: number;
  gain: number;
  botAt: number;
}
const LEVELS = [
  { keep: 0.6, pts: 3, stars: '⭐', fr: 'Facile', en: 'Easy' },
  { keep: 0.4, pts: 5, stars: '⭐⭐', fr: 'Moyen', en: 'Medium' },
  { keep: 0.2, pts: 8, stars: '⭐⭐⭐', fr: 'Dur', en: 'Hard' },
];
const SHOW_EVERY = 5;

function createTrous(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const lang = ctx.lang;
  const pls: TPl[] = runners.map((r) => ({ ...r, score: 0, found: 0, gain: 0, botAt: 0 }));
  const rounds = ctx.opts.rounds || 9;
  // Tous les mots assez longs, d'une seule pièce à l'écran
  const all = themesFor(ctx).flatMap((t) => wordsOf(t, lang).filter((w) => norm(pretty(w)).length >= 5 && norm(pretty(w)).length <= 14).map((w) => ({ w: pretty(w), t })));
  const deck = freshDeck(`trous-${lang}`, all, rounds, (x) => x.w + x.t.fr);
  let round = -1;
  let phase: 'write' | 'reveal' | 'end' = 'write';
  let timer = 0;
  let order = 0;
  let open: boolean[] = [];
  let level = LEVELS[0];
  let nextShow = 0;
  const notes = new Map<string, string>();
  const isLetter = (c: string) => /[\p{L}\p{N}]/u.test(c);
  const roundTime = 28;

  const showOne = () => {
    const hidden = open.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
    if (hidden.length > 1) open[hidden[Math.floor(Math.random() * hidden.length)]] = true;
  };

  function next() {
    round++;
    if (round >= deck.length) {
      phase = 'end';
      timer = 6;
      const top = [...pls].sort((a, b) => b.score - a.score)[0];
      speak(fr ? `Champion des trous : ${top.profile.name} !` : `Gap champion: ${top.profile.name}!`, lang);
      sfx.win();
      ctx.refresh();
      return;
    }
    // De plus en plus dur au fil de la partie
    level = LEVELS[Math.min(2, Math.floor((round / deck.length) * 3))];
    const chars = Array.from(deck[round].w);
    const letters = chars.map((c, i) => (isLetter(c) ? i : -1)).filter((i) => i >= 0);
    open = chars.map((c) => !isLetter(c));
    const n = Math.max(1, Math.round(letters.length * level.keep));
    [...letters].sort(() => Math.random() - 0.5).slice(0, n).forEach((i) => (open[i] = true));
    pls.forEach((p) => {
      p.found = 0;
      p.gain = 0;
      p.botAt = 5 + Math.random() * 18 * (1.3 - ctx.botSkill * 0.8) + (level.pts - 3);
    });
    order = 0;
    notes.clear();
    phase = 'write';
    timer = roundTime;
    nextShow = SHOW_EVERY + 2;
    speak(fr ? deck[round].t.fr : deck[round].t.en, lang);
    sfx.whoosh();
    ctx.refresh();
  }

  function found(p: TPl) {
    order++;
    p.found = order;
    // Le premier prend tout, les suivants un peu moins
    p.gain = Math.max(1, level.pts - (order - 1) * 2);
    p.score += p.gain;
    sfx.join();
    ctx.buzz(p.pid, 80);
    showOne();
    ctx.refresh();
  }
  function reveal() {
    phase = 'reveal';
    timer = 4;
    open = open.map(() => true);
    sfx.boom();
    ctx.refresh();
  }

  next();
  const elapsed = () => roundTime - timer;

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'text' || phase !== 'write' || !m.s) return;
      const p = pls.find((x) => x.pid === pid);
      if (!p || p.found) return;
      if (norm(m.s) === norm(deck[round].w)) {
        notes.delete(pid);
        found(p);
      } else {
        notes.set(pid, fr ? `« ${m.s.slice(0, 20)} » : non, retente !` : `“${m.s.slice(0, 20)}”: no, try again!`);
        ctx.refresh();
      }
    },
    update(dt) {
      timer -= dt;
      if (phase === 'write') {
        pls.forEach((p) => {
          if (p.bot && !p.found && elapsed() >= p.botAt) found(p);
        });
        // Des indices arrivent peu à peu si personne ne trouve
        if (elapsed() >= nextShow) {
          nextShow += SHOW_EVERY;
          showOne();
          sfx.click();
        }
        if (timer <= 0 || pls.every((p) => p.found || (!p.bot && ctx.away(p.pid)))) reveal();
      } else if (phase === 'reveal') {
        if (timer <= 0) next();
      } else if (timer <= 0) game.over = true;
    },
    render(g, t) {
      g.fillStyle = '#fff1f8';
      g.fillRect(0, 0, 1920, 1080);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = INK;
      if (phase === 'end') return endScreen(g, fr ? 'Les champions des trous' : 'The gap champions', pls, t);
      g.font = '700 34px Fredoka, sans-serif';
      g.fillText(`${fr ? 'Mot' : 'Word'} ${round + 1}/${deck.length} · ${level.stars} ${fr ? level.fr : level.en} · ${level.pts} ${fr ? 'points' : 'points'}`, 960, 50);
      const th = deck[round].t;
      g.font = '700 74px Fredoka, sans-serif';
      g.fillText(`${th.emoji} ${fr ? th.fr : th.en}`, 960, 150, 1800);
      const chars = Array.from(deck[round].w);
      const cell = Math.min(118, 1760 / chars.length);
      chars.forEach((c, i) => {
        const x = 960 + (i - (chars.length - 1) / 2) * cell;
        const y = 400;
        if (!isLetter(c)) return;
        const shown = open[i];
        g.fillStyle = shown ? (phase === 'reveal' ? '#d8f7e8' : '#fff') : '#efe0ea';
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(x - cell / 2 + 6, y - 72, cell - 12, 144, 20);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.font = `700 ${Math.round(cell * 0.72)}px Fredoka, sans-serif`;
        g.fillText(shown ? c.toUpperCase() : '?', x, y + 4);
      });
      if (phase === 'write') {
        g.font = '700 64px Fredoka, sans-serif';
        g.fillStyle = timer < 6 ? ROSE : INK;
        g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 960, 590);
        g.fillStyle = INK;
        g.font = '700 42px Fredoka, sans-serif';
        g.fillText(fr ? 'Tape le mot sur ton téléphone : le premier gagne le plus !' : 'Type the word on your phone: the first wins the most!', 960, 680, 1760);
      }
      if (phase === 'reveal') {
        const firsts = [...pls].filter((p) => p.found).sort((a, b) => a.found - b.found);
        g.font = '700 52px Fredoka, sans-serif';
        g.fillText(firsts.length ? `🏆 ${firsts[0].profile.name} +${firsts[0].gain}` : fr ? 'Personne n’a trouvé !' : 'Nobody got it!', 960, 620);
      }
      drawPlayers(g, pls, t, (i) => !!pls[i].found);
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): QuizPadData {
      const p = pls.find((x) => x.pid === pid)!;
      const chars = phase === 'end' ? [] : Array.from(deck[round].w);
      const mask = chars.map((c, i) => (open[i] ? c.toUpperCase() : '_')).join(' ');
      const th = phase === 'end' ? null : deck[round].t;
      return {
        phase: phase === 'write' ? 'write' : phase === 'end' ? 'end' : 'reveal',
        prompt: th ? `${th.emoji} ${fr ? th.fr : th.en}` : '',
        step: `${fr ? 'Mot' : 'Word'} ${Math.min(round + 1, deck.length)}/${deck.length} · ⭐ ${p.score}`,
        act: phase === 'write' && !p.found ? 'write' : null,
        options: [],
        picked: -1,
        score: p.score,
        left: phase === 'write' ? Math.ceil(Math.max(0, timer)) : 0,
        note: p.found ? (fr ? `Trouvé ! +${p.gain} 🎉` : `Got it! +${p.gain} 🎉`) : notes.get(pid) ?? '',
        hint: fr ? 'Le mot…' : 'The word…',
        big: phase === 'end' ? undefined : mask,
      };
    },
  };
  return game;
}

export const trous: GameBase = {
  id: 'trous',
  emoji: '🕳️',
  name: { fr: 'Les Mots à Trous', en: 'Words With Holes' },
  how: {
    fr: 'Un thème et un mot à moitié caché. Plus c’est dur, moins il y a de lettres et plus ça rapporte. Le premier qui trouve gagne le plus !',
    en: 'A theme and a half-hidden word. The harder, the fewer letters and the more points. First to find it wins the most!',
  },
  layout: 'buttons',
  min: 2,
  max: 12,
  botFill: 3,
  music: 'party',
  options: [{ id: 'rounds', label: { fr: 'Nombre de mots', en: 'Number of words' }, choices: [{ v: 9, label: { fr: '9 mots', en: '9 words' } }, { v: 6, label: { fr: '6 mots', en: '6 words' } }, { v: 15, label: { fr: '15 mots', en: '15 words' } }] }],
  create: createTrous,
};
