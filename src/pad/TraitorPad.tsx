import { useState } from 'react';
import type { TraitorPadData } from '../games/traitorShared';
import type { Lang, ToTv } from '../shared/protocol';

const TXT = {
  fr: {
    role: { gourmand: 'Gourmand 😇', pique: 'Pique-assiette 😈', gouteur: 'Goûteur 👃', glouton: 'Glouton 🤤' },
    goal: {
      gourmand: 'Trouve les Pique-assiettes et vote contre eux.',
      pique: 'Vide le frigo sans te faire griller. Mens !',
      gouteur: 'Chaque nuit, renifle un joueur pour savoir s’il est Pique-assiette.',
      glouton: 'Tu joues seul : fais-toi mettre à la porte au vote et tu gagnes. Aie l’air louche !',
    },
    mates: 'Tes complices : ',
    kill: 'Qui finit la tête dans le frigo ?',
    sniff: 'Qui veux-tu renifler ?',
    vote: 'Qui met-on à la porte ?',
    ready: 'J’ai fini de débattre ✋',
    wait: 'Patiente…',
    dead: 'Tu es éliminé. Chut, ne dis rien ! 🤐',
    hide: 'Cacher mon rôle',
    show: 'Voir mon rôle',
    sniffed: 'Reniflés : ',
  },
  en: {
    role: { gourmand: 'Foodie 😇', pique: 'Moocher 😈', gouteur: 'Taster 👃', glouton: 'Glutton 🤤' },
    goal: {
      gourmand: 'Find the Moochers and vote them out.',
      pique: 'Raid the fridge without getting caught. Lie!',
      gouteur: 'Each night, sniff a player to learn if they are a Moocher.',
      glouton: 'You play alone: get voted out and you win. Act suspicious!',
    },
    mates: 'Your partners: ',
    kill: 'Who ends up head-first in the fridge?',
    sniff: 'Who do you want to sniff?',
    vote: 'Who gets kicked out?',
    ready: 'Done debating ✋',
    wait: 'Wait…',
    dead: 'You’re out. Shh, don’t say a word! 🤐',
    hide: 'Hide my role',
    show: 'Show my role',
    sniffed: 'Sniffed: ',
  },
};

/** Manette du Traître du Frigo : rôle secret (masquable) et choix du moment. */
export function TraitorPad({ data, lang, send }: { data: TraitorPadData; lang: Lang; send: (m: ToTv) => void }) {
  const T = TXT[lang];
  const [hidden, setHidden] = useState(false);
  const pick = (i: number) => {
    if (navigator.vibrate) navigator.vibrate(20);
    send({ t: 'act', a: 'pick', n: [i] });
  };
  return (
    <div className="traitor">
      <button className={`role-card ${data.role} ${hidden ? 'hidden' : ''}`} onClick={() => setHidden((h) => !h)}>
        {hidden ? (
          <b>{T.show}</b>
        ) : (
          <>
            <b>{T.role[data.role]}</b>
            <small>{T.goal[data.role]}</small>
            {data.mates.length > 0 && (
              <small>
                {T.mates}
                {data.mates.join(', ')}
              </small>
            )}
            {data.info && (
              <small>
                {T.sniffed}
                {data.info}
              </small>
            )}
            <em>{T.hide}</em>
          </>
        )}
      </button>

      {!data.alive ? (
        <p className="pad-title">{T.dead}</p>
      ) : data.act === 'ready' ? (
        <button className="btn big" onClick={() => send({ t: 'act', a: 'ready' })}>
          {T.ready}
        </button>
      ) : data.act ? (
        <>
          <p className="pad-title">{T[data.act]}</p>
          <div className="choices">
            {data.options.map((o) => (
              <button
                key={o.i}
                className={`choice ${data.picked === o.i ? 'on' : ''}`}
                style={{ ['--c' as string]: o.color }}
                onClick={() => pick(o.i)}
              >
                {o.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="pad-title pulse">{T.wait}</p>
      )}
    </div>
  );
}
