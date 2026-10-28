// Le Traître du Frigo : rôle caché. La nuit, les Pique-assiettes « frigotent » quelqu'un ;
// le jour, on débat à voix haute puis on vote sur son téléphone.
import { drawCharacter } from '../shared/characters';
import { sfx, speak } from '../shared/sound';
import { candy, roundRectText } from './draw';
import type { Role, TraitorPadData } from './traitorShared';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const T_ROLES = 9;
const T_NIGHT = 22;
const T_MORNING = 6;
const T_DEBATE = 75;
const T_VOTE = 25;
const T_VERDICT = 6;

type Phase = TraitorPadData['phase'];

interface Pl extends Runner {
  role: Role;
  alive: boolean;
  pick: number;
  ready: boolean;
  diedAt: number;
  sniffed: Map<number, boolean>;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Décor de cuisine (jour / nuit), dessiné une seule fois puis gardé en image. */
const kitchenCache: Record<string, HTMLCanvasElement> = {};
function kitchen(night: boolean): HTMLCanvasElement {
  const key = night ? 'n' : 'd';
  if (kitchenCache[key]) return kitchenCache[key];
  const c = document.createElement('canvas');
  c.width = 1920;
  c.height = 1080;
  const g = c.getContext('2d')!;
  const rr = (x: number, y: number, w: number, h: number, r: number, fill: string, lw = 8) => {
    g.fillStyle = fill;
    g.strokeStyle = INK;
    g.lineWidth = lw;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
    candy(g, x, y, w, h, r);
    g.strokeStyle = INK;
    g.lineWidth = lw;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.stroke();
  };
  // Mur : papier peint à rayures
  const wall = g.createLinearGradient(0, 0, 0, 720);
  wall.addColorStop(0, night ? '#2b1d52' : '#ffe2c4');
  wall.addColorStop(1, night ? '#3d2a6b' : '#ffd2a8');
  g.fillStyle = wall;
  g.fillRect(0, 0, 1920, 720);
  g.fillStyle = night ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.35)';
  for (let x = 0; x < 1920; x += 80) g.fillRect(x, 0, 36, 720);
  // Fenêtre avec lune ou soleil
  rr(180, 170, 360, 300, 26, night ? '#1a1236' : '#9fe0ff');
  g.fillStyle = night ? '#fff6c8' : '#fff3a8';
  g.beginPath();
  g.arc(440, 260, 46, 0, Math.PI * 2);
  g.fill();
  if (night) {
    g.fillStyle = '#1a1236';
    g.beginPath();
    g.arc(462, 246, 40, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    for (const [x, y] of [[250, 220], [320, 350], [500, 400], [380, 210], [230, 420]]) g.fillRect(x, y, 6, 6);
  }
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(360, 170);
  g.lineTo(360, 470);
  g.moveTo(180, 320);
  g.lineTo(540, 320);
  g.stroke();
  // Rideaux
  g.fillStyle = '#ff7eb6';
  for (const [x, d] of [[150, 1], [520, -1]]) {
    g.beginPath();
    g.moveTo(x, 150);
    g.lineTo(x + 70, 150);
    g.quadraticCurveTo(x + 35 + d * 30, 320, x + 35 + d * 10, 500);
    g.lineTo(x + 35 - d * 40, 500);
    g.quadraticCurveTo(x + 35 - d * 30, 320, x, 150);
    g.closePath();
    g.fill();
    g.stroke();
  }
  // Étagère avec bocaux
  rr(1300, 270, 460, 28, 10, '#c98a52', 6);
  ['#ff4f9a', '#1fc9a0', '#ffd60a', '#2ec5ff'].forEach((col, k) => {
    const x = 1330 + k * 110;
    rr(x, 180, 76, 90, 18, col, 6);
    rr(x + 8, 166, 60, 22, 8, '#fff', 5);
  });
  // Plans de travail
  for (const x of [-20, 1180]) {
    rr(x, 560, 760, 160, 0, night ? '#6b4fa0' : '#ffb27a');
    rr(x, 540, 760, 40, 12, night ? '#c9b8ff' : '#fff2e0', 6);
  }
  g.strokeStyle = INK;
  g.lineWidth = 6;
  for (const x of [60, 340, 1300, 1580]) {
    g.strokeRect(x, 600, 220, 100);
    g.fillStyle = INK;
    g.fillRect(x + 90, 620, 40, 10);
  }
  // Sol : damier en perspective
  g.fillStyle = night ? '#24183f' : '#ffe9d2';
  g.fillRect(0, 720, 1920, 360);
  g.fillStyle = night ? '#33245a' : '#ffcfa8';
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const y0 = 720 + 360 * (r / rows) ** 1.3;
    const y1 = 720 + 360 * ((r + 1) / rows) ** 1.3;
    const w0 = ((y0 - 560) * 1.4) / 6;
    const w1 = ((y1 - 560) * 1.4) / 6;
    for (let k = -14; k < 14; k++) {
      if ((k + r + 100) % 2) continue;
      g.beginPath();
      g.moveTo(960 + k * w0, y0);
      g.lineTo(960 + (k + 1) * w0, y0);
      g.lineTo(960 + (k + 1) * w1, y1);
      g.lineTo(960 + k * w1, y1);
      g.fill();
    }
  }
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(0, 720);
  g.lineTo(1920, 720);
  g.stroke();
  // Le frigo, la star
  g.fillStyle = 'rgba(58,33,64,0.25)';
  g.beginPath();
  g.ellipse(960, 720, 220, 26, 0, 0, Math.PI * 2);
  g.fill();
  rr(800, 180, 320, 540, 40, night ? '#a9b8e6' : '#eaf6ff');
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(800, 370);
  g.lineTo(1120, 370);
  g.stroke();
  rr(1068, 210, 18, 100, 9, '#d8e2f2', 5);
  rr(1068, 410, 18, 150, 9, '#d8e2f2', 5);
  // Aimants
  for (const [x, y, col] of [[860, 240, '#ff4f9a'], [930, 290, '#ffd60a'], [870, 450, '#1fc9a0'], [1010, 530, '#2ec5ff'], [890, 640, '#ff8a00']] as [number, number, string][]) {
    g.fillStyle = col;
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(x, y, 18, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // Petit mot sur la porte
  g.save();
  g.translate(960, 520);
  g.rotate(-0.06);
  rr(-80, -50, 160, 100, 6, '#fff7a8', 5);
  g.fillStyle = INK;
  g.font = '700 30px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.fillText(night ? '???' : 'PAS', 0, -6);
  g.fillText(night ? '' : 'TOUCHE !', 0, 30);
  g.restore();
  // Vignette sombre la nuit
  if (night) {
    const v = g.createRadialGradient(960, 520, 300, 960, 540, 1150);
    v.addColorStop(0, 'rgba(10,5,30,0)');
    v.addColorStop(1, 'rgba(10,5,30,0.6)');
    g.fillStyle = v;
    g.fillRect(0, 0, 1920, 1080);
  }
  kitchenCache[key] = c;
  return c;
}

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const n = runners.length;
  const nTraitors = n >= 7 ? 2 : 1;
  const order = [...runners.keys()].sort(() => Math.random() - 0.5);
  const pls: Pl[] = runners.map((r) => ({ ...r, role: 'gourmand', alive: true, pick: -1, ready: false, diedAt: 0, sniffed: new Map() }));
  order.slice(0, nTraitors).forEach((i) => (pls[i].role = 'pique'));
  if (n >= 5) pls[order[nTraitors]].role = 'gouteur';
  // Dès 7 joueurs, un Glouton joue pour lui seul : il gagne s'il se fait mettre à la porte au vote.
  if (n >= 7) pls[order[nTraitors + 1]].role = 'glouton';

  let phase: Phase = 'roles';
  let timer = T_ROLES;
  let day = 0;
  let headline = fr ? 'Regardez votre rôle en secret…' : 'Check your role in secret…';
  let sub = '';
  let winner: 'pique' | 'gourmand' | 'glouton' | null = null;
  let deaths = 0;
  let lastVotes = new Map<number, number>();
  const botDelay: number[] = pls.map(() => rnd(2, 8));

  const name = (i: number) => pls[i].profile.name;
  const alive = () => pls.map((p, i) => ({ p, i })).filter((x) => x.p.alive);
  const roleName = (r: Role) =>
    fr
      ? { gourmand: 'Gourmand', pique: 'Pique-assiette', gouteur: 'Goûteur', glouton: 'Glouton' }[r]
      : { gourmand: 'Foodie', pique: 'Moocher', gouteur: 'Taster', glouton: 'Glutton' }[r];

  function go(p: Phase, t: number) {
    phase = p;
    timer = t;
    pls.forEach((x) => {
      x.pick = -1;
      x.ready = false;
    });
    botDelay.forEach((_, i) => (botDelay[i] = rnd(2, Math.min(10, t - 2))));
    ctx.refresh();
  }

  function checkWin(): boolean {
    const a = alive();
    const t = a.filter((x) => x.p.role === 'pique').length;
    if (t === 0) winner = 'gourmand';
    else if (t >= a.length - t) winner = 'pique';
    if (!winner) return false;
    headline = winner === 'gourmand' ? (fr ? 'Les Gourmands gagnent !' : 'The Foodies win!') : fr ? 'Les Pique-assiettes gagnent !' : 'The Moochers win!';
    sub = fr
      ? `Les traîtres étaient : ${pls.filter((p) => p.role === 'pique').map((p) => p.profile.name).join(', ')}`
      : `The traitors were: ${pls.filter((p) => p.role === 'pique').map((p) => p.profile.name).join(', ')}`;
    speak(headline, ctx.lang);
    sfx.win();
    go('end', 7);
    return true;
  }

  function kill(i: number) {
    pls[i].alive = false;
    pls[i].diedAt = ++deaths;
    sfx.pet();
    if (!pls[i].bot) ctx.buzz(pls[i].pid, 600);
  }

  /** Choix de la majorité (null si égalité ou personne). */
  function majority(voters: Pl[]): number | null {
    const count = new Map<number, number>();
    for (const v of voters) if (v.pick >= 0) count.set(v.pick, (count.get(v.pick) ?? 0) + 1);
    lastVotes = count;
    let best = -1;
    let bc = 0;
    let tie = false;
    for (const [k, c] of count) {
      if (c > bc) {
        best = k;
        bc = c;
        tie = false;
      } else if (c === bc) tie = true;
    }
    return best < 0 || tie ? null : best;
  }

  function endNight() {
    const traitors = alive().filter((x) => x.p.role === 'pique').map((x) => x.p);
    let victim = majority(traitors);
    if (victim === null) {
      const picks = traitors.map((t) => t.pick).filter((k) => k >= 0);
      victim = picks.length ? picks[0] : null;
    }
    day++;
    if (victim !== null && pls[victim].alive) {
      kill(victim);
      headline = ctx.family
        ? fr ? `${name(victim)} s'est endormi dans le frigo !` : `${name(victim)} fell asleep in the fridge!`
        : fr ? `${name(victim)} a été retrouvé la tête dans le frigo !` : `${name(victim)} was found head-first in the fridge!`;
      sub = fr ? `C'était un ${roleName(pls[victim].role)}.` : `They were a ${roleName(pls[victim].role)}.`;
    } else {
      headline = fr ? 'Nuit calme : le frigo est intact.' : 'Quiet night: the fridge is untouched.';
      sub = '';
    }
    speak(headline, ctx.lang);
    go('morning', T_MORNING);
  }

  function endVote() {
    const v = majority(alive().map((x) => x.p));
    if (v !== null) {
      kill(v);
      if (pls[v].role === 'glouton') {
        winner = 'glouton';
        headline = fr ? `${name(v)} était le Glouton : il voulait être viré, il gagne !` : `${name(v)} was the Glutton: they wanted out, they win!`;
        sub = '';
        speak(headline, ctx.lang);
        sfx.win();
        go('end', 7);
        return;
      }
      headline = fr ? `${name(v)} est mis à la porte !` : `${name(v)} is kicked out!`;
      sub = fr ? `C'était un ${roleName(pls[v].role)}.` : `They were a ${roleName(pls[v].role)}.`;
    } else {
      headline = fr ? 'Égalité : personne ne sort.' : 'Tie: nobody leaves.';
      sub = '';
    }
    speak(headline, ctx.lang);
    go('verdict', T_VERDICT);
  }

  function botAct(i: number) {
    const p = pls[i];
    if (!p.alive || p.pick >= 0) return;
    const others = alive().filter((x) => x.i !== i);
    if (phase === 'night' && p.role === 'pique') {
      const prey = others.filter((x) => x.p.role !== 'pique');
      if (prey.length) p.pick = prey[Math.floor(Math.random() * prey.length)].i;
    } else if (phase === 'night' && p.role === 'gouteur') {
      const unk = others.filter((x) => !p.sniffed.has(x.i));
      if (unk.length) {
        const k = unk[Math.floor(Math.random() * unk.length)].i;
        p.pick = k;
      }
    } else if (phase === 'vote') {
      const known = [...p.sniffed].find(([k, bad]) => bad && pls[k].alive);
      const pool = p.role === 'pique' ? others.filter((x) => x.p.role !== 'pique') : others;
      p.pick = known ? known[0] : pool[Math.floor(Math.random() * pool.length)]?.i ?? -1;
    } else if (phase === 'debate') p.ready = true;
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const i = pls.findIndex((p) => p.pid === pid);
      const p = pls[i];
      if (!p || !p.alive) return;
      if (m.a === 'ready' && phase === 'debate') p.ready = true;
      if (m.a === 'pick') {
        const k = m.n?.[0] ?? -1;
        if (k < 0 || k >= pls.length || !pls[k].alive || k === i) return;
        if (phase === 'night' && p.role === 'pique' && pls[k].role !== 'pique') p.pick = k;
        else if (phase === 'night' && p.role === 'gouteur' && p.pick < 0) {
          p.pick = k;
          p.sniffed.set(k, pls[k].role === 'pique');
        } else if (phase === 'vote') p.pick = k;
        else return;
        sfx.click();
      }
      ctx.refresh();
    },
    update(dt) {
      timer -= dt;
      pls.forEach((p, i) => {
        if (p.bot && (botDelay[i] -= dt) <= 0) {
          botAct(i);
          if (p.role === 'gouteur' && phase === 'night' && p.pick >= 0 && !p.sniffed.has(p.pick)) p.sniffed.set(p.pick, pls[p.pick].role === 'pique');
          botDelay[i] = 99;
        }
      });
      const a = alive().map((x) => x.p);
      // On passe à la suite dès que tout le monde a choisi.
      if (phase === 'night' && a.filter((p) => p.role !== 'gourmand').every((p) => p.pick >= 0)) timer = Math.min(timer, 1);
      if (phase === 'vote' && a.every((p) => p.pick >= 0)) timer = Math.min(timer, 1.5);
      if (phase === 'debate' && a.every((p) => p.ready)) timer = Math.min(timer, 1);
      if (timer > 0) return;
      switch (phase) {
        case 'roles':
          headline = fr ? 'La nuit tombe sur la cuisine…' : 'Night falls on the kitchen…';
          sub = fr ? 'Pique-assiettes et Goûteur : à vos téléphones.' : 'Moochers and Taster: check your phones.';
          speak(headline, ctx.lang);
          go('night', T_NIGHT);
          break;
        case 'night':
          endNight();
          break;
        case 'morning':
          if (checkWin()) break;
          headline = fr ? 'Débat : qui pille le frigo ?' : 'Debate: who’s raiding the fridge?';
          sub = fr ? 'Parlez entre vous, puis votez.' : 'Talk it out, then vote.';
          go('debate', T_DEBATE);
          break;
        case 'debate':
          headline = fr ? 'Votez sur votre téléphone !' : 'Vote on your phone!';
          sub = '';
          speak(headline, ctx.lang);
          go('vote', T_VOTE);
          break;
        case 'vote':
          endVote();
          break;
        case 'verdict':
          if (checkWin()) break;
          headline = fr ? 'La nuit retombe…' : 'Night falls again…';
          sub = '';
          go('night', T_NIGHT);
          break;
        case 'end':
          game.over = true;
          break;
      }
    },
    render(g, t) {
      const night = phase === 'night' || phase === 'roles';
      g.drawImage(kitchen(night), 0, 0, 1920, 1080);
      if (night && !ctx.light) {
        // La porte du frigo laisse filer une lumière qui vacille… et deux yeux brillent
        g.fillStyle = `rgba(255,240,150,${0.18 + Math.sin(t * 3) * 0.05})`;
        g.beginPath();
        g.moveTo(1120, 380);
        g.lineTo(1700, 1080);
        g.lineTo(1120, 1080);
        g.fill();
        if (Math.sin(t * 0.7) > 0.3) {
          const blink = Math.sin(t * 9) > 0.95 ? 1 : 7;
          g.fillStyle = '#ffd60a';
          g.beginPath();
          g.ellipse(1138, 480, 7, blink, 0, 0, Math.PI * 2);
          g.ellipse(1162, 480, 7, blink, 0, 0, Math.PI * 2);
          g.fill();
        }
      } else if (!night && !ctx.light) {
        // Poussières dorées dans le soleil de la fenêtre
        g.fillStyle = 'rgba(255,240,180,0.7)';
        for (let k = 0; k < 14; k++) {
          g.beginPath();
          g.arc(200 + ((k * 137 + t * 20) % 380), 190 + ((k * 89 + t * 12) % 280), 4, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Titre en pastille
      g.textAlign = 'center';
      g.font = '700 54px Fredoka, sans-serif';
      const hw = Math.max(420, g.measureText(headline).width + 80);
      g.fillStyle = night ? '#ff4f9a' : '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 8;
      g.beginPath();
      g.roundRect(960 - hw / 2, 28, hw, 84, 42);
      g.fill();
      g.stroke();
      g.fillStyle = night ? '#fff' : INK;
      g.fillText(headline, 960, 88);
      g.font = '600 34px Fredoka, sans-serif';
      if (sub) {
        g.strokeText(sub, 960, 152);
        g.fillStyle = '#fff';
        g.fillText(sub, 960, 152);
      }
      if (phase !== 'end' && phase !== 'morning' && phase !== 'verdict') {
        g.fillStyle = '#ffd60a';
        g.beginPath();
        g.roundRect(1690, 36, 180, 70, 35);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 1780, 84);
      }

      // Joueurs en arc de cercle
      const cnt = pls.length;
      pls.forEach((p, i) => {
        const a = Math.PI * (0.08 + (0.84 * i) / Math.max(1, cnt - 1));
        const x = 960 - Math.cos(a) * 820;
        const y = 1010 - Math.sin(a) * 120 - (i % 2) * 20;
        drawCharacter(g, x, y - 40, 110, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          ghost: !p.alive,
          mood: !p.alive ? 'sad' : night ? 'wow' : 'happy',
        });
        roundRectText(g, p.profile.name, x - 80, y - 4, 160, 26, p.profile.color);
        const revealed = !p.alive || phase === 'end';
        if (revealed) {
          g.font = '600 28px Fredoka, sans-serif';
          g.fillStyle = night ? '#fff' : INK;
          g.fillText(roleName(p.role), x, y + 30);
        }
        if (phase === 'vote' && p.alive) {
          g.font = '28px sans-serif';
          g.fillText(p.pick >= 0 ? '🗳️' : '…', x, y - 175);
        }
        if (phase === 'verdict' && lastVotes.get(i)) {
          g.font = '700 30px Fredoka, sans-serif';
          g.fillStyle = '#ff3b3b';
          g.fillText(`${lastVotes.get(i)} 🗳️`, x, y - 175);
        }
        if (phase === 'debate' && p.ready) {
          g.font = '28px sans-serif';
          g.fillText('✋', x, y - 175);
        }
      });
    },
    ranking() {
      const won = (p: Pl) =>
        winner === 'glouton' ? p.role === 'glouton' : winner === 'pique' ? p.role === 'pique' : p.role !== 'pique' && p.role !== 'glouton';
      return [...pls]
        .sort((a, b) => Number(won(b)) - Number(won(a)) || Number(b.alive) - Number(a.alive) || b.diedAt - a.diedAt)
        .map((p) => p.pid);
    },
    leader() {
      return null;
    },
    padData(pid): TraitorPadData {
      const i = pls.findIndex((p) => p.pid === pid);
      const p = pls[i];
      let act: TraitorPadData['act'] = null;
      if (p.alive) {
        if (phase === 'night' && p.role === 'pique') act = 'kill';
        if (phase === 'night' && p.role === 'gouteur' && p.pick < 0) act = 'sniff';
        if (phase === 'vote') act = 'vote';
        if (phase === 'debate' && !p.ready) act = 'ready';
      }
      const opts = alive()
        .filter((x) => x.i !== i && (act !== 'kill' || x.p.role !== 'pique'))
        .map((x) => ({ i: x.i, name: x.p.profile.name, color: x.p.profile.color }));
      const sniffs = [...p.sniffed].map(([k, bad]) =>
        fr ? `${name(k)} : ${bad ? 'Pique-assiette 😈' : 'innocent 😇'}` : `${name(k)}: ${bad ? 'Moocher 😈' : 'innocent 😇'}`,
      );
      return {
        phase,
        role: p.role,
        alive: p.alive,
        mates: p.role === 'pique' ? pls.filter((x, k) => x.role === 'pique' && k !== i).map((x) => x.profile.name) : [],
        options: act && act !== 'ready' ? opts : [],
        act,
        picked: p.pick,
        info: sniffs.join(' · '),
        left: Math.ceil(timer),
      };
    },
  };
  return game;
}

export const traitor: GameBase = {
  id: 'traitre',
  emoji: '🕵️',
  name: { fr: 'Le Traître du Frigo', en: 'Fridge Traitor' },
  how: {
    fr: 'Rôle secret sur ton téléphone. Démasquez les Pique-assiettes !',
    en: 'Secret role on your phone. Unmask the Moochers!',
  },
  inspired: 'Loup-garou',
  layout: 'buttons',
  min: 4,
  max: 12,
  botFill: 5,
  music: 'lobby',
  create,
};
