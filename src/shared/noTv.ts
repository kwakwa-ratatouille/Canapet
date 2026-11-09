// Jouer sans télé : un téléphone héberge la partie et joue en même temps ; les autres rejoignent avec le code, même à distance.
// L'image du jeu arrive sur chaque téléphone sous forme de photos régulières : parfait pour les jeux tranquilles, pas pour l'action.
import type { ToPad, ToTv } from './protocol';

/** Les jeux qui marchent vraiment bien sans écran commun : tout se joue sur le téléphone, rien ne va trop vite. */
export const PHONE_GAMES = ['duos', 'sondage', 'motus', 'longmot', 'meme', 'tribunal', 'dico', 'plutot', 'chiffre', 'lettre', 'trous', 'bluff', 'traitre', 'undercover', 'president', 'chef', 'reflexes', 'dessin', 'roulette'];

/** Jeux dont le téléphone a déjà tout : l'image reste repliée, on l'ouvre si on veut. */
export const PEEK_FOLDED = ['chef', 'reflexes'];

/** Liaison directe entre la session et la manette du même téléphone. */
export const localLink: { code: string; toTv: ((m: ToTv) => void) | null; toPad: ((m: ToPad) => void) | null } = { code: '', toTv: null, toPad: null };

/** Côté manette : la partie en cours est-elle sans télé ? */
export const noTvState = { on: false, shot: '' };
const watchers = new Set<() => void>();
export function setShot(d: string) {
  noTvState.shot = d;
  watchers.forEach((f) => f());
}
export function watchShot(f: () => void) {
  watchers.add(f);
  return () => {
    watchers.delete(f);
  };
}
