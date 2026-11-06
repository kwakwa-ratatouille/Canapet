// Crie Plus Fort : un parcours de plateformes qu'on traverse à la voix. Parler = marcher, crier = sauter ;
// plus c'est fort, plus on va vite et plus on saute haut. Crier à fond tout le temps ne suffit pas :
// on se prend les pics du plafond et on rate les petites plateformes. 3 vies, dernier debout gagnant.
// Seul un chiffre de volume quitte le téléphone : le son lui-même n'est ni envoyé ni gardé.
import { drawCharacter } from '../shared/characters';
import { INK } from '../shared/palette';
import { playMusic, sfx, speak, type MusicId } from '../shared/sound';
import { candy, playerTag } from './draw';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

export interface ShoutPadData {
  phase: 'go' | 'end';
  lives: number;
  out: boolean;
  rank: number;
  of: number;
  /** Secondes avant que l'écran se mette à avancer. */
  wait: number;
}

/** À partir de ce volume, on saute (affiché sur la jauge du téléphone). */
export const JUMP_AT = 0.38;
const LIVES = 3;
const GRAV = 2400;
const GRACE = 8;
/** Le premier ne peut pas s'enfuir : l'écran le rattrape à cette vitesse au plus, et il est freiné près du bord droit. */
const CAM_MAX = 320;
const LEAD_X = 1200;

const speedOf = (h: number) => (h < 0.08 ? 0 : 70 + 310 * h);
const jumpOf = (h: number) => 560 + 560 * h;

interface Plat {
  x: number;
  y: number;
  w: number;
  /** Pic au sol : position dans le monde. */
  floor?: number;
  /** Pics au plafond : début et largeur. */
  ceil?: [number, number];
  tint: number;
}
interface Pl extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  on: boolean;
  /** Temps depuis le saut : on peut encore le grandir en criant plus fort. */
  rise: number;
  level: number;
  heard: number;
  lives: number;
  alive: boolean;
  outAt: number;
  best: number;
  safe: number;
  hover: number;
  hurt: number;
  botPlan: number;
  botLevel: number;
  botT: number;
  botAim: number;
  land: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const TINTS = ['#ff8fc0', '#8fd8ff', '#ffd76a', '#a8e88a', '#c9a6ff'];

function createShout(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const size = runners.length > 8 ? 66 : 82;
  const pls: Pl[] = runners.map((r, i) => ({ ...r, x: 180 + i * 34, y: 820, vx: 0, vy: 0, on: true, rise: 9, level: 0, heard: 0, lives: LIVES, alive: true, outAt: 0, best: 0, safe: 0, hover: 0, hurt: 0, botPlan: Math.random(), botLevel: 0, botT: 0, botAim: 0, land: 0 }));
  const plats: Plat[] = [{ x: -400, y: 820, w: 1100 + runners.length * 34, tint: 0 }];
  let cam = 0;
  let camV = 0;
  let clock = 0;
  let phase: ShoutPadData['phase'] = 'go';
  let endT = 0;
  let started = false;
  let deaths = 0;
  let lastLives = '';

  /** Fabrique le parcours au fur et à mesure : de plus en plus d'écarts et de pics. */
  const grow = () => {
    while (plats[plats.length - 1].x + plats[plats.length - 1].w < cam + 2600) {
      const prev = plats[plats.length - 1];
      const d = Math.min(1, prev.x / 9000);
      let gap = prev.x < 2500 ? rnd(60, 130) : rnd(80 + d * 40, 150 + d * 110);
      const dy = rnd(-110, 110);
      const y = Math.max(600, Math.min(900, prev.y + dy));
      // Plus haut que la précédente : un peu plus près, pour que ce soit toujours faisable
      if (y < prev.y - 50) gap *= 0.75;
      const wide = prev.x > 2600 && Math.random() < 0.22;
      const w = wide ? rnd(380, 440) : prev.x < 2500 ? rnd(190, 300) : rnd(170 - d * 60, 260 - d * 80);
      const x = prev.x + prev.w + gap;
      const p: Plat = { x, y, w, tint: plats.length % TINTS.length };
      if (wide) {
        if (x > 3600 && Math.random() < 0.5) p.ceil = [x + w * 0.32, w * 0.36];
        else p.floor = x + w * rnd(0.45, 0.55);
      }
      plats.push(p);
    }
    while (plats.length > 2 && plats[0].x + plats[0].w < cam - 300) plats.shift();
  };
  grow();

  const order = () => [...pls].sort((a, b) => Number(b.alive) - Number(a.alive) || b.lives - a.lives || b.outAt - a.outAt || b.best - a.best);

  const lose = (p: Pl) => {
    if (p.safe > 0 && p.y < 1100) return;
    p.lives--;
    p.hurt = 1;
    ctx.buzz(p.pid, 300);
    sfx.whoosh();
    if (p.lives <= 0) {
      p.alive = false;
      p.outAt = ++deaths;
      ctx.refresh();
      return;
    }
    // Retour sur la plateforme la plus proche, un peu en avant du bord gauche
    const aim = cam + 420;
    const best = plats.reduce((a, b) => (Math.abs(b.x + b.w / 2 - aim) < Math.abs(a.x + a.w / 2 - aim) ? b : a), plats[0]);
    p.x = Math.max(cam + 200, Math.min(best.x + best.w - 40, Math.max(best.x + 40, aim)));
    p.y = best.y - 150;
    p.vx = 0;
    p.vy = 0;
    p.on = false;
    p.rise = 9;
    p.hover = 0.7;
    p.safe = 2.5;
    ctx.refresh();
  };

  /** Bots : ils marchent, puis crient juste ce qu'il faut pour viser la plateforme suivante, avec une part d'erreur. */
  const bot = (p: Pl, dt: number) => {
    p.botT -= dt;
    if (!p.on) {
      const q = plats[p.botAim];
      const over = q && p.x >= q.x + q.w * 0.3 && p.x <= q.x + q.w;
      p.level = over && p.vy > 0 ? 0 : p.botLevel;
      return;
    }
    if (p.botT > 0) {
      p.level = p.botLevel;
      return;
    }
    p.botLevel = 0.2;
    const i = plats.findIndex((q) => p.x >= q.x - 18 && p.x <= q.x + q.w + 18 && Math.abs(q.y - p.y) < 4);
    const here = plats[i];
    if (here) {
      const next = plats[i + 1];
      if (here.floor !== undefined && here.floor - p.x > 0 && here.floor - p.x < 60) {
        p.botAim = i;
        p.botLevel = 0.6;
        p.botT = 0.25;
      } else if (next && here.x + here.w - p.x < 26 && !(here.ceil && p.x < here.ceil[0] + here.ceil[1])) {
        // Le cri dont la portée tombe au milieu de la plateforme visée
        const dist = next.x + next.w * (next.ceil || next.floor !== undefined ? 0.15 : 0.5) - p.x;
        const up = Math.max(0, here.y - next.y);
        let h = JUMP_AT;
        while (h < 1 && (speedOf(h) * (2 * jumpOf(h)) / GRAV < dist || (jumpOf(h) * jumpOf(h)) / (2 * GRAV) < up + 30)) h += 0.03;
        h += (1 - ctx.botSkill) * rnd(-0.08, 0.1);
        // Un cri raté de temps en temps, et de plus en plus quand ça accélère
        if (Math.random() < 0.01 + (1 - ctx.botSkill) * 0.12 + Math.min(0.05, clock / 2500)) h += rnd(-0.25, 0.25);
        p.botLevel = Math.max(JUMP_AT, Math.min(1, h));
        p.botAim = i + 1;
        p.botT = 0.3;
      }
    }
    p.level = p.botLevel;
  };

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const p = pls.find((x) => x.pid === pid);
      if (!p) return;
      if (m.a === 'vol') p.level = Math.max(0, Math.min(1, (m.n?.[0] ?? 0) / 100));
      // Sans micro : on tape comme un fou, ça vaut un cri moyen (moins bien qu'un vrai cri)
      if (m.a === 'tap') p.heard = Math.max(p.heard, 0.55);
    },
    update(dt) {
      if (!started) {
        started = true;
        playMusic('');
        speak(fr ? 'Parlez pour marcher, criez pour sauter !' : 'Talk to walk, shout to jump!', ctx.lang);
        ctx.refresh();
      }
      clock += dt;
      if (phase === 'end') {
        endT -= dt;
        if (endT <= 0) game.over = true;
        return;
      }
      const alive = pls.filter((p) => p.alive);
      const lead = alive.reduce((m, p) => Math.max(m, p.x), 0);
      // L'écran avance doucement, puis de plus en plus ; il court après le premier sans jamais le laisser filer
      const base = clock > GRACE ? 45 + 85 * Math.min(1, (clock - GRACE) / 110) : 0;
      const want = Math.min(CAM_MAX, base + Math.max(0, lead - cam - LEAD_X) * 2);
      camV += (want - camV) * Math.min(1, dt * 3);
      cam += camV * dt;
      grow();
      for (const p of pls) {
        if (p.bot && p.alive) bot(p, dt);
        p.heard = Math.max(p.level, p.heard - dt * 5);
        if (!p.alive) continue;
        p.safe = Math.max(0, p.safe - dt);
        p.hurt = Math.max(0, p.hurt - dt);
        if (p.hover > 0) {
          p.hover -= dt;
          continue;
        }
        const h = clock < 0.2 ? 0 : p.heard;
        // Parler fait avancer ; se taire freine, même en l'air : c'est comme ça qu'on se pose où on veut
        // Près du bord droit, on est freiné : impossible de s'enfuir devant tout le monde
        const target = Math.min(speedOf(h), Math.max(0, camV + (cam + 1800 - p.x) * 0.5));
        const acc = p.on ? 1500 : 800;
        p.vx += Math.sign(target - p.vx) * Math.min(Math.abs(target - p.vx), acc * dt);
        p.land = Math.max(0, p.land - dt);
        if (p.on && h >= JUMP_AT && p.land <= 0) {
          p.on = false;
          p.rise = 0;
          p.vy = -jumpOf(h);
          sfx.boing();
        }
        // Le saut grandit si le cri monte juste après le départ
        if (!p.on && p.rise < 0.2) p.vy = Math.min(p.vy, -jumpOf(h) + p.rise * GRAV);
        p.rise += dt;
        const py = p.y;
        p.x += p.vx * dt;
        p.best = Math.max(p.best, p.x);
        if (!p.on) {
          p.vy += GRAV * dt;
          p.y += p.vy * dt;
          if (p.vy >= 0)
            for (const q of plats)
              if (p.x >= q.x - 18 && p.x <= q.x + q.w + 18 && py <= q.y + 1 && p.y >= q.y) {
                p.y = q.y;
                p.vy = 0;
                p.on = true;
                p.land = 0.18;
                sfx.step();
                break;
              }
        } else if (!plats.some((q) => Math.abs(q.y - p.y) < 2 && p.x >= q.x - 18 && p.x <= q.x + q.w + 18)) {
          p.on = false;
          p.rise = 9;
          p.vy = 0;
        }
        if (p.safe <= 0)
          for (const q of plats) {
            if (q.floor !== undefined && Math.abs(p.x - q.floor) < 24 && p.y > q.y - 38 && p.y <= q.y + 2) lose(p);
            else if (q.ceil && p.x > q.ceil[0] - 14 && p.x < q.ceil[0] + q.ceil[1] + 14 && p.y - size * 0.95 < q.y - 240 && p.y > q.y - 420) lose(p);
            if (p.safe > 0 || !p.alive) break;
          }
        if (!p.alive) continue;
        if (p.y > 1180) {
          p.safe = 0;
          lose(p);
        } else if (p.x < cam - 40) {
          p.safe = 0;
          lose(p);
        }
      }
      const sum = pls.map((p) => p.lives).join();
      if (sum !== lastLives) {
        lastLives = sum;
        ctx.refresh();
      }
      const left = pls.filter((p) => p.alive);
      const humans = pls.filter((p) => !p.bot);
      if (left.length <= 1 || (humans.length > 0 && !humans.some((p) => p.alive))) {
        phase = 'end';
        endT = 3.2;
        sfx.win();
        if (left.length === 1) speak(fr ? `${left[0].profile.name} a la plus grande gueule !` : `${left[0].profile.name} has the biggest mouth!`, ctx.lang);
        ctx.refresh();
      }
    },
    render(g, t) {
      const sky = g.createLinearGradient(0, 0, 0, 1080);
      sky.addColorStop(0, '#6fd0ff');
      sky.addColorStop(1, '#fff0c9');
      g.fillStyle = sky;
      g.fillRect(0, 0, 1920, 1080);
      // Nuages et collines lointaines, qui défilent moins vite
      g.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 6; i++) {
        const x = ((i * 410 - cam * 0.2) % 2200 + 2200) % 2200 - 140;
        const y = 150 + (i % 3) * 70;
        g.beginPath();
        g.arc(x, y, 44, 0, 7);
        g.arc(x + 54, y - 16, 56, 0, 7);
        g.arc(x + 112, y, 42, 0, 7);
        g.fill();
      }
      g.fillStyle = '#b9e6a8';
      for (let i = 0; i < 5; i++) {
        const x = ((i * 520 - cam * 0.45) % 2600 + 2600) % 2600 - 340;
        g.beginPath();
        g.arc(x, 1120, 340, Math.PI, 0);
        g.fill();
      }
      // Le vide : du sirop en bas de l'écran
      g.fillStyle = '#ff5f8f';
      g.beginPath();
      g.moveTo(0, 1080);
      for (let x = 0; x <= 1920; x += 60) g.lineTo(x, 1040 + Math.sin(x / 90 + t * 2.4) * 10);
      g.lineTo(1920, 1080);
      g.closePath();
      g.fill();

      g.save();
      g.translate(-cam, 0);
      for (const q of plats) {
        if (q.x > cam + 1960 || q.x + q.w < cam - 40) continue;
        g.fillStyle = TINTS[q.tint];
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(q.x, q.y, q.w, 46, 22);
        g.fill();
        g.stroke();
        candy(g, q.x, q.y, q.w, 46, 22);
        g.fillStyle = '#ff3b5c';
        if (q.floor !== undefined) {
          g.beginPath();
          g.moveTo(q.floor - 34, q.y + 2);
          g.lineTo(q.floor - 17, q.y - 44);
          g.lineTo(q.floor, q.y + 2);
          g.lineTo(q.floor + 17, q.y - 44);
          g.lineTo(q.floor + 34, q.y + 2);
          g.closePath();
          g.fill();
          g.stroke();
        }
        if (q.ceil) {
          const [cx, cw] = q.ceil;
          const by = q.y - 240;
          const n = Math.max(3, Math.round(cw / 44));
          g.fillStyle = '#6b4a7a';
          g.beginPath();
          g.roundRect(cx, by - 74, cw, 40, 14);
          g.fill();
          g.stroke();
          g.fillStyle = '#ff3b5c';
          g.beginPath();
          g.moveTo(cx, by - 36);
          for (let i = 0; i < n; i++) {
            g.lineTo(cx + ((i + 0.5) * cw) / n, by);
            g.lineTo(cx + ((i + 1) * cw) / n, by - 36);
          }
          g.closePath();
          g.fill();
          g.stroke();
        }
      }
      pls.forEach((p, i) => {
        if (!p.alive) return;
        if (p.safe > 0 && Math.sin(t * 30) > 0.2) return;
        drawCharacter(g, p.x, p.y, size, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          run: p.on ? p.heard : 0,
          mood: p.hurt > 0 ? 'sad' : p.heard > JUMP_AT ? 'wow' : 'happy',
        });
        const tagY = p.y - size * 1.5;
        playerTag(g, p.x, tagY, p.profile.name, p.profile.color);
        // Le cri qui sort de la bouche, et sa force
        if (p.heard > JUMP_AT) {
          g.fillStyle = '#fff';
          g.strokeStyle = INK;
          g.lineWidth = 6;
          g.font = `700 ${Math.round(28 + p.heard * 26)}px Fredoka, sans-serif`;
          g.textAlign = 'left';
          g.textBaseline = 'middle';
          const word = 'A'.repeat(1 + Math.round(p.heard * 3)) + 'H !';
          g.strokeText(word, p.x + size * 0.42, p.y - size * 0.8);
          g.fillText(word, p.x + size * 0.42, p.y - size * 0.8);
        }
      });
      g.restore();

      // Bord gauche dangereux une fois que l'écran avance
      if (clock > GRACE) {
        g.fillStyle = 'rgba(255,59,92,.28)';
        g.fillRect(0, 0, 26, 1080);
      }

      // Les vies de chacun, en haut
      const n = pls.length;
      const w = Math.min(300, 1880 / n);
      pls.forEach((p, i) => {
        const x = (1920 - n * w) / 2 + i * w;
        g.globalAlpha = p.alive ? 1 : 0.45;
        g.fillStyle = p.profile.color;
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.roundRect(x + 5, 14, w - 10, 76, 18);
        g.fill();
        g.stroke();
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = INK;
        g.font = '700 28px Fredoka, sans-serif';
        g.fillText(p.profile.name.slice(0, w < 200 ? 7 : 12), x + w / 2, 36, w - 24);
        g.fillStyle = '#fff';
        const r = 11;
        for (let k = 0; k < LIVES; k++) {
          const hx = x + w / 2 + (k - 1) * 30;
          g.globalAlpha = (p.alive ? 1 : 0.45) * (k < p.lives ? 1 : 0.25);
          g.beginPath();
          g.arc(hx - r / 2, 66, r / 1.6, Math.PI, 0);
          g.arc(hx + r / 2, 66, r / 1.6, Math.PI, 0);
          g.lineTo(hx, 66 + r);
          g.closePath();
          g.fill();
        }
        g.globalAlpha = 1;
      });

      if (clock < GRACE) {
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 10;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '700 64px Fredoka, sans-serif';
        const a = fr ? 'Parle = tu marches · Crie = tu sautes' : 'Talk = walk · Shout = jump';
        const b = fr ? `🎙️ Active ton micro ! ${Math.ceil(GRACE - clock)}` : `🎙️ Turn on your mic! ${Math.ceil(GRACE - clock)}`;
        g.strokeText(a, 960, 240);
        g.fillText(a, 960, 240);
        g.strokeText(b, 960, 330);
        g.fillText(b, 960, 330);
      }
    },
    ranking: () => order().map((p) => p.pid),
    out: (pid) => !pls.find((x) => x.pid === pid)?.alive,
    leader: () => (phase === 'end' ? order()[0]?.profile.name ?? null : null),
    padData(pid): ShoutPadData {
      const o = order();
      const p = pls.find((x) => x.pid === pid)!;
      return { phase, lives: p.lives, out: !p.alive, rank: o.indexOf(p) + 1, of: o.length, wait: Math.ceil(Math.max(0, GRACE - clock)) };
    },
  };
  return game;
}

export const shout: GameBase = {
  id: 'cri',
  emoji: '📣',
  name: { fr: 'Crie Plus Fort', en: 'Shout Louder' },
  how: { fr: 'Parle pour marcher, crie pour sauter : plus c’est fort, plus tu vas vite et haut. 3 vies, attention aux trous et aux pics !', en: 'Talk to walk, shout to jump: the louder, the faster and higher. 3 lives, watch out for pits and spikes!' },
  layout: 'buttons',
  min: 2,
  max: 12,
  botFill: 3,
  music: '' as MusicId,
  limit: 150,
  create: createShout,
};
