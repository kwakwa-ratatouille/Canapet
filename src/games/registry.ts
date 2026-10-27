import { GAME_LIST } from '../shared/art/canapet-art.js';
import { archers } from './archers';
import { bluff } from './bluff';
import { board } from './board';
import { bombsGame } from './bombs';
import { brawl } from './brawl';
import { clash } from './clash';
import { kart } from './kart';
import { kitchen } from './kitchen';
import { scribble } from './scribble';
import { sumo } from './sumo';
import { thumbRace } from './thumbRace';
import { traitor } from './traitor';
import { tumble } from './tumble';
import { undercover } from './undercover';
import type { GameBase, GameDef } from './types';

/** Icône et couleur de chaque jeu (fichiers de la DA : public/da/jeux/<slug>.svg). */
const ART: Record<string, string> = {
  pouces: 'course-de-pouces',
  obstacles: 'la-degringolade',
  bluff: 'le-bar-des-bobards',
  bombes: 'petards-mouilles',
  sumo: 'sumo-tamponneur',
  kart: 'mini-bolides',
  archers: 'fleches-a-ventouse',
  bagarre: 'bagarre-molle',
  cuisine: 'cuisine-en-panique',
  traitre: 'le-traitre-du-frigo',
  dessin: 'gribouillis',
  plateau: 'le-grand-plateau',
  combat: 'coussin-clash',
  undercover: 'undercover',
};

/** Couleur des jeux ajoutés après la DA. */
const EXTRA_COLORS: Record<string, string> = { undercover: '#7b4dff' };

const withArt = (g: GameBase): GameDef => {
  const slug = ART[g.id];
  return { ...g, slug, color: GAME_LIST.find((x) => x.slug === slug)?.color ?? EXTRA_COLORS[g.id] ?? '#ff4f9a' };
};

/** Catalogue complet, dans l'ordre de la DA. */
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
  undercover,
  scribble,
  board,
  clash,
].map(withArt);

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
export const playable = () => GAMES.filter((g) => !g.soon);
