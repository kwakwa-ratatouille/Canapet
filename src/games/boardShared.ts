// Le Grand Plateau : ce que la télé envoie en privé à chaque téléphone.
export interface BoardPadData {
  mode: 'roll' | 'tap' | 'react' | 'coin' | 'wait';
  /** Réflexe : l'écran est passé au vert. */
  go: boolean;
  /** Réflexe : on a appuyé trop tôt. */
  early: boolean;
  taps: number;
  candies: number;
  stars: number;
  info: string;
}
