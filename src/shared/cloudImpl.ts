// Partie Firebase de cloud.ts (chargée seulement quand on en a besoin).
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { deleteUser, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type Auth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { get, getDatabase, goOffline, goOnline, onValue, ref, remove, serverTimestamp, set, type Database, type DataSnapshot } from 'firebase/database';
import type { CloudUser } from './cloud';
import type { Progress } from './progress';

let app: FirebaseApp;
let auth: Auth;
let db: Database;

export function init(config: Record<string, string>) {
  app = getApps()[0] ?? initializeApp(config);
  auth = getAuth(app);
  db = getDatabase(app);
  // L'appli a pu être fermée par le téléphone pendant la connexion dans le navigateur : on reprend l'attente
  const p = pending();
  if (p) void waitRelay(p.id, unB64(p.k)).catch(() => {});
}

export function watchUser(cb: (u: CloudUser | null) => void) {
  return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, name: u.displayName ?? '', photo: u.photoURL } : null));
}

export async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    // Fenêtre bloquée par le navigateur : on passe par une redirection.
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, provider);
    else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') throw e;
  }
}

export const signOut = () => fbSignOut(auth);

/** Efface la progression en ligne puis le compte. Google peut demander une connexion récente (erreur auth/requires-recent-login). */
export async function deleteAccount() {
  const u = auth.currentUser;
  if (!u) return;
  await remove(ref(db, `players/${u.uid}`));
  await deleteUser(u);
}

// Connexion Google dans les applis (iPhone, Android, .exe) : Google refuse sa fenêtre de connexion dans une appli.
// On ouvre la page relais du site dans le vrai navigateur ; elle connecte le joueur, chiffre le jeton et le dépose
// dans la base sous un numéro au hasard. L'appli, qui attend sur ce numéro, le déchiffre et se connecte avec.
// La clé ne passe que par l'adresse (après le #, jamais envoyée à un serveur).
const b64 = (o: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(o))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const aes = (raw: Uint8Array, use: KeyUsage) => crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [use]);
type Tokens = { i: string | null; a: string | null };

// Demande en cours, gardée sur le téléphone (10 minutes) pour survivre à un redémarrage de l'appli
const PENDING = 'relaisGoogle';
function pending(): { id: string; k: string } | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING) ?? 'null') as { id: string; k: string; t: number } | null;
    return p && Date.now() - p.t < 600000 ? p : null;
  } catch {
    return null;
  }
}
const waiting = new Map<string, Promise<void>>();

/** Côté appli : ouvre le navigateur et attend le jeton (fini quand on est connecté). */
export async function signInViaBrowser(site: string, inApp: boolean): Promise<void> {
  const id = b64(crypto.getRandomValues(new Uint8Array(18)));
  const raw = crypto.getRandomValues(new Uint8Array(32));
  // Ouvert tout de suite (avant toute attente), sinon le navigateur du téléphone bloque la page
  const url = `${site}#/relais-google?id=${id}&k=${b64(raw)}`;
  // Dans les applis, l'ouverture du navigateur ne renvoie rien même quand elle a marché : on attend quand même
  if (!window.open(url, '_blank') && !inApp) {
    // Page bloquée (navigateur du téléphone) : on y va dans cet onglet, elle connectera ce navigateur puis reviendra à l'accueil
    location.assign(url + '&ici=1');
    return new Promise(() => {});
  }
  try {
    localStorage.setItem(PENDING, JSON.stringify({ id, k: b64(raw), t: Date.now() }));
  } catch {
    /* rien */
  }
  return waitRelay(id, raw);
}

/** Attend le jeton déposé par la page relais, puis connecte l'appli avec. */
function waitRelay(id: string, raw: Uint8Array): Promise<void> {
  const already = waiting.get(id);
  if (already) return already;
  const done = new Promise<void>((resolve, reject) => {
    const node = ref(db, `relaisGoogle/${id}`);
    let stop = () => {};
    // Retour dans l'appli (iPhone surtout) : la liaison avec la base a pu s'endormir, on la relance et on relit
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      goOffline(db);
      goOnline(db);
      get(node).then(got, () => {});
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    const end = () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      stop();
      waiting.delete(id);
      if (pending()?.id === id) localStorage.removeItem(PENDING);
    };
    let used = false;
    const got = async (snap: DataSnapshot) => {
      const d = (snap.val() as { d?: string } | null)?.d;
      if (!d || used) return;
      used = true;
      end();
      try {
        const all = unB64(d);
        const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) as BufferSource }, await aes(raw, 'decrypt'), all.slice(12) as BufferSource);
        const j = JSON.parse(new TextDecoder().decode(clear)) as Tokens;
        await signInWithCredential(auth, GoogleAuthProvider.credential(j.i, j.a));
        resolve();
      } catch (e) {
        reject(e);
      }
      remove(node).catch(() => {});
    };
    stop = onValue(node, (snap) => void got(snap));
    // On abandonne l'attente au bout de 10 minutes
    setTimeout(() => (end(), reject(new Error('timeout'))), 600000);
  });
  waiting.set(id, done);
  return done;
}

/** Côté page relais (navigateur), au retour de Google : jeton chiffré déposé pour l'appli (ici = connecter aussi ce navigateur). */
export async function relayTokens(id: string, k: string, idToken: string, here: boolean) {
  // Connexion ici aussi : vérifie le jeton tout de suite, et la base n'accepte le dépôt que d'un joueur connecté
  const before = auth.currentUser;
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(unB64(k), 'encrypt'), new TextEncoder().encode(JSON.stringify({ i: idToken, a: null })));
  const all = new Uint8Array(12 + enc.byteLength);
  all.set(iv);
  all.set(new Uint8Array(enc), 12);
  await set(ref(db, `relaisGoogle/${id}`), { d: b64(all), t: serverTimestamp() });
  // Ce navigateur n'était pas connecté avant (l'appli est ailleurs) : on le laisse comme il était
  if (!here && !before) fbSignOut(auth).catch(() => {});
}

/** Le serveur vérifie l'achat auprès de Google et l'inscrit sur le compte. */
export async function verifyPurchase(product: string, token: string) {
  const res = await httpsCallable<{ product: string; token: string }, { ok: boolean }>(getFunctions(app, 'europe-west1'), 'verifyPurchase')({ product, token });
  return res.data.ok;
}

/** Achats de ce compte (seul le serveur peut les écrire). */
export async function loadItems(uid: string) {
  return Object.keys(((await get(ref(db, `entitlements/${uid}`))).val() as Record<string, unknown> | null) ?? {});
}

export async function load(uid: string): Promise<Partial<Progress> | null> {
  const snap = await get(ref(db, `players/${uid}/progress`));
  return snap.exists() ? (snap.val() as Partial<Progress>) : null;
}

export async function save(uid: string, p: Progress) {
  await set(ref(db, `players/${uid}/progress`), {
    xp: p.xp,
    coins: p.coins,
    owned: p.owned,
    games: p.games,
    wins: p.wins,
    updated: Date.now(),
  });
}
