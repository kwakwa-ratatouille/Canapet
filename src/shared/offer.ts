// Modèle économique : appli gratuite, Pass Soirée (3,99 €, acheté une fois par l'hôte, tous les jeux pour tout le salon),
// packs de questions (1,99 €, profitent à tout le salon) et collections de tenues (1,99 €, pour le joueur qui les achète).
// Pas de pub, pas d'abonnement, rien qui donne un avantage dans les jeux. Prix réglés dans la console Google Play.
import type { Lang } from './protocol';

/** Interrupteur des ventes : tant qu'il est faux (phase de test), tout est ouvert et rien n'est à vendre. ?ventes=1 montre les verrous pour tester. */
export const SALES_ON = false || /[?&]ventes=1/.test(location.search + location.hash);

/** Jeux toujours gratuits : de quoi faire une vraie soirée et donner envie du reste. */
export const FREE_GAMES = ['trappe', 'tribunal', 'dessin', 'sumo', 'bombes', 'chaises', 'patate', 'reflexes'];

export const PASS = 'pass_soiree';
/** Joueurs dans un salon sans Pass Soirée (12 avec). */
export const FREE_PLAYERS = 6;
/** Bonbons offerts à l'achat du Pass. */
export const PASS_GIFT = 500;

export interface Product {
  id: string;
  emoji: string;
  name: Record<Lang, string>;
  desc: Record<Lang, string>;
  /** Pack réservé hors mode famille. */
  adult?: boolean;
}

export const PACKS: Product[] = [
  { id: 'pack_couples', emoji: '💘', name: { fr: 'En couple', en: 'Couples' }, desc: { fr: 'Pour savoir qui ronfle, qui ment et qui fait la vaisselle.', en: 'Find out who snores, who lies and who does the dishes.' } },
  { id: 'pack_famille', emoji: '🏡', name: { fr: 'Repas de famille', en: 'Family dinner' }, desc: { fr: 'Tatas, cousins et secrets de table, sans rien de gênant.', en: 'Aunties, cousins and table secrets, nothing awkward.' } },
  { id: 'pack_boulot', emoji: '💼', name: { fr: 'Au boulot', en: 'At work' }, desc: { fr: 'Réunions inutiles et machine à café, entre collègues.', en: 'Useless meetings and coffee machine drama.' } },
  { id: 'pack_minuit', emoji: '🌙', name: { fr: 'Après minuit', en: 'After midnight' }, adult: true, desc: { fr: 'Pour les soirées qui finissent trop tard.', en: 'For parties that end too late.' } },
];

export const COLLECTIONS: Product[] = [
  { id: 'coll_noel', emoji: '🎄', name: { fr: 'Collection Noël', en: 'Christmas collection' }, desc: { fr: 'Bonnet de Noël, bois de renne et écharpe.', en: 'Santa hat, reindeer antlers and scarf.' } },
  { id: 'coll_halloween', emoji: '🎃', name: { fr: 'Collection Halloween', en: 'Halloween collection' }, desc: { fr: 'Citrouille, chauve-souris et crocs de vampire.', en: 'Pumpkin, bat and vampire fangs.' } },
  { id: 'coll_plage', emoji: '🏖️', name: { fr: 'Collection Plage', en: 'Beach collection' }, desc: { fr: 'Ananas, aileron de requin et tuba.', en: 'Pineapple, shark fin and snorkel.' } },
];

/** Clés du coffre : achat à usage unique. Le serveur tient le compte et ouvre le coffre. */
export const KEY_PACKS: Product[] = [
  { id: 'keys_1', emoji: '🔑', name: { fr: '1 clé', en: '1 key' }, desc: { fr: 'Ouvre un coffre : légendaire 88 %, mythique 12 %.', en: 'Opens a chest: legendary 88%, mythic 12%.' } },
  { id: 'keys_5', emoji: '🔑', name: { fr: '5 clés', en: '5 keys' }, desc: { fr: 'Ouvre 5 coffres : légendaire 88 %, mythique 12 %.', en: 'Opens 5 chests: legendary 88%, mythic 12%.' } },
  { id: 'keys_12', emoji: '🔑', name: { fr: '12 clés', en: '12 keys' }, desc: { fr: 'Ouvre 12 coffres : légendaire 88 %, mythique 12 %.', en: 'Opens 12 chests: legendary 88%, mythic 12%.' } },
];

/** Les boîtes payantes sont interdites en Belgique, et incertaines aux Pays-Bas : pas de coffre là-bas (selon la langue et le fuseau de l'appareil). */
const tz = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
})();
export const KEYS_ALLOWED = !/Brussels|Amsterdam/.test(tz) && !/-(BE|NL)$/i.test(navigator.language) && !/^nl\b/i.test(navigator.language);

export const PASS_PRODUCT: Product = {
  id: PASS,
  emoji: '🎟️',
  name: { fr: 'Pass Soirée', en: 'Party Pass' },
  desc: { fr: 'Un seul achat, une seule personne, et tout le salon joue à tous les jeux, à chaque soirée, jusqu’à 12 joueurs au lieu de 6.', en: 'One purchase, one person, and the whole room plays every game, every party, with up to 12 players instead of 6.' },
};

/** Prix affichés sur le site (ceux facturés sont sur le serveur, functions/index.js). */
export const WEB_PRICE = (id: string) => (id === PASS ? '3,99 €' : id === 'keys_1' ? '0,99 €' : id === 'keys_5' ? '3,99 €' : id === 'keys_12' ? '7,99 €' : '1,99 €');

export const productById = (id: string) => [PASS_PRODUCT, ...PACKS, ...COLLECTIONS, ...KEY_PACKS].find((p) => p.id === id);

/** Option « Questions » des jeux à packs : 0 = classiques, puis un numéro par pack. */
export const PACK_OPTION = {
  id: 'pack',
  label: { fr: 'Questions', en: 'Questions' },
  choices: [{ v: 0, label: { fr: '🎲 Classiques', en: '🎲 Classic' } }, ...PACKS.map((p, i) => ({ v: i + 1, pack: p.id, label: { fr: `${p.emoji} ${p.name.fr}`, en: `${p.emoji} ${p.name.en}` } }))],
};

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
