// Tirage sans redite : la télé retient ce qui est déjà sorti, d'une partie et d'une soirée à l'autre.
// On ne revoit une question que quand toute la réserve y est passée.
const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};
const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((x) => x[1]);

const read = (key: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem('canapet.seen.' + key) ?? '[]') as string[];
  } catch {
    return [];
  }
};
const write = (key: string, v: string[]) => {
  try {
    localStorage.setItem('canapet.seen.' + key, JSON.stringify(v));
  } catch {
    /* rien */
  }
};

/** Rend `n` éléments, en donnant d'abord ceux qui ne sont pas encore sortis, et les note comme vus. */
export function freshDeck<T>(key: string, items: T[], n: number, id: (t: T) => string = (t) => JSON.stringify(t)): T[] {
  const seen = new Set(read(key));
  const fresh = shuffle(items.filter((t) => !seen.has(hash(id(t)))));
  const old = shuffle(items.filter((t) => seen.has(hash(id(t)))));
  const out = [...fresh, ...old].slice(0, n);
  // Toute la réserve est passée : on repart de zéro, en gardant ce tirage pour ne pas le ressortir tout de suite
  const base = fresh.length < n ? [] : [...seen];
  write(key, [...base, ...out.map((t) => hash(id(t)))]);
  return out;
}
