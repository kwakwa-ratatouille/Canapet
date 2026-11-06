// Manette du Gâteau qui Penche : un seul gros bouton, qui part dès que le doigt touche (le moment compte).
import type { CakePadData } from '../games/cakeShared';
import type { Lang, ToTv } from '../shared/protocol';

export function CakePad({ data, lang, send }: { data: CakePadData; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  return (
    <div className="traitor cake-pad" style={{ ['--c' as string]: data.color }}>
      <p className="pad-title">🎂 {data.floors} {fr ? (data.floors > 1 ? 'étages' : 'étage') : data.floors === 1 ? 'layer' : 'layers'} · ⭐ {data.score}</p>
      {data.combo >= 2 && !data.done && <p className="pad-small">🔥 {fr ? 'Parfaits de suite' : 'Perfects in a row'} : {data.combo}</p>}
      {data.done ? (
        <p className="pad-title">{fr ? 'Ton gâteau est fini ! Regarde les autres 👀' : 'Your cake is done! Watch the others 👀'}</p>
      ) : (
        <button
          className="cake-btn"
          onPointerDown={(e) => {
            e.preventDefault();
            navigator.vibrate?.(15);
            send({ t: 'act', a: 'pose' });
          }}
        >
          {fr ? 'POSE !' : 'DROP!'}
        </button>
      )}
    </div>
  );
}
