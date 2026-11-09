// GIPHY : les vrais mèmes animés pour Le Mème Mystère, par l'accès officiel de GIPHY (affichage autorisé avec la mention
// « Powered by GIPHY »). Rien n'est gardé chez nous : la vidéo est lue directement depuis GIPHY pendant la manche.
// Clé gratuite à créer sur https://developers.giphy.com (type « API », pas « SDK ») et à coller ici.
// Tant que la clé est vide, Le Mème Mystère se joue avec les emojis et les descriptions.
export const GIPHY_KEY = '';
/** La clé (ou, pour les essais, une clé gardée dans ce navigateur sous canapet.giphyKey). */
const key = () => {
  if (GIPHY_KEY) return GIPHY_KEY;
  try {
    return localStorage.getItem('canapet.giphyKey') ?? '';
  } catch {
    return '';
  }
};

export interface MemeClip {
  /** Petite vidéo MP4 qui tourne en boucle. */
  mp4: string;
  w: number;
  h: number;
}

type GiphyImage = { mp4?: string; width?: string; height?: string };
type GiphyResult = { images?: Record<string, GiphyImage> };

/** Cherche le mème sur GIPHY et rend sa vidéo (null si pas de clé, pas de réseau ou rien trouvé). */
export async function findMemeClip(query: string, family: boolean, lang: string): Promise<MemeClip | null> {
  const k = key();
  if (!k) return null;
  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(k)}&q=${encodeURIComponent(query)}&limit=8&rating=${family ? 'g' : 'pg-13'}&lang=${lang === 'fr' ? 'fr' : 'en'}`;
    const ctl = new AbortController();
    const stop = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(stop);
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: GiphyResult[] };
    // Parmi les premiers résultats (les plus pertinents), un au hasard pour varier d'une partie à l'autre
    const list = (j.data ?? [])
      .slice(0, 4)
      .map((d) => d.images?.original_mp4 ?? d.images?.fixed_height ?? d.images?.downsized_small)
      .filter((x): x is GiphyImage => !!x?.mp4);
    if (!list.length) return null;
    const v = list[Math.floor(Math.random() * list.length)];
    return { mp4: v.mp4!, w: +(v.width ?? 480), h: +(v.height ?? 270) };
  } catch {
    return null;
  }
}

/** Prépare une vidéo cachée, sans son, qui tourne en boucle (dessinée ensuite dans la télé). */
export function memeVideo(clip: MemeClip): HTMLVideoElement {
  const v = document.createElement('video');
  v.crossOrigin = 'anonymous';
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = clip.mp4;
  void v.play().catch(() => {});
  return v;
}
