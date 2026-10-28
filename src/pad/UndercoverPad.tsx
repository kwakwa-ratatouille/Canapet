import { useState } from 'react';
import type { UndercoverPadData } from '../games/undercoverShared';
import type { Lang, ToTv } from '../shared/protocol';

const TXT = {
  fr: {
    yourWord: 'Ton mot secret',
    white: 'Tu es Mr White 🤫',
    whiteGoal: 'Tu n’as pas de mot. Écoute les indices et fais semblant !',
    goal: 'Donne des indices sans trop en dire. Attention : quelqu’un a un mot un peu différent…',
    hide: 'Toucher pour cacher',
    show: 'Toucher pour voir mon mot',
    yourTurn: 'À toi ! Donne un indice (un ou plusieurs mots, jamais déjà dit)',
    send: 'Envoyer',
    waitTurn: (n: string) => `C’est au tour de ${n}…`,
    ready: 'J’ai fini de débattre ✋',
    vote: 'Qui est l’imposteur ?',
    guess: 'Devine le mot des civils !',
    out: 'Tu es éliminé. Chut ! 🤐',
    wait: 'Patiente…',
    mine: 'Tes indices : ',
  },
  en: {
    yourWord: 'Your secret word',
    white: 'You are Mr White 🤫',
    whiteGoal: 'You have no word. Listen to the clues and bluff!',
    goal: 'Give clues without saying too much. Careful: someone has a slightly different word…',
    hide: 'Tap to hide',
    show: 'Tap to see my word',
    yourTurn: 'Your turn! Give a clue (one or more words, never already said)',
    send: 'Send',
    waitTurn: (n: string) => `${n}’s turn…`,
    ready: 'Done debating ✋',
    vote: 'Who’s the impostor?',
    guess: 'Guess the civilians’ word!',
    out: 'You’re out. Shh! 🤐',
    wait: 'Wait…',
    mine: 'Your clues: ',
  },
};

/** Manette d'Undercover : mot secret (masquable), indice à taper, vote. */
export function UndercoverPad({ data, lang, send }: { data: UndercoverPadData; lang: Lang; send: (m: ToTv) => void }) {
  const T = TXT[lang];
  const [hidden, setHidden] = useState(false);
  const [text, setText] = useState('');
  const submit = (a: 'clue' | 'guess') => {
    if (!text.trim()) return;
    send({ t: 'act', a, s: text.trim() });
    setText('');
    if (navigator.vibrate) navigator.vibrate(20);
  };
  return (
    <div className="traitor">
      <p className="pad-small">{data.theme}</p>
      <button className={`role-card ${data.word ? 'gourmand' : 'glouton'} ${hidden ? 'hidden' : ''}`} onClick={() => setHidden((h) => !h)}>
        {hidden ? (
          <b>{T.show}</b>
        ) : data.word ? (
          <>
            <small>{T.yourWord}</small>
            <b className="uc-word">{data.word}</b>
            <small>{T.goal}</small>
            <em>{T.hide}</em>
          </>
        ) : (
          <>
            <b>{T.white}</b>
            <small>{T.whiteGoal}</small>
            <em>{T.hide}</em>
          </>
        )}
      </button>
      {data.myClues.length > 0 && (
        <p className="pad-small">
          {T.mine}
          {data.myClues.join(' · ')}
        </p>
      )}

      {data.act === 'clue' || data.act === 'guess' ? (
        <form
          className="uc-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit(data.act as 'clue' | 'guess');
          }}
        >
          <p className="pad-title">{data.act === 'clue' ? T.yourTurn : T.guess}</p>
          <input className="guess-input" value={text} maxLength={30} autoFocus autoComplete="off" onChange={(e) => setText(e.target.value)} />
          {data.note && <p className="pad-small uc-note">{data.note}</p>}
          <button className="btn big mint" type="submit">
            {T.send} · {data.left}s
          </button>
        </form>
      ) : !data.alive ? (
        <p className="pad-title">{T.out}</p>
      ) : data.act === 'ready' ? (
        <button className="btn big" onClick={() => send({ t: 'act', a: 'ready' })}>
          {T.ready}
        </button>
      ) : data.act === 'vote' ? (
        <>
          <p className="pad-title">{T.vote}</p>
          <div className="choices">
            {data.options.map((o) => (
              <button
                key={o.i}
                className={`choice ${data.picked === o.i ? 'on' : ''}`}
                style={{ ['--c' as string]: o.color }}
                onClick={() => send({ t: 'act', a: 'pick', n: [o.i] })}
              >
                {o.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="pad-title pulse">{data.turn ? T.waitTurn(data.turn) : T.wait}</p>
      )}
    </div>
  );
}
