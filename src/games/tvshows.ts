// Jeux « plateau télé », inspirés des émissions de jeux françaises (formats, jamais noms ni contenus copiés) :
// Les Inséparables (duos qui doivent répondre pareil), Le Sondage du Salon (retrouver les réponses les plus données),
// Mot en Couleurs (deviner un mot, lettres bien ou mal placées), Le Mot le Plus Long (tirage de lettres).
// Tous se jouent sur le téléphone avec QuizPad (choisir ou écrire).
import { drawCharacter } from '../shared/characters';
import { inDict, loadDict, looksReal, wordsFrom } from '../shared/dict';
import { CIEL, INK, MENTHE, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { freshDeck } from './decks';
import { candy, fitText, studioBackdrop } from './draw';
import { norm } from './lettre';
import { card, centerText, drawRow } from './quick';
import type { QuizPadData } from './quizShared';
import { COLOR_WORDS, DUO_SAME, DUO_WHO, MEMES, MEMES_RECENT, SURVEY } from './tvshowsData';
import { findMemeClip, memeVideo, type MemeClip } from '../shared/giphy';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T>(l: T[]) => l[Math.floor(Math.random() * l.length)];
const shuffled = <T>(l: T[]) => [...l].sort(() => Math.random() - 0.5);
/** Minuscules sans accents, lettres seulement (sans enlever le « s » final, contrairement à norm). */
const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/[^a-z]/g, '');
const OPT_COLORS = [ROSE, CIEL, SOLEIL, MENTHE];
const charOf = (p: Runner, t: number, i: number, mood: 'happy' | 'win' | 'sad' | 'wow' = 'happy') => ({ food: p.profile.food, color: p.profile.color, hat: p.profile.hat, acc: p.profile.acc, eyes: p.profile.eyes, pose: p.profile.pose, selfie: p.selfie, t: t + i, mood });

// ———————————————————————————— Les Inséparables ————————————————————————————

interface DuoPl extends Runner {
  score: number;
  pick: number;
  group: number;
  gain: number;
}

function createDuos(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls: DuoPl[] = shuffled(runners.slice(0, 12)).map((r) => ({ ...r, score: 0, pick: -1, group: 0, gain: 0 }));
  // Des duos (un trio si on est impair)
  const groups: DuoPl[][] = [];
  for (let i = 0; i < pls.length; i += 2) groups.push(pls.slice(i, i + 2));
  if (groups.length > 1 && groups[groups.length - 1].length === 1) groups[groups.length - 2].push(...groups.pop()!);
  groups.forEach((g, k) => g.forEach((p) => (p.group = k)));
  const ROUNDS = 10;
  const same = freshDeck('duos-same', DUO_SAME.filter((q) => !(ctx.family && q[0].startsWith('!'))), 5, (q) => q[0]);
  const who = freshDeck('duos-who', DUO_WHO.filter((q) => !(ctx.family && q[0].startsWith('!'))), 5, (q) => q[0]);
  type Q = { kind: 'same'; text: string; options: string[] } | { kind: 'who'; text: string };
  const deck: Q[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const s = same[i >> 1];
    const w = who[i >> 1];
    if (i % 2 === 0 && s) deck.push({ kind: 'same', text: (fr ? s[0] : s[2]).replace(/^!/, ''), options: fr ? s[1] : s[3] });
    else if (w) deck.push({ kind: 'who', text: (fr ? w[0] : w[1]).replace(/^!/, '') });
  }
  let round = -1;
  let phase: QuizPadData['phase'] = 'choose';
  let timer = 0;
  const agreed: boolean[] = [];
  const whoText = (g: DuoPl[], text: string) => (g.length === 3 ? text.replace(/de vous deux/i, 'de vous trois').replace(/Which of you/i, 'Which of you three') : text);
  /** Ce que ce joueur peut choisir : les 4 réponses, ou les membres de son duo. */
  const optionsOf = (p: DuoPl) => {
    const q = deck[round];
    if (!q) return [];
    if (q.kind === 'same') return q.options;
    return groups[p.group].map((m) => (m === p ? (fr ? `Moi (${m.profile.name})` : `Me (${m.profile.name})`) : m.profile.name));
  };

  function next() {
    round++;
    if (round >= deck.length) {
      phase = 'end';
      timer = 6;
      sfx.win();
      ctx.refresh();
      return;
    }
    phase = 'choose';
    timer = 15;
    pls.forEach((p) => {
      p.pick = -1;
      p.gain = 0;
    });
    pls.forEach((p) => {
      if (p.bot) (p as DuoPl & { botT?: number }).botT = rnd(2, 9);
    });
    speak(deck[round].text, ctx.lang);
    sfx.whoosh();
    ctx.refresh();
  }
  function reveal() {
    groups.forEach((g, k) => {
      const picks = g.map((p) => p.pick);
      // Pour « Qui de vous deux ? », chacun choisit un membre : on compare la personne désignée
      const all = picks.every((x) => x >= 0 && x === picks[0]);
      const pairs = picks.filter((x, i) => x >= 0 && picks.some((y, j) => j !== i && y === x)).length;
      agreed[k] = all;
      const gain = all ? 3 : g.length === 3 && pairs >= 2 ? 1 : 0;
      g.forEach((p) => {
        p.gain = gain;
        p.score += gain;
      });
    });
    phase = 'reveal';
    timer = 6;
    const n = agreed.filter(Boolean).length;
    speak(n === groups.length ? (fr ? 'Tout le monde est sur la même longueur d’onde !' : 'Everyone is on the same wavelength!') : n === 0 ? (fr ? 'Aïe… aucun duo d’accord !' : 'Ouch… no duo agreed!') : fr ? `${n} duo${n > 1 ? 's' : ''} en parfaite harmonie !` : `${n} duo${n > 1 ? 's' : ''} in perfect harmony!`, ctx.lang);
    n ? sfx.win() : sfx.boing();
    ctx.refresh();
  }
  next();

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'pick' || phase !== 'choose') return;
      const p = pls.find((x) => x.pid === pid);
      const k = m.n?.[0] ?? -1;
      if (!p || k < 0 || k >= optionsOf(p).length) return;
      p.pick = k;
      sfx.click();
      ctx.refresh();
    },
    update(dt) {
      timer -= dt;
      if (phase === 'choose') {
        for (const p of pls) {
          const b = p as DuoPl & { botT?: number };
          if (!p.bot || p.pick >= 0 || (b.botT = (b.botT ?? 0) - dt) > 0) continue;
          const opts = optionsOf(p).length;
          const mate = groups[p.group].find((m) => m !== p && m.pick >= 0);
          // Un bot s'accorde parfois avec son binôme (sinon il répond au hasard)
          p.pick = mate && Math.random() < 0.5 + ctx.botSkill * 0.2 ? mate.pick : Math.floor(Math.random() * opts);
        }
        if (timer <= 0 || pls.every((p) => p.pick >= 0 || (!p.bot && ctx.away(p.pid)))) reveal();
      } else if (phase === 'reveal') {
        if (timer <= 0) next();
      } else if (timer <= 0) game.over = true;
    },
    render(g, t) {
      studioBackdrop(g, t, ctx.light, '#ffe3f1', '#fff1d6', '#ff86bd');
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (phase === 'end') {
        g.font = '700 72px Fredoka, sans-serif';
        g.fillText(fr ? '💞 Les duos les plus soudés' : '💞 The tightest duos', 960, 160);
        drawRow(g, [...pls].sort((a, b) => b.score - a.score), t, (p) => `${p.profile.name}\n${p.score}`, 600, 160);
        return;
      }
      const q = deck[round];
      g.font = '700 38px Fredoka, sans-serif';
      g.fillText(`💞 ${fr ? 'Les Inséparables' : 'The Inseparables'} · ${round + 1}/${deck.length} · ${q.kind === 'same' ? (fr ? 'Pensez pareil !' : 'Think alike!') : fr ? 'Désignez la même personne !' : 'Point at the same person!'}`, 960, 70, 1700);
      card(g, 160, 110, 1600, 150, '#fff');
      g.fillStyle = INK;
      centerText(g, q.text, 960, 185, 1500, 54);
      if (phase === 'choose') {
        g.font = '700 46px Fredoka, sans-serif';
        g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 960, 296);
      }
      // Les duos, chacun dans sa carte
      const n = groups.length;
      const cols = n <= 3 ? n : 3;
      const rows = Math.ceil(n / cols);
      const cw = Math.min(580, 1800 / cols - 20);
      const ch = rows > 1 ? 330 : 520;
      groups.forEach((gr, k) => {
        const cx = 960 + ((k % cols) - (cols - 1) / 2) * (cw + 20);
        const y0 = (rows > 1 ? 340 : 380) + Math.floor(k / cols) * (ch + 20);
        const ok = phase === 'reveal' && agreed[k];
        card(g, cx - cw / 2, y0, cw, ch, phase === 'reveal' ? (ok ? '#c9f7e4' : '#ffd6dc') : '#fff7fb');
        gr.forEach((p, i) => {
          const px = cx + (i - (gr.length - 1) / 2) * (cw / gr.length);
          const size = rows > 1 ? 100 : 150;
          drawCharacter(g, px, y0 + (rows > 1 ? 150 : 230), size, charOf(p, t, i, phase === 'reveal' ? (ok ? 'win' : 'sad') : 'happy'));
          g.fillStyle = INK;
          g.font = '700 30px Fredoka, sans-serif';
          g.fillText(fitText(g, p.profile.name, cw / gr.length - 12), px, y0 + (rows > 1 ? 190 : 290));
          if (phase === 'choose' && p.pick >= 0) g.fillText('✅', px, y0 + 36);
          if (phase === 'reveal') {
            const opts = optionsOf(p);
            const lab = p.pick < 0 ? '…' : q.kind === 'who' ? gr[p.pick]?.profile.name ?? '…' : opts[p.pick];
            g.font = '700 30px Fredoka, sans-serif';
            g.fillStyle = INK;
            g.fillText(fitText(g, lab, cw / gr.length - 16), px, y0 + (rows > 1 ? 230 : 350));
          }
        });
        if (phase === 'reveal') {
          g.font = '700 40px Fredoka, sans-serif';
          g.fillStyle = ok ? '#0f8a5f' : '#c4125f';
          g.fillText(ok ? (fr ? `💞 Pareil ! +${gr[0].gain}` : `💞 Match! +${gr[0].gain}`) : gr[0].gain ? (fr ? `+${gr[0].gain}` : `+${gr[0].gain}`) : '💔', cx, y0 + ch - 44);
        }
      });
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): QuizPadData {
      const p = pls.find((x) => x.pid === pid)!;
      const q = deck[round];
      const mates = groups[p.group].filter((m) => m !== p).map((m) => m.profile.name).join(fr ? ' et ' : ' and ');
      return {
        phase,
        prompt: q ? `${q.kind === 'who' ? whoText(groups[p.group], q.text) : q.text}` : '',
        step: `${Math.min(round + 1, deck.length)}/${deck.length} · ${fr ? 'avec' : 'with'} ${mates}`,
        act: phase === 'choose' ? 'choose' : null,
        options: phase === 'choose' ? optionsOf(p).map((label, i) => ({ i, label, color: OPT_COLORS[i % 4] })) : [],
        picked: p.pick,
        score: p.score,
        left: phase === 'choose' ? Math.ceil(Math.max(0, timer)) : 0,
        note: phase === 'choose' ? (q?.kind === 'who' ? (fr ? 'Désignez la même personne que ton binôme !' : 'Point at the same person as your partner!') : fr ? 'Réponds comme ton binôme !' : 'Answer like your partner!') : '',
      };
    },
  };
  return game;
}

// ———————————————————————————— Le Sondage du Salon ————————————————————————————

interface SurvPl extends Runner {
  score: number;
  miss: number;
  found: string[];
  note: string;
  botT: number;
}

function createSondage(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const lang = ctx.lang;
  const pls: SurvPl[] = runners.slice(0, 12).map((r) => ({ ...r, score: 0, miss: 0, found: [], note: '', botT: 0 }));
  const ROUNDS = 6;
  const MISSES = 3;
  const deck = freshDeck(`sondage-${lang}`, SURVEY[lang].filter((q) => !(ctx.family && q[0].startsWith('!'))), ROUNDS, (q) => q[0]);
  type Ans = { alts: string[]; label: string; pts: number; by: SurvPl | null; shown: boolean };
  let answers: Ans[] = [];
  let question = '';
  let round = -1;
  let phase: QuizPadData['phase'] = 'write';
  let timer = 0;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  function next() {
    round++;
    if (round >= deck.length) {
      phase = 'end';
      timer = 6;
      sfx.win();
      ctx.refresh();
      return;
    }
    const [q, list] = deck[round];
    question = q.replace(/^!/, '');
    answers = list.map(([a, pts]) => ({ alts: a.split('/').map(plain), label: cap(a.split('/')[0]), pts, by: null, shown: false }));
    phase = 'write';
    timer = 40;
    pls.forEach((p) => {
      p.miss = 0;
      p.found = [];
      p.note = '';
      p.botT = rnd(4, 12);
    });
    speak(fr ? `On a demandé au salon : ${question}` : `We asked the room: ${question}`, lang);
    sfx.whoosh();
    ctx.refresh();
  }
  const match = (raw: string) => {
    const k = plain(raw);
    if (k.length < 2) return -1;
    return answers.findIndex((a) => a.alts.some((x) => x === k || norm(x) === norm(raw) || (k.length >= 4 && x.length >= 4 && (x.includes(k) || k.includes(x)))));
  };
  const find = (p: SurvPl, i: number) => {
    const a = answers[i];
    if (a.shown) {
      p.note = fr ? `« ${a.label} » est déjà trouvée !` : `“${a.label}” is already found!`;
      return;
    }
    a.shown = true;
    a.by = p;
    p.score += a.pts;
    p.found.push(a.label);
    p.note = fr ? `Bien vu ! +${a.pts}` : `Nice! +${a.pts}`;
    sfx.pop();
    if (!p.bot) ctx.buzz(p.pid, 60);
    if (answers.every((x) => x.shown)) timer = Math.min(timer, 0.5);
  };
  function reveal() {
    phase = 'reveal';
    timer = 7;
    answers.forEach((a) => (a.shown = true));
    sfx.boom();
    ctx.refresh();
  }
  next();

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'text' || phase !== 'write' || !m.s) return;
      const p = pls.find((x) => x.pid === pid);
      if (!p || p.miss >= MISSES) return;
      const i = match(m.s);
      if (i >= 0) find(p, i);
      else {
        p.miss++;
        p.note = p.miss >= MISSES ? (fr ? '✖✖✖ Plus d’essai pour cette question !' : '✖✖✖ No tries left for this one!') : fr ? `✖ Pas dans le sondage (${MISSES - p.miss} essai${MISSES - p.miss > 1 ? 's' : ''})` : `✖ Not in the survey (${MISSES - p.miss} left)`;
        sfx.boing();
      }
      ctx.refresh();
    },
    update(dt) {
      timer -= dt;
      if (phase === 'write') {
        for (const p of pls) {
          if (!p.bot || p.miss >= MISSES || (p.botT -= dt) > 0) continue;
          p.botT = rnd(5, 12) * (1.4 - ctx.botSkill * 0.5);
          const left = answers.map((a, i) => (a.shown ? -1 : i)).filter((i) => i >= 0);
          // Les réponses les plus données sont les plus faciles à trouver
          if (left.length && Math.random() < 0.35 + ctx.botSkill * 0.35) {
            const w = left.map((i) => answers[i].pts);
            let r = Math.random() * w.reduce((a, b) => a + b, 0);
            const i = left.find((_, j) => (r -= w[j]) <= 0) ?? left[0];
            find(p, i);
            ctx.refresh();
          } else p.miss++;
        }
        const out = pls.every((p) => p.miss >= MISSES || (!p.bot && ctx.away(p.pid)));
        if (timer <= 0 || out) reveal();
      } else if (phase === 'reveal') {
        if (timer <= 0) next();
      } else if (timer <= 0) game.over = true;
    },
    render(g, t) {
      studioBackdrop(g, t, ctx.light, '#fff4d1', '#ffe2ef', '#ffc93c');
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (phase === 'end') {
        g.font = '700 72px Fredoka, sans-serif';
        g.fillText(fr ? '📊 Les rois du sondage' : '📊 Survey champions', 960, 160);
        drawRow(g, [...pls].sort((a, b) => b.score - a.score), t, (p) => `${p.profile.name}\n${p.score}`, 600, 160);
        return;
      }
      g.font = '700 38px Fredoka, sans-serif';
      g.fillText(`📊 ${fr ? 'Le Sondage du Salon' : 'The Couch Survey'} · ${round + 1}/${deck.length}${phase === 'write' ? ` · ⏱ ${Math.ceil(Math.max(0, timer))}` : ''}`, 960, 70);
      card(g, 160, 110, 1600, 150, '#fff');
      g.fillStyle = INK;
      centerText(g, `${fr ? 'On a demandé au salon' : 'We asked the room'} : ${question}`, 960, 185, 1500, 50);
      // Le tableau : 6 réponses cachées qui se retournent
      answers.forEach((a, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col ? 980 : 180;
        const y = 300 + row * 150;
        const w = 760;
        card(g, x, y, w, 126, a.shown ? (a.by ? a.by.profile.color : '#e8dcc4') : '#3a6bff');
        g.fillStyle = a.shown ? INK : '#fff';
        g.textAlign = 'left';
        g.font = '700 50px Fredoka, sans-serif';
        g.fillText(`${i + 1}`, x + 30, y + 64);
        if (a.shown) {
          g.font = '700 46px Fredoka, sans-serif';
          g.fillText(fitText(g, a.label, w - 260), x + 90, y + (a.by ? 50 : 64));
          if (a.by) {
            g.font = '700 28px Fredoka, sans-serif';
            g.fillText(`✓ ${a.by.profile.name}`, x + 90, y + 96);
          }
          g.textAlign = 'right';
          g.font = '700 56px Fredoka, sans-serif';
          g.fillText(String(a.pts), x + w - 30, y + 64);
        } else {
          g.textAlign = 'center';
          g.font = '700 46px Fredoka, sans-serif';
          g.fillText('? ? ?', x + w / 2, y + 64);
        }
        g.textAlign = 'center';
      });
      drawRow(g, pls, t, (p) => `${p.profile.name} · ${p.score}\n${'✖'.repeat(p.miss)}`, 900, 80);
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): QuizPadData {
      const p = pls.find((x) => x.pid === pid)!;
      return {
        phase,
        prompt: question,
        step: `${Math.min(round + 1, deck.length)}/${deck.length}`,
        act: phase === 'write' && p.miss < MISSES ? 'write' : null,
        options: [],
        picked: -1,
        score: p.score,
        left: phase === 'write' ? Math.ceil(Math.max(0, timer)) : 0,
        note: p.note,
        hint: fr ? 'Ta réponse (la plus courante possible)…' : 'Your answer (the most common one)…',
        chips: p.found,
      };
    },
  };
  return game;
}

// ———————————————————————————— Mot en Couleurs ————————————————————————————

interface ColPl extends Runner {
  score: number;
  tries: { w: string; marks: number[] }[];
  done: boolean;
  gain: number;
  note: string;
  botT: number;
}

/** 2 = bonne lettre bien placée, 1 = dans le mot mais ailleurs, 0 = absente. */
function marksOf(guess: string, word: string): number[] {
  const m = new Array(word.length).fill(0);
  const left: Record<string, number> = {};
  for (let i = 0; i < word.length; i++) {
    if (guess[i] === word[i]) m[i] = 2;
    else left[word[i]] = (left[word[i]] ?? 0) + 1;
  }
  for (let i = 0; i < word.length; i++)
    if (m[i] !== 2 && left[guess[i]]) {
      m[i] = 1;
      left[guess[i]]--;
    }
  return m;
}
const SQUARE = ['⬛', '🟨', '🟥'];

function createMotus(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const lang = ctx.lang;
  void loadDict(lang);
  const pls: ColPl[] = runners.slice(0, 12).map((r) => ({ ...r, score: 0, tries: [], done: false, gain: 0, note: '', botT: 0 }));
  const MAX_TRIES = 6;
  const words = freshDeck(`motus-${lang}`, COLOR_WORDS[lang], 5, (w) => w).map(plain);
  const L = words[0]?.length ?? 6;
  let round = -1;
  let phase: QuizPadData['phase'] = 'write';
  let timer = 0;
  let firstFound = '';
  const word = () => words[round] ?? '';

  function next() {
    round++;
    if (round >= words.length) {
      phase = 'end';
      timer = 6;
      sfx.win();
      ctx.refresh();
      return;
    }
    phase = 'write';
    timer = 75;
    firstFound = '';
    pls.forEach((p) => {
      p.tries = [];
      p.done = false;
      p.gain = 0;
      p.note = '';
      p.botT = rnd(6, 12);
    });
    speak(fr ? `Un mot de ${L} lettres, qui commence par ${word()[0].toUpperCase()}` : `A ${L}-letter word starting with ${word()[0].toUpperCase()}`, lang);
    sfx.whoosh();
    ctx.refresh();
  }
  const score = (p: ColPl) => {
    p.done = true;
    p.gain = MAX_TRIES + 1 - p.tries.length + (firstFound ? 0 : 2);
    if (!firstFound) firstFound = p.profile.name;
    p.score += p.gain;
    sfx.win();
    if (!p.bot) ctx.buzz(p.pid, 150);
  };
  function reveal() {
    phase = 'reveal';
    timer = 6;
    speak(fr ? `Le mot était : ${word()}` : `The word was: ${word()}`, lang);
    sfx.boom();
    ctx.refresh();
  }
  next();

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'text' || phase !== 'write' || !m.s) return;
      const p = pls.find((x) => x.pid === pid);
      if (!p || p.done || p.tries.length >= MAX_TRIES) return;
      const g = plain(m.s);
      const w = word();
      if (g.length !== w.length) p.note = fr ? `Il faut ${w.length} lettres !` : `It needs ${w.length} letters!`;
      else if (g[0] !== w[0]) p.note = fr ? `Il commence par ${w[0].toUpperCase()} !` : `It starts with ${w[0].toUpperCase()}!`;
      else if (g !== w && inDict(lang, norm(g)) === false && inDict(lang, g) === false) p.note = fr ? 'Ce mot n’existe pas !' : 'That’s not a word!';
      else {
        p.note = '';
        p.tries.push({ w: g, marks: marksOf(g, w) });
        if (g === w) score(p);
        else if (p.tries.length >= MAX_TRIES) p.note = fr ? 'Plus d’essai… regarde la télé !' : 'No tries left… watch the TV!';
        else sfx.click();
      }
      ctx.refresh();
    },
    update(dt) {
      timer -= dt;
      if (phase === 'write') {
        // Les bots : des essais de plus en plus proches (ils ne montrent que des couleurs)
        for (const p of pls) {
          if (!p.bot || p.done || p.tries.length >= MAX_TRIES || (p.botT -= dt) > 0) continue;
          p.botT = rnd(7, 14) * (1.4 - ctx.botSkill * 0.5);
          const n = p.tries.length + 1;
          const w = word();
          if (Math.random() < (n - 1) * (0.12 + ctx.botSkill * 0.1)) {
            p.tries.push({ w, marks: w.split('').map(() => 2) });
            score(p);
          } else {
            const marks = w.split('').map((_, i) => (i === 0 ? 2 : Math.random() < 0.15 * n ? 2 : Math.random() < 0.3 ? 1 : 0));
            p.tries.push({ w: '', marks });
          }
          ctx.refresh();
        }
        if (timer <= 0 || pls.every((p) => p.done || p.tries.length >= MAX_TRIES || (!p.bot && ctx.away(p.pid)))) reveal();
      } else if (phase === 'reveal') {
        if (timer <= 0) next();
      } else if (timer <= 0) game.over = true;
    },
    render(g, t) {
      studioBackdrop(g, t, ctx.light, '#e3f0ff', '#ffe6f2', '#3a6bff');
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (phase === 'end') {
        g.font = '700 72px Fredoka, sans-serif';
        g.fillText(fr ? '🟥 Les as du mot' : '🟥 Word aces', 960, 160);
        drawRow(g, [...pls].sort((a, b) => b.score - a.score), t, (p) => `${p.profile.name}\n${p.score}`, 600, 160);
        return;
      }
      const w = word();
      g.font = '700 38px Fredoka, sans-serif';
      g.fillText(`🟥 ${fr ? 'Mot en Couleurs' : 'Colour Word'} · ${round + 1}/${words.length}${phase === 'write' ? ` · ⏱ ${Math.ceil(Math.max(0, timer))}` : ''}`, 960, 70);
      // Le mot : la première lettre, puis des cases (tout est montré à la fin)
      const tile = 110;
      const x0 = 960 - (w.length * (tile + 12)) / 2 + 6;
      for (let i = 0; i < w.length; i++) {
        const show = phase === 'reveal' || i === 0;
        card(g, x0 + i * (tile + 12), 110, tile, tile, show ? (phase === 'reveal' ? ROSE : '#3a6bff') : '#fff');
        if (show) {
          g.fillStyle = '#fff';
          g.font = '700 70px Fredoka, sans-serif';
          g.fillText(w[i].toUpperCase(), x0 + i * (tile + 12) + tile / 2, 168);
        }
      }
      // Chaque joueur : ses essais en couleurs (sans les lettres, pour ne rien souffler aux autres)
      const n = pls.length;
      const cols = n > 6 ? 2 : 1;
      const per = Math.ceil(n / cols);
      const rowH = Math.min(120, 760 / per);
      pls.forEach((p, i) => {
        const col = Math.floor(i / per);
        const row = i % per;
        const bx = cols === 2 ? (col ? 1000 : 100) : 460;
        const y = 280 + row * rowH;
        drawCharacter(g, bx + 40, y + rowH * 0.78, Math.min(80, rowH * 0.8), charOf(p, t, i, p.done ? 'win' : 'happy'));
        g.fillStyle = INK;
        g.textAlign = 'left';
        g.font = '700 30px Fredoka, sans-serif';
        g.fillText(fitText(g, `${p.profile.name} · ${p.score}`, 230), bx + 90, y + rowH / 2);
        // Une rangée de petites cases par essai (rouge = bien placée, jaune = mal placée, gris = absente)
        const sq = cols === 2 ? 13 : 22;
        const tryW = w.length * (sq + 2) + 12;
        p.tries.forEach((tr, k) => {
          tr.marks.forEach((mk, j) => {
            g.fillStyle = mk === 2 ? ROSE : mk === 1 ? SOLEIL : '#cfc6d8';
            g.beginPath();
            g.roundRect(bx + 340 + k * tryW + j * (sq + 2), y + rowH / 2 - sq / 2, sq, sq, 3);
            g.fill();
          });
        });
        if (p.done) {
          g.font = '700 30px Fredoka, sans-serif';
          g.fillStyle = '#0f8a5f';
          g.fillText(`✅ +${p.gain}`, bx + 340 + Math.min(MAX_TRIES, p.tries.length) * tryW, y + rowH / 2);
        }
        g.textAlign = 'center';
      });
      if (phase === 'reveal' && firstFound) {
        g.font = '700 44px Fredoka, sans-serif';
        g.fillStyle = INK;
        g.fillText(fr ? `🏆 Premier : ${firstFound}` : `🏆 First: ${firstFound}`, 960, 1040);
      }
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): QuizPadData {
      const p = pls.find((x) => x.pid === pid)!;
      const w = word();
      return {
        phase,
        prompt: fr ? `Un mot de ${w.length} lettres` : `A ${w.length}-letter word`,
        step: `${Math.min(round + 1, words.length)}/${words.length} · ${p.tries.length}/${MAX_TRIES}`,
        act: phase === 'write' && !p.done && p.tries.length < MAX_TRIES ? 'write' : null,
        options: [],
        picked: -1,
        score: p.score,
        left: phase === 'write' ? Math.ceil(Math.max(0, timer)) : 0,
        note: p.done ? (fr ? `Trouvé ! +${p.gain}` : `Found it! +${p.gain}`) : p.note || (fr ? '🟥 bien placée · 🟨 mal placée · ⬛ absente' : '🟥 right spot · 🟨 wrong spot · ⬛ not in word'),
        hint: fr ? `${w.length} lettres, commence par ${w[0]?.toUpperCase()}` : `${w.length} letters, starts with ${w[0]?.toUpperCase()}`,
        big: w ? w[0].toUpperCase() + ' _'.repeat(w.length - 1) : '',
        chips: p.tries.map((tr) => `${tr.w.toUpperCase()} ${tr.marks.map((x) => SQUARE[x]).join('')}`),
      };
    },
  };
  return game;
}

// ———————————————————————————— Le Mot le Plus Long ————————————————————————————

interface LongPl extends Runner {
  score: number;
  best: string;
  gain: number;
  note: string;
  botWord: string;
  botT: number;
}
const VOWELS: Record<'fr' | 'en', string> = { fr: 'aaaaeeeeeeiiiioooouuy', en: 'aaaaeeeeeiiiiooouu' };
const CONSONANTS: Record<'fr' | 'en', string> = { fr: 'bbccddffgghjllllmmmnnnnpprrrrrsssssstttttvz', en: 'bbccdddffgghhllllmmnnnnnpprrrrsssssttttttvwy' };

function createLongMot(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const lang = ctx.lang;
  void loadDict(lang);
  const pls: LongPl[] = runners.slice(0, 12).map((r) => ({ ...r, score: 0, best: '', gain: 0, note: '', botWord: '', botT: 0 }));
  const ROUNDS = 5;
  let round = -1;
  let phase: QuizPadData['phase'] = 'write';
  let timer = 0;
  let letters = '';
  let topWord = '';

  const draw = () => {
    const nv = 3 + (Math.random() < 0.5 ? 1 : 0);
    const out: string[] = [];
    // Jamais plus de 2 fois la même lettre
    const add = (pool: string) => {
      let c = pickOne(pool.split(''));
      for (let k = 0; k < 20 && out.filter((x) => x === c).length >= 2; k++) c = pickOne(pool.split(''));
      out.push(c);
    };
    for (let i = 0; i < nv; i++) add(VOWELS[lang]);
    while (out.length < 9) add(CONSONANTS[lang]);
    return shuffled(out).join('');
  };
  const fits = (w: string) => {
    const have: Record<string, number> = {};
    for (const c of letters) have[c] = (have[c] ?? 0) + 1;
    for (const c of w) if (!have[c]--) return false;
    return true;
  };
  function next() {
    round++;
    if (round >= ROUNDS) {
      phase = 'end';
      timer = 6;
      sfx.win();
      ctx.refresh();
      return;
    }
    letters = draw();
    topWord = '';
    phase = 'write';
    timer = 45;
    // Les bots choisissent un mot possible (plus ou moins long selon leur niveau)
    const options = wordsFrom(lang, letters, 60, 4);
    pls.forEach((p) => {
      p.best = '';
      p.gain = 0;
      p.note = '';
      p.botT = rnd(8, 30);
      if (p.bot && options.length) {
        const k = Math.floor(Math.random() ** (0.6 + ctx.botSkill * 1.6) * options.length);
        p.botWord = options[Math.min(options.length - 1, options.length - 1 - k)];
      } else p.botWord = '';
    });
    speak(fr ? 'Le tirage est fait : trouvez le mot le plus long !' : 'Letters drawn: find the longest word!', lang);
    sfx.whoosh();
    ctx.refresh();
  }
  function reveal() {
    phase = 'reveal';
    timer = 8;
    const longest = Math.max(0, ...pls.map((p) => p.best.length));
    pls.forEach((p) => {
      p.gain = p.best.length + (p.best.length && p.best.length === longest && pls.filter((x) => x.best.length === longest).length === 1 ? 3 : 0);
      p.score += p.gain;
    });
    topWord = wordsFrom(lang, letters, 1, 4)[0] ?? '';
    speak(longest ? (fr ? `Le plus long fait ${longest} lettres !` : `The longest has ${longest} letters!`) : fr ? 'Personne n’a trouvé de mot !' : 'Nobody found a word!', lang);
    sfx.boom();
    ctx.refresh();
  }
  next();

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'text' || phase !== 'write' || !m.s) return;
      const p = pls.find((x) => x.pid === pid);
      if (!p) return;
      const w = plain(m.s);
      if (w.length < 2) return;
      if (!fits(w)) p.note = fr ? 'Pas avec ces lettres-là !' : 'Not with these letters!';
      else {
        const ok = inDict(lang, norm(w)) ?? inDict(lang, w) ?? looksReal(w);
        if (!ok) p.note = fr ? `« ${w} » n’est pas dans le dictionnaire` : `“${w}” isn’t in the dictionary`;
        else if (w.length <= p.best.length) p.note = fr ? `Tu as déjà mieux : ${p.best.toUpperCase()}` : `You already have better: ${p.best.toUpperCase()}`;
        else {
          p.best = w;
          p.note = fr ? `${w.length} lettres, bien joué !` : `${w.length} letters, nice!`;
          sfx.pop();
        }
      }
      ctx.refresh();
    },
    update(dt) {
      timer -= dt;
      if (phase === 'write') {
        for (const p of pls) {
          if (!p.bot || !p.botWord || (p.botT -= dt) > 0) continue;
          p.best = p.botWord;
          p.botWord = '';
          ctx.refresh();
        }
        if (timer <= 0) reveal();
      } else if (phase === 'reveal') {
        if (timer <= 0) next();
      } else if (timer <= 0) game.over = true;
    },
    render(g, t) {
      studioBackdrop(g, t, ctx.light, '#e8fff4', '#fff1d6', '#22c99a');
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (phase === 'end') {
        g.font = '700 72px Fredoka, sans-serif';
        g.fillText(fr ? '🔤 Les champions du dico' : '🔤 Dictionary champions', 960, 160);
        drawRow(g, [...pls].sort((a, b) => b.score - a.score), t, (p) => `${p.profile.name}\n${p.score}`, 600, 160);
        return;
      }
      g.font = '700 38px Fredoka, sans-serif';
      g.fillText(`🔤 ${fr ? 'Le Mot le Plus Long' : 'The Longest Word'} · ${round + 1}/${ROUNDS}${phase === 'write' ? ` · ⏱ ${Math.ceil(Math.max(0, timer))}` : ''}`, 960, 70);
      // Le tirage : 9 lettres en grandes tuiles
      const tile = 150;
      const x0 = 960 - (9 * (tile + 14)) / 2 + 7;
      for (let i = 0; i < letters.length; i++) {
        const x = x0 + i * (tile + 14);
        const y = 130 + Math.sin(t * 2 + i) * 4;
        card(g, x, y, tile, tile, 'aeiouy'.includes(letters[i]) ? ROSE : '#3a6bff');
        g.fillStyle = '#fff';
        g.font = '700 96px Fredoka, sans-serif';
        g.fillText(letters[i].toUpperCase(), x + tile / 2, y + tile / 2 + 4);
      }
      // Pendant la manche : seulement la longueur de chaque mot ; à la fin, les mots
      const n = pls.length;
      const cols = n > 6 ? 2 : 1;
      const per = Math.ceil(n / cols);
      const rowH = Math.min(110, 640 / per);
      pls.forEach((p, i) => {
        const col = Math.floor(i / per);
        const row = i % per;
        const bx = cols === 2 ? (col ? 1000 : 100) : 520;
        const y = 330 + row * rowH;
        drawCharacter(g, bx + 40, y + rowH * 0.78, Math.min(76, rowH * 0.8), charOf(p, t, i, phase === 'reveal' && p.gain > p.best.length ? 'win' : 'happy'));
        g.fillStyle = INK;
        g.textAlign = 'left';
        g.font = '700 30px Fredoka, sans-serif';
        g.fillText(fitText(g, `${p.profile.name} · ${p.score}`, 240), bx + 90, y + rowH / 2);
        g.font = '700 34px Fredoka, sans-serif';
        const lab = phase === 'reveal' ? (p.best ? `${p.best.toUpperCase()} (${p.best.length}) +${p.gain}` : '—') : p.best ? `✅ ${p.best.length} ${fr ? 'lettres' : 'letters'}` : '…';
        g.fillText(fitText(g, lab, 470), bx + 350, y + rowH / 2);
        g.textAlign = 'center';
      });
      if (phase === 'reveal' && topWord) {
        g.font = '700 40px Fredoka, sans-serif';
        g.fillStyle = INK;
        g.fillText(fr ? `📖 Le plus long possible : ${topWord.toUpperCase()} (${topWord.length})` : `📖 Longest possible: ${topWord.toUpperCase()} (${topWord.length})`, 960, 1035);
      }
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): QuizPadData {
      const p = pls.find((x) => x.pid === pid)!;
      return {
        phase,
        prompt: fr ? 'Le mot le plus long avec ces lettres :' : 'The longest word with these letters:',
        step: `${Math.min(round + 1, ROUNDS)}/${ROUNDS}`,
        act: phase === 'write' ? 'write' : null,
        options: [],
        picked: -1,
        score: p.score,
        left: phase === 'write' ? Math.ceil(Math.max(0, timer)) : 0,
        note: p.note,
        hint: fr ? 'Ton mot (tu peux en envoyer plusieurs)' : 'Your word (you can send several)',
        big: letters.toUpperCase().split('').join(' '),
        chips: p.best ? [`${p.best.toUpperCase()} (${p.best.length})`] : [],
      };
    },
  };
  return game;
}

// ———————————————————————————— Le Mème Mystère ————————————————————————————

interface MemePl extends Runner {
  score: number;
  gain: number;
  done: boolean;
  note: string;
  botT: number;
}

function createMeme(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const lang = ctx.lang;
  const pls: MemePl[] = runners.slice(0, 12).map((r) => ({ ...r, score: 0, gain: 0, done: false, note: '', botT: 0 }));
  const ROUNDS = 8;
  const CLUE = 10;
  // Surtout des mèmes récents, avec quelques classiques
  const okLang = (m: (typeof MEMES)[number]) => fr || m[5] !== 'fr';
  const deck = shuffled([...freshDeck('meme-new', MEMES_RECENT.filter(okLang), 5, (m) => m[4]), ...freshDeck('meme', MEMES.filter(okLang), ROUNDS - 5, (m) => m[4])]);
  // Les vraies vidéos des mèmes (GIPHY), cherchées dès le début ; sans clé ou sans réseau, on reste aux emojis
  const clips: (MemeClip | null)[] = deck.map(() => null);
  deck.forEach((m, i) =>
    void findMemeClip(m[3].split('/')[0] + ' meme', ctx.family, lang).then((c) => {
      clips[i] = c;
      if (i === round && c && !video) video = memeVideo(c);
    }),
  );
  let video: HTMLVideoElement | null = null;
  const small = document.createElement('canvas');
  const stopVideo = () => {
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
    video = null;
  };
  let round = -1;
  let phase: QuizPadData['phase'] = 'write';
  let timer = 0;
  let clock = 0;
  let first = '';
  const cur = () => deck[round];
  /** Indices montrés : 1 = emojis, 2 = + description, 3 = + première lettre. */
  const clues = () => Math.min(3, 1 + Math.floor(clock / CLUE));
  const answer = () => cur()?.[4] ?? '';
  const hint3 = () => {
    const a = answer().replace(/[«»“”]/g, '').trim();
    const words = a.split(/\s+/).length;
    return fr ? `Commence par « ${a[0]?.toUpperCase()} » · ${words} mot${words > 1 ? 's' : ''} · ${plain(a).length} lettres` : `Starts with “${a[0]?.toUpperCase()}” · ${words} word${words > 1 ? 's' : ''} · ${plain(a).length} letters`;
  };
  const good = (raw: string) => {
    const k = plain(raw);
    if (k.length < 2) return false;
    return (cur()?.[3] ?? '').split('/').map(plain).some((a) => a === k || (a.length >= 4 && k.includes(a)) || (k.length >= Math.max(4, a.length - 3) && a.includes(k)));
  };

  function next() {
    round++;
    stopVideo();
    if (round >= deck.length) {
      phase = 'end';
      timer = 6;
      sfx.win();
      ctx.refresh();
      return;
    }
    if (clips[round]) video = memeVideo(clips[round]!);
    phase = 'write';
    clock = 0;
    timer = CLUE * 3;
    first = '';
    pls.forEach((p) => {
      p.gain = 0;
      p.done = false;
      p.note = '';
      p.botT = rnd(4, 28);
    });
    speak(fr ? 'Quel est ce mème ?' : 'Which meme is this?', lang);
    sfx.whoosh();
    ctx.refresh();
  }
  const win = (p: MemePl) => {
    p.done = true;
    p.gain = [5, 3, 2][clues() - 1] + (first ? 0 : 1);
    if (!first) first = p.profile.name;
    p.score += p.gain;
    p.note = fr ? `Trouvé ! +${p.gain}` : `Got it! +${p.gain}`;
    sfx.pop();
    if (!p.bot) ctx.buzz(p.pid, 120);
  };
  function reveal() {
    phase = 'reveal';
    timer = 6;
    speak(fr ? `C’était : ${answer()}` : `It was: ${answer()}`, lang);
    sfx.boom();
    ctx.refresh();
  }
  next();

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'text' || phase !== 'write' || !m.s) return;
      const p = pls.find((x) => x.pid === pid);
      if (!p || p.done) return;
      if (good(m.s)) win(p);
      else {
        p.note = fr ? `✖ Non, ce n’est pas « ${m.s.slice(0, 24)} »` : `✖ No, it’s not “${m.s.slice(0, 24)}”`;
        sfx.boing();
      }
      ctx.refresh();
    },
    update(dt) {
      timer -= dt;
      if (phase === 'write') {
        const before = clues();
        clock += dt;
        if (clues() !== before) {
          sfx.whoosh();
          ctx.refresh();
        }
        for (const p of pls) {
          if (!p.bot || p.done || (p.botT -= dt) > 0) continue;
          p.botT = 99;
          if (Math.random() < 0.45 + ctx.botSkill * 0.4) {
            win(p);
            ctx.refresh();
          }
        }
        if (timer <= 0 || pls.every((p) => p.done || (!p.bot && ctx.away(p.pid)))) reveal();
      } else if (phase === 'reveal') {
        if (timer <= 0) next();
      } else if (timer <= 0) {
        stopVideo();
        game.over = true;
      }
    },
    render(g, t) {
      studioBackdrop(g, t, ctx.light, '#efe4ff', '#e0fff2', '#9b5cff');
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (phase === 'end') {
        g.font = '700 72px Fredoka, sans-serif';
        g.fillText(fr ? '🤳 Les rois des mèmes' : '🤳 Meme masters', 960, 160);
        drawRow(g, [...pls].sort((a, b) => b.score - a.score), t, (p) => `${p.profile.name}\n${p.score}`, 600, 160);
        return;
      }
      const m = cur();
      const n = phase === 'reveal' ? 3 : clues();
      g.font = '700 38px Fredoka, sans-serif';
      g.fillText(`🤳 ${fr ? 'Le Mème Mystère' : 'Mystery Meme'} · ${round + 1}/${deck.length}${phase === 'write' ? ` · ⏱ ${Math.ceil(Math.max(0, timer))}` : ''}`, 960, 70);
      const vid = video && video.readyState >= 2 && video.videoWidth ? video : null;
      if (vid) {
        // Indice 1 : la vidéo très pixelisée ; 2 : moins ; 3 et la réponse : nette
        const bw = 900;
        const bh = 320;
        const k = Math.min(bw / vid.videoWidth, bh / vid.videoHeight);
        const w = vid.videoWidth * k;
        const h = vid.videoHeight * k;
        const x = 960 - w / 2;
        const y = 104 + (bh - h) / 2;
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(x - 8, y - 8 + 8, w + 16, h + 16, 18);
        g.fill();
        const px = phase === 'reveal' || n >= 3 ? 0 : n === 2 ? 46 : 18;
        g.save();
        g.beginPath();
        g.roundRect(x, y, w, h, 12);
        g.clip();
        if (px) {
          small.width = px;
          small.height = Math.max(1, Math.round((px * h) / w));
          small.getContext('2d')!.drawImage(vid, 0, 0, small.width, small.height);
          g.imageSmoothingEnabled = false;
          g.drawImage(small, x, y, w, h);
          g.imageSmoothingEnabled = true;
        } else g.drawImage(vid, x, y, w, h);
        g.restore();
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(x, y, w, h, 12);
        g.stroke();
        // Mention obligatoire de GIPHY
        g.fillStyle = INK;
        g.textAlign = 'right';
        g.font = '700 28px Fredoka, sans-serif';
        g.fillText('Powered by GIPHY', x + w, y + h + 30);
        g.textAlign = 'right';
        g.font = '64px sans-serif';
        g.fillStyle = '#000';
        g.fillText(m[0], x - 28, y + 60);
        g.textAlign = 'center';
      }
      // Indice 1 (sans vidéo) : les emojis, en très grand
      if (!vid) card(g, 560, 110, 800, 230, '#fff');
      // Les emojis prennent la transparence de la couleur de remplissage : on la remet opaque
      g.fillStyle = '#000';
      g.font = '150px sans-serif';
      if (!vid) g.fillText(m[0], 960, 232);
      // Avec la vidéo, tout le reste descend un peu
      const dy = vid ? 111 : 0;
      // Indice 2 : la description
      if (n >= 2) {
        card(g, 160, 365 + dy, 1600, vid ? 120 : 190, '#fff7c9');
        g.fillStyle = INK;
        centerText(g, fr ? m[1] : m[2], 960, (vid ? 425 : 460) + dy, 1500, vid ? 38 : 44);
      } else {
        g.font = '700 40px Fredoka, sans-serif';
        g.fillStyle = 'rgba(58,33,64,0.5)';
        g.fillText(fr ? `Indice suivant dans ${Math.ceil(CLUE - clock)} s…` : `Next clue in ${Math.ceil(CLUE - clock)} s…`, 960, 460 + dy);
      }
      // Indice 3 : la première lettre ; à la fin, la réponse
      g.fillStyle = INK;
      if (phase === 'reveal') {
        card(g, 360, vid ? 612 : 585, 1200, vid ? 90 : 130, ROSE);
        g.fillStyle = '#fff';
        g.font = `700 ${vid ? 54 : 64}px Fredoka, sans-serif`;
        g.fillText(fitText(g, answer(), 1140), 960, vid ? 658 : 652);
      } else if (n >= 3) {
        card(g, 360, vid ? 612 : 585, 1200, vid ? 86 : 110, '#e3f2ff');
        g.fillStyle = INK;
        g.font = '700 44px Fredoka, sans-serif';
        g.fillText(fitText(g, hint3(), 1140), 960, vid ? 656 : 642);
      }
      g.fillStyle = INK;
      g.font = '700 32px Fredoka, sans-serif';
      g.fillText(vid ? (fr ? '⭐ 5 pts tout flou · 3 avec la description · 2 avec la lettre · +1 au premier' : '⭐ 5 pts while blurry · 3 on description · 2 on letter · +1 for first') : fr ? '⭐ 5 pts avec les emojis · 3 avec la description · 2 avec la lettre · +1 au premier' : '⭐ 5 pts on emojis · 3 on description · 2 on letter · +1 for first', 960, vid ? 738 : 730, 1800);
      drawRow(g, pls, t, (p) => (p.done ? `✅ ${p.profile.name}\n+${p.gain}` : `${p.profile.name}\n${p.score}`), 870, 96);
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): QuizPadData {
      const p = pls.find((x) => x.pid === pid)!;
      const m = cur();
      const n = clues();
      return {
        phase,
        prompt: fr ? 'Quel est ce mème ?' : 'Which meme is this?',
        step: `${Math.min(round + 1, deck.length)}/${deck.length}`,
        act: phase === 'write' && !p.done ? 'write' : null,
        options: [],
        picked: -1,
        score: p.score,
        left: phase === 'write' ? Math.ceil(Math.max(0, timer)) : 0,
        note: p.note || (n >= 2 && m ? (fr ? m[1] : m[2]) : ''),
        hint: fr ? 'Le nom du mème…' : 'The meme’s name…',
        big: m ? m[0] : '',
        chips: n >= 3 && phase === 'write' ? [hint3()] : [],
      };
    },
  };
  return game;
}

// ———————————————————————————— Fiches des jeux ————————————————————————————

export const duos: GameBase = {
  id: 'duos',
  emoji: '💞',
  name: { fr: 'Les Inséparables', en: 'The Inseparables' },
  how: { fr: 'Par duos : répondez pareil sans vous concerter, et désignez la même personne !', en: 'In pairs: give the same answer without talking, and point at the same person!' },
  layout: 'buttons',
  min: 2,
  max: 12,
  botFill: 4,
  music: 'party',
  create: createDuos,
};

export const sondage: GameBase = {
  id: 'sondage',
  emoji: '📊',
  name: { fr: 'Le Sondage du Salon', en: 'The Couch Survey' },
  how: { fr: 'Trouve les réponses les plus données au sondage. Plus elle est courante, plus elle rapporte !', en: 'Find the most popular survey answers. The more common, the more points!' },
  layout: 'buttons',
  min: 2,
  max: 12,
  botFill: 3,
  music: 'party',
  create: createSondage,
};

export const motus: GameBase = {
  id: 'motus',
  emoji: '🟥',
  name: { fr: 'Mot en Couleurs', en: 'Colour Word' },
  how: { fr: 'Devine le mot en 6 essais : rouge = bien placée, jaune = mal placée. Le plus rapide gagne gros !', en: 'Guess the word in 6 tries: red = right spot, yellow = wrong spot. Fastest wins big!' },
  layout: 'buttons',
  min: 1,
  max: 12,
  botFill: 3,
  music: 'party',
  create: createMotus,
};

export const longmot: GameBase = {
  id: 'longmot',
  emoji: '🔤',
  name: { fr: 'Le Mot le Plus Long', en: 'The Longest Word' },
  how: { fr: '9 lettres tirées au hasard : trouve le mot le plus long. Une lettre = un point, le plus long seul = bonus !', en: '9 random letters: find the longest word. One letter = one point, sole longest = bonus!' },
  layout: 'buttons',
  min: 1,
  max: 12,
  botFill: 3,
  music: 'party',
  create: createLongMot,
};

export const meme: GameBase = {
  id: 'meme',
  emoji: '🤳',
  name: { fr: 'Le Mème Mystère', en: 'Mystery Meme' },
  how: { fr: 'Devine le mème à partir d’emojis, puis d’une description, puis de sa première lettre. Plus tu trouves tôt, plus ça rapporte !', en: 'Guess the meme from emojis, then a description, then its first letter. The sooner, the more points!' },
  layout: 'buttons',
  min: 1,
  max: 12,
  botFill: 3,
  music: 'party',
  create: createMeme,
};

void candy;
