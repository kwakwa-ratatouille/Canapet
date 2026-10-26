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
  // Position du stick en % de la zone gauche : visible au repos, il suit le pouce s'il se pose ailleurs.
  const [knob, setKnob] = useState({ ox: 0, oy: 0, x: 0, y: 0, on: false });
  const zone = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [pressed, setPressed] = useState({ a: false, b: false });
  const stickId = useRef<number | null>(null);
  const lastSent = useRef(0);
  const R = 55;

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
    const r = zone.current!.getBoundingClientRect();
    const restX = r.left + r.width * 0.42;
    const restY = r.top + r.height * 0.58;
    // Pouce posé sur le stick : on le prend tel quel ; ailleurs, le stick vient sous le pouce.
    const near = Math.hypot(e.clientX - restX, e.clientY - restY) < R * 1.3;
    const ox = near ? restX : e.clientX;
    const oy = near ? restY : e.clientY;
    origin.current = { x: ox - r.left, y: oy - r.top };
    apply(e.clientX - ox, e.clientY - oy, ox - r.left, oy - r.top);
  };
  const apply = (dx: number, dy: number, ox: number, oy: number) => {
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setKnob({ ox, oy, x: dx, y: dy, on: true });
    state.current.x = dx / R;
    state.current.y = dy / R;
    flush();
  };
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== stickId.current) return;
    const r = zone.current!.getBoundingClientRect();
    apply(e.clientX - r.left - origin.current.x, e.clientY - r.top - origin.current.y, origin.current.x, origin.current.y);
  };
  const up = (e: React.PointerEvent) => {
    if (e.pointerId !== stickId.current) return;
    stickId.current = null;
    setKnob({ ox: 0, oy: 0, x: 0, y: 0, on: false });
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
      <div ref={zone} className="stick-zone" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div
          className={`stick-base ${knob.on ? 'on' : ''}`}
          style={knob.on ? { left: knob.ox, top: knob.oy } : { left: '42%', top: '58%' }}
        >
          <span className="arrow l">◀</span>
          <span className="arrow r">▶</span>
          <div className="stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
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
