import { useEffect, useState } from 'react';
import { RANKS, RANKS_EN, SUITS, isRed, rankOf, type PresidentPadData } from '../games/presidentShared';
import type { Lang, ToTv } from '../shared/protocol';
import { sfx } from '../shared/sound';

const TXT = {
  fr: {
    yourTurn: 'À toi !',
    lead: 'Table vide : pose 1 à 4 cartes de même valeur',
    follow: (n: number, r: string) => `Pose ${n} carte${n > 1 ? 's' : ''} de même valeur, ${r} ou plus`,
    waiting: (n: string) => `Au tour de ${n}`,
    play: (n: number) => `Poser ${n}`,
    pick: 'Choisis tes cartes',
    pass: 'Je passe',
    give: (n: number, to: string) => `Choisis ${n} carte${n > 1 ? 's' : ''} à donner à ${to}`,
    giveBtn: 'Donner',
    swapWait: 'Échange des cartes en cours…',
    deal: 'Distribution…',
    round: 'Fin de la manche : regarde la télé',
    done: (p: number) => (p === 1 ? 'Tu as fini premier ! 👑' : `Tu as fini (${p}e). Regarde les autres.`),
    bad: 'Ces cartes ne vont pas',
  },
  en: {
    yourTurn: 'Your turn!',
    lead: 'Empty table: play 1 to 4 cards of the same value',
    follow: (n: number, r: string) => `Play ${n} card${n > 1 ? 's' : ''} of the same value, ${r} or higher`,
    waiting: (n: string) => `${n}'s turn`,
    play: (n: number) => `Play ${n}`,
    pick: 'Pick your cards',
    pass: 'Pass',
    give: (n: number, to: string) => `Pick ${n} card${n > 1 ? 's' : ''} to give to ${to}`,
    giveBtn: 'Give',
    swapWait: 'Swapping cards…',
    deal: 'Dealing…',
    round: 'End of round: watch the TV',
    done: (p: number) => (p === 1 ? 'You went out first! 👑' : `You're out (#${p}). Watch the others.`),
    bad: 'These cards don’t work',
  },
};

/** Manette du Président : ta main (secrète), poser ou passer, et l'échange de cartes. */
export function PresidentPad({ data, lang, send }: { data: PresidentPadData; lang: Lang; send: (m: ToTv) => void }) {
  const T = TXT[lang];
  const R = lang === 'fr' ? RANKS : RANKS_EN;
  const [sel, setSel] = useState<number[]>([]);
  const key = data.hand.join(',');
  useEffect(() => setSel([]), [key, data.myTurn, data.give]);

  const picking = data.myTurn || data.give > 0;
  const toggle = (c: number) => {
    if (!picking) return;
    sfx.click();
    setSel((s) => {
      if (s.includes(c)) return s.filter((x) => x !== c);
      if (data.give) return s.length < data.give ? [...s, c] : s;
      // Pour jouer : seulement des cartes de même valeur (toucher une autre valeur recommence la sélection)
      const same = s.filter((x) => rankOf(x) === rankOf(c));
      const max = data.need || 4;
      return same.length < max ? [...same, c] : same;
    });
  };
  const act = (a: string, n?: number[]) => {
    if (navigator.vibrate) navigator.vibrate(20);
    send({ t: 'act', a, n });
  };
  const valid =
    data.myTurn &&
    sel.length > 0 &&
    (data.need ? sel.length === data.need && rankOf(sel[0]) >= data.min : sel.length <= 4) &&
    sel.every((c) => rankOf(c) === rankOf(sel[0]));
  // Les cartes qui peuvent être jouées sont mises en avant
  const playable = (c: number) => {
    if (!data.myTurn) return true;
    if (!data.need) return true;
    return rankOf(c) >= data.min && data.hand.filter((x) => rankOf(x) === rankOf(c)).length >= data.need;
  };

  let status = '';
  if (data.phase === 'deal') status = T.deal;
  else if (data.phase === 'round' || data.phase === 'end') status = T.round;
  else if (data.give) status = T.give(data.give, data.giveTo);
  else if (data.phase === 'swap') status = T.swapWait;
  else if (data.done) status = T.done(data.done);
  else if (data.myTurn) status = `${T.yourTurn} ${data.need ? T.follow(data.need, R[data.min]) : T.lead}`;
  else status = T.waiting(data.turnName);

  return (
    <div className="pres">
      <div className="pres-top">
        {data.role && <span className="pres-role">{data.role}</span>}
        {data.pile.length > 0 && (
          <span className="pres-pile">
            {data.pileBy} :{' '}
            {data.pile.map((c) => (
              <i key={c} className={isRed(c) ? 'red' : ''}>
                {R[rankOf(c)]}
                {SUITS[c % 4]}
              </i>
            ))}
          </span>
        )}
      </div>
      <p className={`pres-status ${data.myTurn || data.give ? 'hot' : ''}`}>{status}</p>
      <div className="pres-hand">
        {data.hand.map((c) => (
          <button key={c} className={`pcard ${isRed(c) ? 'red' : ''} ${sel.includes(c) ? 'on' : ''} ${picking && !playable(c) && !data.give ? 'dim' : ''}`} onClick={() => toggle(c)}>
            <b>{R[rankOf(c)]}</b>
            <span>{SUITS[c % 4]}</span>
          </button>
        ))}
      </div>
      {data.myTurn && (
        <div className="pres-actions">
          <button className="btn big mint" disabled={!valid} onClick={() => act('play', sel)}>
            {sel.length ? T.play(sel.length) : T.pick}
          </button>
          {data.need > 0 && (
            <button className="btn big alt" onClick={() => act('pass')}>
              {T.pass}
            </button>
          )}
        </div>
      )}
      {data.give > 0 && (
        <div className="pres-actions">
          <button className="btn big sun" disabled={sel.length !== data.give} onClick={() => act('give', sel)}>
            {T.giveBtn} {sel.length}/{data.give}
          </button>
        </div>
      )}
    </div>
  );
}
