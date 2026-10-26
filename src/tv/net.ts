// Côté télé : un « pair » PeerJS dont l'identifiant contient le code du salon.
// Les téléphones s'y connectent en direct (WebRTC DataChannel).
import Peer, { type DataConnection } from 'peerjs';
import { PEER_PREFIX, randomCode, type ToPad, type ToTv } from '../shared/protocol';

export type NetStatus = 'connecting' | 'ready' | 'error';

interface Handlers {
  onMsg(pid: string, m: ToTv): void;
  onLeave(pid: string): void;
  onStatus(): void;
}

export class TvNet {
  code = '';
  status: NetStatus = 'connecting';
  error = '';
  private peer?: Peer;
  private byPid = new Map<string, DataConnection>();
  private pidOf = new Map<DataConnection, string>();
  private tries = 0;

  constructor(private h: Handlers) {}

  start() {
    let code = '';
    try {
      code = sessionStorage.getItem('canapet.tvcode') || '';
    } catch {
      /* rien */
    }
    this.open(code || randomCode());
  }

  private open(code: string) {
    this.code = code;
    try {
      sessionStorage.setItem('canapet.tvcode', code);
    } catch {
      /* rien */
    }
    this.status = 'connecting';
    this.h.onStatus();
    const peer = new Peer(PEER_PREFIX + code, { debug: 1 });
    this.peer = peer;
    peer.on('open', () => {
      this.tries = 0;
      this.status = 'ready';
      this.error = '';
      this.h.onStatus();
    });
    peer.on('connection', (c) => this.accept(c));
    peer.on('disconnected', () => {
      if (!peer.destroyed) setTimeout(() => !peer.destroyed && peer.reconnect(), 1500);
    });
    peer.on('error', (e: Error & { type?: string }) => {
      const type = e.type || e.message;
      if (type === 'peer-unavailable') return;
      if (type === 'unavailable-id') {
        // Après un rechargement, le serveur garde l'ancien code quelques secondes : on réessaie puis on change.
        peer.destroy();
        this.tries++;
        setTimeout(() => this.open(this.tries < 4 ? code : randomCode()), 1500);
        return;
      }
      this.status = 'error';
      this.error = String(type);
      this.h.onStatus();
      if (!peer.destroyed && ['network', 'server-error', 'socket-error', 'socket-closed'].includes(String(type))) {
        peer.destroy();
        setTimeout(() => this.open(code), 3000);
      }
    });
  }

  private accept(c: DataConnection) {
    c.on('data', (d) => {
      const m = d as ToTv;
      if (!m || typeof m !== 'object') return;
      if (m.t === 'ping') {
        c.send({ t: 'pong', ts: m.ts } satisfies ToPad);
        const pid = this.pidOf.get(c);
        if (pid) this.h.onMsg(pid, m);
        return;
      }
      if (m.t === 'hello') {
        const old = this.byPid.get(m.pid);
        if (old && old !== c) {
          this.pidOf.delete(old);
          old.close();
        }
        this.byPid.set(m.pid, c);
        this.pidOf.set(c, m.pid);
      }
      const pid = this.pidOf.get(c);
      if (pid) this.h.onMsg(pid, m);
    });
    const gone = () => {
      const pid = this.pidOf.get(c);
      this.pidOf.delete(c);
      if (pid && this.byPid.get(pid) === c) {
        this.byPid.delete(pid);
        this.h.onLeave(pid);
      }
    };
    c.on('close', gone);
    c.on('error', gone);
  }

  send(pid: string, m: ToPad) {
    const c = this.byPid.get(pid);
    if (c?.open) c.send(m);
  }

  drop(pid: string) {
    const c = this.byPid.get(pid);
    if (c) {
      this.byPid.delete(pid);
      this.pidOf.delete(c);
      c.close();
    }
  }
}
