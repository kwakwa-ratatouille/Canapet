// Cuisine en Panique : coopératif. On prend, on coupe, on cuit, on dresse, on sert avant la fin du chrono.
// A = prendre / poser · B maintenu = couper sur la planche.
import { drawCharacter } from '../shared/characters';
import { sfx, speak } from '../shared/sound';
import { roundRectText } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const MAP = [
  '##T#S#F#P#V#####',
  '#..............W',
  'C..............#',
  'C...##OO##.....#',
  '#..............D',
  '#..............X',
  '#...#####......#',
  '#..............#',
  '################',
];
const GW = 16;
const GH = 9;
const CS = 100;
const OX = 160;
const OY = 150;
const SPEED = 4.2;
const PR = 0.32;
const GAME_TIME = 150;
const CHOP_TIME = 1.3;
const COOK = 4.5;
const BURN = 11;

type Kind = 'tomate' | 'salade' | 'fromage' | 'pain' | 'steak';
interface Ing {
  kind: Kind;
  state: 'cru' | 'coupe' | 'cuit' | 'brule';
  prog: number;
}
interface Plate {
  plate: true;
  items: string[];
}
type Item = Ing | Plate;

const CRATES: Record<string, Kind> = { T: 'tomate', S: 'salade', F: 'fromage', P: 'pain', V: 'steak' };
const EMOJI: Record<Kind, string> = { tomate: '🍅', salade: '🥬', fromage: '🧀', pain: '🍞', steak: '🥩' };
const RECIPES: { id: string; name: Record<'fr' | 'en', string>; emoji: string; items: string[]; pts: number }[] = [
  { id: 'salade', name: { fr: 'Salade', en: 'Salad' }, emoji: '🥗', items: ['salade:coupe', 'tomate:coupe'], pts: 20 },
  { id: 'croque', name: { fr: 'Croque', en: 'Toastie' }, emoji: '🥪', items: ['fromage:coupe', 'pain:cru'], pts: 20 },
  { id: 'burger', name: { fr: 'Burger', en: 'Burger' }, emoji: '🍔', items: ['pain:cru', 'salade:coupe', 'steak:cuit'], pts: 35 },
];
const OK_ON_PLATE = new Set(['tomate:coupe', 'salade:coupe', 'fromage:coupe', 'pain:cru', 'steak:cuit']);

interface Cook extends Runner {
  x: number;
  y: number;
  fx: number;
  fy: number;
  hand: Item | null;
  inp: { x: number; y: number };
  actReq: boolean;
  chopping: boolean;
  lastA: boolean;
  pts: number;
}

const isPlate = (i: Item | null | undefined): i is Plate => !!i && 'plate' in i;
const tag = (i: Ing) => `${i.kind}:${i.state}`;

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const cells = MAP.map((r) => r.split(''));
  const slots = new Map<string, Item>();
  const key = (x: number, y: number) => `${x},${y}`;
  const floor = (x: number, y: number) => cells[y]?.[x] === '.';
  const spawns: [number, number][] = [
    [2, 4], [5, 4], [8, 4], [11, 4], [2, 7], [5, 7], [8, 7], [11, 7],
  ];
  const cooks: Cook[] = runners.slice(0, 8).map((r, i) => ({
    ...r,
    x: spawns[i][0] + 0.5,
    y: spawns[i][1] + 0.5,
    fx: 0,
    fy: -1,
    hand: null,
    inp: { x: 0, y: 0 },
    actReq: false,
    chopping: false,
    lastA: false,
    pts: 0,
  }));
  let orders: { r: number; t: number; max: number }[] = [];
  let score = 0;
  let served = 0;
  let time = 0;
  let nextOrder = 1;
  let endDelay = -1;
  let toast = '';
  let toastT = 0;

  function addOrder() {
    const r = Math.floor(Math.random() * RECIPES.length);
    const max = 50 + RECIPES[r].items.length * 8;
    orders.push({ r, t: max, max });
    sfx.tick();
  }

  function say(s: string) {
    toast = s;
    toastT = 2.2;
  }

  function target(c: Cook): [number, number] {
    return [Math.floor(c.x + c.fx * 0.75), Math.floor(c.y + c.fy * 0.75)];
  }

  function interact(c: Cook) {
    const [tx, ty] = target(c);
    const cell = cells[ty]?.[tx];
    if (!cell || cell === '.') return;
    const k = key(tx, ty);
    const here = slots.get(k);
    if (CRATES[cell]) {
      if (!c.hand) {
        c.hand = { kind: CRATES[cell], state: 'cru', prog: 0 };
        sfx.click();
      } else if (isPlate(c.hand) && OK_ON_PLATE.has(`${CRATES[cell]}:cru`)) {
        c.hand.items.push(`${CRATES[cell]}:cru`);
        sfx.click();
      }
      return;
    }
    if (cell === 'D') {
      if (!c.hand) c.hand = { plate: true, items: [] };
      else if (!isPlate(c.hand) && OK_ON_PLATE.has(tag(c.hand))) {
        c.hand = { plate: true, items: [tag(c.hand)] };
        c.pts++;
      }
      sfx.click();
      return;
    }
    if (cell === 'X') {
      if (isPlate(c.hand)) c.hand.items = [];
      else c.hand = null;
      sfx.pop();
      return;
    }
    if (cell === 'W') {
      if (!isPlate(c.hand) || !c.hand.items.length) return;
      const got = [...c.hand.items].sort().join('|');
      const idx = orders.findIndex((o) => [...RECIPES[o.r].items].sort().join('|') === got);
      if (idx < 0) {
        say(fr ? 'Ce plat n’est pas commandé !' : 'Nobody ordered that!');
        sfx.boing();
        return;
      }
      const o = orders[idx];
      const bonus = Math.round((o.t / o.max) * 10);
      score += RECIPES[o.r].pts + bonus;
      served++;
      c.pts += 5;
      orders.splice(idx, 1);
      c.hand = null;
      sfx.win();
      if (!c.bot) ctx.buzz(c.pid, 150);
      say(`${RECIPES[o.r].emoji} +${RECIPES[o.r].pts + bonus}`);
      return;
    }
    // Plans de travail, planches, feux : une case = un objet
    if (!c.hand && here) {
      c.hand = here;
      slots.delete(k);
      sfx.click();
      return;
    }
    if (c.hand && !here) {
      if (cell === 'O' && (isPlate(c.hand) || c.hand.kind !== 'steak')) return;
      if (cell === 'C' && (isPlate(c.hand) || c.hand.state !== 'cru' || c.hand.kind === 'steak' || c.hand.kind === 'pain')) return;
      slots.set(k, c.hand);
      c.hand = null;
      sfx.click();
      return;
    }
    // Dresser : ingrédient sur assiette, ou assiette sur ingrédient
    if (isPlate(c.hand) && here && !isPlate(here) && OK_ON_PLATE.has(tag(here))) {
      c.hand.items.push(tag(here));
      slots.delete(k);
      c.pts++;
      sfx.click();
    } else if (c.hand && !isPlate(c.hand) && isPlate(here) && OK_ON_PLATE.has(tag(c.hand))) {
      here.items.push(tag(c.hand));
      c.hand = null;
      c.pts++;
      sfx.click();
    }
  }

  function move(c: Cook, dt: number) {
    let ix = c.inp.x;
    let iy = c.inp.y;
    const l = Math.hypot(ix, iy);
    if (l < 0.25) return;
    ix /= Math.max(1, l);
    iy /= Math.max(1, l);
    if (Math.abs(ix) > Math.abs(iy)) {
      c.fx = Math.sign(ix);
      c.fy = 0;
    } else {
      c.fx = 0;
      c.fy = Math.sign(iy);
    }
    const nx = c.x + ix * SPEED * dt;
    if (floor(Math.floor(nx + Math.sign(ix) * PR), Math.floor(c.y - PR + 0.01)) && floor(Math.floor(nx + Math.sign(ix) * PR), Math.floor(c.y + PR - 0.01))) c.x = nx;
    const ny = c.y + iy * SPEED * dt;
    if (floor(Math.floor(c.x - PR + 0.01), Math.floor(ny + Math.sign(iy) * PR)) && floor(Math.floor(c.x + PR - 0.01), Math.floor(ny + Math.sign(iy) * PR))) c.y = ny;
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const c = cooks.find((x) => x.pid === pid);
      if (!c) return;
      if (m.a && !c.lastA) c.actReq = true;
      c.lastA = m.a;
      c.chopping = m.b;
      c.inp = { x: m.x, y: m.y };
    },
    update(dt) {
      time += dt;
      toastT -= dt;
      if (time >= nextOrder && orders.length < 5 && time < GAME_TIME - 10) {
        addOrder();
        nextOrder = time + Math.max(9, 18 - cooks.filter((c) => !c.bot).length * 1.5);
      }
      for (const o of orders) o.t -= dt;
      const late = orders.filter((o) => o.t <= 0);
      if (late.length) {
        score = Math.max(0, score - 10 * late.length);
        say(fr ? 'Commande ratée… −10' : 'Order missed… −10');
        sfx.pet();
        orders = orders.filter((o) => o.t > 0);
      }
      cooks.forEach((c) => {
        if (c.bot) return; // les bots restent en cuisine pour faire nombre (pas encore d'IA de commis)
        move(c, dt);
        if (c.actReq) interact(c);
        c.actReq = false;
        if (c.chopping && !c.hand) {
          const [tx, ty] = target(c);
          const it = slots.get(key(tx, ty));
          if (cells[ty]?.[tx] === 'C' && it && !isPlate(it) && it.state === 'cru') {
            it.prog += dt / CHOP_TIME;
            if (Math.floor(time * 6) !== Math.floor((time - dt) * 6)) sfx.step();
            if (it.prog >= 1) {
              it.state = 'coupe';
              it.prog = 0;
              c.pts++;
              sfx.pop();
            }
          }
        }
      });
      // Feux : cuisson automatique
      for (const [k, it] of slots) {
        const [x, y] = k.split(',').map(Number);
        if (cells[y][x] !== 'O' || isPlate(it)) continue;
        if (it.state === 'cru' || it.state === 'cuit') {
          it.prog += dt;
          if (it.prog >= COOK && it.state === 'cru') {
            it.state = 'cuit';
            sfx.finish();
          }
          if (it.prog >= BURN) {
            it.state = 'brule';
            sfx.pet();
          }
        }
      }
      if (endDelay < 0 && time >= GAME_TIME) {
        endDelay = 2.5;
        speak(fr ? `Service terminé ! ${served} plats servis.` : `Service over! ${served} dishes served.`, ctx.lang);
      }
      if (endDelay >= 0 && (endDelay -= dt) <= 0) game.over = true;
    },
    render(g, t) {
      g.fillStyle = '#ffe9d6';
      g.fillRect(0, 0, 1920, 1080);
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < GW; x++) {
          const c = cells[y][x];
          const px = OX + x * CS;
          const py = OY + y * CS;
          if (c === '.') {
            g.fillStyle = (x + y) % 2 ? '#fff' : '#f3ecff';
            g.fillRect(px, py, CS, CS);
            continue;
          }
          g.fillStyle = c === 'O' ? '#5b5470' : c === 'C' ? '#d9a066' : c === 'W' ? '#7bd13b' : c === 'X' ? '#9aa0a6' : '#ffcfa3';
          g.strokeStyle = INK;
          g.lineWidth = 3;
          g.beginPath();
          g.roundRect(px + 2, py + 2, CS - 4, CS - 4, 12);
          g.fill();
          g.stroke();
          g.font = '52px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          const icon = CRATES[c] ? EMOJI[CRATES[c]] : c === 'D' ? '🍽️' : c === 'W' ? '🛎️' : c === 'X' ? '🗑️' : c === 'C' ? '🔪' : c === 'O' ? '🍳' : '';
          if (icon) {
            g.globalAlpha = c === 'C' || c === 'O' ? 0.35 : 1;
            g.fillText(icon, px + CS / 2, py + CS / 2 + 3);
            g.globalAlpha = 1;
          }
          g.textBaseline = 'alphabetic';
        }
      const drawItem = (it: Item, x: number, y: number, s: number) => {
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        if (isPlate(it)) {
          g.fillStyle = '#fff';
          g.strokeStyle = INK;
          g.lineWidth = 3;
          g.beginPath();
          g.ellipse(x, y, s * 0.5, s * 0.36, 0, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.font = `${s * 0.36}px sans-serif`;
          it.items.forEach((k, i) => {
            const kind = k.split(':')[0] as Kind;
            g.fillText(EMOJI[kind], x + (i - (it.items.length - 1) / 2) * s * 0.3, y);
          });
        } else {
          g.font = `${s * 0.62}px sans-serif`;
          g.globalAlpha = it.state === 'brule' ? 0.5 : 1;
          g.fillText(it.state === 'brule' ? '💨' : EMOJI[it.kind], x, y);
          g.globalAlpha = 1;
          if (it.state === 'coupe' || it.state === 'cuit') {
            g.font = `${s * 0.3}px sans-serif`;
            g.fillText(it.state === 'coupe' ? '✂️' : '🔥', x + s * 0.3, y - s * 0.25);
          }
          if (it.prog > 0 && it.state === 'cru') {
            g.fillStyle = '#ddd';
            g.fillRect(x - s * 0.4, y + s * 0.38, s * 0.8, 8);
            g.fillStyle = '#7bd13b';
            const p = it.kind === 'steak' ? it.prog / COOK : it.prog;
            g.fillRect(x - s * 0.4, y + s * 0.38, s * 0.8 * Math.min(1, p), 8);
          }
        }
        g.textBaseline = 'alphabetic';
      };
      for (const [k, it] of slots) {
        const [x, y] = k.split(',').map(Number);
        drawItem(it, OX + (x + 0.5) * CS, OY + (y + 0.5) * CS, CS * 0.8);
      }
      const order = cooks.map((_, i) => i).sort((a, b) => cooks[a].y - cooks[b].y);
      for (const i of order) {
        const c = cooks[i];
        const px = OX + c.x * CS;
        const py = OY + c.y * CS;
        drawCharacter(g, px, py + 34, 78, {
          food: c.profile.food,
          color: c.profile.color,
          hat: c.profile.hat === 'aucun' ? 'bob' : c.profile.hat,
          acc: c.profile.acc,
          selfie: c.selfie,
          t: t + i,
          dir: c.fx < 0 ? -1 : 1,
          run: Math.hypot(c.inp.x, c.inp.y) > 0.25 ? 0.7 : 0,
        });
        if (c.hand) drawItem(c.hand, px, py - 62, 60);
        if (!c.bot) {
          const [tx, ty] = [Math.floor(c.x + c.fx * 0.75), Math.floor(c.y + c.fy * 0.75)];
          if (cells[ty]?.[tx] !== '.') {
            g.strokeStyle = c.profile.color;
            g.lineWidth = 5;
            g.strokeRect(OX + tx * CS + 6, OY + ty * CS + 6, CS - 12, CS - 12);
          }
        }
      }
      // Commandes
      orders.forEach((o, i) => {
        const r = RECIPES[o.r];
        const x = 170 + i * 250;
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.beginPath();
        g.roundRect(x, 20, 230, 112, 16);
        g.fill();
        g.stroke();
        g.font = '44px sans-serif';
        g.textAlign = 'left';
        g.fillStyle = INK;
        g.fillText(r.emoji, x + 12, 76);
        g.font = '700 28px Fredoka, sans-serif';
        g.fillText(r.name[ctx.lang], x + 72, 58);
        g.font = '28px sans-serif';
        g.fillText(r.items.map((k) => EMOJI[k.split(':')[0] as Kind]).join(''), x + 72, 92);
        const k = o.t / o.max;
        g.fillStyle = k > 0.5 ? '#7bd13b' : k > 0.25 ? '#ffb020' : '#ff3b3b';
        g.fillRect(x + 12, 110, 206 * Math.max(0, k), 10);
      });
      g.fillStyle = INK;
      g.font = '700 46px Fredoka, sans-serif';
      g.textAlign = 'right';
      g.fillText(`⭐ ${score}`, 1880, 70);
      g.font = '600 32px Fredoka, sans-serif';
      g.fillText(`⏱ ${Math.max(0, Math.ceil(GAME_TIME - time))} s`, 1880, 115);
      if (toastT > 0) {
        g.font = '700 60px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.lineWidth = 8;
        g.strokeStyle = INK;
        g.strokeText(toast, 960, 1065);
        g.fillStyle = '#ffd60a';
        g.fillText(toast, 960, 1065);
      }
      cooks.forEach((c, i) => {
        if (c.bot) return;
        roundRectText(g, `${c.profile.name} · ${c.pts}`, 20, 170 + i * 50, 130, 20, c.profile.color);
      });
    },
    ranking() {
      return [...cooks].sort((a, b) => Number(a.bot) - Number(b.bot) || b.pts - a.pts).map((c) => c.pid);
    },
    leader() {
      return null;
    },
  };
  return game;
}

export const kitchen: GameBase = {
  id: 'cuisine',
  emoji: '🍳',
  name: { fr: 'Cuisine en Panique', en: 'Kitchen Panic' },
  how: {
    fr: 'Ensemble ! A prendre/poser · B maintenu couper · servez les commandes',
    en: 'Together! A pick/drop · hold B to chop · serve the orders',
  },
  inspired: 'Overcooked',
  layout: 'stick',
  min: 1,
  max: 8,
  botFill: 0,
  music: 'tumble',
  create,
};
