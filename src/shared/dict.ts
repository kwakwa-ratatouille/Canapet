// Le dictionnaire de la télé : un mot existe-t-il vraiment ? Chargé à la demande (public/mots, fabriqué par scripts/make-dict.cjs).
// Gardé comme un seul long texte trié, cherché par dichotomie : très peu de mémoire, même sur un petit appareil.
const texts: Partial<Record<string, string>> = {};
const loading: Partial<Record<string, Promise<void>>> = {};

export function loadDict(lang: string): Promise<void> {
  if (texts[lang] !== undefined) return Promise.resolve();
  return (loading[lang] ??= fetch(`${import.meta.env.BASE_URL}mots/${lang}.txt`)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    })
    .then((t) => {
      texts[lang] = t;
    })
    .catch(() => {
      // Pas de réseau : on retentera à la prochaine partie, et les mots passeront devant les joueurs
      delete loading[lang];
    }));
}

/** Le mot (sans accents, sans « s » final) est-il dans le dictionnaire ? null si le dictionnaire n'est pas là. */
export function inDict(lang: string, key: string): boolean | null {
  const t = texts[lang];
  if (t === undefined) return null;
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const start = t.lastIndexOf('\n', mid - 1) + 1;
    let end = t.indexOf('\n', mid);
    if (end < 0) end = t.length;
    const w = t.slice(start, end);
    if (w === key) return true;
    if (w < key) lo = end + 1;
    else hi = start;
  }
  return false;
}

/** Pour les thèmes sans dictionnaire possible (marques, prénoms…) : écarte ce qui ne ressemble à aucun mot. */
export function looksReal(key: string): boolean {
  if (key.length < 2 || !/[aeiouy]/.test(key)) return false;
  if (/(.)\1\1/.test(key)) return false;
  return !/[bcdfghjklmnpqrstvwxz]{5,}/.test(key);
}
