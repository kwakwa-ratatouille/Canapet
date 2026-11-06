// Fabrique public/mots/fr.txt et en.txt depuis les paquets npm an-array-of-french-words et an-array-of-english-words (licence MIT).
// Usage : NODE_PATH=<dossier>/node_modules node scripts/make-dict.cjs
// Chaque ligne = un mot sans accents, sans majuscules, sans « s » final, triés : la télé les cherche sans tout charger en mémoire (dict.ts).
const fs = require('fs');
const path = require('path');

const clean = (s) => s
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/œ/g, 'oe')
  .replace(/[^a-z0-9]/g, '')
  .replace(/s$/, '');

const out = path.join(__dirname, '..', 'public', 'mots');
fs.mkdirSync(out, { recursive: true });
for (const [lang, pkg] of [['fr', 'an-array-of-french-words'], ['en', 'an-array-of-english-words']]) {
  const words = require(pkg);
  const set = new Set();
  for (const w of words) {
    const k = clean(w);
    if (k.length >= 2 && k.length <= 18) set.add(k);
  }
  const list = [...set].sort();
  fs.writeFileSync(path.join(out, `${lang}.txt`), list.join('\n'));
  console.log(lang, words.length, '→', list.length, 'mots');
}
