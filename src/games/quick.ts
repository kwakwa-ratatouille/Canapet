// Deux jeux de groupe rapides, joués sur le téléphone (QuizPad) :
// Plutôt Ça : deux choix absurdes, voter comme la majorité rapporte des points.
// Le Bon Chiffre : une question avec un nombre pour réponse, le plus proche gagne.
import { drawCharacter } from '../shared/characters';
import { CIEL, INK, MENTHE, ROSE } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { candy, fitText, studioBackdrop } from './draw';
import { PACKS, PACK_OPTION } from '../shared/offer';
import { PACK_PAIRS } from './packsData';
import { freshDeck } from './decks';
import { MORE_FACTS, MORE_PAIRS } from './moreContent';
import type { QuizPadData } from './quizShared';
import { wrap } from './tribunal';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

/** [français A, français B, anglais A, anglais B] ; `!` au début = caché en mode famille. */
const PAIRS: [string, string, string, string][] = [
  ['Avoir des doigts en saucisses', 'Avoir des cheveux en spaghettis', 'Have sausage fingers', 'Have spaghetti hair'],
  ['Parler en chantant toute ta vie', 'Marcher en sautillant toute ta vie', 'Sing every word for life', 'Hop everywhere for life'],
  ['Ne plus jamais manger de fromage', 'Ne plus jamais manger de chocolat', 'Never eat cheese again', 'Never eat chocolate again'],
  ['Être suivi par un pigeon à vie', 'Être suivi par un mime à vie', 'Be followed by a pigeon for life', 'Be followed by a mime for life'],
  ['Éternuer des confettis', 'Roter des bulles de savon', 'Sneeze confetti', 'Burp soap bubbles'],
  ['Vivre sans internet', 'Vivre sans musique', 'Live without internet', 'Live without music'],
  ['Avoir un rire de hyène', 'Avoir une voix d’écureuil', 'Have a hyena laugh', 'Have a chipmunk voice'],
  ['Dormir dans une baignoire', 'Dormir dans un placard', 'Sleep in a bathtub', 'Sleep in a closet'],
  ['Chaussettes mouillées à vie', 'Caillou dans la chaussure à vie', 'Wet socks for life', 'A pebble in your shoe for life'],
  ['Connaître la date de ta mort', 'Connaître la cause de ta mort', 'Know the date of your death', 'Know the cause of your death'],
  ['Voler à 2 km/h', 'Être invisible seulement quand personne ne regarde', 'Fly at 2 km/h', 'Be invisible only when nobody is looking'],
  ['Manger une pizza à l’ananas chaque jour', 'Ne plus jamais manger de pizza', 'Eat pineapple pizza every day', 'Never eat pizza again'],
  ['Être coincé dans un ascenseur avec ton patron', 'Être coincé dans un ascenseur avec ta belle-mère', 'Stuck in a lift with your boss', 'Stuck in a lift with your mother-in-law'],
  ['Remonter dans le temps', 'Voyager dans le futur', 'Travel to the past', 'Travel to the future'],
  ['Avoir un bouton pause pour le monde', 'Avoir un bouton retour de 10 secondes', 'A pause button for the world', 'A 10-second rewind button'],
  ['Parler toutes les langues', 'Parler à tous les animaux', 'Speak every language', 'Talk to all animals'],
  ['Gagner 1 million mais perdre tes amis', 'Garder tes amis et rester fauché', 'Win a million but lose your friends', 'Keep your friends and stay broke'],
  ['Être le plus bête du groupe', 'Être le plus moche du groupe', 'Be the dumbest of the group', 'Be the ugliest of the group'],
  ['Une semaine sans téléphone', 'Une semaine sans douche', 'A week with no phone', 'A week with no shower'],
  ['Avoir la musique de ta vie qui joue partout', 'Avoir un narrateur qui raconte ta vie', 'A soundtrack playing everywhere you go', 'A narrator telling your life'],
  ['Faire un discours devant 10 000 personnes', 'Chanter seul au karaoké de ta famille', 'Give a speech to 10,000 people', 'Sing alone at family karaoke'],
  ['Être géant de 3 mètres', 'Être minuscule de 30 centimètres', 'Be a 3-metre giant', 'Be 30 centimetres tall'],
  ['Ne manger que froid', 'Ne boire que chaud', 'Only eat cold food', 'Only drink hot drinks'],
  ['Avoir des oreilles d’éléphant', 'Avoir un nez de clown', 'Have elephant ears', 'Have a clown nose'],
  ['Vivre dans un zoo', 'Vivre dans un musée', 'Live in a zoo', 'Live in a museum'],
  ['Toujours avoir 5 minutes de retard', 'Toujours avoir 1 heure d’avance', 'Always be 5 minutes late', 'Always be 1 hour early'],
  ['!Que tes parents lisent tes messages', 'Que tes amis voient ton historique', '!Your parents read your messages', 'Your friends see your history'],
  ['!Péter à chaque bisou', 'Roter à chaque câlin', '!Fart with every kiss', 'Burp with every hug'],
  ['!Sortir avec ton ex', 'Sortir avec l’ex de ton meilleur ami', '!Date your ex', 'Date your best friend’s ex'],
  ['!Lendemain de cuite éternel', 'Ne plus jamais faire la fête', '!An eternal hangover', 'Never party again'],
  ['!Montrer tes photos à tout le monde', 'Montrer tes recherches internet', '!Show everyone your photos', 'Show everyone your searches'],
  ['!Être surpris en train de chanter nu', 'Être surpris en train de pleurer devant un film', '!Caught singing naked', 'Caught crying at a film'],
];

/** [question française, question anglaise, réponse]. Faits bien établis uniquement. */
const FACTS: [string, string, number][] = [
  ['Combien d’os a un adulte ?', 'How many bones does an adult have?', 206],
  ['Combien de dents a un adulte, sagesses comprises ?', 'How many teeth does an adult have, wisdom teeth included?', 32],
  ['Combien de touches sur un piano classique ?', 'How many keys on a standard piano?', 88],
  ['Combien de cases sur un échiquier ?', 'How many squares on a chessboard?', 64],
  ['Combien de cartes dans un jeu classique, sans les jokers ?', 'How many cards in a standard deck, no jokers?', 52],
  ['En quelle année l’homme a-t-il marché sur la Lune ?', 'In what year did humans first walk on the Moon?', 1969],
  ['En quelle année a commencé la Révolution française ?', 'In what year did the French Revolution begin?', 1789],
  ['En quelle année le Titanic a-t-il coulé ?', 'In what year did the Titanic sink?', 1912],
  ['En quelle année le mur de Berlin est-il tombé ?', 'In what year did the Berlin Wall fall?', 1989],
  ['Combien d’États aux États-Unis ?', 'How many states in the USA?', 50],
  ['Combien de cœurs a une pieuvre ?', 'How many hearts does an octopus have?', 3],
  ['Combien de pattes a une araignée ?', 'How many legs does a spider have?', 8],
  ['Combien d’étoiles sur le drapeau européen ?', 'How many stars on the European flag?', 12],
  ['Combien de minutes dans une journée ?', 'How many minutes in a day?', 1440],
  ['Combien d’heures dans une semaine ?', 'How many hours in a week?', 168],
  ['Combien de secondes dans une heure ?', 'How many seconds in an hour?', 3600],
  ['Combien de joueurs par équipe sur un terrain de rugby à XV ?', 'How many players per team in rugby union?', 15],
  ['Combien de planètes dans le système solaire ?', 'How many planets in the solar system?', 8],
  ['Combien d’anneaux sur le drapeau olympique ?', 'How many rings on the Olympic flag?', 5],
  ['Combien de bandes sur le drapeau américain ?', 'How many stripes on the US flag?', 13],
  ['Combien de nains accompagnent Blanche-Neige ?', 'How many dwarfs are with Snow White?', 7],
  ['Combien de lettres dans l’alphabet français ?', 'How many letters in the English alphabet?', 26],
  ['Combien de pattes a une abeille ?', 'How many legs does a bee have?', 6],
  ['En quelle année a eu lieu le premier Tour de France ?', 'In what year was the first Tour de France?', 1903],
  ['Combien de kilomètres fait un marathon, arrondi ?', 'How many kilometres is a marathon, rounded?', 42],
  ['À quelle température l’eau bout-elle au niveau de la mer, en °C ?', 'At what temperature does water boil at sea level, in °C?', 100],
  ['Combien de jours dans une année bissextile ?', 'How many days in a leap year?', 366],
  ['Combien de signes du zodiaque occidental ?', 'How many Western zodiac signs?', 12],
  ['Combien de joueurs d’une équipe sur un terrain de foot ?', 'How many players per team on a football pitch?', 11],
  ['Quelle est la hauteur de l’Everest, en mètres, à la centaine près ?', 'How tall is Everest in metres, to the nearest hundred?', 8800],
];

interface Pl extends Runner {
  score: number;
  pick: number;
  guess: number | null;
  gain: number;
}

const newPlayers = (runners: Runner[]): Pl[] => runners.slice(0, 12).map((r) => ({ ...r, score: 0, pick: -1, guess: null, gain: 0 }));

function drawRow(g: CanvasRenderingContext2D, pls: Pl[], t: number, label: (p: Pl) => string, y = 960, size = 90) {
  pls.forEach((p, i) => {
    const x = 960 + (i - (pls.length - 1) / 2) * Math.min(230, 1760 / pls.length);
    drawCharacter(g, x, y, size, {
      food: p.profile.food,
      color: p.profile.color,
      hat: p.profile.hat,
      acc: p.profile.acc,
      eyes: p.profile.eyes,
      pose: p.profile.pose,
      selfie: p.selfie,
      t: t + i,
      mood: 'happy',
    });
    g.font = '700 30px Fredoka, sans-serif';
    g.fillStyle = INK;
    g.textAlign = 'center';
    const step = Math.min(230, 1760 / pls.length);
    label(p).split('\n').forEach((line, k) => g.fillText(fitText(g, line, step - 8), x, y + 44 + k * 34));
  });
}

function card(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  g.fillStyle = fill;
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(x, y, w, h, 40);
  g.fill();
  g.stroke();
  candy(g, x, y, w, h, 40);
}

function centerText(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, w: number, size: number) {
  const font = `700 ${size}px Fredoka, sans-serif`;
  const lines = wrap(g, text, w, font);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * size * 1.2));
}

const SOLEIL_FX = '#ffd60a';

function createPlutot(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls = newPlayers(runners);
  const VOTE = 15;
  const SHOW = 5;
  const pack = ctx.opts.pack ? PACKS[ctx.opts.pack - 1] : null;
  const deck = freshDeck(pack ? `plutot-${pack.id}` : 'plutot', pack ? PACK_PAIRS[pack.id] : [...PAIRS, ...MORE_PAIRS].filter((q) => !(ctx.family && q[0].startsWith('!'))), 10, (q) => q[0] + q[1])
    .map((q) => (fr ? [q[0], q[1]] : [q[2], q[3]]).map((s) => s.replace(/^!/, '')));
  let round = -1;
  let phase: QuizPadData['phase'] = 'choose';
  let timer = 0;
  let botT = 0;
  const count = (k: number) => pls.filter((p) => p.pick === k).length;
  let roast = '';

  function next() {
    round++;
    if (round >= deck.length) {
      phase = 'end';
      timer = 5;
      sfx.win();
      ctx.refresh();
      return;
    }
    phase = 'choose';
    timer = VOTE;
    botT = 1 + Math.random() * 5;
    pls.forEach((p) => {
      p.pick = -1;
      p.gain = 0;
    });
    speak(fr ? `Plutôt ${deck[round][0]}, ou ${deck[round][1]} ?` : `${deck[round][0]}, or ${deck[round][1]}?`, ctx.lang);
    sfx.whoosh();
    ctx.refresh();
  }
  function reveal() {
    const a = count(0);
    const b = count(1);
    const best = a === b ? -1 : a > b ? 0 : 1;
    pls.forEach((p) => {
      // La majorité marque ; à égalité, tous ceux qui ont voté marquent 1
      if (p.pick < 0) return;
      p.gain = best < 0 ? 1 : p.pick === best ? 2 : 0;
      p.score += p.gain;
    });
    phase = 'reveal';
    timer = SHOW;
    sfx.boom();
    // Un seul dans son camp : tout le monde se moque
    const lonely = [0, 1].map((k) => pls.filter((p) => p.pick === k)).find((l) => l.length === 1 && pls.length >= 3);
    const line = lonely
      ? (fr ? `${lonely[0].profile.name}, tout seul de son côté. On va devoir en parler.` : `${lonely[0].profile.name}, all alone on that side. We need to talk.`)
      : best < 0
        ? (fr ? 'Égalité parfaite. Ce groupe est coupé en deux.' : 'A perfect tie. This group is split in two.')
        : (fr ? `Le salon a tranché. Pauvres de nous.` : `The room has spoken. Poor us.`);
    speak(line, ctx.lang);
    roast = line;
    ctx.refresh();
  }
  next();
  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'pick' || phase !== 'choose') return;
      const p = pls.find((x) => x.pid === pid);
      const k = m.n?.[0];
      if (!p || (k !== 0 && k !== 1)) return;
      p.pick = k;
      sfx.click();
      ctx.refresh();
    },
    update(dt) {
      timer -= dt;
      if (phase === 'choose') {
        if ((botT -= dt) <= 0) {
          botT = 99;
          pls.forEach((p) => {
            if (p.bot && p.pick < 0) p.pick = Math.random() < 0.5 ? 0 : 1;
          });
        }
        if (timer <= 0 || pls.every((p) => p.pick >= 0 || (!p.bot && ctx.away(p.pid)))) reveal();
      } else if (phase === 'reveal') {
        if (timer <= 0) next();
      } else if (timer <= 0) game.over = true;
    },
    render(g, t) {
      studioBackdrop(g, t, ctx.light, '#dff3ff', '#f1e6ff', '#8fd8ff');
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (phase === 'end') {
        g.font = '700 72px Fredoka, sans-serif';
        g.fillText(fr ? 'Qui pense comme tout le monde ?' : 'Who thinks like everyone else?', 960, 200);
        drawRow(g, pls, t, (p) => `${p.profile.name}\n${p.score}`, 640, 170);
        return;
      }
      g.font = '700 40px Fredoka, sans-serif';
      g.fillText(`😱 ${fr ? 'Le Pire des Deux' : 'Worst of Two'} · ${round + 1}/${deck.length}`, 960, 60);
      [0, 1].forEach((k) => {
        const x = k ? 990 : 90;
        card(g, x, 120, 840, 520, k ? CIEL : ROSE);
        g.fillStyle = k ? INK : '#fff';
        centerText(g, deck[round][k], x + 420, 340, 740, 56);
        if (phase === 'reveal') {
          g.font = '700 84px Fredoka, sans-serif';
          g.fillText(`${count(k)} 🗳️`, x + 420, 560);
        }
      });
      g.fillStyle = INK;
      g.font = '700 54px Fredoka, sans-serif';
      if (phase === 'choose') g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 960, 700);
      if (phase === 'reveal') {
        // Chacun rejoint le camp qu'il a choisi
        [0, 1].forEach((k) => {
          const side = pls.filter((p) => p.pick === k);
          side.forEach((p, i) => {
            const step = Math.min(150, 780 / Math.max(1, side.length));
            const x = (k ? 1410 : 510) + (i - (side.length - 1) / 2) * step;
            drawCharacter(g, x, 852 + Math.abs(Math.sin(t * 5 + i)) * -14, 124, { food: p.profile.food, color: p.profile.color, hat: p.profile.hat, acc: p.profile.acc, eyes: p.profile.eyes, pose: p.profile.pose, selfie: p.selfie, t: t + i, mood: p.gain ? 'win' : 'sad' });
            g.fillStyle = INK;
            g.font = '700 30px Fredoka, sans-serif';
            g.fillText(fitText(g, p.profile.name, step - 6), x, 886);
            if (p.gain) g.fillText(`+${p.gain}`, x, 920);
          });
        });
        card(g, 260, 950, 1400, 96, '#fff7c9');
        g.fillStyle = INK;
        centerText(g, roast, 960, 998, 1320, 38);
      } else drawRow(g, pls, t, (p) => (phase === 'reveal' && p.gain ? `${p.profile.name}\n+${p.gain}` : p.pick >= 0 && phase === 'choose' ? `✅ ${p.profile.name}` : p.profile.name));
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): QuizPadData {
      const p = pls.find((x) => x.pid === pid)!;
      return {
        phase,
        prompt: fr ? 'Tu préfères…' : 'Would you rather…',
        step: `${Math.min(round + 1, deck.length)}/${deck.length}`,
        act: phase === 'choose' ? 'choose' : null,
        options: phase === 'choose' ? deck[round].map((label, i) => ({ i, label, color: i ? CIEL : ROSE })) : [],
        picked: p.pick,
        score: p.score,
        left: phase === 'choose' ? Math.ceil(Math.max(0, timer)) : 0,
        note: '',
      };
    },
  };
  return game;
}

function createChiffre(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls = newPlayers(runners);
  const ASK = 25;
  const SHOW = 9;
  let bestNames = '';
  let worstName = '';
  let shownAt = 0;
  let clock = 0;
  const all = [...FACTS, ...MORE_FACTS].filter((f, i, a) => a.findIndex((x) => x[0] === f[0]) === i);
  const deck = freshDeck('chiffre', all, 8, (f) => f[0]);
  let round = -1;
  let phase: QuizPadData['phase'] = 'write';
  let timer = 0;
  let botT = 0;
  const q = () => deck[round][fr ? 0 : 1] as string;
  const truth = () => deck[round][2];

  function next() {
    round++;
    if (round >= deck.length) {
      phase = 'end';
      timer = 5;
      sfx.win();
      ctx.refresh();
      return;
    }
    phase = 'write';
    timer = ASK;
    botT = 2 + Math.random() * 8;
    pls.forEach((p) => {
      p.guess = null;
      p.gain = 0;
    });
    speak(q(), ctx.lang);
    sfx.whoosh();
    ctx.refresh();
  }
  function reveal() {
    const a = truth();
    const order = pls.filter((p) => p.guess !== null).sort((x, y) => Math.abs(x.guess! - a) - Math.abs(y.guess! - a));
    if (order[0]) {
      const best = Math.abs(order[0].guess! - a);
      order.forEach((p, i) => {
        const d = Math.abs(p.guess! - a);
        p.gain = d === 0 ? 5 : d === best ? 3 : i === 1 ? 1 : 0;
        p.score += p.gain;
      });
    }
    phase = 'reveal';
    timer = SHOW;
    shownAt = clock;
    // Toute égalité compte : ceux qui sont à la même distance partagent le Pif d'or
    const gap = (p: Pl) => Math.abs(p.guess! - a);
    const tops = order.filter((p) => gap(p) === gap(order[0]));
    const last = order[order.length - 1];
    const lastBad = order.length > tops.length ? last : null;
    // Beaucoup d'égalités : on les compte plutôt que de sortir de l'écran
    bestNames = tops.length > 2 ? (fr ? `${tops.length} joueurs` : `${tops.length} players`) : tops.map((p) => p.profile.name).join(' & ');
    worstName = lastBad?.profile.name ?? '';
    sfx.whoosh();
    // Suspense : le nombre défile, puis la vérité et les pifs
    setTimeout(() => {
      sfx.boom();
      const lines = [fr ? `La réponse : ${a}.` : `The answer: ${a}.`];
      if (bestNames) lines.push(fr ? `Pif d’or pour ${bestNames} !` : `Golden nose for ${bestNames}!`);
      if (worstName) lines.push(fr ? `Et ${worstName}, pif en carton.` : `And ${worstName}, cardboard nose.`);
      speak(lines.join(' '), ctx.lang);
    }, 1800);
    ctx.refresh();
  }
  next();
  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'text' || phase !== 'write' || !m.s) return;
      const p = pls.find((x) => x.pid === pid);
      const n = Number(m.s.replace(/\s/g, '').replace(',', '.'));
      if (!p || !Number.isFinite(n)) return;
      p.guess = n;
      sfx.join();
      ctx.refresh();
    },
    update(dt) {
      timer -= dt;
      clock += dt;
      if (phase === 'write') {
        if ((botT -= dt) <= 0) {
          botT = 99;
          pls.forEach((p) => {
            if (p.bot && p.guess === null) p.guess = Math.max(1, Math.round(truth() * (0.6 + Math.random() * 0.8)));
          });
        }
        if (timer <= 0 || pls.every((p) => p.guess !== null || (!p.bot && ctx.away(p.pid)))) reveal();
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
        g.fillText(fr ? 'Qui a le meilleur flair ?' : 'Who has the best instinct?', 960, 200);
        drawRow(g, pls, t, (p) => `${p.profile.name}\n${p.score}`, 640, 170);
        return;
      }
      g.font = '700 40px Fredoka, sans-serif';
      g.fillText(`🔢 Question ${round + 1}/${deck.length}`, 960, 60);
      card(g, 120, 110, 1680, 260, '#fff');
      g.fillStyle = INK;
      centerText(g, q(), 960, 240, 1540, 60);
      if (phase === 'write') {
        g.font = '700 70px Fredoka, sans-serif';
        g.fillStyle = timer < 8 ? ROSE : INK;
        g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 960, 520);
      } else {
        const since = clock - shownAt;
        const rolling = since < 1.8;
        const shake = rolling ? Math.sin(since * 40) * 6 : 0;
        card(g, 660 + shake, 410, 600, 150, rolling ? SOLEIL_FX : MENTHE);
        g.fillStyle = INK;
        g.font = '700 90px Fredoka, sans-serif';
        // Le nombre défile de plus en plus lentement avant de tomber juste
        const fake = Math.round(truth() * (0.4 + Math.abs(Math.sin(Math.floor(since * (14 - since * 5)) * 12.9)) * 1.2));
        g.fillText(String(rolling ? fake : truth()), 960 + shake, 488);
        if (!rolling) {
          g.font = '700 44px Fredoka, sans-serif';
          if (bestNames) g.fillText(`👃✨ ${fr ? 'Pif d’or' : 'Golden nose'} : ${bestNames}`, worstName ? 520 : 960, 610);
          if (worstName) g.fillText(`👃📦 ${fr ? 'Pif en carton' : 'Cardboard nose'} : ${worstName}`, 1400, 610);
        }
      }
      drawRow(g, pls, t, (p) => (phase === 'reveal' ? `${p.profile.name}\n${p.guess ?? '—'}${p.gain ? ` (+${p.gain})` : ''}` : p.guess !== null ? `✅ ${p.profile.name}` : p.profile.name), 860, 130);
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): QuizPadData {
      const p = pls.find((x) => x.pid === pid)!;
      return {
        phase,
        prompt: phase === 'end' ? '' : q(),
        step: `${Math.min(round + 1, deck.length)}/${deck.length}`,
        act: phase === 'write' && p.guess === null ? 'write' : null,
        options: [],
        picked: -1,
        score: p.score,
        left: phase === 'write' ? Math.ceil(Math.max(0, timer)) : 0,
        note: phase === 'write' && p.guess !== null ? `${fr ? 'Ta réponse' : 'Your answer'} : ${p.guess}` : '',
        numeric: true,
        hint: fr ? 'Ton nombre…' : 'Your number…',
      };
    },
  };
  return game;
}

export const plutot: GameBase = {
  id: 'plutot',
  emoji: '🤔',
  name: { fr: 'Le Pire des Deux', en: 'Worst of Two' },
  how: { fr: 'Deux choix absurdes : vote comme la majorité pour marquer !', en: 'Two absurd choices: vote with the majority to score!' },
  layout: 'buttons',
  min: 3,
  max: 12,
  botFill: 3,
  music: 'party',
  options: [PACK_OPTION],
  create: createPlutot,
};

export const chiffre: GameBase = {
  id: 'chiffre',
  emoji: '🔢',
  name: { fr: 'Le Juste Pif', en: 'Nose for Numbers' },
  how: { fr: 'Une question, un nombre : le plus proche gagne, le pile-poil rapporte gros !', en: 'One question, one number: closest wins, a bullseye pays big!' },
  layout: 'buttons',
  min: 2,
  max: 12,
  botFill: 3,
  music: 'party',
  create: createChiffre,
};
