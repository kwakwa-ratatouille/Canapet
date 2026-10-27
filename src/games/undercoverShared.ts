// Undercover : ce que la télé envoie en privé à chaque téléphone.

export interface UndercoverPadData {
  phase: 'roles' | 'clues' | 'debate' | 'vote' | 'reveal' | 'guess' | 'end';
  /** Ton mot (null pour Mr White, qui n'en a pas). */
  word: string | null;
  theme: string;
  alive: boolean;
  /** Ce que le joueur doit faire maintenant. */
  act: 'clue' | 'vote' | 'ready' | 'guess' | null;
  /** Nom du joueur dont c'est le tour d'indice. */
  turn: string;
  options: { i: number; name: string; color: string }[];
  picked: number;
  /** Message court (indice refusé, etc.). */
  note: string;
  left: number;
  myClues: string[];
}
