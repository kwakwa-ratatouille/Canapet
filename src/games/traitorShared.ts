// Le Traître du Frigo : données privées envoyées à chaque téléphone.
export type Role = 'gourmand' | 'pique' | 'gouteur';

export interface TraitorPadData {
  phase: 'roles' | 'night' | 'morning' | 'debate' | 'vote' | 'verdict' | 'end';
  role: Role;
  alive: boolean;
  mates: string[];
  /** Choix possibles (index de joueur + pseudo + couleur). */
  options: { i: number; name: string; color: string }[];
  /** Ce que je dois faire maintenant, ou rien. */
  act: 'kill' | 'sniff' | 'vote' | 'ready' | null;
  picked: number;
  info: string;
  left: number;
}
