// Ce que la télé envoie en privé à chaque téléphone pendant Le Bar des Bobards.
import type { Lang } from '../shared/protocol';

export type Card = 'tartine' | 'cornichon' | 'fromage' | 'coussin' | 'miroir';

export const CARD_NAMES: Record<Card, Record<Lang, string>> = {
  tartine: { fr: 'Tartine', en: 'Toast' },
  cornichon: { fr: 'Cornichon', en: 'Pickle' },
  fromage: { fr: 'Fromage', en: 'Cheese' },
  coussin: { fr: 'Joker', en: 'Wild' },
  // Le Miroir renvoie l'accusation : s'il est retourné, c'est l'accusateur qui perd.
  miroir: { fr: 'Miroir', en: 'Mirror' },
};

export interface BluffPadData {
  table: Card;
  hand: Card[];
  alive: boolean;
  shots: number;
  /** C'est à moi : je peux poser (et/ou crier menteur). */
  myTurn: boolean;
  canCall: boolean;
  forced: boolean;
  /** Je dois appuyer sur mon coussin. */
  roulette: boolean;
  turnName: string;
  claim: { name: string; count: number } | null;
}
