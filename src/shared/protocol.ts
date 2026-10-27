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

export interface GameInfo {
  id: string;
  soon: boolean;
}

export type PadScreen =
  | { s: 'lobby'; host: boolean; hostName: string; taken: string[]; games: GameInfo[]; count: number; family: boolean; teams: boolean; team: number }
  | { s: 'play'; layout: PadLayout; game: string; data?: unknown; host?: boolean; tuto?: boolean }
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
    }
  | { s: 'podium'; gid: number; host: boolean; rank: number; total: number };

/** Télé → téléphone */
export type ToPad =
  | { t: 'welcome'; color: string; code: string }
  | { t: 'screen'; screen: PadScreen }
  | { t: 'buzz'; ms: number }
  /** Pendant la partie, chaque seconde : ta place et le temps restant. */
  | { t: 'status'; rank: number; of: number; left: number | null }
  | { t: 'pong'; ts: number };

export type HostAction = 'tournament' | 'pick' | 'replay' | 'next' | 'lobby' | 'family' | 'teams' | 'pause' | 'resume';

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
  | { t: 'ping'; ts: number };

export const PEER_PREFIX = 'canapet-v1-';
export const CODE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

export function randomCode(): string {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  return c;
}

export function joinUrl(code: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}#/m/${code}`;
}
