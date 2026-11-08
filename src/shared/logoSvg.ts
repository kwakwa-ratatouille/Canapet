// Version « Salon an 2000 » (nov. 2026) : lettres chromées à reflet holographique, anneau d'orbite autour du nom
// (il passe derrière puis devant les lettres), trois étincelles à quatre branches.
// Logo de Cana'pet (nov. 2026) : un canapé-écran avec le bouton « play » et deux coussins-manettes,
// puis le nom en lettres épaisses, légèrement penchées vers l'avant (ça bouge !), avec une étincelle en apostrophe.
// Même cadre que l'ancien logotype (400 × 124) pour ne rien casser dans les pages.
const INK = '#3a2140';

const sofa = `
<g transform="translate(6 8)">
  <ellipse cx="54" cy="106" rx="50" ry="7" fill="${INK}" opacity=".18"/>
  <rect x="6" y="20" width="96" height="66" rx="22" fill="${INK}"/>
  <rect x="4" y="14" width="96" height="66" rx="22" fill="url(#lgSofa)" stroke="${INK}" stroke-width="5"/>
  <rect x="18" y="24" width="68" height="34" rx="12" fill="#2a1838" stroke="${INK}" stroke-width="4"/>
  <path d="M45 31L63 41L45 51Z" fill="#ffd60a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="74" cy="31" r="3" fill="#ff4f9a"/>
  <rect x="-2" y="52" width="24" height="38" rx="11" fill="#ff86bd" stroke="${INK}" stroke-width="5"/>
  <rect x="82" y="52" width="24" height="38" rx="11" fill="#ff86bd" stroke="${INK}" stroke-width="5"/>
  <rect x="16" y="62" width="34" height="24" rx="10" fill="#ffd60a" stroke="${INK}" stroke-width="4"/>
  <rect x="54" y="62" width="34" height="24" rx="10" fill="#2ec5ff" stroke="${INK}" stroke-width="4"/>
  <path d="M27 74h12M33 68v12" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="66" cy="72" r="3" fill="${INK}"/><circle cx="76" cy="77" r="3" fill="${INK}"/>
  <rect x="14" y="88" width="9" height="12" rx="3" fill="${INK}"/>
  <rect x="82" y="88" width="9" height="12" rx="3" fill="${INK}"/>
  <path d="M14 22Q22 16 34 18" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7"/>
</g>`;

const word = (txt: string, x: number, fill: string) =>
  `<text x="${x}" y="88" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="66" letter-spacing="-0.5">${txt}</text>`.replace(
    '<text',
    `<text fill="${fill}"`,
  );

const letters = (dx: number, dy: number, fill: string, stroke = '', sw = 0) =>
  `<g transform="translate(${dx} ${dy}) skewX(-8)" ${stroke ? `stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" paint-order="stroke"` : ''}>${word('Cana', 130, fill)}${word('pet', 296, fill === '#fff' ? '#fff' : fill === INK ? INK : '#ffd60a')}</g>`;

/** Logo complet (SVG en texte). */
export const LOGO_SVG = `<svg viewBox="0 0 400 124" xmlns="http://www.w3.org/2000/svg" class="w" role="img" aria-label="Cana'pet">
<defs>
  <linearGradient id="lgSofa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff86bd"/><stop offset="1" stop-color="#e0367f"/></linearGradient>
  <linearGradient id="lgText" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".36" stop-color="#ffd3ef"/><stop offset=".5" stop-color="#ff4f9a"/>
    <stop offset=".56" stop-color="#ff7ec0"/><stop offset=".78" stop-color="#ffd9f0"/><stop offset="1" stop-color="#c9b6ff"/>
  </linearGradient>
  <linearGradient id="lgRing" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#a9e6ff"/><stop offset=".35" stop-color="#d9c2ff"/><stop offset=".7" stop-color="#ffc2ec"/><stop offset="1" stop-color="#bfffe0"/>
  </linearGradient>
</defs>
${sofa}
<path d="M126 66C140 30 392 22 398 50" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
<path d="M126 66C140 30 392 22 398 50" fill="none" stroke="url(#lgRing)" stroke-width="4.5" stroke-linecap="round"/>
${letters(4, 6, INK, INK, 14)}
${letters(0, 0, '#fff', '#fff', 14)}
${letters(0, 0, 'url(#lgText)', INK, 5)}
<path d="M398 50C404 104 168 126 126 66" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
<path d="M398 50C404 104 168 126 126 66" fill="none" stroke="url(#lgRing)" stroke-width="4.5" stroke-linecap="round"/>
<g transform="translate(288 30)"><path d="M0 -15L3.5 -3.5L15 0L3.5 3.5L0 15L-3.5 3.5L-15 0L-3.5 -3.5Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>
<g transform="translate(386 18)"><path d="M0 -9L2 -2L9 0L2 2L0 9L-2 2L-9 0L-2 -2Z" fill="#ffd60a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g>
<g transform="translate(138 22)"><path d="M0 -7L1.6 -1.6L7 0L1.6 1.6L0 7L-1.6 1.6L-7 0L-1.6 -1.6Z" fill="#a9e6ff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></g>
</svg>`;
