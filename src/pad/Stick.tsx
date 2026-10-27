import { useEffect, useRef, useState } from 'react';
import { t } from '../shared/i18n';
import type { Lang, ToTv } from '../shared/protocol';

const LABELS: Record<string, Record<Lang, [string, string]>> = {
  obstacles: { fr: ['SAUT', 'PLONGE'], en: ['JUMP', 'DIVE'] },
  sumo: { fr: ['TURBO', 'ANCRE'], en: ['BOOST', 'ANCHOR'] },
  bombes: { fr: ['PÉTARD', 'POUSSE'], en: ['BOMB', 'KICK'] },
  kart: { fr: ['OBJET', 'FREIN'], en: ['ITEM', 'BRAKE'] },
  archers: { fr: ['SAUT', 'TIR'], en: ['JUMP', 'SHOOT'] },
  combat: { fr: ['SAUT', 'COUP'], en: ['JUMP', 'HIT'] },
  bagarre: { fr: ['SAUT', 'BAFFE'], en: ['JUMP', 'SLAP'] },
  cuisine: { fr: ['PRENDRE', 'COUPER'], en: ['GRAB', 'CHOP'] },
};

/**
 * Position d'un doigt dans le repère de la manette. Quand la manette est tournée
 * (téléphone tenu droit, écran affiché en paysage), l'axe x de la manette descend l'écran.
 */
function toPad(el: HTMLElement, cx: number, cy: number): { x: number; y: number } {
  const pad = el.closest('.pad') as HTMLElement | null;
  const turned = !!pad && pad.classList.contains('turn') && matchMedia('(orientation: portrait)').matches;
  if (!turned) {
    const r = el.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  }
  // Décalage de la zone dans la manette (repère non tourné)
  let ox = 0;
  let oy = 0;
  for (let n: HTMLElement | null = el; n && n !== pad; n = n.offsetParent as HTMLElement | null) {
    ox += n.offsetLeft;
    oy += n.offsetTop;
  }
  return { x: cy - ox, y: window.innerWidth - cx - oy };
}

/** Manette « stick + 2 boutons » : le stick apparaît là où le pouce se pose. */
export function Stick({ send, lang, game }: { send: (m: ToTv) => void; lang: Lang; game?: string }) {
  const [la, lb] = LABELS[game ?? '']?.[lang] ?? ['A', 'B'];
  const state = useRef({ x: 0, y: 0, a: false, b: false });
  // Le stick est visible au repos ; s'il est touché ailleurs, il vient sous le pouce.
  const [knob, setKnob] = useState({ ox: 0, oy: 0, x: 0, y: 0, on: false });
  const zone = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [pressed, setPressed] = useState({ a: false, b: false });
  const stickId = useRef<number | null>(null);
  const lastSent = useRef(0);
  const R = 62;

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
    const z = zone.current!;
    const p = toPad(z, e.clientX, e.clientY);
    const restX = z.offsetWidth * 0.45;
    const restY = z.offsetHeight * 0.55;
    // Pouce posé sur le stick : on le prend tel quel ; ailleurs, le stick vient sous le pouce.
    const near = Math.hypot(p.x - restX, p.y - restY) < R * 1.6;
    const ox = near ? restX : p.x;
    const oy = near ? restY : p.y;
    origin.current = { x: ox, y: oy };
    apply(p.x - ox, p.y - oy, ox, oy);
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
    const p = toPad(zone.current!, e.clientX, e.clientY);
    apply(p.x - origin.current.x, p.y - origin.current.y, origin.current.x, origin.current.y);
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
      <div ref={zone} className="stick-zone" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div
          className={`stick-base ${knob.on ? 'on' : ''}`}
          style={knob.on ? { left: knob.ox, top: knob.oy } : { left: '45%', top: '55%' }}
        >
          <svg className="stick-arrows" viewBox="0 0 100 100" aria-hidden>
            {[0, 90, 180, 270].map((a) => (
              <path key={a} d="M50 7 L60 19 L40 19 Z" transform={`rotate(${a} 50 50)`} />
            ))}
          </svg>
          <div className="stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
        {!knob.on && <span className="stick-hint">{t(lang, 'stickHint')}</span>}
      </div>
      <div className="ab">
        <button className={`ab-btn b ${pressed.b ? 'down' : ''}`} onPointerDown={btn('b', true)} onPointerUp={btn('b', false)} onPointerCancel={btn('b', false)}>
          <i>B</i>
          {lb}
        </button>
        <button className={`ab-btn a ${pressed.a ? 'down' : ''}`} onPointerDown={btn('a', true)} onPointerUp={btn('a', false)} onPointerCancel={btn('a', false)}>
          <i>A</i>
          {la}
        </button>
      </div>
    </div>
  );
}
