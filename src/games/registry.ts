import { GAME_LIST } from '../shared/art/canapet-art.js';
import { archers } from './archers';
import { bluff } from './bluff';
import { bombsGame } from './bombs';
import { brawl } from './brawl';
import { clash } from './clash';
import { kart } from './kart';
import { foot } from './foot';
import { reflex } from './reflex';
import { scribble } from './scribble';
import { sumo } from './sumo';
import { thumbRace } from './thumbRace';
import { traitor } from './traitor';
import { tumble } from './tumble';
import { undercover } from './undercover';
import { roulette } from './roulette';
import { president } from './president';
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
  reflexes: 'reflexes-eclair',
  foot: 'coussin-foot',
  traitre: 'le-traitre-du-frigo',
  dessin: 'gribouillis',
  combat: 'coussin-clash',
  undercover: 'undercover',
  roulette: 'photo-roulette',
  president: 'president',
};

/** Couleur des jeux ajoutés après la DA. */
const EXTRA_COLORS: Record<string, string> = { undercover: '#7b4dff', roulette: '#ff9a1f', reflexes: '#ffd60a', foot: '#7bd13b', president: '#3f7be0' };

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
  reflex,
  foot,
  traitor,
  undercover,
  roulette,
  scribble,
  president,
  clash,
].map(withArt);

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
export const playable = () => GAMES.filter((g) => !g.soon);
