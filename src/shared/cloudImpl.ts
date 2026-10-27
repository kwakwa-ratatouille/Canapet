// Partie Firebase de cloud.ts (chargée seulement quand on en a besoin).
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type Auth } from 'firebase/auth';
import { get, getDatabase, ref, set, type Database } from 'firebase/database';
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
