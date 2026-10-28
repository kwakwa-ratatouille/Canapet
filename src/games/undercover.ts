// Undercover : chacun reçoit un mot en secret sur son téléphone. Les civils ont le même,
// l'Undercover un mot proche, Mr White aucun. À tour de rôle, on tape un indice d'un mot (affiché à la télé),
// on débat, puis on vote. Mr White éliminé peut encore gagner en devinant le mot des civils.
import { drawCharacter } from '../shared/characters';
import { INK, ROSE, SOLEIL, MENTHE } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { candy, roundRectText } from './draw';
import { norm } from './scribbleShared';
import type { UndercoverPadData } from './undercoverShared';
import { THEMES } from './undercoverWords';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';

const T_ROLES = 10;
const T_CLUE = 30;
const T_DEBATE = 45;
const T_VOTE = 30;
const T_REVEAL = 7;
const T_GUESS = 25;
const MAX_ROUNDS = 5;

type Role = 'civil' | 'under' | 'white';
type Phase = UndercoverPadData['phase'];

interface Pl extends Runner {
  role: Role;
  word: string | null;
  alive: boolean;
  /** Indices donnés, un par manche. */
  clues: string[];
  pick: number;
  ready: boolean;
  diedAt: number;
  note: string;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Bureau de détective, dessiné une fois puis gardé en image. */
let officeImg: HTMLCanvasElement | null = null;
function office(): HTMLCanvasElement {
  if (officeImg) return officeImg;
  const c = document.createElement('canvas');
  c.width = 1920;
  c.height = 1080;
  const g = c.getContext('2d')!;
  const rr = (x: number, y: number, w: number, h: number, r: number, fill: string, lw = 8) => {
    g.fillStyle = fill;
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
  // Mur en lambris
  const wall = g.createLinearGradient(0, 0, 0, 760);
  wall.addColorStop(0, '#2a1838');
  wall.addColorStop(1, '#43285e');
  g.fillStyle = wall;
  g.fillRect(0, 0, 1920, 760);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 0; x < 1920; x += 120) g.fillRect(x, 480, 6, 280);
  g.fillStyle = '#5a3778';
  g.fillRect(0, 470, 1920, 16);
  // Fenêtre à stores : lumière de la ville la nuit
  rr(110, 250, 330, 230, 16, '#1b1030');
  g.fillStyle = '#ffd60a';
  for (const [x, y, w, h] of [[150, 380, 40, 100], [210, 340, 50, 140], [280, 400, 36, 80], [340, 360, 60, 120]]) {
    g.fillRect(x, y, w, h);
  }
  g.fillStyle = '#c9a6ff';
  for (let y = 262; y < 470; y += 22) g.fillRect(118, y, 314, 9);
  // Tableau d'enquête avec fils rouges
  rr(1420, 200, 400, 270, 14, '#c98a52');
  rr(1438, 218, 364, 234, 8, '#e9c08a', 5);
  const pins: [number, number, string][] = [[1490, 270, '#ff4f9a'], [1640, 250, '#2ec5ff'], [1750, 330, '#1fc9a0'], [1540, 390, '#ffd60a'], [1690, 410, '#fff']];
  g.strokeStyle = '#ff3b3b';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(1490, 270);
  g.lineTo(1640, 250);
  g.lineTo(1750, 330);
  g.lineTo(1540, 390);
  g.lineTo(1490, 270);
  g.moveTo(1640, 250);
  g.lineTo(1690, 410);
  g.stroke();
  for (const [x, y, col] of pins) {
    g.save();
    g.translate(x, y);
    g.rotate((x % 7) * 0.03 - 0.1);
    rr(-34, -26, 68, 56, 4, col, 4);
    g.fillStyle = INK;
    g.font = '700 30px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.fillText('?', 0, 14);
    g.restore();
  }
  // Lampe suspendue
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(960, 0);
  g.lineTo(960, 250);
  g.stroke();
  g.fillStyle = '#1fc9a0';
  g.beginPath();
  g.moveTo(880, 320);
  g.quadraticCurveTo(960, 220, 1040, 320);
  g.closePath();
  g.fill();
  g.lineWidth = 8;
  g.stroke();
  // Sol : parquet sombre
  g.fillStyle = '#2f1d40';
  g.fillRect(0, 760, 1920, 320);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 4;
  for (let y = 800; y < 1080; y += 52) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1920, y);
    g.stroke();
  }
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(0, 760);
  g.lineTo(1920, 760);
  g.stroke();
  // Tapis rond sous le cercle des suspects
  g.fillStyle = '#7a2e5c';
  g.beginPath();
  g.ellipse(960, 930, 900, 130, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ff7eb6';
  g.lineWidth = 6;
  g.setLineDash([18, 14]);
  g.beginPath();
  g.ellipse(960, 930, 860, 110, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  // Vignette
  const v = g.createRadialGradient(960, 560, 300, 960, 540, 1150);
  v.addColorStop(0, 'rgba(10,5,30,0)');
  v.addColorStop(1, 'rgba(10,5,30,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, 1920, 1080);
  officeImg = c;
  return c;
}

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const themes = THEMES.filter((th) => !(ctx.family && th.adult));
  const theme = themes[Math.floor(Math.random() * themes.length)];
  const pair = theme.pairs[Math.floor(Math.random() * theme.pairs.length)];
  const [wa, wb] = fr ? [pair[0], pair[1]] : [pair[2], pair[3]];
  // Le mot des civils et celui de l'Undercover sont tirés au hasard dans la paire.
  const [civilWord, underWord] = Math.random() < 0.5 ? [wa, wb] : [wb, wa];
  const n = runners.length;
  const nUnder = n >= 10 ? 3 : n >= 7 ? 2 : 1;
  const nWhite = n >= 5 ? 1 : 0;
  const order = [...runners.keys()].sort(() => Math.random() - 0.5);
  const pls: Pl[] = runners.map((r) => ({ ...r, role: 'civil', word: civilWord, alive: true, clues: [], pick: -1, ready: false, diedAt: 0, note: '' }));
  order.slice(0, nUnder).forEach((i) => {
    pls[i].role = 'under';
    pls[i].word = underWord;
  });
  order.slice(nUnder, nUnder + nWhite).forEach((i) => {
    pls[i].role = 'white';
    pls[i].word = null;
  });
  // Mots du thème pour les indices des bots
  const pool = theme.pairs.flatMap((p) => (fr ? [p[0], p[1]] : [p[2], p[3]])).filter((w) => w !== wa && w !== wb);

  let phase: Phase = 'roles';
  let timer = T_ROLES;
  let round = 1;
  let turnOrder: number[] = [];
  let turnPos = 0;
  let headline = fr ? 'Regarde ton mot en secret…' : 'Check your word in secret…';
  let sub = fr ? 'Ne le montre à personne !' : 'Don’t show anyone!';
  let winner: 'civil' | 'impo' | 'white' | null = null;
  let deaths = 0;
  let lastOut = -1;
  let lastVotes = new Map<number, number>();
  let botT = rnd(2, 4);

  const alive = () => pls.map((p, i) => ({ p, i })).filter((x) => x.p.alive);
  const roleName = (r: Role) => (fr ? { civil: 'Civil', under: 'Undercover', white: 'Mr White' }[r] : { civil: 'Civilian', under: 'Undercover', white: 'Mr White' }[r]);

  function go(p: Phase, t: number) {
    phase = p;
    timer = t;
    pls.forEach((x) => {
      x.pick = -1;
      x.ready = false;
    });
    botT = rnd(2, 5);
    ctx.refresh();
  }

  function startClues() {
    // Mr White ne commence jamais : il aurait trop de mal.
    const a = alive().map((x) => x.i);
    let start = Math.floor(Math.random() * a.length);
    for (let k = 0; k < a.length && pls[a[start]].role === 'white'; k++) start = (start + 1) % a.length;
    turnOrder = [...a.slice(start), ...a.slice(0, start)];
    turnPos = 0;
    headline = fr ? `Manche ${round} : un indice chacun` : `Round ${round}: one clue each`;
    sub = '';
    speak(fr ? `À ${pls[turnOrder[0]].profile.name} de donner un indice` : `${pls[turnOrder[0]].profile.name}, give a clue`, ctx.lang);
    go('clues', T_CLUE);
  }

  function giveClue(i: number, raw: string) {
    const p = pls[i];
    let c = raw.replace(/\s+/g, ' ').trim().split(' ')[0]?.slice(0, 18) ?? '';
    if (!c) c = '…';
    // Interdit de dire son propre mot
    if (p.word && norm(c) && (norm(c).includes(norm(p.word)) || norm(p.word).includes(norm(c)))) {
      p.note = fr ? 'Interdit de dire ton mot !' : 'You can’t say your word!';
      ctx.refresh();
      return;
    }
    p.note = '';
    p.clues[round - 1] = c;
    sfx.pop();
    turnPos++;
    if (turnPos >= turnOrder.length) {
      headline = fr ? 'Débat : qui est l’Undercover ?' : 'Debate: who’s the Undercover?';
      sub = fr ? 'Parlez entre vous, puis votez.' : 'Talk it out, then vote.';
      speak(headline, ctx.lang);
      go('debate', T_DEBATE);
    } else {
      timer = T_CLUE;
      botT = rnd(2, 4);
      ctx.refresh();
    }
  }

  function checkWin(): boolean {
    const a = alive().map((x) => x.p);
    const civ = a.filter((p) => p.role === 'civil').length;
    const imp = a.length - civ;
    if (imp === 0) winner = 'civil';
    else if (civ <= 1 || round > MAX_ROUNDS) winner = 'impo';
    if (!winner) return false;
    finish();
    return true;
  }

  function finish() {
    headline =
      winner === 'civil'
        ? fr ? 'Les Civils gagnent !' : 'The Civilians win!'
        : winner === 'white'
          ? fr ? 'Mr White a deviné : il gagne !' : 'Mr White guessed it: he wins!'
          : fr ? 'Les imposteurs gagnent !' : 'The impostors win!';
    sub = fr ? `Mot des civils : ${civilWord} · Undercover : ${underWord}` : `Civilians: ${civilWord} · Undercover: ${underWord}`;
    speak(headline, ctx.lang);
    sfx.win();
    go('end', 8);
  }

  /** Majorité des votes (null si égalité ou personne). */
  function majority(): number | null {
    const count = new Map<number, number>();
    for (const { p } of alive()) if (p.pick >= 0) count.set(p.pick, (count.get(p.pick) ?? 0) + 1);
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

  function endVote() {
    const v = majority();
    lastOut = v ?? -1;
    if (v === null) {
      headline = fr ? 'Égalité : personne ne sort.' : 'Tie: nobody is out.';
      sub = '';
    } else {
      pls[v].alive = false;
      pls[v].diedAt = ++deaths;
      sfx.pet();
      if (!pls[v].bot) ctx.buzz(pls[v].pid, 500);
      headline = fr ? `${pls[v].profile.name} est éliminé…` : `${pls[v].profile.name} is out…`;
      sub = fr ? `C’était : ${roleName(pls[v].role)} !` : `They were: ${roleName(pls[v].role)}!`;
    }
    speak(`${headline} ${sub}`, ctx.lang);
    go('reveal', T_REVEAL);
  }

  function bot(i: number) {
    const p = pls[i];
    if (!p.alive) return;
    if (phase === 'clues' && turnOrder[turnPos] === i) {
      // Les bots piochent un mot du thème (Mr White aussi, au flair)
      const w = pool[Math.floor(Math.random() * pool.length)] ?? '…';
      giveClue(i, w);
    } else if (phase === 'debate') p.ready = true;
    else if (phase === 'vote' && p.pick < 0) {
      const others = alive().filter((x) => x.i !== i);
      p.pick = others[Math.floor(Math.random() * others.length)]?.i ?? -1;
    } else if (phase === 'guess' && i === lastOut) {
      // Un bot Mr White devine rarement juste
      if (Math.random() < 0.25) {
        winner = 'white';
        finish();
      } else afterGuess(false, pool[0] ?? '?');
    }
  }

  function afterGuess(ok: boolean, guess: string) {
    if (ok) {
      winner = 'white';
      finish();
      return;
    }
    headline = fr ? `« ${guess} » : raté !` : `“${guess}”: wrong!`;
    sub = '';
    speak(headline, ctx.lang);
    timer = 0.01;
    phase = 'reveal';
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const i = pls.findIndex((p) => p.pid === pid);
      const p = pls[i];
      if (!p) return;
      if (m.a === 'clue' && phase === 'clues' && turnOrder[turnPos] === i && p.alive) giveClue(i, m.s ?? '');
      else if (m.a === 'ready' && phase === 'debate' && p.alive) p.ready = true;
      else if (m.a === 'pick' && phase === 'vote' && p.alive) {
        const k = m.n?.[0] ?? -1;
        if (k >= 0 && k < pls.length && k !== i && pls[k].alive) {
          p.pick = k;
          sfx.click();
        }
      } else if (m.a === 'guess' && phase === 'guess' && i === lastOut) {
        const g = (m.s ?? '').trim();
        afterGuess(norm(g) === norm(civilWord), g || '?');
      }
      ctx.refresh();
    },
    update(dt) {
      timer -= dt;
      botT -= dt;
      if (botT <= 0) {
        botT = rnd(1.5, 3.5);
        if (phase === 'clues') {
          const cur = turnOrder[turnPos];
          if (cur !== undefined && pls[cur].bot) bot(cur);
        } else pls.forEach((p, i) => p.bot && bot(i));
      }
      const a = alive().map((x) => x.p);
      if (phase === 'debate' && a.every((p) => p.ready)) timer = Math.min(timer, 1);
      if (phase === 'vote' && a.every((p) => p.pick >= 0)) timer = Math.min(timer, 1.5);
      if (timer > 0) return;
      switch (phase) {
        case 'roles':
          startClues();
          break;
        case 'clues':
          // Trop lent : indice vide
          giveClue(turnOrder[turnPos], '…');
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
        case 'reveal':
          if (lastOut >= 0 && pls[lastOut].role === 'white' && !pls[lastOut].note.startsWith('#')) {
            pls[lastOut].note = '#';
            headline = fr ? `Mr White, devine le mot des civils !` : 'Mr White, guess the civilians’ word!';
            sub = fr ? 'S’il trouve, il gagne tout seul.' : 'If right, he wins alone.';
            speak(headline, ctx.lang);
            go('guess', T_GUESS);
            break;
          }
          round++;
          if (checkWin()) break;
          startClues();
          break;
        case 'guess':
          afterGuess(false, '…');
          break;
        case 'end':
          game.over = true;
          break;
      }
    },
    render(g, t) {
      // Salle d'interrogatoire bonbon : fond violet, projecteur qui balaie
      g.drawImage(office(), 0, 0, 1920, 1080);
      if (!ctx.light) {
        // Cône de lumière de la lampe qui se balance + projecteur qui cherche un suspect
        const sw = Math.sin(t * 0.9) * 0.08;
        g.save();
        g.translate(960, 0);
        g.rotate(sw);
        g.fillStyle = 'rgba(255,240,170,0.13)';
        g.beginPath();
        g.moveTo(-70, 300);
        g.lineTo(70, 300);
        g.lineTo(520, 1080);
        g.lineTo(-520, 1080);
        g.closePath();
        g.fill();
        g.fillStyle = '#fff6c8';
        g.beginPath();
        g.arc(0, 302, 20, 0, Math.PI);
        g.fill();
        g.restore();
        const sx = 960 + Math.sin(t * 0.6) * 640;
        const grd = g.createRadialGradient(sx, 900, 20, sx, 900, 260);
        grd.addColorStop(0, 'rgba(255,214,10,0.25)');
        grd.addColorStop(1, 'rgba(255,214,10,0)');
        g.fillStyle = grd;
        g.fillRect(sx - 260, 640, 520, 440);
      }
      // Thème
      g.font = '700 32px Fredoka, sans-serif';
      const label = `${theme.emoji} ${theme.name[ctx.lang]}`;
      const lw = g.measureText(label).width + 50;
      g.fillStyle = SOLEIL;
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.beginPath();
      g.roundRect(60, 40, lw, 60, 30);
      g.fill();
      g.stroke();
      g.fillStyle = INK;
      g.textAlign = 'left';
      g.fillText(label, 85, 81);
      // Titre
      g.textAlign = 'center';
      g.font = '700 58px Fredoka, sans-serif';
      const hw = Math.max(440, g.measureText(headline).width + 90);
      g.fillStyle = ROSE;
      g.strokeStyle = INK;
      g.lineWidth = 8;
      g.beginPath();
      g.roundRect(960 - hw / 2, 116, hw, 84, 42);
      g.fill();
      g.stroke();
      g.fillStyle = '#fff';
      g.fillText(headline, 960, 177);
      g.font = '600 36px Fredoka, sans-serif';
      if (sub) {
        g.strokeText(sub, 960, 245);
        g.fillText(sub, 960, 245);
      }
      if (phase !== 'end' && phase !== 'reveal') {
        g.font = '700 44px Fredoka, sans-serif';
        g.fillStyle = timer < 6 ? ROSE : '#fff';
        g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 1790, 82);
      }
      // Joueurs en arc, avec leurs indices
      const cnt = pls.length;
      const cur = phase === 'clues' ? turnOrder[turnPos] : -1;
      pls.forEach((p, i) => {
        const a = Math.PI * (0.06 + (0.88 * i) / Math.max(1, cnt - 1));
        const x = 960 - Math.cos(a) * 800;
        const y = 1000 - Math.sin(a) * 300;
        const isCur = i === cur;
        drawCharacter(g, x, y - 30 + (isCur ? Math.sin(t * 8) * 6 : 0), isCur ? 130 : 110, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          ghost: !p.alive,
          mood: !p.alive ? 'sad' : isCur ? 'wow' : 'happy',
        });
        roundRectText(g, p.profile.name, x - 85, y - 8, 170, 26, p.profile.color);
        // Bulle avec l'indice de la manche
        const clue = p.clues[round - 1];
        if (clue && p.alive && phase !== 'end') {
          g.font = '700 34px Fredoka, sans-serif';
          const w = Math.max(110, g.measureText(clue).width + 40);
          const by = y - 200;
          g.fillStyle = '#fff';
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.beginPath();
          g.roundRect(x - w / 2, by - 34, w, 58, 22);
          g.fill();
          g.stroke();
          g.beginPath();
          g.moveTo(x - 12, by + 22);
          g.lineTo(x, by + 42);
          g.lineTo(x + 12, by + 22);
          g.fill();
          g.fillStyle = INK;
          g.textAlign = 'center';
          g.fillText(clue, x, by + 6);
        }
        if (isCur) {
          g.font = '44px sans-serif';
          g.textAlign = 'center';
          g.fillText('💬', x, y - 205 + Math.sin(t * 6) * 6);
        }
        // Anciens indices, en petit sous le nom
        const old = p.clues.slice(0, round - 1).filter(Boolean);
        if (old.length) {
          g.font = '600 28px Fredoka, sans-serif';
          g.fillStyle = '#d9ccff';
          g.textAlign = 'center';
          g.fillText(old.join(' · '), x, y + 50);
        }
        if (!p.alive || phase === 'end') {
          g.font = '700 28px Fredoka, sans-serif';
          g.fillStyle = p.role === 'civil' ? MENTHE : p.role === 'white' ? '#fff' : ROSE;
          g.fillText(`${roleName(p.role)}${phase === 'end' && p.word ? ` · ${p.word}` : ''}`, x, y + (old.length ? 86 : 50));
        }
        if (phase === 'vote' && p.alive) {
          g.font = '34px sans-serif';
          g.fillText(p.pick >= 0 ? '🗳️' : '…', x, y - 220);
        }
        if (phase === 'reveal' && lastVotes.get(i)) {
          g.font = '700 34px Fredoka, sans-serif';
          g.fillStyle = ROSE;
          g.fillText(`${lastVotes.get(i)} 🗳️`, x, y - 220);
        }
        if (phase === 'debate' && p.ready) {
          g.font = '34px sans-serif';
          g.fillText('✋', x, y - 220);
        }
      });
    },
    mapName: theme.name,
    ranking() {
      const won = (p: Pl) => (winner === 'white' ? p.role === 'white' : winner === 'impo' ? p.role !== 'civil' : p.role === 'civil');
      return [...pls].sort((a, b) => Number(won(b)) - Number(won(a)) || Number(b.alive) - Number(a.alive) || b.diedAt - a.diedAt).map((p) => p.pid);
    },
    leader() {
      return null;
    },
    padData(pid): UndercoverPadData {
      const i = pls.findIndex((p) => p.pid === pid);
      const p = pls[i];
      let act: UndercoverPadData['act'] = null;
      if (p.alive) {
        if (phase === 'clues' && turnOrder[turnPos] === i) act = 'clue';
        if (phase === 'debate' && !p.ready) act = 'ready';
        if (phase === 'vote') act = 'vote';
      }
      if (phase === 'guess' && i === lastOut) act = 'guess';
      const cur = turnOrder[turnPos];
      return {
        phase,
        word: p.word,
        theme: `${theme.emoji} ${theme.name[ctx.lang]}`,
        alive: p.alive,
        act,
        turn: phase === 'clues' && cur !== undefined ? pls[cur].profile.name : '',
        options: act === 'vote' ? alive().filter((x) => x.i !== i).map((x) => ({ i: x.i, name: x.p.profile.name, color: x.p.profile.color })) : [],
        picked: p.pick,
        note: p.note.startsWith('#') ? '' : p.note,
        left: Math.ceil(Math.max(0, timer)),
        myClues: p.clues.filter(Boolean),
      };
    },
  };
  return game;
}

export const undercover: GameBase = {
  id: 'undercover',
  emoji: '🕵️',
  name: { fr: 'Undercover', en: 'Undercover' },
  how: {
    fr: 'Un mot secret chacun. Donne un indice, démasque l’Undercover et Mr White !',
    en: 'A secret word each. Give a clue, unmask the Undercover and Mr White!',
  },
  inspired: 'Undercover',
  layout: 'buttons',
  min: 3,
  max: 12,
  botFill: 4,
  music: 'lobby',
  create,
};
