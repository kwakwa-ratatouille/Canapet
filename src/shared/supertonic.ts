// Vraies voix du présentateur : Supertonic 3 (Supertone Inc., licence OpenRAIL-M, voir public/licences).
// Tout se passe sur la carte graphique du PC, dans un fil à part : une phrase prend moins d'une seconde.
// Le modèle (400 Mo) se télécharge une seule fois, en arrière-plan. Tant qu'il n'est pas prêt, ou si l'appareil
// n'a pas de carte graphique utilisable, c'est la voix de l'appareil qui parle (voir speak dans sound.ts).
import { IS_PHONE, LIGHT } from './device';
import type { Lang } from './protocol';

export type StState = 'off' | 'loading' | 'ready' | 'failed';
export interface Clip {
  wav: Float32Array;
  sr: number;
}
type Job = { key: string; text: string; lang: Lang; voice: string; speed: number; done: ((c: Clip | null) => void)[] };

let state: StState = 'off';
let progress = 0;
let worker: Worker | null = null;
let current: Job | null = null;
let nextId = 1;
let slow = 0;
let onReady: (() => void) | null = null;
/** Appelé quand la voix devient prête (ou tout de suite si elle l'est déjà). */
export function stWhenReady(fn: () => void) {
  if (state === 'ready') fn();
  else onReady = fn;
}
const urgent: Job[] = [];
const later: Job[] = [];
const cache = new Map<string, Clip>();
const MAX_CLIPS = 150;

/** Rien que d'après l'appareil : peut-il avoir ces voix ? (la vraie réponse arrive avec `stStart`) */
export const stPossible = () => !LIGHT && !IS_PHONE && typeof navigator !== 'undefined' && 'gpu' in navigator && typeof Worker !== 'undefined';
export const stState = () => state;
export const stProgress = () => progress;
export const stReady = () => state === 'ready';

const keyOf = (text: string, lang: Lang, voice: string, speed: number) => `${voice}|${lang}|${speed.toFixed(2)}|${text}`;

function finish(job: Job, clip: Clip | null) {
  job.done.forEach((f) => f(clip));
}

function pump() {
  if (!worker || current || state !== 'ready') return;
  const job = urgent.shift() ?? later.shift();
  if (!job) return;
  current = job;
  worker.postMessage({ t: 'say', id: nextId++, text: job.text, lang: job.lang, voice: job.voice, steps: 5, speed: job.speed });
}

function fail() {
  state = 'failed';
  worker?.terminate();
  worker = null;
  const all = [current, ...urgent, ...later].filter(Boolean) as Job[];
  current = null;
  urgent.length = later.length = 0;
  all.forEach((j) => finish(j, null));
}

/** Lance le téléchargement en arrière-plan (une seule fois). */
export async function stStart(voice: string) {
  if (state !== 'off' || !stPossible()) return;
  state = 'loading';
  try {
    const nav = navigator as unknown as { gpu: { requestAdapter(): Promise<{ isFallbackAdapter?: boolean; info?: { isFallbackAdapter?: boolean } } | null> }; connection?: { saveData?: boolean } };
    const adapter = await nav.gpu.requestAdapter();
    // Pas de vraie carte graphique, ou peu de place : on en reste à la voix de l'appareil
    if (!adapter || adapter.isFallbackAdapter || adapter.info?.isFallbackAdapter || nav.connection?.saveData) return fail();
    const room = await navigator.storage?.estimate?.().catch(() => null);
    if (room?.quota && room.quota - (room.usage ?? 0) < 600e6) return fail();
    worker = new Worker(new URL('./supertonic.worker.ts', import.meta.url));
    worker.onerror = fail;
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.t === 'progress') progress = m.k;
      else if (m.t === 'ready') {
        state = 'ready';
        progress = 1;
        onReady?.();
        pump();
      } else if (m.t === 'wav') {
        const job = current;
        current = null;
        if (job) {
          const clip = { wav: m.wav as Float32Array, sr: m.sr as number };
          cache.set(job.key, clip);
          if (cache.size > MAX_CLIPS) cache.delete(cache.keys().next().value as string);
          // La carte graphique ne suit pas (occupée, trop petite) : plus de 3 fois de suite, on arrête
          slow = m.ms > 2500 ? slow + 1 : 0;
          finish(job, clip);
          if (slow >= 3) return fail();
        }
        pump();
      } else if (m.t === 'error') {
        // Pendant le chargement ou sur une phrase : on n'insiste pas
        if (state === 'loading') return fail();
        const job = current;
        current = null;
        if (job) finish(job, null);
        pump();
      }
    };
    worker.postMessage({ t: 'load', voice });
  } catch {
    fail();
  }
}

/** Le son d'une phrase s'il est déjà prêt. */
export function stCached(text: string, lang: Lang, voice: string, speed: number) {
  const key = keyOf(text, lang, voice, speed);
  const c = cache.get(key);
  if (c) {
    cache.delete(key);
    cache.set(key, c); // Reste parmi les plus récentes
  }
  return c ?? null;
}

/** Demande une phrase à dire maintenant : elle passe devant, et remplace celle qui attendait encore. */
export function stSay(text: string, lang: Lang, voice: string, speed: number) {
  return new Promise<Clip | null>((ok) => {
    const key = keyOf(text, lang, voice, speed);
    const hit = cache.get(key);
    if (hit) return ok(hit);
    if (state !== 'ready') return ok(null);
    if (current?.key === key) return void current.done.push(ok);
    urgent.splice(0).forEach((j) => finish(j, null));
    const i = later.findIndex((j) => j.key === key);
    if (i >= 0) later.splice(i, 1);
    urgent.push({ key, text, lang, voice, speed, done: [ok] });
    pump();
  });
}

/** Prépare une phrase à l'avance, quand rien de plus pressé n'attend. */
export function stPrepare(text: string, lang: Lang, voice: string, speed: number) {
  const key = keyOf(text, lang, voice, speed);
  if (state === 'off' || state === 'failed' || cache.has(key) || current?.key === key || later.some((j) => j.key === key)) return;
  later.push({ key, text, lang, voice, speed, done: [] });
  pump();
}
