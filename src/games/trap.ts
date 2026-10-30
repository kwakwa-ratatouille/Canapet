// La Trappe : une question, deux réponses (gauche ou droite). Au STOP, la trappe s'ouvre sous le mauvais côté
// et ceux qui s'y trouvent tombent. Le dernier debout gagne. B = pousser un voisin du mauvais côté.
import { dozing } from './botSkill';
import { drawCharacter } from '../shared/characters';
import { CIEL, INK, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { candy, roundRectText } from './draw';
import { TRAP_QUESTIONS, type TrapQ } from './trapQuestions';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

// Plateau (repère télé 1920 × 1080) : moitié gauche = réponse A, moitié droite = réponse B
const X0 = 150;
const X1 = 1770;
const Y0 = 470;
const Y1 = 1010;
const MID = 960;
const BODY = 30;
const SIDES = [
  { c: ROSE, dark: '#c92f74', light: '#ff9cc8', key: 'A' },
  { c: CIEL, dark: '#1e8fc0', light: '#9fe2ff', key: 'B' },
];

type Phase = 'ask' | 'stop' | 'open' | 'after';

interface P extends Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  inp: { x: number; y: number };
  b: boolean;
  lastB: boolean;
  alive: boolean;
  /** Ordre d'élimination (plus grand = tombé plus tard). */
  out: number;
  /** Chute en cours : 0 → 1. */
  fall: number;
  good: number;
  dir: 1 | -1;
  stun: number;
  cd: number;
  botT: number;
  tx: number;
  ty: number;
  pop: { text: string; t: number; c: string } | null;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const side = (p: { x: number }) => (p.x < MID ? 0 : 1);

function trap(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const L = ctx.lang;
  const n = Math.min(12, runners.length);
  const ps: P[] = runners.slice(0, 12).map((r, i) => ({
    ...r,
    x: MID + (i % 2 ? 1 : -1) * rnd(60, 160),
    y: Y0 + 60 + ((i * 97) % (Y1 - Y0 - 120)),
    vx: 0,
    vy: 0,
    inp: { x: 0, y: 0 },
    b: false,
    lastB: false,
    alive: true,
    out: 0,
    fall: 0,
    good: 0,
    dir: i % 2 ? -1 : 1,
    stun: 0,
    cd: 0,
    botT: rnd(1, 3),
    tx: MID,
    ty: Y0 + 200,
    pop: null,
  }));
  const pool: TrapQ[] = TRAP_QUESTIONS.filter((q) => !(ctx.family && q.fam === false)).sort(() => Math.random() - 0.5);
  const MAX_ROUNDS = Math.min(12, pool.length);
  let round = -1;
  let q: TrapQ = pool[0];
  let phase: Phase = 'after';
  let pt = 1.2; // temps restant dans la phase
  let askLen = 9;
  let outCount = 0;
  let wrong = 0; // côté qui s'ouvre
  let saved = false; // tout le monde s'est trompé : personne ne tombe
  let banner: { text: string; t: number; c: string } | null = null;
  const confetti: { x: number; y: number; vx: number; vy: number; c: string; t: number }[] = [];
  const alive = () => ps.filter((p) => p.alive);

  const nextQuestion = () => {
    round++;
    if (round >= MAX_ROUNDS || alive().length <= (ps.length > 1 ? 1 : 0)) {
      game.over = true;
      return;
    }
    q = pool[round];
    // Les questions vont de plus en plus vite
    askLen = Math.max(5.5, 9.5 - round * 0.4);
    phase = 'ask';
    pt = askLen;
    saved = false;
    speak(q.q[L], L);
    sfx.go();
    for (const p of ps) if (p.bot) p.botT = rnd(0.8, askLen * 0.6);
  };

  const shove = (p: P) => {
    if (p.cd > 0 || p.stun > 0 || !p.alive) return;
    p.cd = 1.4;
    if (!p.bot) ctx.cool(p.pid, 'b', 1.4);
    sfx.whoosh();
    for (const o of ps) {
      if (o === p || !o.alive) continue;
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 130 && d > 0) {
        o.vx += (dx / d) * 950;
        o.vy += (dy / d) * 950;
        o.stun = 0.4;
        o.pop = { text: fr ? 'HOP !' : 'SHOVE!', t: 0.6, c: '#fff' };
        if (!o.bot) ctx.buzz(o.pid, 120);
      }
    }
  };

  const botThink = (p: P, dt: number) => {
    if (phase !== 'ask') {
      p.inp = { x: 0, y: 0 };
      return;
    }
    if ((p.botT -= dt) <= 0) {
      p.botT = rnd(1.5, 3.5);
      // Bon côté plus souvent selon le niveau ; parfois il suit la foule
      const crowd = alive().filter((o) => o !== p);
      const leftCount = crowd.filter((o) => side(o) === 0).length;
      const follow = crowd.length && Math.random() < 0.25 ? (leftCount * 2 >= crowd.length ? 0 : 1) : null;
      const pick = follow ?? (Math.random() < 0.5 + 0.38 * ctx.botSkill ? q.ok : 1 - q.ok);
      p.tx = pick === 0 ? rnd(X0 + 80, MID - 90) : rnd(MID + 90, X1 - 80);
      p.ty = rnd(Y0 + 60, Y1 - 40);
    }
    if (dozing(p, ctx.botSkill, dt)) {
      p.inp = { x: 0, y: 0 };
      return;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    p.inp = d < 14 ? { x: 0, y: 0 } : { x: dx / d, y: dy / d };
    // Un bot pousse parfois un humain voisin
    if (Math.random() < dt * 0.3 * ctx.botSkill && ps.some((o) => o !== p && o.alive && Math.hypot(o.x - p.x, o.y - p.y) < 110)) shove(p);
  };

  const move = (dt: number) => {
    const frozen = phase !== 'ask';
    for (const p of ps) {
      if (!p.alive) continue;
      p.cd = Math.max(0, p.cd - dt);
      p.stun = Math.max(0, p.stun - dt);
      if (p.pop && (p.pop.t -= dt) <= 0) p.pop = null;
      let ix = frozen || p.stun > 0 ? 0 : p.inp.x;
      let iy = frozen || p.stun > 0 ? 0 : p.inp.y;
      const m = Math.hypot(ix, iy);
      if (m > 1) {
        ix /= m;
        iy /= m;
      }
      if (m < 0.2) ix = iy = 0;
      const k = Math.min(1, dt * (frozen ? 4 : 9));
      p.vx += (ix * 430 - p.vx) * k;
      p.vy += (iy * 430 - p.vy) * k;
      p.x = Math.max(X0 + BODY, Math.min(X1 - BODY, p.x + p.vx * dt));
      p.y = Math.max(Y0 + BODY, Math.min(Y1 - 6, p.y + p.vy * dt));
      if (Math.abs(p.vx) > 20) p.dir = p.vx > 0 ? 1 : -1;
    }
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        if (!a.alive || !b.alive) continue;
        const dx = b.x - a.x;
        const dy = (b.y - a.y) * 1.4;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < BODY * 2) {
          const o = (BODY * 2 - d) / 2;
          a.x -= (dx / d) * o;
          a.y -= (dy / d) * o * 0.7;
          b.x += (dx / d) * o;
          b.y += (dy / d) * o * 0.7;
        }
      }
  };

  const openTrap = () => {
    wrong = 1 - q.ok;
    const victims = alive().filter((p) => side(p) === wrong);
    // Tout le monde s'est trompé : on repêche tout le monde (sinon il n'y aurait plus de partie)
    saved = victims.length === alive().length;
    for (const p of alive()) {
      if (side(p) === q.ok) {
        p.good++;
        p.pop = { text: '✓', t: 1.2, c: '#7bd13b' };
      }
    }
    if (saved) {
      banner = { text: fr ? 'Tout le monde s’est trompé… repêchés !' : 'Everyone was wrong… saved!', t: 2.4, c: SOLEIL };
      sfx.boing();
      return;
    }
    sfx.boom();
    for (const p of victims) {
      p.fall = 0.001;
      if (!p.bot) ctx.buzz(p.pid, 500);
    }
    if (victims.length) setTimeout(() => sfx.pet(), 350);
    // Confettis sur le bon côté
    if (!ctx.light)
      for (let k = 0; k < 60; k++) {
        const x = q.ok === 0 ? rnd(X0, MID) : rnd(MID, X1);
        confetti.push({ x, y: Y0 + rnd(-40, 60), vx: rnd(-120, 120), vy: rnd(-520, -180), c: [ROSE, SOLEIL, CIEL, '#7bd13b', '#fff'][k % 5], t: 2 });
      }
    banner = {
      text: victims.length === 1 ? (fr ? `${victims[0].profile.name} passe à la trappe !` : `${victims[0].profile.name} drops out!`) : fr ? `${victims.length} joueurs passent à la trappe !` : `${victims.length} players drop out!`,
      t: 2.2,
      c: '#fff',
    };
  };

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'in') return;
      const p = ps.find((x) => x.pid === pid);
      if (!p) return;
      p.inp = { x: m.x ?? 0, y: m.y ?? 0 };
      p.b = !!m.b;
      if (p.b && !p.lastB && phase === 'ask') shove(p);
      p.lastB = p.b;
    },
    update(dt) {
      for (const p of ps) if (p.bot && p.alive) botThink(p, dt);
      move(dt);
      if (banner && (banner.t -= dt) <= 0) banner = null;
      for (const c of confetti) {
        c.vy += 900 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.t -= dt;
      }
      for (let i = confetti.length - 1; i >= 0; i--) if (confetti[i].t <= 0) confetti.splice(i, 1);
      // Chutes
      for (const p of ps) {
        if (p.fall <= 0 || !p.alive) continue;
        p.fall += dt / 1.1;
        if (p.fall >= 1) {
          p.alive = false;
          p.out = ++outCount;
        }
      }
      const before = pt;
      pt -= dt;
      if (phase === 'ask') {
        if (Math.ceil(pt) !== Math.ceil(before) && pt <= 3 && pt > 0) sfx.tick();
        if (pt <= 0) {
          phase = 'stop';
          pt = 0.9;
          sfx.alarm();
          banner = { text: 'STOP !', t: 0.9, c: SOLEIL };
        }
      } else if (phase === 'stop' && pt <= 0) {
        phase = 'open';
        pt = 1.7;
        openTrap();
      } else if (phase === 'open' && pt <= 0) {
        phase = 'after';
        pt = 1.1;
      } else if (phase === 'after' && pt <= 0) nextQuestion();
    },
    render(g, t) {
      // Décor : plateau de jeu télé, projecteurs
      const bg = g.createLinearGradient(0, 0, 0, 1080);
      bg.addColorStop(0, '#2a1838');
      bg.addColorStop(1, '#4a2a62');
      g.fillStyle = bg;
      g.fillRect(0, 0, 1920, 1080);
      if (!ctx.light) {
        for (let k = 0; k < 4; k++) {
          const sx = 240 + k * 480;
          const a = Math.sin(t * 0.7 + k * 1.7) * 0.25;
          g.save();
          g.translate(sx, -20);
          g.rotate(a);
          g.fillStyle = 'rgba(255,240,200,0.07)';
          g.beginPath();
          g.moveTo(-30, 0);
          g.lineTo(30, 0);
          g.lineTo(220, 1100);
          g.lineTo(-220, 1100);
          g.closePath();
          g.fill();
          g.restore();
        }
        // Ampoules du cadre
        for (let k = 0; k < 34; k++) {
          const on = (Math.floor(t * 4) + k) % 3 !== 0;
          g.fillStyle = on ? '#ffe680' : '#7a5a2a';
          g.beginPath();
          g.arc(60 + k * 54, 418, 8, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Socle du plateau
      g.fillStyle = INK;
      g.beginPath();
      g.roundRect(X0 - 18, Y0 - 18 + 14, X1 - X0 + 36, Y1 - Y0 + 36, 34);
      g.fill();
      g.fillStyle = '#5b3b72';
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(X0 - 18, Y0 - 18, X1 - X0 + 36, Y1 - Y0 + 36, 34);
      g.fill();
      g.stroke();
      // Les deux trappes
      const openK = phase === 'open' && !saved ? Math.min(1, (1.7 - pt) / 0.35) : phase === 'after' && !saved ? Math.max(0, pt / 1.1) : 0;
      for (const s of [0, 1]) {
        const x = s === 0 ? X0 : MID + 6;
        const w = s === 0 ? MID - X0 - 6 : X1 - MID - 6;
        const S = SIDES[s];
        const opening = s === wrong ? openK : 0;
        const good = (phase === 'open' || phase === 'after') && !saved && s === q.ok;
        if (opening > 0) {
          // Le trou : dégradé sombre, puis les deux battants qui se replient vers le haut et le bas
          const pit = g.createLinearGradient(0, Y0, 0, Y1);
          pit.addColorStop(0, '#0d0612');
          pit.addColorStop(0.5, '#1d0f26');
          pit.addColorStop(1, '#0d0612');
          g.fillStyle = pit;
          g.fillRect(x, Y0, w, Y1 - Y0);
          const h = ((Y1 - Y0) / 2) * (1 - opening);
          for (const [yy, hh] of [
            [Y0, h],
            [Y1 - h, h],
          ] as const) {
            if (hh < 2) continue;
            g.fillStyle = S.dark;
            g.fillRect(x, yy, w, hh);
            g.strokeStyle = INK;
            g.lineWidth = 5;
            g.strokeRect(x, yy, w, hh);
          }
        } else {
          g.fillStyle = good ? S.light : S.c;
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.beginPath();
          g.roundRect(x, Y0, w, Y1 - Y0, 18);
          g.fill();
          g.stroke();
          candy(g, x, Y0, w, Y1 - Y0, 18);
          // Charnière et ligne de découpe de la trappe
          g.strokeStyle = 'rgba(58,33,64,0.35)';
          g.lineWidth = 4;
          g.setLineDash([18, 14]);
          g.beginPath();
          g.moveTo(x + 20, (Y0 + Y1) / 2);
          g.lineTo(x + w - 20, (Y0 + Y1) / 2);
          g.stroke();
          g.setLineDash([]);
        }
        // Grande lettre + réponse peinte au sol
        if (opening < 0.5) {
          g.globalAlpha = 1 - opening * 2;
          g.font = '700 150px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = 'rgba(255,255,255,0.22)';
          g.fillText(S.key, x + w / 2, (Y0 + Y1) / 2 - 10);
          g.globalAlpha = 1;
        }
      }
      // Ligne du milieu
      g.fillStyle = INK;
      g.fillRect(MID - 6, Y0 - 18, 12, Y1 - Y0 + 36);
      g.fillStyle = SOLEIL;
      for (let y = Y0; y < Y1; y += 40) g.fillRect(MID - 3, y, 6, 20);

      // Joueurs (ceux qui tombent rapetissent en tournant)
      const order = ps.map((_, i) => i).sort((a, b) => ps[a].y - ps[b].y);
      for (const i of order) {
        const p = ps[i];
        if (!p.alive) continue;
        const f = p.fall;
        const size = 92 * (1 - f * 0.85);
        g.save();
        g.globalAlpha = 1 - f * 0.6;
        g.translate(p.x, p.y + f * 40);
        if (f > 0) g.rotate(f * 4 * p.dir);
        if (f === 0) {
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.beginPath();
          g.ellipse(0, 0, 32, 11, 0, 0, Math.PI * 2);
          g.fill();
        }
        drawCharacter(g, 0, 0, size, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          dir: p.dir,
          run: f > 0 ? 0 : Math.min(1, Math.hypot(p.vx, p.vy) / 300),
          mood: f > 0 ? 'sad' : p.stun > 0 ? 'wow' : phase === 'stop' ? 'wow' : 'happy',
        });
        g.restore();
        if (f === 0) {
          // Petit nom au-dessus de chacun (on doit savoir qui est où)
          g.font = '700 28px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'alphabetic';
          g.lineWidth = 6;
          g.strokeStyle = INK;
          g.strokeText(p.profile.name, p.x, p.y - 104);
          g.fillStyle = p.profile.color;
          g.fillText(p.profile.name, p.x, p.y - 104);
        }
        if (p.pop) {
          g.font = '700 40px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.lineWidth = 8;
          g.strokeStyle = INK;
          const y = p.y - 140 - (1.2 - p.pop.t) * 30;
          g.strokeText(p.pop.text, p.x, y);
          g.fillStyle = p.pop.c;
          g.fillText(p.pop.text, p.x, y);
        }
      }
      for (const c of confetti) {
        g.fillStyle = c.c;
        g.fillRect(c.x, c.y, 12, 7);
      }

      // Carte de la question
      const cw = 1500;
      const cx = 960 - cw / 2;
      g.fillStyle = INK;
      g.beginPath();
      g.roundRect(cx, 48 + 10, cw, 300, 36);
      g.fill();
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(cx, 48, cw, 300, 36);
      g.fill();
      g.stroke();
      if (round >= 0) {
        roundRectText(g, fr ? `Question ${round + 1} / ${MAX_ROUNDS}` : `Question ${round + 1} / ${MAX_ROUNDS}`, 960 - 150, 48, 300, 30, SOLEIL);
        g.fillStyle = INK;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        let fs = 60;
        g.font = `700 ${fs}px Fredoka, sans-serif`;
        while (g.measureText(q.q[L]).width > cw - 80 && fs > 36) g.font = `700 ${(fs -= 3)}px Fredoka, sans-serif`;
        g.fillText(q.q[L], 960, 140);
        // Les deux réponses
        for (const s of [0, 1]) {
          const S = SIDES[s];
          const bx = s === 0 ? cx + 40 : 960 + 20;
          const bw = cw / 2 - 60;
          const show = (phase === 'open' || phase === 'after') && !saved;
          g.globalAlpha = show && s !== q.ok ? 0.35 : 1;
          g.fillStyle = S.c;
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.beginPath();
          g.roundRect(bx, 210, bw, 100, 26);
          g.fill();
          g.stroke();
          candy(g, bx, 210, bw, 100, 26);
          g.fillStyle = '#fff';
          g.font = '700 46px Fredoka, sans-serif';
          g.lineWidth = 8;
          g.strokeStyle = INK;
          const label = `${s === 0 ? '⬅' : ''} ${S.key} · ${q.a[s][L]} ${s === 1 ? '➡' : ''}`.trim();
          g.strokeText(label, bx + bw / 2, 262);
          g.fillText(label, bx + bw / 2, 262);
          g.globalAlpha = 1;
          if (show && s === q.ok) {
            g.font = '700 64px Fredoka, sans-serif';
            g.fillText('✅', bx + bw - 10, 214);
          }
        }
        // Chrono : barre qui se vide
        if (phase === 'ask') {
          const k = Math.max(0, pt / askLen);
          g.fillStyle = 'rgba(58,33,64,0.15)';
          g.beginPath();
          g.roundRect(cx + 40, 326, cw - 80, 14, 7);
          g.fill();
          g.fillStyle = k < 0.33 ? '#ff3b3b' : k < 0.66 ? SOLEIL : '#7bd13b';
          g.beginPath();
          g.roundRect(cx + 40, 326, (cw - 80) * k, 14, 7);
          g.fill();
        }
      } else {
        g.fillStyle = INK;
        g.font = '700 64px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(fr ? '🕳️ Choisis ton côté… ou tombe !' : '🕳️ Pick a side… or drop!', 960, 198);
      }
      // Gros bandeau (STOP, chute, repêchage)
      if (banner) {
        const k = Math.min(1, (banner.t > 0.3 ? 1 : banner.t / 0.3)) * (1 + Math.max(0, banner.t - (banner.text === 'STOP !' ? 0.6 : 1.9)) * 1.5);
        g.save();
        g.translate(960, 740);
        g.scale(k, k);
        g.rotate(-0.04);
        g.font = '700 110px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = 20;
        g.strokeStyle = INK;
        g.strokeText(banner.text, 0, 0);
        g.fillStyle = banner.c;
        g.fillText(banner.text, 0, 0);
        g.restore();
      }
      // Survivants
      g.font = '700 34px Fredoka, sans-serif';
      g.textAlign = 'right';
      g.textBaseline = 'alphabetic';
      g.fillStyle = '#fff';
      g.fillText(`${fr ? 'Debout' : 'Standing'} : ${alive().length} / ${n}`, 1880, 1060);
    },
    out: (pid) => !!ps.find((p) => p.pid === pid && !p.alive),
    ranking: () => [...ps].sort((a, b) => Number(b.alive) - Number(a.alive) || b.out - a.out || b.good - a.good).map((p) => p.pid),
    leader() {
      const a = alive();
      return a.length === 1 ? a[0].profile.name : null;
    },
  };
  return game;
}

export const trapGame: GameBase = {
  id: 'trappe',
  emoji: '🕳️',
  name: { fr: 'La Trappe', en: 'The Trapdoor' },
  how: {
    fr: 'Une question, deux réponses : va du bon côté avant le STOP, la trappe s’ouvre sous l’autre ! · B = pousser',
    en: 'One question, two answers: stand on the right side before STOP, the other side’s trapdoor opens! · B = shove',
  },
  inspired: 'Jeux télé de quiz',
  layout: 'stick',
  min: 2,
  max: 12,
  botFill: 4,
  music: 'party',
  create: trap,
};
