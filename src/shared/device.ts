// Mode léger automatique : Chromecast, petits Android, ou ?leger dans l'adresse.
const nav = navigator as Navigator & { deviceMemory?: number };
const cores = nav.hardwareConcurrency || 8;
const mem = nav.deviceMemory || 8;
const ua = navigator.userAgent;

export const IS_CAST = /CrKey/i.test(ua);
export const IS_ANDROID = /Android/i.test(ua);
export const IS_IOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
export const IS_PHONE = IS_ANDROID || IS_IOS;

export const LIGHT =
  IS_CAST || (IS_ANDROID && (cores <= 4 || mem <= 4)) || /[?&]leger/.test(location.search + location.hash);

export const PREVIEW = /[?&]apercu=1/.test(location.search + location.hash);

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function store<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('canapet.' + key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, v: unknown) {
  try {
    localStorage.setItem('canapet.' + key, JSON.stringify(v));
  } catch {
    /* stockage indisponible : tant pis */
  }
}
