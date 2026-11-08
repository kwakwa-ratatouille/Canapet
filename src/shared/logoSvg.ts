// Version « Salon an 2000 » (nov. 2026) : lettres pleines avec un reflet de plastique brillant, étincelle en apostrophe.
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

/** Les deux mots, découpés pour poser le reflet de plastique dessus. */
const shapes = `${word('Cana', 130, '#000')}${word('pet', 296, '#000')}`;

/** Logo complet (SVG en texte). */
export const LOGO_SVG = `<svg viewBox="0 0 400 124" xmlns="http://www.w3.org/2000/svg" class="w" role="img" aria-label="Cana'pet">
<defs>
  <linearGradient id="lgSofa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff86bd"/><stop offset="1" stop-color="#e0367f"/></linearGradient>
  <linearGradient id="lgCana" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8cc4"/><stop offset="1" stop-color="#e8307f"/></linearGradient>
  <linearGradient id="lgPet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe45c"/><stop offset="1" stop-color="#ffb21f"/></linearGradient>
  <clipPath id="lgClip" clipPathUnits="userSpaceOnUse"><g transform="skewX(-8)">${shapes}</g></clipPath>
</defs>
${sofa}
${letters(3, 5, INK, INK, 15)}
${letters(0, 0, '#fff', '#fff', 15)}
<g transform="skewX(-8)" stroke="${INK}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${word('Cana', 130, 'url(#lgCana)')}${word('pet', 296, 'url(#lgPet)')}</g>
<g clip-path="url(#lgClip)">
  <rect x="100" y="30" width="300" height="25" fill="#fff" opacity=".42"/>
  <rect x="100" y="74" width="300" height="20" fill="#3a2140" opacity=".1"/>
</g>
<g transform="translate(286 30)"><path d="M0 -16L4 -4L16 0L4 4L0 16L-4 4L-16 0L-4 -4Z" fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/></g>
<g transform="translate(392 22)"><path d="M0 -8L2 -2L8 0L2 2L0 8L-2 2L-8 0L-2 -2Z" fill="#a9e6ff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g>
</svg>`;
