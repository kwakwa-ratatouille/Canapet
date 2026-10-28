// Le Bar des Bobards : jeu de bluff. On pose des cartes face cachée en prétendant que c'est la carte du tour ;
// le suivant peut crier « MENTEUR ! ». Le perdant appuie sur son coussin péteur : un sur six fait PROUT, et c'est KO.
import { drawCharacter } from '../shared/characters';
import { sfx, speak } from '../shared/sound';
import { CARD_NAMES, type BluffPadData, type Card } from './bluffShared';
import { roundRectText } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const TYPES: Card[] = ['tartine', 'cornichon', 'fromage'];
const HAND = 5;
const TURN_TIME = 30;

interface Seat extends Runner {
  hand: Card[];
  alive: boolean;
  bullet: number;
  shots: number;
  out: number;
}

type Phase = 'deal' | 'turn' | 'reveal' | 'roulette' | 'result' | 'end';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const shuffle = <T,>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

let tableCache: HTMLCanvasElement | null = null;
/** Table de jeu en image : bois verni, tapis vert à motifs, halo de la lampe. */
function tableImage(): HTMLCanvasElement {
  if (tableCache) return tableCache;
  const c = document.createElement('canvas');
  c.width = 1920;
  c.height = 1080;
  const g = c.getContext('2d')!;
  const light = g.createRadialGradient(960, 560, 60, 960, 600, 760);
  light.addColorStop(0, 'rgba(255,236,170,0.5)');
  light.addColorStop(1, 'rgba(255,236,170,0)');
  g.fillStyle = light;
  g.fillRect(0, 0, 1920, 1080);
  // Ombre au sol
  g.fillStyle = 'rgba(30,12,30,0.35)';
  g.beginPath();
  g.ellipse(960, 668, 560, 226, 0, 0, Math.PI * 2);
  g.fill();
  // Rebord en bois
  const wood = g.createLinearGradient(0, 400, 0, 860);
  wood.addColorStop(0, '#b86a3c');
  wood.addColorStop(1, '#6e3519');
  g.fillStyle = wood;
  g.beginPath();
  g.ellipse(960, 630, 545, 222, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#3a2140';
  g.lineWidth = 6;
  g.stroke();
  g.strokeStyle = 'rgba(255,220,180,0.45)';
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(960, 624, 530, 212, 0, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
  // Tapis vert
  const felt = g.createRadialGradient(960, 590, 40, 960, 620, 520);
  felt.addColorStop(0, '#2fb37f');
  felt.addColorStop(1, '#156b4b');
  g.fillStyle = felt;
  g.beginPath();
  g.ellipse(960, 622, 495, 188, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#3a2140';
  g.lineWidth = 5;
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 3;
  g.setLineDash([14, 12]);
  g.beginPath();
  g.ellipse(960, 622, 440, 158, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  tableCache = c;
  return c;
}

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const seats: Seat[] = runners.map((r) => ({ ...r, hand: [], alive: true, bullet: Math.floor(Math.random() * 6), shots: 0, out: 0 }));
  let phase: Phase = 'deal';
  let timer = 2.5;
  let table: Card = 'tartine';
  let turn = 0;
  let forced = false;
  let last: { seat: number; cards: Card[] } | null = null;
  let pile = 0;
  let caller = -1;
  let target = -1;
  let boom = false;
  let outCount = 0;
  let message = '';
  let time = 0;
  let starter = Math.floor(Math.random() * seats.length);

  const name = (i: number) => seats[i].profile.name;
  const cardName = (c: Card) => CARD_NAMES[c][ctx.lang];
  const isTrue = (c: Card) => c === table || c === 'coussin';
  const alive = () => seats.filter((s) => s.alive);

  function say(text: string, voice = false) {
    message = text;
    if (voice) speak(text, ctx.lang);
  }

  function deal() {
    const n = alive().length;
    const deck: Card[] = [];
    for (const t of TYPES) for (let i = 0; i < Math.max(6, n * 2); i++) deck.push(t);
    for (let i = 0; i < Math.max(2, Math.ceil(n / 2)); i++) deck.push('coussin');
    deck.push('miroir');
    shuffle(deck);
    for (const s of seats) s.hand = s.alive ? deck.splice(0, HAND) : [];
    table = TYPES[Math.floor(Math.random() * TYPES.length)];
    last = null;
    pile = 0;
    phase = 'deal';
    timer = 2.6;
    say(fr ? `Nouvelle tournée : ${cardName(table)} !` : `New round: ${cardName(table)}!`, true);
    sfx.pop();
    ctx.refresh();
  }

  function startTurn(i: number, isForced: boolean) {
    turn = i;
    forced = isForced;
    phase = 'turn';
    timer = seats[i].bot ? rnd(1.6, 3.2) : TURN_TIME;
    if (!seats[i].bot) ctx.buzz(seats[i].pid, 80);
    ctx.refresh();
  }

  /** Joueur suivant qui a encore des cartes ; si tout le monde est vide sauf le dernier poseur, le suivant doit l'accuser. */
  function next(from: number) {
    const n = seats.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n;
      if (!seats[i].alive || !seats[i].hand.length) continue;
      if (last && i === last.seat) break;
      return startTurn(i, false);
    }
    if (!last) return deal();
    for (let k = 1; k <= n; k++) {
      const i = (last.seat + k) % n;
      if (seats[i].alive && i !== last.seat) return startTurn(i, true);
    }
  }

  function play(i: number, idx: number[]) {
    const s = seats[i];
    const uniq = [...new Set(idx)].filter((k) => k >= 0 && k < s.hand.length);
    if (phase !== 'turn' || turn !== i || forced || uniq.length < 1 || uniq.length > 3) return;
    const cards = uniq.map((k) => s.hand[k]);
    s.hand = s.hand.filter((_, k) => !uniq.includes(k));
    last = { seat: i, cards };
    pile += cards.length;
    say(fr ? `${name(i)} pose ${cards.length} × ${cardName(table)}… paraît-il.` : `${name(i)} plays ${cards.length} × ${cardName(table)}… supposedly.`);
    sfx.click();
    next(i);
  }

  function call(i: number) {
    if (phase !== 'turn' || turn !== i || !last || last.seat === i) return;
    caller = i;
    // Un Miroir dans les cartes retournées renvoie l'accusation sur celui qui l'a lancée.
    const mirror = last.cards.includes('miroir');
    const honest = mirror || last.cards.every(isTrue);
    if (mirror) setTimeout(() => speak(fr ? 'Le miroir renvoie l’accusation !' : 'The mirror bounces it back!', ctx.lang), 1200);
    target = honest ? i : last.seat;
    phase = 'reveal';
    timer = 3.2;
    say(fr ? `${name(i)} : « MENTEUR ! »` : `${name(i)}: "LIAR!"`);
    speak(fr ? 'Menteur !' : 'Liar!', ctx.lang);
    sfx.boing();
    ctx.refresh();
  }

  function startRoulette() {
    phase = 'roulette';
    timer = seats[target].bot ? rnd(1.8, 2.8) : 10;
    const honest = target === caller;
    say(
      honest
        ? fr ? `Raté : ${name(last!.seat)} disait vrai. ${name(target)} appuie sur son coussin…` : `Wrong: ${name(last!.seat)} told the truth. ${name(target)} squeezes the cushion…`
        : fr ? `Grillé ! ${name(target)} appuie sur son coussin…` : `Busted! ${name(target)} squeezes the cushion…`,
    );
    if (!seats[target].bot) ctx.buzz(seats[target].pid, 400);
    ctx.refresh();
  }

  function pull() {
    if (phase !== 'roulette') return;
    const s = seats[target];
    s.shots++;
    boom = s.shots === s.bullet + 1;
    phase = 'result';
    timer = 3.4;
    if (boom) {
      s.alive = false;
      s.out = ++outCount;
      s.hand = [];
      sfx.pet();
      setTimeout(() => sfx.pet(), 180);
      say(
        ctx.family
          ? fr ? `POUF ! ${name(target)} est éliminé.` : `POOF! ${name(target)} is out.`
          : fr ? `PROUUUT ! ${name(target)} est KO.` : `PFFFRRT! ${name(target)} is out.`,
        true,
      );
      if (!s.bot) ctx.buzz(s.pid, 700);
    } else {
      sfx.tick();
      say(fr ? `Pfff… ouf ! ${name(target)} s'en sort (${s.shots}/6).` : `Phew! ${name(target)} survives (${s.shots}/6).`, true);
    }
    ctx.refresh();
  }

  function botTurn(i: number) {
    const s = seats[i];
    const truths = s.hand.map((c, k) => (isTrue(c) ? k : -1)).filter((k) => k >= 0);
    if (last && last.seat !== i) {
      const prev = seats[last.seat];
      let p = 0.12 + 0.12 * last.cards.length + 0.07 * truths.length + (prev.hand.length === 0 ? 0.2 : 0);
      if (forced || !s.hand.length) p = 1;
      if (Math.random() < Math.min(0.85, p)) return call(i);
    }
    if (forced) return call(i);
    const count = Math.random() < 0.6 ? 1 : 2;
    if (truths.length && Math.random() < 0.72) return play(i, truths.slice(0, Math.min(count, truths.length)));
    const all = shuffle(s.hand.map((_, k) => k));
    play(i, all.slice(0, Math.min(count, all.length)));
  }

  function afterResult() {
    if (alive().length <= 1) {
      phase = 'end';
      timer = 3.5;
      const w = alive()[0];
      if (w) say(fr ? `${w.profile.name} est le dernier debout !` : `${w.profile.name} is the last one standing!`, true);
      sfx.win();
      ctx.refresh();
      return;
    }
    starter = target;
    deal();
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const i = seats.findIndex((s) => s.pid === pid);
      if (i < 0 || !seats[i].alive) return;
      if (m.a === 'play') play(i, m.n ?? []);
      if (m.a === 'call') call(i);
      if (m.a === 'pull' && phase === 'roulette' && target === i) pull();
    },
    update(dt) {
      time += dt;
      timer -= dt;
      if (phase === 'turn' && seats[turn].bot && timer <= 0) botTurn(turn);
      else if (phase === 'turn' && timer <= 0) {
        // Temps écoulé : on joue à sa place.
        if (forced || !seats[turn].hand.length) call(turn);
        else play(turn, [Math.floor(Math.random() * seats[turn].hand.length)]);
      } else if (timer > 0) return;
      else if (phase === 'deal') {
        let i = starter;
        for (let k = 0; k < seats.length && !seats[i].alive; k++) i = (i + 1) % seats.length;
        startTurn(i, false);
      } else if (phase === 'reveal') startRoulette();
      else if (phase === 'roulette') pull();
      else if (phase === 'result') afterResult();
      else if (phase === 'end') game.over = true;
    },
    render(g, t) {
      drawBar(g, t, ctx.light);
      const n = seats.length;
      const pos = seats.map((_, i) => {
        const a = -Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2 + Math.PI;
        return { x: 960 + Math.cos(a) * 760, y: 560 + Math.sin(a) * 280 };
      });
      // Table de jeu (dessinée une fois puis recopiée) : rebord en bois verni, tapis vert, lumière de la lampe
      g.drawImage(tableImage(), 0, 0);
      // Lampe suspendue qui se balance un peu
      const sw = Math.sin(t * 0.8) * 6;
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(960, 0);
      g.lineTo(960 + sw, 150);
      g.stroke();
      g.fillStyle = '#ffd60a';
      g.beginPath();
      g.moveTo(900 + sw, 210);
      g.quadraticCurveTo(960 + sw, 120, 1020 + sw, 210);
      g.closePath();
      g.fill();
      g.stroke();

      // Carte du tour + pile
      g.fillStyle = '#fff';
      g.font = '600 30px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillText(fr ? 'Carte du tour' : 'Round card', 820, 470);
      drawCard(g, 820, 610, 150, 210, table, t, ctx.lang);
      for (let k = 0; k < Math.min(pile, 12); k++) drawCard(g, 1080 + k * 4, 640 - k * 5, 110, 154, null, t, ctx.lang);
      if (pile) {
        g.fillStyle = '#fff';
        g.font = '700 34px Fredoka, sans-serif';
        g.fillText(`× ${pile}`, 1100, 760);
      }

      // Révélation
      if ((phase === 'reveal' || phase === 'roulette' || phase === 'result') && last) {
        const w = 120;
        const x0 = 960 - ((last.cards.length - 1) * (w + 20)) / 2;
        g.fillStyle = 'rgba(46,22,48,0.75)';
        g.fillRect(0, 0, 1920, 1080);
        last.cards.forEach((c, k) => {
          const x = x0 + k * (w + 20);
          const flip = phase === 'reveal' ? Math.min(1, Math.max(0, (3.2 - timer - k * 0.35) * 2)) : 1;
          drawCard(g, x, 330, w * Math.max(0.05, Math.abs(flip * 2 - 1)), w * 1.4, flip > 0.5 ? c : null, t, ctx.lang);
          if (flip >= 1) {
            g.font = '700 70px sans-serif';
            g.fillText(c === 'miroir' ? '🪞' : isTrue(c) ? '✅' : '❌', x, 230);
          }
        });
        g.font = '700 110px Fredoka, sans-serif';
        g.lineWidth = 12;
        g.strokeStyle = INK;
        const title = fr ? 'MENTEUR !' : 'LIAR!';
        if (phase === 'reveal') {
          g.strokeText(title, 960, 560);
          g.fillStyle = '#ffd60a';
          g.fillText(title, 960, 560);
        }
      }

      // Joueurs
      seats.forEach((s, i) => {
        const p = pos[i];
        const focus = (phase === 'turn' && turn === i) || ((phase === 'roulette' || phase === 'result') && target === i);
        if (focus) {
          g.fillStyle = 'rgba(255,214,10,0.45)';
          g.beginPath();
          g.ellipse(p.x, p.y + 82, 110, 30, 0, 0, Math.PI * 2);
          g.fill();
        }
        drawCharacter(g, p.x, p.y + 82, 150, {
          food: s.profile.food,
          color: s.profile.color,
          hat: s.profile.hat,
          acc: s.profile.acc,
          eyes: s.profile.eyes,
          pose: s.profile.pose,
          selfie: s.selfie,
          t: t + i,
          ghost: !s.alive,
          mood: !s.alive ? 'sad' : focus && phase === 'roulette' ? 'wow' : 'happy',
        });
        if (!s.alive) drawCloud(g, p.x, p.y - 30, 0.8, t);
        roundRectText(g, s.profile.name, p.x - 95, p.y + 115, 190, 34, s.profile.color);
        g.font = '600 28px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = '#fff';
        g.fillText(s.alive ? `🃏 ${s.hand.length}   💨 ${s.shots}/6` : ctx.family ? (fr ? 'Éliminé' : 'Out') : 'KO', p.x, p.y - 112);
        if (phase === 'turn' && turn === i && !s.bot) {
          g.fillStyle = '#ffd60a';
          g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, p.x, p.y - 150);
        }
      });

      // Coussin de la roulette
      if ((phase === 'roulette' || phase === 'result') && target >= 0) {
        const s = seats[target];
        const shake = phase === 'roulette' ? Math.sin(t * 40) * 6 : 0;
        const big = phase === 'result' && boom;
        drawCharacter(g, 960 + shake, 820, big ? 300 : 260, {
          food: 'coussin',
          color: s.profile.color,
          t,
          mood: big ? 'wow' : 'happy',
        });
        g.font = '700 46px Fredoka, sans-serif';
        g.fillStyle = '#fff';
        if (phase === 'roulette')
          g.fillText(fr ? `1 risque sur ${6 - s.shots}…` : `1 in ${6 - s.shots} chance…`, 960, 880);
        if (phase === 'result') {
          if (boom) drawCloud(g, 960, 640, 2.4, t);
          g.font = '700 120px Fredoka, sans-serif';
          g.lineWidth = 12;
          g.strokeStyle = INK;
          const txt = boom ? (ctx.family ? (fr ? 'POUF !' : 'POOF!') : fr ? 'PROUUUT !' : 'PFFFRRT!') : fr ? 'Ouf…' : 'Phew…';
          g.strokeText(txt, 960, 560);
          g.fillStyle = boom ? '#7bd13b' : '#fff';
          g.fillText(txt, 960, 560);
        }
      }

      // Bandeau de messages
      // (au-dessus de la pastille du chrono)
      g.font = '600 38px Fredoka, sans-serif';
      const mw = Math.min(1700, g.measureText(message).width + 80);
      g.fillStyle = 'rgba(42,24,56,0.8)';
      g.beginPath();
      g.roundRect(960 - mw / 2, 880, mw, 70, 35);
      g.fill();
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.fillText(message, 960, 928);
    },
    ranking() {
      return [...seats].sort((a, b) => Number(b.alive) - Number(a.alive) || b.out - a.out).map((s) => s.pid);
    },
    leader() {
      return phase === 'end' ? alive()[0]?.profile.name ?? null : null;
    },
    padData(pid): BluffPadData {
      const i = seats.findIndex((s) => s.pid === pid);
      const s = seats[i];
      const myTurn = phase === 'turn' && turn === i && s.alive;
      return {
        table,
        hand: s?.hand ?? [],
        alive: !!s?.alive,
        shots: s?.shots ?? 0,
        myTurn,
        canCall: myTurn && !!last && last.seat !== i,
        forced: myTurn && forced,
        roulette: phase === 'roulette' && target === i,
        turnName: phase === 'turn' ? name(turn) : '',
        claim: last ? { name: name(last.seat), count: last.cards.length } : null,
      };
    },
  };
  deal();
  return game;
}

// ——— Dessin ———

function drawBar(g: CanvasRenderingContext2D, t: number, light: boolean) {
  const bg = g.createRadialGradient(960, 500, 100, 960, 540, 1200);
  bg.addColorStop(0, '#7b3a66');
  bg.addColorStop(1, '#2a1230');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1920, 1080);
  // Étagères et bouteilles de sirop
  g.fillStyle = '#4a1f45';
  g.fillRect(0, 180, 1920, 14);
  const colors = ['#ff4f9a', '#7bd13b', '#ffd60a', '#2ec5ff', '#9b5cff'];
  for (let i = 0; i < 24; i++) {
    g.fillStyle = colors[i % colors.length];
    g.globalAlpha = 0.5;
    g.beginPath();
    g.roundRect(40 + i * 80, 110, 34, 70, 8);
    g.fill();
  }
  g.globalAlpha = 1;
  // Enseigne néon
  g.save();
  g.font = '700 74px Fredoka, sans-serif';
  g.textAlign = 'center';
  // Pas de flou (Chromecast) : un contour prune fait office de néon.
  g.lineWidth = 10;
  g.strokeStyle = INK;
  g.strokeText('Le Bar des Bobards', 960, 90);
  g.fillStyle = '#ffd1ea';
  g.fillText('Le Bar des Bobards', 960, 90);
  g.restore();
}

function drawCard(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, c: Card | null, t: number, lang: 'fr' | 'en') {
  g.save();
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.fillStyle = c ? '#fff7e8' : '#9b5cff';
  g.beginPath();
  g.roundRect(cx - w / 2, cy - h / 2, w, h, Math.min(16, w / 4));
  g.fill();
  g.stroke();
  if (!c) {
    g.fillStyle = '#c7a6ff';
    g.beginPath();
    g.arc(cx, cy, Math.min(w, h) * 0.25, 0, Math.PI * 2);
    g.fill();
  } else if (w > 40) {
    if (c === 'miroir') {
      g.fillStyle = '#bfe6ff';
      g.beginPath();
      g.ellipse(cx, cy - h * 0.06, w * 0.3, h * 0.26, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(cx - w * 0.1, cy - h * 0.14, w * 0.06, h * 0.08, -0.5, 0, Math.PI * 2);
      g.fill();
    } else drawCharacter(g, cx, cy + h * 0.22, h * 0.48, { food: c, color: '#ffffff', t });
    g.fillStyle = INK;
    g.font = `700 ${Math.round(h * 0.11)}px Fredoka, sans-serif`;
    g.textAlign = 'center';
    g.fillText(CARD_NAMES[c][lang], cx, cy + h * 0.4);
  }
  g.restore();
}

function drawCloud(g: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  g.fillStyle = 'rgba(140,210,80,0.75)';
  for (let i = 0; i < 6; i++) {
    const a = i + t * 0.8;
    g.beginPath();
    g.arc(x + Math.cos(a) * 40 * s, y + Math.sin(a * 1.3) * 22 * s, (34 + (i % 3) * 8) * s, 0, Math.PI * 2);
    g.fill();
  }
}

export const bluff: GameBase = {
  id: 'bluff',
  emoji: '🃏',
  name: { fr: 'Le Bar des Bobards', en: 'Fibbers’ Bar' },
  how: {
    fr: 'Pose tes cartes face cachée… ou crie MENTEUR !',
    en: 'Play cards face down… or shout LIAR!',
  },
  inspired: "Liar's Bar",
  layout: 'bluff',
  min: 2,
  max: 6,
  botFill: 4,
  music: 'lobby',
  limit: 420,
  create,
};
