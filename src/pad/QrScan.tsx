// Scanner le QR code de la partie avec l'appareil photo, directement depuis l'accueil (appli ou site).
import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../shared/protocol';
import { CODE_LETTERS } from '../shared/protocol';

/** Retrouve le code de la partie dans ce qu'a lu l'appareil photo. */
export function codeFromQr(text: string): string | null {
  const m = /#\/m\/([A-Za-z]{4})/.exec(text) ?? /^\s*([A-Za-z]{4})\s*$/.exec(text);
  const c = m?.[1].toUpperCase();
  return c && [...c].every((x) => CODE_LETTERS.includes(x)) ? c : null;
}

export function QrScan({ lang, onCode, onClose }: { lang: Lang; onCode: (code: string) => void; onClose: () => void }) {
  const fr = lang === 'fr';
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'start' | 'on' | 'denied' | 'wrong'>('start');
  const done = useRef(onCode);
  done.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stop = false;
    (async () => {
      try {
        const [{ default: jsQR }, s] = await Promise.all([import('jsqr'), navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })]);
        stream = s;
        if (stop) return s.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = s;
        await v.play();
        setState('on');
        const cv = document.createElement('canvas');
        const g = cv.getContext('2d', { willReadFrequently: true })!;
        let last = 0;
        const tick = (now: number) => {
          if (stop) return;
          raf = requestAnimationFrame(tick);
          // Une dizaine d'essais par seconde, en petit : ça suffit et ça ne chauffe pas le téléphone
          if (now - last < 100 || !v.videoWidth) return;
          last = now;
          const k = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight));
          cv.width = v.videoWidth * k;
          cv.height = v.videoHeight * k;
          g.drawImage(v, 0, 0, cv.width, cv.height);
          const found = jsQR(g.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
          if (!found?.data) return;
          const code = codeFromQr(found.data);
          if (code) {
            stop = true;
            navigator.vibrate?.(60);
            done.current(code);
          } else setState('wrong');
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setState('denied');
      }
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="qr-scan">
      <video ref={video} playsInline muted />
      <span className="qr-frame" aria-hidden="true" />
      <p>
        {state === 'denied'
          ? fr ? 'Impossible d’ouvrir l’appareil photo. Autorise-le dans les réglages du téléphone, ou tape le code.' : 'Can’t open the camera. Allow it in your phone settings, or type the code.'
          : state === 'wrong'
            ? fr ? 'Ce QR code n’est pas celui d’une partie Cana’pet.' : 'This QR code isn’t a Cana’pet game.'
            : fr ? 'Vise le QR code affiché à l’écran de la partie' : 'Point at the QR code on the game screen'}
      </p>
      <button className="btn" onClick={onClose}>{fr ? 'Fermer' : 'Close'}</button>
    </div>
  );
}
