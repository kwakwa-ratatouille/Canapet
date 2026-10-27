import { thumbRace } from './thumbRace';
import { tumble } from './tumble';
import { bluff } from './bluff';
import { sumo } from './sumo';
import { bombsGame } from './bombs';
import { kart } from './kart';
import { archers } from './archers';
import { scribble } from './scribble';
import { traitor } from './traitor';
import { clash } from './clash';
import { brawl } from './brawl';
import { kitchen } from './kitchen';
import { board } from './board';
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
  brawl,
  kitchen,
  traitor,
  scribble,
  board,
  clash,
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
export const playable = () => GAMES.filter((g) => !g.soon);
