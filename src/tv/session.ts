// La soirée côté télé : joueurs, enchaînement des jeux, scores. La télé fait autorité.
import { SKILLS } from '../games/botSkill';
import { GAMES, gameById, playable } from '../games/registry';
import { TEAMS } from '../games/teams';
import { TUTOS } from '../games/tutos';
import type { GameDef, GameInstance, Runner } from '../games/types';
import { COLORS, FOODS, HATS, selfieImage } from '../shared/characters';
import { LIGHT, newId, save, store } from '../shared/device';
import { defaultLang, t } from '../shared/i18n';
import type { Lang, PadScreen, Profile, ToTv } from '../shared/protocol';
import { playMusic, setFamily, setMusicRush, sfx, speak } from '../shared/sound';
import { TvNet } from './net';

export interface Player extends Profile {
  pid: string;
  connected: boolean;
  fake: boolean;
  joinedAt: number;
  total: number;
  lastSeen: number;
  /** Camp choisi pour le mode équipes (0 ou 1). */
  team: number;
}

export type Phase = 'lobby' | 'game' | 'results' | 'podium';

export interface ResultRow {
  pid: string;
  profile: Profile;
  bot: boolean;
  rank: number;
  points: number;
  team?: number;
}

const POINTS = [10, 7, 5, 4, 3, 2];
const STEP = 1 / 60;
const INTRO_SHORT = 2.6;
/** Intro avec tuto : le temps de lire les 3 étapes. */
const INTRO_TUTO = 16;
const COUNT = 3;
export const TOURNAMENT_LEN = 5;
const MAX_PLAYERS = 12;

/** Événements surprises des jeux d'action : quelques secondes de chaos. */
export type EventKind = 'turbo' | 'ralenti' | 'miroir' | 'inverse' | 'disco' | 'seisme';
const EVENTS: Record<EventKind, { dur: number; fr: string; en: string }> = {
  turbo: { dur: 7, fr: 'TURBO ! Tout va plus vite !', en: 'TURBO! Everything speeds up!' },
  ralenti: { dur: 6, fr: 'Ralenti… tout… doucement…', en: 'Slow… mo… tion…' },
  miroir: { dur: 8, fr: 'Effet miroir ! L’écran est à l’envers !', en: 'Mirror mode! The screen is flipped!' },
  inverse: { dur: 7, fr: 'Commandes inversées !', en: 'Controls reversed!' },
  disco: { dur: 7, fr: 'Soirée disco !', en: 'Disco time!' },
  seisme: { dur: 5, fr: 'Tremblement de canapé !', en: 'Sofa quake!' },
};

export class Session {
  players = new Map<string, Player>();
  phase: Phase = 'lobby';
  mode: 'host' | 'tournament' = 'host';
  /** Mode famille (mémorisé sur la télé). */
  family = store('family', false);
  /** Bots ajoutés : -1 = auto (selon le jeu), sinon ce nombre en plus des humains. */
  bots = store('bots', -1);
  /** Niveau des bots : 0 facile, 1 normal, 2 fort. */
  botLevel = store('botLevel', 1);
  /** Mode équipes (Fraise contre Menthe) ; sinon mêlée générale. */
  teams = store('teams', false);
  /** Score des équipes à la dernière partie (moyenne des points de chaque camp). */
  teamScore: { avg: [number, number]; winner: number } | null = null;
  plan: string[] = [];
  step = 0;
  def: GameDef | null = null;
  game: GameInstance | null = null;
  runners: Runner[] = [];
  results: ResultRow[] = [];
  /** Secondes depuis le lancement du jeu (intro + compte à rebours compris). */
  clock = 0;
  /** Durée de l'intro de la partie en cours (plus longue la première fois : tuto). */
  intro = INTRO_SHORT;
  net: TvNet;
  private acc = 0;
  private last = 0;
  private listeners = new Set<() => void>();
  private announced = false;
  private lastCount = 0;
  private lastStatus = 0;
  /** Commentateur : dernier premier annoncé et moment de la dernière annonce. */
  private leadPid = '';
  private lastCall = 0;
  /** Bandeau du commentateur à la télé. */
  toast = { text: '', t: 0 };
  /** Événement surprise en cours (t = secondes restantes). */
  event: { kind: EventKind; t: number; dur: number } | null = null;
  private nextEvent = 0;
  /** Numéro de la dernière partie terminée. */
  private gameNo = 0;
  version = 0;
  /** Secondes restantes de l'écran « Temps écoulé ! » avant les résultats. */
  timeUp = 0;
  /** Partie en pause (l'hôte l'a demandé). */
  paused = false;
  /** Joueurs qui ont appuyé sur un bouton pendant le tuto (« prêt ! »). */
  ready = new Set<string>();

  constructor(preview: boolean) {
    setFamily(this.family);
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
      team: existing?.team ?? this.smallerTeam(),
    };
    this.players.set(pid, p);
    if (!existing) sfx.join();
    if (!fake) this.net.send(pid, { t: 'welcome', color: p.color, code: this.net.code });
    this.changed();
    this.pushScreens();
  }

  /** L'équipe qui a le moins de joueurs (pour équilibrer les arrivées). */
  private smallerTeam(): number {
    const l = this.list().filter((p) => p.connected);
    return l.filter((p) => p.team === 1).length < l.filter((p) => p.team === 0).length ? 1 : 0;
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
        // Les envois de fichiers (Photo Roulette) passent même pendant le tuto
        if (m.t === 'in' && this.event?.kind === 'inverse') m = { ...m, x: -m.x, y: -m.y };
        if (this.phase === 'game' && this.game && (this.clock >= this.intro + COUNT || (m.t === 'act' && m.a === 'up'))) this.game.input(pid, m);
        else if (this.phase === 'game' && this.clock < this.intro && (m.t !== 'in' || m.a || m.b) && !(m.t === 'act' && m.a === 'up')) this.markReady(pid);
        return;
      case 'team':
        if (!p || this.phase !== 'lobby') return;
        p.team = m.n ? 1 : 0;
        sfx.click();
        this.changed();
        this.pushScreens();
        return;
      case 'host':
        if (pid !== this.hostPid()) return;
        this.hostAction(m.action, m.game, m.opts);
        return;
    }
  }

  /** Commandes de l'hôte (téléphone) ou du clavier de la télé. */
  hostAction(action: string, game?: string, opts?: Record<string, number>) {
    switch (action) {
      case 'tournament': {
        // Seulement les jeux jouables avec le nombre de joueurs présents (les bots complètent quand le jeu le permet).
        const count = this.list().filter((p) => p.connected).length;
        // L'hôte peut enlever des jeux (opts = { idDuJeu: 1 })
        const allowed = playable().filter((g) => !opts?.[g.id]);
        const base = allowed.length ? allowed : playable();
        const fit = base.filter((g) => Math.max(count, g.botFill) >= g.min);
        const pool = (fit.length ? fit : base).map((g) => g.id);
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
          this.startGame(game, opts);
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
      case 'family':
        if (this.phase !== 'lobby') break;
        this.family = !this.family;
        setFamily(this.family);
        save('family', this.family);
        speak(this.lang() === 'fr' ? (this.family ? 'Mode famille activé' : 'Mode famille désactivé') : this.family ? 'Family mode on' : 'Family mode off', this.lang());
        this.changed();
        this.pushScreens();
        break;
      case 'pause':
        if (this.phase !== 'game' || this.paused) break;
        this.paused = true;
        playMusic('');
        sfx.tick();
        speak(this.lang() === 'fr' ? 'Pause !' : 'Paused!', this.lang());
        this.changed();
        this.pushScreens();
        break;
      case 'resume':
        if (!this.paused) break;
        this.paused = false;
        if (this.def) playMusic(this.def.music);
        sfx.go();
        this.changed();
        this.pushScreens();
        break;
      case 'teams':
        if (this.phase !== 'lobby') break;
        this.teams = !this.teams;
        save('teams', this.teams);
        speak(this.lang() === 'fr' ? (this.teams ? 'Mode équipes : Fraise contre Menthe !' : 'Mêlée générale !') : this.teams ? 'Teams: Strawberry versus Mint!' : 'Free for all!', this.lang());
        this.changed();
        this.pushScreens();
        break;
      case 'bots':
        if (this.phase !== 'lobby') break;
        this.bots = this.bots >= 7 ? -1 : this.bots + 1;
        save('bots', this.bots);
        this.changed();
        this.pushScreens();
        break;
      case 'botlevel':
        if (this.phase !== 'lobby') break;
        this.botLevel = (this.botLevel + 1) % 3;
        save('botLevel', this.botLevel);
        this.changed();
        this.pushScreens();
        break;
      case 'lobby':
        this.toLobby();
        break;
    }
  }

  private toLobby() {
    this.paused = false;
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

  /** Options du dernier lancement (gardées pour « Rejouer »). */
  private opts: Record<string, number> = {};

  startGame(id: string, opts?: Record<string, number>) {
    const def = gameById(id);
    if (!def?.create) return;
    const humans = this.list().filter((p) => p.connected).slice(0, def.max);
    const runners: Runner[] = humans.map((p) => ({ pid: p.pid, profile: p, bot: p.fake, selfie: selfieImage(p.selfie), team: this.teams ? p.team : undefined }));
    // Une équipe vide alors qu'il y a du monde : on répartit un sur deux.
    if (this.teams && runners.length >= 2 && new Set(runners.map((r) => r.team)).size < 2) runners.forEach((r, i) => (r.team = i % 2));
    const count = (k: number) => runners.filter((r) => r.team === k).length;
    const used = new Set(runners.map((r) => r.profile.color));
    const foods = FOODS.map((f) => f.id).sort(() => Math.random() - 0.5);
    // Auto : le jeu complète comme il veut ; sinon le nombre choisi, mais toujours assez pour jouer
    const want = this.bots < 0 ? def.botFill : runners.length + this.bots;
    for (let i = 0; runners.length < Math.min(Math.max(want, def.min), def.max); i++) {
      const color = COLORS.find((c) => !used.has(c)) ?? COLORS[i];
      used.add(color);
      const food = foods[i % foods.length];
      runners.push({
        pid: newId(),
        bot: true,
        selfie: null,
        profile: { name: `${t(this.lang(), 'bot')} ${i + 1}`, food, color, hat: 'aucun', acc: 'aucun', lang: 'fr' },
        team: this.teams ? (count(1) < count(0) ? 1 : 0) : undefined,
      });
    }
    // Tuto la première fois ; pour « Rejouer » le même jeu, intro courte.
    this.intro = TUTOS[id] && this.def?.id !== id ? INTRO_TUTO : INTRO_SHORT;
    this.def = def;
    this.runners = runners;
    this.game = def.create(runners, {
      lang: this.lang(),
      light: LIGHT,
      family: this.family,
      buzz: (pid, ms) => this.net.send(pid, { t: 'buzz', ms }),
      refresh: () => this.pushScreens(),
      botSkill: SKILLS[this.botLevel] ?? 0.7,
      opts: (() => {
        if (opts) this.opts = opts;
        else if (this.def?.id !== id) this.opts = {};
        const o: Record<string, number> = {};
        for (const op of def.options ?? []) o[op.id] = this.opts[op.id] ?? op.choices[0].v;
        return o;
      })(),
    });
    this.phase = 'game';
    this.leadPid = '';
    this.lastCall = 0;
    this.toast = { text: '', t: 0 };
    this.event = null;
    this.nextEvent = 25 + Math.random() * 10;
    this.paused = false;
    this.lastStatus = 0;
    this.timeUp = 0;
    this.ready = new Set();
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
    this.gameNo++;
    let order = this.game.ranking();
    // Mode équipes : chaque camp marque la moyenne des places de ses joueurs (équitable même à 3 contre 2).
    const teamOf = (pid: string) => this.runners.find((x) => x.pid === pid)?.team;
    this.teamScore = null;
    if (this.runners.some((r) => r.team === 1) && this.runners.some((r) => r.team === 0)) {
      const avg = [0, 1].map((k) => {
        const pts = order.map((pid, i) => (teamOf(pid) === k ? POINTS[i] ?? 1 : -1)).filter((v) => v >= 0);
        return Math.round((pts.reduce((a, b) => a + b, 0) / Math.max(1, pts.length)) * 10) / 10;
      }) as [number, number];
      const winner = avg[0] === avg[1] ? -1 : avg[0] > avg[1] ? 0 : 1;
      this.teamScore = { avg, winner };
      if (winner >= 0) order = [...order.filter((pid) => teamOf(pid) === winner), ...order.filter((pid) => teamOf(pid) !== winner)];
      const fr = this.lang() === 'fr';
      speak(winner < 0 ? (fr ? 'Égalité entre les équipes !' : 'The teams are tied!') : `${TEAMS[winner].name[this.lang()]} ${fr ? 'gagne' : 'wins'} !`, this.lang());
    }
    let rank = 0;
    this.results = order.map((pid) => {
      const r = this.runners.find((x) => x.pid === pid)!;
      rank++;
      const ts = this.teamScore;
      const team = ts ? r.team : undefined;
      const points = ts && team !== undefined ? (ts.winner < 0 ? 7 : ts.winner === team ? 10 : 4) : POINTS[rank - 1] ?? 1;
      if (ts && team !== undefined) rank = ts.winner < 0 || ts.winner === team ? 1 : 2;
      const p = this.players.get(pid);
      // Les faux joueurs de l'aperçu marquent comme des vrais (ils sont pilotés par l'ordinateur, mais présents dans la soirée).
      if (p) p.total += points;
      return { pid, profile: r.profile, bot: !p, rank, points, team: r.team };
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
    const dt = this.last && !this.paused ? Math.max(0, Math.min(0.25, (now - this.last) / 1000)) : 0;
    this.last = now;
    this.watchdog(now);
    if (this.toast.t > 0) this.toast.t -= dt;
    if (this.phase !== 'game' || !this.game || this.paused) return;
    this.acc += dt;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.clock += STEP;
      if (this.clock - STEP < this.intro && this.clock >= this.intro) this.pushScreens();
      const c = Math.ceil(this.intro + COUNT - this.clock);
      if (this.clock > this.intro && c !== this.lastCount && c >= 0) {
        this.lastCount = c;
        if (c > 0) sfx.tick();
        else sfx.go();
      }
      if (this.clock >= this.intro + COUNT) {
        if (this.timeUp > 0) {
          this.timeUp -= STEP;
          if (this.timeUp <= 0) {
            this.endGame();
            return;
          }
          continue;
        }
        // Turbo / ralenti : le jeu avance plus ou moins vite
        const speed = this.event?.kind === 'turbo' ? 1.35 : this.event?.kind === 'ralenti' ? 0.55 : 1;
        this.game.update(STEP * speed);
        this.stepEvent();
        if (this.clock - this.lastStatus >= 1) {
          this.sendStatus();
          this.commentate();
        }
        if (!this.game.over && this.limitTick()) continue;
      }
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

  /** Lance de temps en temps un événement surprise (jeux d'action seulement). */
  private stepEvent() {
    if (this.event) {
      this.event.t -= STEP;
      if (this.event.t <= 0) this.event = null;
      return;
    }
    const action = this.def && (this.def.layout === 'stick' || this.def.layout === 'tap');
    const play = this.clock - this.intro - COUNT;
    const left = this.timeLeft();
    if (!action || play < this.nextEvent || (left !== null && left < 12)) return;
    const kinds = Object.keys(EVENTS) as EventKind[];
    // La course de pouces se joue en tapotant : pas de commandes inversées
    const pool = this.def!.layout === 'tap' ? kinds.filter((k) => k !== 'inverse') : kinds;
    const kind = pool[Math.floor(Math.random() * pool.length)];
    const e = EVENTS[kind];
    this.event = { kind, t: e.dur, dur: e.dur };
    this.nextEvent = play + e.dur + 25 + Math.random() * 15;
    const text = this.lang() === 'fr' ? e.fr : e.en;
    this.toast = { text: '⚡ ' + text, t: 3 };
    speak(text, this.lang());
    sfx.hurry();
  }

  /** Le commentateur réagit quand la tête de course change (pas plus d'une fois toutes les 9 s). */
  private commentate() {
    if (!this.game || !this.runners.length) return;
    const first = this.game.ranking()[0];
    const play = this.clock - this.intro - COUNT;
    if (!first || first === this.leadPid) return;
    const prev = this.leadPid;
    this.leadPid = first;
    if (play < 6 || this.clock - this.lastCall < 9) return;
    this.lastCall = this.clock;
    const n = this.runners.find((r) => r.pid === first)?.profile.name ?? '?';
    const p = this.runners.find((r) => r.pid === prev)?.profile.name ?? '';
    const fr = this.lang() === 'fr';
    const lines = fr
      ? [`${n} prend la tête !`, `Oh là là, ${n} passe devant !`, p ? `${n} double ${p} !` : `${n} est en feu !`, this.family ? `Bravo ${n} !` : `${n} met tout le monde à l’amende !`]
      : [`${n} takes the lead!`, `Whoa, ${n} is in front!`, p ? `${n} overtakes ${p}!` : `${n} is on fire!`, `${n} is showing everyone how it’s done!`];
    const text = lines[Math.floor(Math.random() * lines.length)];
    this.toast = { text, t: 3 };
    speak(text, this.lang());
  }

  /** Envoie à chaque manette sa place du moment et le chrono. */
  private sendStatus() {
    this.lastStatus = this.clock;
    if (!this.game) return;
    const order = this.game.ranking();
    const left = this.timeLeft();
    for (const r of this.runners)
      if (!r.bot) this.net.send(r.pid, { t: 'status', rank: order.indexOf(r.pid) + 1, of: order.length, left: left === null ? null : Math.ceil(left) });
  }

  /** Pendant le tuto : un joueur se dit prêt ; quand tout le monde l'est, on passe au compte à rebours. */
  private markReady(pid: string) {
    if (this.ready.has(pid) || !this.runners.some((r) => r.pid === pid && !r.bot)) return;
    this.ready.add(pid);
    sfx.join();
    this.pushScreens();
    const humans = this.runners.filter((r) => !r.bot);
    if (humans.every((r) => this.ready.has(r.pid)) && this.clock < this.intro - 0.8) this.clock = this.intro - 0.8;
    this.changed();
  }

  /** Secondes de jeu restantes au chrono (null si le jeu n'a pas de temps maximum). */
  timeLeft(): number | null {
    const lim = this.def?.limit;
    if (!lim || this.phase !== 'game') return null;
    return Math.max(0, lim - Math.max(0, this.clock - this.intro - COUNT));
  }

  /** Chrono : annonce à 30 s, tic-tac sur les 10 dernières, puis fin de partie. Vrai quand le temps est écoulé. */
  private limitTick(): boolean {
    const left = this.timeLeft();
    if (left === null) return false;
    const prev = left + STEP;
    const fr = this.lang() === 'fr';
    if (prev > 30 && left <= 30) {
      sfx.hurry();
      setMusicRush(1.18);
      speak(fr ? 'Plus que 30 secondes !' : '30 seconds left!', this.lang());
    }
    if (left > 0 && left <= 10 && Math.ceil(left) !== Math.ceil(prev)) sfx.countdown(Math.ceil(left));
    if (left > 0) return false;
    this.timeUp = 2.2;
    playMusic('');
    sfx.timeUp();
    speak(fr ? 'Temps écoulé !' : "Time's up!", this.lang());
    return true;
  }

  /** Un téléphone qui ne donne plus de nouvelles depuis 9 s est considéré parti. */
  private watchdog(now: number) {
    for (const p of this.players.values())
      if (p.connected && !p.fake && now - p.lastSeen > 9000) {
        this.net.drop(p.pid);
        this.onLeave(p.pid);
      }
  }

  introState(): { title: number; count: number; tutoLeft: number } {
    return { title: Math.max(0, this.intro - this.clock), tutoLeft: this.intro === INTRO_TUTO ? Math.max(0, this.intro - this.clock) / INTRO_TUTO : 0, count: this.intro + COUNT - this.clock };
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
          family: this.family,
          teams: this.teams,
          bots: this.bots,
          botLevel: this.botLevel,
          team: p.team,
        };
      case 'game':
        if (this.paused) return { s: 'paused', host, game: this.def!.id };
        return playing
          ? { s: 'play', layout: this.def!.layout, game: this.def!.id, data: this.game?.padData?.(p.pid), host, tuto: this.clock < this.intro && !this.ready.has(p.pid) }
          : { s: 'wait', game: this.def!.id };
      case 'results': {
        const row = this.results.find((r) => r.pid === p.pid);
        if (!row && !host) return { s: 'wait', game: this.def?.id ?? '' };
        return { s: 'results', gid: this.gameNo, host, rank: row?.rank ?? 0, points: row?.points ?? 0, total: p.total, step };
      }
      case 'podium': {
        const rank = this.list().sort((a, b) => b.total - a.total).findIndex((x) => x.pid === p.pid) + 1;
        return { s: 'podium', gid: this.gameNo, host, rank, total: p.total };
      }
    }
  }
}

const GAMES_INFO = () => GAMES.map((g) => ({ id: g.id, soon: !!g.soon }));

function clean(name: string): string {
  return (name || '').replace(/\s+/g, ' ').trim().slice(0, 14) || '???';
}
