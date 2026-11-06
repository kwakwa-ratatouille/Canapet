// Côté téléphone : connexion directe à la télé dont l'identifiant contient le code.
import Peer, { type DataConnection } from 'peerjs';
import { ICE_SERVERS, PEER_PREFIX, type ToPad, type ToTv } from '../shared/protocol';
import { localLink } from '../shared/noTv';
import type { Relay } from '../shared/relay';

/** Pour tester : #/m/CODE?relais=1 passe tout de suite par le relais, sans liaison directe. */
const FORCE_RELAY = /[?&]relais=1/.test(location.hash);

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
  /** Vrai quand on passe par le relais de secours (Firebase) au lieu de la liaison directe. */
  viaRelay = false;
  private relay?: Relay | null;
  private tick = 0;
  private lastIn = '';
  private lastInAt = 0;
  private triedAt = Date.now();
  private directAt = 0;
  private peer?: Peer;
  private conn?: DataConnection;
  private lastPong = 0;
  private dialedAt = 0;
  private timer = 0;
  private stopped = false;
  private lostAt = 0;

  constructor(private code: string, private h: Handlers) {}

  /** Sans télé, sur le téléphone de l'hôte : la session est juste à côté. */
  private local = false;

  start() {
    if (localLink.code && localLink.code === this.code && localLink.toTv) {
      this.local = true;
      localLink.toPad = (m) => queueMicrotask(() => !this.stopped && this.receive(m));
      this.set('ok');
      this.send(this.h.hello());
      this.timer = window.setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 2000);
      return;
    }
    if (FORCE_RELAY) {
      this.useRelay();
      this.timer = window.setInterval(() => this.watch(), 2000);
      return;
    }
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
    this.relay?.stop();
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
      // La liaison directe repasse : on quitte le relais
      this.viaRelay = false;
      this.set('ok');
      c.send(this.h.hello());
      this.ping();
    });
    c.on('data', (d) => this.receive(d as ToPad));
    c.on('close', () => {
      if (this.conn === c && this.status === 'ok' && !this.viaRelay) this.set('lost', 'canal fermé');
    });
    c.on('error', (e) => {
      if (this.conn === c && this.status === 'ok' && !this.viaRelay) this.set('lost', `erreur canal ${String((e as Error)?.message ?? e).slice(0, 40)}`);
    });
  }

  private receive(m: ToPad) {
    if (m.t === 'pong') {
      this.lastPong = Date.now();
      this.rtt = Math.round(performance.now() - m.ts);
      if (this.viaRelay && this.status !== 'ok') this.set('ok');
      this.h.onStatus();
    } else this.h.onMsg(m);
  }

  /** La liaison directe ne passe pas depuis un moment : on bascule sur le relais de secours. */
  private useRelay() {
    if (this.viaRelay || this.stopped) return;
    this.viaRelay = true;
    const hello = this.h.hello();
    const pid = hello.t === 'hello' ? hello.pid : '';
    const go = (r: Relay) => {
      r.send(hello);
      this.ping();
    };
    if (this.relay) return go(this.relay);
    if (this.relay === null) return;
    this.relay = null;
    import('../shared/relay')
      .then((m) => {
        if (this.stopped) return;
        this.relay = m.padRelay(this.code, pid, (d) => this.receive(d as ToPad));
        if (this.viaRelay) go(this.relay);
      })
      .catch(() => {
        this.relay = undefined;
        this.viaRelay = false;
      });
  }

  private ping() {
    this.send({ t: 'ping', ts: performance.now() });
  }

  /** Toutes les 2 s : ping, et nouvel essai si la télé ne répond plus. */
  private watch() {
    if (this.stopped) return;
    if (this.status === 'ok') {
      // Sur le relais, chaque ping est une écriture : un toutes les 6 s suffit
      this.tick++;
      if (!this.viaRelay || this.tick % 3 === 0) this.ping();
      if (this.viaRelay) {
        // Sur le relais : on retente la liaison directe de temps en temps (plus rapide)
        if (!FORCE_RELAY && Date.now() - this.directAt > 20000) {
          this.directAt = Date.now();
          this.dial();
        }
        if (Date.now() - this.lastPong > 14000) this.set('lost', 'relais muet');
        return;
      }
      if (Date.now() - this.lastPong > 10000 && !this.conn?.open) this.set('lost', 'canal mort');
      else if (Date.now() - this.lastPong > 14000) this.set('lost', 'la télé ne répond plus');
      return;
    }
    // Pas de liaison directe après 8 s (au début ou après une coupure) : relais de secours
    if (Date.now() - Math.max(this.triedAt, this.lostSince) > 8000) this.useRelay();
    if (this.viaRelay) this.ping();
    if (Date.now() - this.dialedAt > 3000 && !FORCE_RELAY) this.redial();
  }

  send(m: ToTv) {
    if (this.local) {
      queueMicrotask(() => localLink.toTv?.(m));
      return;
    }
    if (this.conn?.open) this.conn.send(m);
    else if (this.viaRelay) {
      // Le renvoi régulier du stick ne sert à rien tant que rien n'a bougé : une fois par seconde suffit
      if (m.t === 'in') {
        const sum = JSON.stringify(m);
        const now = Date.now();
        if (sum === this.lastIn && now - this.lastInAt < 1000) return;
        this.lastIn = sum;
        this.lastInAt = now;
      }
      this.relay?.send(m);
    }
  }
}
