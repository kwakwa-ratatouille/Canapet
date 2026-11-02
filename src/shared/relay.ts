// Relais de secours par Firebase : quand la liaison directe télé ↔ téléphone ne passe pas
// (4G d'un côté, Wi-Fi de l'autre, relais publics saturés…), les messages passent par la base.
// Un peu plus lent (~0,1 s) mais marche partout. Chargé seulement quand on en a besoin.
//   relais/<CODE>/tv        : la télé est là (enlevé quand elle se ferme)
//   relais/<CODE>/u/<id>    : téléphone → télé  { p: joueur, j: message }
//   relais/<CODE>/d/<pid>/<id> : télé → téléphone { j: message }
// Chaque message est effacé dès qu'il est lu.
import { getApps, initializeApp } from 'firebase/app';
import { getDatabase, onChildAdded, onDisconnect, push, ref, remove, serverTimestamp, set, type Database } from 'firebase/database';
import { CONFIG } from './cloud';

const db = (): Database => getDatabase(getApps()[0] ?? initializeApp(CONFIG));

export interface Relay {
  send(m: unknown): void;
  stop(): void;
}

/** Côté télé : reçoit les messages de tous les téléphones passés par le relais. */
export function tvRelay(code: string, onMsg: (pid: string, m: unknown) => void): { send(pid: string, m: unknown): void; stop(): void } {
  const d = db();
  const here = ref(d, `relais/${code}/tv`);
  void set(here, serverTimestamp()).catch(() => {});
  void onDisconnect(here).remove().catch(() => {});
  // Restes d'une ancienne partie avec le même code
  void remove(ref(d, `relais/${code}/u`)).catch(() => {});
  void remove(ref(d, `relais/${code}/d`)).catch(() => {});
  const stop = onChildAdded(ref(d, `relais/${code}/u`), (snap) => {
    const v = snap.val() as { p?: string; j?: string } | null;
    void remove(snap.ref).catch(() => {});
    if (!v?.p || !v.j) return;
    try {
      onMsg(v.p, JSON.parse(v.j));
    } catch {
      /* message abîmé */
    }
  });
  return {
    send: (pid, m) => void push(ref(d, `relais/${code}/d/${pid}`), { j: JSON.stringify(m) }).catch(() => {}),
    stop: () => {
      stop();
      void remove(ref(d, `relais/${code}`)).catch(() => {});
    },
  };
}

/** Côté téléphone : envoie à la télé et reçoit ce qu'elle lui renvoie. */
export function padRelay(code: string, pid: string, onMsg: (m: unknown) => void): Relay {
  const d = db();
  const mine = ref(d, `relais/${code}/d/${pid}`);
  void remove(mine).catch(() => {});
  void onDisconnect(mine).remove().catch(() => {});
  const stop = onChildAdded(mine, (snap) => {
    const v = snap.val() as { j?: string } | null;
    void remove(snap.ref).catch(() => {});
    if (!v?.j) return;
    try {
      onMsg(JSON.parse(v.j));
    } catch {
      /* message abîmé */
    }
  });
  return {
    send: (m) => void push(ref(d, `relais/${code}/u`), { p: pid, j: JSON.stringify(m) }).catch(() => {}),
    stop: () => {
      stop();
      void remove(mine).catch(() => {});
    },
  };
}
