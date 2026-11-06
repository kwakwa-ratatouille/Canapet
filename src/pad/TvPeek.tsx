// Jouer sans télé : l'écran du jeu, en petit au-dessus de la manette. Le toucher l'agrandit.
import { useEffect, useState } from 'react';
import { PEEK_FOLDED, noTvState, watchShot } from '../shared/noTv';
import type { Lang } from '../shared/protocol';

export function TvPeek({ game, lang }: { game: string; lang: Lang }) {
  const fr = lang === 'fr';
  const [shot, setShot] = useState(noTvState.shot);
  const [big, setBig] = useState(false);
  useEffect(() => watchShot(() => setShot(noTvState.shot)), []);
  if (!shot) return null;
  if (big)
    return (
      <button className="tv-peek-full" onClick={() => setBig(false)} aria-label={fr ? 'Réduire' : 'Shrink'}>
        <img src={shot} alt="" />
      </button>
    );
  if (PEEK_FOLDED.includes(game))
    return (
      <button className="tv-peek-pill" onClick={() => setBig(true)}>
        📺 {fr ? 'Voir l’écran du jeu' : 'See the game screen'}
      </button>
    );
  return (
    <button className="tv-peek" onClick={() => setBig(true)} aria-label={fr ? 'Agrandir' : 'Enlarge'}>
      <img src={shot} alt="" />
      <small>🔍</small>
    </button>
  );
}
