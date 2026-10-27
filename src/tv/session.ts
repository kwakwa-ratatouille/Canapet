// La soirée côté télé : joueurs, enchaînement des jeux, scores. La télé fait autorité.
import { GAMES, gameById, playable } from '../games/registry';
import type { GameDef, GameInstance, Runner } from '../games/types';
import { COLORS, FOODS, HATS, selfieImage } from '../shared/characters';
import { LIGHT, newId } from '../shared/device';
import { defaultLang, t } from '../shared/i18n';
import type { Lang, PadScreen, Profile, ToTv } from '../shared/protocol';
import { playMusic, sfx, speak } from '../shared/sound';
import { TvNet } from './net';

export interface Player extends Profile {
  pid: string;
  connected: boolean;
  fake: boolean;
  joinedAt: number;
  total: number;
  lastSeen: number;
}

export type Phase = 'lobby' | 'game' | 'results' | 'podium';

export interface ResultRow {
  pid: string;
  profile: Profile;
  bot: boolean;
  rank: number;
  points: number;
}

const POINTS = [10, 7, 5, 4, 3, 2];
const STEP = 1 / 60;
const INTRO = 2.6;
const COUNT = 3;
export const TOURNAMENT_LEN = 5;
const MAX_PLAYERS = 12;

export class Session {
  players = new Map<string, Player>();
  phase: Phase = 'lobby';
  mode: 'host' | 'tournament' = 'host';
  plan: string[] = [];
  step = 0;
  def: GameDef | null = null;
  game: GameInstance | null = null;
  runners: Runner[] = [];
  results: ResultRow[] = [];
  /** Secondes depuis le lancement du jeu (intro + compte à rebours compris). */
  clock = 0;
  net: TvNet;
  private acc = 0;
  private last = 0;
  private listeners = new Set<() => void>();
  private announced = false;
  private lastCount = 0;
  version = 0;

  constructor(preview: boolean) {
    this.net = new TvNet({
      onMsg: (pid, m) => this.onMsg(pid, m),
      onLeave: (pid) => this.onLeave(pid),
      onStatus: () => this.changed(),
    });
    this.net.start();
    if (preview) {
      ['Momo', 'Lulu', 'Zaza'].forEach((name, i) =>
        this.addPlayer(`fake${i}`, {
          name,
          food: FOODS[i + 1].id,
          color: COLORS[i * 3],
          hat: HATS[i + 1].id,
          acc: 'aucun',
          lang: 'fr',
        }, true),
      );
    }
    playMusic('lobby');
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  changed() {
    this.version++;
    this.listeners.forEach((f) => f());
  }

  // ——— Joueurs ———

  list(): Player[] {
    return [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  }

  hostPid(): string | null {
    return this.list().find((p) => p.connected && !p.fake)?.pid ?? this.list().find((p) => p.connected)?.pid ?? null;
  }

  lang(): Lang {
    const h = this.hostPid();
    return (h && this.players.get(h)?.lang) || defaultLang();
  }

  private freeColor(want: string, pid: string): string {
    const taken = new Set(this.list().filter((p) => p.pid !== pid).map((p) => p.color));
    if (!taken.has(want)) return want;
    return COLORS.find((c) => !taken.has(c)) ?? want;
  }

  private addPlayer(pid: string, profile: Profile, fake = false) {
    const existing = this.players.get(pid);
    const p: Player = {
      ...profile,
      name: clean(profile.name),
      color: this.freeColor(profile.color, pid),
      pid,
      connected: true,
      fake,
      joinedAt: existing?.joinedAt ?? performance.now() + this.players.size,
      total: existing?.total ?? 0,
      lastSeen: performance.now(),
    };
    this.players.set(pid, p);
    if (!existing) sfx.join();
    if (!fake) this.net.send(pid, { t: 'welcome', color: p.color, code: this.net.code });
    this.changed();
    this.pushScreens();
  }

  private onLeave(pid: string) {
    const p = this.players.get(pid);
    if (!p || !p.connected) return;
    p.connected = false;
    sfx.leave();
    this.changed();
    this.pushScreens();
  }

  private onMsg(pid: string, m: ToTv) {
    const p = this.players.get(pid);
    if (p) p.lastSeen = performance.now();
    switch (m.t) {
      case 'hello':
        if (!p && this.players.size >= MAX_PLAYERS && this.phase === 'lobby') this.removeStale(true);
        this.addPlayer(pid, m.profile);
        return;
      case 'profile':
        if (!p) return;
        Object.assign(p, m.profile, { name: clean(m.profile.name), color: this.freeColor(m.profile.color, pid) });
        if (p.color !== m.profile.color) this.net.send(pid, { t: 'welcome', color: p.color, code: this.net.code });
        this.changed();
        this.pushScreens();
        return;
      case 'tap':
      case 'in':
      case 'act':
        if (this.phase === 'game' && this.game && this.clock >= INTRO + COUNT) this.game.input(pid, m);
        return;
      case 'host':
        if (pid !== this.hostPid()) return;
        this.hostAction(m.action, m.game);
        return;
    }
  }

  /** Commandes de l'hôte (téléphone) ou du clavier de la télé. */
  hostAction(action: string, game?: string) {
    switch (action) {
      case 'tournament': {
        // Seulement les jeux jouables avec le nombre de joueurs présents (les bots complètent quand le jeu le permet).
        const count = this.list().filter((p) => p.connected).length;
        const fit = playable().filter((g) => Math.max(count, g.botFill) >= g.min);
        const pool = (fit.length ? fit : playable()).map((g) => g.id);
        this.plan = [];
        for (let i = 0; i < TOURNAMENT_LEN; i++) {
          const options = pool.filter((id) => id !== this.plan[i - 1]);
          const from = options.length ? options : pool;
          this.plan.push(from[Math.floor(Math.random() * from.length)]);
        }
        this.mode = 'tournament';
        this.step = 0;
        this.players.forEach((p) => (p.total = 0));
        this.startGame(this.plan[0]);
        break;
      }
      case 'pick':
        if (game && gameById(game) && !gameById(game)!.soon) {
          this.mode = 'host';
          this.startGame(game);
        }
        break;
      case 'replay':
        if (this.def && (this.phase === 'results' || this.phase === 'game')) this.startGame(this.def.id);
        break;
      case 'next':
        if (this.phase !== 'results') break;
        if (this.mode === 'tournament') {
          this.step++;
          if (this.step < this.plan.length) this.startGame(this.plan[this.step]);
          else this.showPodium();
        } else this.toLobby();
        break;
      case 'lobby':
        this.toLobby();
        break;
    }
  }

  private toLobby() {
    this.phase = 'lobby';
    this.game = null;
    this.mode = 'host';
    playMusic('lobby');
    this.removeStale(false);
    this.changed();
    this.pushScreens();
  }

  private removeStale(force: boolean) {
    const now = performance.now();
    for (const p of this.list())
      if (!p.connected && (force || now - p.lastSeen > 30000)) this.players.delete(p.pid);
  }

  // ——— Partie ———

  startGame(id: string) {
    const def = gameById(id);
    if (!def?.create) return;
    const humans = this.list().filter((p) => p.connected).slice(0, def.max);
    const runners: Runner[] = humans.map((p) => ({ pid: p.pid, profile: p, bot: p.fake, selfie: selfieImage(p.selfie) }));
    const used = new Set(runners.map((r) => r.profile.color));
    const foods = FOODS.map((f) => f.id).sort(() => Math.random() - 0.5);
    for (let i = 0; runners.length < Math.min(def.botFill, def.max); i++) {
      const color = COLORS.find((c) => !used.has(c)) ?? COLORS[i];
      used.add(color);
      const food = foods[i % foods.length];
      runners.push({
        pid: newId(),
        bot: true,
        selfie: null,
        profile: { name: `${t(this.lang(), 'bot')} ${i + 1}`, food, color, hat: 'aucun', acc: 'aucun', lang: 'fr' },
      });
    }
    this.def = def;
    this.runners = runners;
    this.game = def.create(runners, {
      lang: this.lang(),
      light: LIGHT,
      buzz: (pid, ms) => this.net.send(pid, { t: 'buzz', ms }),
      refresh: () => this.pushScreens(),
    });
    this.phase = 'game';
    this.clock = 0;
    this.acc = 0;
    this.announced = false;
    this.lastCount = 0;
    playMusic(def.music);
    speak(def.name[this.lang()], this.lang());
    this.changed();
    this.pushScreens();
  }

  private endGame() {
    if (!this.game) return;
    const order = this.game.ranking();
    let rank = 0;
    this.results = order.map((pid) => {
      const r = this.runners.find((x) => x.pid === pid)!;
      rank++;
      const points = POINTS[rank - 1] ?? 1;
      const p = this.players.get(pid);
      if (p && !r.bot) p.total += points;
      return { pid, profile: r.profile, bot: r.bot, rank, points };
    });
    this.phase = 'results';
    playMusic('lobby');
    sfx.win();
    this.changed();
    this.pushScreens();
  }

  private showPodium() {
    this.phase = 'podium';
    playMusic('podium');
    const top = this.list().sort((a, b) => b.total - a.total)[0];
    if (top) speak(this.lang() === 'fr' ? `Et le grand gagnant est… ${top.name} !` : `And the big winner is… ${top.name}!`, this.lang());
    sfx.pet();
    this.changed();
    this.pushScreens();
  }

  /** Appelée à chaque image : avance la logique à pas fixe de 1/60 s. */
  frame(now: number) {
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0;
    this.last = now;
    this.watchdog(now);
    if (this.phase !== 'game' || !this.game) return;
    this.acc += dt;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.clock += STEP;
      const c = Math.ceil(INTRO + COUNT - this.clock);
      if (this.clock > INTRO && c !== this.lastCount && c >= 0) {
        this.lastCount = c;
        if (c > 0) sfx.tick();
        else sfx.go();
      }
      if (this.clock >= INTRO + COUNT) this.game.update(STEP);
      const lead = this.game.leader?.();
      if (lead && !this.announced) {
        this.announced = true;
        speak(this.lang() === 'fr' ? `${lead} gagne !` : `${lead} wins!`, this.lang());
      }
      if (this.game.over) {
        this.endGame();
        return;
      }
    }
  }

  /** Un téléphone qui ne donne plus de nouvelles depuis 9 s est considéré parti. */
  private watchdog(now: number) {
    for (const p of this.players.values())
      if (p.connected && !p.fake && now - p.lastSeen > 9000) {
        this.net.drop(p.pid);
        this.onLeave(p.pid);
      }
  }

  introState(): { title: number; count: number } {
    return { title: Math.max(0, INTRO - this.clock), count: INTRO + COUNT - this.clock };
  }

  // ——— Écrans des manettes ———

  pushScreens() {
    for (const p of this.players.values()) if (p.connected && !p.fake) this.net.send(p.pid, { t: 'screen', screen: this.screenFor(p) });
  }

  private screenFor(p: Player): PadScreen {
    const host = p.pid === this.hostPid();
    const hostP = this.players.get(this.hostPid() ?? '');
    const playing = this.runners.some((r) => r.pid === p.pid);
    const step = this.mode === 'tournament' ? { index: this.step + 1, count: this.plan.length } : null;
    switch (this.phase) {
      case 'lobby':
        return {
          s: 'lobby',
          host,
          hostName: hostP?.name ?? '',
          taken: this.list().filter((x) => x.pid !== p.pid).map((x) => x.color),
          games: GAMES_INFO(),
          count: this.list().filter((x) => x.connected).length,
        };
      case 'game':
        return playing ? { s: 'play', layout: this.def!.layout, game: this.def!.id, data: this.game?.padData?.(p.pid) } : { s: 'wait', game: this.def!.id };
      case 'results': {
        const row = this.results.find((r) => r.pid === p.pid);
        if (!row && !host) return { s: 'wait', game: this.def?.id ?? '' };
        return { s: 'results', host, rank: row?.rank ?? 0, points: row?.points ?? 0, total: p.total, step };
      }
      case 'podium': {
        const rank = this.list().sort((a, b) => b.total - a.total).findIndex((x) => x.pid === p.pid) + 1;
        return { s: 'podium', host, rank, total: p.total };
      }
    }
  }
}

const GAMES_INFO = () => GAMES.map((g) => ({ id: g.id, soon: !!g.soon }));

function clean(name: string): string {
  return (name || '').replace(/\s+/g, ' ').trim().slice(0, 14) || '???';
}
