// Traverse Pas Ici ! : tout le monde part d'en bas et saute de case en case : pelouses, routes, rivières de sirop et rails.
// L'écran monte : qui reste en bas perd une vie. En plus : bonus (étoile, bouclier, super bond), et on peut pousser les voisins.
// A = avancer d'une case, le stick = sauter dans une direction, B = pousser.
import { drawCharacter } from '../shared/characters';
import { INK, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { playerTag } from './draw';
import { bird, bread, bush, cat, curb, grassRow, railRow, roadRow, train, tree, vehicle } from './traverseArt';
import { allies, sidesLeft } from './teams';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

const CELL = 112;
const COLS = 16;
const CW = 120;
const VIEW_ROWS = 9;
const HOP = 0.13;
const LIVES = 3;
const BOTTOM = 1040;

type LaneKind = 'grass' | 'road' | 'river' | 'rail';
type VKind = 'car' | 'bus' | 'moto' | 'truck' | 'limo';
interface Thing {
  x: number;
  w: number;
  c: string;
  v?: VKind;
}
/**
 * Bête imprévisible qui reste dans sa zone : chat sur la pelouse, oiseau au-dessus de la rivière de sirop.
 * Elle marche, s'arrête, fait demi-tour ou fonce d'un coup : il faut l'esquiver. La toucher fait perdre une vie.
 */
interface Critter {
  kind: 'cat' | 'bird';
  x: number;
  dir: 1 | -1;
  speed: number;
  /** Vitesse du moment (0 = arrêté), signée. */
  v: number;
  /** Temps avant le prochain changement d'humeur. */
  t: number;
  /** Zone où elle reste. */
  minX: number;
  maxX: number;
}
const critter = (kind: 'cat' | 'bird', speed: number): Critter => {
  const home = rnd(320, 1600);
  const half = kind === 'cat' ? rnd(240, 360) : rnd(340, 480);
  return { kind, x: home, dir: Math.random() < 0.5 ? 1 : -1, speed, v: 0, t: rnd(0.2, 1), minX: Math.max(60, home - half), maxX: Math.min(1860, home + half) };
};
interface Lane {
  kind: LaneKind;
  dir: 1 | -1;
  speed: number;
  items: Thing[];
  /** Pelouse : colonnes occupées par un arbre. */
  trees: Set<number>;
  /** Chats et oiseaux qui traversent la pelouse. */
  critters?: Critter[];
  /** Bonus posé sur la case. */
  bonus?: { col: number; kind: 'star' | 'shield' | 'jump' };
  /** Rails : temps avant le prochain train, et position du train. */
  wait?: number;
  train?: number;
}
export interface TraversePadData {
  color: string;
  lives: number;
  score: number;
  alive: boolean;
}

interface Pl extends Runner {
  col: number;
  x: number;
  row: number;
  fromX: number;
  fromRow: number;
  hop: number;
  dirX: number;
  lives: number;
  alive: boolean;
  safe: number;
  best: number;
  bonus: number;
  shield: boolean;
  superJump: number;
  sunk: number;
  pushCd: number;
  flat: number;
  lastX: number;
  lastY: number;
  lastA: boolean;
  lastB: boolean;
  repeat: number;
  inp: { x: number; y: number; a: boolean; b: boolean };
  queued: [number, number] | null;
  outAt: number;
  botT: number;
}

const CAR_COLORS = ['#ff4f9a', '#2ec5ff', '#ffd60a', '#9b5cff', '#ff9a1f', '#22c99a'];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const lanes = new Map<number, Lane>();
  let genRow = 0;
  let clock = 0;
  /** Difficulté qui monte avec le temps (0 au début, 1 vers 2 min 10) : tout va plus vite. */
  const heat = () => Math.min(1, Math.max(0, clock - 3) / 130);
  const speedOf = (lane: Lane) => lane.speed * (1 + heat() * 0.6);
  const critterMul = () => 1 + heat() * 0.5;
  /** Une bête est-elle (ou sera-t-elle bientôt) près de x ? On garde de la marge : elle est imprévisible. */
  const critterNear = (lane: Lane, x: number, look: number) => (lane.critters ?? []).some((k) => Math.abs(k.x - x) < 120 || Math.abs(k.x + k.v * critterMul() * look - x) < 110);
  /** L'humeur change : s'arrêter, marcher, foncer, faire demi-tour (en restant dans sa zone). */
  const moodSwing = (k: Critter) => {
    const r = Math.random();
    let side: number = Math.random() < 0.5 ? 1 : -1;
    if (k.x < k.minX + 120) side = 1;
    if (k.x > k.maxX - 120) side = -1;
    if (k.kind === 'cat') {
      if (r < 0.3) {
        k.v = 0;
        k.t = rnd(0.5, 1.4);
      } else if (r < 0.55) {
        k.v = side * k.speed * 2.6;
        k.t = rnd(0.3, 0.6);
      } else {
        k.v = side * k.speed;
        k.t = rnd(0.6, 1.6);
      }
    } else if (r < 0.25) {
      // Sur place, en battant des ailes
      k.v = side * 30;
      k.t = rnd(0.4, 0.9);
    } else if (r < 0.5) {
      // Piqué rapide
      k.v = side * k.speed * 2.2;
      k.t = rnd(0.3, 0.55);
    } else {
      k.v = side * k.speed;
      k.t = rnd(0.7, 1.6);
    }
  };

  /** Fabrique les rangées par paquets : jamais deux fois le même paquet, et ça se corse en montant. */
  const addChunk = () => {
    const d = Math.min(1, Math.max(genRow / 110, clock / 140));
    const last = lanes.get(genRow - 1)?.kind;
    const opts: LaneKind[] = (['road', 'river', 'rail', 'grass'] as LaneKind[]).filter((k) => k !== last);
    const kind = genRow < 2 ? 'grass' : last !== 'grass' && Math.random() < 0.45 ? 'grass' : opts[Math.floor(Math.random() * opts.length)];
    const count = kind === 'grass' ? 1 + Math.floor(Math.random() * 2) : kind === 'rail' ? 1 : 1 + Math.floor(Math.random() * (kind === 'road' ? 3 + d * 2 : 2 + d * 2));
    let dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const lane: Lane = { kind, dir, speed: 0, items: [], trees: new Set() };
      if (kind === 'road') {
        const r = Math.random();
        const theme: 'moto' | 'truck' | 'mix' = r < 0.2 ? 'moto' : r < 0.38 ? 'truck' : 'mix';
        lane.speed = rnd(130, 240) * (1 + d * 0.9) * (theme === 'moto' ? 1.6 : theme === 'truck' ? 0.6 : 1);
        const gap = rnd(3.5, 6.5) * CW * (1 - d * 0.25) * (theme === 'moto' ? 1.3 : 1);
        const color = () => CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
        const pick = (): [VKind, number, string] => {
          if (theme === 'moto') return ['moto', CW * 0.95, color()];
          if (theme === 'truck') return ['truck', CW * 2.4, color()];
          const q = Math.random();
          if (q < 0.62) return ['car', CW * 1.2, color()];
          if (q < 0.82) return ['bus', CW * 2.4, color()];
          return ['limo', CW * 3, ['#2b2238', '#f5f0ff', '#ff86bd'][Math.floor(Math.random() * 3)]];
        };
        for (let x = rnd(0, 300); x < 2300; ) {
          const [v, w, c] = pick();
          lane.items.push({ x, w, c, v });
          x += w + gap;
        }
      } else if (kind === 'river') {
        lane.speed = rnd(70, 140) * (1 + d * 0.6);
        const w = CW * rnd(2.4 - d, 4);
        const gap = CW * rnd(1.1, 2 + d);
        for (let x = rnd(-100, 100); x < 2400; x += w + gap) lane.items.push({ x, w, c: '#d9a35a' });
        if (genRow + i > 6 && Math.random() < 0.15 + d * 0.3) lane.critters = [critter('bird', rnd(170, 230))];
      } else if (kind === 'rail') {
        lane.wait = rnd(2, 7);
      } else if (genRow + i > 2) {
        // Des arbres, mais toujours de quoi passer
        const n = Math.floor(Math.random() * (3 + d * 3));
        for (let k = 0; k < n; k++) lane.trees.add(Math.floor(Math.random() * COLS));
        if (genRow + i > 6 && Math.random() < 0.18 + d * 0.3) lane.critters = [critter('cat', rnd(90, 130))];
        if (Math.random() < 0.28) {
          const r = Math.random();
          lane.bonus = { col: Math.floor(Math.random() * COLS), kind: r < 0.6 ? 'star' : r < 0.8 ? 'shield' : 'jump' };
          lane.trees.delete(lane.bonus.col);
        }
      }
      lanes.set(genRow++, lane);
      dir = -dir as 1 | -1;
    }
  };
  while (genRow < 30) addChunk();

  const n = runners.length;
  const pls: Pl[] = runners.map((r, i) => {
    const col = Math.round((COLS - 1) / 2 + (i - (n - 1) / 2) * Math.min(1.2, (COLS - 2) / Math.max(1, n)));
    return { ...r, col, x: (col + 0.5) * CW, row: 0, fromX: 0, fromRow: 0, hop: 0, dirX: 1, lives: LIVES, alive: true, safe: 1, best: 0, bonus: 0, shield: false, superJump: 0, sunk: 0, pushCd: 0, flat: 0, lastX: 0, lastY: 0, lastA: false, lastB: false, repeat: 0, inp: { x: 0, y: 0, a: false, b: false }, queued: null, outAt: 0, botT: rnd(0.3, 1) };
  });
  let cam = 0;
  let level = 0;
  let bannerT = 0;
  let deaths = 0;
  let endT = -1;
  const pops: { x: number; row: number; text: string; life: number; c: string }[] = [];
  const screenY = (row: number) => BOTTOM - (row - cam + 0.5) * CELL;
  const laneAt = (row: number) => {
    while (row + 12 > genRow) addChunk();
    return lanes.get(row);
  };
  const scoreOf = (p: Pl) => p.best + p.bonus;

  const lose = (p: Pl, text: string) => {
    if (p.safe > 0 || !p.alive) return;
    if (p.shield) {
      p.shield = false;
      p.safe = 1.3;
      pops.push({ x: p.x, row: p.row, text: fr ? 'Bouclier !' : 'Shield!', life: 1, c: '#2ec5ff' });
      sfx.boing();
      return;
    }
    p.lives--;
    p.flat = 0.5;
    pops.push({ x: p.x, row: p.row, text, life: 1.1, c: ROSE });
    if (!p.bot) ctx.buzz(p.pid, 280);
    sfx.boom();
    if (p.lives <= 0) {
      p.alive = false;
      p.outAt = ++deaths;
      return;
    }
    // Retour sur la pelouse la plus proche, à l'écran
    let row = Math.max(Math.ceil(cam) + 1, p.row - 1);
    for (let k = 0; k < 8; k++) {
      if (laneAt(row - k)?.kind === 'grass' && row - k >= Math.ceil(cam)) {
        row -= k;
        break;
      }
    }
    const lane = laneAt(row);
    if (lane?.kind !== 'grass') {
      lane!.kind = 'grass';
      lane!.items = [];
      lane!.train = undefined;
      // Un oiseau de rivière ne devient pas un chat de pelouse
      lane!.critters = undefined;
    }
    let col = Math.round(p.x / CW - 0.5);
    col = Math.max(0, Math.min(COLS - 1, col));
    lane!.trees.delete(col);
    p.row = row;
    p.col = col;
    p.x = (col + 0.5) * CW;
    p.hop = 0;
    p.safe = 2.2;
  };

  const hopTo = (p: Pl, dx: number, dy: number) => {
    if (p.hop > 0 || !p.alive) return;
    const row = Math.max(0, p.row + dy * (p.superJump > 0 && dy > 0 ? 2 : 1));
    const col = Math.round(p.x / CW - 0.5) + dx;
    if (col < 0 || col >= COLS) return;
    if (row < Math.floor(cam) || row > cam + VIEW_ROWS - 1.5) return;
    const target = laneAt(row);
    if (target?.trees.has(col)) return;
    p.fromX = p.x;
    p.fromRow = p.row;
    p.row = row;
    p.col = col;
    p.x = (col + 0.5) * CW;
    p.hop = HOP;
    if (dx) p.dirX = dx;
    if (p.superJump > 0 && dy > 0) p.superJump--;
    p.best = Math.max(p.best, row);
    sfx.step();
  };

  const land = (p: Pl) => {
    const lane = laneAt(p.row)!;
    if (lane.bonus && Math.abs((lane.bonus.col + 0.5) * CW - p.x) < CW * 0.7) {
      const k = lane.bonus.kind;
      lane.bonus = undefined;
      if (k === 'star') {
        p.bonus += 5;
        pops.push({ x: p.x, row: p.row, text: '+5 ⭐', life: 1, c: SOLEIL });
      } else if (k === 'shield') {
        p.shield = true;
        pops.push({ x: p.x, row: p.row, text: fr ? 'Bouclier' : 'Shield', life: 1, c: '#2ec5ff' });
      } else {
        p.superJump = 4;
        pops.push({ x: p.x, row: p.row, text: fr ? 'Super bonds' : 'Super hops', life: 1, c: '#ff9a1f' });
      }
      sfx.pop();
    }
  };

  /** Une case est-elle sûre pour y atterrir bientôt ? */
  const safeAt = (row: number, x: number, look: number) => {
    const lane = laneAt(row);
    if (!lane) return false;
    if (lane.kind === 'grass') return !lane.trees.has(Math.floor(x / CW)) && !critterNear(lane, x, look);
    if (lane.kind === 'rail') return (lane.train === undefined && (lane.wait ?? 0) > 1) || false;
    const mx = x - lane.dir * speedOf(lane) * look;
    const on = lane.items.some((t) => mx > t.x - (lane.kind === 'river' ? -20 : 40) && mx < t.x + t.w + (lane.kind === 'river' ? -20 : 40));
    return lane.kind === 'river' ? on && !critterNear(lane, x, look) : !on;
  };

  const bot = (p: Pl, dt: number) => {
    p.botT -= dt;
    if (p.botT > 0 || p.hop > 0) return;
    p.botT = rnd(0.12, 0.4) * (1.5 - ctx.botSkill);
    // Un temps d'hésitation de temps en temps
    if (Math.random() < 0.1 * (1.2 - ctx.botSkill)) p.botT += 0.5;
    if (safeAt(p.row + 1, p.x, 0.3)) return hopTo(p, 0, 1);
    // Bloqué : on cherche à côté, et on recule si la case est dangereuse
    const options = [-1, 1].sort(() => Math.random() - 0.5);
    for (const dx of options) {
      const nx = p.x + dx * CW;
      if (nx > CW && nx < COLS * CW - CW && safeAt(p.row, nx, 0.25) && safeAt(p.row + 1, nx, 0.5)) return hopTo(p, dx, 0);
    }
    // Danger sur place (voiture, chat ou oiseau qui arrive…) : on recule, sinon on s'écarte
    if (!safeAt(p.row, p.x, 0.6)) {
      if (safeAt(p.row - 1, p.x, 0.3)) return hopTo(p, 0, -1);
      for (const dx of options) {
        const nx = p.x + dx * CW;
        if (nx > CW / 2 && nx < COLS * CW - CW / 2 && safeAt(p.row, nx, 0.6)) return hopTo(p, dx, 0);
      }
    }
  };

  const shove = (p: Pl) => {
    if (p.pushCd > 0 || !p.alive) return;
    p.pushCd = 1.2;
    sfx.whoosh();
    for (const o of pls) {
      if (o === p || !o.alive || o.row !== p.row || allies(p, o) || o.hop > 0 || o.safe > 0) continue;
      const d = o.x - p.x;
      if (Math.abs(d) > CW * 1.5) continue;
      hopTo(o, d >= 0 ? 1 : -1, 0);
      if (!o.bot) ctx.buzz(o.pid, 80);
    }
  };

  let lastSum = '';
  let lastPush = 0;
  const game: GameInstance = {
    over: false,
    padData(pid): TraversePadData {
      const p = pls.find((x) => x.pid === pid)!;
      return { color: p.profile.color, lives: p.lives, score: scoreOf(p), alive: p.alive };
    },
    input(pid, m) {
      const p = pls.find((x) => x.pid === pid);
      if (!p) return;
      if (m.t === 'in') p.inp = { x: m.x, y: m.y, a: m.a, b: m.b };
      if (m.t !== 'act') return;
      if (m.a === 'push') shove(p);
      if (m.a === 'hop') {
        const dx = Math.sign(m.n?.[0] ?? 0);
        const dy = Math.sign(m.n?.[1] ?? 0);
        // Un appui pendant un saut est gardé pour la suite : rien n'est perdu
        if (p.hop > 0) p.queued = [dx, dy];
        else hopTo(p, dx, dy);
      }
    },
    update(dt) {
      clock += dt;
      if (endT >= 0) {
        endT -= dt;
        if (endT <= 0) game.over = true;
        return;
      }
      // La route vit
      const top = Math.ceil(cam) + VIEW_ROWS + 2;
      for (let r = Math.floor(cam) - 1; r <= top; r++) {
        const lane = laneAt(r);
        if (!lane) continue;
        if (lane.critters)
          for (const k of lane.critters) {
            k.t -= dt;
            if (k.t <= 0) moodSwing(k);
            k.x += k.v * critterMul() * dt;
            // Le bord de sa zone : demi-tour
            if (k.x < k.minX) {
              k.x = k.minX;
              k.v = Math.abs(k.v);
            } else if (k.x > k.maxX) {
              k.x = k.maxX;
              k.v = -Math.abs(k.v);
            }
            // Le chat ne traverse pas les arbres ni les buissons : il fait demi-tour
            if (k.kind === 'cat' && k.v && !lane.trees.has(Math.floor(k.x / CW)) && lane.trees.has(Math.floor((k.x + Math.sign(k.v) * 50) / CW))) k.v = -k.v;
            if (k.v) k.dir = k.v > 0 ? 1 : -1;
          }
        if (lane.kind === 'road' || lane.kind === 'river') {
          for (const t of lane.items) {
            t.x += lane.dir * speedOf(lane) * dt;
            if (lane.dir > 0 && t.x > 2400) t.x -= 2800;
            if (lane.dir < 0 && t.x + t.w < -480) t.x += 2800;
          }
        } else if (lane.kind === 'rail') {
          if (lane.train !== undefined) {
            lane.train += lane.dir * 2000 * (1 + heat() * 0.3) * dt;
            // Parti de l'autre côté de l'écran (il démarre hors de l'écran : ne pas le retirer avant qu'il soit passé)
            if (lane.dir > 0 ? lane.train > 960 + 2400 : lane.train < 960 - 2400) {
              lane.train = undefined;
              lane.wait = rnd(4, 9) * (1 - heat() * 0.5);
            }
          } else {
            lane.wait = (lane.wait ?? 3) - dt;
            if (lane.wait <= 0) lane.train = lane.dir > 0 ? -1500 : 3400;
          }
        }
      }
      // Toutes les 30 s : ça accélère (annoncé à l'écran)
      bannerT = Math.max(0, bannerT - dt);
      const lv = Math.min(4, Math.floor(Math.max(0, clock - 3) / 30));
      if (lv > level) {
        level = lv;
        bannerT = 2.2;
        sfx.hurry();
      }
      // L'écran monte tout seul, et rattrape le premier
      const alive = pls.filter((p) => p.alive);
      const lead = alive.reduce((m, p) => Math.max(m, p.row), 0);
      if (clock > 3) cam += dt * (0.22 + Math.min(0.5, clock / 300));
      // L'écran rattrape le premier sans à-coups : les autres ont le temps de suivre
      const want = lead - (VIEW_ROWS - 3);
      if (want > cam) cam = Math.min(want, cam + dt * 0.9);
      for (const p of pls) {
        if (!p.alive) continue;
        p.safe = Math.max(0, p.safe - dt);
        p.pushCd = Math.max(0, p.pushCd - dt);
        p.flat = Math.max(0, p.flat - dt);
        p.repeat = Math.max(0, p.repeat - dt);
        if (p.bot) bot(p, dt);
        else {
          const { x, y, a, b } = p.inp;
          if (a && !p.lastA) hopTo(p, 0, 1);
          if (b && !p.lastB) shove(p);
          p.lastA = a;
          p.lastB = b;
          // Stick : un coup = une case, et ça répète si on tient
          const dirX = Math.abs(x) > 0.55 && Math.abs(x) >= Math.abs(y) ? Math.sign(x) : 0;
          const dirY = Math.abs(y) > 0.55 && Math.abs(y) > Math.abs(x) ? -Math.sign(y) : 0;
          if ((dirX || dirY) && (p.repeat <= 0 || dirX !== p.lastX || dirY !== p.lastY)) {
            hopTo(p, dirX, dirY);
            p.repeat = 0.24;
          }
          p.lastX = dirX;
          p.lastY = dirY;
        }
        if (p.hop > 0) {
          p.hop -= dt;
          if (p.hop <= 0) {
            p.hop = 0;
            land(p);
            if (p.queued && p.alive) {
              hopTo(p, p.queued[0], p.queued[1]);
              p.queued = null;
            }
          }
          continue;
        }
        const lane = laneAt(p.row)!;
        if (lane.kind === 'river') {
          const log = lane.items.find((t) => p.x > t.x - 8 && p.x < t.x + t.w + 8);
          if (log) {
            p.x += lane.dir * speedOf(lane) * dt;
            if (p.x < 10 || p.x > COLS * CW - 10) lose(p, fr ? 'Emporté !' : 'Swept away!');
            else if (lane.critters?.some((c) => Math.abs(c.x - p.x) < 52)) lose(p, fr ? 'Picoré !' : 'Pecked!');
          } else lose(p, 'PLOUF !');
        } else if (lane.kind === 'grass' && lane.critters) {
          const k = lane.critters.find((c) => Math.abs(c.x - p.x) < 52);
          if (k) lose(p, k.kind === 'cat' ? (fr ? 'Griffé !' : 'Scratched!') : fr ? 'Picoré !' : 'Pecked!');
        } else if (lane.kind === 'road') {
          if (lane.items.some((t) => p.x > t.x - 36 && p.x < t.x + t.w + 36)) lose(p, fr ? 'Aplati !' : 'Squashed!');
        } else if (lane.kind === 'rail' && lane.train !== undefined && Math.abs(p.x - lane.train) < 1120) lose(p, fr ? 'TCHOU !' : 'CHOO!');
        if (screenY(p.row) > BOTTOM + 40) lose(p, fr ? 'Trop lent !' : 'Too slow!');
      }
      for (const o of pops) o.life -= dt;
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
      const sum = pls.map((p) => `${p.lives}:${scoreOf(p)}`).join();
      if (sum !== lastSum && clock - lastPush > 0.7) {
        lastSum = sum;
        lastPush = clock;
        ctx.refresh();
      }
const left = pls.filter((p) => p.alive);
      const humans = pls.filter((p) => !p.bot);
      const camps = pls.some((p) => p.team !== undefined) ? sidesLeft(left) : left.length;
      if (camps <= 1 && n > 1) endT = 2.5;
      else if (humans.length && !humans.some((p) => p.alive)) endT = 2.5;
      else if (n === 1 && !left.length) endT = 2.5;
      if (endT >= 0) {
        sfx.win();
        ctx.refresh();
      }
    },
    render(g, t) {
      g.fillStyle = '#a8dd7a';
      g.fillRect(0, 0, 1920, 1080);
      const low = Math.floor(cam) - 1;
      const high = Math.ceil(cam) + VIEW_ROWS + 2;
      const m = (r: number, k: number) => ((r % k) + k) % k;
      // 1. Les sols
      for (let r = high; r >= low; r--) {
        const lane = lanes.get(r);
        if (!lane) continue;
        const y = screenY(r) - CELL / 2;
        if (lane.kind === 'grass') g.drawImage(grassRow(m(r, 4)), 0, y);
        else if (lane.kind === 'road') g.drawImage(roadRow(m(r, 3)), 0, y);
        else if (lane.kind === 'rail') g.drawImage(railRow(m(r, 2)), 0, y);
        else {
          // Rivière de sirop : vagues qui suivent le courant
          g.fillStyle = '#ff8fc0';
          g.fillRect(0, y, 1920, CELL + 1);
          g.fillStyle = 'rgba(196,18,95,0.22)';
          g.fillRect(0, y, 1920, 10);
          g.fillStyle = 'rgba(255,255,255,.4)';
          const off = (r * 91 + t * lane.dir * speedOf(lane) * 0.35) % 200;
          for (let x = off - 200; x < 1920; x += 200) {
            g.beginPath();
            g.roundRect(x, y + 22 + m(r, 3) * 22, 70, 7, 4);
            g.fill();
            g.beginPath();
            g.roundRect(x + 100, y + 70 - m(r, 2) * 14, 44, 6, 3);
            g.fill();
          }
        }
      }
      // 2. Trottoirs au bord des routes
      for (let r = high; r >= low; r--) {
        if (lanes.get(r)?.kind !== 'road') continue;
        const y = screenY(r) - CELL / 2;
        if (lanes.get(r + 1)?.kind !== 'road') curb(g, y);
        if (lanes.get(r - 1)?.kind !== 'road') curb(g, y + CELL);
      }
      // 3. Ce qui est posé dessus : arbres, bonus, voitures, baguettes, trains
      for (let r = high; r >= low; r--) {
        const lane = lanes.get(r);
        if (!lane) continue;
        const y = screenY(r) - CELL / 2;
        if (lane.kind === 'grass') {
          for (const c of lane.trees) {
            const v = m(c * 7 + r, 5);
            g.drawImage(v < 3 ? tree(v) : bush(v - 3), (c + 0.5) * CW - 65, y - 8);
          }
          if (lane.critters)
            for (const k of lane.critters) {
              // À l'arrêt, les pattes ne bougent pas ; en pleine course, elles vont plus vite
              const fr2 = k.v === 0 ? 0 : Math.floor(t * (Math.abs(k.v) > k.speed * 1.5 ? 12 : 6)) % 2;
              g.drawImage(cat(fr2, k.dir), k.x - 65, y);
            }
          if (lane.bonus) {
            const bx = (lane.bonus.col + 0.5) * CW;
            const by = y + CELL / 2 + Math.sin(t * 4 + r) * 6;
            g.fillStyle = 'rgba(255,255,255,0.55)';
            g.beginPath();
            g.arc(bx, by, 40 + Math.sin(t * 6) * 4, 0, Math.PI * 2);
            g.fill();
            g.font = '64px sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillStyle = '#000';
            g.fillText(lane.bonus.kind === 'star' ? '⭐' : lane.bonus.kind === 'shield' ? '🛡️' : '🚀', bx, by);
          }
        } else if (lane.kind === 'road') {
          for (const c of lane.items) g.drawImage(vehicle(c.v ?? (c.w > 200 ? 'bus' : 'car'), c.c, c.w, lane.dir), c.x - 14, y);
        } else if (lane.kind === 'river') {
          for (const c of lane.items) g.drawImage(bread(c.w), c.x - 5, y);
          if (lane.critters)
            for (const k of lane.critters) {
              const fr2 = Math.floor(t * (Math.abs(k.v) > k.speed * 1.5 ? 16 : 9)) % 2;
              g.drawImage(bird(fr2, k.dir), k.x - 60, y - 6 + Math.sin(t * 5 + k.minX) * 8);
            }
        } else {
          // L'alerte juste avant le train
          const warn = lane.train === undefined && (lane.wait ?? 9) < 1.3;
          if (warn && Math.sin(t * 22) > -0.2) {
            g.fillStyle = 'rgba(255,42,42,.35)';
            g.fillRect(0, y, 1920, CELL);
            g.font = '46px sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillStyle = '#000';
            g.fillText('🚨', 60, y + CELL / 2);
            g.fillText('🚨', 1860, y + CELL / 2);
          }
          if (lane.train !== undefined) g.drawImage(train(lane.dir), lane.train - 1110, y);
        }
      }
      // Les joueurs, ceux du fond d'abord
      [...pls].sort((a, b) => b.row - a.row).forEach((p, i) => {
        if (!p.alive || (p.safe > 0 && Math.sin(t * 28) > 0.3)) return;
        const k = p.hop > 0 ? 1 - p.hop / HOP : 1;
        const row = p.hop > 0 ? p.fromRow + (p.row - p.fromRow) * k : p.row;
        const x = p.hop > 0 ? p.fromX + (p.x - p.fromX) * k : p.x;
        const y = screenY(row) + CELL / 2 - 14 - Math.sin(k * Math.PI) * (p.hop > 0 ? 34 : 0);
        if (p.shield) {
          g.strokeStyle = '#2ec5ff';
          g.lineWidth = 7;
          g.beginPath();
          g.arc(x, y - 44, 56, 0, Math.PI * 2);
          g.stroke();
        }
        drawCharacter(g, x, y, 92, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          dir: p.dirX > 0 ? 1 : -1,
          run: p.hop > 0 ? 1 : 0,
          mood: p.flat > 0 ? 'sad' : p.hop > 0 ? 'wow' : 'happy',
        });
        playerTag(g, x, y - 118, p.profile.name, p.profile.color);
      });
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '700 42px Fredoka, sans-serif';
      for (const o of pops) {
        g.globalAlpha = Math.min(1, o.life * 2);
        g.lineWidth = 8;
        g.strokeStyle = INK;
        const y = Math.max(130, Math.min(1000, screenY(o.row) - 110 - (1 - o.life) * 40));
        const half = g.measureText(o.text).width / 2 + 8;
        const px = Math.max(half, Math.min(1920 - half, o.x));
        g.strokeText(o.text, px, y);
        g.fillStyle = o.c;
        g.fillText(o.text, px, y);
      }
      g.globalAlpha = 1;
      if (bannerT > 0) {
        const k = Math.min(1, (2.2 - bannerT) * 6, bannerT * 3);
        g.save();
        g.globalAlpha = Math.max(0, k);
        g.translate(960, 300);
        g.rotate(-0.04);
        g.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(-330, -62, 660, 132, 40);
        g.fill();
        g.fillStyle = '#ffd60a';
        g.beginPath();
        g.roundRect(-330, -70, 660, 128, 40);
        g.fill();
        g.font = '700 64px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = INK;
        g.fillText(fr ? `⚡ Ça accélère ! (${level + 1})` : `⚡ Speeding up! (${level + 1})`, 0, -4, 620);
        g.restore();
      }
      // Bord du bas dangereux
      g.fillStyle = 'rgba(255,59,92,.35)';
      g.fillRect(0, 1040, 1920, 40);
      // Vies et distance, en haut
      const w = Math.min(280, 1880 / n);
      pls.forEach((p, i) => {
        const x = (1920 - n * w) / 2 + i * w;
        g.globalAlpha = p.alive ? 1 : 0.45;
        g.fillStyle = p.profile.color;
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(x + 4, 10, w - 8, 72, 18);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.font = '700 28px Fredoka, sans-serif';
        g.fillText(`${p.profile.name.slice(0, w < 180 ? 5 : 9)} · ${scoreOf(p)}`, x + w / 2, 32, w - 20);
        g.font = '28px sans-serif';
        g.fillStyle = '#000';
        g.fillText('❤️'.repeat(Math.max(0, p.lives)) + (p.shield ? ' 🛡️' : '') + (p.superJump ? ' 🚀' : ''), x + w / 2, 62);
        g.globalAlpha = 1;
      });
    },
    ranking: () => [...pls].sort((a, b) => Number(b.alive) - Number(a.alive) || scoreOf(b) - scoreOf(a) || b.outAt - a.outAt).map((p) => p.pid),
    out: (pid) => !pls.find((p) => p.pid === pid)?.alive,
    leader: () => null,
  };
  speak(fr ? 'Traversez, sans vous faire écraser !' : 'Cross, without getting squashed!', ctx.lang);
  return game;
}

export const traverse: GameBase = {
  id: 'traverse',
  emoji: '🚗',
  name: { fr: 'Traverse Pas Ici !', en: 'Don’t Cross Here!' },
  how: {
    fr: 'Saute de case en case : routes, rivières de sirop, trains… L’écran monte ! Quatre boutons sur le téléphone : avance, gauche, droite, recule. Le bouton du milieu pousse les autres.',
    en: 'Hop from tile to tile: roads, syrup rivers, trains… The screen is rising! Four buttons on your phone: forward, left, right, back. The middle button shoves others.',
  },
  layout: 'buttons',
  min: 1,
  max: 12,
  botFill: 4,
  music: 'race',
  limit: 150,
  timerCorner: true,
  create,
};
