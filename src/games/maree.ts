// Raz-de-marée : on grimpe de plateforme en plateforme pendant que la mer (de sirop) monte de plus en plus vite.
// Vue de côté, la caméra suit la vague : tout le monde reste à l'écran. Touché par l'eau = éliminé.
// Stick = bouger, A = sauter, B = pousser les voisins.
import { dozing } from './botSkill';
import { drawCharacter } from '../shared/characters';
import { INK, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { candy, playerTag } from './draw';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

const GRAV = 2600;
const JUMP = 1180;
const RUN = 470;
const LEFT = 140;
const RIGHT = 1780;
const BODY_W = 26;
const VIEW = 1080;
/** La mer reste à cette hauteur de l'écran : on voit surtout ce qu'il y a au-dessus. */
const WATER_SCREEN = 960;

type Kind = 'normal' | 'mover' | 'fragile' | 'bounce';
interface Plat {
  x: number;
  y: number;
  w: number;
  kind: Kind;
  bx: number;
  ph: number;
  amp: number;
  touched: number;
  gone: boolean;
}
interface P extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  on: Plat | null;
  dir: 1 | -1;
  inp: { x: number; y: number };
  a: boolean;
  lastA: boolean;
  b: boolean;
  lastB: boolean;
  alive: boolean;
  out: number;
  sink: number;
  stun: number;
  cd: number;
  best: number;
  botT: number;
  target: Plat | null;
  pop: { text: string; t: number; c: string } | null;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Décors selon la hauteur : plage, ciel, nuages, espace. */
const SKIES: [number, string, string][] = [
  [0, '#7fd6ff', '#fff1c9'],
  [-3000, '#8fc8ff', '#ffd6ec'],
  [-6500, '#6a7bd8', '#c9b6ff'],
  [-10000, '#1d0f26', '#3a2a7a'],
];

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const plats: Plat[] = [];
  // Sol de départ, puis des plateformes de plus en plus vicieuses vers le haut
  plats.push({ x: LEFT, y: 900, w: RIGHT - LEFT, kind: 'normal', bx: LEFT, ph: 0, amp: 0, touched: -1, gone: false });
  let top = 900;
  /** Ajoute un étage de plateformes au-dessus. */
  const grow = () => {
    {
      top -= rnd(150, 185);
      const h = -top / 1000; // difficulté
      // 2 ou 3 plateformes par étage, bien réparties
      const n = Math.random() < 0.55 ? 2 : 3;
      for (let k = 0; k < n; k++) {
        const w = rnd(200, 300) - Math.min(80, h * 8);
        const zone = (RIGHT - LEFT) / n;
        const x = LEFT + k * zone + rnd(10, Math.max(20, zone - w - 10));
        const r = Math.random();
        const kind: Kind = r < Math.min(0.25, 0.05 + h * 0.03) ? 'fragile' : r < Math.min(0.45, 0.15 + h * 0.04) ? 'mover' : r > 0.95 ? 'bounce' : 'normal';
        plats.push({ x, y: top, w, kind, bx: x, ph: rnd(0, 6), amp: kind === 'mover' ? rnd(80, 160) : 0, touched: -1, gone: false });
      }
    }
  };
  for (let i = 0; i < 40; i++) grow();

  const n = runners.length;
  const ps: P[] = runners.slice(0, 12).map((r, i) => ({
    ...r,
    x: LEFT + 120 + (i * (RIGHT - LEFT - 240)) / Math.max(1, n - 1),
    y: 900,
    vx: 0,
    vy: 0,
    on: plats[0],
    dir: 1,
    inp: { x: 0, y: 0 },
    a: false,
    lastA: false,
    b: false,
    lastB: false,
    alive: true,
    out: 0,
    sink: 0,
    stun: 0,
    cd: 0,
    best: 900,
    botT: rnd(0.2, 1),
    target: null,
    pop: null,
  }));
  let time = 0;
  let water = 1500; // niveau de la mer (y monde)
  let camY = water - WATER_SCREEN;
  let outCount = 0;
  let warned = false;
  const alive = () => ps.filter((p) => p.alive);
  const live = () => ps.filter((p) => p.alive && p.sink <= 0);
  const speed = () => Math.min(150, 28 + time * 1.5);
  const foam: { x: number; y: number; vy: number; t: number }[] = [];

  const jump = (p: P, force = 1) => {
    p.vy = -JUMP * force;
    p.on = null;
    sfx.boing();
  };

  const shove = (p: P) => {
    if (p.cd > 0 || p.stun > 0) return;
    p.cd = 1.3;
    if (!p.bot) ctx.cool(p.pid, 'b', 1.3);
    sfx.whoosh();
    for (const o of live()) {
      if (o === p) continue;
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      if (Math.abs(dx) < 120 && Math.abs(dy) < 90) {
        o.vx = Math.sign(dx || p.dir) * 900;
        o.vy = Math.min(o.vy, -300);
        o.on = null;
        o.stun = 0.35;
        o.pop = { text: fr ? 'HOP !' : 'SHOVE!', t: 0.6, c: '#fff' };
        if (!o.bot) ctx.buzz(o.pid, 120);
      }
    }
  };

  const bot = (p: P, dt: number) => {
    if (dozing(p, ctx.botSkill, dt)) {
      p.inp = { x: 0, y: 0 };
      return;
    }
    p.botT -= dt;
    if (p.on && (p.botT <= 0 || !p.target || p.target.gone || p.target.y >= p.y - 20)) {
      p.botT = rnd(0.4, 1.2);
      // Prochaine marche : une plateforme au-dessus, atteignable, la plus proche
      const options = plats.filter((q) => !q.gone && q.y < p.y - 60 && q.y > p.y - 240);
      options.sort((a, b) => Math.abs(a.x + a.w / 2 - p.x) - Math.abs(b.x + b.w / 2 - p.x));
      p.target = options[0] ?? null;
    }
    const t = p.target;
    if (!t) {
      p.inp = { x: 0, y: 0 };
      return;
    }
    const cx = t.x + t.w / 2;
    const dx = cx - p.x;
    p.inp = { x: Math.abs(dx) < 20 ? 0 : Math.sign(dx), y: 0 };
    // Sauter quand on est presque sous la plateforme visée (ou sur une fragile qui va céder)
    const close = Math.abs(dx) < t.w / 2 + 140;
    // Le bot garde A enfoncé un moment pour faire un grand saut
    if (p.botT > 0 && p.a && !p.on) return;
    if (p.on && close && Math.random() < 0.25 + ctx.botSkill * 0.3) {
      p.a = !p.lastA;
    } else if (p.on) p.a = false;
    if (Math.random() < dt * 0.25 * ctx.botSkill && live().some((o) => o !== p && Math.abs(o.x - p.x) < 110 && Math.abs(o.y - p.y) < 80)) shove(p);
  };

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const p = ps.find((x) => x.pid === pid);
      if (!p) return;
      p.inp = { x: m.x ?? 0, y: m.y ?? 0 };
      p.a = !!m.a;
      p.b = !!m.b;
    },
    update(dt) {
      time += dt;
      // La mer monte, et de plus en plus vite
      water -= speed() * dt;
      if (!warned && time > 30) {
        warned = true;
        speak(fr ? 'Attention, la vague accélère !' : 'Watch out, the wave is speeding up!', ctx.lang);
      }
      // Caméra : la mer reste en bas de l'écran ; si quelqu'un grimpe très vite, on remonte un peu (sans perdre les derniers)
      const leaders = live().map((p) => p.y);
      const topP = leaders.length ? Math.min(...leaders) : water;
      const want = Math.min(water - WATER_SCREEN, Math.max(topP - 260, water - VIEW + 40));
      camY += (want - camY) * Math.min(1, dt * 3);
      // Toujours des étages d'avance au-dessus, et on oublie ceux engloutis
      while (top > camY - 1600) grow();
      for (let i = plats.length - 1; i >= 0; i--) if (plats[i].y > water + 300) plats.splice(i, 1);
      // Plateformes : mouvement, fragiles qui tombent 0,7 s après qu'on a marché dessus
      for (const q of plats) {
        if (q.kind === 'mover') q.x = q.bx + Math.sin(time * 1.3 + q.ph) * q.amp;
        if (q.kind === 'fragile' && q.touched >= 0 && time - q.touched > 0.7) q.gone = true;
      }
      for (const p of ps) {
        if (!p.alive) continue;
        if (p.pop && (p.pop.t -= dt) <= 0) p.pop = null;
        if (p.sink > 0) {
          // Englouti : on coule doucement puis on est éliminé
          p.sink += dt;
          p.y = water + p.sink * 60;
          if (p.sink > 1.3) {
            p.alive = false;
            p.out = ++outCount;
          }
          continue;
        }
        if (p.bot) bot(p, dt);
        p.cd = Math.max(0, p.cd - dt);
        p.stun = Math.max(0, p.stun - dt);
        if (p.b && !p.lastB) shove(p);
        p.lastB = p.b;
        const ix = p.stun > 0 ? 0 : Math.abs(p.inp.x) > 0.25 ? Math.sign(p.inp.x) * Math.min(1, Math.abs(p.inp.x) * 1.3) : 0;
        const k = Math.min(1, dt * (p.on ? 12 : 5));
        p.vx += (ix * RUN - p.vx) * k;
        if (ix) p.dir = ix > 0 ? 1 : -1;
        if (p.a && !p.lastA && p.on && p.stun <= 0) jump(p);
        p.lastA = p.a;
        // Saut plus court si on lâche A tôt
        if (!p.a && p.vy < -400) p.vy += GRAV * dt;
        // Emporté par la plateforme mobile
        if (p.on && p.on.kind === 'mover') p.x += Math.cos(time * 1.3 + p.on.ph) * 1.3 * p.on.amp * dt;
        p.vy += GRAV * dt;
        const oldY = p.y;
        p.x = Math.max(LEFT + BODY_W, Math.min(RIGHT - BODY_W, p.x + p.vx * dt));
        p.y += p.vy * dt;
        // Plafond : on ne sort pas de l'écran par le haut
        if (p.y - 110 < camY + 40) {
          p.y = camY + 150;
          p.vy = Math.max(0, p.vy);
        }
        p.on = null;
        if (p.vy >= 0) {
          for (const q of plats) {
            if (q.gone) continue;
            if (p.x > q.x - 8 && p.x < q.x + q.w + 8 && oldY <= q.y + 2 && p.y >= q.y) {
              p.y = q.y;
              if (q.kind === 'bounce') {
                jump(p, 1.45);
                p.pop = { text: 'BOING !', t: 0.6, c: SOLEIL };
                break;
              }
              p.vy = 0;
              p.on = q;
              if (q.kind === 'fragile' && q.touched < 0) q.touched = time;
              break;
            }
          }
        }
        p.best = Math.min(p.best, p.y);
        // Touché par la vague
        if (p.y > water - 10) {
          p.sink = 0.001;
          p.pop = { text: ctx.family ? (fr ? 'PLOUF !' : 'SPLASH!') : fr ? 'GLOUB GLOUB !' : 'GLUG GLUG!', t: 1.2, c: '#2ec5ff' };
          sfx.pet();
          if (!p.bot) ctx.buzz(p.pid, 500);
          for (let k2 = 0; k2 < 14; k2++) foam.push({ x: p.x + rnd(-50, 50), y: water, vy: rnd(-500, -200), t: 1 });
        }
      }
      for (const f of foam) {
        f.vy += 1500 * dt;
        f.y += f.vy * dt;
        f.t -= dt;
      }
      for (let i = foam.length - 1; i >= 0; i--) if (foam[i].t <= 0) foam.splice(i, 1);
      if (alive().length <= (ps.length > 1 ? 1 : 0)) game.over = true;
    },
    render(g, t) {
      // Ciel qui change avec la hauteur
      const hgt = camY + VIEW / 2;
      let a = SKIES[0];
      let b = SKIES[0];
      for (let i = 0; i < SKIES.length - 1; i++)
        if (hgt <= SKIES[i][0]) {
          a = SKIES[i];
          b = SKIES[i + 1];
        }
      const k = a === b ? 0 : Math.min(1, Math.max(0, (a[0] - hgt) / (a[0] - b[0])));
      const mix = (c1: string, c2: string) => {
        const h = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
        const x = h(c1);
        const y = h(c2);
        return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
      };
      const sky = g.createLinearGradient(0, 0, 0, 1080);
      sky.addColorStop(0, mix(a[1], b[1]));
      sky.addColorStop(1, mix(a[2], b[2]));
      g.fillStyle = sky;
      g.fillRect(0, 0, 1920, 1080);
      // Étoiles quand on monte haut, nuages en dessous (défilement lent)
      if (!ctx.light) {
        const space = Math.min(1, Math.max(0, (-hgt - 6000) / 3000));
        g.fillStyle = `rgba(255,255,255,${0.2 + space * 0.7})`;
        for (let i = 0; i < 50; i++) g.fillRect((i * 389) % 1920, (((i * 271 - camY * 0.2) % 1080) + 1080) % 1080, 3, 3);
        g.fillStyle = `rgba(255,255,255,${0.7 * (1 - space)})`;
        for (let i = 0; i < 6; i++) {
          const cy = (((i * 420 - camY * 0.45) % 1500) + 1500) % 1500 - 200;
          const cx = (i * 613) % 1700 + 100;
          g.beginPath();
          g.ellipse(cx, cy, 120, 40, 0, 0, Math.PI * 2);
          g.ellipse(cx + 70, cy - 20, 80, 36, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.save();
      g.translate(0, -camY);
      // Murs de la tour
      g.fillStyle = 'rgba(58,33,64,0.18)';
      g.fillRect(LEFT - 40, camY, 40, VIEW);
      g.fillRect(RIGHT, camY, 40, VIEW);
      // Plateformes
      for (const q of plats) {
        if (q.gone || q.y < camY - 50 || q.y > camY + VIEW + 50) continue;
        const shake = q.kind === 'fragile' && q.touched >= 0 ? rnd(-3, 3) : 0;
        const col = q.kind === 'fragile' ? '#e0b48a' : q.kind === 'mover' ? '#9b5cff' : q.kind === 'bounce' ? SOLEIL : '#ff9cc8';
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(q.x + shake, q.y + 8, q.w, 34, 14);
        g.fill();
        g.fillStyle = col;
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.roundRect(q.x + shake, q.y, q.w, 34, 14);
        g.fill();
        g.stroke();
        candy(g, q.x + shake, q.y, q.w, 34, 14);
        if (q.kind === 'fragile') {
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(q.x + q.w * 0.3, q.y + 4);
          g.lineTo(q.x + q.w * 0.4, q.y + 18);
          g.lineTo(q.x + q.w * 0.33, q.y + 30);
          g.moveTo(q.x + q.w * 0.7, q.y + 4);
          g.lineTo(q.x + q.w * 0.62, q.y + 20);
          g.stroke();
        }
        if (q.kind === 'bounce') {
          g.font = '700 28px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.fillStyle = INK;
          g.fillText('⤒', q.x + q.w / 2, q.y + 28);
        }
      }
      // Joueurs
      ps.forEach((p, i) => {
        if (!p.alive) return;
        g.save();
        if (p.sink > 0) {
          g.beginPath();
          g.rect(p.x - 120, camY, 240, water - camY);
          g.clip();
        }
        drawCharacter(g, p.x, p.y, 96, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          dir: p.dir,
          run: p.on && Math.abs(p.vx) > 60 ? 1 : 0,
          mood: p.sink > 0 ? 'sad' : p.stun > 0 || !p.on ? 'wow' : 'happy',
        });
        g.restore();
        if (p.sink <= 0) playerTag(g, p.x, p.y - 112, p.profile.name, p.profile.color);
        if (p.pop) {
          g.font = '700 38px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.lineWidth = 8;
          g.strokeStyle = INK;
          const y = p.y - 160 - (1.2 - p.pop.t) * 30;
          g.strokeText(p.pop.text, p.x, y);
          g.fillStyle = p.pop.c;
          g.fillText(p.pop.text, p.x, y);
        }
      });
      // La mer de sirop bleu : vagues, écume, poissons
      g.fillStyle = '#2ec5ff';
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(-10, water + 400);
      for (let x = -10; x <= 1930; x += 30) g.lineTo(x, water + Math.sin(x / 80 + t * 3) * 14 + Math.sin(x / 33 - t * 5) * 5);
      g.lineTo(1930, water + 400);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#1e8fc0';
      g.fillRect(0, water + 60, 1920, 400);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let x = 0; x < 1920; x += 90) {
        g.beginPath();
        g.arc(x + ((t * 60) % 90), water + Math.sin(x / 80 + t * 3) * 14 - 4, 10, 0, Math.PI * 2);
        g.fill();
      }
      for (const f of foam) {
        g.globalAlpha = f.t;
        g.beginPath();
        g.arc(f.x, f.y, 9, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
      // Hauteur atteinte + vitesse de la vague
      const best = Math.max(0, Math.round((900 - Math.min(...ps.map((p) => p.best))) / 100));
      g.font = '700 34px Fredoka, sans-serif';
      g.textAlign = 'left';
      g.lineWidth = 7;
      g.strokeStyle = INK;
      g.fillStyle = '#fff';
      const txt = fr ? `🏔️ ${best} m · 🌊 ${Math.round(speed())} km/h` : `🏔️ ${best} m · 🌊 ${Math.round(speed())} km/h`;
      g.strokeText(txt, 40, 1050);
      g.fillText(txt, 40, 1050);
      if (time < 3) {
        g.font = '700 70px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.strokeText(fr ? '🌊 GRIMPE ! La vague arrive !' : '🌊 CLIMB! The wave is coming!', 960, 200);
        g.fillStyle = SOLEIL;
        g.fillText(fr ? '🌊 GRIMPE ! La vague arrive !' : '🌊 CLIMB! The wave is coming!', 960, 200);
      }
    },
    out: (pid) => !!ps.find((p) => p.pid === pid && !p.alive),
    ranking: () => [...ps].sort((a, b) => Number(b.alive) - Number(a.alive) || b.out - a.out || a.best - b.best).map((p) => p.pid),
    leader() {
      const a = alive();
      return a.length === 1 ? a[0].profile.name : null;
    },
  };
  return game;
}

export const mareeGame: GameBase = {
  id: 'maree',
  emoji: '🌊',
  name: { fr: 'Raz-de-marée', en: 'Tidal Wave' },
  how: {
    fr: 'La mer monte ! Grimpe de plateforme en plateforme sans te faire rattraper · A = sauter · B = pousser',
    en: 'The sea is rising! Climb from platform to platform before it catches you · A = jump · B = shove',
  },
  inspired: 'Jeux d’escalade à la Roblox',
  layout: 'stick',
  min: 2,
  max: 12,
  botFill: 4,
  music: 'race',
  limit: 150,
  create,
};
