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
  /** Défis du jour. */
  qDay?: number;
  dayCounts?: Record<string, number>;
  dayDone?: string[];
  /** Jours joués cette semaine et caisse de la semaine déjà reçue. */
  weekDays?: number[];
  weekBox?: boolean;
  /** Récompenses déjà récupérées. */
  claimed?: string[];
  dayClaimed?: string[];
}

export const NEW_HABITS: Habits = { day: 0, streak: 0, week: 0, counts: {}, done: [], tried: [] };

/** Cadeau selon la série : le 7e jour vaut le coup, puis ça recommence. */
const DAILY = [20, 25, 30, 35, 40, 50, 100];

interface Quest {
  id: string;
  n: number;
  gift: number;
  /** 0 facile, 1 moyen, 2 dur. */
  diff: number;
  icon: string;
  label: Record<Lang, string>;
}

const QUESTS: Quest[] = [
  { id: 'play', diff: 0, icon: '🎮', n: 5, gift: 60, label: { fr: 'Joue 5 parties', en: 'Play 5 games' } },
  { id: 'play2', diff: 1, icon: '🎮', n: 10, gift: 120, label: { fr: 'Joue 10 parties', en: 'Play 10 games' } },
  { id: 'win', diff: 1, icon: '🏆', n: 2, gift: 80, label: { fr: 'Gagne 2 parties', en: 'Win 2 games' } },
  { id: 'top', diff: 0, icon: '🥉', n: 4, gift: 70, label: { fr: 'Finis 4 fois dans les 3 premiers', en: 'Finish top 3 four times' } },
  { id: 'try', diff: 1, icon: '🧭', n: 4, gift: 80, label: { fr: 'Essaie 4 jeux différents', en: 'Try 4 different games' } },
  { id: 'crown', diff: 2, icon: '👑', n: 1, gift: 100, label: { fr: 'Monte sur un podium de tournoi', en: 'Reach a tournament podium' } },
];

const DAILY_QUESTS: Quest[] = [
  { id: 'dPlay', diff: 0, icon: '🎮', n: 3, gift: 30, label: { fr: 'Joue 3 parties', en: 'Play 3 games' } },
  { id: 'dWin', diff: 1, icon: '🏆', n: 1, gift: 40, label: { fr: 'Gagne une partie', en: 'Win a game' } },
  { id: 'dTop', diff: 1, icon: '🥉', n: 2, gift: 30, label: { fr: 'Finis 2 fois dans les 3 premiers', en: 'Finish top 3 twice' } },
  { id: 'dPlay2', diff: 2, icon: '🎮', n: 5, gift: 50, label: { fr: 'Joue 5 parties', en: 'Play 5 games' } },
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

const freshWeek = (h: Habits, now: number): Habits => (h.week === weekOf(now) ? h : { ...h, week: weekOf(now), counts: {}, done: [], tried: [], weekDays: [], weekBox: false, claimed: [] });
const fresh = (h: Habits, now: number): Habits => {
  const w = freshWeek(h, now);
  return w.qDay === dayOf(now) ? w : { ...w, qDay: dayOf(now), dayCounts: {}, dayDone: [], dayClaimed: [] };
};

/** Les 2 défis du jour, les mêmes pour tout le monde. */
export function dayQuests(now = Date.now()): Quest[] {
  const d = dayOf(now);
  return [DAILY_QUESTS[d % 2 ? 0 : 3], DAILY_QUESTS[d % 3 === 0 ? 2 : 1]];
}

export function dailyNow(h: Habits | undefined, now = Date.now()) {
  const cur = fresh(h ?? NEW_HABITS, now);
  return dayQuests(now).map((q) => {
    const ok = !!cur.dayDone?.includes(q.id);
    const claimed = !!cur.dayClaimed?.includes(q.id);
    return { ...q, have: Math.min(q.n, cur.dayCounts?.[q.id] ?? 0), ok, claimed, claimable: ok && !claimed };
  });
}

/** Où on en est de la semaine : jours joués et caisse. */
export function weekNow(h: Habits | undefined, now = Date.now()) {
  const cur = fresh(h ?? NEW_HABITS, now);
  const today = dayOf(now);
  const monday = weekOf(now) * 7 - 3;
  const days = cur.weekDays ?? [];
  return {
    days: days.length,
    boxGot: !!cur.weekBox,
    todayDone: days.includes(today),
    pips: Array.from({ length: 7 }, (_, i) => (days.includes(monday + i) ? 'on' : monday + i === today ? 'today' : monday + i < today ? 'miss' : '')),
  };
}

export function questsNow(h: Habits | undefined, now = Date.now()) {
  const cur = fresh(h ?? NEW_HABITS, now);
  return weekQuests(now).map((q) => {
    const ok = cur.done.includes(q.id);
    const claimed = !!cur.claimed?.includes(q.id);
    return { ...q, have: Math.min(q.n, cur.counts[q.id] ?? 0), ok, claimed, claimable: ok && !claimed };
  });
}

/** Récupère la récompense d'un défi réussi. */
export function claimQuest(h0: Habits | undefined, id: string, now = Date.now()) {
  const h = fresh(h0 ?? NEW_HABITS, now);
  const day = dailyNow(h, now).find((q) => q.id === id);
  if (day?.claimable) return { habits: { ...h, dayClaimed: [...(h.dayClaimed ?? []), id] }, gift: day.gift };
  const week = questsNow(h, now).find((q) => q.id === id);
  if (week?.claimable) return { habits: { ...h, claimed: [...(h.claimed ?? []), id] }, gift: week.gift };
  return null;
}
/** Combien de récompenses attendent. */
export const claimableCount = (h: Habits | undefined, now = Date.now()) => [...dailyNow(h, now), ...questsNow(h, now)].filter((q) => q.claimable).length;

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
  const boxes: string[] = [];
  if (!e.podium) {
    const days = h.weekDays ?? [];
    // Première partie du jour : la caisse gratuite. Les 7 jours de la semaine : la grosse.
    if (!days.includes(today)) {
      boxes.push('petite');
      h = { ...h, weekDays: [...days, today] };
    }
    if ((h.weekDays ?? []).length >= 7 && !h.weekBox) {
      boxes.push('grosse');
      h = { ...h, weekBox: true };
    }
  }
  const dc = { ...h.dayCounts };
  const dBump = (id: string) => (dc[id] = (dc[id] ?? 0) + 1);
  if (!e.podium) {
    dBump('dPlay');
    dBump('dPlay2');
    if (e.rank === 1) dBump('dWin');
    if (e.rank >= 1 && e.rank <= 3) dBump('dTop');
  }
  const dayFinished = dayQuests(now).filter((q) => !h.dayDone?.includes(q.id) && (dc[q.id] ?? 0) >= q.n);
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
  const finished = [...weekQuests(now).filter((q) => !h.done.includes(q.id) && (counts[q.id] ?? 0) >= q.n)];
  return {
    habits: { ...h, counts, tried, done: [...h.done, ...finished.map((q) => q.id)], dayCounts: dc, dayDone: [...(h.dayDone ?? []), ...dayFinished.map((q) => q.id)] },
    boxes,
    daily,
    streak: h.streak,
    quests: [...finished, ...dayFinished].map((q) => ({ label: q.label, gift: q.gift })),
    // Les défis réussis se récupèrent à la main (voir claimQuest)
    coins: daily,
  };
}
