// Le Grand Plateau : on lance le dé sur son téléphone, on gagne des bonbons, on achète des Coussins d'or.
// Après chaque tour, un mini-jeu (tapotage ou réflexe). Le plus de Coussins d'or gagne.
import { drawCharacter } from '../shared/characters';
import { sfx, speak } from '../shared/sound';
import type { BoardPadData } from './boardShared';
import { roundRectText } from './draw';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';
import { INK } from '../shared/palette';

const ROUNDS = 5;
const SPACES = 26;
const STAR_PRICE = 20;

type Space = 'bleu' | 'rouge' | 'vert';
type Phase = 'roll' | 'dice' | 'move' | 'land' | 'miniIntro' | 'tap' | 'react' | 'coin' | 'miniEnd' | 'end';

interface Pl extends Runner {
  pos: number;
  candies: number;
  stars: number;
  taps: number;
  reactAt: number;
  early: boolean;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Plateaux : chaque partie en tire un au hasard (forme du chemin et couleurs). */
const BOARDS: { name: { fr: string; en: string }; bg: string; inner: string; spot: (a: number) => { x: number; y: number } }[] = [
  {
    name: { fr: 'L’Ovale', en: 'The Oval' },
    bg: '#c9f0e0',
    inner: '#fff3c4',
    spot: (a) => ({ x: 960 + Math.cos(a) * 760, y: 560 + Math.sin(a) * 360 }),
  },
  {
    name: { fr: 'Le Grand Salon', en: 'The Living Room' },
    bg: '#ffe3f1',
    inner: '#ffffff',
    // Rectangle aux coins arrondis (superellipse)
    spot: (a) => {
      const c = Math.cos(a);
      const s = Math.sin(a);
      return { x: 960 + Math.sign(c) * Math.pow(Math.abs(c), 0.35) * 780, y: 560 + Math.sign(s) * Math.pow(Math.abs(s), 0.35) * 380 };
    },
  },
  {
    name: { fr: 'Le Cœur', en: 'The Heart' },
    bg: '#ffd6ea',
    inner: '#fff0f7',
    spot: (a) => {
      const t = a + Math.PI / 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      return { x: 960 + x * 46, y: 520 - y * 27 };
    },
  },
];
// Cases du plateau en cours (une seule partie à la fois).
let SPOTS: { x: number; y: number }[] = [];

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const boardDef = BOARDS[Math.floor(Math.random() * BOARDS.length)];
  SPOTS = Array.from({ length: SPACES }, (_, i) => boardDef.spot((i / SPACES) * Math.PI * 2 - Math.PI / 2));
  const pls: Pl[] = runners.slice(0, 8).map((r) => ({ ...r, pos: 0, candies: 10, stars: 0, taps: 0, reactAt: -1, early: false }));
  const spaces: Space[] = Array.from({ length: SPACES }, (_, i) => (i === 0 ? 'bleu' : Math.random() < 0.18 ? 'vert' : Math.random() < 0.3 ? 'rouge' : 'bleu'));
  let star = 8 + Math.floor(Math.random() * 10);
  let round = 1;
  let turn = 0;
  let phase: Phase = 'roll';
  let timer = 15;
  let dice = 1;
  let steps = 0;
  let hop = 0;
  let message = '';
  let mini: 'tap' | 'react' | 'coin' = 'tap';
  let coin = 0;
  const coinPick = new Map<string, number>();
  let goAt = 0;
  let time = 0;
  let miniResult: string[] = [];

  const cur = () => pls[turn];
  const name = (p: Pl) => p.profile.name;

  function say(s: string, voice = false) {
    message = s;
    if (voice) speak(s, ctx.lang);
  }

  function startTurn() {
    phase = 'roll';
    timer = cur().bot ? rnd(1, 2) : 15;
    say(fr ? `À ${name(cur())} de lancer le dé !` : `${name(cur())}, roll the die!`);
    if (!cur().bot) ctx.buzz(cur().pid, 150);
    ctx.refresh();
  }

  function roll() {
    if (phase !== 'roll') return;
    dice = 1 + Math.floor(Math.random() * 6);
    phase = 'dice';
    timer = 1.1;
    sfx.tick();
    ctx.refresh();
  }

  function land() {
    const p = cur();
    const s = spaces[p.pos];
    phase = 'land';
    timer = 2;
    if (s === 'bleu') {
      p.candies += 3;
      say(fr ? `${name(p)} gagne 3 bonbons 🍬` : `${name(p)} gets 3 candies 🍬`);
      sfx.join();
    } else if (s === 'rouge') {
      p.candies = Math.max(0, p.candies - 3);
      say(fr ? `${name(p)} perd 3 bonbons…` : `${name(p)} loses 3 candies…`);
      sfx.pet();
    } else {
      const r = Math.random();
      if (r < 0.35 && pls.length > 1) {
        const o = pls.filter((x) => x !== p)[Math.floor(Math.random() * (pls.length - 1))];
        [p.pos, o.pos] = [o.pos, p.pos];
        say(fr ? `Tornade ! ${name(p)} échange sa place avec ${name(o)} !` : `Twister! ${name(p)} swaps places with ${name(o)}!`, true);
      } else if (r < 0.7) {
        p.candies += 8;
        say(fr ? `Jackpot ! ${name(p)} gagne 8 bonbons !` : `Jackpot! ${name(p)} wins 8 candies!`, true);
      } else {
        p.candies = Math.floor(p.candies / 2);
        say(
          ctx.family
            ? fr ? `Oups ! ${name(p)} perd la moitié de ses bonbons.` : `Oops! ${name(p)} loses half their candies.`
            : fr ? `Prout ! ${name(p)} perd la moitié de ses bonbons.` : `Toot! ${name(p)} loses half their candies.`,
          true,
        );
        sfx.pet();
      }
    }
    ctx.refresh();
  }

  function startMini() {
    mini = (['coin', 'tap', 'react'] as const)[round % 3];
    coinPick.clear();
    phase = 'miniIntro';
    timer = 3;
    pls.forEach((p) => {
      p.taps = 0;
      p.reactAt = -1;
      p.early = false;
    });
    say(
      mini === 'tap'
        ? fr ? 'Mini-jeu : Tapotage ! Tape le plus vite possible.' : 'Mini-game: Tap frenzy! Tap as fast as you can.'
        : mini === 'react'
          ? fr ? 'Mini-jeu : Réflexe ! Appuie dès que c’est vert.' : 'Mini-game: Reflex! Press as soon as it turns green.'
          : fr ? 'Mini-jeu : Pile ou Face ! Choisis sur ton téléphone.' : 'Mini-game: Heads or Tails! Pick on your phone.',
      true,
    );
    ctx.refresh();
  }

  function endMini() {
    if (mini === 'coin') {
      coin = Math.random() < 0.5 ? 0 : 1;
      const winners = pls.filter((p) => coinPick.get(p.pid) === coin);
      winners.forEach((p) => (p.candies += 6));
      miniResult = [
        (fr ? (coin ? 'C’est FACE !' : 'C’est PILE !') : coin ? 'TAILS!' : 'HEADS!'),
        ...winners.slice(0, 4).map((p) => `🍬 ${name(p)} +6`),
      ];
      phase = 'miniEnd';
      timer = 3.5;
      say(miniResult[0], true);
      sfx.win();
      ctx.refresh();
      return;
    }
    const order =
      mini === 'tap'
        ? [...pls].sort((a, b) => b.taps - a.taps)
        : [...pls].filter((p) => !p.early && p.reactAt >= 0).sort((a, b) => a.reactAt - b.reactAt);
    const prizes = [10, 6, 3];
    miniResult = order.slice(0, 3).map((p, i) => {
      p.candies += prizes[i];
      return `${['🥇', '🥈', '🥉'][i]} ${name(p)} +${prizes[i]}`;
    });
    phase = 'miniEnd';
    timer = 3.5;
    say(order[0] ? (fr ? `${name(order[0])} gagne le mini-jeu !` : `${name(order[0])} wins the mini-game!`) : '…', true);
    sfx.win();
    ctx.refresh();
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const p = pls.find((x) => x.pid === pid);
      if (!p) return;
      if (m.a === 'roll' && p === cur()) roll();
      if (m.a === 'tap' && phase === 'tap') p.taps++;
      if (m.a === 'coin' && phase === 'coin' && !coinPick.has(p.pid)) {
        coinPick.set(p.pid, m.n?.[0] ? 1 : 0);
        ctx.refresh();
      }
      if (m.a === 'tap' && phase === 'react' && p.reactAt < 0 && !p.early) {
        if (time < goAt) p.early = true;
        else p.reactAt = time - goAt;
        ctx.refresh();
      }
    },
    update(dt) {
      time += dt;
      timer -= dt;
      // Bots pendant les mini-jeux
      if (phase === 'tap') for (const p of pls) if (p.bot && Math.random() < dt * rnd(5, 8)) p.taps++;
      if (phase === 'react' && time >= goAt)
        for (const p of pls) if (p.bot && p.reactAt < 0 && time - goAt > rnd(0.25, 0.7)) p.reactAt = time - goAt;
      if (phase === 'move') {
        hop += dt;
        if (hop >= 0.28) {
          hop = 0;
          const p = cur();
          p.pos = (p.pos + 1) % SPACES;
          steps--;
          sfx.step();
          if (p.pos === star && p.candies >= STAR_PRICE) {
            p.candies -= STAR_PRICE;
            p.stars++;
            star = (star + 7 + Math.floor(Math.random() * 10)) % SPACES;
            say(fr ? `${name(p)} achète un Coussin d’or ! 🛋️✨` : `${name(p)} buys a Golden Cushion! 🛋️✨`, true);
            sfx.win();
          }
          if (steps <= 0) land();
        }
        return;
      }
      if (timer > 0) return;
      switch (phase) {
        case 'roll':
          roll();
          break;
        case 'dice':
          steps = dice;
          hop = 0;
          phase = 'move';
          say(fr ? `${name(cur())} fait ${dice} !` : `${name(cur())} rolls ${dice}!`);
          break;
        case 'land':
          turn++;
          if (turn >= pls.length) {
            turn = 0;
            startMini();
          } else startTurn();
          break;
        case 'miniIntro':
          if (mini === 'tap') {
            phase = 'tap';
            timer = 6;
          } else if (mini === 'coin') {
            phase = 'coin';
            timer = 6;
            for (const p of pls) if (p.bot) coinPick.set(p.pid, Math.random() < 0.5 ? 0 : 1);
          } else {
            phase = 'react';
            goAt = time + rnd(2, 5);
            timer = goAt - time + 2.5;
            setTimeout(() => ctx.refresh(), (goAt - time) * 1000);
          }
          ctx.refresh();
          break;
        case 'tap':
        case 'react':
        case 'coin':
          endMini();
          break;
        case 'miniEnd':
          round++;
          if (round > ROUNDS) {
            phase = 'end';
            timer = 4;
            const w = [...pls].sort((a, b) => b.stars - a.stars || b.candies - a.candies)[0];
            say(fr ? `${name(w)} remporte le Grand Plateau !` : `${name(w)} wins the Big Board!`, true);
            ctx.refresh();
          } else startTurn();
          break;
        case 'end':
          game.over = true;
          break;
      }
    },
    render(g, t) {
      g.fillStyle = boardDef.bg;
      g.fillRect(0, 0, 1920, 1080);
      g.fillStyle = boardDef.inner;
      g.beginPath();
      g.ellipse(960, 560, 640, 260, 0, 0, Math.PI * 2);
      g.fill();
      // Chemin
      g.strokeStyle = '#ffffff';
      g.lineWidth = 34;
      g.beginPath();
      SPOTS.forEach((s, i) => (i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y)));
      g.closePath();
      g.stroke();
      SPOTS.forEach((s, i) => {
        g.fillStyle = spaces[i] === 'bleu' ? '#2ec5ff' : spaces[i] === 'rouge' ? '#ff3b3b' : '#7bd13b';
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(s.x, s.y, 34, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        if (spaces[i] === 'vert') {
          g.fillStyle = '#fff';
          g.font = '700 30px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.fillText('?', s.x, s.y + 11);
        }
        if (i === star) {
          g.font = '54px sans-serif';
          g.textAlign = 'center';
          g.fillText('⭐', s.x, s.y - 40 + Math.sin(t * 4) * 6);
        }
      });
      // Pions
      pls.forEach((p, i) => {
        const same = pls.filter((o) => o.pos === p.pos);
        const k = same.indexOf(p);
        const s = SPOTS[p.pos];
        const off = (k - (same.length - 1) / 2) * 34;
        const jump = p === cur() && phase === 'move' ? Math.sin((hop / 0.28) * Math.PI) * 40 : 0;
        drawCharacter(g, s.x + off, s.y + 10 - jump, 70, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
        });
      });
      // Classement au centre
      const ranked = [...pls].sort((a, b) => b.stars - a.stars || b.candies - a.candies);
      ranked.forEach((p, r) => {
        const y = 400 + r * 44;
        roundRectText(g, p.profile.name, 700, y, 220, 26, p.profile.color);
        g.fillStyle = INK;
        g.font = '600 28px Fredoka, sans-serif';
        g.textAlign = 'left';
        g.fillText(`🛋️ ${p.stars}   🍬 ${p.candies}`, 940, y + 10);
      });
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.font = '700 40px Fredoka, sans-serif';
      g.fillText(`${fr ? 'Tour' : 'Round'} ${Math.min(round, ROUNDS)}/${ROUNDS} · ⭐ = ${STAR_PRICE} 🍬`, 960, 330);
      // Dé
      if (phase === 'dice' || phase === 'roll') {
        const v = phase === 'dice' ? 1 + Math.floor(Math.random() * 6) : dice;
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(1440, 380, 160, 160, 28);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.font = '700 110px Fredoka, sans-serif';
        g.fillText(phase === 'roll' ? '🎲' : String(v), 1520, 500);
      }
      // Mini-jeux en plein écran
      if (phase === 'miniIntro' || phase === 'tap' || phase === 'react' || phase === 'coin' || phase === 'miniEnd') {
        g.fillStyle = 'rgba(58,33,64,0.85)';
        g.fillRect(0, 0, 1920, 1080);
        g.fillStyle = '#fff';
        g.font = '700 70px Fredoka, sans-serif';
        g.fillText(mini === 'tap' ? (fr ? 'Tapotage !' : 'Tap frenzy!') : mini === 'react' ? (fr ? 'Réflexe !' : 'Reflex!') : fr ? 'Pile ou Face !' : 'Heads or Tails!', 960, 150);
        if (phase === 'coin' || (phase === 'miniIntro' && mini === 'coin')) {
          g.fillStyle = '#ffd60a';
          g.strokeStyle = INK;
          g.lineWidth = 8;
          g.beginPath();
          g.ellipse(960, 480, 180 * Math.abs(Math.cos(t * 6)) + 10, 180, 0, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.fillStyle = '#fff';
          g.font = '700 40px Fredoka, sans-serif';
          g.fillText(fr ? `Choix faits : ${coinPick.size}/${pls.length}` : `Picks: ${coinPick.size}/${pls.length}`, 960, 780);
          if (phase === 'coin') g.fillText(`⏱ ${Math.ceil(timer)}`, 960, 850);
        }
        if (phase === 'tap' || (phase === 'miniIntro' && mini === 'tap')) {
          const max = Math.max(20, ...pls.map((p) => p.taps));
          pls.forEach((p, i) => {
            const y = 260 + i * 90;
            roundRectText(g, p.profile.name, 300, y, 220, 30, p.profile.color);
            g.fillStyle = p.profile.color;
            g.fillRect(540, y - 22, (1000 * p.taps) / max, 44);
            g.fillStyle = '#fff';
            g.textAlign = 'left';
            g.font = '700 34px Fredoka, sans-serif';
            g.fillText(String(p.taps), 560 + (1000 * p.taps) / max, y + 12);
            g.textAlign = 'center';
          });
          if (phase === 'tap') g.fillText(`⏱ ${Math.ceil(timer)}`, 960, 1000);
        }
        if (phase === 'react' || (phase === 'miniIntro' && mini === 'react')) {
          const go = phase === 'react' && time >= goAt;
          g.fillStyle = go ? '#7bd13b' : '#ff3b3b';
          g.beginPath();
          g.arc(960, 520, 230, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#fff';
          g.font = '700 90px Fredoka, sans-serif';
          g.fillText(go ? (fr ? 'MAINTENANT !' : 'NOW!') : fr ? 'Attends…' : 'Wait…', 960, 550);
          g.font = '600 34px Fredoka, sans-serif';
          pls.forEach((p, i) => {
            const txt = p.early ? '❌' : p.reactAt >= 0 ? `${Math.round(p.reactAt * 1000)} ms` : '…';
            g.fillText(`${p.profile.name} ${txt}`, 240 + (i % 4) * 480, 860 + Math.floor(i / 4) * 60);
          });
        }
        if (phase === 'miniEnd') {
          g.font = '700 54px Fredoka, sans-serif';
          miniResult.forEach((r, i) => g.fillText(r, 960, 420 + i * 90));
        }
      }
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, 1000, 1920, 80);
      g.fillStyle = '#fff';
      g.font = '600 38px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.fillText(message, 960, 1052);
    },
    mapName: boardDef.name,
    ranking() {
      return [...pls].sort((a, b) => b.stars - a.stars || b.candies - a.candies).map((p) => p.pid);
    },
    leader() {
      return null;
    },
    padData(pid): BoardPadData {
      const p = pls.find((x) => x.pid === pid)!;
      let mode: BoardPadData['mode'] = 'wait';
      if (phase === 'roll' && p === cur()) mode = 'roll';
      if (phase === 'tap') mode = 'tap';
      if (phase === 'coin') mode = coinPick.has(pid) ? 'wait' : 'coin';
      if (phase === 'react') mode = 'react';
      return {
        mode,
        go: phase === 'react' && time >= goAt,
        early: p.early,
        taps: p.taps,
        candies: p.candies,
        stars: p.stars,
        info: message,
      };
    },
  };
  startTurn();
  return game;
}

export const board: GameBase = {
  id: 'plateau',
  emoji: '🎲',
  name: { fr: 'Le Grand Plateau', en: 'The Big Board' },
  how: {
    fr: 'Lance le dé, ramasse des bonbons, achète des Coussins d’or !',
    en: 'Roll the die, grab candies, buy Golden Cushions!',
  },
  inspired: 'Mario Party',
  layout: 'buttons',
  min: 2,
  max: 8,
  botFill: 4,
  music: 'lobby',
  limit: 480,
  create,
};
