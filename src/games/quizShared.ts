// Le Tribunal et Le Dico Bidon : ce que la télé envoie en privé à chaque téléphone.

export interface QuizPadData {
  phase: 'write' | 'choose' | 'reveal' | 'end';
  /** La question ou le mot, rappelé sur le téléphone. */
  prompt: string;
  /** Sous-titre (« Manche 2/8 »). */
  step: string;
  /** Ce que le joueur doit faire : écrire, choisir, ou attendre. */
  act: 'write' | 'choose' | null;
  options: { i: number; label: string; color: string }[];
  picked: number;
  score: number;
  left: number;
  /** Message court (réponse refusée, etc.). */
  note: string;
}
