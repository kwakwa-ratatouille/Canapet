// Réflexes Éclair : ce que la télé envoie à chaque téléphone.

export interface ReflexPadData {
  /** Type d'épreuve : un gros bouton, ou des choix colorés. */
  kind: 'buzz' | 'mash' | 'choice' | 'wait';
  title: string;
  options: { label: string; color: string }[];
  /** Le joueur a déjà répondu (ou s'est fait piéger). */
  locked: boolean;
  note: string;
  score: number;
  /** Mémoire : la case demandée (0 à 3). */
  ask?: number;
  /** Tir à la corde : ton camp. */
  side?: { label: string; color: string };
}
