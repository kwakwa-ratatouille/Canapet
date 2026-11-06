// Compte Google (Firebase) : connexion depuis le téléphone et sauvegarde de la progression.
// Firebase n'est chargé qu'à la demande, pour garder la télé et la manette légères.
import { IS_PHONE } from './device';
import { IS_INSTALLED, IS_NATIVE } from './native';
import { fixCoins, type Progress } from './progress';

export const CONFIG = {
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
// Téléphones (même dans le navigateur) : la page firebaseapp.com perd sa mémoire en route (« missing initial state »),
// donc on passe aussi par la page relais, qui va chez Google et revient directement sur le site.
export const VIA_BROWSER = IS_NATIVE || IS_INSTALLED || IS_PHONE || /Electron/.test(navigator.userAgent);
const SITE = 'https://kwakwa-ratatouille.github.io/Canapet/';
const IN_APP = IS_NATIVE || IS_INSTALLED || /Electron/.test(navigator.userAgent);
export const signIn = () => impl().then((m) => (VIA_BROWSER ? m.signInViaBrowser(SITE, IN_APP) : m.signIn()));
export const relayTokens = (id: string, k: string, idToken: string, here: boolean) => impl().then((m) => m.relayTokens(id, k, idToken, here));

// Connexion Google sans la page firebaseapp.com : Google renvoie le jeton directement sur le site (après le #).
// Adresse de retour à déclarer dans Google Cloud (identifiants OAuth, client web) : SITE.
const CLIENT_ID = '723941656736-mj3obbsi342p7lmur3r70emnp0vv4go1.apps.googleusercontent.com';
const back = () => location.origin + location.pathname.replace(/index.html$/, '');
type Pending = { id: string; k: string; here: boolean; n: string };

/** Page relais : part chez Google (en gardant de quoi finir au retour). */
export function goGoogle(id: string, k: string, here: boolean) {
  const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  const n = rnd();
  // Google peut nous ramener dans un autre navigateur, ou dans l'appli (surtout sur Android), où le stockage du téléphone n'est plus le même :
  // la demande voyage donc avec lui, dans « state », au lieu d'être gardée sur place
  const st = btoa(JSON.stringify({ id, k, here, n } satisfies Pending)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: back(), response_type: 'id_token', scope: 'openid email profile', nonce: n, state: st, prompt: 'select_account' });
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + q);
}

/** Retour de Google : lit la réponse (#id_token=…&state=…) et retrouve la demande. */
export function googleReturn(): (Pending & { token: string | null; error: string | null }) | null {
  const q = new URLSearchParams(location.hash.slice(1));
  const st = q.get('state');
  if (!st || (!q.has('id_token') && !q.has('error'))) return null;
  // Le jeton ne reste pas dans l'adresse
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const p = JSON.parse(atob(st.replace(/-/g, '+').replace(/_/g, '/'))) as Pending;
    return { ...p, token: q.get('id_token'), error: q.get('error') };
  } catch {
    return { id: '', k: '', here: false, n: '', token: null, error: 'lost' };
  }
}
export const signOut = () => impl().then((m) => m.signOut());
export const deleteAccount = () => impl().then((m) => m.deleteAccount());
export const verifyPurchase = (product: string, token: string) => impl().then((m) => m.verifyPurchase(product, token));
export const createCheckout = (product: string, consent: boolean) => impl().then((m) => m.createCheckout(product, consent));
export const loadItems = (uid: string) => impl().then((m) => m.loadItems(uid));
/** S'abonne après le chargement de Firebase ; rend de quoi se désabonner. */
function live<T>(start: (m: Awaited<ReturnType<typeof impl>>, cb: (v: T) => void) => () => void, cb: (v: T) => void) {
  let off = () => {};
  let dead = false;
  impl().then((m) => {
    if (!dead) off = start(m, cb);
  }).catch(() => {});
  return () => {
    dead = true;
    off();
  };
}
export interface FriendInfo { uid: string; name: string; food: string; color: string; hat?: string; seen: number; room?: string }
export interface InviteInfo { from: string; name: string; code: string; at: number }
export const myFriendCode = () => impl().then((m) => m.myFriendCode());
export const addFriend = (code: string) => impl().then((m) => m.addFriend(code));
export const removeFriend = (uid: string) => impl().then((m) => m.removeFriend(uid));
export const inviteFriend = (uid: string, room: string) => impl().then((m) => m.inviteFriend(uid, room));
export const dropInvite = (from: string) => impl().then((m) => m.dropInvite(from));
export const publishPresence = (p: { name: string; food: string; color: string; hat?: string; room: string }) => impl().then((m) => m.publishPresence(p));
export const friendsWatch = (cb: (l: FriendInfo[]) => void) => live<FriendInfo[]>((m, f) => m.friendsWatch(f), cb);
export const invitesWatch = (cb: (l: InviteInfo[]) => void) => live<InviteInfo[]>((m, f) => m.invitesWatch(f), cb);
export const loadKeys = (uid: string) => impl().then((m) => m.loadKeys(uid));
export const openChestCloud = (owned: string[]) => impl().then((m) => m.openChest(owned));
export const loadCloud = (uid: string) => impl().then((m) => m.load(uid));
export const saveCloud = (uid: string, p: Progress) => impl().then((m) => m.save(uid, p));

/** Réunit la progression du téléphone et celle du compte : on garde le meilleur des deux. */
export function merge(a: Progress, b: Partial<Progress> | null): Progress {
  if (!b) return a;
  return {
    ...a,
    xp: Math.max(a.xp, b.xp ?? 0),
    coins: Math.max(fixCoins(a.coins), fixCoins(b.coins ?? 0)),
    owned: [...new Set([...a.owned, ...(b.owned ?? [])])],
    games: Math.max(a.games, b.games ?? 0),
    wins: Math.max(a.wins, b.wins ?? 0),
  };
}
