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
}

export type PadLayout = 'tap' | 'stick';

export interface GameInfo {
  id: string;
  soon: boolean;
}

export type PadScreen =
  | { s: 'lobby'; host: boolean; hostName: string; taken: string[]; games: GameInfo[]; count: number }
  | { s: 'play'; layout: PadLayout; game: string }
  | { s: 'wait'; game: string }
  | {
      s: 'results';
      host: boolean;
      rank: number;
      points: number;
      total: number;
      step: { index: number; count: number } | null;
    }
  | { s: 'podium'; host: boolean; rank: number; total: number };

/** Télé → téléphone */
export type ToPad =
  | { t: 'welcome'; color: string; code: string }
  | { t: 'screen'; screen: PadScreen }
  | { t: 'buzz'; ms: number }
  | { t: 'pong'; ts: number };

export type HostAction = 'tournament' | 'pick' | 'replay' | 'next' | 'lobby';

/** Téléphone → télé */
export type ToTv =
  | { t: 'hello'; pid: string; profile: Profile }
  | { t: 'profile'; profile: Profile }
  | { t: 'tap'; side: 0 | 1 }
  | { t: 'in'; x: number; y: number; a: boolean; b: boolean }
  | { t: 'host'; action: HostAction; game?: string }
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
