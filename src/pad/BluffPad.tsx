import { useEffect, useState } from 'react';
import { CARD_NAMES, type BluffPadData, type Card } from '../games/bluffShared';
import { CharCanvas } from '../shared/CharCanvas';
import type { Lang, ToTv } from '../shared/protocol';
import { sfx } from '../shared/sound';

const TXT = {
  fr: {
    table: 'Carte du tour',
    yourTurn: 'À toi !',
    forced: 'Plus personne n’a de cartes : tu dois accuser !',
    waiting: 'Au tour de {name}',
    play: 'Poser',
    liar: 'MENTEUR !',
    claim: '{name} prétend avoir posé {n} × {card}',
    pick: 'Choisis 1 à 3 cartes',
    roulette: 'Appuie sur ton coussin…',
    out: 'KO 💨 Tu regardes les autres.',
    danger: 'Coussin : {s}/6',
  },
  en: {
    table: 'Round card',
    yourTurn: 'Your turn!',
    forced: 'Nobody else has cards: you must accuse!',
    waiting: '{name}’s turn',
    play: 'Play',
    liar: 'LIAR!',
    claim: '{name} claims {n} × {card}',
    pick: 'Pick 1 to 3 cards',
    roulette: 'Squeeze your cushion…',
    out: 'Out 💨 Watch the others.',
    danger: 'Cushion: {s}/6',
  },
};

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

/** Manette du Bar des Bobards : ta main reste cachée sur ton téléphone. */
export function BluffPad({ data, lang, send }: { data: BluffPadData; lang: Lang; send: (m: ToTv) => void }) {
  const T = TXT[lang];
  const [sel, setSel] = useState<number[]>([]);
  const handKey = data.hand.join(',');
  useEffect(() => setSel([]), [handKey, data.myTurn]);

  const toggle = (k: number) => {
    if (!data.myTurn || data.forced) return;
    sfx.click();
    setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length < 3 ? [...s, k] : s));
  };
  const act = (a: string, n?: number[]) => {
    if (navigator.vibrate) navigator.vibrate(20);
    send({ t: 'act', a, n });
  };

  return (
    <div className="bluff">
      <div className="bluff-top">
        <div className="bluff-table">
          <MiniCard card={data.table} lang={lang} size={46} />
          <div>
            <small>{T.table}</small>
            <b>{CARD_NAMES[data.table][lang]}</b>
          </div>
        </div>
        <div className={`danger d${data.shots}`}>💨 {fill(T.danger, { s: data.shots })}</div>
      </div>

      <p className="bluff-status">
        {!data.alive
          ? T.out
          : data.roulette
            ? T.roulette
            : data.myTurn
              ? data.forced
                ? T.forced
                : T.yourTurn
              : data.turnName
                ? fill(T.waiting, { name: data.turnName })
                : '…'}
      </p>
      {data.claim && data.alive && !data.roulette && (
        <p className="bluff-claim">
          {fill(T.claim, { name: data.claim.name, n: data.claim.count, card: CARD_NAMES[data.table][lang] })}
        </p>
      )}

      {data.roulette ? (
        <button className="cushion-btn" onPointerDown={() => act('pull')}>
          <CharCanvas profile={{ food: 'coussin', color: '#ff4f9a', hat: 'aucun', acc: 'aucun' }} size={150} mood="wow" />
        </button>
      ) : (
        <>
          <div className="hand">
            {data.hand.map((c, k) => (
              <button
                key={k + c}
                className={`bcard ${sel.includes(k) ? 'on' : ''} ${data.myTurn && !data.forced ? '' : 'idle'}`}
                onClick={() => toggle(k)}
              >
                <MiniCard card={c} lang={lang} size={58} />
                <small>{CARD_NAMES[c][lang]}</small>
              </button>
            ))}
          </div>
          {data.myTurn && (
            <div className="bluff-actions">
              {!data.forced && (
                <button className="btn" disabled={!sel.length} onClick={() => act('play', sel)}>
                  {sel.length ? `${T.play} ${sel.length}` : T.pick}
                </button>
              )}
              {data.canCall && (
                <button className="btn liar" onClick={() => act('call')}>
                  {T.liar}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniCard({ card, size }: { card: Card; lang: Lang; size: number }) {
  if (card === 'miroir')
    return (
      <span className="mirror-card" style={{ fontSize: size * 0.7, width: size, height: size * 1.25 }}>
        🪞
      </span>
    );
  return <CharCanvas profile={{ food: card, color: '#ffffff', hat: 'aucun', acc: 'aucun' }} size={size} still />;
}
