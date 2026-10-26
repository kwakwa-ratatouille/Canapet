import { thumbRace } from './thumbRace';
import { tumble } from './tumble';
import { bluff } from './bluff';
import { sumo } from './sumo';
import { bombsGame } from './bombs';
import { kart } from './kart';
import { archers } from './archers';
import { scribble } from './scribble';
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
  tumble,
  bluff,
  bombsGame,
  sumo,
  kart,
  archers,
  soon('bagarre', '🤼', 'Bagarre Molle', 'Wobbly Brawl', 'Gang Beasts', 8),
  soon('cuisine', '🍳', 'Cuisine en Panique', 'Kitchen Panic', 'Overcooked', 8),
  soon('traitre', '🕵️', 'Le Traître du Frigo', 'Fridge Traitor', 'Loup-garou / Among Us', 12, 'tap'),
  scribble,
  soon('plateau', '🎲', 'Le Grand Plateau', 'The Big Board', 'Mario Party', 8),
  soon('combat', '🥊', 'Coussin Clash', 'Cushion Clash', 'Smash Bros', 8),
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
export const playable = () => GAMES.filter((g) => !g.soon);
