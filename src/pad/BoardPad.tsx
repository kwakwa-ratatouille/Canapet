import type { BoardPadData } from '../games/boardShared';
import type { Lang, ToTv } from '../shared/protocol';

const TXT = {
  fr: { roll: '🎲 LANCER', tap: 'TAPE !', wait: 'Attends…', now: 'MAINTENANT !', early: 'Trop tôt ! ❌', done: 'Pile au bon moment !' },
  en: { roll: '🎲 ROLL', tap: 'TAP!', wait: 'Wait…', now: 'NOW!', early: 'Too early! ❌', done: 'Nice timing!' },
};

/** Manette du Grand Plateau : un gros bouton qui change selon le moment. */
export function BoardPad({ data, lang, send }: { data: BoardPadData; lang: Lang; send: (m: ToTv) => void }) {
  const T = TXT[lang];
  const press = (a: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(12);
    send({ t: 'act', a });
  };
  return (
    <div className="boardpad">
      <p className="boardpad-stats">
        🛋️ {data.stars} · 🍬 {data.candies}
      </p>
      {data.mode === 'roll' && (
        <button className="big-round" onPointerDown={press('roll')}>
          {T.roll}
        </button>
      )}
      {data.mode === 'tap' && (
        <button className="big-round tap" onPointerDown={press('tap')}>
          {T.tap}
        </button>
      )}
      {data.mode === 'react' && (
        <button className={`big-round ${data.go ? 'go' : 'stop'}`} onPointerDown={press('tap')}>
          {data.early ? T.early : data.go ? T.now : T.wait}
        </button>
      )}
      {data.mode === 'coin' && (
        <div className="coin-row">
          <button className="round-btn rose" onPointerDown={(e) => { e.preventDefault(); send({ t: 'act', a: 'coin', n: [0] }); }}>
            {lang === 'fr' ? 'PILE' : 'HEADS'}
          </button>
          <button className="round-btn sun" onPointerDown={(e) => { e.preventDefault(); send({ t: 'act', a: 'coin', n: [1] }); }}>
            {lang === 'fr' ? 'FACE' : 'TAILS'}
          </button>
        </div>
      )}
      {data.mode === 'wait' && <p className="pad-title">{data.info}</p>}
    </div>
  );
}
