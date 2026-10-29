// Réactions envoyées depuis les téléphones et qui s'envolent sur la télé.
// Les « rude » sont cachées en mode famille ; les « pet » font le bruitage du coussin péteur.

export interface Reaction {
  /** Emoji, ou texte crié (txt) affiché dans une bulle. */
  e: string;
  txt?: { fr: string; en: string };
  rude?: boolean;
  pet?: boolean;
}

export const REACTIONS: Reaction[] = [
  { e: '😂' },
  { e: '🤣' },
  { e: '💀' },
  { e: '🔥' },
  { e: '👏' },
  { e: '😱' },
  { e: '😭' },
  { e: '🤡' },
  { e: '🖕', rude: true },
  { e: '🍑', rude: true, pet: true },
  { e: '🍆', rude: true },
  { e: '🤬', rude: true },
  { e: '💩', pet: true },
  { e: '💨', pet: true },
  { e: '🤮' },
  { e: '🥵' },
  { e: '😈' },
  { e: '🫵' },
  { e: '🤌' },
  { e: '🙈' },
  { e: '🐐' },
  { e: '🧂' },
  { e: '👀' },
  { e: '🥱' },
  { e: '💅' },
  { e: '🗿' },
  { e: '🫠' },
  { e: '🐔' },
  { e: '🤏' },
  { e: '🍿' },
  { e: '❤️' },
  { e: '🎉' },
  { e: '💬', txt: { fr: 'GG', en: 'GG' } },
  { e: '💬', txt: { fr: 'CHEH !', en: 'GET REKT!' } },
  { e: '💬', txt: { fr: 'NUL !', en: 'TRASH!' } },
  { e: '💬', txt: { fr: 'TRICHEUR !', en: 'CHEATER!' } },
  { e: '💬', txt: { fr: 'BOUH !', en: 'BOO!' } },
  { e: '💬', txt: { fr: 'ALLEZ !', en: 'GO GO GO!' } },
  { e: '💬', txt: { fr: 'OH NON…', en: 'OH NO…' } },
  { e: '💬', txt: { fr: 'MDRRR', en: 'LMAOOO' } },
  { e: '💬', txt: { fr: 'T’ES MORT', en: 'YOU’RE DEAD' }, rude: true },
  { e: '💬', txt: { fr: 'FERME-LA', en: 'SHUT UP' }, rude: true },
  { e: '💬', txt: { fr: 'NOOB', en: 'NOOB' } },
  { e: '💬', txt: { fr: 'QUOICOUBEH', en: 'SKILL ISSUE' } },
];

/** Réactions « mal élevées » : comptées pour le titre du plus vulgaire au bilan de soirée. */
export const isRude = (i: number) => !!REACTIONS[i]?.rude;
