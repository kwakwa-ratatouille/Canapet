// Progression du joueur, gardée sur son téléphone : expérience, niveaux, bonbons 🍬 et objets achetés.
// (Plus tard : synchronisée avec le compte Google quand le projet Firebase existera.)
import { save, store } from './device';
import { LOOT_PRICES, type LootKind, type Rarity } from './lootTable';
import type { Habits } from './quests';

export interface Progress {
  xp: number;
  coins: number;
  /** Objets achetés : « food:pizza », « hat:toque », « acc:barbe »… */
  owned: string[];
  games: number;
  wins: number;
  /** Série de jours et défis de la semaine. */
  habits?: Habits;
  /** Boîtes gratuites en attente d'ouverture, compteurs de garantie, clés d'essai. */
  boxes?: Record<string, number>;
  pity?: Record<string, number>;
  testKeys?: number;
  /** Dernière partie déjà comptée (code de la télé + numéro), pour ne jamais compter deux fois. */
  last: string;
}

export type Kind = LootKind;

/** Prix en bonbons (voir lootTable.ts). Ce qui n'est pas listé est gratuit dès le départ. */
export const PRICES: Record<string, { price: number; level?: number; rarity?: Rarity; /** Collection payante : achetée quand les ventes sont ouvertes. */ coll?: string }> = LOOT_PRICES;

const START: Progress = { xp: 0, coins: 60, owned: [], games: 0, wins: 0, last: '' };

/** Même limite que database.rules.json : au-delà, la sauvegarde du compte serait refusée. */
export const MAX_COINS = 10000000;
/** Un compte au-dessus de la limite (ancien code de test à 500 millions) revient à 500 000. */
export const fixCoins = (n: number) => (n >= MAX_COINS ? 500000 : n);

export function loadProgress(): Progress {
  const p = { ...START, ...store<Partial<Progress>>('progress', {}) };
  return { ...p, coins: fixCoins(p.coins) };
}

export function saveProgress(p: Progress) {
  save('progress', p);
}

/** XP pour passer du niveau n au suivant. */
export const xpFor = (level: number) => 100 + (level - 1) * 60;

export function levelInfo(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let left = xp;
  while (left >= xpFor(level)) {
    left -= xpFor(level);
    level++;
  }
  return { level, into: left, need: xpFor(level) };
}

export const itemKey = (kind: Kind, id: string) => `${kind}:${id}`;

export function isOwned(p: Progress, kind: Kind, id: string) {
  const k = itemKey(kind, id);
  return !PRICES[k] || p.owned.includes(k);
}

/** Gains d'une partie : un peu pour avoir joué, plus selon les points marqués. */
export function rewardFor(points: number, rank: number) {
  return { xp: 30 + points * 8, coins: 5 + points * 2 + (rank === 1 ? 10 : 0) };
}

/** Bonus du podium du tournoi. */
export const podiumBonus = (rank: number) => [0, 50, 30, 20][rank] ?? 5;

/** Bonbons offerts à chaque niveau gagné. */
export const LEVEL_GIFT = 40;
