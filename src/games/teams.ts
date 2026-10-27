// Mode équipes : deux camps (Fraise contre Menthe). Sans équipes, chacun est son propre camp (mêlée générale).
import type { Lang } from '../shared/protocol';
import type { Runner } from './types';

export const TEAMS: { name: Record<Lang, string>; color: string; emoji: string }[] = [
  { name: { fr: 'Équipe Fraise', en: 'Team Strawberry' }, color: '#ff4f9a', emoji: '🍓' },
  { name: { fr: 'Équipe Menthe', en: 'Team Mint' }, color: '#1fc9a0', emoji: '🌿' },
];

/** Camp d'un joueur : son équipe, ou lui seul en mêlée générale. */
export const side = (r: Runner) => (r.team === undefined ? 'p' + r.pid : 't' + r.team);

/** Deux joueurs du même camp ne se font pas mal. */
export const allies = (a: Runner, b: Runner) => a !== b && a.team !== undefined && a.team === b.team;

/** Nombre de camps qui ont encore quelqu'un en jeu. */
export const sidesLeft = (alive: Runner[]) => new Set(alive.map(side)).size;

/** Nom à annoncer pour la victoire d'un joueur : son équipe en mode équipes. */
export const winnerName = (r: Runner, lang: Lang) => (r.team === undefined ? r.profile.name : TEAMS[r.team].name[lang]);
