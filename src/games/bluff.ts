// Le Bar des Bobards : jeu de bluff. On pose des cartes face cachée en prétendant que c'est la carte du tour ;
// le suivant peut crier « MENTEUR ! ». Le perdant joue à la roulette russe (pistolet de cartoon) : le danger est commun et monte à chaque tir.
import { drawCharacter } from '../shared/characters';
import { sfx, speak } from '../shared/sound';
import { CARD_NAMES, type BluffPadData, type Card } from './bluffShared';
import { roundRectText } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK, ROSE, SOLEIL } from '../shared/palette';

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
  /** Cartes qui volent vers la pile, bulles de paroles, temps écoulé depuis le tir. */
  let fly: { seat: number; n: number; t: number } | null = null;
  const bubbles: { seat: number; text: string; t: number; hot?: boolean }[] = [];
  let resT = 0;
  const bubble = (seat: number, text: string, hot = false) => {
    for (let k = bubbles.length - 1; k >= 0; k--) if (bubbles[k].seat === seat) bubbles.splice(k, 1);
    bubbles.push({ seat, text, t: 2.4, hot });
  };

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
    fly = { seat: i, n: cards.length, t: 0 };
    bubble(i, `${cards.length} × ${cardName(table)} !`);
    sfx.cards();
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
    bubble(i, fr ? 'MENTEUR !' : 'LIAR!', true);
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
        ? fr ? `Raté : ${name(last!.seat)} disait vrai. ${name(target)} prend le pistolet…` : `Wrong: ${name(last!.seat)} told the truth. ${name(target)} takes the gun…`
        : fr ? `Grillé ! ${name(target)} prend le pistolet…` : `Busted! ${name(target)} takes the gun…`,
    );
    sfx.spin();
    if (!seats[target].bot) ctx.buzz(seats[target].pid, 400);
    ctx.refresh();
  }

  /** Danger commun à toute la table : chargés sur 6. Chaque tir raté en ajoute un, une élimination remet à 1. */
  let danger = 1;

  function pull() {
    if (phase !== 'roulette') return;
    const s = seats[target];
    s.shots++;
    boom = Math.random() < danger / 6;
    phase = 'result';
    timer = 3.9;
    resT = 0;
    // Le chien s'abat… puis PAN ou clic
    sfx.cock();
    const bang = boom;
    setTimeout(() => {
      if (!bang) sfx.dryFire();
      else if (ctx.family) {
        sfx.pop();
        sfx.boing();
      } else {
        sfx.gunshot();
        setTimeout(() => sfx.pet(), 500);
      }
    }, 450);
    if (boom) {
      s.alive = false;
      s.out = ++outCount;
      s.hand = [];
      say(
        ctx.family
          ? fr ? `POUF ! ${name(target)} est éliminé.` : `POOF! ${name(target)} is out.`
          : fr ? `PAN ! ${name(target)} est KO.` : `BANG! ${name(target)} is out.`,
        true,
      );
      if (!s.bot) ctx.buzz(s.pid, 700);
      danger = 1;
    } else {
      danger = Math.min(5, danger + 1);
      say(fr ? `Clic… ouf ! ${name(target)} s'en sort. Le pistolet passe à ${danger} balles sur 6 pour tout le monde !` : `Click… phew! ${name(target)} survives. The gun goes up to ${danger} bullets in 6 for everyone!`, true);
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
      if (fly && (fly.t += dt) > 0.6 + fly.n * 0.1) fly = null;
      for (let k = bubbles.length - 1; k >= 0; k--) if ((bubbles[k].t -= dt) <= 0) bubbles.splice(k, 1);
      if (phase === 'result') resT += dt;
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
      g.drawImage(barScene(), 0, 0);
      drawBarLive(g, t, ctx.light);
      const n = seats.length;
      const pos = seats.map((_, i) => {
        const a = -Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2 + Math.PI;
        return { x: 960 + Math.cos(a) * 760, y: 560 + Math.sin(a) * 280 };
      });
      const cur = phase === 'turn' ? turn : phase === 'roulette' || phase === 'result' ? target : -1;
      // Projecteur sur celui qui doit jouer
      if (cur >= 0 && phase === 'turn') {
        const p = pos[cur];
        g.fillStyle = ctx.light ? 'rgba(255,240,170,0.12)' : 'rgba(255,240,170,0.2)';
        g.beginPath();
        g.moveTo(p.x - 30, 0);
        g.lineTo(p.x + 30, 0);
        g.lineTo(p.x + 150, p.y + 90);
        g.lineTo(p.x - 150, p.y + 90);
        g.closePath();
        g.fill();
      }
      g.drawImage(tableImage(), 0, 0);
      // Lampe suspendue qui se balance (sa lumière suit)
      const sw = Math.sin(t * 0.8) * 0.05;
      g.save();
      g.translate(960, 0);
      g.rotate(sw);
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, 150);
      g.stroke();
      g.fillStyle = '#fff6c8';
      g.beginPath();
      g.arc(0, 206, 18, 0, Math.PI);
      g.fill();
      g.fillStyle = '#ffd60a';
      g.beginPath();
      g.moveTo(-60, 210);
      g.quadraticCurveTo(0, 120, 60, 210);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();

      // Carte du tour + pile
      g.fillStyle = '#fff';
      g.font = '600 30px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillText(fr ? 'Carte du tour' : 'Round card', 820, 470);
      drawCard(g, 820, 610 + Math.sin(t * 2) * 4, 150, 210, table, t, ctx.lang);
      const shown = Math.min(pile - (fly ? fly.n : 0), 12);
      for (let k = 0; k < shown; k++) {
        g.save();
        g.translate(1080 + ((k * 37) % 11) - 5, 640 - k * 5);
        g.rotate(((k * 53) % 9) * 0.03 - 0.12);
        drawCard(g, 0, 0, 110, 154, null, t, ctx.lang);
        g.restore();
      }
      if (pile) {
        g.fillStyle = '#fff';
        g.font = '700 34px Fredoka, sans-serif';
        g.fillText(`× ${pile}`, 1100, 760);
      }
      // Cartes qui volent du joueur vers la pile
      if (fly) {
        const from = pos[fly.seat];
        for (let k = 0; k < fly.n; k++) {
          const q = Math.min(1, Math.max(0, (fly.t - k * 0.1) / 0.55));
          const e = 1 - Math.pow(1 - q, 3);
          const x = from.x + (1080 - from.x) * e;
          const y = from.y + (640 - from.y) * e - Math.sin(e * Math.PI) * 160;
          g.save();
          g.translate(x, y);
          g.rotate((1 - e) * 6 * (k % 2 ? 1 : -1) + k * 0.1);
          drawCard(g, 0, 0, 110, 154, null, t, ctx.lang);
          g.restore();
        }
      }

      // Joueurs : ils regardent celui qui joue, respirent, se balancent
      seats.forEach((s, i) => {
        const p = pos[i];
        const focus = i === cur;
        const look = cur >= 0 && cur !== i ? (pos[cur].x < p.x ? -1 : 1) : p.x < 960 ? 1 : -1;
        if (focus) {
          g.fillStyle = 'rgba(255,214,10,0.55)';
          g.beginPath();
          g.ellipse(p.x, p.y + 82, 120, 32, 0, 0, Math.PI * 2);
          g.fill();
        }
        // Verre devant chacun
        if (s.alive) drawGlass(g, p.x + (p.x < 960 ? 78 : -78), p.y + 70, s.profile.color, t + i);
        drawCharacter(g, p.x, p.y + 82, focus && phase === 'turn' ? 170 : 150, {
          food: s.profile.food,
          color: s.profile.color,
          hat: s.profile.hat,
          acc: s.profile.acc,
          eyes: s.profile.eyes,
          pose: s.profile.pose,
          selfie: s.selfie,
          t: t + i * 1.7,
          dir: look as 1 | -1,
          ghost: !s.alive,
          mood: !s.alive ? 'sad' : focus && phase === 'roulette' ? 'wow' : 'happy',
        });
        if (!s.alive) drawCloud(g, p.x, p.y - 30, 0.8, t);
        roundRectText(g, s.profile.name, p.x - 95, p.y + 115, 190, 34, s.profile.color);
        g.font = '600 28px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = '#fff';
        if (!(focus && phase === 'turn')) g.fillText(s.alive ? `🃏 ${s.hand.length}` : ctx.family ? (fr ? 'Éliminé' : 'Out') : 'KO', p.x, p.y - 112);
        // Flèche qui rebondit + anneau du temps au-dessus de celui qui joue
        if (focus && phase === 'turn') {
          const by = p.y - 150 + Math.abs(Math.sin(t * 5)) * -18;
          const left = Math.max(0, timer) / (s.bot ? 3.2 : TURN_TIME);
          g.lineWidth = 8;
          g.strokeStyle = INK;
          g.fillStyle = '#fff';
          g.beginPath();
          g.arc(p.x, by - 30, 40, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          if (!s.bot) {
            g.strokeStyle = timer < 8 ? '#ff3b3b' : '#1fc9a0';
            g.lineWidth = 9;
            g.beginPath();
            g.arc(p.x, by - 30, 33, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
            g.stroke();
          }
          g.fillStyle = INK;
          g.font = '700 30px Fredoka, sans-serif';
          g.fillText(s.bot ? '🤔' : String(Math.ceil(Math.max(0, timer))), p.x, by - 19);
          g.fillStyle = SOLEIL;
          g.strokeStyle = INK;
          g.lineWidth = 6;
          g.beginPath();
          g.moveTo(p.x - 26, by + 18);
          g.lineTo(p.x + 26, by + 18);
          g.lineTo(p.x, by + 50);
          g.closePath();
          g.fill();
          g.stroke();
        }
      });
      // Bulles (« 2 × Tartine ! », « MENTEUR ! »)
      for (const b of bubbles) {
        const p = pos[b.seat];
        const a = Math.min(1, b.t * 3);
        const pop = 1 + Math.max(0, 0.3 - (2.4 - b.t)) * 1.5;
        g.save();
        g.globalAlpha = Math.max(0, Math.min(1, a));
        g.translate(p.x + (p.x < 960 ? 120 : -120), p.y - 170);
        g.scale(pop, pop);
        g.font = '700 38px Fredoka, sans-serif';
        const w = g.measureText(b.text).width + 50;
        g.fillStyle = b.hot ? ROSE : '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(-w / 2, -36, w, 72, 30);
        g.fill();
        g.stroke();
        g.beginPath();
        g.moveTo(p.x < 960 ? -w / 2 + 30 : w / 2 - 30, 30);
        g.lineTo(p.x < 960 ? -w / 2 + 10 : w / 2 - 10, 62);
        g.lineTo(p.x < 960 ? -w / 2 + 60 : w / 2 - 60, 34);
        g.fill();
        g.fillStyle = b.hot ? '#fff' : INK;
        g.textAlign = 'center';
        g.fillText(b.text, 0, 13);
        g.restore();
      }

      // Révélation
      if ((phase === 'reveal' || phase === 'roulette' || phase === 'result') && last) {
        const w = 120;
        const x0 = 960 - ((last.cards.length - 1) * (w + 20)) / 2;
        g.fillStyle = 'rgba(46,22,48,0.78)';
        g.fillRect(0, 0, 1920, 1080);
        const ry = phase === 'reveal' ? 330 : 180;
        last.cards.forEach((c, k) => {
          const x = x0 + k * (w + 20);
          const flip = phase === 'reveal' ? Math.min(1, Math.max(0, (3.2 - timer - k * 0.35) * 2)) : 1;
          drawCard(g, x, ry, w * Math.max(0.05, Math.abs(flip * 2 - 1)), w * 1.4, flip > 0.5 ? c : null, t, ctx.lang);
          if (flip >= 1 && phase === 'reveal') {
            g.font = '700 70px sans-serif';
            g.fillText(c === 'miroir' ? '🪞' : isTrue(c) ? '✅' : '❌', x, 230);
          }
        });
        if (phase === 'reveal') {
          g.font = '700 110px Fredoka, sans-serif';
          g.lineWidth = 12;
          g.strokeStyle = INK;
          const title = fr ? 'MENTEUR !' : 'LIAR!';
          const k = 1 + Math.max(0, 0.4 - (3.2 - timer)) * 2;
          g.save();
          g.translate(960, 560);
          g.scale(k, k);
          g.rotate(Math.sin(t * 20) * 0.03);
          g.strokeText(title, 0, 0);
          g.fillStyle = '#ffd60a';
          g.fillText(title, 0, 0);
          g.restore();
        }
      }

      // Roulette russe : le pistolet braqué sur le perdant
      if ((phase === 'roulette' || phase === 'result') && target >= 0) {
        const s = seats[target];
        const shot = phase === 'result' && resT > 0.45;
        const hit = shot && boom;
        const fall = hit ? Math.min(1, (resT - 0.45) * 3) : 0;
        const tremble = phase === 'roulette' ? Math.sin(t * 50) * 3 : 0;
        g.save();
        g.translate(700 + tremble, 900);
        g.rotate(-fall * 1.35);
        drawCharacter(g, 0, 0, 340, {
          food: s.profile.food,
          color: s.profile.color,
          hat: s.profile.hat,
          acc: s.profile.acc,
          selfie: s.selfie,
          t,
          dir: 1,
          mood: hit ? 'sad' : shot ? 'happy' : 'wow',
        });
        g.restore();
        // Gouttes de sueur
        if (phase === 'roulette' || (phase === 'result' && !hit)) {
          g.fillStyle = '#7fd4ff';
          g.strokeStyle = INK;
          g.lineWidth = 3;
          for (let k = 0; k < 2; k++) {
            const q = (t * 1.2 + k * 0.5) % 1;
            g.beginPath();
            g.ellipse(620 + k * 170, 560 + q * 120, 10, 15, 0, 0, Math.PI * 2);
            g.fill();
            g.stroke();
          }
        }
        // Le pistolet
        const recoil = shot ? Math.max(0, 1 - (resT - 0.45) * 4) : 0;
        const cock = phase === 'roulette' ? 1 : Math.max(0, 1 - resT * 2.6);
        const spin = phase === 'roulette' ? t * 9 : 0;
        drawGun(g, 1200 + recoil * 60, 680 - recoil * 40, 1, spin, cock, danger, -recoil * 0.35 + Math.sin(t * 2) * 0.02 * (phase === 'roulette' ? 1 : 0), ctx.family && hit);
        // Barillet en grand : chambres chargées
        g.font = '700 46px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = '#fff';
        if (phase === 'roulette') {
          g.fillText(fr ? `${danger} balle${danger > 1 ? 's' : ''} sur 6…` : `${danger} bullet${danger > 1 ? 's' : ''} in 6…`, 1230, 820);
          g.font = '600 32px Fredoka, sans-serif';
          g.fillText(s.bot ? '…' : fr ? '👉 Appuie sur la détente sur ton téléphone' : '👉 Pull the trigger on your phone', 1230, 866);
        }
        if (shot) {
          if (hit) {
            // Éclair blanc, flamme au bout du canon
            const fl = Math.max(0, 1 - (resT - 0.45) * 5);
            if (fl > 0) {
              g.fillStyle = `rgba(255,255,255,${fl * 0.7})`;
              g.fillRect(0, 0, 1920, 1080);
            }
            if (ctx.family) drawFlag(g, 900, 650, fr ? 'POUF !' : 'POOF!', Math.min(1, (resT - 0.45) * 4));
            else {
              drawStar(g, 966, 650, 90 * (0.6 + fl), '#ffd60a');
              drawStar(g, 966, 650, 50 * (0.6 + fl), '#fff');
              drawCloud(g, 900 - (resT - 0.45) * 120, 560 - (resT - 0.45) * 60, 1.2, t);
            }
          }
          g.font = '700 130px Fredoka, sans-serif';
          g.lineWidth = 14;
          g.strokeStyle = INK;
          const txt = hit ? (ctx.family ? (fr ? 'POUF !' : 'POOF!') : fr ? 'PAN !' : 'BANG!') : fr ? '*clic*… Ouf !' : '*click*… Phew!';
          const k = 1 + Math.max(0, 0.25 - (resT - 0.45)) * 3;
          g.save();
          g.translate(960, 330);
          g.scale(k, k);
          g.textAlign = 'center';
          g.strokeText(txt, 0, 0);
          g.fillStyle = hit ? '#ff3b3b' : '#fff';
          g.fillText(txt, 0, 0);
          g.restore();
        }
      }

      // Bandeau du haut : à qui de jouer
      if (phase === 'turn') {
        const s = seats[turn];
        const txt = forced ? (fr ? `🫵 ${s.profile.name} doit accuser !` : `🫵 ${s.profile.name} must accuse!`) : fr ? `🃏 Au tour de ${s.profile.name}` : `🃏 ${s.profile.name}'s turn`;
        g.font = '700 46px Fredoka, sans-serif';
        const w = g.measureText(txt).width + 90;
        const k = 1 + Math.sin(t * 4) * 0.02;
        g.save();
        g.translate(960, 166);
        g.scale(k, k);
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(-w / 2, -38 + 8, w, 76, 38);
        g.fill();
        g.fillStyle = s.profile.color;
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

      // Bandeau de messages (caché pendant la roulette : tout est déjà à l'écran)
      if (phase !== 'roulette' && phase !== 'result') {
        g.font = '600 38px Fredoka, sans-serif';
        const mw = Math.min(1700, g.measureText(message).width + 80);
        g.fillStyle = 'rgba(42,24,56,0.85)';
        g.beginPath();
        g.roundRect(960 - mw / 2, 880, mw, 70, 35);
        g.fill();
        g.fillStyle = '#fff';
        g.textAlign = 'center';
        g.fillText(message, 960, 928);
      }
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
        shots: danger,
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

let sceneCache: HTMLCanvasElement | null = null;
/** Le bar (dessiné une fois) : mur lambrissé, étagères de sirops, comptoir, juke-box, cadres, parquet. */
function barScene(): HTMLCanvasElement {
  if (sceneCache) return sceneCache;
  const c = document.createElement('canvas');
  c.width = 1920;
  c.height = 1080;
  const g = c.getContext('2d')!;
  const rr = (x: number, y: number, w: number, h: number, r: number, fill: string, lw = 6) => {
    g.fillStyle = fill;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
    if (lw) {
      g.strokeStyle = INK;
      g.lineWidth = lw;
      g.stroke();
    }
  };
  // Mur : papier peint à rayures prune
  const wall = g.createLinearGradient(0, 0, 0, 640);
  wall.addColorStop(0, '#5a2550');
  wall.addColorStop(1, '#7b3a66');
  g.fillStyle = wall;
  g.fillRect(0, 0, 1920, 640);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x < 1920; x += 64) g.fillRect(x, 0, 26, 640);
  // Lambris en bois en bas du mur
  g.fillStyle = '#7a3d22';
  g.fillRect(0, 560, 1920, 120);
  g.fillStyle = '#5e2c17';
  for (let x = 20; x < 1920; x += 160) rr(x, 576, 130, 88, 10, '#8a4a2a', 4);
  g.fillStyle = INK;
  g.fillRect(0, 556, 1920, 8);
  // Parquet
  g.fillStyle = '#4a2318';
  g.fillRect(0, 680, 1920, 400);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 3;
  for (let y = 700; y < 1080; y += 46) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1920, y);
    g.stroke();
    for (let x = (y / 46) % 2 ? 0 : 120; x < 1920; x += 240) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + 46);
      g.stroke();
    }
  }
  // Étagères de sirops
  const colors = ['#ff4f9a', '#7bd13b', '#ffd60a', '#2ec5ff', '#9b5cff', '#ff9a1f'];
  for (const sy of [196, 330]) {
    for (let i = 0; i < 26; i++) {
      const x = 30 + i * 72 + (sy === 330 ? 30 : 0);
      if (x > 560 && x < 1360) continue;
      const h = 60 + ((i * 37 + sy) % 4) * 12;
      const col = colors[(i + sy) % colors.length];
      rr(x, sy - h, 40, h, 10, col, 4);
      rr(x + 12, sy - h - 20, 16, 24, 4, col, 4);
      g.fillStyle = '#fff';
      g.fillRect(x + 6, sy - h * 0.55, 28, 16);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(x + 6, sy - h + 8, 6, h * 0.5);
    }
    rr(0, sy, 560, 16, 4, '#8a4a2a', 4);
    rr(1360, sy, 560, 16, 4, '#8a4a2a', 4);
  }
  // Cadres au-dessus de la table
  const frame = (x: number, y: number, w: number, h: number, emoji: string, bg: string) => {
    rr(x, y, w, h, 10, '#d9a441', 6);
    rr(x + 12, y + 12, w - 24, h - 24, 6, bg, 4);
    g.font = `${Math.round(h * 0.45)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, x + w / 2, y + h / 2 + 4);
    g.textBaseline = 'alphabetic';
  };
  frame(640, 200, 150, 120, '🥒', '#c9f5e3');
  frame(1130, 200, 150, 120, '🃏', '#ffe08a');
  // Comptoir à gauche (le barman se tient derrière)
  rr(-20, 430, 250, 150, 18, '#b86a3c', 6);
  rr(-20, 410, 270, 34, 12, '#d98a4a', 6);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(0, 416, 230, 6);
  // Juke-box à droite
  rr(1730, 330, 180, 250, 90, '#ff4f9a', 6);
  rr(1755, 365, 130, 100, 50, '#ffe08a', 5);
  for (let k = 0; k < 4; k++) rr(1760 + k * 31, 480, 22, 60, 9, ['#2ec5ff', '#7bd13b', '#ffd60a', '#9b5cff'][k], 4);
  rr(1720, 570, 200, 36, 14, '#9b5cff', 6);
  sceneCache = c;
  return c;
}

/** Ce qui bouge dans le bar : néon qui grésille, guirlande, barman qui essuie un verre, notes du juke-box. */
function drawBarLive(g: CanvasRenderingContext2D, t: number, light: boolean) {
  // Guirlande lumineuse
  for (let i = 0; i < 24; i++) {
    const x = 40 + i * 80;
    const y = 30 + Math.sin(i * 0.9) * 8 + 10;
    const on = light || (Math.floor(t * 2 + i) % 3 !== 0);
    g.fillStyle = on ? ['#ffd60a', '#ff4f9a', '#2ec5ff', '#7bd13b'][i % 4] : '#5a3a5a';
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y + 12, 9, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // Enseigne néon (grésille de temps en temps)
  const flick = light ? 1 : t % 7 < 0.12 || (t % 7 > 0.3 && t % 7 < 0.36) ? 0.35 : 1;
  g.save();
  g.globalAlpha = flick;
  g.font = '700 74px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 12;
  g.strokeStyle = INK;
  g.strokeText('Le Bar des Bobards', 960, 110);
  g.fillStyle = '#ffd1ea';
  g.fillText('Le Bar des Bobards', 960, 110);
  g.restore();
  // Barman (un cornichon moustachu) qui essuie un verre
  drawCharacter(g, 100, 430, 140, { food: 'cornichon', color: '#ffffff', hat: 'aucun', t, dir: 1 });
  const wx = 170 + Math.sin(t * 6) * 12;
  g.fillStyle = 'rgba(220,245,255,0.9)';
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(wx - 18, 330, 36, 48, 8);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(wx + Math.sin(t * 6) * 8, 360, 26, 14, 0.3, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // Notes de musique du juke-box
  if (!light)
    for (let k = 0; k < 3; k++) {
      const q = (t * 0.4 + k / 3) % 1;
      g.globalAlpha = 1 - q;
      g.font = '40px sans-serif';
      g.textAlign = 'center';
      g.fillStyle = '#fff';
      g.fillText(k % 2 ? '♪' : '♫', 1820 + Math.sin(q * 6 + k) * 40, 320 - q * 160);
      g.globalAlpha = 1;
    }
}

/** Petit verre de sirop devant chaque joueur (il trinque de temps en temps). */
function drawGlass(g: CanvasRenderingContext2D, x: number, y: number, color: string, t: number) {
  const lift = t % 9 < 0.8 ? Math.sin((t % 9) / 0.8 * Math.PI) * 26 : 0;
  g.fillStyle = color;
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(x - 14, y - 34 - lift, 28, 34, 6);
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(x - 9, y - 30 - lift, 5, 22);
}

/** Revolver cartoon (canon vers la gauche). spin = rotation du barillet, cock = chien armé (0-1). */
function drawGun(g: CanvasRenderingContext2D, x: number, y: number, s: number, spin: number, cock: number, loaded: number, rot: number, flag: boolean) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  g.strokeStyle = INK;
  g.lineWidth = 7;
  const rr = (rx: number, ry: number, w: number, h: number, r: number, fill: string) => {
    g.fillStyle = fill;
    g.beginPath();
    g.roundRect(rx, ry, w, h, r);
    g.fill();
    g.stroke();
  };
  // Crosse en bois
  g.fillStyle = '#b86a3c';
  g.beginPath();
  g.moveTo(60, -10);
  g.lineTo(150, -10);
  g.quadraticCurveTo(200, 120, 170, 170);
  g.lineTo(100, 170);
  g.quadraticCurveTo(110, 80, 60, 40);
  g.closePath();
  g.fill();
  g.stroke();
  // Pontet + détente
  g.beginPath();
  g.arc(40, 40, 30, 0, Math.PI);
  g.stroke();
  rr(36, 10, 10, 34, 4, '#c9c3d6');
  // Canon
  rr(-200, -58, 220, 58, 18, '#c9c3d6');
  rr(-214, -64, 26, 70, 9, '#9b8fb0');
  rr(-186, -80, 18, 22, 5, '#9b8fb0');
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(-175, -48, 160, 8);
  // Carcasse
  rr(-24, -74, 176, 104, 28, '#a79bc0');
  // Chien
  g.save();
  g.translate(140, -48);
  g.rotate(-0.9 * cock);
  rr(-6, -34, 18, 40, 6, '#9b8fb0');
  g.restore();
  // Barillet : 6 chambres, les chargées en rouge
  g.save();
  g.translate(62, -22);
  g.fillStyle = '#d9d3e6';
  g.beginPath();
  g.arc(0, 0, 50, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.rotate(spin);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.fillStyle = k < loaded ? '#ff3b3b' : '#3a2140';
    g.beginPath();
    g.arc(Math.cos(a) * 30, Math.sin(a) * 30, 11, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 3;
    g.stroke();
  }
  g.restore();
  // Mode famille : un petit drapeau sort du canon au lieu d'une balle
  if (flag) {
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-214, -30);
    g.lineTo(-300, -30);
    g.stroke();
  }
  g.restore();
}

function drawFlag(g: CanvasRenderingContext2D, x: number, y: number, text: string, k: number) {
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.font = '700 48px Fredoka, sans-serif';
  const w = g.measureText(text).width + 40;
  g.fillStyle = '#fff';
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(-w, -40, w, 80, 12);
  g.fill();
  g.stroke();
  g.fillStyle = '#ff3b3b';
  g.textAlign = 'center';
  g.fillText(text, -w / 2, 16);
  g.restore();
}

function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.fillStyle = fill;
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const rr = k % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.stroke();
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
  music: 'bar',
  limit: 420,
  create,
};
