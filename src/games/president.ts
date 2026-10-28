// Le Président : jeu de cartes. Chacun voit sa main sur son téléphone. On pose autant de cartes (de même valeur)
// que le joueur d'avant, d'une valeur égale ou plus forte, ou on passe. Le 2 est la plus forte et ferme le pli.
// Le premier sans cartes devient Président, le dernier Bouffon. À la manche suivante, le Bouffon donne ses 2 meilleures
// cartes au Président (qui lui en rend 2 de son choix), le Vice-bouffon donne sa meilleure au Vice-président (qui en rend 1).
import { drawCharacter } from '../shared/characters';
import { INK, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { roundRectText } from './draw';
import { RANKS, RANKS_EN, SUITS, isRed, rankOf, type PresidentPadData } from './presidentShared';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

const TURN_TIME = 30;
const SWAP_TIME = 25;

type Role = 'pres' | 'vice' | 'neutre' | 'vbouf' | 'bouf';
const ROLE_ICON: Record<Role, string> = { pres: '👑', vice: '🎩', neutre: '🙂', vbouf: '🥴', bouf: '🤡' };
const ROLE_NAME: Record<Role, { fr: string; en: string }> = {
  pres: { fr: 'Président', en: 'President' },
  vice: { fr: 'Vice-président', en: 'Vice-president' },
  neutre: { fr: 'Citoyen', en: 'Citizen' },
  vbouf: { fr: 'Vice-bouffon', en: 'Vice-fool' },
  bouf: { fr: 'Bouffon', en: 'Fool' },
};

interface Seat extends Runner {
  hand: number[];
  /** Place à la fin de la manche en cours (0 = encore en jeu). */
  done: number;
  role: Role;
  score: number;
  /** Cartes à rendre pendant l'échange (Président 2, Vice-président 1) et à qui. */
  mustGive: number;
  giveTo: number;
  given: boolean;
  /** Bulle « Je passe » (s). */
  passT: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const sortHand = (h: number[]) => h.sort((a, b) => a - b);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const ROUNDS = ctx.opts.rounds === 5 ? 5 : ctx.opts.rounds === 1 ? 1 : 3;
  const seats: Seat[] = runners.slice(0, 8).map((r) => ({ ...r, hand: [], done: 0, role: 'neutre', score: 0, mustGive: 0, giveTo: -1, given: true, passT: 0 }));
  const n = seats.length;
  const rk = (c: number) => (fr ? RANKS : RANKS_EN)[rankOf(c)];
  const name = (i: number) => seats[i].profile.name;
  const roleName = (r: Role) => ROLE_NAME[r][ctx.lang];

  let round = 0;
  let phase: PresidentPadData['phase'] = 'deal';
  let timer = 2.5;
  let turn = 0;
  let pile: number[] = [];
  let pileBy = -1;
  /** Poses précédentes du pli (affichées en dessous). */
  let under: number[][] = [];
  let need = 0;
  let passes = 0;
  let finished = 0;
  let message = '';
  let swapLines: string[] = [];
  let order: number[] = [];
  let pause = 0;
  let leaderNext = -1;
  const flies: { from: number; to: number; cards: number[]; t: number; back: boolean }[] = [];

  const active = (i: number) => seats[i].hand.length > 0 && !seats[i].done;
  const activeCount = () => seats.filter((_, i) => active(i)).length;
  function nextActive(i: number) {
    for (let k = 1; k <= n; k++) {
      const j = (i + k) % n;
      if (active(j)) return j;
    }
    return i;
  }
  const say = (t: string, voice = false) => {
    message = t;
    if (voice) speak(t, ctx.lang);
  };

  function deal() {
    round++;
    const deck = [...Array(52).keys()].sort(() => Math.random() - 0.5);
    seats.forEach((s) => {
      s.hand = [];
      s.done = 0;
      s.mustGive = 0;
      s.giveTo = -1;
      s.given = true;
      s.passT = 0;
    });
    deck.forEach((c, k) => seats[k % n].hand.push(c));
    seats.forEach((s) => sortHand(s.hand));
    pile = [];
    under = [];
    pileBy = -1;
    need = 0;
    passes = 0;
    finished = 0;
    order = [];
    phase = 'deal';
    timer = 2.2;
    say(fr ? `Manche ${round} sur ${ROUNDS} : distribution !` : `Round ${round} of ${ROUNDS}: dealing!`, true);
    sfx.cards();
    ctx.refresh();
  }

  /** Échange de début de manche : les Bouffons donnent leurs meilleures cartes, les Présidents choisissent quoi rendre. */
  function startSwap() {
    const by = (r: Role) => seats.findIndex((s) => s.role === r);
    const pres = by('pres');
    const bouf = by('bouf');
    const vice = by('vice');
    const vbouf = by('vbouf');
    swapLines = [];
    const giveBest = (from: number, to: number, k: number) => {
      const best = seats[from].hand.slice(-k);
      seats[from].hand = seats[from].hand.slice(0, -k);
      seats[to].hand = sortHand([...seats[to].hand, ...best]);
      flies.push({ from, to, cards: best, t: 0, back: false });
      seats[to].mustGive = k;
      seats[to].giveTo = from;
      seats[to].given = false;
      const what = best.map((c) => rk(c)).join(fr ? ' et ' : ' and ');
      swapLines.push(
        fr
          ? `${ROLE_ICON[seats[from].role]} ${name(from)} donne ${k > 1 ? 'ses 2 meilleures cartes' : 'sa meilleure carte'} (${what}) à ${ROLE_ICON[seats[to].role]} ${name(to)}`
          : `${ROLE_ICON[seats[from].role]} ${name(from)} gives ${k > 1 ? 'their 2 best cards' : 'their best card'} (${what}) to ${ROLE_ICON[seats[to].role]} ${name(to)}`,
      );
    };
    if (pres >= 0 && bouf >= 0) giveBest(bouf, pres, 2);
    if (vice >= 0 && vbouf >= 0) giveBest(vbouf, vice, 1);
    phase = 'swap';
    timer = SWAP_TIME;
    say(fr ? 'Échange des cartes !' : 'Card swap!', true);
    sfx.whoosh();
    // Les bots rendent tout de suite leurs plus faibles
    seats.forEach((s, i) => {
      if (!s.given && s.bot) giveBack(i, s.hand.slice(0, s.mustGive));
    });
    ctx.refresh();
  }

  function giveBack(i: number, cards: number[]) {
    const s = seats[i];
    if (s.given || phase !== 'swap') return;
    const uniq = [...new Set(cards)].filter((c) => s.hand.includes(c));
    if (uniq.length !== s.mustGive) return;
    s.hand = s.hand.filter((c) => !uniq.includes(c));
    seats[s.giveTo].hand = sortHand([...seats[s.giveTo].hand, ...uniq]);
    s.given = true;
    flies.push({ from: i, to: s.giveTo, cards: uniq, t: 0, back: true });
    swapLines.push(fr ? `${ROLE_ICON[s.role]} ${name(i)} rend ${uniq.length} carte${uniq.length > 1 ? 's' : ''} à ${name(s.giveTo)}` : `${ROLE_ICON[s.role]} ${name(i)} gives back ${uniq.length} card${uniq.length > 1 ? 's' : ''} to ${name(s.giveTo)}`);
    sfx.cards();
    if (seats.every((x) => x.given)) timer = Math.min(timer, 2.5);
    ctx.refresh();
  }

  function startPlay() {
    phase = 'play';
    // Le Bouffon ouvre ; à la 1re manche, celui qui a le 3 de cœur
    const bouf = seats.findIndex((s) => s.role === 'bouf');
    const first = bouf >= 0 ? bouf : Math.max(0, seats.findIndex((s) => s.hand.includes(1)));
    startTurn(first);
  }

  function startTurn(i: number) {
    turn = i;
    timer = seats[i].bot ? rnd(1.1, 2.2) : TURN_TIME;
    if (!seats[i].bot) ctx.buzz(seats[i].pid, 80);
    ctx.refresh();
  }

  function clearTrick(leader: number) {
    under = [];
    pile = [];
    pileBy = -1;
    need = 0;
    passes = 0;
    pause = 1.1;
    leaderNext = leader;
    say(fr ? `Pli ramassé : ${name(leader)} ouvre` : `Trick over: ${name(leader)} leads`);
    sfx.whoosh();
    ctx.refresh();
  }

  function finishRound() {
    // Le dernier encore en jeu est le Bouffon
    seats.forEach((s, i) => {
      if (!s.done) {
        s.done = ++finished;
        order.push(i);
      }
    });
    const roleAt = (place: number): Role =>
      place === 1 ? 'pres' : place === n ? 'bouf' : n >= 4 && place === 2 ? 'vice' : n >= 4 && place === n - 1 ? 'vbouf' : 'neutre';
    seats.forEach((s) => {
      s.role = roleAt(s.done);
      s.score += n - s.done;
    });
    phase = round >= ROUNDS ? 'end' : 'round';
    timer = phase === 'end' ? 6 : 5;
    const p = seats[order[0]];
    const b = seats[order[n - 1]];
    say(fr ? `${p.profile.name} est Président, ${b.profile.name} est le Bouffon !` : `${p.profile.name} is President, ${b.profile.name} is the Fool!`, true);
    sfx.win();
    ctx.refresh();
  }

  function play(i: number, cards: number[]) {
    if (phase !== 'play' || pause > 0 || turn !== i) return;
    const s = seats[i];
    const uniq = [...new Set(cards)].filter((c) => s.hand.includes(c));
    if (!uniq.length || uniq.length > 4 || uniq.length !== cards.length) return;
    const r = rankOf(uniq[0]);
    if (uniq.some((c) => rankOf(c) !== r)) return;
    if (need && (uniq.length !== need || r < rankOf(pile[0]))) return;
    s.hand = s.hand.filter((c) => !uniq.includes(c));
    if (pile.length) under = [...under.slice(-2), pile];
    pile = sortHand(uniq);
    pileBy = i;
    need = uniq.length;
    passes = 0;
    flies.push({ from: i, to: -1, cards: uniq, t: 0, back: false });
    say(fr ? `${name(i)} pose ${uniq.length > 1 ? `${uniq.length} × ` : ''}${rk(uniq[0])}` : `${name(i)} plays ${uniq.length > 1 ? `${uniq.length} × ` : ''}${rk(uniq[0])}`);
    sfx.cards();
    if (!s.hand.length) {
      s.done = ++finished;
      order.push(i);
      const t = finished === 1 ? (fr ? `${name(i)} finit premier : Président !` : `${name(i)} goes out first: President!`) : fr ? `${name(i)} a fini (${finished}e)` : `${name(i)} is out (#${finished})`;
      say(t, finished === 1);
      if (!s.bot) ctx.buzz(s.pid, 300);
    }
    if (activeCount() <= 1) return finishRound();
    // Un 2 (la plus forte) ferme le pli : celui qui l'a posé rejoue
    if (r === 12) return clearTrick(active(i) ? i : nextActive(i));
    startTurn(nextActive(i));
  }

  function pass(i: number) {
    if (phase !== 'play' || pause > 0 || turn !== i || !need) return;
    seats[i].passT = 1.6;
    passes++;
    sfx.click();
    const others = activeCount() - (active(pileBy) ? 1 : 0);
    if (passes >= others) return clearTrick(active(pileBy) ? pileBy : nextActive(pileBy));
    startTurn(nextActive(i));
  }

  function botTurn(i: number) {
    const h = seats[i].hand;
    const groups = new Map<number, number[]>();
    for (const c of h) groups.set(rankOf(c), [...(groups.get(rankOf(c)) ?? []), c]);
    const ranks = [...groups.keys()].sort((a, b) => a - b);
    if (!need) {
      // Ouvrir avec sa plus petite valeur (le paquet entier), en gardant les 2 pour la fin
      const r = ranks.find((x) => x !== 12) ?? ranks[0];
      return play(i, groups.get(r)!);
    }
    const min = rankOf(pile[0]);
    const ok = ranks.filter((r) => r >= min && groups.get(r)!.length >= need);
    // On évite de casser un gros paquet et de gâcher ses 2, sauf en fin de main
    const cheap = ok.filter((r) => r !== 12 && (groups.get(r)!.length === need || Math.random() < 0.4));
    const pick = cheap[0] ?? (ok.includes(12) && (h.length <= 4 || Math.random() < 0.35) ? 12 : undefined);
    if (pick === undefined || (pick > 9 && h.length > 6 && Math.random() < 0.3 * (1 - ctx.botSkill))) return pass(i);
    play(i, groups.get(pick)!.slice(0, need));
  }

  // ——— Dessin ———
  const pos = seats.map((_, i) => {
    const a = Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2;
    return { x: 960 + Math.cos(a) * 760, y: 560 + Math.sin(a) * 300 };
  });

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const i = seats.findIndex((s) => s.pid === pid);
      if (i < 0) return;
      if (m.a === 'play') play(i, m.n ?? []);
      if (m.a === 'pass') pass(i);
      if (m.a === 'give') giveBack(i, m.n ?? []);
    },
    update(dt) {
      for (const f of flies) f.t += dt;
      for (let k = flies.length - 1; k >= 0; k--) if (flies[k].t > 1) flies.splice(k, 1);
      seats.forEach((s) => (s.passT = Math.max(0, s.passT - dt)));
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0 && phase === 'play') startTurn(leaderNext);
        return;
      }
      timer -= dt;
      if (phase === 'play') {
        if (timer > 0) return;
        if (seats[turn].bot) botTurn(turn);
        // Trop long : on joue à sa place (sa plus petite carte, ou on passe)
        else if (need) pass(turn);
        else play(turn, [seats[turn].hand[0]]);
        return;
      }
      if (timer > 0) return;
      if (phase === 'deal') {
        if (round > 1) startSwap();
        else startPlay();
      } else if (phase === 'swap') {
        seats.forEach((s, i) => !s.given && giveBack(i, s.hand.slice(0, s.mustGive)));
        startPlay();
      } else if (phase === 'round') deal();
      else if (phase === 'end') game.over = true;
    },
    render(g, t) {
      g.drawImage(roomImage(), 0, 0);
      // Projecteur sur celui qui joue
      if (phase === 'play' && pause <= 0) {
        const p = pos[turn];
        g.fillStyle = 'rgba(255,240,170,0.16)';
        g.beginPath();
        g.moveTo(p.x - 30, 0);
        g.lineTo(p.x + 30, 0);
        g.lineTo(p.x + 150, p.y + 90);
        g.lineTo(p.x - 150, p.y + 90);
        g.closePath();
        g.fill();
      }
      g.drawImage(tableImage(), 0, 0);
      // Pli en cours : les poses d'avant en dessous, la dernière bien en vue
      under.forEach((cs, k) => fan(g, cs, 900 + k * 40, 540 - k * 16, 0.62, -0.25 + k * 0.12, true, ctx.lang));
      if (pile.length) {
        fan(g, pile, 960, 560, 1, 0, false, ctx.lang);
        g.font = '600 30px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = '#fff';
        g.fillText(fr ? `${name(pileBy)} · à battre : ${need} × ${rk(pile[0])} ou plus` : `${name(pileBy)} · to beat: ${need} × ${rk(pile[0])} or higher`, 960, 730);
      } else if (phase === 'play') {
        g.font = '600 34px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.fillText(fr ? 'Table vide : pose ce que tu veux (1 à 4 cartes pareilles)' : 'Empty table: play anything (1 to 4 matching cards)', 960, 575);
      }
      // Joueurs
      seats.forEach((s, i) => {
        const p = pos[i];
        const focus = phase === 'play' && turn === i && pause <= 0;
        if (focus) {
          g.fillStyle = 'rgba(255,214,10,0.55)';
          g.beginPath();
          g.ellipse(p.x, p.y + 82, 120, 32, 0, 0, Math.PI * 2);
          g.fill();
        }
        drawCharacter(g, p.x, p.y + 82, focus ? 165 : 145, {
          food: s.profile.food,
          color: s.profile.color,
          hat: s.profile.hat,
          acc: s.profile.acc,
          eyes: s.profile.eyes,
          pose: s.profile.pose,
          selfie: s.selfie,
          t: t + i * 1.3,
          dir: p.x < 960 ? 1 : -1,
          mood: s.done === 1 && phase !== 'swap' ? 'win' : phase === 'round' || phase === 'end' ? (s.role === 'bouf' ? 'sad' : 'happy') : 'happy',
          arms: (phase === 'round' || phase === 'end') && s.role === 'pres',
        });
        roundRectText(g, s.profile.name, p.x - 95, p.y + 112, 190, 34, s.profile.color);
        // Rôle de la manche d'avant (ou celui qu'on vient de gagner)
        if (round > 1 || phase === 'round' || phase === 'end') {
          g.font = '48px sans-serif';
          g.textAlign = 'center';
          g.fillText(ROLE_ICON[s.role], p.x - 80, p.y - 70);
        }
        // Main : petit éventail de dos de cartes + nombre
        const k = Math.min(10, s.hand.length);
        for (let q = 0; q < k; q++) {
          g.save();
          g.translate(p.x + 70 + q * 6, p.y + 10);
          g.rotate(-0.3 + q * 0.07);
          drawCard(g, 0, 0, 34, 48, null, ctx.lang);
          g.restore();
        }
        g.font = '700 30px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = '#fff';
        g.lineWidth = 6;
        g.strokeStyle = INK;
        const label = s.done ? (s.done === 1 ? (fr ? '🏁 1er' : '🏁 1st') : `🏁 ${s.done}${fr ? 'e' : 'th'}`) : `🃏 ${s.hand.length}`;
        g.strokeText(label, p.x, p.y - 118);
        g.fillText(label, p.x, p.y - 118);
        if (s.passT > 0) bubble(g, p.x + (p.x < 960 ? 110 : -110), p.y - 150, fr ? 'Je passe' : 'Pass', Math.min(1, s.passT * 3));
        if (focus) {
          const by = p.y - 165 + Math.abs(Math.sin(t * 5)) * -16;
          g.fillStyle = SOLEIL;
          g.strokeStyle = INK;
          g.lineWidth = 6;
          g.beginPath();
          g.moveTo(p.x - 26, by);
          g.lineTo(p.x + 26, by);
          g.lineTo(p.x, by + 32);
          g.closePath();
          g.fill();
          g.stroke();
          if (!s.bot) {
            g.strokeStyle = timer < 8 ? '#ff3b3b' : '#1fc9a0';
            g.lineWidth = 9;
            g.beginPath();
            g.arc(p.x, by - 30, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, timer / TURN_TIME));
            g.stroke();
            g.fillStyle = '#fff';
            g.font = '700 28px Fredoka, sans-serif';
            g.fillText(String(Math.ceil(Math.max(0, timer))), p.x, by - 20);
          }
        }
      });
      // Cartes qui volent (vers la table, ou d'un joueur à l'autre pendant l'échange)
      for (const f of flies) {
        const e = 1 - Math.pow(1 - Math.min(1, f.t / 0.7), 3);
        const a = pos[f.from];
        const b = f.to < 0 ? { x: 960, y: 560 } : pos[f.to];
        f.cards.forEach((c, k) => {
          g.save();
          g.translate(a.x + (b.x - a.x) * e + k * 18, a.y + (b.y - a.y) * e - Math.sin(e * Math.PI) * 140);
          g.rotate((1 - e) * 5 * (k % 2 ? 1 : -1));
          drawCard(g, 0, 0, 90, 126, f.to < 0 ? c : null, ctx.lang);
          g.restore();
        });
      }
      // Bandeau du haut
      let top = '';
      if (phase === 'play' && pause <= 0) top = fr ? `🃏 Au tour de ${name(turn)}` : `🃏 ${name(turn)}'s turn`;
      if (phase === 'swap') top = fr ? '🔄 Échange des cartes' : '🔄 Card swap';
      if (top) banner(g, top, phase === 'play' ? seats[turn].profile.color : '#9b5cff', t);
      // Échange : ce qui se passe, ligne par ligne
      if (phase === 'swap') {
        const lines = [...swapLines];
        seats.forEach((s, i) => !s.given && lines.push(fr ? `${ROLE_ICON[s.role]} ${name(i)} choisit ${s.mustGive} carte${s.mustGive > 1 ? 's' : ''} à rendre… (${Math.ceil(Math.max(0, timer))} s)` : `${ROLE_ICON[s.role]} ${name(i)} picks ${s.mustGive} card${s.mustGive > 1 ? 's' : ''} to give back… (${Math.ceil(Math.max(0, timer))} s)`));
        panel(g, lines, 300);
      }
      // Fin de manche : le classement et les rôles
      if (phase === 'round' || phase === 'end') {
        const lines = order.map((i, k) => `${k + 1}. ${ROLE_ICON[seats[i].role]} ${name(i)} · ${roleName(seats[i].role)} · ${seats[i].score} pts`);
        lines.unshift(phase === 'end' ? (fr ? '🏆 Fin de partie' : '🏆 Game over') : fr ? `Fin de la manche ${round}` : `End of round ${round}`);
        panel(g, lines, 250);
      }
      // Message du bas
      if (message && phase !== 'round' && phase !== 'end') {
        g.font = '600 36px Fredoka, sans-serif';
        const mw = Math.min(1700, g.measureText(message).width + 80);
        g.fillStyle = 'rgba(42,24,56,0.85)';
        g.beginPath();
        g.roundRect(960 - mw / 2, 880, mw, 66, 33);
        g.fill();
        g.fillStyle = '#fff';
        g.textAlign = 'center';
        g.fillText(message, 960, 925);
      }
    },
    ranking() {
      return [...seats]
        .map((s, i) => ({ s, i }))
        .sort((a, b) => b.s.score - a.s.score || (a.s.done || 99) - (b.s.done || 99))
        .map((x) => x.s.pid);
    },
    leader() {
      if (phase !== 'end') return null;
      return [...seats].sort((a, b) => b.score - a.score)[0]?.profile.name ?? null;
    },
    padData(pid): PresidentPadData {
      const i = seats.findIndex((s) => s.pid === pid);
      const s = seats[i];
      const myTurn = phase === 'play' && pause <= 0 && turn === i && !!s && active(i);
      return {
        hand: s?.hand ?? [],
        phase,
        myTurn,
        need,
        min: pile.length ? rankOf(pile[0]) : -1,
        give: s && phase === 'swap' && !s.given ? s.mustGive : 0,
        giveTo: s && s.giveTo >= 0 ? name(s.giveTo) : '',
        role: s && (round > 1 || phase === 'round' || phase === 'end') ? `${ROLE_ICON[s.role]} ${roleName(s.role)}` : '',
        turnName: phase === 'play' ? name(turn) : '',
        pile,
        pileBy: pileBy >= 0 ? name(pileBy) : '',
        note: message,
        done: s?.done ?? 0,
      };
    },
  };
  deal();
  return game;
}

// ——— Dessin ———

/** Une carte (null = vue de dos). */
function drawCard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number | null, lang: 'fr' | 'en') {
  g.fillStyle = c === null ? '#9b5cff' : '#fffaf0';
  g.strokeStyle = INK;
  g.lineWidth = Math.max(2, w / 22);
  g.beginPath();
  g.roundRect(x - w / 2, y - h / 2, w, h, w / 7);
  g.fill();
  g.stroke();
  if (c === null) {
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = Math.max(1.5, w / 30);
    g.beginPath();
    g.roundRect(x - w / 2 + w * 0.14, y - h / 2 + w * 0.14, w * 0.72, h - w * 0.28, w / 10);
    g.stroke();
    return;
  }
  const col = isRed(c) ? '#e8233f' : INK;
  const r = (lang === 'fr' ? RANKS : RANKS_EN)[rankOf(c)];
  g.fillStyle = col;
  g.textAlign = 'left';
  g.font = `700 ${Math.round(w * 0.3)}px Fredoka, sans-serif`;
  g.fillText(r, x - w / 2 + w * 0.1, y - h / 2 + w * 0.34);
  g.font = `${Math.round(w * 0.22)}px sans-serif`;
  g.fillText(SUITS[c % 4], x - w / 2 + w * 0.1, y - h / 2 + w * 0.58);
  g.textAlign = 'center';
  g.font = `${Math.round(w * 0.55)}px sans-serif`;
  g.fillText(SUITS[c % 4], x, y + h * 0.2);
}

function fan(g: CanvasRenderingContext2D, cs: number[], x: number, y: number, s: number, rot: number, dim: boolean, lang: 'fr' | 'en') {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  if (dim) g.globalAlpha = 0.55;
  cs.forEach((c, k) => {
    const o = (k - (cs.length - 1) / 2) * 70 * s;
    g.save();
    g.translate(o, Math.abs(o) * 0.12);
    g.rotate(((k - (cs.length - 1) / 2) * 0.12));
    drawCard(g, 0, 0, 110 * s, 154 * s, c, lang);
    g.restore();
  });
  g.restore();
}

function bubble(g: CanvasRenderingContext2D, x: number, y: number, text: string, a: number) {
  g.save();
  g.globalAlpha = a;
  g.font = '700 34px Fredoka, sans-serif';
  const w = g.measureText(text).width + 44;
  g.fillStyle = '#fff';
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(x - w / 2, y - 32, w, 64, 28);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.fillText(text, x, y + 12);
  g.restore();
}

function banner(g: CanvasRenderingContext2D, txt: string, color: string, t: number) {
  g.font = '700 46px Fredoka, sans-serif';
  const w = g.measureText(txt).width + 90;
  const k = 1 + Math.sin(t * 4) * 0.02;
  g.save();
  g.translate(960, 70);
  g.scale(k, k);
  g.fillStyle = INK;
  g.beginPath();
  g.roundRect(-w / 2, -30, w, 76, 38);
  g.fill();
  g.fillStyle = color;
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(-w / 2, -38, w, 76, 38);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff';
  g.lineWidth = 8;
  g.textAlign = 'center';
  g.strokeText(txt, 0, 16);
  g.fillText(txt, 0, 16);
  g.restore();
}

function panel(g: CanvasRenderingContext2D, lines: string[], y: number) {
  g.font = '600 34px Fredoka, sans-serif';
  const w = Math.min(1500, Math.max(...lines.map((l) => g.measureText(l).width)) + 90);
  const h = 40 + lines.length * 52;
  g.fillStyle = 'rgba(42,24,56,0.9)';
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(960 - w / 2, y, w, h, 30);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  lines.forEach((l, k) => g.fillText(l, 960, y + 62 + k * 52));
}

let roomCache: HTMLCanvasElement | null = null;
/** Salon feutré : mur à motifs, tableau de cartes, plancher. */
function roomImage(): HTMLCanvasElement {
  if (roomCache) return roomCache;
  const c = document.createElement('canvas');
  c.width = 1920;
  c.height = 1080;
  const g = c.getContext('2d')!;
  const wall = g.createLinearGradient(0, 0, 0, 700);
  wall.addColorStop(0, '#2a3d6b');
  wall.addColorStop(1, '#3f5a96');
  g.fillStyle = wall;
  g.fillRect(0, 0, 1920, 700);
  g.font = '64px sans-serif';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 60; y < 680; y += 110) for (let x = (y / 110) % 2 ? 60 : 0; x < 1920; x += 120) g.fillText(SUITS[Math.floor(x / 120 + y / 110) % 4], x, y);
  g.fillStyle = '#5a3324';
  g.fillRect(0, 680, 1920, 400);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 3;
  for (let y = 700; y < 1080; y += 46) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1920, y);
    g.stroke();
  }
  g.fillStyle = INK;
  g.fillRect(0, 674, 1920, 10);
  roomCache = c;
  return c;
}

let tableCache: HTMLCanvasElement | null = null;
function tableImage(): HTMLCanvasElement {
  if (tableCache) return tableCache;
  const c = document.createElement('canvas');
  c.width = 1920;
  c.height = 1080;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(20,10,30,0.35)';
  g.beginPath();
  g.ellipse(960, 600, 600, 250, 0, 0, Math.PI * 2);
  g.fill();
  const wood = g.createLinearGradient(0, 330, 0, 820);
  wood.addColorStop(0, '#c07a45');
  wood.addColorStop(1, '#6e3519');
  g.fillStyle = wood;
  g.beginPath();
  g.ellipse(960, 560, 590, 250, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.stroke();
  const felt = g.createRadialGradient(960, 540, 40, 960, 560, 560);
  felt.addColorStop(0, '#3f7be0');
  felt.addColorStop(1, '#1c3f8a');
  g.fillStyle = felt;
  g.beginPath();
  g.ellipse(960, 552, 540, 214, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 3;
  g.setLineDash([14, 12]);
  g.beginPath();
  g.ellipse(960, 552, 480, 182, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  tableCache = c;
  return c;
}

export const president: GameBase = {
  id: 'president',
  emoji: '👑',
  name: { fr: 'Le Président', en: 'The President' },
  how: {
    fr: 'Débarrasse-toi de tes cartes en premier · pose autant de cartes que le joueur d’avant, plus fortes ou égales · le 2 ferme le pli',
    en: 'Get rid of your cards first · play as many cards as the previous player, equal or higher · a 2 closes the trick',
  },
  inspired: 'Président (jeu de cartes traditionnel)',
  layout: 'buttons',
  min: 3,
  max: 8,
  botFill: 4,
  music: 'bar',
  options: [
    {
      id: 'rounds',
      label: { fr: 'Manches', en: 'Rounds' },
      choices: [
        { v: 3, label: { fr: '3 manches', en: '3 rounds' } },
        { v: 5, label: { fr: '5 manches', en: '5 rounds' } },
        { v: 1, label: { fr: '1 manche', en: '1 round' } },
      ],
    },
  ],
  create,
};
