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
import { trapGame } from './trap';
import { tribunal } from './tribunal';
import { dico } from './dico';
import { casse, devine, envers, imite, perroquet, voix } from './voice';
import { chiffre, plutot } from './quick';
import { mareeGame } from './maree';
import { chairsGame, colorGame, lavaGame, pixelGame, potatoGame, rainGame } from './minis';
import type { GameBase, GameDef } from './types';
import type { GameInfo } from '../shared/protocol';

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
  chaises: 'chaises',
  patate: 'patate',
  pluie: 'pluie',
  lave: 'lave',
  trappe: 'trappe',
  couleur: 'couleur',
  maree: 'maree',
  pixel: 'pixel',
  tribunal: 'tribunal',
  dico: 'dico',
  plutot: 'plutot',
  chiffre: 'chiffre',
  imite: 'imite',
  devine: 'devine',
  perroquet: 'perroquet',
  envers: 'envers',
  voix: 'voix',
  casse: 'casse',
};

/** Couleur des jeux ajoutés après la DA. */
const EXTRA_COLORS: Record<string, string> = { imite: '#ff4f9a', devine: '#2ec5ff', perroquet: '#22c99a', envers: '#9b5cff', voix: '#3a2140', casse: '#ff9a1f', undercover: '#7b4dff', roulette: '#ff9a1f', reflexes: '#ffd60a', foot: '#7bd13b', president: '#3f7be0', chaises: '#ff4f9a', patate: '#ff9a1f', pluie: '#2ec5ff', lave: '#ff5a1f', trappe: '#9b5cff', couleur: '#2ec5ff', maree: '#1e8fc0', pixel: '#9b5cff', tribunal: '#9b5cff', dico: '#2ec5ff', plutot: '#ffd60a', chiffre: '#7bd13b' };

const withArt = (g: GameBase): GameDef => {
  const slug = ART[g.id];
  return { ...g, slug, color: GAME_LIST.find((x) => x.slug === slug)?.color ?? EXTRA_COLORS[g.id] ?? '#ff4f9a' };
};

/** Catalogue complet, dans l'ordre de la DA. */
export const GAMES: GameDef[] = [
  tribunal,
  dico,
  plutot,
  chiffre,
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
  chairsGame,
  potatoGame,
  rainGame,
  lavaGame,
  trapGame,
  colorGame,
  mareeGame,
  pixelGame,
  clash,
  imite,
  devine,
  perroquet,
  envers,
  voix,
  casse,
].map(withArt);

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
export const playable = () => GAMES.filter((g) => !g.soon);

/** Fiche légère de chaque jeu, envoyée aux manettes. */
export const gameInfo = (games: GameDef[]): GameInfo[] => games.map((g) => ({ id: g.id, soon: !!g.soon, name: g.name, slug: g.slug, color: g.color, options: g.options }));
