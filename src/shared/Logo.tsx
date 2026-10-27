import { monogramSvg, wordmarkSvg } from './art/canapet-art.js';

// Les SVG du logo sont générés une seule fois.
const WORDMARK = wordmarkSvg();
const MONOGRAM = monogramSvg();

/** Logotype « Cana'pet » avec l'apostrophe-nuage (tête des écrans télé et accueil téléphone). */
export function Wordmark({ className = '' }: { className?: string }) {
  return <div className={`wordmark ${className}`} dangerouslySetInnerHTML={{ __html: WORDMARK }} />;
}

/** Monogramme C'p (logo principal compact). */
export function Monogram({ className = '' }: { className?: string }) {
  return <div className={`monogram ${className}`} dangerouslySetInnerHTML={{ __html: MONOGRAM }} />;
}

/** Couleur de joueur adoucie (fond des pastilles). */
export function tint(hex: string, k = 0.3): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * k + 255 * (1 - k));
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

export function gameIcon(slug: string): string {
  return `${import.meta.env.BASE_URL}da/jeux/${slug}.svg`;
}
