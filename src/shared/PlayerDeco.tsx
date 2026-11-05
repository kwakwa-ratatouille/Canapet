// Cadres photo, styles de nom et titres : affichés au salon, aux résultats, au podium et dans l'éditeur.
import type { CSSProperties } from 'react';
import { FRAMES, PLATES, TITLES } from './cosmetics2';
import { LIGHT } from './device';
import type { Lang } from './protocol';
import './deco.css';

/** À poser dans un élément en position relative : un anneau rond, de la hauteur de l'élément. `still` : immobile (vignettes). */
export function PlayerFrame({ id, inset = -6, still }: { id?: string; inset?: number; still?: boolean }) {
  const f = FRAMES.find((x) => x.id === id);
  if (!f?.ring) return null;
  const on = still || LIGHT ? '' : 'on';
  const bg = `conic-gradient(${f.ring.join(',')})`;
  const dur = `${f.spin ?? 3}s`;
  return (
    <span className={`pf pf-${f.r}`} style={{ top: inset, bottom: inset }} aria-hidden="true">
      <i className={`pf-ring ${on}`} style={{ background: bg, animationDuration: dur }} />
      {(f.r === 'legendaire' || f.r === 'mythique') && <i className={`pf-ring2 ${on}`} style={{ background: bg, animationDuration: dur }} />}
    </span>
  );
}

/** Nom du joueur avec son style. */
export function PlateName({ name, plate }: { name: string; plate?: string }) {
  const p = PLATES.find((x) => x.id === plate);
  if (!p) return <>{name}</>;
  return (
    <span className={`np ${p.speed && !LIGHT ? 'on' : ''}`} style={{ backgroundImage: `linear-gradient(90deg,${p.colors.join(',')})`, animationDuration: `${p.speed ?? 3}s` }}>
      {name}
    </span>
  );
}

/** Titre sous le nom. */
export function PlayerTitle({ id, lang }: { id?: string; lang: Lang }) {
  const t = TITLES.find((x) => x.id === id);
  return t ? <small className="p-title">« {t.name[lang]} »</small> : null;
}
