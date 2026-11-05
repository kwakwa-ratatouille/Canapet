// Côté télé : un « pair » PeerJS dont l'identifiant contient le code du salon.
// Les téléphones s'y connectent en direct (WebRTC DataChannel).
import { CONFIG } from '../shared/cloud';
import Peer, { type DataConnection } from 'peerjs';
import { ICE_SERVERS, PEER_PREFIX, randomCode, type ToPad, type ToTv } from '../shared/protocol';

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
  /** Relais de secours (Firebase) et joueurs qui passent par lui. */
  private relay?: { send(pid: string, m: unknown): void; stop(): void };
  private viaRelay = new Set<string>();

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
    const peer = new Peer(PEER_PREFIX + code, { debug: 1, config: { iceServers: ICE_SERVERS } });
    this.peer = peer;
    // Le relais ne dépend pas du serveur d'appairage : il marche même si celui-ci est en panne
    this.startRelay(code);
    peer.on('open', () => {
      this.tries = 0;
      this.status = 'ready';
      this.error = '';
      this.h.onStatus();
    });
    peer.on('connection', (c) => this.accept(c));
    peer.on('disconnected', () => {
      if (!peer.destroyed) setTimeout(() => !peer.destroyed && peer.disconnected && peer.reconnect(), 1500);
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
      const net = ['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(String(type));
      // Des manettes sont branchées : leurs liaisons directes marchent toujours, on se reconnecte en silence
      if (net && this.byPid.size > 0 && !peer.destroyed) {
        setTimeout(() => !peer.destroyed && peer.disconnected && peer.reconnect(), 2000);
        return;
      }
      this.status = 'error';
      this.error = String(type);
      this.h.onStatus();
      if (!peer.destroyed && net) {
        peer.destroy();
        setTimeout(() => this.open(code), 3000);
      }
    });
  }

  private relayCode = '';
  private relayWatch = 0;
  private startRelay(code: string) {
    if (this.relayCode === code) return;
    this.relayCode = code;
    this.relay?.stop();
    this.relay = undefined;
    clearInterval(this.relayWatch);
    // La plupart des parties passent en direct : on regarde juste de temps en temps si un téléphone attend sur le relais,
    // et c'est seulement là qu'on charge Firebase et qu'on ouvre une connexion à la base.
    const url = `${CONFIG.databaseURL}/relais/${code}`;
    let first = true;
    const look = async () => {
      if (this.relayCode !== code || this.relay) return;
      const wasFirst = first;
      first = false;
      try {
        const got: unknown = await (await fetch(`${url}/u.json?shallow=true`)).json();
        if (!got || this.relayCode !== code) return;
        // Restes d'une ancienne partie avec le même code
        if (wasFirst) return void fetch(`${url}.json`, { method: 'DELETE' }).catch(() => {});
        clearInterval(this.relayWatch);
        const r = await import('../shared/relay');
        if (this.relayCode === code) this.relay = r.tvRelay(code, (pid, d) => this.fromRelay(pid, d as ToTv));
      } catch {
        /* pas de réseau : on réessaiera */
      }
    };
    void look();
    this.relayWatch = window.setInterval(() => void look(), 4000);
  }

  private fromRelay(pid: string, m: ToTv) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello' && m.pid !== pid) return;
    this.viaRelay.add(pid);
    if (m.t === 'ping') this.relay?.send(pid, { t: 'pong', ts: m.ts } satisfies ToPad);
    this.h.onMsg(pid, m);
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
        this.viaRelay.delete(m.pid);
      }
      const pid = this.pidOf.get(c);
      if (pid) this.h.onMsg(pid, m);
    });
    const gone = () => {
      const pid = this.pidOf.get(c);
      this.pidOf.delete(c);
      if (pid && this.byPid.get(pid) === c) {
        this.byPid.delete(pid);
        // Le joueur passe aussi par le relais : il n'est pas parti
        if (!this.viaRelay.has(pid)) this.h.onLeave(pid);
      }
    };
    c.on('close', gone);
    c.on('error', gone);
  }

  send(pid: string, m: ToPad) {
    const c = this.byPid.get(pid);
    if (c?.open) c.send(m);
    else if (this.viaRelay.has(pid)) this.relay?.send(pid, m);
  }

  drop(pid: string) {
    this.viaRelay.delete(pid);
    const c = this.byPid.get(pid);
    if (c) {
      this.byPid.delete(pid);
      this.pidOf.delete(c);
      c.close();
    }
  }
}
