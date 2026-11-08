// Tranche de Rire : les aliments du jeu sont lancés en l'air, chaque joueur les tranche avec son doigt.
// Le téléphone envoie la position du doigt : elle est reportée sur tout l'écran. Pièges : coussin péteur et bombe.
// En mode équipes, les points de chacun s'additionnent pour son camp.
import { woodBoard } from './draw';
import { drawCharacter } from '../shared/characters';
import { INK, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { TEAMS } from './teams';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

export interface SlicePadData {
  color: string;
  score: number;
  /** Secondes pendant lesquelles la lame est sonnée. */
  stun: boolean;
  /** Ce qui arrive à ce joueur : '', gel, inv, dbl, big. */
  effect: string;
}

/** Les bonus : une bulle à trancher. */
const BONUS = {
  gel: { emoji: '🧊', color: '#7fd6ff', solo: false },
  inv: { emoji: '🔀', color: '#b98cff', solo: false },
  vol: { emoji: '🧲', color: '#ff9a1f', solo: false },
  dbl: { emoji: '✖️', color: '#ffd60a', solo: true },
  big: { emoji: '🗡️', color: '#22c99a', solo: true },
  rain: { emoji: '🌪️', color: '#ff86bd', solo: true },
  slow: { emoji: '🐌', color: '#a8efc9', solo: true },
} as const;
type BonusId = keyof typeof BONUS;

const GRAV = 1150;
const FRUITS: { food: string; juice: string }[] = [
  { food: 'pasteque', juice: '#ff4a5a' },
  { food: 'ananas', juice: '#ffc933' },
  { food: 'banane', juice: '#ffe066' },
  { food: 'tomate', juice: '#ff4a3a' },
  { food: 'cookie', juice: '#a0643a' },
  { food: 'pizza', juice: '#ffcf6b' },
  { food: 'cornichon', juice: '#7bb33b' },
  { food: 'fromage', juice: '#ffd23a' },
  { food: 'beignet', juice: '#ff9ccf' },
  { food: 'tartine', juice: '#d9883e' },
  { food: 'sushi', juice: '#ff8a5a' },
  { food: 'burger', juice: '#7a4a2a' },
  { food: 'avocat', juice: '#7bbf4a' },
  { food: 'glace', juice: '#ffc6e3' },
];
type Kind = 'fruit' | 'gold' | 'coussin' | 'bombe' | 'bonus' | 'ufo';
type From = 'bottom' | 'top' | 'left' | 'right';
type EventId = 'train' | 'top' | 'cross' | 'ufo';
/** Dernières secondes : la grande finale. */
const FINAL_AT = 47;
interface Item {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  kind: Kind;
  food: string;
  juice: string;
  r: number;
  bonus?: BonusId;
  /** Part de la gravité : faible pour ce qui traverse l'écran. */
  g: number;
  dropAt?: number;
}
interface Half {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  food: string;
  side: 1 | -1;
  life: number;
}
interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: string;
  life: number;
}
interface Pop {
  x: number;
  y: number;
  text: string;
  c: string;
  life: number;
}
interface Pl extends Runner {
  score: number;
  x: number;
  y: number;
  down: boolean;
  trail: { x: number; y: number; at: number }[];
  stun: number;
  /** Tranchés dans le même geste, pour le combo. */
  combo: number;
  comboAt: number;
  botAim: Item | null;
  botPause: number;
  /** Bonus et sabotages en cours (secondes restantes). */
  gel: number;
  inv: number;
  dbl: number;
  big: number;
}

/** Distance entre un point et un segment. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  const k = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - dx * k, py - ay - dy * k);
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls: Pl[] = runners.map((r, i) => ({ ...r, score: 0, x: 200 + i * 120, y: 500, down: false, trail: [], stun: 0, combo: 0, comboAt: 0, botAim: null, botPause: 0, gel: 0, inv: 0, dbl: 0, big: 0 }));
  const teams = pls.some((p) => p.team !== undefined);
  const items: Item[] = [];
  const halves: Half[] = [];
  const drops: Drop[] = [];
  const pops: Pop[] = [];
  let clock = 0;
  let nextWave = 0.6;
  let shake = 0;
  let last = '';
  const n = pls.length;
  // Des limites pour que ça reste fluide, même à 12
  const MAX_ITEMS = ctx.light ? 16 : 30;
  const MAX_FINAL = ctx.light ? 22 : 44;
  const MAX_HALVES = ctx.light ? 6 : 16;
  const MAX_DROPS = ctx.light ? 24 : 70;
  /** Aliments à lancer un par un, plutôt que tous à la même image. */
  let pending = 0;
  let pendingAt = 0;
  let rainAt = 0;
  let nextBonus = Math.max(4, 8 - n * 0.3);
  let rainT = 0;
  let rainFrom: From | 'sides' | 'any' = 'any';
  let slowT = 0;
  let finale = false;
  let nextEvent = 11;
  let lastEvent: EventId | '' = '';
  let notice: { text: string; c: string; t: number } | null = null;

  const spawn = (kind: Kind, bonus?: BonusId, from: From = 'bottom'): Item | null => {
    if (items.length >= (finale ? MAX_FINAL : MAX_ITEMS) && kind === 'fruit') return null;
    const f = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    let x = rnd(220, 1700);
    let y = 1160;
    let vx = (960 - x) * rnd(0.12, 0.42);
    let vy = -rnd(1240, 1500);
    let g = 1;
    if (from === 'top') {
      // Ça tombe du ciel
      x = rnd(140, 1780);
      y = -110;
      vx = rnd(-120, 120);
      vy = rnd(150, 420);
      g = 0.45;
    } else if (from === 'left' || from === 'right') {
      // Ça traverse l'écran
      const s = from === 'left' ? 1 : -1;
      x = s > 0 ? -110 : 2030;
      y = rnd(220, 820);
      vx = s * rnd(620, 900);
      vy = rnd(-260, -60);
      g = 0.3;
    }
    const item: Item = {
      x,
      y,
      vx,
      vy,
      g,
      rot: rnd(-1, 1),
      spin: rnd(-3, 3),
      kind,
      food: kind === 'coussin' ? 'coussin' : f.food,
      juice: f.juice,
      r: kind === 'bombe' ? 62 : kind === 'bonus' ? 84 : kind === 'ufo' ? 96 : 72,
      bonus,
    };
    items.push(item);
    return item;
  };
  /** D'où vient le prochain : surtout d'en bas au début, de partout ensuite. */
  const anyFrom = (): From => {
    if (clock < 8) return 'bottom';
    const r = Math.random();
    const low = finale ? 0.34 : 0.62;
    const mid = finale ? 0.58 : 0.82;
    return r < low ? 'bottom' : r < mid ? 'top' : r < (1 + mid) / 2 ? 'left' : 'right';
  };
  const startEvent = () => {
    const ids = (['train', 'top', 'cross', 'ufo'] as EventId[]).filter((k) => k !== lastEvent);
    const id = ids[Math.floor(Math.random() * ids.length)];
    lastEvent = id;
    sfx.whoosh();
    if (id === 'train') {
      // Une file d'aliments qui passe d'un bord à l'autre, comme un train
      const s = Math.random() < 0.5 ? 1 : -1;
      const y = rnd(280, 760);
      const count = Math.min(16, 9 + Math.round(n / 2));
      const trap = 3 + Math.floor(Math.random() * Math.max(1, count - 4));
      for (let k = 0; k < count; k++) {
        const it = spawn(k === trap ? 'bombe' : 'fruit', undefined, s > 0 ? 'left' : 'right');
        if (!it) continue;
        it.x = s > 0 ? -110 - k * 150 : 2030 + k * 150;
        it.y = y;
        it.vx = s * 640;
        it.vy = 0;
        it.g = 0;
      }
      say(fr ? '🚂 Le train d’aliments !' : '🚂 The food train!', '#ffd60a');
    } else if (id === 'top') {
      rainT = 4;
      rainFrom = 'top';
      say(fr ? '🌧️ Ça tombe du ciel !' : '🌧️ It’s raining food!', '#7fd6ff');
    } else if (id === 'cross') {
      rainT = 4;
      rainFrom = 'sides';
      say(fr ? '↔️ Ça arrive des deux côtés !' : '↔️ Coming from both sides!', '#ff9a1f');
    } else {
      // Une soucoupe passe en lâchant des aliments : la toucher rapporte gros
      const s = Math.random() < 0.5 ? 1 : -1;
      const it = spawn('ufo', undefined, s > 0 ? 'left' : 'right');
      if (it) {
        it.y = rnd(240, 400);
        it.vx = s * 420;
        it.vy = 0;
        it.g = 0;
        it.rot = 0;
        it.spin = 0;
        it.dropAt = 0.4;
      }
      say(fr ? '🛸 La soucoupe ! +10 si tu la tranches' : '🛸 The saucer! +10 if you slice it', '#22c99a');
    }
  };

  const wave = () => {
    // Plus de monde = plus de choses à trancher, et ça s'accélère : environ 1 aliment par seconde, plus 0,55 par joueur
    const pace = Math.min(1, clock / 50);
    const every = finale ? 0.8 : rnd(1.5, 2.1) - pace * 0.6;
    pending += Math.max(1, Math.round((1 + n * 0.55) * every * (0.7 + pace * 0.5) * (finale ? 3 : 1)));
    // Les pièges aussi suivent le nombre de joueurs
    if (clock > 4) {
      const traps = 1 + Math.floor(n / 5);
      for (let i = 0; i < traps; i++) if (Math.random() < (finale ? 0.3 : 0.3 + pace * 0.25)) spawn(Math.random() < 0.5 ? 'bombe' : 'coussin', undefined, anyFrom());
    }
    nextWave = clock + every;
  };

  const say = (text: string, c: string) => {
    notice = { text, c, t: 2.4 };
  };
  /** Un adversaire au hasard, jamais un coéquipier. */
  const rival = (p: Pl) => {
    const can = pls.filter((o) => o !== p && (p.team === undefined || o.team !== p.team));
    const fresh = can.filter((o) => o.gel <= 0);
    const list = fresh.length ? fresh : can;
    return list[Math.floor(Math.random() * list.length)] ?? null;
  };
  const useBonus = (p: Pl, id: BonusId) => {
    const name = p.profile.name;
    const c = BONUS[id].color;
    sfx.whoosh();
    if (id === 'gel' || id === 'inv' || id === 'vol') {
      const o = id === 'vol' ? [...pls].filter((x) => x !== p && (p.team === undefined || x.team !== p.team)).sort((a, b) => b.score - a.score)[0] : rival(p);
      if (!o) return;
      if (id === 'gel') {
        o.gel = 4;
        o.down = false;
        o.trail = [];
        say(fr ? `🧊 ${o.profile.name} est gelé ! Plus de lame pendant 4 s` : `🧊 ${o.profile.name} is frozen! No blade for 4 s`, c);
      } else if (id === 'inv') {
        o.inv = 6;
        say(fr ? `🔀 ${o.profile.name} : lame à l’envers !` : `🔀 ${o.profile.name}: blade flipped!`, c);
      } else {
        const got = Math.min(8, o.score);
        o.score -= got;
        p.score += got;
        say(fr ? `🧲 ${name} vole ${got} points à ${o.profile.name} !` : `🧲 ${name} steals ${got} points from ${o.profile.name}!`, c);
      }
      if (!o.bot) ctx.buzz(o.pid, 300);
    } else if (id === 'dbl') {
      p.dbl = 7;
      say(fr ? `✖️2 ${name} : points doublés !` : `✖️2 ${name}: double points!`, c);
    } else if (id === 'big') {
      p.big = 7;
      say(fr ? `🗡️ ${name} a une lame géante !` : `🗡️ ${name} has a giant blade!`, c);
    } else if (id === 'rain') {
      rainT = 3.5;
      say(fr ? '🌪️ Pluie d’aliments !' : '🌪️ Food rain!', c);
    } else {
      slowT = 4;
      say(fr ? '🐌 Tout ralentit !' : '🐌 Slow motion!', c);
    }
    ctx.refresh();
  };

  const add = (p: Pl, x: number, y: number, pts: number, c: string, text?: string) => {
    if (pts > 0 && p.dbl > 0) pts *= 2;
    p.score = Math.max(0, p.score + pts);
    pops.push({ x: Math.max(140, Math.min(1780, x)), y: Math.max(100, Math.min(1000, y)), text: text ?? (pts > 0 ? `+${pts}` : String(pts)), c, life: 0.9 });
    if (pops.length > 26) pops.shift();
  };

  const cut = (p: Pl, it: Item) => {
    items.splice(items.indexOf(it), 1);
    if (it.kind === 'bombe' || it.kind === 'coussin') {
      add(p, it.x, it.y, -5, ROSE, it.kind === 'bombe' ? (fr ? 'BOUM ! -5' : 'BOOM! -5') : ctx.family ? 'POUF ! -5' : 'PROUT ! -5');
      p.stun = 1.1;
      p.trail = [];
      p.down = false;
      shake = 0.35;
      if (it.kind === 'bombe') sfx.boom();
      else sfx.pet();
      if (!p.bot) ctx.buzz(p.pid, 300);
      for (let i = 0; i < 10; i++) drops.push({ x: it.x, y: it.y, vx: rnd(-520, 520), vy: rnd(-520, 200), c: it.kind === 'bombe' ? '#3a2140' : '#ff86bd', life: 0.7 });
      ctx.refresh();
      return;
    }
    if (it.kind === 'ufo') {
      add(p, it.x, it.y, 10, SOLEIL, fr ? 'SOUCOUPE ! +10' : 'SAUCER! +10');
      sfx.boom();
      shake = 0.2;
      if (!p.bot) ctx.buzz(p.pid, 150);
      // Elle lâche tout ce qu'elle transportait
      for (let i = 0; i < 6; i++) {
        const f = spawn('fruit');
        if (!f) break;
        f.x = it.x;
        f.y = it.y;
        f.vx = rnd(-420, 420);
        f.vy = rnd(-520, -120);
        f.g = 0.8;
      }
      return;
    }
    if (it.kind === 'bonus' && it.bonus) {
      for (let i = 0; i < 8; i++) drops.push({ x: it.x, y: it.y, vx: rnd(-420, 420), vy: rnd(-460, 160), c: BONUS[it.bonus].color, life: 0.6 });
      useBonus(p, it.bonus);
      return;
    }
    // Combo : plusieurs d'un coup, dans le même geste
    p.combo = clock - p.comboAt < 0.5 ? p.combo + 1 : 1;
    p.comboAt = clock;
    const base = it.kind === 'gold' ? 5 : 1;
    const bonus = p.combo >= 3 ? 2 : 0;
    add(p, it.x, it.y, base + bonus, it.kind === 'gold' ? SOLEIL : p.profile.color, p.combo >= 3 && p.combo % 3 === 0 ? `COMBO ×${p.combo} !` : undefined);
    sfx.pop();
    if (!p.bot) ctx.buzz(p.pid, 25);
    // Quand il y a beaucoup de monde, moins de morceaux : ils restent moins longtemps et les plus vieux disparaissent
    const life = n > 6 ? 0.7 : 1.1;
    if (halves.length + 2 > MAX_HALVES) halves.splice(0, halves.length + 2 - MAX_HALVES);
    for (const side of [1, -1] as const) halves.push({ x: it.x, y: it.y, vx: it.vx + side * rnd(120, 240), vy: it.vy * 0.5 - 120, rot: it.rot, spin: side * rnd(2, 5), food: it.food, side, life });
    const juice = n > 6 ? 4 : 8;
    for (let i = 0; i < juice; i++) drops.push({ x: it.x, y: it.y, vx: rnd(-420, 420), vy: rnd(-460, 160), c: it.juice, life: rnd(0.35, 0.7) });
  };

  const swipe = (p: Pl, x: number, y: number) => {
    const ax = p.x;
    const ay = p.y;
    p.x = x;
    p.y = y;
    if (!p.down || p.stun > 0 || p.gel > 0) return;
    p.trail.push({ x, y, at: clock });
    if (Math.hypot(x - ax, y - ay) < 6) return;
    const reach = p.big > 0 ? 60 : 0;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it && segDist(it.x, it.y, ax, ay, x, y) < it.r + reach) cut(p, it);
    }
  };

  const bot = (p: Pl, dt: number) => {
    if (p.stun > 0 || p.gel > 0) return;
    p.botPause -= dt;
    if (p.botPause > 0) return;
    if (!p.botAim || !items.includes(p.botAim)) {
      const safe = items.filter((i) => (i.kind === 'fruit' || i.kind === 'gold' || i.kind === 'bonus' || i.kind === 'ufo') && i.y < 1000 && i.x > -60 && i.x < 1980);
      const bubble = safe.find((i) => i.kind === 'bonus');
      p.botAim = bubble && Math.random() < 0.3 * ctx.botSkill ? bubble : safe[Math.floor(Math.random() * safe.length)] ?? null;
      p.down = false;
      if (!p.botAim) return;
    }
    const a = p.botAim;
    const speed = (900 + ctx.botSkill * 1300) * dt;
    const d = Math.hypot(a.x - p.x, a.y - p.y) || 1;
    p.down = d < 240;
    swipe(p, p.x + ((a.x - p.x) / d) * Math.min(d, speed), p.y + ((a.y - p.y) / d) * Math.min(d, speed));
    // Un petit temps d'hésitation après une découpe, moins long pour les forts
    if (!items.includes(a)) {
      p.botAim = null;
      p.botPause = rnd(0.15, 0.7) * (1.4 - ctx.botSkill);
    }
  };

  const effectOf = (p: Pl) => (p.gel > 0 ? 'gel' : p.inv > 0 ? 'inv' : p.dbl > 0 ? 'dbl' : p.big > 0 ? 'big' : '');
  const teamScore = (s: number) => pls.filter((p) => p.team === s).reduce((m, p) => m + p.score, 0);

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || m.a !== 'cut') return;
      const p = pls.find((x) => x.pid === pid);
      if (!p) return;
      const [nx, ny, st] = m.n ?? [];
      if (typeof nx !== 'number' || typeof ny !== 'number') return;
      // Lame à l'envers : gauche et droite échangées
      const x = ((p.inv > 0 ? 1000 - Math.max(0, Math.min(1000, nx)) : Math.max(0, Math.min(1000, nx))) / 1000) * 1920;
      const y = (Math.max(0, Math.min(1000, ny)) / 1000) * 1080;
      if (p.gel > 0) {
        p.x = x;
        p.y = y;
        return;
      }
      if (st === 1) {
        // Le doigt se pose : pas de trait depuis l'ancienne position
        p.x = x;
        p.y = y;
        p.down = true;
        p.trail = [{ x, y, at: clock }];
        p.combo = 0;
      } else if (st === 0) {
        swipe(p, x, y);
        p.down = false;
      } else {
        if (!p.down && p.stun <= 0) {
          p.x = x;
          p.y = y;
          p.down = true;
        }
        swipe(p, x, y);
      }
    },
    update(dt) {
      clock += dt;
      shake = Math.max(0, shake - dt);
      rainT = Math.max(0, rainT - dt);
      slowT = Math.max(0, slowT - dt);
      if (notice && (notice.t -= dt) <= 0) notice = null;
      if (!finale && clock >= FINAL_AT) {
        finale = true;
        nextWave = clock;
        say(fr ? '🔥 GRANDE FINALE ! Ça arrive de partout !' : '🔥 GRAND FINALE! It’s coming from everywhere!', '#ff5a1f');
        speak(fr ? 'Grande finale !' : 'Grand finale!', ctx.lang);
        sfx.hurry();
      }
      if (clock >= nextWave) wave();
      // De temps en temps, un petit événement
      if (!finale && clock >= nextEvent) {
        nextEvent = clock + rnd(10, 14);
        startEvent();
      }
      // Les aliments partent un par un
      if (pending > 0 && clock >= pendingAt) {
        pending--;
        pendingAt = clock + (finale ? 0.04 : 0.07);
        spawn(Math.random() < 0.04 ? 'gold' : 'fruit', undefined, anyFrom());
      }
      if (rainT > 0 && clock >= rainAt) {
        rainAt = clock + 0.1;
        const side: From = rainFrom === 'sides' ? (Math.random() < 0.5 ? 'left' : 'right') : rainFrom === 'any' ? anyFrom() : rainFrom;
        spawn('fruit', undefined, side);
      }
      // Une bulle bonus de temps en temps, plus souvent quand on est nombreux
      if (clock >= nextBonus) {
        nextBonus = clock + rnd(6, 9) - Math.min(3, n * 0.25);
        const ids = (Object.keys(BONUS) as BonusId[]).filter((k) => BONUS[k].solo || n > 1);
        spawn('bonus', ids[Math.floor(Math.random() * ids.length)]);
      }
      const fall = slowT > 0 ? dt * 0.45 : dt;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.dropAt !== undefined && (it.dropAt -= dt) <= 0) {
          it.dropAt = 0.3;
          const f = spawn('fruit');
          if (f) {
            f.x = it.x;
            f.y = it.y + 40;
            f.vx = it.vx * 0.2;
            f.vy = 60;
            f.g = 0.8;
          }
        }
      }
      for (const it of items) {
        it.vy += GRAV * it.g * fall;
        it.x += it.vx * fall;
        it.y += it.vy * fall;
        it.rot += it.spin * fall;
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if ((it.y > 1240 && it.vy > 0) || (it.x < -300 && it.vx < 0) || (it.x > 2220 && it.vx > 0)) items.splice(i, 1);
      }
      for (const h of halves) {
        h.vy += GRAV * dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.rot += h.spin * dt;
        h.life -= dt;
      }
      for (let i = halves.length - 1; i >= 0; i--) if (halves[i].life <= 0) halves.splice(i, 1);
      for (const d of drops) {
        d.vy += GRAV * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.life -= dt;
      }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].life <= 0) drops.splice(i, 1);
      if (drops.length > MAX_DROPS) drops.splice(0, drops.length - MAX_DROPS);
      for (const o of pops) {
        o.y -= 60 * dt;
        o.life -= dt;
      }
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
      for (const p of pls) {
        if (p.bot) bot(p, dt);
        p.stun = Math.max(0, p.stun - dt);
        p.gel = Math.max(0, p.gel - dt);
        p.inv = Math.max(0, p.inv - dt);
        p.dbl = Math.max(0, p.dbl - dt);
        p.big = Math.max(0, p.big - dt);
        while (p.trail.length && clock - p.trail[0].at > 0.22) p.trail.shift();
        if (p.trail.length > 24) p.trail.splice(0, p.trail.length - 24);
      }
      const sum = pls.map((p) => `${p.score}${effectOf(p)}`).join();
      if (sum !== last && Math.floor(clock * 2) !== Math.floor((clock - dt) * 2)) {
        last = sum;
        ctx.refresh();
      }
    },
    render(g, t) {
      g.save();
      if (shake > 0) g.translate(rnd(-12, 12) * (shake / 0.35), rnd(-12, 12) * (shake / 0.35));
      // Un plan de travail en bois
      woodBoard(g);
      if (clock < 3.5) {
        g.fillStyle = INK;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '700 58px Fredoka, sans-serif';
        g.fillText(fr ? '📱 Glisse ton doigt sur le téléphone pour trancher !' : '📱 Swipe on your phone to slice!', 960, 300, 1760);
        g.font = '700 44px Fredoka, sans-serif';
        g.fillText(fr ? 'Évite le coussin rose et la bombe 💣' : 'Avoid the pink cushion and the bomb 💣', 960, 380);
      }
      for (const h of halves) {
        g.save();
        g.translate(h.x, h.y);
        g.rotate(h.rot);
        g.globalAlpha = Math.min(1, h.life * 2);
        g.beginPath();
        g.rect(h.side > 0 ? 0 : -120, -140, 120, 280);
        g.clip();
        drawCharacter(g, 0, 62, 112, { food: h.food, color: '#3a2140', t: 0, mood: 'sad' });
        g.restore();
      }
      for (const it of items) {
        g.save();
        g.translate(it.x, it.y);
        if (it.kind === 'ufo') {
          g.fillStyle = 'rgba(255,214,10,.5)';
          g.beginPath();
          g.arc(0, 0, 104 + Math.sin(t * 10) * 8, 0, Math.PI * 2);
          g.fill();
          g.font = '140px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = INK;
          g.fillText('🛸', 0, 6 + Math.sin(t * 6) * 8);
          g.restore();
          continue;
        }
        if (it.kind === 'bonus' && it.bonus) {
          // Une grosse bulle qui pulse, bien différente des aliments
          g.fillStyle = BONUS[it.bonus].color;
          g.strokeStyle = INK;
          g.lineWidth = 7;
          g.beginPath();
          g.arc(0, 0, 76 + Math.sin(t * 8) * 6, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,.55)';
          g.beginPath();
          g.arc(-26, -30, 14, 0, Math.PI * 2);
          g.fill();
          g.font = '78px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = INK;
          g.fillText(BONUS[it.bonus].emoji, 0, 6);
          g.restore();
          continue;
        }
        g.rotate(it.rot);
        if (it.kind === 'bombe') {
          g.fillStyle = '#2b2730';
          g.strokeStyle = INK;
          g.lineWidth = 6;
          g.beginPath();
          g.arc(0, 0, 54, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,.3)';
          g.beginPath();
          g.arc(-18, -20, 13, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#a0643a';
          g.lineWidth = 9;
          g.beginPath();
          g.moveTo(16, -48);
          g.quadraticCurveTo(38, -80, 60, -66);
          g.stroke();
          g.fillStyle = Math.sin(t * 24) > 0 ? '#ffd60a' : '#ff5a1f';
          g.beginPath();
          g.arc(62, -66, 13, 0, Math.PI * 2);
          g.fill();
        } else {
          if (it.kind === 'gold') {
            g.fillStyle = 'rgba(255,214,10,.55)';
            g.beginPath();
            g.arc(0, 0, 92 + Math.sin(t * 10) * 8, 0, Math.PI * 2);
            g.fill();
          }
          if (it.kind === 'coussin') {
            g.strokeStyle = '#ff3b5c';
            g.lineWidth = 9;
            g.setLineDash([16, 12]);
            g.beginPath();
            g.arc(0, 0, 88, 0, Math.PI * 2);
            g.stroke();
            g.setLineDash([]);
          }
          drawCharacter(g, 0, 62, 112, { food: it.food, color: '#3a2140', t: 0, mood: it.kind === 'coussin' ? 'win' : 'wow' });
        }
        g.restore();
      }
      // Des petits carrés plutôt que des ronds : bien moins cher à dessiner, et ça ne se voit pas à cette vitesse
      for (const d of drops) {
        g.fillStyle = d.c;
        g.fillRect(d.x - 8, d.y - 8, 16, 16);
      }
      // Les lames : une couleur par joueur, épaisses puis fines
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const p of pls) {
        if (p.trail.length > 1) {
          const fat = p.big > 0 ? 18 : 0;
          for (const [w, c] of [[20 + fat, INK], [13 + fat, p.profile.color]] as [number, string][]) {
            g.strokeStyle = c;
            g.lineWidth = w;
            g.beginPath();
            p.trail.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
            g.stroke();
          }
        }
        // Le curseur du joueur, pour savoir où est son doigt
        g.globalAlpha = p.stun > 0 ? 0.35 : p.down ? 1 : 0.55;
        g.fillStyle = p.gel > 0 ? '#7fd6ff' : p.profile.color;
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(p.x, p.y, p.gel > 0 ? 34 : p.down ? 14 : 18, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.globalAlpha = 1;
        if (p.gel > 0) {
          g.font = '40px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = INK;
          g.fillText('🧊', p.x, p.y + 2);
        }
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '700 46px Fredoka, sans-serif';
      for (const o of pops) {
        g.globalAlpha = Math.min(1, o.life * 2);
        g.lineWidth = 8;
        g.strokeStyle = INK;
        const hw = g.measureText(o.text).width / 2 + 12;
        const ox = Math.max(hw, Math.min(1920 - hw, o.x));
        g.strokeText(o.text, ox, o.y);
        g.fillStyle = o.c;
        g.fillText(o.text, ox, o.y);
      }
      g.globalAlpha = 1;
      if (notice) {
        g.font = '700 54px Fredoka, sans-serif';
        const tw = Math.min(1700, g.measureText(notice.text).width) + 60;
        const ny = teams ? 200 : 118;
        g.globalAlpha = Math.min(1, notice.t * 3);
        g.fillStyle = notice.c;
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(960 - tw / 2, ny - 42, tw, 84, 26);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.fillText(notice.text, 960, ny + 2, 1700);
        g.globalAlpha = 1;
      }
      // Les scores, en haut
      if (teams) {
        [0, 1].forEach((s) => {
          const x = s ? 1420 : 500;
          g.fillStyle = TEAMS[s].color;
          g.strokeStyle = INK;
          g.lineWidth = 6;
          g.beginPath();
          g.roundRect(x - 240, 12, 480, 78, 24);
          g.fill();
          g.stroke();
          g.fillStyle = '#fff';
          g.font = '700 46px Fredoka, sans-serif';
          g.fillText(`${TEAMS[s].emoji} ${teamScore(s)}`, x, 54);
        });
      }
      const w = Math.min(240, 1880 / n);
      const top = teams ? 98 : 14;
      pls.forEach((p, i) => {
        const x = (1920 - n * w) / 2 + i * w;
        g.fillStyle = p.profile.color;
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(x + 4, top, w - 8, 52, 18);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.font = '700 28px Fredoka, sans-serif';
        const ef = effectOf(p);
        const mark = ef ? `${BONUS[ef as BonusId].emoji} ` : '';
        g.fillText(`${mark}${p.profile.name.slice(0, w < 170 ? 5 : 9)} · ${p.score}`, x + w / 2, top + 28, w - 20);
      });
      g.restore();
    },
    ranking: () => [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid),
    leader: () => null,
    padData(pid): SlicePadData {
      const p = pls.find((x) => x.pid === pid)!;
      return { color: p.profile.color, score: p.score, stun: p.stun > 0, effect: effectOf(p) };
    },
  };
  speak(fr ? 'Tranchez tout, sauf les pièges !' : 'Slice everything, except the traps!', ctx.lang);
  return game;
}

export const slice: GameBase = {
  id: 'tranche',
  emoji: '🔪',
  name: { fr: 'Tranche de Rire', en: 'Slice of Laughs' },
  how: {
    fr: 'Glisse ton doigt sur le téléphone pour trancher les aliments, qui arrivent de partout. Plus on est, plus il y en a ! Bulles bonus, train d’aliments, soucoupe, et une grande finale. Gare aux bombes !',
    en: 'Swipe on your phone to slice the food coming from everywhere. More players, more food! Bonus bubbles, food train, saucer and a grand finale. Watch out for the bombs!',
  },
  layout: 'buttons',
  min: 1,
  max: 12,
  botFill: 3,
  music: 'arcade',
  limit: 60,
  timerCorner: true,
  create,
};
