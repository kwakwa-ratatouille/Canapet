// Photo Roulette : chacun choisit des photos et petites vidéos de son téléphone. La télé les montre
// une par une ; les autres devinent sur leur téléphone de qui ça vient. Rien n'est gardé après la partie.
import { drawCharacter } from '../shared/characters';
import { INK, MENTHE, ROSE, SOLEIL } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { roundRectText } from './draw';
import type { RoulettePadData } from './rouletteShared';
import type { GameCtx, GameBase, GameInstance, Runner } from './types';

const T_UPLOAD = 120;
const T_SHOW = 15;
const T_REVEAL = 5;
const PER_PLAYER = 3;
const MAX_ROUNDS = 12;

interface Media {
  owner: number;
  video: boolean;
  url: string;
  img?: HTMLImageElement;
  vid?: HTMLVideoElement;
}

interface Pl extends Runner {
  media: Media[];
  /** Morceaux en cours de réception, par identifiant de fichier. */
  parts: Map<number, { got: string[]; total: number; video: boolean }>;
  ready: boolean;
  pick: number;
  pickAt: number;
  score: number;
  right: boolean | null;
  gain: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Les bots n'ont pas de galerie : on leur fabrique une « photo » rigolote. */
function botPicture(seed: number): string {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 480;
  const g = c.getContext('2d')!;
  const bg = ['#ffd6ec', '#d9f7ff', '#fff1c9', '#e3dbff', '#c9f5e3'][seed % 5];
  g.fillStyle = bg;
  g.fillRect(0, 0, 640, 480);
  g.font = '220px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(['🐈', '🍕', '🏖️', '🎂', '🐶', '🌈', '🍔', '🎸', '⚽', '🌋'][seed % 10], 320, 250);
  return c.toDataURL('image/jpeg', 0.8);
}

function dataUrlToBlobUrl(data: string): string {
  const [head, b64] = data.split(',');
  const mime = head.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mime }));
}

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  const pls: Pl[] = runners.map((r) => ({ ...r, media: [], parts: new Map(), ready: false, pick: -1, pickAt: 0, score: 0, right: null, gain: 0 }));
  let phase: RoulettePadData['phase'] = 'upload';
  let timer = T_UPLOAD;
  let deck: Media[] = [];
  let idx = -1;
  let showT = 0;
  let botT = rnd(1, 3);
  const videoMode = ctx.opts.kind === 1;
  let headline = videoMode ? (fr ? 'Ouvrez votre galerie de vidéos sur votre téléphone' : 'Open your video gallery on your phone') : fr ? 'Ouvrez votre galerie sur votre téléphone' : 'Open your gallery on your phone';
  const urls: string[] = [];

  function addMedia(p: Pl, i: number, data: string, video: boolean) {
    if (p.media.length >= 16) return;
    const url = dataUrlToBlobUrl(data);
    urls.push(url);
    const m: Media = { owner: i, video, url };
    if (video) {
      const v = document.createElement('video');
      v.src = url;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      m.vid = v;
    } else {
      const im = new Image();
      im.src = url;
      m.img = im;
    }
    p.media.push(m);
    sfx.pop();
    ctx.refresh();
  }

  // Les bots fournissent deux images chacun
  pls.forEach((p, i) => {
    if (!p.bot) return;
    for (let k = 0; k < 2; k++) addMedia(p, i, botPicture(i * 3 + k + Math.floor(Math.random() * 10)), false);
    p.ready = true;
  });

  function startGame() {
    // Jusqu'à 3 médias au hasard par joueur, mélangés, 12 au plus
    deck = pls.flatMap((p) => [...p.media].sort(() => Math.random() - 0.5).slice(0, PER_PLAYER)).sort(() => Math.random() - 0.5).slice(0, MAX_ROUNDS);
    if (deck.length === 0) {
      headline = fr ? 'Personne n’a envoyé de photo…' : 'Nobody sent a photo…';
      phase = 'end';
      timer = 4;
      return;
    }
    next();
  }

  function next() {
    current()?.vid?.pause();
    idx++;
    if (idx >= deck.length) {
      const best = [...pls].sort((a, b) => b.score - a.score)[0];
      headline = fr ? `${best.profile.name} connaît tout le monde par cœur !` : `${best.profile.name} knows everyone by heart!`;
      speak(headline, ctx.lang);
      sfx.win();
      phase = 'end';
      timer = 6;
      ctx.refresh();
      return;
    }
    pls.forEach((p) => {
      p.pick = -1;
      p.right = null;
      p.gain = 0;
    });
    const m = deck[idx];
    if (m.vid) {
      m.vid.currentTime = 0;
      m.vid.muted = false;
      void m.vid.play().catch(() => {
        m.vid!.muted = true;
        void m.vid!.play().catch(() => {});
      });
    }
    headline = fr ? 'À qui est cette photo ?' : 'Whose photo is this?';
    if (m.video) headline = fr ? 'À qui est cette vidéo ?' : 'Whose video is this?';
    sfx.tick();
    phase = 'show';
    timer = T_SHOW;
    showT = 0;
    botT = rnd(2, 6);
    ctx.refresh();
  }

  const current = () => (idx >= 0 ? deck[idx] : undefined);

  function reveal() {
    const m = current()!;
    const owner = pls[m.owner];
    pls.forEach((p, i) => {
      if (i === m.owner || p.pick < 0) return;
      p.right = p.pick === m.owner;
      if (p.right) {
        p.gain = 100 + Math.round(Math.max(0, 1 - p.pickAt / T_SHOW) * 50);
        p.score += p.gain;
        if (!p.bot) ctx.buzz(p.pid, 120);
      }
    });
    // Le propriétaire marque s'il a réussi à tromper la majorité
    const fooled = pls.filter((p, i) => i !== m.owner && p.pick >= 0 && !p.right).length;
    const voters = pls.filter((p, i) => i !== m.owner && p.pick >= 0).length;
    if (voters && fooled > voters / 2) {
      owner.gain = 50;
      owner.score += 50;
    }
    headline = fr ? `C’était à ${owner.profile.name} !` : `It was ${owner.profile.name}’s!`;
    speak(headline, ctx.lang);
    sfx.win();
    phase = 'reveal';
    timer = T_REVEAL;
    ctx.refresh();
  }

  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act') return;
      const i = pls.findIndex((p) => p.pid === pid);
      const p = pls[i];
      if (!p) return;
      if (m.a === 'up' && phase === 'upload' && m.n && m.s !== undefined) {
        // n = [id du fichier, numéro du morceau, nombre de morceaux, vidéo ?]
        const [id, part, total, video] = m.n;
        let e = p.parts.get(id);
        if (!e) {
          e = { got: [], total, video: !!video };
          p.parts.set(id, e);
        }
        e.got[part] = m.s;
        if (e.got.filter((x) => x !== undefined).length === e.total) {
          p.parts.delete(id);
          addMedia(p, i, e.got.join(''), e.video);
        }
        return;
      }
      if (m.a === 'ready' && phase === 'upload') {
        p.ready = true;
        sfx.join();
        ctx.refresh();
      }
      if (m.a === 'pick' && phase === 'show') {
        const k = m.n?.[0] ?? -1;
        if (k >= 0 && k < pls.length && i !== current()?.owner && k !== i) {
          p.pick = k;
          p.pickAt = showT;
          sfx.click();
          ctx.refresh();
        }
      }
    },
    update(dt) {
      timer -= dt;
      showT += dt;
      if (phase === 'upload') {
        const humans = pls.filter((p) => !p.bot);
        if (humans.length && humans.every((p) => p.ready && p.parts.size === 0) && timer > 2) timer = 2;
        if (timer <= 0) startGame();
        return;
      }
      if (phase === 'show') {
        const m = current()!;
        if ((botT -= dt) <= 0) {
          botT = 99;
          pls.forEach((p, i) => {
            if (p.bot && i !== m.owner && p.pick < 0) {
              const opts = pls.map((_, k) => k).filter((k) => k !== i);
              // Un bot a une chance sur trois de deviner juste
              p.pick = Math.random() < 0.33 ? m.owner : opts[Math.floor(Math.random() * opts.length)];
              p.pickAt = showT;
            }
          });
        }
        const voters = pls.filter((_, i) => i !== m.owner);
        if (voters.every((p) => p.pick >= 0)) timer = Math.min(timer, 0.8);
        if (timer <= 0) reveal();
        return;
      }
      if (phase === 'reveal' && timer <= 0) next();
      if (phase === 'end' && timer <= 0) {
        current()?.vid?.pause();
        urls.forEach((u) => URL.revokeObjectURL(u));
        game.over = true;
      }
    },
    render(g, t) {
      g.fillStyle = '#ffe3f1';
      g.fillRect(0, 0, 1920, 1080);
      // Petits pois en fond
      g.fillStyle = 'rgba(255,79,154,0.12)';
      for (let x = 40; x < 1920; x += 120) for (let y = 40; y < 1080; y += 120) {
        g.beginPath();
        g.arc(x + ((y / 120) % 2) * 60, y, 14, 0, Math.PI * 2);
        g.fill();
      }
      g.textAlign = 'center';
      g.fillStyle = INK;
      g.font = '700 60px Fredoka, sans-serif';
      g.fillText(headline, 960, 100);
      if (phase !== 'reveal' && phase !== 'end') {
        g.font = '700 44px Fredoka, sans-serif';
        g.fillStyle = timer < 5 ? ROSE : INK;
        g.fillText(`⏱ ${Math.ceil(Math.max(0, timer))}`, 1790, 100);
      }
      const m = current();
      if (phase === 'upload') {
        // Qui a envoyé quoi
        const cw = Math.min(260, 1700 / pls.length);
        pls.forEach((p, i) => {
          const x = 960 + (i - (pls.length - 1) / 2) * cw;
          drawCharacter(g, x, 640, 150, { food: p.profile.food, color: p.profile.color, hat: p.profile.hat, acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose, selfie: p.selfie, t: t + i, mood: p.ready ? 'win' : 'happy' });
          roundRectText(g, p.profile.name, x - 100, 680, 200, 26, p.profile.color);
          g.font = '700 40px Fredoka, sans-serif';
          g.fillStyle = INK;
          g.fillText(`📷 ${p.media.length}${p.parts.size ? ' …' : ''}`, x, 780);
          if (p.ready) {
            g.fillStyle = MENTHE;
            g.fillText(fr ? 'Prêt !' : 'Ready!', x, 830);
          }
        });
        g.font = '600 34px Fredoka, sans-serif';
        g.fillStyle = INK;
        g.fillText(fr ? 'Vos photos vont directement du téléphone à la télé et ne sont gardées nulle part.' : 'Your photos go straight from phone to TV and are not stored anywhere.', 960, 980);
        return;
      }
      if (m && phase !== 'end') {
        // Polaroïd au centre
        const el = m.vid ?? m.img;
        const nw = m.vid ? m.vid.videoWidth : m.img?.naturalWidth ?? 0;
        const nh = m.vid ? m.vid.videoHeight : m.img?.naturalHeight ?? 0;
        const maxW = 1100;
        const maxH = 570;
        const k = nw && nh ? Math.min(maxW / nw, maxH / nh) : 1;
        const w = nw ? nw * k : 800;
        const h = nh ? nh * k : 600;
        const x = 960 - w / 2;
        const y = 160 + (maxH - h) / 2;
        g.save();
        g.translate(960, y + h / 2);
        g.rotate(Math.sin(idx * 2.3) * 0.025);
        g.translate(-960, -(y + h / 2));
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(x - 24, y - 24 + 12, w + 48, h + 90, 24);
        g.fill();
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(x - 24, y - 24, w + 48, h + 90, 24);
        g.fill();
        g.stroke();
        if (el && nw) g.drawImage(el, x, y, w, h);
        else {
          g.fillStyle = '#eee';
          g.fillRect(x, y, w, h);
        }
        g.font = '700 34px Fredoka, sans-serif';
        g.fillStyle = INK;
        g.fillText(`${idx + 1} / ${deck.length}${m.video ? ' 🎬' : ''}`, 960, y + h + 50);
        g.restore();
      }
      // Joueurs en bas : qui a voté, puis qui avait raison
      const cw = Math.min(220, 1760 / pls.length);
      pls.forEach((p, i) => {
        const x = 960 + (i - (pls.length - 1) / 2) * cw;
        const isOwner = phase === 'reveal' && m && i === m.owner;
        drawCharacter(g, x, 1000 - (isOwner ? 30 + Math.abs(Math.sin(t * 6)) * 20 : 0), isOwner ? 130 : 96, {
          food: p.profile.food,
          color: p.profile.color,
          hat: p.profile.hat,
          acc: p.profile.acc,
          eyes: p.profile.eyes,
          pose: p.profile.pose,
          selfie: p.selfie,
          t: t + i,
          mood: isOwner ? 'win' : phase === 'reveal' && p.right === false ? 'sad' : 'happy',
        });
        roundRectText(g, `${p.profile.name} · ${p.score}`, x - cw / 2 + 8, 1022, cw - 16, 24, p.profile.color);
        g.font = '700 36px Fredoka, sans-serif';
        if (phase === 'show' && p.pick >= 0) {
          g.fillStyle = MENTHE;
          g.fillText('✓', x + 40, 880);
        }
        if (phase === 'reveal' && p.gain) {
          g.fillStyle = SOLEIL;
          g.strokeStyle = INK;
          g.lineWidth = 8;
          g.strokeText(`+${p.gain}`, x, 860);
          g.fillText(`+${p.gain}`, x, 860);
        }
        if (phase === 'reveal' && p.right === false) {
          g.font = '34px sans-serif';
          g.fillText('❌', x, 860);
        }
      });
    },
    ranking() {
      return [...pls].sort((a, b) => b.score - a.score).map((p) => p.pid);
    },
    leader() {
      return null;
    },
    padData(pid): RoulettePadData {
      const i = pls.findIndex((p) => p.pid === pid);
      const p = pls[i];
      const m = current();
      let act: RoulettePadData['act'] = null;
      if (phase === 'upload') act = 'upload';
      else if (phase === 'show' && m) act = i === m.owner ? 'owner' : 'vote';
      return {
        phase,
        sent: p.media.length,
        video: videoMode,
        ready: p.ready,
        act,
        options: act === 'vote' ? pls.map((x, k) => ({ i: k, name: x.profile.name, color: x.profile.color })).filter((o) => o.i !== i) : [],
        picked: p.pick,
        right: p.right,
        score: p.score,
        left: Math.ceil(Math.max(0, timer)),
      };
    },
  };
  return game;
}

export const roulette: GameBase = {
  id: 'roulette',
  emoji: '📸',
  name: { fr: 'Photo Roulette', en: 'Photo Roulette' },
  how: {
    fr: 'Envoie des photos et vidéos de ton téléphone. Devine à qui sont celles des autres !',
    en: 'Send photos and videos from your phone. Guess whose the others are!',
  },
  inspired: 'Photo Roulette',
  layout: 'buttons',
  min: 3,
  max: 12,
  botFill: 0,
  options: [
    {
      id: 'kind',
      label: { fr: 'Version', en: 'Version' },
      choices: [
        { v: 0, label: { fr: '📸 Photo Roulette', en: '📸 Photo Roulette' } },
        { v: 1, label: { fr: '🎬 Vidéo Roulette', en: '🎬 Video Roulette' } },
      ],
    },
  ],
  music: 'lobby',
  create,
};
