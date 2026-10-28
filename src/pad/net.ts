// Côté téléphone : connexion directe à la télé dont l'identifiant contient le code.
import Peer, { type DataConnection } from 'peerjs';
import { ICE_SERVERS, PEER_PREFIX, type ToPad, type ToTv } from '../shared/protocol';

export type PadStatus = 'connecting' | 'ok' | 'lost' | 'notfound';

interface Handlers {
  hello(): ToTv;
  onMsg(m: ToPad): void;
  onStatus(): void;
}

export class PadNet {
  status: PadStatus = 'connecting';
  rtt = 0;
  /** Pourquoi la dernière coupure (affiché en petit pour comprendre les soucis). */
  why = '';
  /** Moment où la liaison a été perdue (0 = pas perdue). */
  lostSince = 0;
  private peer?: Peer;
  private conn?: DataConnection;
  private lastPong = 0;
  private dialedAt = 0;
  private timer = 0;
  private stopped = false;
  private lostAt = 0;

  constructor(private code: string, private h: Handlers) {}

  start() {
    const peer = new Peer({ debug: 1, config: { iceServers: ICE_SERVERS } });
    this.peer = peer;
    peer.on('open', () => this.dial());
    peer.on('disconnected', () => {
      if (!peer.destroyed && !this.stopped) setTimeout(() => !peer.destroyed && peer.reconnect(), 1000);
    });
    peer.on('error', (e: Error & { type?: string }) => {
      // Les erreurs du serveur d'appairage (réseau, prise coupée…) ne touchent pas la liaison directe avec la télé :
      // on ne dit « perdu » que si le canal se ferme ou si la télé ne répond plus.
      if (e.type === 'peer-unavailable' && this.status !== 'ok') this.set('notfound');
    });
    this.timer = window.setInterval(() => this.watch(), 2000);
    // Retour sur l'appli (écran rallumé, appli rouverte) : on vérifie la liaison tout de suite
    if (!this.started) {
      this.started = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || this.stopped) return;
        if (this.status === 'ok') this.ping();
        else this.redial();
      });
    }
  }

  private started = false;

  /** Nouvel essai : si le pair lui-même est mort ou décroché depuis longtemps, on en refait un neuf. */
  private redial() {
    const p = this.peer;
    if (!p || p.destroyed || (p.disconnected && Date.now() - this.lostAt > 8000)) {
      p?.destroy();
      this.lostAt = Date.now();
      clearInterval(this.timer);
      this.start();
      return;
    }
    if (p.disconnected) p.reconnect();
    else this.dial();
  }

  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    this.conn?.close();
    this.peer?.destroy();
  }

  private set(s: PadStatus, why = '') {
    if (s === 'lost' && this.status !== 'lost') {
      this.lostAt = Date.now();
      this.lostSince = Date.now();
      this.why = `${why} · ${new Date().toLocaleTimeString()}`;
      // On retente tout de suite, sans attendre la prochaine vérification
      setTimeout(() => !this.stopped && this.status === 'lost' && this.redial(), 300);
    }
    if (s === 'ok') this.lostSince = 0;
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
      if (this.conn === c && this.status === 'ok') this.set('lost', 'canal fermé');
    });
    c.on('error', (e) => {
      if (this.conn === c && this.status === 'ok') this.set('lost', `erreur canal ${String((e as Error)?.message ?? e).slice(0, 40)}`);
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
      if (Date.now() - this.lastPong > 10000 && !this.conn?.open) this.set('lost', 'canal mort');
      else if (Date.now() - this.lastPong > 14000) this.set('lost', 'la télé ne répond plus');
      return;
    }
    if (Date.now() - this.dialedAt > 3000) this.redial();
  }

  send(m: ToTv) {
    if (this.conn?.open) this.conn.send(m);
  }
}
