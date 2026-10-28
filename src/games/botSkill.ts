// Niveau des bots : un bot « distrait » reste planté par moments, plus souvent en facile.
const naps = new WeakMap<object, { t: number; doze: boolean }>();

/** Niveau 0 facile, 1 normal, 2 fort → habileté de 0 à 1. */
export const SKILLS = [0.4, 0.7, 1];

/** Vrai quand le bot doit rester sans rien faire cette image (jamais au niveau fort). */
export function dozing(o: object, skill: number, dt: number): boolean {
  if (skill >= 1) return false;
  let s = naps.get(o);
  if (!s) {
    s = { t: Math.random(), doze: false };
    naps.set(o, s);
  }
  s.t -= dt;
  if (s.t <= 0) {
    s.doze = !s.doze;
    s.t = s.doze ? (1 - skill) * (0.6 + Math.random() * 1.4) : skill * (0.8 + Math.random() * 1.6);
  }
  return s.doze;
}
