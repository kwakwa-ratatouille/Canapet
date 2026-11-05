// Relais de secours par Firebase : quand la liaison directe télé ↔ téléphone ne passe pas
// (4G d'un côté, Wi-Fi de l'autre, relais publics saturés…), les messages passent par la base.
// Un peu plus lent (~0,1 s) mais marche partout. Chargé seulement quand on en a besoin.
//   relais/<CODE>/tv        : la télé est là (enlevé quand elle se ferme)
//   relais/<CODE>/u/<id>    : téléphone → télé  { p: joueur, j: message }
//   relais/<CODE>/d/<pid>/<id> : télé → téléphone { j: message }
// Chaque message est effacé dès qu'il est lu.
// Pour écrire moins : les messages sont regroupés toutes les 100 ms, et seule la dernière position du stick est gardée.
import { getApps, initializeApp } from 'firebase/app';
import { getDatabase, onChildAdded, onDisconnect, push, ref, remove, type Database } from 'firebase/database';
import { CONFIG } from './cloud';

const db = (): Database => getDatabase(getApps()[0] ?? initializeApp(CONFIG));

type Msg = { t?: string; a?: unknown; b?: unknown; c?: unknown; d?: unknown };
const WAIT = 100;
function batcher(write: (json: string) => void) {
  let q: Msg[] = [];
  let timer = 0;
  return (m: unknown) => {
    const n = m as Msg;
    const last = q[q.length - 1];
    // Le stick a seulement bougé : la nouvelle position remplace l'ancienne (un bouton pressé, lui, n'est jamais perdu)
    if (n?.t === 'in' && last?.t === 'in' && n.a === last.a && n.b === last.b && n.c === last.c && n.d === last.d) q[q.length - 1] = n;
    else q.push(n);
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      const list = q;
      q = [];
      write(JSON.stringify(list.length === 1 ? list[0] : list));
    }, WAIT);
  };
}
const each = (json: string, fn: (m: unknown) => void) => {
  const v: unknown = JSON.parse(json);
  if (Array.isArray(v)) v.forEach(fn);
  else fn(v);
};

export interface Relay {
  send(m: unknown): void;
  stop(): void;
}

/** Côté télé : reçoit les messages de tous les téléphones passés par le relais. */
export function tvRelay(code: string, onMsg: (pid: string, m: unknown) => void): { send(pid: string, m: unknown): void; stop(): void } {
  const d = db();
  // Tout s'efface quand la télé se ferme
  void onDisconnect(ref(d, `relais/${code}`)).remove().catch(() => {});
  const downs = new Map<string, (m: unknown) => void>();
  const stop = onChildAdded(ref(d, `relais/${code}/u`), (snap) => {
    const v = snap.val() as { p?: string; j?: string } | null;
    void remove(snap.ref).catch(() => {});
    if (!v?.p || !v.j) return;
    try {
      each(v.j, (m) => onMsg(v.p!, m));
    } catch {
      /* message abîmé */
    }
  });
  return {
    send: (pid, m) => {
      let send = downs.get(pid);
      if (!send) downs.set(pid, (send = batcher((j) => void push(ref(d, `relais/${code}/d/${pid}`), { j }).catch(() => {}))));
      send(m);
    },
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
      each(v.j, onMsg);
    } catch {
      /* message abîmé */
    }
  });
  return {
    send: batcher((j) => void push(ref(d, `relais/${code}/u`), { p: pid, j }).catch(() => {})),
    stop: () => {
      stop();
      void remove(mine).catch(() => {});
    },
  };
}
