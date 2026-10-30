// Messages échangés entre la télé (qui fait autorité) et les téléphones (qui n'envoient que leurs entrées).

export type Lang = 'fr' | 'en';

export interface Profile {
  name: string;
  food: string;
  color: string;
  hat: string;
  acc: string;
  lang: Lang;
  /** Selfie recadré en rond, en data URL JPEG (~8 Ko). */
  selfie?: string;
  /** Niveau du joueur (progression gardée sur son téléphone). */
  level?: number;
  /** Regard et pose choisis (sinon ceux du perso). */
  eyes?: string;
  pose?: string;
}

export type PadLayout = 'tap' | 'stick' | 'bluff' | 'buttons';

/** Ce que la manette sait d’un jeu (la télé l’envoie : la manette ne charge pas le code des jeux). */
export interface GameInfo {
  id: string;
  soon: boolean;
  name: Record<Lang, string>;
  slug: string;
  color: string;
  options?: { id: string; label: Record<Lang, string>; choices: { v: number; label: Record<Lang, string> }[] }[];
}

/** Défi secret du tournoi (texte dans la langue du joueur ; done = null tant que rien n'est décidé). */
export interface SecretInfo {
  text: string;
  done: boolean | null;
  bonus: number;
}

/** Joueur éliminé : il devient un fantôme qui peut jeter un sort (cool = secondes avant le prochain). */
export interface GhostInfo {
  cool: number;
  targets: { pid: string; name: string; color: string; cursed: boolean }[];
}

export type PadScreen =
  | { s: 'lobby'; host: boolean; hostName: string; taken: string[]; games: GameInfo[]; count: number; family: boolean; teams: boolean; team: number; bots: number; botLevel: number; voice: number; recap?: boolean; players: { pid: string; name: string; color: string }[] }
  | { s: 'play'; layout: PadLayout; game: string; data?: unknown; host?: boolean; tuto?: boolean; secret?: SecretInfo }
  /** Partie en pause : l'hôte choisit reprendre, recommencer ou revenir au salon. */
  | { s: 'paused'; host: boolean; game: string }
  | { s: 'wait'; game: string }
  | {
      s: 'results';
      /** Numéro de la partie (pour ne compter les gains qu'une fois). */
      gid: number;
      host: boolean;
      rank: number;
      points: number;
      total: number;
      step: { index: number; count: number } | null;
      secret?: SecretInfo;
    }
  | { s: 'podium'; gid: number; host: boolean; rank: number; total: number; secret?: SecretInfo }
  /** Bilan de la soirée (titres rigolos). */
  | { s: 'recap'; host: boolean }
  /** Roue de la honte : la victime (ou l'hôte) la fait tourner. */
  | { s: 'wheel'; host: boolean; victim: boolean; victimName: string; spun: boolean; result?: string }
  /** Questions de la soirée : on vote pour un joueur ou pour A/B. */
  | { s: 'vote'; host: boolean; q: string; options: { id: string; label: string; color: string }[]; my?: string; reveal: boolean; n: number; of: number }
  /** Départage : arrêter le chrono à l'aveugle (startAt = secondes avant le départ). */
  | { s: 'tiebreak'; host: boolean; in: boolean; stopped: boolean; done: boolean; startAt: number };

/** Télé → téléphone */
export type ToPad =
  | { t: 'welcome'; color: string; code: string; games?: GameInfo[] }
  | { t: 'screen'; screen: PadScreen }
  | { t: 'buzz'; ms: number }
  /** Pendant la partie, chaque seconde : ta place et le temps restant. */
  | { t: 'status'; rank: number; of: number; left: number | null; ghost?: GhostInfo; curse?: string }
  | { t: 'pong'; ts: number }
  /** Bouton en recharge pendant s secondes (0 = de nouveau prêt). */
  | { t: 'cool'; b: 'a' | 'b' | 'c' | 'd'; s: number }
  /** L'hôte t'a retiré de la partie. */
  | { t: 'kicked' };

export type HostAction = 'tournament' | 'pick' | 'replay' | 'next' | 'lobby' | 'family' | 'teams' | 'pause' | 'resume' | 'bots' | 'botlevel' | 'kick' | 'chief' | 'voice' | 'recap' | 'wheel' | 'vote';

/** Téléphone → télé */
export type ToTv =
  | { t: 'hello'; pid: string; profile: Profile }
  | { t: 'profile'; profile: Profile }
  | { t: 'tap'; side: 0 | 1 }
  /** Stick + boutons ; c = bouton X, d = bouton Y (manette façon Switch). */
  | { t: 'in'; x: number; y: number; a: boolean; b: boolean; c?: boolean; d?: boolean }
  /** Action propre à un jeu (poser des cartes, voter…). */
  | { t: 'act'; a: string; n?: number[]; s?: string }
  | { t: 'host'; action: HostAction; game?: string; opts?: Record<string, number> }
  /** Mode équipes : le joueur choisit son camp (0 ou 1). */
  | { t: 'team'; n: number }
  /** Réaction (numéro dans REACTIONS) qui s'envole sur la télé. */
  | { t: 'react'; i: number }
  /** Fantôme : jette un sort (k) sur un joueur (to). */
  | { t: 'ghost'; k: string; to: string }
  /** Roue de la honte : la lancer. */
  | { t: 'spin' }
  /** Questions de la soirée : choix (pid ou 'a'/'b'). */
  | { t: 'vote'; v: string }
  /** Départage : arrêter le chrono. */
  | { t: 'stop' }
  | { t: 'ping'; ts: number };

export const PEER_PREFIX = 'canapet-v1-';

/**
 * Serveurs pour établir la liaison directe télé ↔ téléphone. Sur le même Wi-Fi, les iPhone cachent leur adresse locale :
 * la liaison passe alors souvent par un relais (TURN). On en donne plusieurs, dont un qui passe aussi par le port 443.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'turn:eu-0.turn.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' },
  { urls: 'turn:us-0.turn.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' },
  {
    urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
export const CODE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

export function randomCode(): string {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  return c;
}

export function joinUrl(code: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}#/m/${code}`;
}
