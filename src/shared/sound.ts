// Tous les sons sont fabriqués par le code (Web Audio) : aucune musique ni bruitage d'un autre jeu.
import type { Lang } from './protocol';

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ctx(): AudioContext | null {
  if (!ac) {
    try {
      ac = new AudioContext();
      master = ac.createGain();
      master.gain.value = 0.7;
      master.connect(ac.destination);
    } catch {
      return null;
    }
  }
  return ac;
}

export function unlockAudio() {
  const c = ctx();
  if (c && c.state === 'suspended') void c.resume();
}

export function audioLocked(): boolean {
  return !ac || ac.state !== 'running';
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.7;
  if (m) speechSynthesis?.cancel();
}

export function isMuted() {
  return muted;
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number) {
  const c = ctx();
  if (!c || !master) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(dur: number, vol: number, freq: number, at = 0, q = 1) {
  const c = ctx();
  if (!c || !master) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + at;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t0);
  s.stop(t0 + dur);
}

export const sfx = {
  pop() {
    tone(520, 0.12, 'sine', 0.3, 0, 1100);
  },
  join() {
    tone(660, 0.1, 'triangle', 0.25);
    tone(990, 0.15, 'triangle', 0.25, 0.08);
  },
  leave() {
    tone(500, 0.2, 'triangle', 0.2, 0, 250);
  },
  tick() {
    tone(880, 0.08, 'square', 0.12);
  },
  go() {
    tone(1320, 0.35, 'square', 0.15);
    tone(660, 0.35, 'triangle', 0.2);
  },
  step() {
    noise(0.05, 0.12, 2500, 0, 2);
  },
  click() {
    tone(1200, 0.03, 'square', 0.05);
  },
  boing() {
    tone(180, 0.3, 'sine', 0.35, 0, 520);
  },
  /** Le bruit signature de Cana'pet. */
  pet() {
    const c = ctx();
    if (!c || !master) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lg = c.createGain();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(95 + Math.random() * 30, t0);
    o.frequency.exponentialRampToValueAtTime(55, t0 + 0.6);
    lfo.frequency.value = 22 + Math.random() * 10;
    lg.gain.value = 25;
    lfo.connect(lg).connect(o.frequency);
    f.type = 'lowpass';
    f.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
    o.connect(f).connect(g).connect(master);
    o.start(t0);
    lfo.start(t0);
    o.stop(t0 + 0.7);
    lfo.stop(t0 + 0.7);
    noise(0.4, 0.15, 300, 0, 0.7);
  },
  win() {
    [72, 76, 79, 84].forEach((n, i) => tone(midi(n), 0.3, 'square', 0.12, i * 0.12));
    tone(midi(88), 0.6, 'triangle', 0.2, 0.5);
  },
  finish() {
    tone(midi(79), 0.12, 'square', 0.12);
    tone(midi(84), 0.25, 'square', 0.12, 0.1);
  },
};

// ——— Musique : petit séquenceur, un morceau original par ambiance ———

interface Track {
  bpm: number;
  chords: number[][]; // une mesure par accord (notes MIDI)
  arp: 'up' | 'bounce';
  wave: OscillatorType;
}

const TRACKS: Record<string, Track> = {
  lobby: {
    bpm: 104,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]],
    arp: 'bounce',
    wave: 'triangle',
  },
  race: {
    bpm: 150,
    chords: [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]],
    arp: 'up',
    wave: 'square',
  },
  podium: {
    bpm: 120,
    chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]],
    arp: 'up',
    wave: 'triangle',
  },
};

let timer = 0;
let current = '';
let nextTime = 0;
let stepIdx = 0;

function schedule() {
  const c = ctx();
  if (!c || !current) return;
  const tr = TRACKS[current];
  const stepDur = 60 / tr.bpm / 2; // croches
  while (nextTime < c.currentTime + 0.15) {
    const bar = Math.floor(stepIdx / 8) % tr.chords.length;
    const s = stepIdx % 8;
    const ch = tr.chords[bar];
    const at = nextTime - c.currentTime;
    if (s === 0 || s === 4) {
      tone(midi(ch[0] - 24), stepDur * 1.8, 'triangle', 0.22, at);
      tone(140, 0.12, 'sine', 0.3, at, 45);
    }
    if (s === 2 || s === 6) noise(0.08, 0.06, 1800, at, 0.8);
    if (s % 2 === 1) noise(0.03, 0.04, 8000, at, 1);
    const idx = tr.arp === 'up' ? s % ch.length : [0, 1, 2, 1, 3, 2, 1, 2][s] % ch.length;
    tone(midi(ch[idx] + 12), stepDur * 0.9, tr.wave, tr.wave === 'square' ? 0.035 : 0.07, at);
    nextTime += stepDur;
    stepIdx++;
  }
}

export function playMusic(track: keyof typeof TRACKS | '') {
  if (track === current) return;
  current = track;
  clearInterval(timer);
  if (!track) return;
  const c = ctx();
  if (!c) return;
  nextTime = c.currentTime + 0.05;
  stepIdx = 0;
  timer = window.setInterval(schedule, 40);
}

// ——— Présentateur (voix de synthèse du navigateur) ———

export function speak(text: string, lang: Lang) {
  if (muted || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
  if (voice) u.voice = voice;
  u.rate = 1.05;
  u.pitch = 1.15;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
