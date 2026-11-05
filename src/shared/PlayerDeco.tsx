// Cadres animés, styles de nom et titres : affichés au salon, aux résultats, au podium et dans l'éditeur.
import type { CSSProperties } from 'react';
import { FRAMES, PLATES, TITLES } from './cosmetics2';
import { LIGHT } from './device';
import type { Lang } from './protocol';
import './deco.css';

/** À poser dans un élément en position relative : l'anneau et les emojis en orbite tournent autour. */
export function PlayerFrame({ id, inset = -6 }: { id?: string; inset?: number }) {
  const f = FRAMES.find((x) => x.id === id);
  if (!f) return null;
  const still = LIGHT;
  return (
    <span className="pf" style={{ inset }} aria-hidden="true">
      {f.ring && <i className={`pf-ring ${still ? '' : 'on'}`} style={{ background: `conic-gradient(${f.ring.join(',')})`, animationDuration: `${f.spin ?? 3}s` }} />}
      {f.orbit && (
        <span className={`pf-orbit ${still ? '' : 'on'}`}>
          {f.orbit.map((e, i) => (
            <b key={i} style={{ ['--a' as string]: `${(i / f.orbit!.length) * 360}deg` } as CSSProperties}>{e}</b>
          ))}
        </span>
      )}
      {f.top && <em className={`pf-top ${still ? '' : 'on'}`}>{f.top}</em>}
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
