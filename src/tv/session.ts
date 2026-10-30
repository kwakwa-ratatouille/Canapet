// La soirée côté télé : joueurs, enchaînement des jeux, scores. La télé fait autorité.
import { SKILLS } from '../games/botSkill';
import { GAMES, gameById, playable, gameInfo } from '../games/registry';
import { TEAMS } from '../games/teams';
import { TUTOS } from '../games/tutos';
import type { GameDef, GameInstance, Runner } from '../games/types';
import { COLORS, FOODS, HATS, selfieImage } from '../shared/characters';
import { LIGHT, newId, save, store } from '../shared/device';
import { defaultLang, t } from '../shared/i18n';
import type { Lang, PadScreen, Profile, ToTv } from '../shared/protocol';
import { VOICES, playMusic, setFamily, setMusicRush, setVoice, sfx, speak } from '../shared/sound';
import { TvNet } from './net';
import { REACTIONS } from '../shared/reactions';
import { makeSecrets, type Secret } from './secrets';
import { banter } from './banter';
import { CURSES, GHOST_COOL, MALUS_DUR, GAGES, wheelItems, type CurseKind, type WheelItem } from './party';
import { AB, WHO, type AbQ, type WhoQ } from './questions';

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

export type Phase = 'lobby' | 'game' | 'results' | 'podium' | 'recap' | 'wheel' | 'vote' | 'tiebreak';

/** Roue de la honte en cours. */
export interface WheelState {
  victim: string;
  items: WheelItem[];
  /** Case tirée (-1 = pas encore lancée) et moment du lancer (performance.now()). */
  pick: number;
  spinAt: number;
  done: boolean;
  /** Autre joueur tiré au sort pour {X}. */
  other: string;
  /** Gage donné à l'autre joueur (case « retour à l'envoyeur »). */
  swapGage?: WheelItem;
  from: Phase;
}

export type VoteQ = { kind: 'who'; q: WhoQ } | { kind: 'ab'; q: AbQ };
export interface VoteState {
  list: VoteQ[];
  i: number;
  votes: Map<string, string>;
  /** Fin du vote (performance.now()). */
  endsAt: number;
  reveal: boolean;
  /** Joueurs désignés (who) ou option gagnante 'a'/'b'/'' (ab). */
  elected: string[];
  win: string;
  from: Phase;
}

/** Départage au chrono à l'aveugle : arrêter le chrono à 10,00 s pile. */
export interface TieState {
  pids: string[];
  startAt: number;
  stops: Map<string, number>;
  winner: string | null;
}
export const TIE_TARGET = 10;
export const VOTE_TIME = 20;

/** Statistiques de la soirée (depuis l’ouverture de la télé), pour le bilan. */
export interface Stats {
  games: number;
  wins: number;
  lasts: number;
  podiums: number;
  /** Places successives (1 = premier). */
  ranks: number[];
  reacts: number;
  rude: number;
  /** Nombre d’envois de chaque réaction (numéro dans REACTIONS). */
  emoji: Record<number, number>;
  secrets: number;
  ghosts: number;
  duels: number;
  /** Titres reçus aux questions de la soirée. */
  titles: string[];
}

/** Réaction en vol sur la télé (born = performance.now()). */
export interface FlyingReaction {
  i: number;
  name: string;
  color: string;
  x: number;
  born: number;
}

/** Durée du ralenti de fin de partie (secondes). */
export const REPLAY = 6;

export interface ResultRow {
  pid: string;
  profile: Profile;
  bot: boolean;
  rank: number;
  points: number;
  team?: number;
  /** A gagné le duel de rivaux de cette partie (+3). */
  duel?: boolean;
}

const POINTS = [10, 7, 5, 4, 3, 2];
const STEP = 1 / 60;
const INTRO_SHORT = 2.6;
/** Intro avec tuto : le temps de lire les 3 étapes. */
const INTRO_TUTO = 16;
const COUNT = 3;
export const TOURNAMENT_LEN = 5;
const MAX_PLAYERS = 12;

/** Événements surprises des jeux d’action : quelques secondes de chaos, toujours visibles et faciles à comprendre. */
export type EventKind = 'turbo' | 'ralenti' | 'seisme' | 'brouillard' | 'panne';
export const EVENTS: Record<EventKind, { dur: number; icon: string; name: [string, string]; fr: string; en: string }> = {
  turbo: { dur: 7, icon: '⚡', name: ['TURBO', 'TURBO'], fr: 'Turbo ! Tout va plus vite !', en: 'Turbo! Everything speeds up!' },
  ralenti: { dur: 6, icon: '🐌', name: ['RALENTI', 'SLOW-MO'], fr: 'Ralenti… tout… doucement…', en: 'Slow… mo… tion…' },
  seisme: { dur: 5, icon: '🫨', name: ['SÉISME', 'QUAKE'], fr: 'Tremblement de canapé !', en: 'Sofa quake!' },
  brouillard: { dur: 8, icon: '☁️', name: ['BROUILLARD', 'FOG'], fr: 'Brouillard ! Les nuages cachent le jeu !', en: 'Fog! Clouds are hiding the game!' },
  panne: { dur: 7, icon: '🔦', name: ['PANNE DE COURANT', 'BLACKOUT'], fr: 'Panne de courant ! Suivez les lampes torches !', en: 'Blackout! Follow the flashlights!' },
};

export class Session {
  players = new Map<string, Player>();
  phase: Phase = 'lobby';
  mode: 'host' | 'tournament' = 'host';
  /** Mode famille (mémorisé sur la télé). */
  family = store('family', false);
  /** Joueurs retirés par l'hôte : ils ne peuvent plus revenir sur cette télé. */
  kicked = new Set<string>();
  /** Bots ajoutés : -1 = auto (selon le jeu), sinon ce nombre en plus des humains. */
  bots = store('bots', -1);
  /** Niveau des bots : 0 facile, 1 normal, 2 fort. */
  botLevel = store('botLevel', 1);
  /** Voix du présentateur (numéro dans VOICES). */
  voice = store('voice', 0);
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
  private lastEvent: EventKind | null = null;
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
  /** Réactions qui s'envolent sur la télé, et la dernière « pluie » (6 fois la même en 2,5 s). */
  reactions: FlyingReaction[] = [];
  combo: { i: number; born: number } | null = null;
  private lastReact = new Map<string, number>();
  private lastPet = 0;
  stats = new Map<string, Stats>();
  /** Défis secrets du tournoi en cours (un par joueur). */
  secrets = new Map<string, Secret>();
  /** Ralenti de fin de partie : secondes restantes ; canReplay est mis par l'écran quand assez d'images sont gardées. */
  replay = 0;
  canReplay = false;
  private replayDone = false;
  /** Sorts des fantômes en cours (joueur visé → sort). */
  curses = new Map<string, { kind: CurseKind; t: number; by: string }>();
  private ghostReady = new Map<string, number>();
  /** Malus de la roue à appliquer au départ du prochain jeu. */
  private pendingMalus: { pid: string; kind: CurseKind }[] = [];
  private started = false;
  wheel: WheelState | null = null;
  vote: VoteState | null = null;
  tie: TieState | null = null;
  private tieDone = false;
  private secretsDone = false;
  private usedWho = new Set<number>();
  private usedAb = new Set<number>();
  private voteToken = 0;
  /** Duel de rivaux de la partie en cours. */
  duel: { a: string; b: string } | null = null;
  private lastDuelGame = -9;
  /** Classements (joueurs de la soirée seulement) de toutes les parties. */
  private orders: string[][] = [];
  private streak = { pid: '', k: 0 };
  private lastStreak = { pid: '', k: 0 };
  /** Petite phrase du présentateur affichée aux résultats. */
  quip = '';
  /** Réactions envoyées au début du tournoi (pour le défi « envoie des réactions »). */
  private tourReacts = new Map<string, number>();

  constructor(preview: boolean) {
    setFamily(this.family);
    setVoice(this.voice);
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

  /** Chef choisi par l'ancien chef (sinon le premier arrivé). */
  chief: string | null = null;

  hostPid(): string | null {
    const c = this.chief && this.players.get(this.chief);
    if (c && c.connected) return c.pid;
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
    if (!fake) this.net.send(pid, { t: 'welcome', color: p.color, code: this.net.code, games: GAMES_INFO() });
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

  private onMsg(pid: string, raw: ToTv) {
    // Sort d'un fantôme : les commandes du joueur visé sont modifiées
    const m = this.cursed(pid, raw);
    const p = this.players.get(pid);
    if (p) p.lastSeen = performance.now();
    switch (m.t) {
      case 'hello':
        if (this.kicked.has(pid)) {
          this.net.send(pid, { t: 'kicked' });
          setTimeout(() => this.net.drop(pid), 300);
          return;
        }
        if (!p && this.players.size >= MAX_PLAYERS && this.phase === 'lobby') this.removeStale(true);
        this.addPlayer(pid, m.profile);
        return;
      case 'profile':
        if (!p) return;
        Object.assign(p, m.profile, { name: clean(m.profile.name), color: this.freeColor(m.profile.color, pid) });
        if (p.color !== m.profile.color) this.net.send(pid, { t: 'welcome', color: p.color, code: this.net.code, games: GAMES_INFO() });
        this.changed();
        this.pushScreens();
        return;
      case 'tap':
      case 'in':
      case 'act':
        // Les envois de fichiers (Photo Roulette) passent même pendant le tuto
        if (this.phase === 'game' && this.game && (this.clock >= this.intro + COUNT || (m.t === 'act' && m.a === 'up'))) this.game.input(pid, m);
        else if (this.phase === 'game' && this.clock < this.intro && (m.t !== 'in' || m.a || m.b) && !(m.t === 'act' && m.a === 'up')) this.markReady(pid);
        return;
      case 'ghost': {
        const k = m.k as CurseKind;
        if (this.phase !== 'game' || !this.game?.out?.(pid) || this.replay > 0 || !CURSES[k]) return;
        const target = this.runners.find((r) => r.pid === m.to && !r.bot);
        if (!target || this.game.out?.(m.to) || this.curses.has(m.to)) return;
        if (this.clock < (this.ghostReady.get(pid) ?? 0)) return;
        this.ghostReady.set(pid, this.clock + GHOST_COOL);
        this.statsOf(pid).ghosts++;
        this.curse(m.to, k, CURSES[k].dur, pid);
        return;
      }
      case 'spin':
        if (this.phase === 'wheel' && this.wheel && (pid === this.wheel.victim || pid === this.hostPid())) this.spinWheel();
        return;
      case 'vote':
        if (this.phase === 'vote') this.castVote(pid, m.v);
        return;
      case 'stop':
        if (this.phase === 'tiebreak') this.stopTie(pid);
        return;
      case 'react': {
        const r = REACTIONS[m.i];
        if (!p || !r || (this.family && r.rude)) return;
        const now = performance.now();
        if (now - (this.lastReact.get(pid) ?? 0) < 280) return;
        this.lastReact.set(pid, now);
        this.reactions.push({ i: m.i, name: p.name, color: p.color, x: 160 + Math.random() * 1600, born: now });
        if (this.reactions.length > 50) this.reactions.shift();
        const st = this.statsOf(pid);
        st.reacts++;
        if (r.rude) st.rude++;
        st.emoji[m.i] = (st.emoji[m.i] ?? 0) + 1;
        if (r.pet && now - this.lastPet > 1200) {
          this.lastPet = now;
          sfx.pet();
        }
        // Pluie : la même réaction 6 fois en 2,5 s (par n'importe qui)
        if (this.reactions.filter((x) => x.i === m.i && now - x.born < 2500).length === 6 && (!this.combo || now - this.combo.born > 4000)) {
          this.combo = { i: m.i, born: now };
          sfx.hurry();
          this.say(banter('rain', this.lang(), this.family, { e: r.txt ? r.txt[this.lang()] : r.e }));
        }
        return;
      }
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
        this.secretsDone = false;
        this.tieDone = false;
        this.secrets = makeSecrets(
          this.list().filter((p) => p.connected),
          this.plan.map((id) => gameById(id)!),
        );
        this.tourReacts = new Map(this.list().map((p) => [p.pid, this.statsOf(p.pid).reacts]));
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
      case 'wheel':
        if (this.phase === 'results' || this.phase === 'lobby' || this.phase === 'podium') this.startWheel(this.phase);
        break;
      case 'vote':
        if (this.phase === 'results' || this.phase === 'lobby') this.startVote(this.phase);
        break;
      case 'recap':
        if (this.phase === 'game' || ![...this.stats.values()].some((x) => x.games > 0)) break;
        this.phase = 'recap';
        playMusic('podium');
        speak(this.lang() === 'fr' ? 'Le bilan de la soirée !' : 'Tonight’s awards!', this.lang());
        sfx.win();
        this.changed();
        this.pushScreens();
        break;
      case 'next':
        if (this.phase === 'podium') {
          // Tournoi : la roue de la honte pour le dernier, puis le bilan
          if (this.list().filter((p) => p.connected).length >= 2) this.startWheel('podium');
          else this.hostAction('recap');
          break;
        }
        if (this.phase === 'wheel') {
          this.endWheel();
          break;
        }
        if (this.phase === 'vote') {
          this.nextQuestion();
          break;
        }
        if (this.phase !== 'results') break;
        if (this.mode === 'tournament') {
          this.step++;
          if (this.step >= this.plan.length) this.showPodium();
          // Questions de la soirée entre deux jeux du tournoi (après le 2e et le 4e)
          else if ((this.step === 2 || this.step === 4) && this.list().filter((p) => p.connected).length >= 3) this.startVote('game');
          else this.startGame(this.plan[this.step]);
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
        this.bots = opts && typeof opts.v === 'number' ? Math.max(-1, Math.min(7, opts.v)) : this.bots >= 7 ? -1 : this.bots + 1;
        save('bots', this.bots);
        this.changed();
        this.pushScreens();
        break;
      case 'botlevel':
        if (this.phase !== 'lobby') break;
        this.botLevel = opts && typeof opts.v === 'number' ? Math.max(0, Math.min(2, opts.v)) : (this.botLevel + 1) % 3;
        save('botLevel', this.botLevel);
        this.changed();
        this.pushScreens();
        break;
      case 'voice': {
        this.voice = opts && typeof opts.v === 'number' ? Math.max(0, Math.min(VOICES.length - 1, opts.v)) : (this.voice + 1) % VOICES.length;
        setVoice(this.voice);
        save('voice', this.voice);
        const fr = this.lang() === 'fr';
        speak(fr ? `Salut ! Je suis la voix ${VOICES[this.voice].fr}. Que la fête commence !` : `Hi! I'm the ${VOICES[this.voice].en} voice. Let's party!`, this.lang());
        this.changed();
        this.pushScreens();
        break;
      }
      case 'chief': {
        if (!game || game === this.hostPid() || !this.players.get(game)?.connected) break;
        this.chief = game;
        const n = this.players.get(game)!.name;
        this.toast = { text: this.lang() === 'fr' ? `👑 ${n} est le nouveau chef` : `👑 ${n} is the new host`, t: 3 };
        sfx.join();
        this.changed();
        this.pushScreens();
        break;
      }
      case 'kick': {
        // game = identifiant du joueur à retirer (jamais l'hôte lui-même)
        if (!game || game === this.hostPid() || !this.players.has(game)) break;
        const name = this.players.get(game)!.name;
        this.kicked.add(game);
        this.net.send(game, { t: 'kicked' });
        setTimeout(() => this.net.drop(game), 300);
        this.players.delete(game);
        sfx.leave();
        this.toast = { text: this.lang() === 'fr' ? `${name} a été retiré de la partie` : `${name} was removed`, t: 3 };
        this.changed();
        this.pushScreens();
        break;
      }
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
      cool: (pid, b, s) => {
        if (!this.players.get(pid)?.fake) this.net.send(pid, { t: 'cool', b, s });
      },
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
    this.replay = 0;
    this.replayDone = false;
    this.curses.clear();
    this.ghostReady.clear();
    this.started = false;
    this.duel = id === 'traitre' || id === 'undercover' || this.teams ? null : this.pickDuel(runners);
    this.canReplay = false;
    this.ready = new Set();
    this.clock = 0;
    this.acc = 0;
    this.announced = false;
    this.lastCount = 0;
    playMusic(def.music);
    speak(banter('start', this.lang(), this.family, { G: def.name[this.lang()] }) || def.name[this.lang()], this.lang());
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
    // Duel de rivaux : +3 à celui qui finit devant l'autre
    if (this.duel) {
      const { a, b } = this.duel;
      const [w, l] = order.indexOf(a) <= order.indexOf(b) ? [a, b] : [b, a];
      const p = this.players.get(w);
      if (p && order.includes(l)) {
        p.total += 3;
        this.statsOf(w).duels++;
        const row = this.results.find((r) => r.pid === w);
        if (row) row.duel = true;
        this.lastDuelGame = this.gameNo;
      }
    }
    this.record(order);
    this.quip = this.endQuip(order);
    if (!this.teamScore && this.quip) speak(this.quip, this.lang());
    this.phase = 'results';
    playMusic('lobby');
    sfx.win();
    this.changed();
    this.pushScreens();
  }

  private showPodium() {
    if (!this.secretsDone)
    for (const sc of this.secrets.values()) {
      if (sc.kind === 'neverLast') sc.done = !this.tourOrders.some((o) => o.length > 1 && o[o.length - 1] === sc.pid);
      if (sc.kind === 'react') sc.done = this.statsOf(sc.pid).reacts - (this.tourReacts.get(sc.pid) ?? 0) >= sc.n!;
      sc.done = !!sc.done;
      const p = this.players.get(sc.pid);
      if (sc.done && p) {
        p.total += sc.bonus;
        this.statsOf(sc.pid).secrets++;
      }
    }
    this.secretsDone = true;
    // Égalité en tête : départage au chrono à l'aveugle avant le podium
    const ranked = this.list().filter((p) => p.connected).sort((a, b) => b.total - a.total);
    const tied = ranked.filter((p) => p.total === ranked[0]?.total);
    if (!this.tieDone && tied.length >= 2) {
      this.startTie(tied.map((p) => p.pid));
      return;
    }
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
    if (this.replay > 0) {
      this.replay -= dt;
      if (this.replay <= 0) this.endGame();
      return;
    }
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
        if (!this.started) this.onPlayStart();
        for (const [pid, c] of this.curses) if ((c.t -= STEP) <= 0) this.curses.delete(pid);
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
        // Jeux d'action : on revoit la fin au ralenti avant les résultats
        const action = this.def && (this.def.layout === 'stick' || this.def.layout === 'tap');
        if (action && this.canReplay && !this.replayDone && !LIGHT) {
          this.replayDone = true;
          this.replay = REPLAY;
          this.acc = 0;
          speak(banter('replay', this.lang(), this.family, { n: lead ?? '' }), this.lang());
          sfx.boing();
          return;
        }
        this.endGame();
        return;
      }
    }
  }

  /** Aperçu : déclenche tout de suite le prochain événement surprise. */
  surprise() {
    this.event = null;
    this.nextEvent = 0;
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
    // Jamais deux fois le même événement d’affilée
    const pool = kinds.filter((k) => k !== this.lastEvent);
    const kind = pool[Math.floor(Math.random() * pool.length)];
    this.lastEvent = kind;
    const e = EVENTS[kind];
    this.event = { kind, t: e.dur, dur: e.dur };
    this.nextEvent = play + e.dur + 25 + Math.random() * 15;
    const text = this.lang() === 'fr' ? e.fr : e.en;
    this.toast = { text: e.icon + ' ' + text, t: 3 };
    speak(text, this.lang());
    sfx.hurry();
  }

  /** Le commentateur réagit quand la tête change, et chambre le dernier de temps en temps (une phrase toutes les 9 s au plus). */
  private commentate() {
    if (!this.game || !this.runners.length) return;
    const order = this.game.ranking();
    const first = order[0];
    const play = this.clock - this.intro - COUNT;
    if (!first) return;
    const name = (pid: string) => this.runners.find((r) => r.pid === pid)?.profile.name ?? '';
    if (first !== this.leadPid) {
      const prev = this.leadPid;
      this.leadPid = first;
      if (play < 6 || this.clock - this.lastCall < 9) return;
      this.lastCall = this.clock;
      this.say(banter('lead', this.lang(), this.family, { n: name(first), p: prev ? name(prev) : '' }));
      return;
    }
    // Pas de changement : de temps en temps, on se moque du dernier (un vrai joueur)
    const last = [...order].reverse().find((pid) => this.players.has(pid));
    if (last && last !== first && play > 14 && this.clock - this.lastCall > 16 && Math.random() < 0.3) {
      this.lastCall = this.clock;
      this.say(banter('last', this.lang(), this.family, { n: name(last) }));
    }
  }

  /** Bandeau + voix du présentateur. */
  private say(text: string) {
    if (!text) return;
    this.toast = { text, t: 3 };
    speak(text, this.lang());
  }

  /** Phrase de fin de partie : le gagnant, puis une série, le dernier ou le duel. */
  private endQuip(order: string[]): string {
    const L = this.lang();
    const fam = this.family;
    const name = (pid: string) => this.players.get(pid)?.name ?? this.runners.find((r) => r.pid === pid)?.profile.name ?? '';
    const first = order[0];
    if (first === this.streak.pid) this.streak.k++;
    else this.streak = { pid: first, k: 1 };
    const last = [...order].reverse().find((pid) => this.players.has(pid) && pid !== first);
    if (last && last === this.lastStreak.pid) this.lastStreak.k++;
    else this.lastStreak = { pid: last ?? '', k: 1 };
    const parts = [this.streak.k >= 2 ? banter('streak', L, fam, { n: name(first), k: this.streak.k }) : banter('win', L, fam, { n: name(first) })];
    const duel = this.results.find((r) => r.duel);
    if (duel && this.duel) parts.push(banter('duelWin', L, fam, { n: name(duel.pid), p: name(duel.pid === this.duel.a ? this.duel.b : this.duel.a) }));
    else if (last && this.lastStreak.k >= 2) parts.push(banter('loserStreak', L, fam, { n: name(last), k: this.lastStreak.k }));
    else if (last && Math.random() < 0.6) parts.push(banter('lastResult', L, fam, { n: name(last) }));
    return parts.filter(Boolean).join(' ');
  }

  // ——— Vengeance des fantômes ———

  /** Applique le sort en cours aux commandes du joueur visé. */
  private cursed(pid: string, m: ToTv): ToTv {
    const c = this.curses.get(pid);
    if (!c || m.t !== 'in') return m;
    switch (c.kind) {
      case 'gel':
        return { ...m, x: 0, y: 0, a: false, b: false, c: false, d: false };
      case 'tournis': {
        // Le stick tourne de 120° : on part de travers
        const a = 2.1;
        return { ...m, x: m.x * Math.cos(a) - m.y * Math.sin(a), y: m.x * Math.sin(a) + m.y * Math.cos(a) };
      }
      case 'mou':
        return { ...m, x: m.x * 0.35, y: m.y * 0.35 };
      case 'hoquet':
        return { ...m, a: Math.random() < 0.4 ? !m.a : m.a, b: Math.random() < 0.15 ? !m.b : m.b };
    }
    return m;
  }

  private curse(pid: string, kind: CurseKind, dur: number, by: string) {
    this.curses.set(pid, { kind, t: dur, by });
    if (kind === 'gel') this.game?.input(pid, { t: 'in', x: 0, y: 0, a: false, b: false });
    if (!this.players.get(pid)?.fake) this.net.send(pid, { t: 'buzz', ms: 250 });
    const L = this.lang();
    const name = (id: string) => this.players.get(id)?.name ?? '?';
    const c = CURSES[kind];
    if (by) this.say(banter('ghost', L, this.family, { n: name(by), p: name(pid), c: c.icon + ' ' + c.name[L] }));
    else this.toast = { text: `${c.icon} ${name(pid)} : ${c.name[L]} !`, t: 3 };
    sfx.boing();
    this.sendStatus();
  }

  /** Au départ du jeu : malus de la roue et annonce du duel. */
  private onPlayStart() {
    this.started = true;
    for (const m of this.pendingMalus) if (this.runners.some((r) => r.pid === m.pid)) this.curse(m.pid, m.kind, MALUS_DUR[m.kind], '');
    this.pendingMalus = [];
    if (this.duel) {
      const n = (id: string) => this.players.get(id)?.name ?? '?';
      this.say(banter('duel', this.lang(), this.family, { n: n(this.duel.a), p: n(this.duel.b) }));
    }
  }

  // ——— Rivaux ———

  /** Deux joueurs qui finissent souvent l'un à côté de l'autre : duel annoncé (pas plus d'une partie sur deux). */
  private pickDuel(runners: Runner[]): { a: string; b: string } | null {
    if (this.orders.length < 3 || this.gameNo - this.lastDuelGame < 2 || Math.random() < 0.35) return null;
    const here = new Set(runners.filter((r) => this.players.has(r.pid)).map((r) => r.pid));
    const near = new Map<string, number>();
    for (const o of this.orders) {
      const h = o.filter((pid) => here.has(pid));
      for (let i = 1; i < h.length; i++) {
        const key = [h[i - 1], h[i]].sort().join('|');
        near.set(key, (near.get(key) ?? 0) + 1);
      }
    }
    const best = [...near.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] < 2) return null;
    const [a, b] = best[0].split('|');
    return { a, b };
  }

  // ——— Roue de la honte ———

  private startWheel(from: Phase) {
    const humans = this.list().filter((p) => p.connected);
    if (!humans.length) return;
    let victim = '';
    if (from === 'podium') victim = [...humans].sort((a, b) => a.total - b.total)[0].pid;
    else if (from === 'results') victim = [...this.results].reverse().find((r) => this.players.get(r.pid)?.connected)?.pid ?? '';
    if (!victim) victim = humans[Math.floor(Math.random() * humans.length)].pid;
    const others = humans.filter((p) => p.pid !== victim);
    const other = (others.length ? others : humans)[Math.floor(Math.random() * (others.length || humans.length))].pid;
    this.wheel = { victim, items: wheelItems(), pick: -1, spinAt: 0, done: false, other, from };
    this.phase = 'wheel';
    playMusic('party');
    this.say(banter('wheel', this.lang(), this.family, { n: this.players.get(victim)!.name }));
    this.changed();
    this.pushScreens();
  }

  private spinWheel() {
    const w = this.wheel;
    if (!w || w.pick >= 0) return;
    w.pick = Math.floor(Math.random() * w.items.length);
    w.spinAt = performance.now();
    sfx.hurry();
    this.changed();
    this.pushScreens();
    setTimeout(() => {
      if (this.wheel !== w) return;
      w.done = true;
      const it = w.items[w.pick];
      const name = (id: string) => this.players.get(id)?.name ?? '?';
      if (it.curse) this.pendingMalus.push({ pid: it.other ? w.other : w.victim, kind: it.curse });
      if (it.swap) w.swapGage = GAGES[Math.floor(Math.random() * GAGES.length)];
      const L = this.lang();
      const text = it.text[L].replace('{X}', name(w.other)) + (w.swapGage ? ` ${w.swapGage.text[L]}` : '');
      speak(`${name(it.swap || it.other ? w.other : w.victim)} : ${text}`, L);
      if (it.joker) sfx.win();
      else sfx.pet();
      this.changed();
      this.pushScreens();
    }, 6200);
  }

  private endWheel() {
    const from = this.wheel?.from;
    this.wheel = null;
    if (from === 'podium') this.hostAction('recap');
    else if (from === 'results') {
      this.phase = 'results';
      playMusic('lobby');
      this.changed();
      this.pushScreens();
    } else this.toLobby();
  }

  // ——— Questions de la soirée ———

  private startVote(from: Phase) {
    const fam = (q: { fam?: false }) => !(this.family && q.fam === false);
    const pickFrom = <T extends { fam?: false }>(all: T[], used: Set<number>, n: number) => {
      let idx = all.map((_, i) => i).filter((i) => !used.has(i) && fam(all[i]));
      if (idx.length < n) {
        used.clear();
        idx = all.map((_, i) => i).filter((i) => fam(all[i]));
      }
      const out = idx.sort(() => Math.random() - 0.5).slice(0, n);
      out.forEach((i) => used.add(i));
      return out.map((i) => all[i]);
    };
    const who = pickFrom(WHO, this.usedWho, 2).map((q) => ({ kind: 'who' as const, q }));
    const abq = pickFrom(AB, this.usedAb, 1).map((q) => ({ kind: 'ab' as const, q }));
    this.vote = { list: [who[0], abq[0], who[1]].filter(Boolean), i: -1, votes: new Map(), endsAt: 0, reveal: false, elected: [], win: '', from };
    this.phase = 'vote';
    playMusic('party');
    this.nextQuestion();
  }

  private nextQuestion() {
    const v = this.vote;
    if (!v) return;
    if (!v.reveal && v.i >= 0) {
      // L'hôte passe le vote : on révèle tout de suite
      this.revealVote();
      return;
    }
    v.i++;
    if (v.i >= v.list.length) {
      this.endVote();
      return;
    }
    v.votes = new Map();
    v.reveal = false;
    v.elected = [];
    v.win = '';
    v.endsAt = performance.now() + VOTE_TIME * 1000;
    const token = ++this.voteToken;
    const q = v.list[v.i];
    const L = this.lang();
    speak(q.kind === 'who' ? q.q.q[L] : `${q.q.q[L]} ${q.q.a[L]}, ${L === 'fr' ? 'ou' : 'or'} ${q.q.b[L]} ?`, L);
    sfx.join();
    // Les faux joueurs de l'aperçu votent au hasard
    for (const p of this.list().filter((x) => x.fake && x.connected))
      setTimeout(() => {
        if (this.voteToken !== token) return;
        const opts = q.kind === 'who' ? this.list().filter((x) => x.connected).map((x) => x.pid) : ['a', 'b'];
        this.castVote(p.pid, opts[Math.floor(Math.random() * opts.length)]);
      }, 1500 + Math.random() * 5000);
    setTimeout(() => this.voteToken === token && !v.reveal && this.revealVote(), VOTE_TIME * 1000);
    this.changed();
    this.pushScreens();
  }

  private castVote(pid: string, choice: string) {
    const v = this.vote;
    const p = this.players.get(pid);
    if (!v || v.reveal || !p || v.i < 0) return;
    const q = v.list[v.i];
    if (q.kind === 'who' ? !this.players.has(choice) : choice !== 'a' && choice !== 'b') return;
    v.votes.set(pid, choice);
    sfx.click();
    if (this.list().filter((x) => x.connected).every((x) => v.votes.has(x.pid))) this.revealVote();
    else {
      this.changed();
      this.pushScreens();
    }
  }

  private revealVote() {
    const v = this.vote;
    if (!v || v.reveal) return;
    v.reveal = true;
    const token = ++this.voteToken;
    const q = v.list[v.i];
    const L = this.lang();
    const count = new Map<string, number>();
    for (const c of v.votes.values()) count.set(c, (count.get(c) ?? 0) + 1);
    const max = Math.max(0, ...count.values());
    const top = [...count.entries()].filter(([, n]) => n === max && max > 0).map(([c]) => c);
    if (q.kind === 'who') {
      v.elected = top;
      // Ceux qui ont voté comme la majorité : +1
      for (const [pid, c] of v.votes) if (top.includes(c)) this.players.get(pid) && (this.players.get(pid)!.total += 1);
      for (const pid of top) this.statsOf(pid).titles.push(q.q.t[L]);
      const names = top.map((pid) => this.players.get(pid)?.name ?? '?').join(L === 'fr' ? ' et ' : ' and ');
      if (top.length) this.say(banter('vote', L, this.family, { n: names, t: q.q.t[L] }));
    } else {
      v.win = top.length === 1 ? top[0] : '';
      // Majorité : +2 ; égalité : +1 pour tout le monde
      for (const [pid, c] of v.votes) {
        const p = this.players.get(pid);
        if (p) p.total += v.win ? (c === v.win ? 2 : 0) : 1;
      }
      const opt = v.win === 'a' ? q.q.a[L] : v.win === 'b' ? q.q.b[L] : '';
      this.say(opt ? (L === 'fr' ? `La majorité préfère : ${opt} !` : `Most of you prefer: ${opt}!`) : L === 'fr' ? 'Égalité parfaite ! Le salon est coupé en deux !' : 'Perfect tie! The room is split!');
    }
    sfx.win();
    setTimeout(() => this.voteToken === token && this.nextQuestion(), 8000);
    this.changed();
    this.pushScreens();
  }

  private endVote() {
    const from = this.vote?.from;
    this.vote = null;
    this.voteToken++;
    if (from === 'game' && this.mode === 'tournament' && this.step < this.plan.length) this.startGame(this.plan[this.step]);
    else if (from === 'results') {
      this.phase = 'results';
      playMusic('lobby');
      this.changed();
      this.pushScreens();
    } else this.toLobby();
  }

  // ——— Départage ———

  private startTie(pids: string[]) {
    this.tie = { pids, startAt: performance.now() + 4000, stops: new Map(), winner: null };
    this.phase = 'tiebreak';
    playMusic('');
    const L = this.lang();
    speak(L === 'fr' ? 'Égalité ! Départage au chrono à l’aveugle : arrêtez le chrono à dix secondes pile !' : 'It’s a tie! Blind stopwatch: stop it at exactly ten seconds!', L);
    for (const pid of pids)
      if (this.players.get(pid)?.fake) setTimeout(() => this.stopTie(pid), 4000 + (TIE_TARGET + (Math.random() - 0.5) * 1.6) * 1000);
    setTimeout(() => this.tie && !this.tie.winner && this.revealTie(), 4000 + 16000);
    this.changed();
    this.pushScreens();
  }

  private stopTie(pid: string) {
    const tb = this.tie;
    if (!tb || tb.winner || !tb.pids.includes(pid) || tb.stops.has(pid)) return;
    const t = (performance.now() - tb.startAt) / 1000;
    if (t < 0) return;
    tb.stops.set(pid, t);
    sfx.click();
    if (tb.pids.every((x) => tb.stops.has(x))) this.revealTie();
    else {
      this.changed();
      this.pushScreens();
    }
  }

  private revealTie() {
    const tb = this.tie;
    if (!tb) return;
    const gap = (pid: string) => (tb.stops.has(pid) ? Math.abs(tb.stops.get(pid)! - TIE_TARGET) : 99);
    tb.winner = [...tb.pids].sort((a, b) => gap(a) - gap(b))[0];
    const p = this.players.get(tb.winner);
    if (p) p.total += 1;
    const L = this.lang();
    speak(L === 'fr' ? `${p?.name} est le plus précis et remporte le départage !` : `${p?.name} is the most precise and wins the tiebreak!`, L);
    sfx.win();
    this.tieDone = true;
    this.changed();
    this.pushScreens();
    setTimeout(() => {
      if (this.phase !== 'tiebreak') return;
      this.tie = null;
      this.showPodium();
    }, 7000);
  }

  /** Envoie à chaque manette sa place du moment et le chrono. */
  private sendStatus() {
    this.lastStatus = this.clock;
    if (!this.game) return;
    const order = this.game.ranking();
    const left = this.timeLeft();
    for (const r of this.runners)
      if (!r.bot) {
        const out = !!this.game.out?.(r.pid);
        const ghost = out
          ? {
              cool: Math.max(0, Math.ceil((this.ghostReady.get(r.pid) ?? 0) - this.clock)),
              targets: this.runners.filter((o) => !o.bot && o.pid !== r.pid && !this.game!.out?.(o.pid)).map((o) => ({ pid: o.pid, name: o.profile.name, color: o.profile.color, cursed: this.curses.has(o.pid) })),
            }
          : undefined;
        const c = this.curses.get(r.pid);
        this.net.send(r.pid, { t: 'status', rank: order.indexOf(r.pid) + 1, of: order.length, left: left === null ? null : Math.ceil(left), ghost, curse: c ? CURSES[c.kind].icon + ' ' + CURSES[c.kind].name[r.profile.lang] : undefined });
      }
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
    if (left > 0 && left <= 10 && Math.ceil(left) !== Math.ceil(prev)) {
      sfx.countdown(Math.ceil(left));
      if (left <= 5) sfx.alarm();
    }
    if (prev > 10 && left <= 10) {
      setMusicRush(1.3);
      speak(fr ? 'Dix secondes !' : 'Ten seconds!', this.lang());
    }
    if (left > 0) return false;
    this.timeUp = 2.2;
    playMusic('');
    sfx.timeUp();
    speak(fr ? 'Temps écoulé !' : "Time's up!", this.lang());
    return true;
  }

  /** Un téléphone qui ne donne plus de nouvelles depuis 15 s est considéré parti. */
  private watchdog(now: number) {
    for (const p of this.players.values())
      if (p.connected && !p.fake && now - p.lastSeen > 15000) {
        this.net.drop(p.pid);
        this.onLeave(p.pid);
      }
  }

  introState(): { title: number; count: number; tutoLeft: number } {
    return { title: Math.max(0, this.intro - this.clock), tutoLeft: this.intro === INTRO_TUTO ? Math.max(0, this.intro - this.clock) / INTRO_TUTO : 0, count: this.intro + COUNT - this.clock };
  }

  // ——— Écrans des manettes ———

  statsOf(pid: string): Stats {
    let st = this.stats.get(pid);
    if (!st) {
      st = { games: 0, wins: 0, lasts: 0, podiums: 0, ranks: [], reacts: 0, rude: 0, emoji: {}, secrets: 0, ghosts: 0, duels: 0, titles: [] };
      this.stats.set(pid, st);
    }
    return st;
  }

  /** Classements des jeux du tournoi en cours. */
  private tourOrders: string[][] = [];

  /** Note la partie dans les statistiques de la soirée et vérifie les défis secrets. */
  private record(order: string[]) {
    const humans = order.filter((pid) => this.players.has(pid));
    if (humans.length >= 2) this.orders.push(humans);
    if (this.mode === 'tournament') {
      if (this.step === 0) this.tourOrders = [];
      this.tourOrders.push(order);
    }
    order.forEach((pid, i) => {
      if (!this.players.has(pid)) return;
      const st = this.statsOf(pid);
      st.games++;
      st.ranks.push(i + 1);
      if (i === 0) st.wins++;
      if (i < 3 && order.length > 3) st.podiums++;
      if (i === order.length - 1 && order.length > 1) st.lasts++;
    });
    if (this.mode !== 'tournament' || !humans.length) return;
    const id = this.def?.id;
    for (const sc of this.secrets.values()) {
      if (sc.done) continue;
      const at = order.indexOf(sc.pid);
      if (at < 0) continue;
      const wins = this.tourOrders.filter((o) => o[0] === sc.pid).length;
      const pods = this.tourOrders.filter((o) => o.indexOf(sc.pid) >= 0 && o.indexOf(sc.pid) < 3).length;
      let ok = false;
      if (sc.kind === 'podium' && sc.game === id) ok = at < 3;
      if (sc.kind === 'last' && sc.game === id) ok = at === order.length - 1 && order.length > 1;
      if (sc.kind === 'beat' && sc.game === id) ok = order.indexOf(sc.foe!) < 0 || at < order.indexOf(sc.foe!);
      if (sc.kind === 'win') ok = wins >= 1;
      if (sc.kind === 'twoPodiums') ok = pods >= 2;
      if (sc.kind === 'react') ok = this.statsOf(sc.pid).reacts - (this.tourReacts.get(sc.pid) ?? 0) >= sc.n!;
      if (ok) {
        sc.done = true;
        if (!this.players.get(sc.pid)?.fake) this.net.send(sc.pid, { t: 'buzz', ms: 400 });
      }
    }
  }

  /** Le défi secret d'un joueur, dans sa langue (seulement pendant un tournoi). */
  private secretFor(p: Player) {
    const sc = this.mode === 'tournament' ? this.secrets.get(p.pid) : undefined;
    if (!sc) return undefined;
    const name = (pid?: string) => this.players.get(pid ?? '')?.name ?? '?';
    const game = sc.game ? gameById(sc.game)?.name[p.lang] ?? '' : '';
    return { text: sc.text[p.lang].replace('{G}', game).replace('{F}', name(sc.foe)), done: sc.done, bonus: sc.bonus };
  }

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
          voice: this.voice,
          recap: [...this.stats.values()].some((x) => x.games > 0),
          players: host ? this.list().filter((x) => x.pid !== p.pid && x.connected).map((x) => ({ pid: x.pid, name: x.name, color: x.color })) : [],
          team: p.team,
        };
      case 'game':
        if (this.paused) return { s: 'paused', host, game: this.def!.id };
        return playing
          ? { s: 'play', layout: this.def!.layout, game: this.def!.id, data: this.game?.padData?.(p.pid), host, tuto: this.clock < this.intro && !this.ready.has(p.pid), secret: this.secretFor(p) }
          : { s: 'wait', game: this.def!.id };
      case 'results': {
        const row = this.results.find((r) => r.pid === p.pid);
        if (!row && !host) return { s: 'wait', game: this.def?.id ?? '' };
        return { s: 'results', gid: this.gameNo, host, rank: row?.rank ?? 0, points: row?.points ?? 0, total: p.total, step, secret: this.secretFor(p) };
      }
      case 'podium': {
        const rank = this.list().sort((a, b) => b.total - a.total).findIndex((x) => x.pid === p.pid) + 1;
        return { s: 'podium', gid: this.gameNo, host, rank, total: p.total, secret: this.secretFor(p) };
      }
      case 'recap':
        return { s: 'recap', host };
      case 'wheel': {
        const w = this.wheel!;
        const it = w.done ? w.items[w.pick] : null;
        const L = p.lang;
        const victimName = this.players.get(w.victim)?.name ?? '?';
        return {
          s: 'wheel',
          host,
          victim: p.pid === w.victim,
          victimName,
          spun: w.pick >= 0,
          result: it ? `${it.icon} ${it.text[L].replace('{X}', this.players.get(w.other)?.name ?? '?')}${w.swapGage ? ' ' + w.swapGage.text[L] : ''}` : undefined,
        };
      }
      case 'vote': {
        const v = this.vote!;
        const q = v.list[Math.max(0, v.i)];
        const L = p.lang;
        const options =
          q.kind === 'who'
            ? this.list().filter((x) => x.connected).map((x) => ({ id: x.pid, label: x.name, color: x.color }))
            : [
                { id: 'a', label: q.q.a[L], color: '#ff4f9a' },
                { id: 'b', label: q.q.b[L], color: '#2ec5ff' },
              ];
        return { s: 'vote', host, q: q.q.q[L], options, my: v.votes.get(p.pid), reveal: v.reveal, n: v.i + 1, of: v.list.length };
      }
      case 'tiebreak': {
        const tb = this.tie!;
        return { s: 'tiebreak', host, in: tb.pids.includes(p.pid), stopped: tb.stops.has(p.pid), done: !!tb.winner, startAt: Math.max(0, (tb.startAt - performance.now()) / 1000) };
      }
    }
  }
}

let gamesInfo: ReturnType<typeof gameInfo> | null = null;
const GAMES_INFO = () => (gamesInfo ??= gameInfo(GAMES));

function clean(name: string): string {
  return (name || '').replace(/\s+/g, ' ').trim().slice(0, 14) || '???';
}
