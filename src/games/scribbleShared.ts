// Gribouillis : ce que la télé envoie en privé à chaque téléphone.
export const INK_COLORS = ['#3a2140', '#ff3b3b', '#ff9a1f', '#ffd60a', '#7bd13b', '#2ec5ff', '#9b5cff', '#ff4f9a', '#a0643a', '#ffffff'];

export interface ScribblePadData {
  role: 'draw' | 'guess' | 'wait';
  word: string;
  hint: string;
  drawer: string;
  found: boolean;
  /** Message pour celui qui devine : « presque ! », « déjà trouvé »… */
  note: string;
  turn: number;
  turns: number;
}

/** Minuscules, sans accents ni espaces superflus. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
