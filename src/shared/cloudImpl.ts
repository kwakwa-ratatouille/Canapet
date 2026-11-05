// Partie Firebase de cloud.ts (chargée seulement quand on en a besoin).
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { deleteUser, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type Auth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { get, getDatabase, goOffline, goOnline, onValue, ref, remove, serverTimestamp, set, type Database, type DataSnapshot, update, runTransaction } from 'firebase/database';
import type { CloudUser } from './cloud';
import type { Progress } from './progress';

let app: FirebaseApp;
let auth: Auth;
let db: Database;

export function init(config: Record<string, string>) {
  app = getApps()[0] ?? initializeApp(config);
  auth = getAuth(app);
  db = getDatabase(app);
  // Appli en arrière-plan depuis 30 s : on coupe la connexion à la base, elle reprend au retour
  let sleep = 0;
  document.addEventListener('visibilitychange', () => {
    clearTimeout(sleep);
    if (document.visibilityState === 'hidden') sleep = window.setTimeout(() => goOffline(db), 30000);
    else goOnline(db);
  });
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
  await remove(ref(db, `social/${u.uid}`)).catch(() => {});
  await remove(ref(db, `friends/${u.uid}`)).catch(() => {});
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
    try {
      localStorage.setItem('gauth-back', location.hash);
    } catch {
      /* rien */
    }
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

/** Prépare le paiement sur le site et rend l'adresse de la page de paiement Stripe. */
export async function createCheckout(product: string, consent: boolean) {
  const res = await httpsCallable<{ product: string; consent: boolean }, { url: string }>(getFunctions(app, 'europe-west1'), 'createCheckout')({ product, consent });
  return res.data.url;
}

/** Achats de ce compte (seul le serveur peut les écrire). */
export async function loadItems(uid: string) {
  return Object.keys(((await get(ref(db, `entitlements/${uid}`))).val() as Record<string, unknown> | null) ?? {});
}

/** Clés du coffre sur ce compte (seul le serveur peut les changer). */
export async function loadKeys(uid: string) {
  return Number((await get(ref(db, `keys/${uid}/n`))).val()) || 0;
}

/** Le serveur retire une clé, tire le gain et l'inscrit sur le compte. */
export async function openChest(owned: string[]) {
  const res = await httpsCallable<{ owned: string[] }, { key: string | null; rarity: 'legendaire' | 'mythique'; pity: number }>(getFunctions(app, 'europe-west1'), 'openChest')({ owned });
  return res.data;
}

// ——— Amis ———
const me = () => {
  const u = auth.currentUser;
  if (!u) throw new Error('connexion');
  return u.uid;
};
const FRIEND_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Mon code ami : créé la première fois, gardé ensuite. */
export async function myFriendCode() {
  const uid = me();
  const cur = (await get(ref(db, `social/${uid}/code`))).val() as string | null;
  if (cur) return cur;
  for (let i = 0; i < 8; i++) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => FRIEND_LETTERS[b % FRIEND_LETTERS.length]).join('');
    const tx = await runTransaction(ref(db, `friendCodes/${code}`), (v) => (v ? undefined : uid));
    if (tx.committed) {
      await set(ref(db, `social/${uid}/code`), code);
      return code;
    }
  }
  throw new Error('code');
}

export async function publishPresence(p: { name: string; food: string; color: string; hat?: string; room: string }) {
  await update(ref(db, `social/${me()}`), { name: p.name.slice(0, 20), food: p.food, color: p.color, hat: p.hat ?? 'aucun', room: p.room, seen: serverTimestamp() });
}

export async function addFriend(code: string) {
  const uid = me();
  const other = (await get(ref(db, `friendCodes/${code}`))).val() as string | null;
  if (!other) throw new Error('inconnu');
  if (other === uid) throw new Error('moi');
  await update(ref(db), { [`friends/${uid}/${other}`]: true, [`friends/${other}/${uid}`]: true });
  return ((await get(ref(db, `social/${other}/name`))).val() as string | null) ?? '?';
}

export async function removeFriend(other: string) {
  const uid = me();
  await update(ref(db), { [`friends/${uid}/${other}`]: null, [`friends/${other}/${uid}`]: null });
}

export async function inviteFriend(other: string, room: string) {
  const uid = me();
  const name = ((await get(ref(db, `social/${uid}/name`))).val() as string | null) ?? '?';
  await set(ref(db, `invites/${other}/${uid}`), { name, code: room, at: Date.now() });
}
export const dropInvite = (from: string) => remove(ref(db, `invites/${me()}/${from}`));

/** Liste d'amis, relue toutes les minutes pour savoir qui est en ligne (pas si l'appli est cachée). */
export function friendsWatch(cb: (l: { uid: string; name: string; food: string; color: string; hat?: string; seen: number; room?: string }[]) => void) {
  let ids: string[] = [];
  const read = async () => {
    const all = await Promise.all(ids.map(async (uid) => ({ uid, v: (await get(ref(db, `social/${uid}`))).val() as { name?: string; food?: string; color?: string; hat?: string; seen?: number; room?: string } | null })));
    cb(all.map(({ uid, v }) => ({ uid, name: v?.name ?? '?', food: v?.food ?? 'coussin', color: v?.color ?? '#ff4f9a', hat: v?.hat, seen: v?.seen ?? 0, room: v?.room })));
  };
  const off = onValue(ref(db, `friends/${me()}`), (s) => {
    ids = Object.keys((s.val() as Record<string, boolean> | null) ?? {});
    void read();
  }, () => {});
  const id = setInterval(() => {
    if (document.visibilityState === 'visible') void read().catch(() => {});
  }, 60000);
  return () => {
    off();
    clearInterval(id);
  };
}

export function invitesWatch(cb: (l: { from: string; name: string; code: string; at: number }[]) => void) {
  return onValue(ref(db, `invites/${me()}`), (s) => {
    const v = (s.val() as Record<string, { name: string; code: string; at: number }> | null) ?? {};
    cb(Object.entries(v).map(([from, i]) => ({ from, ...i })));
  }, () => {});
}

export async function load(uid: string): Promise<Partial<Progress> | null> {
  const snap = await get(ref(db, `players/${uid}/progress`));
  return snap.exists() ? (snap.val() as Partial<Progress>) : null;
}

let lastSaved = '';
export async function save(uid: string, p: Progress) {
  // Rien n'a changé depuis la dernière sauvegarde : pas d'écriture
  const body = { xp: p.xp, coins: p.coins, owned: p.owned, games: p.games, wins: p.wins };
  const sum = uid + JSON.stringify(body);
  if (sum === lastSaved) return;
  await set(ref(db, `players/${uid}/progress`), { ...body, updated: Date.now() });
  lastSaved = sum;
}
