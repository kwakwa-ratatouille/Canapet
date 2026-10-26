// Côté téléphone : connexion directe à la télé dont l'identifiant contient le code.
import Peer, { type DataConnection } from 'peerjs';
import { PEER_PREFIX, type ToPad, type ToTv } from '../shared/protocol';

export type PadStatus = 'connecting' | 'ok' | 'lost' | 'notfound';

interface Handlers {
  hello(): ToTv;
  onMsg(m: ToPad): void;
  onStatus(): void;
}

export class PadNet {
  status: PadStatus = 'connecting';
  rtt = 0;
  private peer?: Peer;
  private conn?: DataConnection;
  private lastPong = 0;
  private dialedAt = 0;
  private timer = 0;
  private stopped = false;

  constructor(private code: string, private h: Handlers) {}

  start() {
    const peer = new Peer({ debug: 1 });
    this.peer = peer;
    peer.on('open', () => this.dial());
    peer.on('disconnected', () => {
      if (!peer.destroyed && !this.stopped) setTimeout(() => !peer.destroyed && peer.reconnect(), 1000);
    });
    peer.on('error', (e: Error & { type?: string }) => {
      if (e.type === 'peer-unavailable') this.set('notfound');
      else if (this.status === 'ok') this.set('lost');
    });
    this.timer = window.setInterval(() => this.watch(), 2000);
  }

  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    this.conn?.close();
    this.peer?.destroy();
  }

  private set(s: PadStatus) {
    if (this.status !== s) {
      this.status = s;
      this.h.onStatus();
    }
  }

  private dial() {
    if (!this.peer || this.peer.destroyed || this.peer.disconnected) return;
    this.dialedAt = Date.now();
    this.conn?.close();
    const c = this.peer.connect(PEER_PREFIX + this.code, { reliable: true });
    this.conn = c;
    c.on('open', () => {
      if (this.conn !== c) return;
      this.lastPong = Date.now();
      this.set('ok');
      c.send(this.h.hello());
      this.ping();
    });
    c.on('data', (d) => {
      const m = d as ToPad;
      if (m.t === 'pong') {
        this.lastPong = Date.now();
        this.rtt = Math.round(performance.now() - m.ts);
        this.h.onStatus();
      } else this.h.onMsg(m);
    });
    c.on('close', () => {
      if (this.conn === c && this.status === 'ok') this.set('lost');
    });
  }

  private ping() {
    this.send({ t: 'ping', ts: performance.now() });
  }

  /** Toutes les 2 s : ping, et nouvel essai si la télé ne répond plus. */
  private watch() {
    if (this.stopped) return;
    if (this.status === 'ok') {
      this.ping();
      if (Date.now() - this.lastPong > 7000) this.set('lost');
      return;
    }
    if (Date.now() - this.dialedAt > 4000) this.dial();
  }

  send(m: ToTv) {
    if (this.conn?.open) this.conn.send(m);
  }
}
