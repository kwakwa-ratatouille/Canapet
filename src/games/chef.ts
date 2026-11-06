// Le Chef Cachottier : deux brigades, 25 mots. Le chef de chaque équipe sait quels mots sont à la sienne,
// et donne un indice d'un seul mot + un nombre. Son équipe doit trouver ses mots sans tomber sur ceux des autres,
// ni sur le mot maudit qui fait perdre tout de suite. Les chefs voient les couleurs sur leur téléphone.
import { INK } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import type { ChefPadData } from './chefShared';
import { freshDeck } from './decks';
import { candy } from './draw';
import { LETTER_THEMES } from './lettreWords';
import { norm } from './lettre';
import { TEAMS } from './teams';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

interface Card {
  w: string;
  key: number;
  theme: string;
  themeEn: string;
  owner: number;
  votes: Set<string>;
}
interface Pl extends Runner {
  side: number;
}
const NEUTRAL = '#e8dcc4';
const CURSED = '#3a2140';
/** Thèmes trop vastes ou trop bizarres pour servir ici. */
const SKIP = new Set(['Un prénom', 'Un verbe d’action', 'Un mot en anglais', 'Une insulte rigolote', 'Un chanteur ou un groupe', 'Une personne célèbre', 'Un film ou une série', 'Une émotion', 'Une couleur']);

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

  // La grille : quelques thèmes, plusieurs mots par thème
  const themes = freshDeck(`chef-${lang}`, LETTER_THEMES.filter((t) => !t.adult && !SKIP.has(t.fr)), 10, (t) => t.fr);
  const pool: { w: string; t: (typeof themes)[number] }[] = [];
  const seen = new Set<string>();
  for (const t of themes) {
    const list = t.words[lang].split(' ').filter((w) => !w.includes('_') && w.length >= 3 && w.length <= 11).sort(() => Math.random() - 0.5);
    let n = 0;
    for (const w of list) {
      if (n >= 4 || seen.has(norm(w))) continue;
      seen.add(norm(w));
      pool.push({ w, t });
      n++;
    }
  }
  const words = pool.sort(() => Math.random() - 0.5).slice(0, 25);
  const first = Math.random() < 0.5 ? 0 : 1;
  const keys = [...Array(first === 0 ? 9 : 8).fill(0), ...Array(first === 1 ? 9 : 8).fill(1), ...Array(7).fill(2), 3].sort(() => Math.random() - 0.5);
  const cards: Card[] = words.map((x, i) => ({ w: x.w.charAt(0).toUpperCase() + x.w.slice(1), key: keys[i], theme: x.t.fr, themeEn: x.t.en, owner: -1, votes: new Set() }));

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
    speak(fr ? `Au chef ${TEAMS[turn].name.fr}` : `${TEAMS[turn].name.en} chef’s turn`, lang);
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

  /** Le bot chef : un thème qui couvre le plus de mots de son équipe. */
  const botClue = () => {
    const mine = cards.filter((c) => c.key === turn && c.owner < 0);
    const group = new Map<string, Card[]>();
    mine.forEach((c) => group.set(c.theme, [...(group.get(c.theme) ?? []), c]));
    const best = [...group.values()].sort((a, b) => b.length - a.length)[0];
    if (!best) return endTurn();
    setClue(fr ? best[0].theme : best[0].themeEn, Math.min(4, best.length));
  };
  /** Le bot qui cherche, quand l'équipe n'a aucun humain pour le faire. */
  const botGuess = () => {
    const open = cards.filter((c) => c.owner < 0);
    const good = open.filter((c) => c.key === turn);
    const skill = 0.6 + ctx.botSkill * 0.3;
    const c = Math.random() < skill && good.length ? good[Math.floor(Math.random() * good.length)] : open.filter((x) => x.key !== 3)[Math.floor(Math.random() * Math.max(1, open.length - 1))];
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
      // Les deux équipes et ce qu'il leur reste à trouver
      [0, 1].forEach((s) => {
        const x = s ? 1620 : 300;
        const on = turn === s && phase !== 'end';
        g.fillStyle = TEAMS[s].color;
        g.strokeStyle = INK;
        g.lineWidth = on ? 10 : 5;
        g.beginPath();
        g.roundRect(x - 270, 14 + (on ? Math.sin(t * 5) * 2 : 0), 540, 96, 28);
        g.fill();
        g.stroke();
        candy(g, x - 270, 14, 540, 96, 28);
        g.fillStyle = '#fff';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '700 42px Fredoka, sans-serif';
        g.fillText(`${TEAMS[s].emoji} ${TEAMS[s].name[lang]} : ${leftOf(s)}`, x, 62, 510);
      });
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.font = '700 46px Fredoka, sans-serif';
      if (phase !== 'end') g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 960, 62);
      // L'indice, le plus visible possible
      g.font = '700 58px Fredoka, sans-serif';
      if (phase === 'clue') g.fillText(fr ? '🤫 Le chef cherche son indice…' : '🤫 The chef is thinking of a clue…', 960, 158, 1800);
      else if (phase === 'guess') g.fillText(`💡 ${clue} · ${count}   ${fr ? `(encore ${tries} essai${tries > 1 ? 's' : ''})` : `(${tries} tr${tries > 1 ? 'ies' : 'y'} left)`}`, 960, 158, 1800);
      else g.fillText(`🏆 ${TEAMS[winner].name[lang]} — ${why}`, 960, 158, 1800);
      // La grille
      const w = 354;
      const h = 150;
      cards.forEach((c, i) => {
        const x = 62 + (i % 5) * (w + 10);
        const y = 215 + Math.floor(i / 5) * (h + 8);
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
  emoji: '🤫',
  name: { fr: 'Le Chef Cachottier', en: 'The Secretive Chef' },
  how: {
    fr: 'Deux équipes, 25 mots. Le chef donne un indice d’un mot et un nombre : son équipe doit trouver ses mots sans toucher au mot maudit !',
    en: 'Two teams, 25 words. The chef gives a one-word clue and a number: the team must find its words and avoid the cursed one!',
  },
  layout: 'buttons',
  min: 2,
  max: 12,
  botFill: 4,
  music: 'spy',
  create,
};
