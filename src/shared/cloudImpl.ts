// Partie Firebase de cloud.ts (chargée seulement quand on en a besoin).
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type Auth } from 'firebase/auth';
import { get, getDatabase, onValue, ref, remove, serverTimestamp, set, type Database } from 'firebase/database';
import type { CloudUser } from './cloud';
import type { Progress } from './progress';

let app: FirebaseApp;
let auth: Auth;
let db: Database;

export function init(config: Record<string, string>) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getDatabase(app);
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

// Connexion Google dans les applis (iPhone, Android, .exe) : Google refuse sa fenêtre de connexion dans une appli.
// On ouvre la page relais du site dans le vrai navigateur ; elle connecte le joueur, chiffre le jeton et le dépose
// dans la base sous un numéro au hasard. L'appli, qui attend sur ce numéro, le déchiffre et se connecte avec.
// La clé ne passe que par l'adresse (après le #, jamais envoyée à un serveur).
const b64 = (o: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(o))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const aes = (raw: Uint8Array, use: KeyUsage) => crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [use]);
type Tokens = { i: string | null; a: string | null };

/** Côté appli : ouvre le navigateur et attend le jeton (fini quand on est connecté). */
export async function signInViaBrowser(site: string): Promise<void> {
  const id = b64(crypto.getRandomValues(new Uint8Array(18)));
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await aes(raw, 'decrypt');
  const node = ref(db, `relaisGoogle/${id}`);
  const done = new Promise<void>((resolve, reject) => {
    const stop = onValue(node, async (snap) => {
      const d = (snap.val() as { d?: string } | null)?.d;
      if (!d) return;
      stop();
      try {
        const all = unB64(d);
        const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) as BufferSource }, key, all.slice(12) as BufferSource);
        const j = JSON.parse(new TextDecoder().decode(clear)) as Tokens;
        await signInWithCredential(auth, GoogleAuthProvider.credential(j.i, j.a));
        resolve();
      } catch (e) {
        reject(e);
      }
      remove(node).catch(() => {});
    });
    // On abandonne l'attente au bout de 10 minutes
    setTimeout(() => (stop(), reject(new Error('timeout'))), 600000);
  });
  window.open(`${site}#/relais-google?id=${id}&k=${b64(raw)}`, '_blank');
  return done;
}

/** Côté page relais (navigateur) : connexion Google, puis jeton chiffré déposé pour l'appli. */
export async function relayTokens(id: string, k: string) {
  const before = auth.currentUser;
  const res = await signInWithPopup(auth, new GoogleAuthProvider());
  const c = GoogleAuthProvider.credentialFromResult(res);
  if (!c?.idToken && !c?.accessToken) throw new Error('no token');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(unB64(k), 'encrypt'), new TextEncoder().encode(JSON.stringify({ i: c.idToken ?? null, a: c.accessToken ?? null })));
  const all = new Uint8Array(12 + enc.byteLength);
  all.set(iv);
  all.set(new Uint8Array(enc), 12);
  await set(ref(db, `relaisGoogle/${id}`), { d: b64(all), t: serverTimestamp() });
  // Ce navigateur n'était pas connecté avant : on le laisse comme il était
  if (!before) fbSignOut(auth).catch(() => {});
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
