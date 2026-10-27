// Photo Roulette : ce que la télé envoie en privé à chaque téléphone.

export interface RoulettePadData {
  phase: 'upload' | 'show' | 'reveal' | 'end';
  /** Nombre de photos et vidéos de ce joueur bien reçues par la télé. */
  sent: number;
  /** Vidéo Roulette (sinon photos). */
  video: boolean;
  ready: boolean;
  /** 'vote' : deviner ; 'owner' : c'est ta photo, fais semblant. */
  act: 'upload' | 'vote' | 'owner' | null;
  options: { i: number; name: string; color: string }[];
  picked: number;
  /** Résultat de la dernière photo pour ce joueur (null : pas voté ou propriétaire). */
  right: boolean | null;
  score: number;
  left: number;
}

/** Taille d'un morceau envoyé (en caractères base64). */
export const CHUNK = 48000;
/** Vidéos : au plus 20 Mo et 90 secondes (la télé en montre 15 s). */
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 90;
export const MAX_MEDIA = 16;
/** Au plus 4 vidéos dans le tirage. */
export const MAX_VIDEOS = 4;
