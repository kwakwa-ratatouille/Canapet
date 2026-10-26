import { useEffect, useRef, useState } from 'react';
import { t } from '../shared/i18n';
import type { Lang, ToTv } from '../shared/protocol';

const LABELS: Record<string, Record<Lang, [string, string]>> = {
  obstacles: { fr: ['SAUT', 'PLONGE'], en: ['JUMP', 'DIVE'] },
};

/** Manette « stick + 2 boutons » : le stick apparaît là où le pouce se pose. */
export function Stick({ send, lang, game }: { send: (m: ToTv) => void; lang: Lang; game?: string }) {
  const [la, lb] = LABELS[game ?? '']?.[lang] ?? ['A', 'B'];
  const state = useRef({ x: 0, y: 0, a: false, b: false });
  const [knob, setKnob] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null);
  const [pressed, setPressed] = useState({ a: false, b: false });
  const stickId = useRef<number | null>(null);
  const lastSent = useRef(0);
  const R = 60;

  const flush = (force = false) => {
    const now = performance.now();
    if (!force && now - lastSent.current < 33) return;
    lastSent.current = now;
    const s = state.current;
    send({ t: 'in', x: +s.x.toFixed(2), y: +s.y.toFixed(2), a: s.a, b: s.b });
  };

  // Renvoi régulier : si un message se perd, l'état se recale tout seul.
  useEffect(() => {
    const id = setInterval(() => flush(true), 150);
    return () => clearInterval(id);
  });

  const down = (e: React.PointerEvent) => {
    if (stickId.current !== null) return;
    stickId.current = e.pointerId;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* certains navigateurs refusent : le stick marche quand même */
    }
    setKnob({ ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
  };
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== stickId.current || !knob) return;
    let dx = e.clientX - knob.ox;
    let dy = e.clientY - knob.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setKnob({ ...knob, x: dx, y: dy });
    state.current.x = dx / R;
    state.current.y = dy / R;
    flush();
  };
  const up = (e: React.PointerEvent) => {
    if (e.pointerId !== stickId.current) return;
    stickId.current = null;
    setKnob(null);
    state.current.x = 0;
    state.current.y = 0;
    flush(true);
  };
  const btn = (k: 'a' | 'b', v: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    state.current[k] = v;
    setPressed((p) => ({ ...p, [k]: v }));
    if (v && navigator.vibrate) navigator.vibrate(10);
    flush(true);
  };

  return (
    <div className="stick-pad">
      <div className="rotate-hint">📱↻ {t(lang, 'rotate')}</div>
      <div className="stick-zone" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {knob ? (
          <div className="stick-base" style={{ left: knob.ox, top: knob.oy }}>
            <div className="stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
          </div>
        ) : (
          <div className="stick-ghost">🕹️</div>
        )}
      </div>
      <div className="ab">
        <button className={`ab-btn b ${pressed.b ? 'down' : ''}`} onPointerDown={btn('b', true)} onPointerUp={btn('b', false)} onPointerCancel={btn('b', false)}>
          {lb}
        </button>
        <button className={`ab-btn a ${pressed.a ? 'down' : ''}`} onPointerDown={btn('a', true)} onPointerUp={btn('a', false)} onPointerCancel={btn('a', false)}>
          {la}
        </button>
      </div>
    </div>
  );
}
