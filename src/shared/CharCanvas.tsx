import { useEffect, useRef } from 'react';
import { drawCharacter, onSpriteReady, selfieImage, type Mood } from './characters';
import { LIGHT } from './device';
import type { Profile } from './protocol';

interface Props {
  profile: Pick<Profile, 'food' | 'color' | 'hat' | 'acc' | 'selfie' | 'eyes' | 'pose'>;
  size: number;
  ghost?: boolean;
  still?: boolean;
  mood?: Mood;
  arms?: boolean;
}

/** Un personnage dans un petit canvas (salon, résultats, manette). */
export function CharCanvas({ profile, size, ghost, still, mood, arms }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const opts = useRef(profile);
  opts.current = profile;

  useEffect(() => {
    const cv = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * 1.25 * dpr;
    const g = cv.getContext('2d')!;
    let raf = 0;
    const animated = !still && !LIGHT;
    const draw = (now: number) => {
      const p = opts.current;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, size * 1.25);
      drawCharacter(g, size / 2, size * 1.2, size * 0.78, {
        food: p.food,
        color: p.color,
        hat: p.hat,
        acc: p.acc,
        eyes: p.eyes,
        pose: p.pose,
        selfie: selfieImage(p.selfie),
        t: animated ? now / 1000 + size : 0,
        ghost,
        mood,
        arms,
      });
      if (animated) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    // Vignettes immobiles : on redessine quand le dessin ou le selfie est prêt.
    const off = onSpriteReady(() => !animated && requestAnimationFrame(draw));
    const late = setTimeout(() => requestAnimationFrame(draw), 400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(late);
      off();
    };
  }, [size, ghost, still, mood, arms, profile.food, profile.color, profile.hat, profile.acc, profile.selfie]);

  return <canvas ref={ref} style={{ width: size, height: size * 1.25 }} className="char" />;
}
