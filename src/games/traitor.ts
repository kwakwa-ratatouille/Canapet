// Le Traître du Frigo : rôle caché. La nuit, les Pique-assiettes « frigotent » quelqu'un ;
// le jour, on débat à voix haute puis on vote sur son téléphone.
import { drawCharacter } from '../shared/characters';
import { sfx, speak } from '../shared/sound';
import { roundRectText } from './draw';
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
      g.fillStyle = night ? '#2a1b4a' : '#ffe9c7';
      g.fillRect(0, 0, 1920, 1080);
      // Carrelage
      g.fillStyle = night ? '#33245a' : '#ffdcae';
      for (let x = 0; x < 1920; x += 120) for (let y = 700; y < 1080; y += 120) if (((x + y) / 120) % 2 === 0) g.fillRect(x, y, 120, 120);
      // Frigo
      g.strokeStyle = INK;
      g.lineWidth = 8;
      g.fillStyle = night ? '#9fb0d8' : '#e8f4ff';
      g.beginPath();
      g.roundRect(820, 180, 280, 500, 30);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(820, 360);
      g.lineTo(1100, 360);
      g.stroke();
      g.fillStyle = '#b8c6dd';
      g.fillRect(1060, 210, 14, 70);
      g.fillRect(1060, 380, 14, 110);
      if (night && !ctx.light) {
        g.fillStyle = `rgba(255,240,150,${0.15 + Math.sin(t * 3) * 0.05})`;
        g.beginPath();
        g.moveTo(1100, 340);
        g.lineTo(1500, 700);
        g.lineTo(1100, 660);
        g.fill();
      }
      g.fillStyle = night ? '#fff' : INK;
      g.textAlign = 'center';
      g.font = '700 54px Fredoka, sans-serif';
      g.fillText(headline, 960, 90);
      g.font = '600 34px Fredoka, sans-serif';
      if (sub) g.fillText(sub, 960, 140);
      if (phase !== 'end' && phase !== 'morning' && phase !== 'verdict') g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 1780, 90);

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
