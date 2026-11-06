// Manette de Tranche de Rire : tout le téléphone est l'écran de la télé en petit ; le doigt y laisse une traînée.
import { useEffect, useRef } from 'react';
import type { SlicePadData } from '../games/slice';
import type { Lang, ToTv } from '../shared/protocol';

export function SlicePad({ data, lang, send }: { data: SlicePadData; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  const ref = useRef<HTMLCanvasElement>(null);
  const color = useRef(data.color);
  color.current = data.color;
  const trail = useRef<{ x: number; y: number; at: number }[]>([]);
  const lastSend = useRef(0);

  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    let raf = 0;
    const draw = () => {
      const r = cv.getBoundingClientRect();
      if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) {
        cv.width = Math.round(r.width);
        cv.height = Math.round(r.height);
      }
      g.clearRect(0, 0, cv.width, cv.height);
      const now = performance.now();
      trail.current = trail.current.filter((p) => now - p.at < 220);
      if (trail.current.length > 1) {
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.strokeStyle = color.current;
        g.lineWidth = 12;
        g.beginPath();
        trail.current.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        g.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const emit = (e: React.PointerEvent, st: number) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const now = performance.now();
    if (st !== 2) trail.current = st === 1 ? [{ x, y, at: now }] : trail.current;
    else trail.current.push({ x, y, at: now });
    // 30 fois par seconde suffisent : le poser et le lever partent toujours
    if (st === 2 && now - lastSend.current < 30) return;
    lastSend.current = now;
    send({ t: 'act', a: 'cut', n: [Math.round((x / r.width) * 1000), Math.round((y / r.height) * 1000), st] });
  };

  return (
    <div
      className={`slice-pad ${data.stun ? 'stun' : ''} ${data.effect ? `fx-${data.effect}` : ''}`}
      style={{ ['--c' as string]: data.color }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        emit(e, 1);
      }}
      onPointerMove={(e) => {
        if (e.buttons || e.pointerType === 'touch') emit(e, 2);
      }}
      onPointerUp={(e) => emit(e, 0)}
      onPointerCancel={(e) => emit(e, 0)}
    >
      <canvas ref={ref} />
      <p className="slice-score">⭐ {data.score}</p>
      <p className="slice-hint">{data.stun ? (fr ? '💥 Sonné !' : '💥 Stunned!') : data.effect === 'gel' ? (fr ? '🧊 Gelé ! Attends…' : '🧊 Frozen! Wait…') : data.effect === 'inv' ? (fr ? '🔀 Lame à l’envers !' : '🔀 Blade flipped!') : data.effect === 'dbl' ? (fr ? '✖️2 Points doublés !' : '✖️2 Double points!') : data.effect === 'big' ? (fr ? '🗡️ Lame géante !' : '🗡️ Giant blade!') : fr ? 'Glisse ton doigt pour trancher !' : 'Swipe to slice!'}</p>
    </div>
  );
}
