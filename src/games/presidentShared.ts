// Le Président : ce que la télé envoie en privé à chaque téléphone.
// Une carte = un nombre de 0 à 51 : valeur = floor(c / 4) (0 = 3 … 11 = As, 12 = 2), couleur = c % 4.
export const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R', 'A', '2'];
export const RANKS_EN = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
export const SUITS = ['♠', '♥', '♦', '♣'];
export const rankOf = (c: number) => Math.floor(c / 4);
export const isRed = (c: number) => c % 4 === 1 || c % 4 === 2;

export interface PresidentPadData {
  hand: number[];
  phase: 'deal' | 'swap' | 'play' | 'round' | 'end';
  myTurn: boolean;
  /** Nombre de cartes à poser (0 = c'est toi qui ouvres : 1 à 4 cartes). */
  need: number;
  /** Valeur minimum à poser (-1 = libre). */
  min: number;
  /** Cartes à choisir pour les donner (Président : 2, Vice-président : 1). */
  give: number;
  giveTo: string;
  role: string;
  turnName: string;
  /** Ce qui est sur la table. */
  pile: number[];
  pileBy: string;
  note: string;
  done: number;
}
