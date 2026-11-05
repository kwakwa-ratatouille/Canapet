// Manette de Crie Plus Fort : mesure le volume ; seul ce chiffre part vers la télé, pas le son.
import { useEffect, useRef, useState } from 'react';
import type { ShoutPadData } from '../games/shout';
import { micBegin, micBlocked, micEnd } from '../shared/native';
import type { Lang, ToTv } from '../shared/protocol';

export function ShoutPad({ data, lang, send }: { data: ShoutPadData; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  const [state, setState] = useState<'off' | 'asking' | 'on' | 'denied'>('off');
  const [level, setLevel] = useState(0);
  const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);

  const start = async () => {
    // Ancienne appli iPhone : pas de micro possible, on joue en tapant
    if (micBlocked()) return setState('denied');
    setState('asking');
    try {
      micBegin();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      micEnd();
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new Ctx();
      await ac.resume();
      const an = ac.createAnalyser();
      an.fftSize = 1024;
      ac.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      let floor = 0.02;
      let sent = 0;
      let raf = 0;
      const tick = () => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        // Le bruit ambiant est appris doucement pour ne pas avancer tout seul
        floor = rms < floor ? floor * 0.9 + rms * 0.1 : floor * 0.999 + rms * 0.001;
        const v = Math.max(0, Math.min(1, (rms - floor * 1.4) * 7));
        setLevel(v);
        const now = performance.now();
        if (now - sent > 180) {
          sent = now;
          send({ t: 'act', a: 'vol', n: [Math.round(v * 100)] });
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
      stop.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        void ac.close();
      };
      setState('on');
    } catch {
      micEnd();
      setState('denied');
    }
  };
  // Arrivée : on coupe le micro tout de suite
  useEffect(() => {
    if (data.phase === 'end') stop.current();
  }, [data.phase]);

  return (
    <div className={`traitor shout-pad shout-${data.phase}`} onPointerDown={() => state === 'denied' && send({ t: 'act', a: 'tap' })}>
      <p className="shout-sign">{data.phase === 'chut' ? (fr ? '🤫 CHUT !' : '🤫 SHUSH!') : data.phase === 'warn' ? (fr ? '⚠️ Attention…' : '⚠️ Watch out…') : data.phase === 'end' ? (fr ? '🏁 Arrivée !' : '🏁 Finish!') : fr ? '📣 CRIE !' : '📣 SHOUT!'}</p>
      {state === 'off' || state === 'asking' ? (
        <button className="mic-btn" disabled={state === 'asking'} onClick={() => void start()}>
          <i>🎙️</i>
          <small>{state === 'asking' ? '…' : fr ? 'Activer le micro' : 'Turn on the mic'}</small>
        </button>
      ) : state === 'denied' ? (
        <button className="mic-btn on" onPointerDown={() => { send({ t: 'act', a: 'tap' }); navigator.vibrate?.(8); }}>
          <i>👆</i>
          <small>{fr ? 'Pas de micro : tape vite !' : 'No mic: tap fast!'}</small>
        </button>
      ) : (
        <div className="shout-meter"><i style={{ height: `${Math.round(level * 100)}%` }} /><b>{Math.round(level * 100)}</b></div>
      )}
      <div className="shout-track"><i style={{ width: `${data.dist}%` }} /></div>
      <p className="pad-small">{data.rank}/{data.of} · {data.dist} % · ⏱ {data.left}</p>
      {state === 'on' && <p className="pad-small">{fr ? 'Seul le volume part vers la télé. Le son n’est ni envoyé ni gardé.' : 'Only the volume goes to the TV. The sound is neither sent nor kept.'}</p>}
    </div>
  );
}
