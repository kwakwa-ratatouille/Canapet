// Progression du joueur, gardée sur son téléphone : expérience, niveaux, bonbons 🍬 et objets achetés.
// (Plus tard : synchronisée avec le compte Google quand le projet Firebase existera.)
import { save, store } from './device';

export interface Progress {
  xp: number;
  coins: number;
  /** Objets achetés : « food:pizza », « hat:toque », « acc:barbe »… */
  owned: string[];
  games: number;
  wins: number;
  /** Dernière partie déjà comptée (code de la télé + numéro), pour ne jamais compter deux fois. */
  last: string;
}

export type Kind = 'food' | 'hat' | 'acc';

/** Prix en bonbons et niveau minimum. Ce qui n'est pas listé est gratuit dès le départ. */
export const PRICES: Record<string, { price: number; level?: number }> = {
  'food:cupcake': { price: 60 },
  'food:sushi': { price: 60 },
  'food:frites': { price: 80 },
  'food:bonbon': { price: 80 },
  'food:chaussette': { price: 100, level: 2 },
  'food:pizza': { price: 120, level: 2 },
  'food:glace': { price: 120, level: 3 },
  'food:avocat': { price: 150, level: 3 },
  'food:macaron': { price: 150, level: 4 },
  'food:banane': { price: 180, level: 4 },
  'food:nuage': { price: 250, level: 6 },
  'hat:antenne': { price: 40 },
  'hat:fete': { price: 50 },
  'hat:fleur': { price: 50 },
  'hat:bonnet': { price: 60 },
  'hat:cornes': { price: 60, level: 2 },
  'hat:haut': { price: 80, level: 2 },
  'hat:toque': { price: 90, level: 3 },
  'hat:pirate': { price: 120, level: 4 },
  'hat:sorciere': { price: 150, level: 5 },
  'hat:couronne': { price: 200, level: 5 },
  'hat:aureole': { price: 250, level: 8 },
  'acc:rougir': { price: 40 },
  'acc:soleil': { price: 50 },
  'acc:bisou': { price: 60, level: 2 },
  'acc:monocle': { price: 80, level: 2 },
  'acc:barbe': { price: 90, level: 3 },
  'acc:masque': { price: 100, level: 4 },
  'acc:coeurs': { price: 150, level: 5 },
};

const START: Progress = { xp: 0, coins: 60, owned: [], games: 0, wins: 0, last: '' };

export function loadProgress(): Progress {
  return { ...START, ...store<Partial<Progress>>('progress', {}) };
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
