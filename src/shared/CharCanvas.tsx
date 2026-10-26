import { useEffect, useRef } from 'react';
import { drawCharacter, selfieImage, type DrawOpts } from './characters';
import { LIGHT } from './device';
import type { Profile } from './protocol';

interface Props {
  profile: Pick<Profile, 'food' | 'color' | 'hat' | 'acc' | 'selfie'>;
  size: number;
  ghost?: boolean;
  still?: boolean;
  mood?: DrawOpts['mood'];
}

/** Un personnage animé dans un petit canvas (salon, résultats, manette). */
export function CharCanvas({ profile, size, ghost, still, mood }: Props) {
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
    const draw = (now: number) => {
      const p = opts.current;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, size * 1.25);
      drawCharacter(g, size / 2, size * 1.2, size * 0.78, {
        food: p.food,
        color: p.color,
        hat: p.hat,
        acc: p.acc,
        selfie: selfieImage(p.selfie),
        t: now / 1000 + size,
        ghost,
        mood,
      });
      if (!still && !LIGHT) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    // En mode immobile on redessine quand même un peu après, le temps que le selfie se charge.
    const late = setTimeout(() => requestAnimationFrame(draw), 400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(late);
    };
  }, [size, ghost, still, mood, profile.food, profile.color, profile.hat, profile.acc, profile.selfie]);

  return <canvas ref={ref} style={{ width: size, height: size * 1.25 }} className="char" />;
}
