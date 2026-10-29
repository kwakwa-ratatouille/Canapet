// Bouton 😂 de la manette : ouvre la liste des réactions qui s'envolent sur la télé.
import { useState } from 'react';
import type { Lang, SecretInfo, ToTv } from '../shared/protocol';
import { REACTIONS } from '../shared/reactions';

export function ReactButton({ lang, family, send, inline }: { lang: Lang; family: boolean; send: (m: ToTv) => void; inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const fr = lang === 'fr';
  return (
    <>
      <button className={`react-fab ${inline ? 'inline' : ''}`} onClick={() => setOpen(true)} aria-label={fr ? 'Réactions' : 'Reactions'}>
        😂
      </button>
      {open && (
        <div className="react-sheet" onPointerDown={(e) => e.stopPropagation()}>
          <header>
            <span>{fr ? 'Balance une réaction sur la télé !' : 'Throw a reaction on the TV!'}</span>
            <button className="pill" onClick={() => setOpen(false)}>
              ✕
            </button>
          </header>
          <div className="react-grid">
            {REACTIONS.map((r, i) =>
              family && r.rude ? null : (
                <button
                  key={i}
                  className={r.txt ? 'txt' : ''}
                  onClick={() => {
                    send({ t: 'react', i });
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                >
                  {r.txt ? r.txt[lang] : r.e}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Le défi secret du tournoi, visible seulement sur ton téléphone. */
export function SecretCard({ secret, lang }: { secret?: SecretInfo; lang: Lang }) {
  if (!secret) return null;
  const fr = lang === 'fr';
  return (
    <div className={`secret-card ${secret.done ? 'done' : ''}`}>
      <small>
        🤫 {fr ? 'Ton défi secret' : 'Your secret mission'} · +{secret.bonus} pts {secret.done ? (fr ? '· RÉUSSI ✅' : '· DONE ✅') : secret.done === false ? '· ❌' : ''}
      </small>
      <p>{secret.text}</p>
    </div>
  );
}
