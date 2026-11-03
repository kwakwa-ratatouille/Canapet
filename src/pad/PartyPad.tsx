// Écrans du téléphone entre les jeux : questions de la soirée (vote), roue de la honte, départage.
import { useEffect, useState } from 'react';
import type { Lang, PadScreen, ToTv } from '../shared/protocol';
import { sfx } from '../shared/sound';
import './party.css';

type Of<S> = Extract<PadScreen, { s: S }>;
const VOTE_TIME = 20;

/** Question de la soirée : on touche un joueur (ou A / B). On peut changer d'avis tant que le résultat n'est pas tombé. */
export function VotePad({ screen, lang, send }: { screen: Of<'vote'>; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  const [left, setLeft] = useState(VOTE_TIME);
  // Le chrono repart à chaque nouvelle question
  useEffect(() => {
    const end = Date.now() + VOTE_TIME * 1000;
    setLeft(VOTE_TIME);
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 250);
    return () => clearInterval(id);
  }, [screen.n]);
  const ab = screen.options.length === 2 && screen.options[0].id === 'a';
  const vote = (id: string) => {
    if (screen.reveal) return;
    sfx.click();
    navigator.vibrate?.(30);
    send({ t: 'vote', v: id });
  };
  return (
    <div className="pad-body vote-pad">
      <div className="vp-top">
        <span className="vp-step">
          {fr ? 'Question' : 'Question'} {screen.n}/{screen.of}
        </span>
        {!screen.reveal && <span className={`vp-time ${left <= 5 ? 'hot' : ''}`}>⏱ {left}</span>}
      </div>
      <h2 className="vp-q">{screen.q}</h2>
      {screen.reveal ? (
        <p className="vp-wait">📺 {fr ? 'Le résultat est sur la télé !' : 'The result is on the TV!'}</p>
      ) : (
        <p className="vp-hint">{screen.my ? (fr ? '✓ Vote envoyé, tu peux encore changer' : '✓ Voted, you can still change') : ab ? (fr ? 'Touche ta réponse' : 'Tap your answer') : fr ? 'Touche un joueur' : 'Tap a player'}</p>
      )}
      <div className={`vp-options ${ab ? 'ab' : 'who'}`}>
        {screen.options.map((o) => (
          <button
            key={o.id}
            className={`vp-opt ${screen.my === o.id ? 'mine' : ''} ${screen.my && screen.my !== o.id ? 'dim' : ''}`}
            style={{ ['--oc' as string]: o.color }}
            disabled={screen.reveal}
            onClick={() => vote(o.id)}
          >
            {ab && <b>{o.id.toUpperCase()}</b>}
            <span>{o.label}</span>
            {screen.my === o.id && <i>✓</i>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Roue de la honte : la victime (ou l'hôte) la lance ; les autres regardent la télé. */
export function WheelPad({ screen, lang, send }: { screen: Of<'wheel'>; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  const can = !screen.spun && (screen.victim || screen.host);
  return (
    <div className="pad-body vote-pad">
      <h2 className="vp-q">🎡 {fr ? 'La roue de la honte' : 'The wheel of shame'}</h2>
      <p className="vp-hint">{screen.victim ? (fr ? 'C’est toi la victime…' : 'You’re the victim…') : fr ? `Victime : ${screen.victimName}` : `Victim: ${screen.victimName}`}</p>
      {can ? (
        <button
          className="big-spin"
          onClick={() => {
            sfx.click();
            navigator.vibrate?.(60);
            send({ t: 'spin' });
          }}
        >
          {fr ? 'TOURNER' : 'SPIN'}
        </button>
      ) : screen.result ? (
        <p className="vp-result">{screen.result}</p>
      ) : (
        <p className="vp-wait">📺 {screen.spun ? (fr ? 'Ça tourne…' : 'Spinning…') : fr ? 'Regarde la télé' : 'Watch the TV'}</p>
      )}
    </div>
  );
}

/** Départage : on arrête le chrono à l'aveugle, le plus près de 10 s gagne. */
export function TiebreakPad({ screen, lang, send }: { screen: Of<'tiebreak'>; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  const [wait, setWait] = useState(Math.ceil(screen.startAt));
  useEffect(() => {
    const end = Date.now() + screen.startAt * 1000;
    const id = setInterval(() => setWait(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 100);
    return () => clearInterval(id);
  }, [screen.startAt]);
  if (!screen.in)
    return (
      <div className="pad-body vote-pad">
        <h2 className="vp-q">⚖️ {fr ? 'Départage !' : 'Tiebreak!'}</h2>
        <p className="vp-wait">📺 {fr ? 'Regarde la télé' : 'Watch the TV'}</p>
      </div>
    );
  return (
    <div className="pad-body vote-pad">
      <h2 className="vp-q">⚖️ {fr ? 'Départage !' : 'Tiebreak!'}</h2>
      <p className="vp-hint">{fr ? 'Arrête le chrono à 10 secondes pile, sans le voir !' : 'Stop the clock at exactly 10 seconds, blind!'}</p>
      {screen.done || screen.stopped ? (
        <p className="vp-wait">📺 {screen.done ? (fr ? 'Résultat à la télé !' : 'Result on the TV!') : fr ? 'Arrêté ! Attends les autres…' : 'Stopped! Wait for the others…'}</p>
      ) : wait > 0 ? (
        <p className="vp-count">{wait}</p>
      ) : (
        <button
          className="big-stop"
          onClick={() => {
            navigator.vibrate?.(80);
            send({ t: 'stop' });
          }}
        >
          STOP
        </button>
      )}
    </div>
  );
}
