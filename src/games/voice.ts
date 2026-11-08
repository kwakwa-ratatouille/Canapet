// Jeux au micro : chaque téléphone enregistre, la télé fait écouter à tout le salon.
// Rien n'est gardé : les sons restent en mémoire pendant la partie, puis disparaissent.
import { drawCharacter } from '../shared/characters';
import { CIEL, INK, MENTHE, ROSE, SOLEIL } from '../shared/palette';
import { decodeClip, fakeVoice, karaokeTune, playClip, playMusic, referenceSound, REF_SOUNDS, sfx, speak, type ClipPlayer, type MusicId } from '../shared/sound';
import { candy, fitText, stageBackdrop } from './draw';
import { wrap } from './tribunal';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';
import { freshDeck } from './decks';
import { MORE_GUESS, MORE_IMITATE, MORE_LYRICS, MORE_PHRASES, MORE_SCENES, MORE_WHO, type SceneAnim } from './moreContent';
import type { VoicePadData } from './voiceShared';

type Mode = 'imite' | 'devine' | 'perroquet' | 'envers' | 'voix' | 'casse' | 'doublage' | 'karaoke';
type Phase = VoicePadData['phase'];

/** [français, anglais] ; `!` au début = caché en mode famille. */
const IMITATE: [string, string][] = [
  ['Une poule qui a perdu ses clés', 'A chicken that lost its keys'],
  ['Une vache qui fait un burn-out', 'A cow having a burnout'],
  ['Ton réveil un lundi matin', 'Your alarm on a Monday morning'],
  ['Un dauphin qui commande une pizza', 'A dolphin ordering a pizza'],
  ['Un chat qui juge tes choix de vie', 'A cat judging your life choices'],
  ['Une machine à café qui rend l’âme', 'A coffee machine breathing its last'],
  ['Un mouton qui chante à l’opéra', 'A sheep singing opera'],
  ['Un robot amoureux', 'A robot in love'],
  ['Un fantôme enrhumé', 'A ghost with a cold'],
  ['Un pigeon qui drague', 'A pigeon flirting'],
  ['Une sirène de pompiers très fatiguée', 'A very tired fire siren'],
  ['Un bébé dinosaure qui a faim', 'A hungry baby dinosaur'],
  ['Une porte qui grince et qui râle', 'A creaky door complaining'],
  ['Un présentateur de météo paniqué', 'A panicked weather presenter'],
  ['Ta mère qui t’appelle pour manger', 'Your mum calling you for dinner'],
  ['Un cowboy qui a le hoquet', 'A cowboy with hiccups'],
  ['Un extraterrestre qui demande son chemin', 'An alien asking for directions'],
  ['Une mouette qui vole une frite', 'A seagull stealing a chip'],
  ['Un coq qui ne s’est pas réveillé à l’heure', 'A rooster who overslept'],
  ['Un chanteur d’opéra qui se brûle la langue', 'An opera singer burning their tongue'],
  ['Un lion qui a peur d’une souris', 'A lion scared of a mouse'],
  ['Un moteur de vieille voiture qui ne démarre pas', 'An old car that won’t start'],
  ['Un commentateur de foot devant une partie de pétanque', 'A football commentator at a game of bowls'],
  ['Une grand-mère qui découvre internet', 'A grandma discovering the internet'],
  ['Un loup qui hurle mais qui a mal à la gorge', 'A wolf howling with a sore throat'],
  ['!Quelqu’un qui essaie de péter en silence', 'Someone trying to fart silently'],
  ['!Un lendemain de soirée très difficile', 'A very hard morning after'],
  ['!Ton voisin à travers le mur à 3 h du matin', 'Your neighbour through the wall at 3 a.m.'],
];

/** Mots et bruits à faire deviner, sans parler. */
const GUESS: [string, string][] = [
  ['Une vache', 'A cow'], ['Un chat', 'A cat'], ['Un chien', 'A dog'], ['Un coq', 'A rooster'], ['Un cochon', 'A pig'], ['Un mouton', 'A sheep'], ['Un âne', 'A donkey'], ['Un serpent', 'A snake'],
  ['Un train', 'A train'], ['Une moto', 'A motorbike'], ['Un avion', 'A plane'], ['Une ambulance', 'An ambulance'], ['Un klaxon', 'A car horn'], ['Une tondeuse', 'A lawn mower'], ['Un aspirateur', 'A vacuum cleaner'],
  ['Une cocotte-minute', 'A pressure cooker'], ['Un micro-ondes', 'A microwave'], ['Une sonnette', 'A doorbell'], ['Un téléphone qui vibre', 'A vibrating phone'], ['Une chasse d’eau', 'A toilet flush'], ['Un robinet qui goutte', 'A dripping tap'],
  ['Un éternuement', 'A sneeze'], ['Quelqu’un qui ronfle', 'Someone snoring'], ['Un bébé qui pleure', 'A crying baby'], ['Le vent', 'The wind'], ['La pluie', 'The rain'], ['Un feu d’artifice', 'Fireworks'], ['Un pop-corn qui éclate', 'Popping popcorn'], ['Un marteau-piqueur', 'A jackhammer'], ['Une horloge', 'A clock'],
];

/** Phrases à dire à l'envers ou à déformer. */
const PHRASES: [string, string][] = [
  ['Mon chat adore les raviolis', 'My cat loves ravioli'],
  ['Je n’ai pas volé le fromage', 'I did not steal the cheese'],
  ['Le canapé est mon meilleur ami', 'The couch is my best friend'],
  ['Il y a un pigeon dans ma cuisine', 'There is a pigeon in my kitchen'],
  ['Ma grand-mère conduit trop vite', 'My grandma drives too fast'],
  ['Qui a mangé le dernier cookie ?', 'Who ate the last cookie?'],
  ['Les patates ne savent pas nager', 'Potatoes can’t swim'],
  ['Je suis le roi de la télécommande', 'I am the king of the remote'],
  ['Mes chaussettes sont pleines de frites', 'My socks are full of chips'],
  ['Attention, le poulet est armé', 'Careful, the chicken is armed'],
  ['Le lundi, je parle aux plantes', 'On Mondays, I talk to plants'],
  ['Ton cousin a un drôle de nez', 'Your cousin has a funny nose'],
  ['J’ai caché la baguette sous le lit', 'I hid the baguette under the bed'],
  ['La pizza a appelé, elle veut te revoir', 'The pizza called, it wants to see you again'],
  ['Un escargot m’a doublé sur l’autoroute', 'A snail overtook me on the motorway'],
  ['Il faut sauver le soldat Cornichon', 'We must save Private Pickle'],
];

const WHO_LINES: [string, string][] = [
  ['Bonjour, je suis le plus beau du salon', 'Hello, I am the best-looking in the room'],
  ['Passe-moi le sel, s’il te plaît', 'Pass me the salt, please'],
  ['Je n’ai jamais triché de ma vie', 'I have never cheated in my life'],
  ['C’est pas moi, c’est le chien', 'It wasn’t me, it was the dog'],
  ['Alors, on perd encore ?', 'So, losing again?'],
  ['Qui veut un petit gâteau ?', 'Who wants a little cake?'],
  ['Je vais tous vous écraser', 'I will crush you all'],
  ['J’adore les lundis', 'I love Mondays'],
];

/** Scènes à doubler : deux marionnettes jouent, ta voix leur donne vie. */
type Anim = SceneAnim;
const SCENES: { fr: string; en: string; a: string; b: string; anim: Anim }[] = [
  { fr: 'Le cornichon quitte la tartine… pour une baguette', en: 'The pickle leaves the toast… for a baguette', a: 'cornichon', b: 'tartine', anim: 'rupture' },
  { fr: 'La tomate accuse le fromage d’avoir volé son chapeau', en: 'The tomato accuses the cheese of stealing her hat', a: 'tomate', b: 'fromage', anim: 'duel' },
  { fr: 'La banane poursuit le cookie qui lui doit de l’argent', en: 'The banana chases the cookie who owes her money', a: 'banane', b: 'cookie', anim: 'poursuite' },
  { fr: 'Le coussin retrouve son fils perdu, la chaussette', en: 'The cushion finds their long-lost son, the sock', a: 'coussin', b: 'chaussette', anim: 'calin' },
  { fr: 'La pizza annonce au nuage qu’il va être papa', en: 'The pizza tells the cloud he’s going to be a dad', a: 'pizza', b: 'nuage', anim: 'annonce' },
  { fr: 'L’œuf a très peur du cupcake, et il a raison', en: 'The egg is terrified of the cupcake, and rightly so', a: 'oeuf', b: 'cupcake', anim: 'peur' },
  { fr: 'Le sushi et les frites se disputent la télécommande', en: 'The sushi and the fries fight over the remote', a: 'sushi', b: 'frites', anim: 'duel' },
  { fr: 'L’avocat plaide devant le juge macaron', en: 'The avocado pleads before Judge Macaron', a: 'avocat', b: 'macaron', anim: 'annonce' },
  { fr: 'Le brocoli demande la gaufre en mariage', en: 'The broccoli proposes to the waffle', a: 'brocoli', b: 'gaufre', anim: 'calin' },
  { fr: 'Le pop-corn fuit le ketchup, qui veut « juste parler »', en: 'The popcorn flees the ketchup, who “just wants to talk”', a: 'popcorn', b: 'ketchup', anim: 'poursuite' },
  { fr: 'La patate annonce à l’oignon qu’elle sait tout', en: 'The potato tells the onion she knows everything', a: 'patate', b: 'oignon', anim: 'rupture' },
  { fr: 'Le beignet découvre le monstre dans le frigo : la saucisse', en: 'The donut finds the monster in the fridge: the sausage', a: 'beignet', b: 'saucisse', anim: 'peur' },
];

/** Paroles à chanter sur la mélodie. */
/** Vraies musiques du karaoké, toutes CC0 (liste et auteurs : public/licences/musiques-karaoke-cc0.txt). */
const KARAOKE_TRACKS = ['funky', 'clappy', 'swing', 'saying', 'wisdom', 'celebrity', 'groove', 'floor', 'upbeat', 'happier'];

const LYRICS: [string, string][] = [
  ['Mon cornichon m’a quitté en mai', 'My pickle left me back in May'],
  ['Oh ma tartine, tu tombes toujours du mauvais côté', 'Oh my toast, you always land the wrong way'],
  ['J’ai perdu mes chaussettes dans la machine', 'I lost my socks inside the machine'],
  ['Le Wi-Fi est parti sans dire au revoir', 'The Wi-Fi left without goodbye'],
  ['Je t’aime plus que le fromage, mais moins que le dessert', 'I love you more than cheese, but less than dessert'],
  ['Ma belle-mère a pris la télécommande', 'My mother-in-law took the remote'],
  ['Le lundi matin, je pleure dans mon café', 'On Monday morning, I cry in my coffee'],
  ['Mon chat me regarde et il me juge encore', 'My cat is looking and judging me again'],
  ['Y’a plus de batterie, y’a plus d’amour', 'No more battery, no more love'],
  ['Une pizza pour deux, mais je la mange tout seul', 'A pizza for two, but I eat it alone'],
  ['Baby, tu as encore oublié les poubelles', 'Baby, you forgot the bins again'],
  ['Mon cœur fait pouet quand tu t’assois dessus', 'My heart goes toot when you sit on it'],
];

const TUNE: Record<Mode, { rounds: number; rec: number; max: number }> = {
  doublage: { rounds: 4, rec: 35, max: 7 },
  karaoke: { rounds: 4, rec: 35, max: 7 },
  imite: { rounds: 4, rec: 30, max: 6 },
  perroquet: { rounds: 4, rec: 25, max: 5 },
  devine: { rounds: 6, rec: 25, max: 6 },
  envers: { rounds: 6, rec: 20, max: 5 },
  voix: { rounds: 4, rec: 20, max: 5 },
  casse: { rounds: 2, rec: 25, max: 7 },
};

interface Pl {
  pid: string;
  profile: Runner['profile'];
  bot: boolean;
  selfie: Runner['selfie'];
  score: number;
  gain: number;
  pick: number;
  sent: boolean;
  text: string;
}
interface Clip {
  pid: string;
  buf: AudioBuffer;
  url: string;
}

const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const COLORS = ['#ff4f9a', '#2ec5ff', '#ffd60a', '#22c99a', '#9b5cff', '#ff9a1f', '#7bd13b', '#e08bff', '#3a6bff', '#ff3b3b', '#1fc9a0', '#a0643a'];

function createVoice(mode: Mode, runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const L = (x: [string, string]) => x[fr ? 0 : 1].replace(/^!/, '');
  const clean = (l: [string, string][]) => l.filter((x) => !(ctx.family && x[0].startsWith('!')));
  const pls: Pl[] = runners.map((r) => ({ pid: r.pid, profile: r.profile, bot: r.bot, selfie: r.selfie, score: 0, gain: 0, pick: -1, sent: false, text: '' }));
  const humans = pls.filter((p) => !p.bot);
  const tune = TUNE[mode];
  const voteMode = mode === 'imite' || mode === 'perroquet' || mode === 'doublage' || mode === 'karaoke';
  const ALL_SCENES = [...SCENES, ...MORE_SCENES];
  const scenes = mode === 'doublage' ? freshDeck('doublage', ALL_SCENES, tune.rounds, (s) => s.fr) : ALL_SCENES.slice(0, 1);
  let scene = scenes[0];
  let backing: ClipPlayer | null = null;
  const rounds = mode === 'devine' || mode === 'envers' ? Math.min(tune.rounds, Math.max(3, humans.length * 2)) : tune.rounds;
  // La réserve complète : assez pour ne pas retomber sur les mêmes défis d'une soirée à l'autre
  const pool = clean(mode === 'imite' ? [...IMITATE, ...MORE_IMITATE] : mode === 'devine' ? [...GUESS, ...MORE_GUESS] : mode === 'voix' ? [...WHO_LINES, ...MORE_WHO] : mode === 'karaoke' ? [...LYRICS, ...MORE_LYRICS] : mode === 'doublage' ? ALL_SCENES.map((s) => [s.fr, s.en] as [string, string]) : [...PHRASES, ...MORE_PHRASES]);
  const deck = freshDeck(`voix-${mode === 'casse' ? 'envers' : mode}`, pool, rounds, (x) => x[0]);
  const refs = shuffle(REF_SOUNDS);
  const rate = () => (Math.random() < 0.5 ? 1.55 : 0.68);

  let round = -1;
  let phase: Phase = 'record';
  let timer = 0;
  let clipNo = 0;
  let prompt = '';
  let actor: Pl | null = null;
  let options: { i: number; label: string; color: string }[] = [];
  let answer = -1;
  let clips: Clip[] = [];
  let queue: { clip: Clip | null; ref?: AudioBuffer; reverse?: boolean; rate?: number; label?: string; who?: Pl | null }[] = [];
  let playing: ClipPlayer | null = null;
  let speaking: Pl | null = null;
  let listenLabel = '';
  let refBuf: AudioBuffer | null = null;
  const tracks = mode === 'karaoke' ? freshDeck('karaoke-musique', KARAOKE_TRACKS, tune.rounds, (x) => x) : [];
  /** Charge la musique de la manche ; sans réseau, on garde la petite mélodie maison. */
  const loadTrack = (forRound: number) => {
    fetch(`${import.meta.env.BASE_URL}karaoke/${tracks[forRound % tracks.length]}.mp3`)
      .then((r) => {
        if (!r.ok) throw new Error('musique');
        return r.arrayBuffer();
      })
      .then((b) => decodeClip(b))
      .catch(() => karaokeTune())
      .then((b) => {
        if (round === forRound) refBuf = b;
      });
  };
  let refAgain = 0;
  let botsDue: { p: Pl; at: number }[] = [];
  let clock = 0;
  let botVoteAt = 0;
  let chain: Pl[] = [];
  let chainAt = 0;
  let original = '';
  let finalText = '';
  let note = '';
  const uploads = new Map<string, string[]>();

  const stopPlay = () => {
    playing?.stop();
    playing = null;
    backing?.stop();
    backing = null;
    speaking = null;
  };

  /** Lance la manche suivante. */
  function next() {
    stopPlay();
    round++;
    if (round >= rounds || !deck.length) {
      phase = 'end';
      timer = 6;
      sfx.win();
      const top = [...pls].sort((a, b) => b.score - a.score)[0];
      speak(fr ? `Et la plus belle voix du canapé : ${top.profile.name} !` : `And the finest voice on the couch: ${top.profile.name}!`, ctx.lang);
      ctx.refresh();
      return;
    }
    clips = [];
    queue = [];
    note = '';
    pls.forEach((p) => {
      p.gain = 0;
      p.pick = -1;
      p.sent = false;
      p.text = '';
    });
    clipNo++;
    phase = 'record';
    timer = tune.rec;
    actor = null;
    refBuf = null;
    botsDue = [];
    options = [];
    if (mode === 'doublage') {
      scene = scenes[round % scenes.length];
      prompt = scene[fr ? 'fr' : 'en'];
      speak(fr ? `Doublez cette scène : ${prompt}` : `Dub this scene: ${prompt}`, ctx.lang);
      pls.filter((p) => p.bot).forEach((p) => botsDue.push({ p, at: clock + 5 + Math.random() * 9 }));
    } else if (mode === 'karaoke') {
      loadTrack(round);
      prompt = L(deck[round % deck.length]);
      speak(fr ? 'Écoutez la mélodie et chantez ces paroles !' : 'Listen to the tune and sing these words!', ctx.lang);
      refAgain = clock + 3;
      pls.filter((p) => p.bot).forEach((p) => botsDue.push({ p, at: clock + 8 + Math.random() * 10 }));
    } else if (mode === 'imite' || mode === 'voix') {
      prompt = L(deck[round % deck.length]);
      speak(mode === 'imite' ? (fr ? `À vous : ${prompt}` : `Your turn: ${prompt}`) : fr ? `Tout le monde dit : ${prompt}` : `Everyone says: ${prompt}`, ctx.lang);
      pls.filter((p) => p.bot).forEach((p) => botsDue.push({ p, at: clock + 4 + Math.random() * 8 }));
    } else if (mode === 'perroquet') {
      const ref = refs[round % refs.length];
      refBuf = referenceSound(ref.id);
      prompt = fr ? ref.fr : ref.en;
      speak(fr ? 'Écoutez bien, et imitez ce bruit !' : 'Listen closely, and imitate this sound!', ctx.lang);
      refAgain = clock + 2.2;
      timer = tune.rec + 8;
      pls.filter((p) => p.bot).forEach((p) => botsDue.push({ p, at: clock + 9 + Math.random() * 8 }));
    } else if (mode === 'devine' || mode === 'envers') {
      const list = humans.length ? humans : pls;
      actor = list[round % list.length];
      const secret = deck[round % deck.length];
      prompt = L(secret);
      const decoys = shuffle(pool.filter((d) => d !== secret)).slice(0, 3);
      const all = shuffle([secret, ...decoys]);
      options = all.map((d, i) => ({ i, label: L(d), color: COLORS[i] }));
      answer = all.indexOf(secret);
      speak(fr ? `${actor.profile.name}, à toi. Regarde ton téléphone !` : `${actor.profile.name}, your turn. Check your phone!`, ctx.lang);
      if (actor.bot) botsDue.push({ p: actor, at: clock + 3 });
    } else if (mode === 'casse') {
      chain = shuffle(humans);
      chainAt = 0;
      original = L(deck[round % deck.length]);
      finalText = '';
      prompt = original;
      actor = chain[0] ?? null;
      speak(fr ? `Ne répétez rien à voix haute. ${actor?.profile.name ?? ''}, à toi !` : `Don’t repeat anything out loud. ${actor?.profile.name ?? ''}, your turn!`, ctx.lang);
    }
    sfx.whoosh();
    ctx.refresh();
  }

  /** Reçoit un son complet d'un téléphone. */
  async function receive(p: Pl, url: string, no: number) {
    if (no !== clipNo || phase !== 'record') return;
    const bin = Uint8Array.from(atob(url.split(',')[1] ?? ''), (c) => c.charCodeAt(0));
    let buf: AudioBuffer;
    try {
      buf = await decodeClip(bin.buffer as ArrayBuffer);
    } catch {
      return;
    }
    if (no !== clipNo || phase !== 'record') return;
    clips = clips.filter((c) => c.pid !== p.pid);
    clips.push({ pid: p.pid, buf, url });
    p.sent = true;
    sfx.join();
    if (mode === 'casse') chainStep();
    else if (allIn()) toListen();
    ctx.refresh();
  }
  const recorders = () => (mode === 'devine' || mode === 'envers' ? (actor ? [actor] : []) : pls);
  const allIn = () => recorders().every((p) => p.sent || (!p.bot && ctx.away(p.pid)));

  /** Le Téléphone Cassé : au suivant. */
  function chainStep() {
    chainAt++;
    // Il faut au moins deux téléphones pour faire passer la phrase ; on saute ceux qui sont partis
    if (chain.length < 2) return next();
    while (chainAt < chain.length - 1 && ctx.away(chain[chainAt].pid)) chainAt++;
    if (chainAt >= chain.length - 1) {
      // Le dernier écoute et écrit ce qu'il a compris
      chainAt = chain.length - 1;
      actor = chain[chainAt];
      phase = 'write';
      timer = 30;
    } else {
      actor = chain[chainAt] ?? null;
      timer = tune.rec;
    }
    sfx.pop();
    ctx.refresh();
  }

  /** Passe à l'écoute collective. */
  function toListen() {
    stopPlay();
    phase = 'listen';
    timer = 999;
    const order = shuffle(clips);
    if (mode === 'imite' || mode === 'doublage' || mode === 'karaoke') queue = order.map((c) => ({ clip: c }));
    else if (mode === 'perroquet') queue = [{ clip: null, ref: refBuf ?? undefined, label: fr ? 'Le vrai bruit' : 'The real sound' }, ...order.map((c) => ({ clip: c }))];
    else if (mode === 'devine') {
      const c = clips[0];
      queue = c ? [{ clip: c }, { clip: c }] : [];
    } else if (mode === 'envers') {
      const c = clips[0];
      queue = c ? [{ clip: c, reverse: true, label: fr ? 'À l’envers…' : 'Backwards…' }, { clip: c, reverse: true, label: fr ? 'Encore une fois…' : 'Once more…' }] : [];
    } else if (mode === 'voix') {
      const speakers = clips.filter((c) => !pls.find((p) => p.pid === c.pid)?.bot);
      const c = shuffle(speakers.length ? speakers : clips)[0];
      answer = pls.findIndex((p) => p.pid === c?.pid);
      const r = rate();
      queue = c ? [{ clip: c, rate: r, who: null, label: fr ? 'Qui parle ?' : 'Who is it?' }, { clip: c, rate: r, who: null, label: fr ? 'Encore une fois…' : 'Once more…' }] : [];
      options = pls.map((p, i) => ({ i, label: p.profile.name, color: p.profile.color }));
    } else {
      queue = chain.map((p) => clips.find((c) => c.pid === p.pid)).filter(Boolean).map((c) => ({ clip: c as Clip }));
    }
    if (!queue.length) {
      note = fr ? 'Personne n’a enregistré. On passe !' : 'Nobody recorded. Moving on!';
      reveal();
      return;
    }
    playNext();
    ctx.refresh();
  }

  function playNext() {
    stopPlay();
    const item = queue.shift();
    if (!item) {
      afterListen();
      return;
    }
    const buf = item.ref ?? item.clip?.buf;
    if (!buf) return playNext();
    const owner = item.clip ? pls.find((p) => p.pid === item.clip!.pid) ?? null : null;
    speaking = item.who === null ? null : owner;
    listenLabel = item.label ?? (speaking ? speaking.profile.name : '');
    playing = playClip(buf, { rate: item.rate, reverse: item.reverse });
    // Karaoké : la musique joue en dessous de la voix
    if (mode === 'karaoke' && refBuf) backing = playClip(refBuf, { gain: 0.3, loop: true });
    timer = playing.dur + 0.8;
  }

  /** Après l'écoute : voter, deviner ou révéler. */
  function afterListen() {
    if (mode === 'casse') {
      reveal();
      return;
    }
    phase = 'choose';
    timer = 15;
    botVoteAt = clock + 2 + Math.random() * 5;
    if (voteMode) {
      options = clips.map((c, i) => {
        const p = pls.find((x) => x.pid === c.pid)!;
        return { i, label: p.profile.name, color: p.profile.color };
      });
    }
    speak(mode === 'imite' || mode === 'doublage' || mode === 'karaoke' ? (fr ? 'Votez pour le meilleur !' : 'Vote for the best!') : mode === 'perroquet' ? (fr ? 'Qui était le plus ressemblant ?' : 'Who sounded closest?') : fr ? 'À vous de deviner !' : 'Take your guess!', ctx.lang);
    sfx.pop();
    ctx.refresh();
  }

  /** Les points de la manche. */
  function reveal() {
    stopPlay();
    phase = 'reveal';
    timer = 6;
    if (voteMode) {
      const votes = options.map((o) => pls.filter((p) => p.pick === o.i).length);
      clips.forEach((c, i) => {
        const p = pls.find((x) => x.pid === c.pid)!;
        p.gain += votes[i] * 2;
      });
      const best = Math.max(0, ...votes);
      const winners = clips.filter((_, i) => votes[i] === best && best > 0).map((c) => pls.find((x) => x.pid === c.pid)!);
      if (winners[0]) {
        note = fr ? `Le public a choisi : ${winners.map((w) => w.profile.name).join(' et ')} !` : `The crowd chose: ${winners.map((w) => w.profile.name).join(' and ')}!`;
        const c = clips.find((x) => x.pid === winners[0].pid);
        if (c) playing = playClip(c.buf, {});
        if (mode === 'karaoke' && refBuf) backing = playClip(refBuf, { gain: 0.3, loop: true });
        speaking = winners[0];
      }
    } else if (mode === 'devine' || mode === 'envers') {
      const good = pls.filter((p) => p !== actor && p.pick === answer);
      good.forEach((p) => (p.gain += 3));
      if (actor) actor.gain += good.length * 2;
      note = `${fr ? 'C’était' : 'It was'} : ${options[answer]?.label ?? ''}`;
      speak(note, ctx.lang);
      const c = clips[0];
      if (mode === 'envers' && c) {
        // La phrase à l'endroit : c'est la chute du gag
        timer = Math.max(6, c.buf.duration + 3);
        setTimeout(() => {
          if (phase === 'reveal') playing = playClip(c.buf, {});
        }, 1800);
      }
    } else if (mode === 'voix') {
      const good = pls.filter((p, i) => p.pick === answer && i !== answer);
      good.forEach((p) => (p.gain += 3));
      const who = pls[answer];
      if (who) who.gain += pls.filter((p) => p !== who && p.pick >= 0 && p.pick !== answer).length * 2;
      note = who ? (fr ? `C’était ${who.profile.name} !` : `It was ${who.profile.name}!`) : '';
      if (who) {
        speaking = who;
        const c = clips.find((x) => x.pid === who.pid);
        if (c) playing = playClip(c.buf, {});
      }
    } else {
      // Le Téléphone Cassé : plus la phrase survit, plus tout le monde marque
      const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
      const a = words(original);
      const b = new Set(words(finalText));
      const kept = a.filter((w) => b.has(w)).length;
      chain.forEach((p) => (p.gain += kept));
      timer = 9;
      note = finalText ? (fr ? `Au départ : « ${original} ». À l’arrivée : « ${finalText} »` : `Start: “${original}”. End: “${finalText}”`) : fr ? `Au départ : « ${original} »` : `Start: “${original}”`;
      speak(note, ctx.lang);
    }
    pls.forEach((p) => (p.score += p.gain));
    sfx.boom();
    ctx.refresh();
  }

  playMusic('');

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const p = pls.find((x) => x.pid === pid);
      if (!p) return;
      if (m.a === 'up' && m.n && m.s !== undefined) {
        const [no, part, total] = m.n;
        if (no !== clipNo || total > 12 || part >= total) return;
        const key = `${pid}:${no}`;
        const arr = uploads.get(key) ?? [];
        arr[part] = m.s;
        uploads.set(key, arr);
        if (arr.filter((x) => x !== undefined).length === total) {
          uploads.delete(key);
          if (mode === 'casse' ? p === actor : recorders().includes(p)) void receive(p, arr.join(''), no);
        }
        return;
      }
      if (m.a === 'pick' && phase === 'choose') {
        const k = m.n?.[0] ?? -1;
        if (!options[k]) return;
        const c = voteMode ? clips[k] : null;
        if (c && c.pid === pid) return; // Pas de vote pour soi
        if ((mode === 'devine' || mode === 'envers') && p === actor) return;
        p.pick = k;
        sfx.click();
        ctx.refresh();
        return;
      }
      if (m.a === 'text' && phase === 'write' && p === actor && m.s) {
        finalText = m.s.trim().slice(0, 90);
        toListen();
      }
    },
    update(dt) {
      // La première manche démarre après le tuto, sinon on parlerait par-dessus
      if (round < 0) return next();
      clock += dt;
      timer -= dt;
      if (phase === 'record') {
        if (refBuf && refAgain && clock >= refAgain) {
          stopPlay();
          playing = playClip(refBuf, mode === 'karaoke' ? { gain: 0.7 } : {});
          // La musique du karaoké tourne en boucle pendant qu'on répète
          refAgain = mode === 'karaoke' ? clock + playing.dur + 2 : clock < 8 ? clock + playing.dur + 1 : 0;
        }
        for (const d of botsDue) {
          if (clock >= d.at && !d.p.sent) {
            if (mode !== 'karaoke') clips.push({ pid: d.p.pid, buf: fakeVoice(2 + Math.random() * 2.5), url: '' });
            d.p.sent = true;
            ctx.refresh();
            // Une voix fabriquée par image, pour ne pas faire saccader la télé
            break;
          }
        }
        if (mode === 'casse' && actor && !actor.bot && ctx.away(actor.pid)) chainStep();
        if (allIn() && mode !== 'casse') toListen();
        else if (timer <= 0) {
          if (mode === 'casse') {
            // Le joueur n'a rien envoyé : on passe au suivant
            if (chain.length) chainStep();
            else next();
          } else toListen();
        }
      } else if (phase === 'write') {
        if (timer <= 0) toListen();
      } else if (phase === 'listen') {
        if (timer <= 0) playNext();
      } else if (phase === 'choose') {
        if (clock >= botVoteAt) {
          botVoteAt = Infinity;
          pls.forEach((p, i) => {
            if (!p.bot || p.pick >= 0 || p === actor) return;
            const can = options.map((o) => o.i).filter((k) => !(voteMode && clips[k]?.pid === p.pid) && !(mode === 'voix' && k === i));
            p.pick = can[Math.floor(Math.random() * can.length)] ?? -1;
          });
        }
        const voters = pls.filter((p) => !((mode === 'devine' || mode === 'envers') && p === actor));
        if (timer <= 0 || voters.every((p) => p.pick >= 0 || (!p.bot && ctx.away(p.pid)))) reveal();
      } else if (phase === 'reveal') {
        if (timer <= 0) next();
      } else if (timer <= 0) {
        stopPlay();
        game.over = true;
      }
    },
    render(g, t) {
      // Scène de cabaret (dessinée une fois)
      stageBackdrop(g, t, ctx.light);
      // Panneau du haut
      const title = phase === 'end' ? (fr ? 'Les plus belles voix' : 'The finest voices') : phase === 'record' || phase === 'write' ? recordTitle() : phase === 'listen' ? (fr ? '🔊 Écoutez !' : '🔊 Listen!') : phase === 'choose' ? (fr ? '🗳️ Sur vos téléphones !' : '🗳️ On your phones!') : note;
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(220, 40, 1480, 210, 36);
      g.fill();
      g.stroke();
      candy(g, 220, 40, 1480, 210, 36);
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '700 30px Fredoka, sans-serif';
      if (phase !== 'end' && round >= 0) g.fillText(`🎙️ ${fr ? 'Manche' : 'Round'} ${round + 1}/${rounds}`, 960, 76);
      // Texte long (la phrase de départ et celle d'arrivée du Téléphone Cassé) : plus petit, sur 3 lignes, sans rien perdre
      let ls = wrap(g, title, 1380, '700 50px Fredoka, sans-serif');
      const gapY = ls.length > 2 ? 46 : 58;
      if (ls.length > 2) ls = wrap(g, title, 1400, '700 38px Fredoka, sans-serif').slice(0, 3);
      ls.forEach((l, i) => g.fillText(l, 960, 160 + (i - (ls.length - 1) / 2) * gapY, 1420));
      // Chrono
      if ((phase === 'record' || phase === 'choose' || phase === 'write') && timer < 900) {
        g.font = phase === 'choose' && (mode === 'devine' || mode === 'envers') ? '700 40px Fredoka, sans-serif' : '700 54px Fredoka, sans-serif';
        g.fillStyle = timer < 6 ? '#ff5a7a' : '#fff';
        g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 960, 310);
      }
      if (phase === 'listen' && listenLabel) {
        g.font = '700 54px Fredoka, sans-serif';
        g.fillStyle = '#fff';
        g.fillText(listenLabel, 960, 310);
      }
      // Égaliseur de la voix en cours
      const lvl = playing?.level() ?? 0;
      // Le Doublage : la scène se joue au centre, la voix fait parler les marionnettes
      if (mode === 'doublage' && phase !== 'end') drawScene(g, t, phase === 'record' ? 0.25 : lvl);
      // Karaoké : les paroles s'affichent en grand
      if (mode === 'karaoke' && phase !== 'end' && phase !== 'choose') {
        g.fillStyle = '#ffd60a';
        g.font = '700 46px Fredoka, sans-serif';
        const words = wrap(g, `🎤 ${prompt}`, 1300, '700 46px Fredoka, sans-serif');
        words.slice(0, 2).forEach((l, i) => g.fillText(l, 960, 360 + i * 56));
      }
      if (playing && phase !== 'record' && mode !== 'doublage') {
        const n = 24;
        for (let i = 0; i < n; i++) {
          const h = 16 + lvl * (120 + 90 * Math.sin(i * 1.3 + t * 9));
          g.fillStyle = [SOLEIL, ROSE, CIEL, MENTHE][i % 4];
          g.beginPath();
          g.roundRect(960 + (i - n / 2) * 30, 460 - h / 2, 20, h, 10);
          g.fill();
        }
      }
      // Les réponses possibles, aussi sur la télé
      if (phase === 'choose' && (mode === 'devine' || mode === 'envers')) {
        options.forEach((o, i) => {
          const x = 300 + (i % 2) * 680;
          const y = 350 + Math.floor(i / 2) * 104;
          g.fillStyle = o.color;
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.beginPath();
          g.roundRect(x, y, 640, 90, 24);
          g.fill();
          g.stroke();
          g.fillStyle = INK;
          g.textAlign = 'center';
          const line = wrap(g, o.label, 600, '700 32px Fredoka, sans-serif')[0] ?? '';
          g.fillText(line, x + 320, y + 47);
        });
      }
      // Les joueurs
      const n = pls.length;
      const small = mode === 'doublage' && phase !== 'end';
      const size = small ? Math.min(80, 640 / n) : n > 8 ? 110 : n > 5 ? 140 : 180;
      pls.forEach((p, i) => {
        const x = 960 + (i - (n - 1) / 2) * Math.min(250, 1420 / n);
        const talk = speaking === p && !!playing;
        const y = 860 - (talk ? Math.abs(Math.sin(t * 14)) * lvl * 60 : 0);
        const voted = phase === 'choose' && p.pick >= 0;
        const ready = phase === 'record' && p.sent;
        const mine = actor === p && (phase === 'record' || phase === 'write');
        if (talk || mine) {
          g.fillStyle = 'rgba(255,255,220,.3)';
          g.beginPath();
          g.moveTo(x - 60, 340);
          g.lineTo(x + 60, 340);
          g.lineTo(x + 150, 900);
          g.lineTo(x - 150, 900);
          g.fill();
        }
        drawCharacter(g, x, y, talk ? size * 1.2 : size, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          mood: phase === 'end' ? 'win' : talk ? 'wow' : phase === 'reveal' && p.gain > 0 ? 'win' : 'happy',
        });
        g.font = '700 30px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = INK;
        const gap = Math.min(230, 1500 / pls.length);
        g.fillText(fitText(g, p.profile.name, gap - 8), x, 942);
        if (phase === 'end') g.fillText(String(p.score), x, 976);
        else if (phase === 'reveal' && p.gain) g.fillText(`+${p.gain}`, x, 976);
        if (ready || voted) {
          g.font = '44px sans-serif';
          g.fillText('✅', x, y - size - 16);
        }
      });
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): VoicePadData {
      const p = pls.find((x) => x.pid === pid)!;
      if (round < 0) return { phase: 'listen', prompt: '', step: '', act: null, clip: 0, maxSec: tune.max, sent: false, options: [], picked: -1, score: 0, left: 0, note: '' };
      const left = phase === 'record' || phase === 'choose' || phase === 'write' ? Math.ceil(Math.max(0, timer)) : 0;
      let myPrompt = prompt;
      let act: VoicePadData['act'] = null;
      let heard: string | undefined;
      if (phase === 'record') {
        if (mode === 'devine' || mode === 'envers') {
          if (p === actor) {
            act = 'record';
            myPrompt = mode === 'devine' ? (fr ? `Fais ce bruit, sans le nom : ${prompt}` : `Make this sound, don’t say its name: ${prompt}`) : fr ? `Dis cette phrase : ${prompt}` : `Say this sentence: ${prompt}`;
          } else myPrompt = `${actor?.profile.name ?? ''} ${fr ? 'prépare quelque chose…' : 'is preparing something…'}`;
        } else if (mode === 'casse') {
          if (p === actor) {
            act = 'record';
            if (chainAt === 0) myPrompt = fr ? `Répète cette phrase au micro : ${prompt}` : `Say this sentence into the mic: ${prompt}`;
            else {
              myPrompt = fr ? 'Écoute, puis répète exactement ce que tu as entendu.' : 'Listen, then repeat exactly what you heard.';
              heard = clips.find((c) => c.pid === chain[chainAt - 1]?.pid)?.url;
            }
          } else myPrompt = `${actor?.profile.name ?? ''} ${fr ? 'a le téléphone cassé…' : 'has the broken phone…'}`;
        } else {
          act = 'record';
          myPrompt = mode === 'doublage' ? (fr ? `Fais toutes les voix : ${prompt}` : `Do all the voices: ${prompt}`) : mode === 'karaoke' ? (fr ? `Chante sur la musique de la télé : « ${prompt} »` : `Sing along with the TV: “${prompt}”`) : mode === 'imite' ? (fr ? `Imite : ${prompt}` : `Imitate: ${prompt}`) : mode === 'voix' ? (fr ? `Dis : ${prompt}` : `Say: ${prompt}`) : fr ? 'Imite le bruit que tu viens d’entendre !' : 'Imitate the sound you just heard!';
        }
      } else if (phase === 'write') {
        if (p === actor) {
          act = 'write';
          myPrompt = fr ? 'Écoute, puis écris ce que tu as compris.' : 'Listen, then write what you understood.';
          heard = clips.find((c) => c.pid === chain[chainAt - 1]?.pid)?.url;
        } else myPrompt = `${actor?.profile.name ?? ''} ${fr ? 'écrit ce qu’il reste de la phrase…' : 'is writing what is left…'}`;
      } else if (phase === 'choose') {
        const excluded = (mode === 'devine' || mode === 'envers') && p === actor;
        if (!excluded) act = 'choose';
        myPrompt = excluded ? (fr ? 'Les autres cherchent…' : 'The others are guessing…') : mode === 'imite' || mode === 'doublage' || mode === 'karaoke' ? (fr ? 'Le meilleur ?' : 'The best?') : mode === 'perroquet' ? (fr ? 'Le plus ressemblant ?' : 'The closest?') : mode === 'voix' ? (fr ? 'Qui parlait ?' : 'Who was speaking?') : fr ? 'C’était quoi ?' : 'What was it?';
      } else myPrompt = phase === 'reveal' ? note : '';
      const opts = phase === 'choose' ? options.filter((o) => !(voteMode && clips[o.i]?.pid === pid)) : [];
      return { phase, prompt: myPrompt, step: `${Math.min(round + 1, rounds)}/${rounds}`, act, clip: clipNo, maxSec: tune.max, sent: p.sent, options: opts, picked: p.pick, score: p.score, left, note: '', heard };
    },
  };

  /** Deux marionnettes jouent la scène ; elles s'animent avec la voix. */
  function drawScene(g: CanvasRenderingContext2D, t: number, lvl: number) {
    const loop = t % 6;
    const talkA = Math.floor(t * 1.1) % 2 === 0;
    let ax = 700;
    let bx = 1220;
    let dirA: 1 | -1 = 1;
    let dirB: 1 | -1 = -1;
    let moodA: 'happy' | 'wow' | 'sad' | 'win' = 'happy';
    let moodB: 'happy' | 'wow' | 'sad' | 'win' = 'happy';
    let run = 0;
    if (scene.anim === 'duel') {
      const c = Math.sin(t * 2.4) * 70;
      ax = 760 + c;
      bx = 1160 - c;
      moodA = moodB = 'wow';
    } else if (scene.anim === 'rupture') {
      bx = 1220 + Math.min(240, loop * 60);
      dirA = 1;
      dirB = loop > 1.5 ? 1 : -1;
      moodA = 'sad';
      run = loop > 1.5 ? 0.5 : 0;
    } else if (scene.anim === 'poursuite') {
      const k = (t * 170) % 1500;
      bx = 320 + k;
      ax = 320 + ((k - 260 + 1500) % 1500);
      dirB = 1;
      moodA = 'wow';
      moodB = 'sad';
      run = 1;
    } else if (scene.anim === 'calin') {
      const c = Math.min(1, loop / 3);
      ax = 640 + 240 * c;
      bx = 1280 - 240 * c;
      moodA = moodB = 'win';
      run = c < 1 ? 0.5 : 0;
    } else if (scene.anim === 'annonce') {
      moodB = loop > 2.5 ? 'wow' : 'happy';
      bx = loop > 2.5 ? 1220 + Math.sin(t * 40) * 8 : 1220;
    } else {
      ax = 760 - Math.min(170, loop * 40) + Math.sin(t * 50) * 6;
      bx = 1200 - Math.min(120, loop * 30);
      dirA = -1;
      moodA = 'sad';
      moodB = 'wow';
    }
    const y = 730;
    const hop = (on: boolean) => (on ? Math.abs(Math.sin(t * 15)) * lvl * 46 : 0);
    const puppet = (food: string, x: number, on: boolean, dir: 1 | -1, mood: 'happy' | 'wow' | 'sad' | 'win', col: string) =>
      drawCharacter(g, x, y - hop(on), 300 * (1 + (on ? lvl * 0.08 : 0)), { food, color: col, hat: 'aucun', acc: 'aucun', t, run, dir, mood: on && lvl > 0.2 ? 'wow' : mood, skin: '' });
    puppet(scene.a, ax, talkA, dirA, moodA, '#ff4f9a');
    puppet(scene.b, bx, !talkA, dirB, moodB, '#2ec5ff');
    // Bulle quand quelqu'un parle
    if (lvl > 0.15) {
      const bx2 = talkA ? ax : bx;
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(bx2 + 100, y - 330, 62 + lvl * 26, 38 + lvl * 16, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = INK;
      g.font = '700 34px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillText('!?#', bx2 + 60, y - 328);
    }
  }

  function recordTitle() {
    if (mode === 'doublage') return prompt;
    if (mode === 'karaoke') return fr ? 'Écoutez la mélodie et chantez sur vos téléphones !' : 'Listen to the tune and sing into your phones!';
    if (mode === 'imite') return fr ? `Imitez : ${prompt}` : `Imitate: ${prompt}`;
    if (mode === 'voix') return fr ? `Tout le monde dit : « ${prompt} »` : `Everyone says: “${prompt}”`;
    if (mode === 'perroquet') return fr ? 'Écoutez le bruit, puis imitez-le !' : 'Listen, then imitate the sound!';
    if (mode === 'devine') return fr ? `${actor?.profile.name ?? ''} fait un bruit mystère…` : `${actor?.profile.name ?? ''} is making a mystery sound…`;
    if (mode === 'envers') return fr ? `${actor?.profile.name ?? ''} enregistre une phrase secrète…` : `${actor?.profile.name ?? ''} is recording a secret sentence…`;
    return phase === 'write' ? (fr ? `${actor?.profile.name ?? ''} écrit ce qu’il a compris…` : `${actor?.profile.name ?? ''} writes what they understood…`) : fr ? `Le téléphone passe à ${actor?.profile.name ?? ''}…` : `The phone goes to ${actor?.profile.name ?? ''}…`;
  }

  return game;
}

const base = (id: Mode, emoji: string, name: [string, string], how: [string, string], min: number, botFill: number): GameBase => ({
  id,
  emoji,
  name: { fr: name[0], en: name[1] },
  how: { fr: how[0], en: how[1] },
  layout: 'buttons',
  min,
  max: 12,
  botFill,
  // Pas de musique : on doit bien entendre les voix
  music: '' as MusicId,
  create: (r: Runner[], c: GameCtx) => createVoice(id, r, c),
});

export const doublage = base('doublage', '🎬', ['Le Doublage', 'The Dub'], ['Une scène absurde : fais toutes les voix au micro. La télé la joue avec ta voix !', 'An absurd scene: do all the voices on the mic. The TV plays it with your voice!'], 2, 3);
export const karaoke = base('karaoke', '🎤', ['Le Karaoké Bidon', 'Fake Karaoke'], ['Une vraie musique, des paroles absurdes : chante, et que le meilleur gagne !', 'Real music, absurd lyrics: sing, and may the best win!'], 2, 3);
export const imite = base('imite', '🎙️', ['Le Grand Bruiteur', 'The Great Noisemaker'], ['Un défi absurde, ton téléphone est le micro. La télé fait écouter, tout le monde vote !', 'An absurd challenge, your phone is the mic. The TV plays it back, everyone votes!'], 2, 3);
export const devine = base('devine', '🔊', ['C’est Quoi Ce Bruit ?', 'What’s That Noise?'], ['Un joueur fait un bruit mystère au micro, les autres devinent.', 'One player makes a mystery sound, the others guess.'], 2, 3);
export const perroquet = base('perroquet', '🦜', ['Le Perroquet Enrhumé', 'The Sniffly Parrot'], ['La télé fait un drôle de bruit. Imite-le le mieux possible !', 'The TV makes a funny sound. Imitate it as well as you can!'], 2, 3);
export const envers = base('envers', '⏪', ['Le Disque à l’Envers', 'The Backwards Record'], ['Une phrase secrète est jouée à l’envers. Devine ce qu’elle dit !', 'A secret sentence is played backwards. Guess what it says!'], 2, 3);
export const voix = base('voix', '🕵️', ['La Voix Mystère', 'Mystery Voice'], ['Ta voix est déformée à la télé. Qui parle ? Trompe les autres !', 'Your voice is distorted on TV. Who is speaking? Fool the others!'], 2, 3);
export const casse = base('casse', '📞', ['Le Téléphone Cassé', 'Broken Telephone'], ['Une phrase passe de téléphone en téléphone, à l’oreille. La télé révèle le massacre !', 'A sentence passes from phone to phone, by ear. The TV reveals the carnage!'], 3, 0);
