import { useEffect, useState } from 'react';
import type { QuizPadData } from '../games/quizShared';
import { noTvState } from '../shared/noTv';
import type { Lang, ToTv } from '../shared/protocol';

/** Manette du Tribunal et du Dico Bidon : écrire une réponse ou choisir dans une liste. */
export function QuizPad({ data, lang, send }: { data: QuizPadData; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  const [text, setText] = useState('');
  // Le champ se vide à chaque nouvelle manche
  useEffect(() => setText(''), [data.prompt]);
  const submit = () => {
    if (!text.trim()) return;
    navigator.vibrate?.(30);
    send({ t: 'act', a: 'text', s: text.trim().slice(0, 90) });
    setText('');
  };
  return (
    <div className="traitor">
      <p className="pad-small">
        {data.step} · ⭐ {data.score}
        {data.left > 0 && ` · ⏱ ${data.left}`}
      </p>
      <p className="pad-title">{data.prompt}</p>
      {data.big && <p className="quiz-big">{data.big}</p>}
      {!!data.chips?.length && (
        <p className="quiz-chips">
          {data.chips.map((c) => <span key={c}>✓ {c}</span>)}
        </p>
      )}
      {data.note && <p className="pad-small uc-note">{data.note}</p>}
      {data.act === 'write' ? (
        <form
          className="uc-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input value={text} maxLength={90} autoComplete="off" inputMode={data.numeric ? 'decimal' : 'text'} placeholder={data.hint ?? (fr ? 'Invente une définition crédible…' : 'Make up a believable meaning…')} onChange={(e) => setText(e.target.value)} />
          <button className="btn big mint" disabled={!text.trim()}>
            {fr ? 'Envoyer' : 'Send'}
          </button>
        </form>
      ) : data.act === 'choose' ? (
        <div className="choices">
          {data.options.map((o) => (
            <button
              key={o.i}
              className={`choice ${data.picked === o.i || data.pickedAll?.includes(o.i) ? 'on' : ''}`}
              style={{ ['--c' as string]: o.color }}
              onClick={() => {
                navigator.vibrate?.(20);
                send({ t: 'act', a: 'pick', n: [o.i] });
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="pad-title pulse">{noTvState.on ? (fr ? '🔍 Touche l’image pour l’agrandir' : '🔍 Tap the picture to enlarge it') : fr ? '📺 Regarde la télé !' : '📺 Watch the TV!'}</p>
      )}
    </div>
  );
}
