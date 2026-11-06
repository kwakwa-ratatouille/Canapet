// Manette de La Bataille des Fusions : on regarde le bac sur la télé. Le téléphone sert juste à viser :
// tout l'écran est une barre, l'aliment suit le doigt, et lever le doigt le lâche.
import { useEffect, useRef, useState } from 'react';
import { FUSION_COLORS, FUSION_EMOJI, type FusionPadData } from '../games/fusionShared';
import type { Lang, ToTv } from '../shared/protocol';

export function FusionPad({ data, lang, send }: { data: FusionPadData; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  const [finger, setFinger] = useState<number | null>(null);
  const lastSend = useRef(0);

  // Ton tour arrive : on vibre. Ton tour s'arrête : on oublie le doigt.
  useEffect(() => {
    if (data.mine) navigator.vibrate?.([40, 40, 80]);
    else setFinger(null);
  }, [data.mine]);

  /** Position du doigt de 0 à 1, même quand la manette est affichée tournée. */
  const xOf = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const turned = !!el.closest('.pad.turn') && window.matchMedia('(orientation: portrait)').matches;
    const k = turned ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    return Math.max(0, Math.min(1, k));
  };
  const aim = (x: number) => send({ t: 'act', a: 'aim', n: [Math.round(x * 1000)] });

  return (
    <div className={`fusion-pad ${data.mine ? 'mine' : ''}`} style={{ ['--c' as string]: data.color }}>
      <p className="fusion-top">
        <b>{data.team}</b>
        <span>{data.score} · {data.other}</span>
      </p>
      <div
        className="fusion-zone"
        onPointerDown={(e) => {
          if (!data.mine) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const x = xOf(e);
          setFinger(x);
          aim(x);
        }}
        onPointerMove={(e) => {
          if (finger === null) return;
          const x = xOf(e);
          setFinger(x);
          const now = performance.now();
          if (now - lastSend.current > 60) {
            lastSend.current = now;
            aim(x);
          }
        }}
        onPointerUp={(e) => {
          if (finger === null) return;
          send({ t: 'act', a: 'drop', n: [Math.round(xOf(e) * 1000)] });
          setFinger(null);
          navigator.vibrate?.(20);
        }}
        onPointerCancel={() => setFinger(null)}
      >
        <p className="fusion-turn">
          {data.banner ||
            (data.mine
              ? fr
                ? `👆 À toi ! Regarde la télé, glisse, lève le doigt (${data.left})`
                : `👆 Your turn! Watch the TV, slide, lift your finger (${data.left})`
              : fr
                ? `📺 Au tour de ${data.who}…`
                : `📺 ${data.who}’s turn…`)}
        </p>
        {data.mine && (
          <div className="fusion-rail">
            <i className="fusion-piece" style={{ left: `${(finger ?? 0.5) * 100}%`, background: FUSION_COLORS[data.next] }}>
              {FUSION_EMOJI[data.next]}
            </i>
          </div>
        )}
      </div>
    </div>
  );
}
