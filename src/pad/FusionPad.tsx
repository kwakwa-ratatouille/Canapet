// Manette de La Bataille des Fusions : le bac de ton équipe en petit. À ton tour, glisse le doigt pour viser, lève-le pour lâcher.
import { useEffect, useRef, useState } from 'react';
import { FUSION_COLORS, FUSION_EMOJI, FUSION_H, FUSION_R, FUSION_W, type FusionPadData } from '../games/fusionShared';
import type { Lang, ToTv } from '../shared/protocol';

export function FusionPad({ data, lang, send }: { data: FusionPadData; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef(data);
  latest.current = data;
  const [finger, setFinger] = useState<number | null>(null);
  const fingerRef = useRef<number | null>(null);
  fingerRef.current = finger;
  const lastSend = useRef(0);
  const wasMine = useRef(false);

  // Ton tour arrive : on vibre
  useEffect(() => {
    if (data.mine && !wasMine.current) navigator.vibrate?.([40, 40, 80]);
    wasMine.current = data.mine;
    if (!data.mine) setFinger(null);
  }, [data.mine]);

  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    let raf = 0;
    const draw = () => {
      const d = latest.current;
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(r.width * dpr)) {
        cv.width = Math.round(r.width * dpr);
        cv.height = Math.round(r.height * dpr);
      }
      const k = (r.width / FUSION_W) * dpr;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, FUSION_W, FUSION_H);
      g.strokeStyle = '#ff4f9a';
      g.lineWidth = 6;
      g.setLineDash([22, 16]);
      g.beginPath();
      g.moveTo(0, 90);
      g.lineTo(FUSION_W, 90);
      g.stroke();
      g.setLineDash([]);
      const disc = (x: number, y: number, l: number, rad: number) => {
        if (l < 0) {
          g.font = `${rad * 1.7}px sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('🧦', x, y);
          return;
        }
        g.fillStyle = FUSION_COLORS[l];
        g.strokeStyle = '#3a2140';
        g.lineWidth = 5;
        g.beginPath();
        g.arc(x, y, rad, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.font = `${rad * 1.15}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#000';
        g.fillText(FUSION_EMOJI[l], x, y + rad * 0.06);
      };
      for (const [x, y, l] of d.balls) disc(x, y, l, l < 0 ? 40 : FUSION_R[l]);
      if (d.fog) {
        g.fillStyle = 'rgba(232,236,242,.93)';
        g.fillRect(0, 120, FUSION_W, FUSION_H - 240);
      }
      // La visée : celle du doigt à ton tour, sinon celle du joueur de l'équipe
      const own = fingerRef.current;
      const raw = own !== null ? own : (d.aim / 1000) * FUSION_W;
      const nr = FUSION_R[d.next];
      const ax = Math.max(nr, Math.min(FUSION_W - nr, own !== null && d.flip ? FUSION_W - raw : raw));
      g.strokeStyle = 'rgba(58,33,64,.3)';
      g.lineWidth = 5;
      g.setLineDash([10, 12]);
      g.beginPath();
      g.moveTo(ax, 34);
      g.lineTo(ax, FUSION_H);
      g.stroke();
      g.setLineDash([]);
      disc(ax, 34, d.next, nr);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const xOf = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };
  return (
    <div className={`fusion-pad ${data.mine ? 'mine' : ''}`} style={{ ['--c' as string]: data.color }}>
      <p className="fusion-top">
        <b>{data.team}</b>
        <span>{data.score} · {data.other}</span>
      </p>
      <p className="fusion-turn">{data.banner || (data.mine ? (fr ? `👆 À toi ! Glisse et lève le doigt (${data.left})` : `👆 Your turn! Slide and lift your finger (${data.left})`) : fr ? `Au tour de ${data.who}…` : `${data.who}’s turn…`)}</p>
      <div
        className="fusion-board"
        style={{ aspectRatio: `${FUSION_W} / ${FUSION_H}` }}
        onPointerDown={(e) => {
          if (!data.mine) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setFinger(xOf(e) * FUSION_W);
        }}
        onPointerMove={(e) => {
          if (finger === null) return;
          const x = xOf(e);
          setFinger(x * FUSION_W);
          const now = performance.now();
          if (now - lastSend.current > 70) {
            lastSend.current = now;
            send({ t: 'act', a: 'aim', n: [Math.round(x * 1000)] });
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
        <canvas ref={ref} />
      </div>
    </div>
  );
}
