// Bilan de la soirée : des titres rigolos tirés des statistiques (victoires, dernières places, réactions…).
import { CharCanvas } from '../shared/CharCanvas';
import { REACTIONS } from '../shared/reactions';
import type { Player, Session, Stats } from './session';

interface Award {
  icon: string;
  title: string;
  who: Player;
  line: string;
  mood: 'win' | 'happy' | 'sad' | 'wow';
}

type L = 'fr' | 'en';

/** Le joueur qui a la plus grande valeur (au moins min), sinon personne. */
function best(rows: { p: Player; st: Stats }[], score: (st: Stats) => number, min = 1) {
  let top: { p: Player; v: number } | null = null;
  for (const r of rows) {
    const v = score(r.st);
    if (v >= min && (!top || v > top.v)) top = { p: r.p, v };
  }
  return top;
}

function awards(session: Session, lang: L): { list: Award[]; emoji: string | null; games: number } {
  const fr = lang === 'fr';
  const rows = [...session.stats.entries()].filter(([pid, st]) => session.players.has(pid) && (st.games > 0 || st.reacts > 0)).map(([pid, st]) => ({ p: session.players.get(pid)!, st }));
  const list: Award[] = [];
  // Titres répartis : 1 par personne à partir de 4 joueurs, sinon 2
  const limit = rows.length >= 4 ? 1 : 2;
  const free = () => rows.filter((r) => list.filter((a) => a.who === r.p).length < limit);
  const add = (icon: string, title: [string, string], top: { p: Player; v: number } | null, line: (v: number) => [string, string], mood: Award['mood'] = 'win') => {
    if (top && !list.some((a) => a.title === title[fr ? 0 : 1])) list.push({ icon, title: title[fr ? 0 : 1], who: top.p, line: line(top.v)[fr ? 0 : 1], mood });
  };
  const s = (n: number) => (n > 1 ? 's' : '');
  add('🏆', ['Le Boss', 'The Boss'], best(free(), (st) => st.wins), (v) => [`${v} victoire${s(v)}`, `${v} win${s(v)}`]);
  add('🐌', ['Lanterne rouge', 'Rock bottom'], best(free(), (st) => st.lasts), (v) => [`${v} fois dernier`, `last ${v} time${s(v)}`], 'sad');
  add('🥉', ['Abonné au podium', 'Podium regular'], best(free(), (st) => st.podiums, 2), (v) => [`${v} fois dans le top 3`, `top 3 ${v} times`]);
  // Plus grosse remontée d'une partie à la suivante
  add(
    '📈',
    ['La Remontada', 'The Comeback'],
    best(free(), (st) => Math.max(0, ...st.ranks.slice(1).map((r, i) => st.ranks[i] - r)), 2),
    (v) => [`${v} places gagnées d’un coup`, `${v} places up in one go`],
  );
  // Le plus régulier : places les plus proches les unes des autres (au moins 3 parties)
  add(
    '🎯',
    ['Monsieur Régulier', 'Mr Consistent'],
    best(free(), (st) => {
      if (st.ranks.length < 3) return 0;
      const m = st.ranks.reduce((a, b) => a + b, 0) / st.ranks.length;
      const dev = Math.sqrt(st.ranks.reduce((a, b) => a + (b - m) ** 2, 0) / st.ranks.length);
      return 10 - dev;
    }, 0.1),
    () => ['toujours à la même place', 'always the same spot'],
    'happy',
  );
  add('😂', ['Roi des réactions', 'Reaction King'], best(free(), (st) => st.reacts, 5), (v) => [`${v} réactions envoyées`, `${v} reactions sent`], 'wow');
  if (!session.family) add('🖕', ['Le plus vulgaire', 'Potty Mouth'], best(free(), (st) => st.rude, 3), (v) => [`${v} gestes déplacés`, `${v} rude gestures`], 'wow');
  add('🤫', ['Agent secret', 'Secret Agent'], best(free(), (st) => st.secrets), (v) => [`${v} défi${s(v)} secret${s(v)} réussi${s(v)}`, `${v} secret mission${s(v)} done`]);
  add('👻', ['Fantôme vengeur', 'Vengeful Ghost'], best(free(), (st) => st.ghosts, 2), (v) => [`${v} sorts jetés`, `${v} curses cast`], 'wow');
  add('⚔️', ['Le Duelliste', 'The Duelist'], best(free(), (st) => st.duels), (v) => [`${v} duel${s(v)} gagné${s(v)}`, `${v} duel${s(v)} won`]);
  {
    const top = best(free(), (st) => st.titles.length);
    const st = top && session.stats.get(top.p.pid);
    if (top && st) add('🗳️', ['Désigné par le salon', 'Chosen by the couch'], top, () => [st.titles.slice(-2).join(' · '), st.titles.slice(-2).join(' · ')], 'wow');
  }
  add('🎮', ['Accro du canapé', 'Couch Addict'], best(free(), (st) => st.games, 3), (v) => [`${v} parties jouées`, `${v} games played`], 'happy');
  // Emoji de la soirée
  const count: Record<number, number> = {};
  rows.forEach(({ st }) => Object.entries(st.emoji).forEach(([i, n]) => (count[+i] = (count[+i] ?? 0) + n)));
  const fav = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  const re = fav ? REACTIONS[+fav[0]] : null;
  const emoji = re ? (re.txt ? `« ${re.txt[lang]} »` : re.e) : null;
  const games = Math.max(0, ...rows.map((r) => r.st.games));
  return { list: list.slice(0, 6), emoji, games };
}

export function Recap({ session, lang }: { session: Session; players: Player[]; lang: L }) {
  const fr = lang === 'fr';
  const { list, emoji, games } = awards(session, lang);
  return (
    <div className="overlay recap-bg">
      <h2 className="sticker title sun">{fr ? 'Le bilan de la soirée' : 'Tonight’s awards'}</h2>
      <p className="results-sub">
        {fr ? `${games} partie${games > 1 ? 's' : ''} au compteur` : `${games} game${games > 1 ? 's' : ''} played`}
        {emoji ? (fr ? ` · Réaction de la soirée : ${emoji}` : ` · Reaction of the night: ${emoji}`) : ''}
      </p>
      <div className="recap-grid">
        {list.map((a, i) => (
          <div key={a.title} className="recap-card" style={{ animationDelay: `${0.3 + i * 0.35}s`, ['--pc' as string]: a.who.color }}>
            <span className="recap-icon">{a.icon}</span>
            <CharCanvas profile={a.who} size={120} still mood={a.mood} />
            <b>{a.title}</b>
            <span className="recap-who">{a.who.name}</span>
            <small>{a.line}</small>
          </div>
        ))}
        {!list.length && <p className="results-sub">{fr ? 'Jouez encore un peu pour débloquer les titres !' : 'Play a bit more to unlock the awards!'}</p>}
      </div>
    </div>
  );
}
