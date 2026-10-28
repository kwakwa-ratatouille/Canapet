// Appli Android (Capacitor) : accès à la galerie pour Photo Roulette.
import { IS_ANDROID, IS_IOS } from './device';

interface GalleryItem {
  data: string;
  mime: string;
}
interface GalleryPlugin {
  random(o: { count: number; video: boolean }): Promise<{ items: GalleryItem[] }>;
}
type Cap = { isNativePlatform?: () => boolean; Plugins?: { Gallery?: GalleryPlugin } };
const cap = () => (window as unknown as { Capacitor?: Cap }).Capacitor;

/** Vrai dans l'appli Android installée. */
export const IS_NATIVE = !!cap()?.isNativePlatform?.();

/** Ouvert depuis l'écran d'accueil (appli installée, sans barre d'adresse). */
export const IS_INSTALLED = IS_NATIVE || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone === true;

export const ANDROID_APK_URL = 'https://github.com/kwakwa-ratatouille/Canapet/releases/download/android-latest/Canapet.apk';

export const hasGallery = () => !!cap()?.Plugins?.Gallery;

/** Pioche `count` photos (ou vidéos) au hasard dans toute la galerie du téléphone. */
export async function randomFromGallery(count: number, video: boolean): Promise<File[]> {
  const g = cap()?.Plugins?.Gallery;
  if (!g) return [];
  const { items } = await g.random({ count, video });
  return Promise.all(
    items.map(async (it, i) => {
      const blob = await (await fetch(`data:${it.mime};base64,${it.data}`)).blob();
      return new File([blob], `galerie-${i}`, { type: it.mime });
    }),
  );
}

// Installation de l'appli web (Android Chrome) : on garde l'invitation du navigateur pour un bouton.
type InstallPrompt = Event & { prompt(): Promise<void> };
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPrompt;
  listeners.forEach((f) => f());
});
export const canPromptInstall = () => !!deferred;
export const onInstallChange = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
export async function promptInstall() {
  if (!deferred) return;
  await deferred.prompt();
  deferred = null;
  listeners.forEach((f) => f());
}

if ('serviceWorker' in navigator && !IS_NATIVE && location.protocol === 'https:') void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});

export const PLATFORM = IS_ANDROID ? 'android' : IS_IOS ? 'ios' : 'other';
