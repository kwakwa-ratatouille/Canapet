// Compte Google (Firebase) : connexion depuis le téléphone et sauvegarde de la progression.
// Firebase n'est chargé qu'à la demande, pour garder la télé et la manette légères.
import { IS_NATIVE } from './native';
import type { Progress } from './progress';

const CONFIG = {
  apiKey: 'AIzaSyCBOa9SNOnyN6GkG7asYT2J1Y350EU7rmY',
  authDomain: 'canapet-31bb7.firebaseapp.com',
  databaseURL: 'https://canapet-31bb7-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'canapet-31bb7',
  storageBucket: 'canapet-31bb7.firebasestorage.app',
  messagingSenderId: '723941656736',
  appId: '1:723941656736:web:f564e3813a49fb1077a1c5',
};

export interface CloudUser {
  uid: string;
  name: string;
  photo: string | null;
}

let ready: Promise<typeof import('./cloudImpl')> | null = null;
const impl = () => (ready ??= import('./cloudImpl').then((m) => (m.init(CONFIG), m)));

/** Prévient à chaque changement de connexion (null = pas connecté). */
export function watchUser(cb: (u: CloudUser | null) => void): () => void {
  let stop = () => {};
  let dead = false;
  impl()
    .then((m) => {
      if (!dead) stop = m.watchUser(cb);
    })
    .catch(() => cb(null));
  return () => {
    dead = true;
    stop();
  };
}

/** Charge Firebase en avance (la fenêtre Google doit s'ouvrir tout de suite au toucher). */
export const preload = () => void impl().catch(() => {});
/** Dans les applis (iPhone, Android, .exe), Google refuse sa fenêtre : on passe par le navigateur. */
const VIA_BROWSER = IS_NATIVE || /Electron/.test(navigator.userAgent);
const SITE = 'https://kwakwa-ratatouille.github.io/Canapet/';
export const signIn = () => impl().then((m) => (VIA_BROWSER ? m.signInViaBrowser(SITE) : m.signIn()));
export const relayTokens = (id: string, k: string) => impl().then((m) => m.relayTokens(id, k));
export const signOut = () => impl().then((m) => m.signOut());
export const loadCloud = (uid: string) => impl().then((m) => m.load(uid));
export const saveCloud = (uid: string, p: Progress) => impl().then((m) => m.save(uid, p));

/** Réunit la progression du téléphone et celle du compte : on garde le meilleur des deux. */
export function merge(a: Progress, b: Partial<Progress> | null): Progress {
  if (!b) return a;
  return {
    ...a,
    xp: Math.max(a.xp, b.xp ?? 0),
    coins: Math.max(a.coins, b.coins ?? 0),
    owned: [...new Set([...a.owned, ...(b.owned ?? [])])],
    games: Math.max(a.games, b.games ?? 0),
    wins: Math.max(a.wins, b.wins ?? 0),
  };
}
