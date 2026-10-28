import { useEffect, useRef, useState } from 'react';
import { t } from '../shared/i18n';
import { ordinal } from '../shared/i18n';
import type { Lang, Profile, ToTv } from '../shared/protocol';

/** Rôle des boutons A, B, X, Y selon le jeu (X et Y n'apparaissent que s'ils servent). */
const LABELS: Record<string, Record<Lang, [string, string, string?, string?]>> = {
  obstacles: { fr: ['SAUT', 'PLONGE'], en: ['JUMP', 'DIVE'] },
  sumo: { fr: ['TURBO', 'ANCRE'], en: ['BOOST', 'ANCHOR'] },
  bombes: { fr: ['PÉTARD', 'POUSSE'], en: ['BOMB', 'KICK'] },
  kart: { fr: ['OBJET', 'FREIN', 'POUET'], en: ['ITEM', 'BRAKE', 'HONK'] },
  archers: { fr: ['SAUT', 'TIR', 'ESQUIVE'], en: ['JUMP', 'SHOOT', 'DODGE'] },
  combat: { fr: ['SAUT', 'COUP', 'LOURD', 'ESQUIVE'], en: ['JUMP', 'HIT', 'HEAVY', 'DODGE'] },
  bagarre: { fr: ['SAUT', 'BAFFE', 'ATTRAPE', 'CHARGE'], en: ['JUMP', 'SLAP', 'GRAB', 'CHARGE'] },
  foot: { fr: ['TIR', 'SPRINT', 'ATTRAPE'], en: ['SHOOT', 'SPRINT', 'CATCH'] },
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

/** Boutons en recharge : moment du début et durée (s). */
export type Cools = Partial<Record<'a' | 'b' | 'c' | 'd', { at: number; s: number }>>;

/** Manette « stick + 2 boutons » : le stick apparaît là où le pouce se pose. */
export function Stick({
  send,
  lang,
  game,
  profile,
  live,
  cools,
}: {
  send: (m: ToTv) => void;
  lang: Lang;
  game?: string;
  profile?: Profile;
  live?: { rank: number; of: number; left: number | null } | null;
  cools?: Cools;
}) {
  // Recharge : on redessine tant qu'un bouton recharge
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!cools || !Object.values(cools).some((c) => c && performance.now() < c.at + c.s * 1000)) return;
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cools]);
  const [la, lb, lx, ly] = LABELS[game ?? '']?.[lang] ?? ['A', 'B'];
  const state = useRef({ x: 0, y: 0, a: false, b: false, c: false, d: false });
  // Le stick est visible au repos ; s'il est touché ailleurs, il vient sous le pouce.
  const [knob, setKnob] = useState({ ox: 0, oy: 0, x: 0, y: 0, on: false });
  const zone = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [pressed, setPressed] = useState({ a: false, b: false, c: false, d: false });
  const stickId = useRef<number | null>(null);
  const lastSent = useRef(0);
  const R = 46;

  const pending = useRef(0);
  const flush = (force = false) => {
    const now = performance.now();
    if (!force && now - lastSent.current < 33) {
      // Trop tôt : on envoie quand même la dernière position juste après (sinon elle attendait 150 ms)
      if (!pending.current) pending.current = window.setTimeout(() => {
        pending.current = 0;
        flush(true);
      }, 33 - (now - lastSent.current));
      return;
    }
    if (pending.current) {
      clearTimeout(pending.current);
      pending.current = 0;
    }
    lastSent.current = now;
    const s = state.current;
    send({ t: 'in', x: +s.x.toFixed(2), y: +s.y.toFixed(2), a: s.a, b: s.b, c: s.c, d: s.d });
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
  const btn = (k: 'a' | 'b' | 'c' | 'd', v: boolean) => (e: React.PointerEvent) => {
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
      <div className="stick-mid" style={{ ['--pc' as string]: profile?.color }}>
        {live && live.of > 1 && (
          <span className={`mid-rank r${Math.min(4, live.rank)}`}>
            {live.rank === 1 && <i>👑</i>}
            <b>{ordinal(lang, live.rank)}</b>
            <small>/ {live.of}</small>
          </span>
        )}
        {live?.left != null && (
          <span className={`mid-time ${live.left <= 10 ? 'hot' : ''}`}>
            <small>⏱</small>
            {Math.floor(live.left / 60)}:{String(live.left % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="ab four">
        <div className="ab-cluster">
        {(
          [
            ['c', 'X', lx],
            ['d', 'Y', ly],
            ['b', 'B', lb],
            ['a', 'A', la],
          ] as const
        ).map(([k, letter, label]) => {
          const c = cools?.[k];
          const left = c ? Math.max(0, c.at + c.s * 1000 - now) / 1000 : 0;
          return (
            <button
              key={k}
              disabled={!label}
              className={`ab-btn ${k} ${pressed[k] ? 'down' : ''} ${label ? '' : 'off'} ${left > 0 ? 'cooling' : ''}`}
              onPointerDown={btn(k, true)}
              onPointerUp={btn(k, false)}
              onPointerCancel={btn(k, false)}
            >
              <i>{letter}</i>
              {label && <small>{label}</small>}
              {left > 0 && (
                <span className="ab-cool" style={{ ['--p' as string]: `${(left / c!.s) * 360}deg` }}>
                  <b>{left >= 1 ? Math.ceil(left) : left.toFixed(1)}</b>
                </span>
              )}
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
