// Modèle économique : appli gratuite, et un Pass Soirée acheté une fois par l'hôte, qui débloque tout pour tout le salon.
// Pas de pub, pas d'abonnement. Les objets se gagnent en jouant ; le Pass offre des bonbons, jamais d'avantage dans les jeux.

/** Interrupteur des ventes : tant qu'il est faux (phase de test), tous les jeux sont ouverts et rien n'est à vendre. */
export const SALES_ON = false;

/** Jeux toujours gratuits : de quoi faire une vraie soirée et donner envie du reste. */
export const FREE_GAMES = ['trappe', 'tribunal', 'dessin', 'sumo', 'bombes', 'chaises', 'patate', 'reflexes'];

/** Prix décidé au lancement : 3,99 € (réglé dans la console Google Play, jamais écrit en dur à l'écran). */

/** Bonbons offerts à l'achat du Pass. */
export const PASS_GIFT = 500;

const dayNumber = (now = Date.now()) => Math.floor((now + new Date(now).getTimezoneOffset() * -60000) / 86400000);

/** Le jeu du jour : un jeu du Pass, offert à tous pendant 24 h, différent chaque jour. */
export function gameOfDay(ids: string[], now = Date.now()): string | null {
  const paid = ids.filter((id) => !FREE_GAMES.includes(id));
  return paid.length ? paid[dayNumber(now) % paid.length] : null;
}

/** Ce jeu est-il fermé pour ce salon ? `pass` = un joueur connecté a le Pass. */
export function isLocked(id: string, ids: string[], pass: boolean, now = Date.now()): boolean {
  return SALES_ON && !pass && !FREE_GAMES.includes(id) && gameOfDay(ids, now) !== id;
}
