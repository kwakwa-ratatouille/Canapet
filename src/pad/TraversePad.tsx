// Manette de Traverse Pas Ici ! : quatre gros boutons en croix, un appui = une case. Le bouton du milieu pousse les voisins.
import type { TraversePadData } from '../games/traverse';
import type { Lang, ToTv } from '../shared/protocol';

export function TraversePad({ data, lang, send }: { data: TraversePadData; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  const press = (m: ToTv, ms = 15) => (e: React.PointerEvent) => {
    e.preventDefault();
    navigator.vibrate?.(ms);
    send(m);
  };
  const hop = (dx: number, dy: number) => press({ t: 'act', a: 'hop', n: [dx, dy] });
  return (
    <div className="trav-pad" style={{ ['--c' as string]: data.color }}>
      <p className="trav-top">
        <span>{'❤️'.repeat(Math.max(0, data.lives))}</span>
        <span>⭐ {data.score}</span>
      </p>
      {data.alive ? (
        <div className="trav-cross">
          <button className="trav-btn up" onPointerDown={hop(0, 1)}>
            ⬆️<small>{fr ? 'Avance' : 'Forward'}</small>
          </button>
          <button className="trav-btn left" onPointerDown={hop(-1, 0)}>⬅️</button>
          <button className="trav-btn push" onPointerDown={press({ t: 'act', a: 'push' }, 40)}>
            👊<small>{fr ? 'Pousse' : 'Shove'}</small>
          </button>
          <button className="trav-btn right" onPointerDown={hop(1, 0)}>➡️</button>
          <button className="trav-btn down" onPointerDown={hop(0, -1)}>⬇️</button>
        </div>
      ) : (
        <p className="pad-title">{fr ? 'Plus de vies ! Regarde les autres 👀' : 'No lives left! Watch the others 👀'}</p>
      )}
    </div>
  );
}
