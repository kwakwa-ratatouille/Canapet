// La Bataille des Fusions : ce que partagent la télé et le téléphone (la manette n'importe pas le code des jeux).
export const FUSION_W = 800;
export const FUSION_H = 780;
export const FUSION_R = [28, 36, 46, 58, 70, 84, 98, 114, 130, 148];
export const FUSION_COLORS = ['#c9a8ff', '#ff8a7a', '#fff6e0', '#e8b878', '#ffc6e3', '#e8b4ff', '#e3bd8a', '#8fdc8a', '#ffd76a', '#f2a65a'];
export const FUSION_EMOJI = ['🍬', '🍅', '🥚', '🍪', '🍩', '🧅', '🥔', '🍉', '🍍', '🍔'];

export interface FusionPadData {
  color: string;
  team: string;
  /** C'est à ce joueur de lâcher. */
  mine: boolean;
  who: string;
  left: number;
  next: number;
  score: number;
  other: number;
  banner: string;
}
