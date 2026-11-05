// Jeux au micro : ce que la télé envoie en privé à chaque téléphone.
export const VOICE_GAMES = ['imite', 'devine', 'perroquet', 'envers', 'voix', 'casse'];

export interface VoicePadData {
  phase: 'record' | 'listen' | 'choose' | 'write' | 'reveal' | 'end';
  /** Ce qu'il faut faire ou dire (secret si c'est à toi seul). */
  prompt: string;
  /** Sous-titre (« Manche 2/4 »). */
  step: string;
  act: 'record' | 'choose' | 'write' | null;
  /** Numéro de l'enregistrement attendu. */
  clip: number;
  /** Durée maximale de l'enregistrement. */
  maxSec: number;
  /** Déjà reçu par la télé. */
  sent: boolean;
  options: { i: number; label: string; color: string }[];
  picked: number;
  score: number;
  left: number;
  note: string;
  /** Son à écouter sur ton téléphone (Le Téléphone Cassé). */
  heard?: string;
}
