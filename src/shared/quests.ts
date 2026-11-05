// Raisons de revenir : un cadeau pour la première partie du jour (série de jours) et 3 défis par semaine.
// Tout est gardé sur le téléphone avec la progression. Récompenses en bonbons uniquement.
import type { Lang } from './protocol';

export interface Habits {
  day: number;
  streak: number;
  week: number;
  counts: Record<string, number>;
  done: string[];
  /** Jeux différents essayés cette semaine. */
  tried: string[];
}

export const NEW_HABITS: Habits = { day: 0, streak: 0, week: 0, counts: {}, done: [], tried: [] };

/** Cadeau selon la série : le 7e jour vaut le coup, puis ça recommence. */
const DAILY = [20, 25, 30, 35, 40, 50, 100];

interface Quest {
  id: string;
  n: number;
  gift: number;
  label: Record<Lang, string>;
}

const QUESTS: Quest[] = [
  { id: 'play', n: 5, gift: 60, label: { fr: 'Joue 5 parties', en: 'Play 5 games' } },
  { id: 'play2', n: 10, gift: 120, label: { fr: 'Joue 10 parties', en: 'Play 10 games' } },
  { id: 'win', n: 2, gift: 80, label: { fr: 'Gagne 2 parties', en: 'Win 2 games' } },
  { id: 'top', n: 4, gift: 70, label: { fr: 'Finis 4 fois dans les 3 premiers', en: 'Finish top 3 four times' } },
  { id: 'try', n: 4, gift: 80, label: { fr: 'Essaie 4 jeux différents', en: 'Try 4 different games' } },
  { id: 'crown', n: 1, gift: 100, label: { fr: 'Monte sur un podium de tournoi', en: 'Reach a tournament podium' } },
];

const dayOf = (now: number) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);
// Les semaines commencent le lundi (le 1er janvier 1970 était un jeudi)
const weekOf = (now: number) => Math.floor((dayOf(now) + 3) / 7);

/** Les 3 défis de cette semaine, les mêmes pour tout le monde. */
export function weekQuests(now = Date.now()): Quest[] {
  const w = weekOf(now);
  return [0, 2, 4].map((k) => {
    // Un défi par famille, qui change chaque semaine
    const a = QUESTS[k];
    const b = QUESTS[k + 1];
    return w % 2 ? b : a;
  });
}

const fresh = (h: Habits, now: number): Habits => (h.week === weekOf(now) ? h : { ...h, week: weekOf(now), counts: {}, done: [], tried: [] });

export function questsNow(h: Habits | undefined, now = Date.now()) {
  const cur = fresh(h ?? NEW_HABITS, now);
  return weekQuests(now).map((q) => ({ ...q, have: Math.min(q.n, cur.counts[q.id] ?? 0), ok: cur.done.includes(q.id) }));
}

/** Une partie terminée : met à jour la série et les défis, et dit combien de bonbons ça rapporte. */
export function afterGame(h0: Habits | undefined, e: { rank: number; game?: string; podium?: boolean }, now = Date.now()) {
  let h = fresh(h0 ?? NEW_HABITS, now);
  let daily = 0;
  const today = dayOf(now);
  if (!e.podium && h.day !== today) {
    const streak = h.day === today - 1 ? h.streak + 1 : 1;
    daily = DAILY[(streak - 1) % DAILY.length];
    h = { ...h, day: today, streak };
  }
  const counts = { ...h.counts };
  const bump = (id: string, by = 1) => (counts[id] = (counts[id] ?? 0) + by);
  const tried = e.game && !h.tried.includes(e.game) ? [...h.tried, e.game] : h.tried;
  if (e.podium) {
    if (e.rank >= 1 && e.rank <= 3) bump('crown');
  } else {
    bump('play');
    bump('play2');
    if (e.rank === 1) bump('win');
    if (e.rank >= 1 && e.rank <= 3) bump('top');
    counts.try = tried.length;
  }
  const finished = weekQuests(now).filter((q) => !h.done.includes(q.id) && (counts[q.id] ?? 0) >= q.n);
  return {
    habits: { ...h, counts, tried, done: [...h.done, ...finished.map((q) => q.id)] },
    daily,
    streak: h.streak,
    quests: finished.map((q) => ({ label: q.label, gift: q.gift })),
    coins: daily + finished.reduce((s, q) => s + q.gift, 0),
  };
}
