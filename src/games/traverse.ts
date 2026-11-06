// Traverse Pas Ici ! : tout le monde part d'en bas et saute de case en case : pelouses, routes, rivières de sirop et rails.
// L'écran monte : qui reste en bas perd une vie. En plus : bonus (étoile, bouclier, super bond), et on peut pousser les voisins.
// A = avancer d'une case, le stick = sauter dans une direction, B = pousser.
import { drawCharacter } from '../shared/characters';
import { INK, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { candy, playerTag } from './draw';
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
interface Thing {
  x: number;
  w: number;
  c: string;
}
interface Lane {
  kind: LaneKind;
  dir: 1 | -1;
  speed: number;
  items: Thing[];
  /** Pelouse : colonnes occupées par un arbre. */
  trees: Set<number>;
  /** Bonus posé sur la case. */
  bonus?: { col: number; kind: 'star' | 'shield' | 'jump' };
  /** Rails : temps avant le prochain train, et position du train. */
  wait?: number;
  train?: number;
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
  outAt: number;
  botT: number;
}

const CAR_COLORS = ['#ff4f9a', '#2ec5ff', '#ffd60a', '#9b5cff', '#ff9a1f', '#22c99a'];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const lanes = new Map<number, Lane>();
  let genRow = 0;

  /** Fabrique les rangées par paquets : jamais deux fois le même paquet, et ça se corse en montant. */
  const addChunk = () => {
    const d = Math.min(1, genRow / 110);
    const last = lanes.get(genRow - 1)?.kind;
    const opts: LaneKind[] = (['road', 'river', 'rail', 'grass'] as LaneKind[]).filter((k) => k !== last);
    const kind = genRow < 2 ? 'grass' : last !== 'grass' && Math.random() < 0.45 ? 'grass' : opts[Math.floor(Math.random() * opts.length)];
    const count = kind === 'grass' ? 1 + Math.floor(Math.random() * 2) : kind === 'rail' ? 1 : 1 + Math.floor(Math.random() * (kind === 'road' ? 3 + d * 2 : 2 + d * 2));
    let dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const lane: Lane = { kind, dir, speed: 0, items: [], trees: new Set() };
      if (kind === 'road') {
        lane.speed = rnd(130, 240) * (1 + d * 0.9);
        const big = Math.random() < 0.25;
        const w = big ? CW * 2.4 : CW * 1.2;
        const gap = rnd(3.5, 6.5) * CW * (1 - d * 0.25);
        const color = () => CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
        for (let x = rnd(0, 300); x < 2400; x += w + gap) lane.items.push({ x, w, c: color() });
      } else if (kind === 'river') {
        lane.speed = rnd(70, 140) * (1 + d * 0.6);
        const w = CW * rnd(2.4 - d, 4);
        const gap = CW * rnd(1.1, 2 + d);
        for (let x = rnd(-100, 100); x < 2400; x += w + gap) lane.items.push({ x, w, c: '#d9a35a' });
      } else if (kind === 'rail') {
        lane.wait = rnd(2, 7);
      } else if (genRow + i > 2) {
        // Des arbres, mais toujours de quoi passer
        const n = Math.floor(Math.random() * (3 + d * 3));
        for (let k = 0; k < n; k++) lane.trees.add(Math.floor(Math.random() * COLS));
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
    return { ...r, col, x: (col + 0.5) * CW, row: 0, fromX: 0, fromRow: 0, hop: 0, dirX: 1, lives: LIVES, alive: true, safe: 1, best: 0, bonus: 0, shield: false, superJump: 0, sunk: 0, pushCd: 0, flat: 0, lastX: 0, lastY: 0, lastA: false, lastB: false, repeat: 0, inp: { x: 0, y: 0, a: false, b: false }, outAt: 0, botT: rnd(0.3, 1) };
  });
  let cam = 0;
  let clock = 0;
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
    if (lane.kind === 'grass') return !lane.trees.has(Math.floor(x / CW));
    if (lane.kind === 'rail') return (lane.train === undefined && (lane.wait ?? 0) > 1) || false;
    const mx = x - lane.dir * lane.speed * look;
    const on = lane.items.some((t) => mx > t.x - (lane.kind === 'river' ? -20 : 40) && mx < t.x + t.w + (lane.kind === 'river' ? -20 : 40));
    return lane.kind === 'river' ? on : !on;
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
    const cur = laneAt(p.row)!;
    if (cur.kind !== 'grass' && !safeAt(p.row, p.x, 0.6) && safeAt(p.row - 1, p.x, 0.3)) hopTo(p, 0, -1);
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

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const p = pls.find((x) => x.pid === pid);
      if (p) p.inp = { x: m.x, y: m.y, a: m.a, b: m.b };
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
        if (lane.kind === 'road' || lane.kind === 'river') {
          for (const t of lane.items) {
            t.x += lane.dir * lane.speed * dt;
            if (lane.dir > 0 && t.x > 2400) t.x -= 2800;
            if (lane.dir < 0 && t.x + t.w < -480) t.x += 2800;
          }
        } else if (lane.kind === 'rail') {
          if (lane.train !== undefined) {
            lane.train += lane.dir * 2000 * dt;
            if (Math.abs(lane.train - 960) > 2400) {
              lane.train = undefined;
              lane.wait = rnd(4, 9);
            }
          } else {
            lane.wait = (lane.wait ?? 3) - dt;
            if (lane.wait <= 0) lane.train = lane.dir > 0 ? -1500 : 3400;
          }
        }
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
          }
          continue;
        }
        const lane = laneAt(p.row)!;
        if (lane.kind === 'river') {
          const log = lane.items.find((t) => p.x > t.x - 8 && p.x < t.x + t.w + 8);
          if (log) {
            p.x += lane.dir * lane.speed * dt;
            if (p.x < 10 || p.x > COLS * CW - 10) lose(p, fr ? 'Emporté !' : 'Swept away!');
          } else lose(p, 'PLOUF !');
        } else if (lane.kind === 'road') {
          if (lane.items.some((t) => p.x > t.x - 36 && p.x < t.x + t.w + 36)) lose(p, fr ? 'Aplati !' : 'Squashed!');
        } else if (lane.kind === 'rail' && lane.train !== undefined && Math.abs(p.x - lane.train) < 1120) lose(p, fr ? 'TCHOU !' : 'CHOO!');
        if (screenY(p.row) > BOTTOM + 40) lose(p, fr ? 'Trop lent !' : 'Too slow!');
      }
      for (const o of pops) o.life -= dt;
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
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
      for (let r = high; r >= low; r--) {
        const lane = lanes.get(r);
        if (!lane) continue;
        const y = screenY(r) - CELL / 2;
        if (lane.kind === 'grass') {
          g.fillStyle = r % 2 ? '#a8dd7a' : '#9bd46c';
          g.fillRect(0, y, 1920, CELL + 1);
          for (const c of lane.trees) {
            const x = (c + 0.5) * CW;
            g.fillStyle = '#a0643a';
            g.fillRect(x - 11, y + 62, 22, 40);
            g.fillStyle = '#3fa34a';
            g.strokeStyle = INK;
            g.lineWidth = 5;
            g.beginPath();
            g.arc(x - 22, y + 50, 28, 0, Math.PI * 2);
            g.arc(x + 22, y + 50, 28, 0, Math.PI * 2);
            g.arc(x, y + 28, 32, 0, Math.PI * 2);
            g.fill();
            g.stroke();
          }
          if (lane.bonus) {
            const bx = (lane.bonus.col + 0.5) * CW;
            g.font = '64px sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillStyle = '#000';
            g.fillText(lane.bonus.kind === 'star' ? '⭐' : lane.bonus.kind === 'shield' ? '🛡️' : '🚀', bx, y + CELL / 2 + Math.sin(t * 4 + r) * 6);
          }
        } else if (lane.kind === 'road') {
          g.fillStyle = '#5b5166';
          g.fillRect(0, y, 1920, CELL + 1);
          g.fillStyle = 'rgba(255,255,255,.55)';
          for (let x = (r * 37) % 120; x < 1920; x += 120) g.fillRect(x, y + CELL - 5, 60, 5);
          for (const c of lane.items) {
            g.fillStyle = c.c;
            g.strokeStyle = INK;
            g.lineWidth = 5;
            g.beginPath();
            g.roundRect(c.x, y + 16, c.w, CELL - 34, 22);
            g.fill();
            g.stroke();
            candy(g, c.x, y + 16, c.w, CELL - 34, 22);
            // Pare-brise et phares, du côté où ça roule
            const front = lane.dir > 0 ? c.x + c.w - 54 : c.x + 16;
            g.fillStyle = '#d6f4ff';
            g.beginPath();
            g.roundRect(front, y + 28, 38, CELL - 58, 8);
            g.fill();
            g.stroke();
            g.fillStyle = INK;
            g.beginPath();
            g.arc(c.x + 30, y + CELL - 14, 13, 0, Math.PI * 2);
            g.arc(c.x + c.w - 30, y + CELL - 14, 13, 0, Math.PI * 2);
            g.fill();
          }
        } else if (lane.kind === 'river') {
          g.fillStyle = '#ff8fc0';
          g.fillRect(0, y, 1920, CELL + 1);
          g.fillStyle = 'rgba(255,255,255,.35)';
          for (let x = ((r * 91 + t * lane.dir * 40) % 200) - 200; x < 1920; x += 200) g.fillRect(x, y + 20 + (r % 3) * 24, 70, 6);
          for (const c of lane.items) {
            g.fillStyle = c.c;
            g.strokeStyle = INK;
            g.lineWidth = 5;
            g.beginPath();
            g.roundRect(c.x, y + 14, c.w, CELL - 28, 34);
            g.fill();
            g.stroke();
            // Une grande baguette : ses entailles
            g.strokeStyle = '#a0643a';
            g.lineWidth = 6;
            for (let x = c.x + 40; x < c.x + c.w - 30; x += 56) {
              g.beginPath();
              g.moveTo(x, y + 30);
              g.lineTo(x + 22, y + CELL - 30);
              g.stroke();
            }
          }
        } else {
          g.fillStyle = '#c9b8a8';
          g.fillRect(0, y, 1920, CELL + 1);
          g.fillStyle = '#8a6a4a';
          for (let x = 0; x < 1920; x += 54) g.fillRect(x, y + 12, 18, CELL - 24);
          g.fillStyle = '#6b6f7a';
          g.fillRect(0, y + 28, 1920, 9);
          g.fillRect(0, y + CELL - 37, 1920, 9);
          // L'alerte juste avant le train
          const warn = lane.train === undefined && (lane.wait ?? 9) < 1.3;
          g.font = '46px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          if (warn && Math.sin(t * 22) > -0.2) {
            g.fillStyle = 'rgba(255,42,42,.35)';
            g.fillRect(0, y, 1920, CELL);
            g.fillStyle = '#000';
            g.fillText('🚨', 60, y + CELL / 2);
            g.fillText('🚨', 1860, y + CELL / 2);
          }
          if (lane.train !== undefined) {
            const x = lane.train - 1100;
            g.fillStyle = '#ff3b3b';
            g.strokeStyle = INK;
            g.lineWidth = 6;
            g.beginPath();
            g.roundRect(x, y + 8, 2200, CELL - 16, 26);
            g.fill();
            g.stroke();
            g.fillStyle = '#fff3c9';
            for (let k = x + 60; k < x + 2150; k += 150) {
              g.beginPath();
              g.roundRect(k, y + 26, 90, CELL - 60, 10);
              g.fill();
            }
          }
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
        const y = screenY(o.row) - 110 - (1 - o.life) * 40;
        g.strokeText(o.text, o.x, y);
        g.fillStyle = o.c;
        g.fillText(o.text, o.x, y);
      }
      g.globalAlpha = 1;
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
        g.font = '24px sans-serif';
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
    fr: 'Saute de case en case : routes, rivières de sirop, trains… L’écran monte ! A = avancer, stick = sauter dans une direction, B = pousser. 3 vies.',
    en: 'Hop from tile to tile: roads, syrup rivers, trains… The screen is rising! A = forward, stick = hop in a direction, B = shove. 3 lives.',
  },
  layout: 'stick',
  min: 1,
  max: 12,
  botFill: 4,
  music: 'race',
  limit: 150,
  timerCorner: true,
  create,
};
