// Le Dico Bidon : un vrai mot rare. Chacun invente une fausse définition sur son téléphone, puis tout le monde cherche la vraie.
// Trouver la vraie rapporte 3 points ; chaque joueur piégé par ta définition t'en rapporte 2.
import { drawCharacter } from '../shared/characters';
import { CIEL, INK, MENTHE, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { candy } from './draw';
import type { QuizPadData } from './quizShared';
import { wrap } from './tribunal';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

const WRITE_TIME = 50;
const VOTE_TIME = 25;
const SHOW_TIME = 9;
const COLORS = [ROSE, CIEL, SOLEIL, MENTHE, '#9b5cff', '#ff9a1f', '#2ec5ff', '#ff5a1f'];

/** Vrais mots, avec leur vrai sens. */
const WORDS: Record<'fr' | 'en', [string, string][]> = {
  fr: [
    ['Callipyge', 'Qui a de belles fesses'],
    ['Pétrichor', 'L’odeur de la terre après la pluie'],
    ['Borborygme', 'Le bruit du ventre qui gargouille'],
    ['Coulrophobie', 'La peur des clowns'],
    ['Philématologie', 'La science du baiser'],
    ['Myrmécologie', 'L’étude des fourmis'],
    ['Pandiculation', 'S’étirer en bâillant'],
    ['Tachyphagie', 'Le fait de manger trop vite'],
    ['Trichotillomanie', 'L’envie de s’arracher les cheveux'],
    ['Ailurophile', 'Personne qui adore les chats'],
    ['Pogonophobie', 'La peur des barbes'],
    ['Glabelle', 'L’espace entre les deux sourcils'],
    ['Philtrum', 'Le petit creux entre le nez et la lèvre'],
    ['Lunule', 'La tache blanche à la base de l’ongle'],
    ['Ferret', 'L’embout au bout d’un lacet'],
    ['Zinzinuler', 'Chanter, pour une mésange'],
    ['Flagorneur', 'Personne qui flatte de façon exagérée'],
    ['Logorrhée', 'Un flot de paroles sans fin'],
    ['Sesquipédalien', 'Se dit d’un mot très long'],
    ['Hapax', 'Un mot qu’on ne trouve qu’une seule fois dans un texte'],
    ['Nyctalope', 'Qui voit bien dans le noir'],
    ['Atermoyer', 'Repousser sans cesse une décision'],
    ['Xénoglossie', 'Parler une langue qu’on n’a jamais apprise'],
    ['Limogeage', 'Le renvoi brutal d’une personne de son poste'],
    ['Pétaudière', 'Un endroit où règne le désordre'],
    ['Galimatias', 'Un discours confus et incompréhensible'],
    ['Ergophobie', 'La peur du travail'],
    ['Nomophobie', 'La peur d’être sans son téléphone'],
    ['Cruciverbiste', 'Personne qui aime les mots croisés'],
    ['Cacochyme', 'Se dit d’une personne de santé fragile'],
    ['Mirliflore', 'Un jeune homme élégant et prétentieux'],
    ['Vexillologie', 'L’étude des drapeaux'],
    ['Oniromancie', 'Prédire l’avenir par les rêves'],
    ['Tergiverser', 'Hésiter pour éviter de décider'],
    ['Stéatopyge', 'Qui a de très grosses fesses'],
  ],
  en: [
    ['Callipygian', 'Having a beautiful bottom'],
    ['Petrichor', 'The smell of earth after rain'],
    ['Borborygmus', 'The rumbling noise of the stomach'],
    ['Coulrophobia', 'The fear of clowns'],
    ['Philematology', 'The science of kissing'],
    ['Myrmecology', 'The study of ants'],
    ['Pandiculation', 'Stretching while yawning'],
    ['Tachyphagia', 'Eating too fast'],
    ['Trichotillomania', 'The urge to pull out one’s hair'],
    ['Ailurophile', 'A person who loves cats'],
    ['Pogonophobia', 'The fear of beards'],
    ['Glabella', 'The space between the eyebrows'],
    ['Philtrum', 'The groove between the nose and the lip'],
    ['Lunula', 'The white crescent at the base of a nail'],
    ['Aglet', 'The tip at the end of a shoelace'],
    ['Sesquipedalian', 'Describing a very long word'],
    ['Logorrhea', 'An endless flow of words'],
    ['Hapax', 'A word found only once in a text'],
    ['Nyctalopia', 'Poor vision in the dark'],
    ['Sycophant', 'A person who flatters to gain favour'],
    ['Xenoglossy', 'Speaking a language one never learned'],
    ['Gongoozler', 'A person who idly watches canal boats'],
    ['Crapulence', 'Sickness from eating or drinking too much'],
    ['Tmesis', 'Splitting a word by inserting another'],
    ['Ergophobia', 'The fear of work'],
    ['Nomophobia', 'The fear of being without your phone'],
    ['Cruciverbalist', 'A lover of crossword puzzles'],
    ['Vexillology', 'The study of flags'],
    ['Oneiromancy', 'Predicting the future from dreams'],
    ['Snollygoster', 'A shrewd, unprincipled person'],
    ['Lollygag', 'To dawdle or waste time'],
    ['Collywobbles', 'A nervous stomach ache'],
    ['Absquatulate', 'To leave abruptly'],
  ],
};

/** Fausses définitions des bots. */
const BOT_LIES: Record<'fr' | 'en', string[]> = {
  fr: [
    'Un petit gâteau breton aux algues',
    'Une danse traditionnelle de bûcherons',
    'La peur irrationnelle des chaussettes',
    'Un outil pour tailler les moustaches',
    'Un insecte qui vit dans les grille-pain',
    'Une maladie rare des pigeons voyageurs',
    'L’art de plier les serviettes en cygne',
    'Le fait de parler à ses plantes',
    'Une petite barque à fond plat',
    'Le coup de pied donné à un distributeur',
  ],
  en: [
    'A small Breton seaweed cake',
    'A traditional lumberjack dance',
    'The irrational fear of socks',
    'A tool for trimming moustaches',
    'An insect living in toasters',
    'A rare disease of carrier pigeons',
    'The art of folding napkins into swans',
    'The habit of talking to one’s plants',
    'A small flat-bottomed boat',
    'A kick given to a vending machine',
  ],
};

interface Pl extends Runner {
  score: number;
  lie: string;
  pick: number;
  gain: number;
}
interface Opt {
  text: string;
  /** Auteur (-1 = la vraie définition). */
  by: number;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls: Pl[] = runners.slice(0, 8).map((r) => ({ ...r, score: 0, lie: '', pick: -1, gain: 0 }));
  const rounds = ctx.opts.rounds || 5;
  const deck = [...WORDS[ctx.lang]].sort(() => Math.random() - 0.5).slice(0, rounds);
  let round = -1;
  let phase: QuizPadData['phase'] = 'write';
  let timer = 0;
  let botT = 0;
  let opts: Opt[] = [];
  const notes = new Map<string, string>();

  function next() {
    round++;
    if (round >= deck.length) {
      phase = 'end';
      timer = 5;
      const top = [...pls].sort((a, b) => b.score - a.score)[0];
      speak(fr ? `${top.profile.name} est le roi des bobards !` : `${top.profile.name} is the king of fibs!`, ctx.lang);
      sfx.win();
      ctx.refresh();
      return;
    }
    phase = 'write';
    timer = WRITE_TIME;
    botT = 3 + Math.random() * 8;
    notes.clear();
    pls.forEach((p) => {
      p.lie = '';
      p.pick = -1;
      p.gain = 0;
    });
    speak(fr ? `Que veut dire : ${deck[round][0]} ?` : `What does ${deck[round][0]} mean?`, ctx.lang);
    sfx.whoosh();
    ctx.refresh();
  }

  function toVote() {
    const pool = [...BOT_LIES[ctx.lang]].sort(() => Math.random() - 0.5);
    pls.forEach((p) => {
      if (!p.lie && p.bot) p.lie = pool.pop() ?? '…';
    });
    opts = [{ text: deck[round][1], by: -1 }, ...pls.map((p, i) => ({ text: p.lie, by: i })).filter((o) => o.text)].sort(() => Math.random() - 0.5);
    phase = 'choose';
    timer = VOTE_TIME;
    botT = 2 + Math.random() * 5;
    sfx.cards();
    ctx.refresh();
  }

  function reveal() {
    pls.forEach((p) => {
      const o = opts[p.pick];
      if (!o) return;
      if (o.by === -1) p.gain += 3;
      else if (pls[o.by] !== p) pls[o.by].gain += 2;
    });
    pls.forEach((p) => (p.score += p.gain));
    phase = 'reveal';
    timer = SHOW_TIME;
    sfx.boom();
    // Le meilleur menteur du tour se fait féliciter
    const bySpot = pls.map((p, i) => ({ p, n: pls.filter((x) => opts[x.pick]?.by === i && x !== p).length })).sort((a, b) => b.n - a.n)[0];
    if (bySpot?.n) setTimeout(() => speak(fr ? `${bySpot.n > 1 ? `${bySpot.n} personnes ont gobé` : 'Une personne a gobé'} le bobard de ${bySpot.p.profile.name} !` : `${bySpot.n} fell for ${bySpot.p.profile.name}'s fib!`, ctx.lang), 4200);
    speak(fr ? `La vraie définition : ${deck[round][1]}` : `The real meaning: ${deck[round][1]}`, ctx.lang);
    ctx.refresh();
  }

  next();

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const i = pls.findIndex((x) => x.pid === pid);
      const p = pls[i];
      if (!p) return;
      if (m.a === 'text' && phase === 'write' && m.s) {
        const text = m.s.trim().slice(0, 90);
        if (norm(text) === norm(deck[round][1])) {
          notes.set(pid, fr ? 'Trop proche de la vraie ! Invente autre chose.' : 'Too close to the real one! Try something else.');
          ctx.refresh();
          return;
        }
        p.lie = text;
        notes.delete(pid);
        sfx.join();
        ctx.refresh();
      }
      if (m.a === 'pick' && phase === 'choose') {
        const k = m.n?.[0] ?? -1;
        if (opts[k] && opts[k].by !== i) {
          p.pick = k;
          sfx.click();
          ctx.refresh();
        }
      }
    },
    update(dt) {
      timer -= dt;
      if (phase === 'write') {
        if ((botT -= dt) <= 0) botT = 99;
        if (timer <= 0 || pls.every((p) => p.lie || p.bot)) toVote();
      } else if (phase === 'choose') {
        if ((botT -= dt) <= 0) {
          botT = 99;
          pls.forEach((p, i) => {
            if (!p.bot || p.pick >= 0) return;
            const can = opts.map((_, k) => k).filter((k) => opts[k].by !== i);
            p.pick = can[Math.floor(Math.random() * can.length)];
          });
        }
        if (timer <= 0 || pls.every((p) => p.pick >= 0)) reveal();
      } else if (phase === 'reveal') {
        if (timer <= 0) next();
      } else if (timer <= 0) game.over = true;
    },
    render(g, t) {
      g.fillStyle = '#fff3d6';
      g.fillRect(0, 0, 1920, 1080);
      // Lignes de cahier
      g.strokeStyle = 'rgba(46,197,255,0.25)';
      g.lineWidth = 3;
      for (let y = 60; y < 1080; y += 60) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(1920, y);
        g.stroke();
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = INK;
      if (phase === 'end') {
        g.font = '700 72px Fredoka, sans-serif';
        g.fillText(fr ? 'Le classement des menteurs' : 'The liars’ ranking', 960, 140);
      } else {
        g.font = '700 36px Fredoka, sans-serif';
        g.fillText(`📖 ${fr ? 'Mot' : 'Word'} ${round + 1}/${deck.length}`, 960, 60);
        g.font = '700 96px Fredoka, sans-serif';
        g.fillText(deck[round][0], 960, 150);
      }
      if (phase === 'write') {
        g.font = '700 46px Fredoka, sans-serif';
        g.fillText(fr ? 'Invente une fausse définition sur ton téléphone !' : 'Make up a fake meaning on your phone!', 960, 270);
        g.font = '700 54px Fredoka, sans-serif';
        g.fillStyle = timer < 10 ? ROSE : INK;
        g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 960, 350);
      }
      if (phase === 'choose' || phase === 'reveal') {
        const top = 240;
        const h = Math.min(100, 640 / opts.length);
        opts.forEach((o, k) => {
          const y = top + k * (h + 12);
          const real = o.by === -1;
          const show = phase === 'reveal';
          g.fillStyle = show && real ? MENTHE : '#fff';
          g.strokeStyle = INK;
          g.lineWidth = 6;
          g.beginPath();
      g.roundRect(180, y, 1560, h, 24);
      g.fill();
      g.stroke();
      candy(g, 180, y, 1560, h, 24);
          g.fillStyle = COLORS[k % COLORS.length];
          g.beginPath();
          g.arc(240, y + h / 2, 32, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.fillStyle = INK;
          g.font = '700 38px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.fillText(String(k + 1), 240, y + h / 2 + 2);
          g.textAlign = 'left';
          const line = wrap(g, o.text, show ? 1000 : 1400, '600 36px Fredoka, sans-serif')[0];
          g.fillText(line, 295, y + h / 2 + 2);
          if (show) {
            const voters = pls.filter((p) => p.pick === k).length;
            const by = real ? (fr ? '✅ LA VRAIE' : '✅ THE REAL ONE') : pls[o.by].profile.name;
            g.textAlign = 'right';
            g.font = '700 34px Fredoka, sans-serif';
            g.fillText(`${by} · ${voters} 🗳️`, 1710, y + h / 2 + 2);
          }
          g.textAlign = 'center';
        });
      }
      // Les joueurs en bas
      const n = pls.length;
      const low = phase === 'end' ? 620 : 1000;
      const size = phase === 'end' ? 170 : 90;
      pls.forEach((p, i) => {
        const x = 960 + (i - (n - 1) / 2) * Math.min(230, 1760 / n);
        const done = phase === 'write' ? !!p.lie : phase === 'choose' ? p.pick >= 0 : false;
        drawCharacter(g, x, low, size, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          mood: phase === 'end' ? 'win' : done ? 'happy' : 'wow',
        });
        g.font = '700 30px Fredoka, sans-serif';
        g.fillStyle = INK;
        g.textAlign = 'center';
        const label = phase === 'reveal' && p.gain ? `+${p.gain} · ${p.profile.name}` : phase === 'end' ? `${p.profile.name} : ${p.score}` : done ? `✅ ${p.profile.name}` : p.profile.name;
        g.fillText(label, x, low + 44);
      });
    },
    ranking() {
      return [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid);
    },
    leader() {
      return null;
    },
    padData(pid): QuizPadData {
      const i = pls.findIndex((x) => x.pid === pid);
      const p = pls[i];
      const word = phase === 'end' ? '' : deck[round]?.[0] ?? '';
      return {
        phase,
        prompt: phase === 'write' && p.lie ? `${word} : « ${p.lie} »` : word,
        step: `${fr ? 'Mot' : 'Word'} ${Math.min(round + 1, deck.length)}/${deck.length}`,
        act: phase === 'write' && !p.lie ? 'write' : phase === 'choose' ? 'choose' : null,
        options: phase === 'choose' ? opts.map((o, k) => ({ o, k })).filter((x) => x.o.by !== i).map((x) => ({ i: x.k, label: `${x.k + 1}. ${x.o.text}`, color: COLORS[x.k % COLORS.length] })) : [],
        picked: p.pick,
        score: p.score,
        left: phase === 'write' || phase === 'choose' ? Math.ceil(Math.max(0, timer)) : 0,
        note: notes.get(pid) ?? '',
      };
    },
  };
  return game;
}

export const dico: GameBase = {
  id: 'dico',
  emoji: '📖',
  name: { fr: 'Le Petit Bobard Illustré', en: 'The Oxford Fibber' },
  how: {
    fr: 'Un mot rare : invente une fausse définition, piège les autres et trouve la vraie !',
    en: 'A rare word: make up a fake meaning, fool the others and find the real one!',
  },
  layout: 'buttons',
  min: 3,
  max: 8,
  botFill: 3,
  music: 'party',
  options: [
    {
      id: 'rounds',
      label: { fr: 'Nombre de mots', en: 'Number of words' },
      choices: [
        { v: 5, label: { fr: '5 mots', en: '5 words' } },
        { v: 3, label: { fr: '3 mots', en: '3 words' } },
        { v: 8, label: { fr: '8 mots', en: '8 words' } },
      ],
    },
  ],
  create,
};
