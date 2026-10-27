import { useState } from 'react';
import type { ReflexPadData } from '../games/reflexShared';
import type { Lang, ToTv } from '../shared/protocol';

/** Manette de Réflexes Éclair : un gros bouton, ou quatre choix colorés. */
export function ReflexPad({ data, lang, send }: { data: ReflexPadData; lang: Lang; send: (m: ToTv) => void }) {
  const [down, setDown] = useState(false);
  const tap = () => {
    send({ t: 'act', a: 'tap' });
    if (navigator.vibrate) navigator.vibrate(8);
  };
  return (
    <div className="traitor reflex">
      <p className="pad-small">
        {lang === 'fr' ? 'Score' : 'Score'} : {data.score}
      </p>
      <p className="pad-title">{data.title}</p>
      {data.note && <p className="pad-title uc-note">{data.note}</p>}
      {(data.kind === 'buzz' || data.kind === 'mash') && (
        <button
          className={`round-btn rose reflex-btn ${down ? 'down' : ''}`}
          disabled={data.locked && data.kind === 'buzz'}
          onPointerDown={(e) => {
            e.preventDefault();
            setDown(true);
            tap();
          }}
          onPointerUp={() => setDown(false)}
          onPointerCancel={() => setDown(false)}
        >
          {data.kind === 'mash' ? '🔨' : lang === 'fr' ? 'TAPE' : 'TAP'}
        </button>
      )}
      {data.kind === 'choice' && (
        <div className="reflex-grid">
          {data.options.map((o, i) => (
            <button key={i} className="reflex-choice" disabled={data.locked} style={{ background: o.color }} onClick={() => send({ t: 'act', a: 'pick', n: [i] })}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {data.kind === 'wait' && <p className="pad-title pulse">👀</p>}
    </div>
  );
}
