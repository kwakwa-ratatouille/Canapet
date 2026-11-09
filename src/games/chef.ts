// Code Canapé : deux équipes, 25 mots à double sens. L'agent de chaque équipe sait quels mots sont à la sienne,
// et donne un indice d'un seul mot + un nombre. Son équipe doit trouver ses mots sans tomber sur ceux des autres,
// ni sur le mot maudit qui fait perdre tout de suite. Les agents voient les couleurs sur leur téléphone.
// (Fichier et identifiant « chef » gardés pour ne rien casser.)
import { INK } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import type { ChefPadData } from './chefShared';
import { freshDeck } from './decks';
import { candy } from './draw';
import { CODE_WORDS } from './codeWords';
import { norm } from './lettre';
import { TEAMS } from './teams';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

interface Card {
  w: string;
  key: number;
  /** Les thèmes auxquels le mot fait penser (pour l'agent bot). */
  tags: string[];
  owner: number;
  votes: Set<string>;
}
/** Petit « +1 » qui s'envole d'une carte trouvée vers le panneau de l'équipe. */
interface Pop {
  x: number;
  y: number;
  side: number;
  t: number;
}
interface Pl extends Runner {
  side: number;
}
const NEUTRAL = '#e8dcc4';
const CURSED = '#3a2140';

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const lang = ctx.lang;
  const pls: Pl[] = runners.map((r, i) => ({ ...r, side: r.team ?? i % 2 }));
  const teamOf = (s: number) => pls.filter((p) => p.side === s);
  const humansOf = (s: number) => teamOf(s).filter((p) => !p.bot);
  // Un vrai chef s'il y a au moins 2 humains dans l'équipe ; sinon le chef est un bot, et l'humain cherche
  const chefs = [0, 1].map((s) => (humansOf(s).length >= 2 ? humansOf(s)[Math.floor(Math.random() * humansOf(s).length)] : null));
  /** Un chef parti est remplacé par un bot, et on n'attend plus les absents. */
  const chefOf = (s: number) => (chefs[s] && !ctx.away(chefs[s]!.pid) ? chefs[s] : null);
  const guessers = (s: number) => humansOf(s).filter((p) => p !== chefOf(s) && !ctx.away(p.pid));

  // La grille : 25 mots à double sens, jamais les mêmes d'une partie à l'autre (tant qu'il en reste)
  const words = freshDeck(`code-${lang}`, CODE_WORDS[lang], 25, (x) => x.w);
  const first = Math.random() < 0.5 ? 0 : 1;
  const keys = [...Array(first === 0 ? 9 : 8).fill(0), ...Array(first === 1 ? 9 : 8).fill(1), ...Array(7).fill(2), 3].sort(() => Math.random() - 0.5);
  const cards: Card[] = words.map((x, i) => ({ w: x.w, key: keys[i], tags: x.tags, owner: -1, votes: new Set() }));
  const total = [0, 1].map((s) => cards.filter((c) => c.key === s).length);
  const pops: Pop[] = [];
  const used = new Set<string>();
  /** Le nom de l'agent de chaque équipe (bot si l'équipe n'a pas 2 humains). */
  const agentName = (s: number) => chefOf(s)?.profile.name ?? (fr ? 'Agent bot' : 'Bot agent');

  let turn = first;
  let phase: ChefPadData['phase'] = 'clue';
  let timer = 0;
  let clue = '';
  let count = 0;
  let tries = 0;
  let winner = -1;
  let why = '';
  let botT = 0;
  let found = false;
  let calm = 0;
  let turns = 0;
  const notes = new Map<string, string>();
  const leftOf = (s: number) => cards.filter((c) => c.key === s && c.owner < 0).length;

  const startClue = () => {
    cards.forEach((c) => c.votes.clear());
    clue = '';
    count = 0;
    tries = 0;
    found = false;
    phase = 'clue';
    timer = 75;
    botT = 2.5 + Math.random() * 2;
    speak(fr ? `À l'agent ${TEAMS[turn].name.fr}` : `${TEAMS[turn].name.en} agent’s turn`, lang);
    ctx.refresh();
  };
  const startGuess = () => {
    phase = 'guess';
    timer = 60;
    botT = 2.5 + Math.random() * 2;
    sfx.go();
    speak(`${clue}, ${count}`, lang);
    ctx.refresh();
  };
  const setClue = (text: string, n: number) => {
    clue = text;
    count = n;
    tries = n + 1;
    startGuess();
  };
  const finish = (w: number, text: string) => {
    winner = w;
    why = text;
    phase = 'end';
    timer = 7;
    cards.forEach((c) => {
      if (c.owner < 0) c.owner = c.key;
    });
    sfx.win();
    speak(`${TEAMS[w].name[lang]} ${fr ? 'gagne !' : 'wins!'}`, lang);
    ctx.refresh();
  };
  const endTurn = () => {
    // Personne ne joue plus, ou la partie s'éternise : on s'arrête avec le score du moment
    calm = found ? 0 : calm + 1;
    turns++;
    if (calm >= 4 || turns >= 20) {
      const w = leftOf(0) === leftOf(1) ? 1 - turn : leftOf(0) < leftOf(1) ? 0 : 1;
      return finish(w, fr ? 'Il lui restait le moins de mots !' : 'It had the fewest words left!');
    }
    turn = 1 - turn;
    startClue();
  };
  const reveal = (c: Card) => {
    c.owner = c.key;
    cards.forEach((x) => x.votes.clear());
    found = true;
    botT = 2 + Math.random() * 2;
    if (c.key === 3) {
      sfx.boom();
      return finish(1 - turn, fr ? `${TEAMS[turn].name.fr} a trouvé le mot maudit !` : `${TEAMS[turn].name.en} found the cursed word!`);
    }
    if (leftOf(0) === 0) return finish(0, fr ? 'Tous ses mots sont trouvés !' : 'All its words found!');
    if (leftOf(1) === 0) return finish(1, fr ? 'Tous ses mots sont trouvés !' : 'All its words found!');
    if (c.key < 2) {
      const i = cards.indexOf(c);
      pops.push({ x: 62 + (i % 5) * 364 + 177, y: 236 + Math.floor(i / 5) * 158 + 75, side: c.key, t: 0 });
    }
    if (c.key === turn) {
      sfx.pop();
      tries--;
      if (tries <= 0) return endTurn();
      ctx.refresh();
      return;
    }
    sfx.boing();
    endTurn();
  };

  /** L'agent bot : un thème qui relie plusieurs mots de son équipe, jamais le mot maudit, le moins possible ceux des autres. */
  const botClue = () => {
    const open = cards.filter((c) => c.owner < 0);
    const mine = open.filter((c) => c.key === turn);
    if (!mine.length) return endTurn();
    const onGrid = new Set(open.map((c) => norm(c.w)));
    let best = '';
    let bestScore = -99;
    let bestN = 0;
    const tags = new Set(mine.flatMap((c) => c.tags));
    for (const tag of tags) {
      if (onGrid.has(norm(tag))) continue;
      const has = (c: Card) => c.tags.includes(tag);
      if (open.some((c) => c.key === 3 && has(c))) continue;
      const n = mine.filter(has).length;
      const other = open.filter((c) => c.key === 1 - turn && has(c)).length;
      const neutral = open.filter((c) => c.key === 2 && has(c)).length;
      // Un bot moins fort prend plus de risques ; un indice déjà donné vaut moins
      const score = n * 1.2 - other * (0.5 + ctx.botSkill * 0.6) - neutral * 0.3 - (used.has(tag) ? 0.8 : 0) + Math.random() * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = tag;
        bestN = n;
      }
    }
    if (!best) {
      // Rien de sûr : un seul mot, par un de ses thèmes
      const c = mine[Math.floor(Math.random() * mine.length)];
      best = c.tags[0];
      bestN = 1;
    }
    used.add(best);
    setClue(best, Math.max(1, Math.min(4, bestN)));
  };
  /** Le bot qui cherche, quand l'équipe n'a aucun humain pour le faire. */
  const botGuess = () => {
    const open = cards.filter((c) => c.owner < 0);
    const good = open.filter((c) => c.key === turn);
    const skill = 0.6 + ctx.botSkill * 0.3;
    // L'indice est un thème connu : on tente un mot qui va avec (sans voir les couleurs)
    const fits = open.filter((c) => c.tags.some((tg) => norm(tg) === norm(clue)));
    const c = fits.length && Math.random() < skill ? fits[Math.floor(Math.random() * fits.length)] : Math.random() < skill * 0.8 && good.length ? good[Math.floor(Math.random() * good.length)] : open.filter((x) => x.key !== 3)[Math.floor(Math.random() * Math.max(1, open.length - 1))];
    if (c) reveal(c);
    else endTurn();
    if (phase === 'guess' && tries <= 1) endTurn();
  };

  startClue();

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const p = pls.find((x) => x.pid === pid);
      if (!p || p.side !== turn) return;
      if (m.a === 'clue' && phase === 'clue' && chefOf(turn) === p && m.s) {
        const text = m.s.trim().slice(0, 24);
        const n = Math.max(1, Math.min(9, m.n?.[0] ?? 1));
        if (!text) return;
        if (/\s/.test(text)) {
          notes.set(pid, fr ? 'Un seul mot !' : 'One word only!');
          ctx.refresh();
          return;
        }
        if (cards.some((c) => c.owner < 0 && norm(c.w) === norm(text))) {
          notes.set(pid, fr ? 'Ce mot est sur la grille !' : 'That word is on the grid!');
          ctx.refresh();
          return;
        }
        notes.delete(pid);
        setClue(text, n);
      }
      if (phase !== 'guess' || chefOf(turn) === p) return;
      if (m.a === 'guess') {
        const c = cards[m.n?.[0] ?? -1];
        if (!c || c.owner >= 0) return;
        cards.forEach((x) => x.votes.delete(pid));
        c.votes.add(pid);
        sfx.click();
        // Dès que plus de la moitié des chercheurs sont d'accord, on retourne le mot
        if (c.votes.size * 2 > Math.max(1, guessers(turn).length)) reveal(c);
        else ctx.refresh();
      }
      if (m.a === 'pass' && found) endTurn();
    },
    update(dt) {
      timer -= dt;
      for (const p of pops) p.t += dt;
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].t > 1.1) pops.splice(i, 1);
      if (phase === 'clue') {
        if (!chefOf(turn) && (botT -= dt) <= 0) botClue();
        else if (timer <= 0) endTurn();
      } else if (phase === 'guess') {
        if (!guessers(turn).length && (botT -= dt) <= 0) botGuess();
        else if (timer <= 0) endTurn();
      } else if (timer <= 0) game.over = true;
    },
    render(g, t) {
      g.fillStyle = '#fff3d6';
      g.fillRect(0, 0, 1920, 1080);
      // Les deux équipes : nom en grand, mots trouvés (points), qui est l'agent, et à qui c'est
      [0, 1].forEach((s) => {
        const x0 = s ? 1300 : 20;
        const on = turn === s && phase !== 'end';
        const won = phase === 'end' && winner === s;
        const bob = on ? Math.sin(t * 5) * 3 : 0;
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(x0, 18 + bob, 600, 124, 30);
        g.fill();
        g.fillStyle = TEAMS[s].color;
        g.strokeStyle = on || won ? '#ffd60a' : INK;
        g.lineWidth = on || won ? 9 : 5;
        g.beginPath();
        g.roundRect(x0, 10 + bob, 600, 124, 30);
        g.fill();
        g.stroke();
        candy(g, x0, 10 + bob, 600, 124, 30);
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.font = '700 46px Fredoka, sans-serif';
        g.lineWidth = 8;
        g.strokeStyle = INK;
        const title = `${TEAMS[s].emoji} ${TEAMS[s].name[lang]}`;
        g.strokeText(title, x0 + 24, 50 + bob, 400);
        g.fillStyle = '#fff';
        g.fillText(title, x0 + 24, 50 + bob, 400);
        g.font = '700 30px Fredoka, sans-serif';
        g.fillStyle = INK;
        g.fillText(`🕵️ ${agentName(s)}`, x0 + 24, 104 + bob, 330);
        // Les points : mots trouvés sur le total, en gros, avec des pastilles
        const got = total[s] - leftOf(s);
        g.textAlign = 'right';
        g.font = '700 64px Fredoka, sans-serif';
        g.lineWidth = 9;
        g.strokeStyle = INK;
        g.strokeText(`${got}/${total[s]}`, x0 + 580, 56 + bob);
        g.fillStyle = '#fff';
        g.fillText(`${got}/${total[s]}`, x0 + 580, 56 + bob);
        for (let k = 0; k < total[s]; k++) {
          g.fillStyle = k < got ? '#fff' : 'rgba(58,33,64,0.25)';
          g.strokeStyle = INK;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(x0 + 580 - (total[s] - 1 - k) * 24 - 10, 108 + bob, 9, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
        if (on) {
          // L'étiquette pointe vers l'équipe qui joue, sans toucher son panneau
          g.textAlign = s ? 'right' : 'left';
          g.font = '700 34px Fredoka, sans-serif';
          g.fillStyle = '#ffd60a';
          g.strokeStyle = INK;
          g.lineWidth = 7;
          const tx = s ? x0 - 22 : x0 + 622;
          const lab = s ? (fr ? 'À vous ! ▶' : 'Your turn! ▶') : fr ? '◀ À vous !' : '◀ Your turn!';
          g.strokeText(lab, tx, 72);
          g.fillText(lab, tx, 72);
        }
      });
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '700 50px Fredoka, sans-serif';
      if (phase !== 'end') g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 960, 72);
      // L'indice, le plus visible possible
      g.font = '700 54px Fredoka, sans-serif';
      if (phase === 'clue') g.fillText(fr ? `🤫 L'agent ${TEAMS[turn].name.fr} cherche son indice…` : `🤫 The ${TEAMS[turn].name.en} agent is thinking…`, 960, 186, 1800);
      else if (phase === 'guess') g.fillText(`💡 ${clue} · ${count}   ${fr ? `(encore ${tries} essai${tries > 1 ? 's' : ''})` : `(${tries} tr${tries > 1 ? 'ies' : 'y'} left)`}`, 960, 186, 1800);
      else g.fillText(`🏆 ${TEAMS[winner].name[lang]} — ${why}`, 960, 186, 1800);
      // La grille
      const w = 354;
      const h = 150;
      cards.forEach((c, i) => {
        const x = 62 + (i % 5) * (w + 10);
        const y = 236 + Math.floor(i / 5) * (h + 8);
        const shown = c.owner >= 0;
        g.fillStyle = !shown ? '#fff' : c.owner === 3 ? CURSED : c.owner === 2 ? NEUTRAL : TEAMS[c.owner].color;
        g.strokeStyle = c.votes.size ? '#ff9a1f' : INK;
        g.lineWidth = c.votes.size ? 10 : 5;
        g.beginPath();
        g.roundRect(x, y, w, h, 22);
        g.fill();
        g.stroke();
        if (!shown || c.owner < 2) candy(g, x, y, w, h, 22);
        g.fillStyle = shown && (c.owner === 3 || c.owner < 2) ? '#fff' : INK;
        g.font = `700 ${c.w.length > 9 ? 40 : 48}px Fredoka, sans-serif`;
        g.textAlign = 'center';
        g.fillText(`${c.owner === 3 ? '💀 ' : ''}${c.w}`, x + w / 2, y + h / 2 + 2, w - 24);
        if (c.votes.size) {
          g.fillStyle = '#ff9a1f';
          g.beginPath();
          g.arc(x + w - 32, y + 32, 24, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#fff';
          g.font = '700 30px Fredoka, sans-serif';
          g.fillText(String(c.votes.size), x + w - 32, y + 34);
        }
      });
      // « +1 » qui s'envole vers l'équipe qui a trouvé
      for (const p of pops) {
        const k = Math.min(1, p.t / 0.9);
        const tx = p.side ? 1880 : 560;
        const x = p.x + (tx - p.x) * k * k;
        const y = p.y + (60 - p.y) * k * k - Math.sin(k * Math.PI) * 120;
        g.globalAlpha = 1 - Math.max(0, k - 0.8) * 5;
        g.font = '700 70px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 10;
        g.strokeStyle = INK;
        g.strokeText('+1', x, y);
        g.fillStyle = TEAMS[p.side].color;
        g.fillText('+1', x, y);
        g.globalAlpha = 1;
      }
    },
    ranking() {
      const lead = winner >= 0 ? winner : leftOf(0) <= leftOf(1) ? 0 : 1;
      return [...teamOf(lead), ...teamOf(1 - lead)].map((p) => p.pid);
    },
    leader: () => null,
    padData(pid): ChefPadData {
      const p = pls.find((x) => x.pid === pid)!;
      const isChef = chefOf(p.side) === p;
      return {
        phase,
        role: isChef ? 'chef' : p.side === turn ? 'guess' : 'watch',
        team: TEAMS[p.side].name[lang],
        color: TEAMS[p.side].color,
        turnTeam: TEAMS[turn].name[lang],
        clue,
        count,
        tries,
        left: Math.ceil(Math.max(0, timer)),
        cards: cards.map((c) => ({ w: c.w, owner: c.owner, key: isChef ? c.key : undefined, votes: c.votes.size })),
        voted: cards.findIndex((c) => c.votes.has(pid)),
        canPass: found,
        note: notes.get(pid) ?? '',
        win: phase === 'end' ? `${TEAMS[winner].name[lang]} ${fr ? 'gagne !' : 'wins!'}` : '',
      };
    },
  };
  return game;
}

export const chef: GameBase = {
  id: 'chef',
  emoji: '🕵️',
  name: { fr: 'Code Canapé', en: 'Couch Code' },
  how: {
    fr: 'Deux équipes, 25 mots à double sens. L’agent donne un indice d’un mot et un nombre : son équipe doit trouver ses mots sans toucher au mot maudit !',
    en: 'Two teams, 25 words with double meanings. The agent gives a one-word clue and a number: the team must find its words and avoid the cursed one!',
  },
  layout: 'buttons',
  min: 2,
  max: 12,
  botFill: 4,
  music: 'spy',
  create,
};
