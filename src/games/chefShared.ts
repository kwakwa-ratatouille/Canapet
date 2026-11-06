// Le Chef Cachottier : ce que la télé envoie à chaque téléphone.
export interface ChefPadData {
  phase: 'clue' | 'guess' | 'end';
  /** chef = il voit les couleurs et donne l'indice ; guess = il cherche ; watch = l'autre équipe joue. */
  role: 'chef' | 'guess' | 'watch';
  team: string;
  color: string;
  turnTeam: string;
  clue: string;
  count: number;
  /** Encore combien de mots à tenter. */
  tries: number;
  left: number;
  /** owner : -1 caché, 0 ou 1 une équipe, 2 neutre, 3 maudit. key : la vraie couleur, seulement pour les chefs. */
  cards: { w: string; owner: number; key?: number; votes: number }[];
  voted: number;
  canPass: boolean;
  note: string;
  win: string;
}
