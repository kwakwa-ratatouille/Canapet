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
}
