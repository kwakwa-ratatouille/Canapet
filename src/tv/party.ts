// Sorts des fantômes (vengeance des éliminés) et cases de la roue de la honte.
import type { Lang } from '../shared/protocol';

export type CurseKind = 'gel' | 'tournis' | 'mou' | 'hoquet';

export const CURSES: Record<CurseKind, { icon: string; name: Record<Lang, string>; dur: number }> = {
  gel: { icon: '🧊', name: { fr: 'Gel', en: 'Freeze' }, dur: 1.6 },
  tournis: { icon: '🌀', name: { fr: 'Tournis', en: 'Dizzy' }, dur: 3.5 },
  mou: { icon: '🐌', name: { fr: 'Tout mou', en: 'Sluggish' }, dur: 3.5 },
  hoquet: { icon: '🤧', name: { fr: 'Hoquet', en: 'Hiccups' }, dur: 3 },
};
/** Temps entre deux sorts d'un même fantôme. */
export const GHOST_COOL = 10;

/** Case de la roue : un gage dans la vraie vie, un malus au prochain jeu, ou une surprise. */
export interface WheelItem {
  icon: string;
  text: Record<Lang, string>;
  /** Malus au prochain jeu (sinon gage dans la vraie vie). */
  curse?: CurseKind;
  /** Le malus tombe sur un autre joueur au hasard ({X} dans le texte). */
  other?: boolean;
  /** Joker : personne ne prend rien. */
  joker?: boolean;
  /** Le gage passe à un autre joueur au hasard. */
  swap?: boolean;
}

const g = (icon: string, fr: string, en: string): WheelItem => ({ icon, text: { fr, en } });

export const GAGES: WheelItem[] = [
  g('🐔', 'Imite une poule pendant 10 secondes', 'Act like a chicken for 10 seconds'),
  g('🤖', 'Parle comme un robot jusqu’au prochain jeu', 'Talk like a robot until the next game'),
  g('😈', 'Fais ton meilleur rire de méchant de dessin animé', 'Do your best cartoon villain laugh'),
  g('🕺', 'Danse 15 secondes sur la musique de la télé', 'Dance for 15 seconds to the TV music'),
  g('🎙️', 'Commente le prochain jeu comme un journaliste sportif', 'Commentate the next game like a sports reporter'),
  g('🗣️', 'Parle avec un accent au choix jusqu’au prochain jeu', 'Speak with an accent of your choice until the next game'),
  g('🧍', 'Joue le prochain jeu debout', 'Play the next game standing up'),
  g('🤝', 'Fais un compliment sincère à chaque joueur', 'Give every player a sincere compliment'),
  g('🐒', 'Imite un animal, les autres doivent deviner', 'Imitate an animal, the others must guess'),
  g('😂', 'Raconte ta meilleure blague (même nulle)', 'Tell your best joke (even a bad one)'),
  g('🙇', 'Salue tout le monde comme un chevalier', 'Bow to everyone like a knight'),
  g('📢', 'Annonce le prochain jeu comme un présentateur de boxe', 'Announce the next game like a boxing announcer'),
  g('🗿', 'Fais la statue 20 secondes sans rire', 'Be a statue for 20 seconds without laughing'),
  g('🎵', 'Fredonne une chanson, les autres devinent', 'Hum a song, the others guess it'),
  g('👑', 'Appelle l’hôte « Votre Majesté » jusqu’au prochain jeu', 'Call the host “Your Majesty” until the next game'),
  g('🤐', 'Interdit de dire « oui » jusqu’au prochain jeu', 'You can’t say “yes” until the next game'),
  g('🦸', 'Prends une pose de super-héros pendant 10 secondes', 'Strike a superhero pose for 10 seconds'),
  g('🎭', 'Mime ton perso jusqu’à ce que quelqu’un devine', 'Mime your character until someone guesses'),
  g('🐧', 'Marche comme un pingouin jusqu’à la cuisine et reviens', 'Waddle like a penguin to the kitchen and back'),
  g('📣', 'Crie « JE SUIS LE ROI DU CANAPÉ ! » avec conviction', 'Shout “I AM THE COUCH KING!” with conviction'),
  g('🎤', 'Chante le refrain d’une chanson choisie par les autres', 'Sing the chorus of a song the others pick'),
  g('🥸', 'Imite un autre joueur, les autres devinent qui', 'Impersonate another player, the others guess who'),
  g('🧑‍🍳', 'Décris ton plat préféré comme un grand chef étoilé', 'Describe your favorite dish like a fancy chef'),
  g('🫡', 'Tu es le serveur : sers à boire à quelqu’un', 'You’re the waiter: get someone a drink'),
];

export const MALUS: WheelItem[] = [
  { icon: '🧊', text: { fr: 'Gelé 3 secondes au départ du prochain jeu', en: 'Frozen for 3 seconds at the start of the next game' }, curse: 'gel' },
  { icon: '🌀', text: { fr: 'Tournis pendant les 10 premières secondes du prochain jeu', en: 'Dizzy for the first 10 seconds of the next game' }, curse: 'tournis' },
  { icon: '🐌', text: { fr: 'Tout mou pendant les 10 premières secondes du prochain jeu', en: 'Sluggish for the first 10 seconds of the next game' }, curse: 'mou' },
  { icon: '🤧', text: { fr: 'Hoquet pendant les 10 premières secondes du prochain jeu', en: 'Hiccups for the first 10 seconds of the next game' }, curse: 'hoquet' },
  { icon: '🎯', text: { fr: 'Malus surprise pour {X} au prochain jeu !', en: 'Surprise penalty for {X} next game!' }, curse: 'tournis', other: true },
  { icon: '🎯', text: { fr: '{X} sera gelé au départ du prochain jeu !', en: '{X} will be frozen at the start of the next game!' }, curse: 'gel', other: true },
];

export const SURPRISES: WheelItem[] = [
  { icon: '🎁', text: { fr: 'Joker ! Tu es épargné… pour cette fois', en: 'Joker! You’re spared… this time' }, joker: true },
  { icon: '🔄', text: { fr: 'Retour à l’envoyeur : {X} prend le gage à ta place !', en: 'Return to sender: {X} takes the dare instead!' }, swap: true },
];

/** Les 8 cases de la roue : surtout des gages, quelques malus et une surprise. */
export function wheelItems(): WheelItem[] {
  const pick = (a: WheelItem[], n: number) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
  return [...pick(GAGES, 5), ...pick(MALUS, 2), ...pick(SURPRISES, 1)].sort(() => Math.random() - 0.5);
}

/** Durée d'un malus de la roue au départ du prochain jeu. */
export const MALUS_DUR: Record<CurseKind, number> = { gel: 3, tournis: 10, mou: 10, hoquet: 10 };
