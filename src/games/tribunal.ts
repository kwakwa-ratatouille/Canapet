// Le Tribunal : « Qui de nous serait le premier à… ? ». Chacun vote sur son téléphone pour un joueur du salon.
// Le plus désigné est condamné sous les rires. Voter comme la majorité rapporte des points.
import { drawCharacter } from '../shared/characters';
import { INK, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { candy, roundRectText } from './draw';
import type { QuizPadData } from './quizShared';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

const ROUNDS = 8;
const VOTE_TIME = 20;
const SHOW_TIME = 7;

/** [français, anglais] ; `!` au début = caché en mode famille. */
const CASES: [string, string][] = [
  ['Qui oublierait son propre anniversaire ?', 'Who would forget their own birthday?'],
  ['Qui survivrait le moins longtemps sur une île déserte ?', 'Who would last the shortest on a desert island?'],
  ['Qui serait le premier à pleurer devant un dessin animé ?', 'Who would be first to cry at a cartoon?'],
  ['Qui parlerait à son frigo en cas de solitude ?', 'Who would talk to their fridge when lonely?'],
  ['Qui se perdrait dans sa propre rue ?', 'Who would get lost on their own street?'],
  ['Qui mangerait le gâteau d’anniversaire avant la fête ?', 'Who would eat the birthday cake before the party?'],
  ['Qui deviendrait célèbre pour une raison ridicule ?', 'Who would become famous for a ridiculous reason?'],
  ['Qui passerait son mariage sur son téléphone ?', 'Who would spend their own wedding on their phone?'],
  ['Qui adopterait 12 chats sans prévenir personne ?', 'Who would adopt 12 cats without telling anyone?'],
  ['Qui répondrait « toi aussi » au serveur qui dit bon appétit ?', 'Who would say “you too” when the waiter says enjoy your meal?'],
  ['Qui s’endormirait pendant son propre discours ?', 'Who would fall asleep during their own speech?'],
  ['Qui triche au Monopoly sans aucune honte ?', 'Who cheats at board games with zero shame?'],
  ['Qui enverrait un message au mauvais groupe ?', 'Who would text the wrong group chat?'],
  ['Qui resterait coincé dans un toboggan pour enfants ?', 'Who would get stuck in a kids’ slide?'],
  ['Qui lancerait une secte par accident ?', 'Who would start a cult by accident?'],
  ['Qui serait viré dès le premier jour ?', 'Who would get fired on day one?'],
  ['Qui se ferait battre par un pigeon ?', 'Who would lose a fight to a pigeon?'],
  ['Qui garde des sauces de fast-food depuis 2015 ?', 'Who keeps fast-food sauces from 2015?'],
  ['Qui danserait seul au supermarché ?', 'Who would dance alone at the supermarket?'],
  ['Qui mentirait sur son âge à sa propre mère ?', 'Who would lie about their age to their own mum?'],
  ['Qui confondrait le sel et le sucre pour tout un repas ?', 'Who would mix up salt and sugar for a whole meal?'],
  ['Qui applaudirait quand l’avion atterrit ?', 'Who would clap when the plane lands?'],
  ['Qui serait le plus nul dans un film d’espions ?', 'Who would be the worst in a spy movie?'],
  ['Qui répondrait à un arnaqueur juste pour discuter ?', 'Who would answer a scammer just to chat?'],
  ['Qui prendrait 200 selfies pour en garder un seul ?', 'Who would take 200 selfies to keep one?'],
  ['Qui arriverait en retard à son propre enterrement ?', 'Who would be late to their own funeral?'],
  ['Qui demanderait le code wifi avant de dire bonjour ?', 'Who would ask for the wifi before saying hello?'],
  ['Qui garderait le plus de secrets sur les autres ?', 'Who knows the most secrets about everyone else?'],
  ['Qui se ferait expulser d’un buffet à volonté ?', 'Who would get thrown out of an all-you-can-eat buffet?'],
  ['Qui ferait un discours gênant à un mariage ?', 'Who would give an awkward wedding speech?'],
  ['!Qui enverrait un message à son ex à 3 h du matin ?', '!Who would text their ex at 3 a.m.?'],
  ['!Qui a déjà fait semblant d’être malade pour éviter une soirée ?', '!Who has faked being sick to skip a party?'],
  ['!Qui finirait la soirée à dormir dans la baignoire ?', '!Who would end the night asleep in the bathtub?'],
  ['!Qui lâcherait une caisse en plein rendez-vous galant ?', '!Who would fart on a first date?'],
  ['!Qui ment le plus sur son profil de rencontres ?', '!Who lies the most on their dating profile?'],
  ['!Qui a l’historique internet le plus inavouable ?', '!Who has the most embarrassing browser history?'],
  ['!Qui draguerait le ou la pote de son ex ?', '!Who would flirt with their ex’s best friend?'],
  ['!Qui ferait n’importe quoi pour 100 euros ?', '!Who would do anything for 100 euros?'],
  ['!Qui se réveillerait sans savoir où il est ?', '!Who would wake up with no idea where they are?'],
  ['!Qui fouille dans le téléphone des autres ?', '!Who snoops through other people’s phones?'],
];

interface Pl extends Runner {
  score: number;
  pick: number;
  gain: number;
}

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls: Pl[] = runners.slice(0, 12).map((r) => ({ ...r, score: 0, pick: -1, gain: 0 }));
  const deck = CASES.filter((c) => !(ctx.family && c[0].startsWith('!')))
    .sort(() => Math.random() - 0.5)
    .slice(0, ROUNDS)
    .map((c) => c[fr ? 0 : 1].replace(/^!/, ''));
  let round = -1;
  let phase: QuizPadData['phase'] = 'choose';
  let timer = 0;
  let botT = 0;
  let guilty: number[] = [];

  function next() {
    round++;
    if (round >= deck.length) {
      phase = 'end';
      timer = 5;
      const top = [...pls].sort((a, b) => b.score - a.score)[0];
      speak(fr ? `${top.profile.name} connaît le mieux ce groupe !` : `${top.profile.name} knows this group best!`, ctx.lang);
      sfx.win();
      ctx.refresh();
      return;
    }
    phase = 'choose';
    timer = VOTE_TIME;
    botT = 2 + Math.random() * 6;
    pls.forEach((p) => {
      p.pick = -1;
      p.gain = 0;
    });
    speak(deck[round], ctx.lang);
    sfx.whoosh();
    ctx.refresh();
  }

  const votesFor = (k: number) => pls.filter((p) => p.pick === k).length;

  function verdict() {
    const max = Math.max(...pls.map((_, k) => votesFor(k)));
    guilty = max > 0 ? pls.map((_, k) => k).filter((k) => votesFor(k) === max) : [];
    // Avoir voté avec la majorité rapporte 2 points ; le condamné en gagne 1 pour le dédommager
    pls.forEach((p) => {
      if (guilty.includes(p.pick)) p.gain += 2;
    });
    guilty.forEach((k) => (pls[k].gain += 1));
    pls.forEach((p) => (p.score += p.gain));
    phase = 'reveal';
    timer = SHOW_TIME;
    sfx.boom();
    if (guilty.length === 1) speak(fr ? `Coupable : ${pls[guilty[0]].profile.name} !` : `Guilty: ${pls[guilty[0]].profile.name}!`, ctx.lang);
    else if (guilty.length > 1) speak(fr ? 'Coupables ex æquo !' : 'Tied verdict!', ctx.lang);
    ctx.refresh();
  }

  next();

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'pick' || phase !== 'choose') return;
      const p = pls.find((x) => x.pid === pid);
      const k = m.n?.[0] ?? -1;
      if (!p || k < 0 || k >= pls.length) return;
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
            if (p.bot && p.pick < 0) p.pick = Math.floor(Math.random() * pls.length);
          });
        }
        if (timer <= 0 || pls.every((p) => p.pick >= 0)) verdict();
      } else if (phase === 'reveal') {
        if (timer <= 0) next();
      } else if (timer <= 0) game.over = true;
    },
    render(g, t) {
      const bg = g.createLinearGradient(0, 0, 0, 1080);
      bg.addColorStop(0, '#5b2d6e');
      bg.addColorStop(1, '#2d1538');
      g.fillStyle = bg;
      g.fillRect(0, 0, 1920, 1080);
      // Colonnes du tribunal
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let x = 80; x < 1920; x += 320) g.fillRect(x, 0, 110, 1080);
      // La question
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(140, 60, 1640, 240, 40);
      g.fill();
      g.stroke();
      candy(g, 140, 60, 1640, 240, 40);
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '700 34px Fredoka, sans-serif';
      g.fillText(phase === 'end' ? (fr ? 'L’audience est levée' : 'Court is adjourned') : `⚖️ ${fr ? 'Affaire' : 'Case'} ${round + 1}/${deck.length}`, 960, 105);
      const text = phase === 'end' ? (fr ? 'Qui a le mieux jugé ses amis ?' : 'Who judged their friends best?') : deck[round];
      const lines = wrap(g, text, 1540, '700 54px Fredoka, sans-serif');
      lines.forEach((l, i) => g.fillText(l, 960, 195 + (i - (lines.length - 1) / 2) * 64));
      // Le chrono
      if (phase === 'choose') {
        const w = 1640 * Math.max(0, timer / VOTE_TIME);
        g.fillStyle = timer < 6 ? ROSE : SOLEIL;
        g.fillRect(140, 318, w, 14);
      }
      // Les accusés
      const n = pls.length;
      const cols = Math.min(6, n);
      const rows = Math.ceil(n / cols);
      const size = rows > 1 ? 120 : 190;
      pls.forEach((p, i) => {
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, n - row * cols);
        const col = i - row * cols;
        const x = 960 + (col - (inRow - 1) / 2) * (1720 / cols);
        const y = (rows > 1 ? 560 : 730) + row * 340;
        const isGuilty = phase === 'reveal' && guilty.includes(i);
        const voted = phase === 'choose' && p.pick >= 0;
        drawCharacter(g, x, y + (isGuilty ? Math.sin(t * 12) * 8 : 0), isGuilty ? size * 1.25 : size, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          mood: isGuilty ? 'sad' : phase === 'end' ? 'win' : voted ? 'happy' : 'wow',
        });
        roundRectText(g, p.profile.name, x - 110, y + 30, 220, 34, p.profile.color);
        if (phase === 'reveal' || phase === 'end') {
          g.font = '700 42px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.fillStyle = '#fff';
          if (phase === 'reveal') g.fillText(`${votesFor(i)} 🗳️${p.gain ? `   +${p.gain}` : ''}`, x, y + 90);
          else g.fillText(`⭐ ${p.score}`, x, y + 90);
        } else if (voted) {
          g.font = '700 42px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.fillText('✅', x, y - size - 10);
        }
        if (isGuilty) {
          g.save();
          g.translate(x, y - size * 1.25 - 40);
          g.rotate(-0.08);
          g.fillStyle = ROSE;
          g.strokeStyle = INK;
          g.lineWidth = 6;
          g.beginPath();
          g.roundRect(-130, -36, 260, 72, 18);
          g.fill();
          g.stroke();
          g.fillStyle = '#fff';
          g.font = '700 42px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.fillText(fr ? 'COUPABLE' : 'GUILTY', 0, 2);
          g.restore();
        }
      });
    },
    ranking() {
      return [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid);
    },
    leader() {
      return null;
    },
    padData(pid): QuizPadData {
      const p = pls.find((x) => x.pid === pid)!;
      return {
        phase,
        prompt: phase === 'end' ? '' : deck[round] ?? '',
        step: `${fr ? 'Affaire' : 'Case'} ${Math.min(round + 1, deck.length)}/${deck.length}`,
        act: phase === 'choose' ? 'choose' : null,
        options: pls.map((x, i) => ({ i, label: x.profile.name, color: x.profile.color })),
        picked: p.pick,
        score: p.score,
        left: phase === 'choose' ? Math.ceil(Math.max(0, timer)) : 0,
        note: '',
      };
    },
  };
  return game;
}

/** Coupe un texte en lignes qui tiennent dans la largeur. */
export function wrap(g: CanvasRenderingContext2D, text: string, width: number, font: string): string[] {
  g.font = font;
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const test = cur ? `${cur} ${w}` : w;
    if (g.measureText(test).width > width && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export const tribunal: GameBase = {
  id: 'tribunal',
  emoji: '⚖️',
  name: { fr: 'Le Tribunal', en: 'The Tribunal' },
  how: {
    fr: 'Qui de vous serait le premier à… ? Votez, condamnez vos amis, marquez avec la majorité !',
    en: 'Which of you would be first to…? Vote, convict your friends, score with the majority!',
  },
  layout: 'buttons',
  min: 3,
  max: 12,
  botFill: 3,
  music: 'party',
  create,
};
