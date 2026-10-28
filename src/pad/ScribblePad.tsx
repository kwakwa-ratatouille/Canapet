import { useEffect, useRef, useState } from 'react';
import { INK_COLORS, type ScribblePadData } from '../games/scribbleShared';
import type { Lang, ToTv } from '../shared/protocol';

const RATIO = 1160 / 790;
const SIZES = [6, 14, 30];

const TXT = {
  fr: {
    draw: 'Dessine :',
    guessWho: '{name} dessine…',
    placeholder: 'Ta réponse',
    send: 'Envoyer',
    found: 'Bravo, trouvé ! 🎉',
    wait: 'Le mot était : {word}',
    undo: '↶',
    clear: '🗑',
    skip: 'Passer',
  },
  en: {
    draw: 'Draw:',
    guessWho: '{name} is drawing…',
    placeholder: 'Your guess',
    send: 'Send',
    found: 'You got it! 🎉',
    wait: 'The word was: {word}',
    undo: '↶',
    clear: '🗑',
    skip: 'Skip',
  },
};

export function ScribblePad({ data, lang, send }: { data: ScribblePadData; lang: Lang; send: (m: ToTv) => void }) {
  const T = TXT[lang];
  if (data.role === 'draw') return <DrawBoard data={data} send={send} T={T} />;
  if (data.role === 'wait')
    return (
      <div className="scribble center">
        <p className="pad-title">{T.wait.replace('{word}', data.word)}</p>
      </div>
    );
  return <GuessBox data={data} send={send} T={T} />;
}

function GuessBox({ data, send, T }: { data: ScribblePadData; send: (m: ToTv) => void; T: (typeof TXT)['fr'] }) {
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    send({ t: 'act', a: 'guess', s: text.trim() });
    setText('');
  };
  return (
    <div className="scribble center">
      <p className="pad-small">{T.guessWho.replace('{name}', data.drawer)}</p>
      <p className="scribble-hint">{data.hint}</p>
      {data.found ? (
        <p className="pad-title">{T.found}</p>
      ) : (
        <>
          <div className="row guess-row">
            <input
              value={text}
              maxLength={40}
              placeholder={T.placeholder}
              autoComplete="off"
              autoCorrect="off"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <button className="btn" onClick={submit}>
              {T.send}
            </button>
          </div>
          {data.note && <p className="pad-title note">{data.note}</p>}
        </>
      )}
    </div>
  );
}

function DrawBoard({ data, send, T }: { data: ScribblePadData; send: (m: ToTv) => void; T: (typeof TXT)['fr'] }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(0);
  const [size, setSize] = useState(1);
  const strokes = useRef<{ c: number; w: number; pts: number[] }[]>([]);
  const buf = useRef<number[]>([]);
  const drawing = useRef<number | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 300, h: 300 / RATIO });

  const redraw = () => {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of strokes.current) {
      g.strokeStyle = INK_COLORS[s.c];
      g.lineWidth = (s.w * c.width) / 1000;
      g.beginPath();
      for (let k = 0; k < s.pts.length; k += 2) {
        const x = (s.pts[k] / 1000) * c.width;
        const y = (s.pts[k + 1] / 1000) * c.height;
        if (k) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      if (s.pts.length === 2) g.lineTo((s.pts[0] / 1000) * c.width + 0.1, (s.pts[1] / 1000) * c.height);
      g.stroke();
    }
  };

  useEffect(() => {
    const c = cv.current!;
    // La planche prend toute la place libre en gardant exactement la forme du tableau de la télé
    const fit = () => {
      const a = area.current!.getBoundingClientRect();
      const w = Math.max(100, Math.min(a.width, a.height * RATIO));
      const h = w / RATIO;
      setBox({ w, h });
      c.width = w * Math.min(2, devicePixelRatio || 1);
      c.height = h * Math.min(2, devicePixelRatio || 1);
      redraw();
    };
    fit();
    window.addEventListener('resize', fit);
    // Les points sont envoyés par paquets, 20 fois par seconde.
    const id = setInterval(() => {
      if (buf.current.length) {
        send({ t: 'act', a: 'p', n: buf.current });
        buf.current = [];
      }
    }, 50);
    return () => {
      window.removeEventListener('resize', fit);
      clearInterval(id);
    };
  }, []);

  // Nouveau mot : planche vierge.
  useEffect(() => {
    strokes.current = [];
    redraw();
  }, [data.word]);

  const pos = (e: { clientX: number; clientY: number }) => {
    const r = cv.current!.getBoundingClientRect();
    const k = (v: number) => Math.max(0, Math.min(1000, Math.round(v * 1000)));
    return [k((e.clientX - r.left) / r.width), k((e.clientY - r.top) / r.height)];
  };
  const down = (e: React.PointerEvent) => {
    // Un seul doigt à la fois (la paume ou un 2e doigt ne font pas de traits parasites)
    if (drawing.current !== null || !e.isPrimary) return;
    drawing.current = e.pointerId;
    cv.current!.setPointerCapture(e.pointerId);
    const [x, y] = pos(e);
    if (buf.current.length) {
      send({ t: 'act', a: 'p', n: buf.current });
      buf.current = [];
    }
    strokes.current.push({ c: color, w: SIZES[size], pts: [x, y] });
    send({ t: 'act', a: 's', n: [color, SIZES[size], x, y] });
    redraw();
  };
  const move = (e: React.PointerEvent) => {
    if (drawing.current !== e.pointerId) return;
    const s = strokes.current[strokes.current.length - 1];
    if (!s) return;
    // Tous les points intermédiaires (traits plus fidèles quand on dessine vite)
    const evs = (e.nativeEvent.getCoalescedEvents?.() ?? []) as PointerEvent[];
    for (const ev of evs.length ? evs : [e.nativeEvent]) {
      const [x, y] = pos(ev);
      const lx = s.pts[s.pts.length - 2];
      const ly = s.pts[s.pts.length - 1];
      if (Math.abs(x - lx) + Math.abs(y - ly) < 3 || s.pts.length >= 3990) continue;
      s.pts.push(x, y);
      buf.current.push(x, y);
    }
    redraw();
  };
  const up = (e: React.PointerEvent) => {
    if (drawing.current !== e.pointerId) return;
    drawing.current = null;
    if (buf.current.length) {
      send({ t: 'act', a: 'p', n: buf.current });
      buf.current = [];
    }
    // Le trait entier part une 2e fois : la télé affiche exactement ce qui est dessiné
    const i = strokes.current.length - 1;
    const s = strokes.current[i];
    if (s) send({ t: 'act', a: 'S', n: [i, s.c, s.w, ...s.pts] });
  };

  return (
    <div className="scribble">
      <p className="scribble-word">
        {T.draw} <b>{data.word}</b>
      </p>
      <div className="scribble-area" ref={area}>
        <canvas
          ref={cv}
          className="scribble-canvas"
          style={{ width: box.w, height: box.h }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>
      <div className="scribble-tools">
        {INK_COLORS.map((c, k) => (
          <button key={c} className={`dot ${color === k ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(k)} aria-label={c} />
        ))}
      </div>
      <div className="scribble-tools">
        {SIZES.map((s, k) => (
          <button key={s} className={`chip txt ${size === k ? 'on' : ''}`} onClick={() => setSize(k)}>
            <span className="size-dot" style={{ width: s / 1.5 + 4, height: s / 1.5 + 4 }} />
          </button>
        ))}
        <button
          className="chip txt"
          onClick={() => {
            strokes.current.pop();
            redraw();
            send({ t: 'act', a: 'undo' });
          }}
        >
          {T.undo}
        </button>
        <button
          className="chip txt"
          onClick={() => {
            strokes.current = [];
            redraw();
            send({ t: 'act', a: 'clear' });
          }}
        >
          {T.clear}
        </button>
      </div>
    </div>
  );
}
