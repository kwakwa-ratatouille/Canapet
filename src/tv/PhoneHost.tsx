// Jouer sans télé : ce téléphone fait tourner la partie, sans rien en afficher, et sert aussi de manette.
import { useEffect, useMemo, useState } from 'react';
import { PadApp } from '../pad/PadApp';
import { localLink } from '../shared/noTv';
import { unlockAudio } from '../shared/sound';
import { Session } from './session';

/** Une image du jeu pour les téléphones, assez souvent pour suivre, sans charger la liaison. */
const SHOT_EVERY = 800;
const SHOT_W = 854;
const SHOT_H = 480;

export function PhoneHost() {
  const session = useMemo(() => new Session(false, true), []);
  const [code, setCode] = useState(session.net.code);

  useEffect(() => {
    if (location.hash.includes('apercu=1')) (window as unknown as { __session: Session }).__session = session;
    const off = session.subscribe(() => setCode(session.net.code));
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    // Pas de dessin à faire ici : juste faire avancer la partie
    const tick = window.setInterval(() => session.frame(performance.now()), 16);
    const cv = document.createElement('canvas');
    cv.width = SHOT_W;
    cv.height = SHOT_H;
    const g = cv.getContext('2d', { alpha: false })!;
    const shots = window.setInterval(() => {
      if (session.phase !== 'game' || !session.game || session.paused || session.clock < session.intro) return;
      try {
        g.setTransform(SHOT_W / 1920, 0, 0, SHOT_H / 1080, 0, 0);
        g.globalAlpha = 1;
        session.game.render(g, performance.now() / 1000);
        session.net.broadcast({ t: 'shot', d: cv.toDataURL('image/jpeg', 0.5) });
      } catch (e) {
        console.error('Image du jeu impossible', e);
      }
    }, SHOT_EVERY);
    return () => {
      off();
      window.removeEventListener('pointerdown', unlock);
      clearInterval(tick);
      clearInterval(shots);
    };
  }, [session]);

  // La manette de ce téléphone parle directement à la session
  localLink.code = code;
  return code ? <PadApp key={code} code={code} /> : null;
}
