// Crie Plus Fort : ton perso avance selon le volume de ta voix. Mais quand c'est CHUT, celui qui fait du bruit recule !
// Seul un chiffre de volume quitte le téléphone : le son lui-même n'est ni envoyé ni gardé.
import { drawCharacter } from '../shared/characters';
import { INK } from '../shared/palette';
import { playMusic, sfx, speak, type MusicId } from '../shared/sound';
import { candy } from './draw';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

export interface ShoutPadData {
  phase: 'go' | 'warn' | 'chut' | 'end';
  dist: number;
  rank: number;
  of: number;
  left: number;
}

const RACE_TIME = 50;

interface Pl extends Runner {
  dist: number;
  level: number;
  heard: number;
  shake: number;
  done: number;
  botPlan: number;
}

function createShout(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls: Pl[] = runners.map((r) => ({ ...r, dist: 0, level: 0, heard: 0, shake: 0, done: 0, botPlan: Math.random() }));
  let phase: ShoutPadData['phase'] = 'go';
  let left = RACE_TIME;
  let cycle = 5 + Math.random() * 3;
  let finishers = 0;
  let endT = 0;
  let started = false;
  let clock = 0;
  let last = '';

  const order = () => [...pls].sort((a, b) => (a.done && b.done ? a.done - b.done : a.done ? -1 : b.done ? 1 : b.dist - a.dist));
  const setPhase = (p: ShoutPadData['phase']) => {
    phase = p;
    if (p === 'warn') {
      cycle = 0.9;
      sfx.hurry();
    } else if (p === 'chut') {
      cycle = 1.8 + Math.random() * 1.6;
      sfx.alarm();
      speak(fr ? 'Chut !' : 'Shush!', ctx.lang, { rate: 1.1 });
      pls.forEach((x) => ctx.buzz(x.pid, 200));
    } else if (p === 'go') {
      cycle = 4 + Math.random() * 5;
      sfx.go();
      speak(fr ? 'Criez !' : 'Shout!', ctx.lang, { rate: 1.2 });
    }
    ctx.refresh();
  };

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const p = pls.find((x) => x.pid === pid);
      if (!p) return;
      if (m.a === 'vol') p.level = Math.max(0, Math.min(1, (m.n?.[0] ?? 0) / 100));
      // Sans micro : on tape comme un fou, ça vaut un petit cri
      if (m.a === 'tap') p.heard = Math.max(p.heard, 0.7);
    },
    update(dt) {
      if (!started) {
        started = true;
        playMusic('');
        speak(fr ? 'Criez pour avancer. Mais quand c’est rouge : silence !' : 'Shout to move. But when it’s red: silence!', ctx.lang);
        ctx.refresh();
      }
      clock += dt;
      if (phase === 'end') {
        endT -= dt;
        if (endT <= 0) game.over = true;
        return;
      }
      left -= dt;
      cycle -= dt;
      if (cycle <= 0) setPhase(phase === 'go' ? 'warn' : phase === 'warn' ? 'chut' : 'go');
      for (const p of pls) {
        if (p.bot) {
          // Les bots crient par vagues, et se font parfois avoir au feu rouge
          const v = 0.42 + Math.sin(clock * (1.4 + p.botPlan) + p.botPlan * 9) * 0.3 + ctx.botSkill * 0.18;
          p.level = phase === 'chut' ? (Math.sin(clock * 7 + p.botPlan * 20) > 0.75 - ctx.botSkill * 0.0 && ctx.botSkill < 0.9 && p.botPlan < 0.35 ? 0.6 : 0) : Math.max(0, v);
        }
        p.heard = Math.max(p.level, p.heard - dt * 2.6);
        if (p.done) continue;
        if (phase === 'chut') {
          if (p.heard > 0.3) {
            p.dist = Math.max(0, p.dist - dt * 26 * p.heard);
            p.shake = 0.4;
          }
        } else p.dist += dt * p.heard * p.heard * 5 + dt * (p.heard > 0.12 ? 0.6 : 0);
        p.shake = Math.max(0, p.shake - dt);
        if (p.dist >= 100) {
          p.dist = 100;
          p.done = ++finishers;
          sfx.finish();
          if (finishers === 1) speak(fr ? `${p.profile.name} a la plus grande gueule !` : `${p.profile.name} has the biggest mouth!`, ctx.lang);
        }
      }
      const leader = order()[0]?.pid ?? '';
      if (leader !== last) {
        last = leader;
        ctx.refresh();
      }
      if (left <= 0 || finishers >= Math.max(1, pls.filter((x) => !x.bot).length) || pls.every((x) => x.done)) {
        phase = 'end';
        endT = 3.5;
        sfx.win();
        ctx.refresh();
      }
    },
    render(g, t) {
      const chut = phase === 'chut';
      const warn = phase === 'warn';
      const bg = g.createLinearGradient(0, 0, 0, 1080);
      bg.addColorStop(0, chut ? '#8a1230' : warn ? '#b98a12' : '#27a86f');
      bg.addColorStop(1, chut ? '#3d0a24' : warn ? '#6d4c0b' : '#0f6b5a');
      g.fillStyle = bg;
      g.fillRect(0, 0, 1920, 1080);
      // Le grand panneau
      const s = 1 + Math.sin(t * (chut ? 18 : 8)) * 0.025;
      g.save();
      g.translate(960, 96);
      g.scale(s, s);
      g.fillStyle = chut ? '#ff3b5c' : warn ? '#ffd60a' : '#7bf0a6';
      g.strokeStyle = INK;
      g.lineWidth = 7;
      g.beginPath();
      g.roundRect(-430, -70, 860, 140, 40);
      g.fill();
      g.stroke();
      candy(g, -430, -70, 860, 140, 40);
      g.fillStyle = chut ? '#fff' : INK;
      g.font = '700 84px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(phase === 'end' ? (fr ? 'ARRIVÉE !' : 'FINISH!') : chut ? (fr ? '🤫 CHUUUT !' : '🤫 SHUSH!') : warn ? (fr ? '⚠️ ATTENTION…' : '⚠️ WATCH OUT…') : fr ? '📣 CRIEZ !' : '📣 SHOUT!', 0, 4);
      g.restore();
      g.fillStyle = '#fff';
      g.font = '700 44px Fredoka, sans-serif';
      g.textAlign = 'right';
      g.fillText(`⏱ ${Math.ceil(Math.max(0, left))}`, 1860, 96);
      // Les couloirs
      const n = pls.length;
      const top = 190;
      const h = Math.min(190, 860 / n);
      const startX = 240;
      const endX = 1720;
      pls.forEach((p, i) => {
        const y = top + i * h;
        g.fillStyle = i % 2 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.2)';
        g.fillRect(0, y, 1920, h - 6);
        // Arrivée en damier
        for (let k = 0; k < Math.floor(h / 22); k++) {
          g.fillStyle = k % 2 ? '#fff' : INK;
          g.fillRect(endX + 40, y + k * 22, 22, 22);
        }
        // Barre de volume à gauche
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath();
        g.roundRect(150, y + 10, 30, h - 26, 12);
        g.fill();
        const lv = Math.min(1, p.heard);
        g.fillStyle = lv > 0.7 ? '#ff3b5c' : lv > 0.35 ? '#ffd60a' : '#7bf0a6';
        g.beginPath();
        g.roundRect(150, y + 10 + (h - 26) * (1 - lv), 30, Math.max(6, (h - 26) * lv), 12);
        g.fill();
        const x = startX + (endX - startX) * (p.dist / 100) + (p.shake ? Math.sin(t * 60) * 12 : 0);
        const size = Math.min(130, h * 0.68);
        drawCharacter(g, x, y + h - 14, size, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          run: phase === 'chut' ? 0 : p.heard,
          mood: p.done ? 'win' : p.shake ? 'sad' : p.heard > 0.3 ? 'wow' : 'happy',
        });
        // Le cri qui sort de la bouche
        if (p.heard > 0.3 && !p.done) {
          g.fillStyle = '#fff';
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.font = `700 ${Math.round(30 + p.heard * 34)}px Fredoka, sans-serif`;
          g.textAlign = 'left';
          const word = 'A'.repeat(1 + Math.round(p.heard * 4)) + 'H !';
          g.strokeText(word, x + size * 0.42, y + h * 0.42);
          g.fillText(word, x + size * 0.42, y + h * 0.42);
        }
        if (p.shake) {
          g.fillStyle = '#fff';
          g.font = '700 34px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.fillText(fr ? 'PRIS !' : 'CAUGHT!', x, y + 26);
        }
        g.font = '700 28px Fredoka, sans-serif';
        g.fillStyle = '#fff';
        g.textAlign = 'right';
        g.fillText(p.profile.name.slice(0, 8), 138, y + h / 2);
      });
    },
    ranking: () => order().map((p) => p.pid),
    leader: () => order()[0]?.profile.name ?? null,
    padData(pid): ShoutPadData {
      const o = order();
      const p = pls.find((x) => x.pid === pid)!;
      return { phase, dist: Math.round(p.dist), rank: o.indexOf(p) + 1, of: o.length, left: Math.ceil(Math.max(0, left)) };
    },
  };
  return game;
}

export const shout: GameBase = {
  id: 'cri',
  emoji: '📣',
  name: { fr: 'Crie Plus Fort', en: 'Shout Louder' },
  how: { fr: 'Crie dans ton téléphone pour avancer. Quand c’est CHUT, le moindre bruit te fait reculer !', en: 'Shout into your phone to move. When it’s SHUSH, any noise pushes you back!' },
  layout: 'buttons',
  min: 2,
  max: 12,
  botFill: 3,
  music: '' as MusicId,
  create: createShout,
};
