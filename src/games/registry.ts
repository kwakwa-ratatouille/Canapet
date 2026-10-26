import { thumbRace } from './thumbRace';
import type { GameDef } from './types';

const soon = (
  id: string,
  emoji: string,
  fr: string,
  en: string,
  inspired: string,
  max: number,
  layout: GameDef['layout'] = 'stick',
): GameDef => ({
  id,
  emoji,
  name: { fr, en },
  how: { fr: '', en: '' },
  inspired,
  layout,
  min: 2,
  max,
  botFill: 4,
  music: 'race',
  soon: true,
});

/** Catalogue complet, dans l'ordre de fabrication prévu. */
export const GAMES: GameDef[] = [
  thumbRace,
  soon('obstacles', '🏃', 'La Dégringolade', 'Tumble Run', 'Fall Guys', 12),
  soon('bluff', '🃏', 'Le Bar des Bobards', 'Fibbers’ Bar', "Liar's Bar", 6, 'tap'),
  soon('bombes', '💣', 'Pétards Mouillés', 'Soggy Bangers', 'Bomberman', 8),
  soon('sumo', '🛞', 'Sumo Tamponneur', 'Bumper Sumo', 'auto-tamponneuses', 12),
  soon('kart', '🏎️', 'Mini Bolides', 'Tiny Racers', 'Micro Machines', 8),
  soon('archers', '🏹', 'Flèches à Ventouse', 'Sucker Arrows', 'TowerFall', 8),
  soon('bagarre', '🤼', 'Bagarre Molle', 'Wobbly Brawl', 'Gang Beasts', 8),
  soon('cuisine', '🍳', 'Cuisine en Panique', 'Kitchen Panic', 'Overcooked', 8),
  soon('traitre', '🕵️', 'Le Traître du Frigo', 'Fridge Traitor', 'Loup-garou / Among Us', 12, 'tap'),
  soon('dessin', '✏️', 'Gribouillis', 'Scribbles', 'Jackbox', 12, 'tap'),
  soon('plateau', '🎲', 'Le Grand Plateau', 'The Big Board', 'Mario Party', 8),
  soon('combat', '🥊', 'Coussin Clash', 'Cushion Clash', 'Smash Bros', 8),
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
export const playable = () => GAMES.filter((g) => !g.soon);
