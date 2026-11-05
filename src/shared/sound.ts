// Tous les sons sont fabriqués par le code (Web Audio) : aucune musique ni bruitage d'un autre jeu.
import type { Lang } from './protocol';

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let family = false;

/** Mode famille : bruitages adoucis. */
export function setFamily(f: boolean) {
  family = f;
}

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

export interface ClipPlayer {
  dur: number;
  stop(): void;
  /** Volume actuel, de 0 à 1 (pour faire bouger l'égaliseur). */
  level(): number;
}

/** Transforme un enregistrement reçu en son jouable. */
export function decodeClip(data: ArrayBuffer): Promise<AudioBuffer> {
  const c = ctx();
  if (!c) return Promise.reject(new Error('audio'));
  return c.decodeAudioData(data);
}

/** Joue un enregistrement : `rate` déforme la voix, `reverse` la joue à l'envers. */
export function playClip(buf: AudioBuffer, o: { rate?: number; reverse?: boolean; gain?: number; loop?: boolean }): ClipPlayer {
  const c = ctx()!;
  let use = buf;
  if (o.reverse) {
    use = c.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const from = buf.getChannelData(ch);
      const to = use.getChannelData(ch);
      for (let i = 0; i < from.length; i++) to[i] = from[from.length - 1 - i];
    }
  }
  const s = c.createBufferSource();
  s.buffer = use;
  s.playbackRate.value = o.rate ?? 1;
  const boost = c.createGain();
  boost.gain.value = o.gain ?? 1.6;
  s.loop = !!o.loop;
  const an = c.createAnalyser();
  an.fftSize = 256;
  const data = new Uint8Array(an.frequencyBinCount);
  s.connect(boost).connect(an);
  an.connect(master ?? c.destination);
  s.start();
  return {
    dur: use.duration / (o.rate ?? 1),
    stop() {
      try {
        s.stop();
      } catch {
        /* déjà fini */
      }
      s.disconnect();
      an.disconnect();
    },
    level() {
      an.getByteTimeDomainData(data);
      let max = 0;
      for (const v of data) max = Math.max(max, Math.abs(v - 128));
      return Math.min(1, max / 80);
    },
  };
}

function synth(dur: number, f: (t: number, i: number) => number): AudioBuffer {
  const c = ctx()!;
  const b = c.createBuffer(1, Math.floor(dur * c.sampleRate), c.sampleRate);
  const d = b.getChannelData(0);
  const fade = 0.04;
  for (let i = 0; i < d.length; i++) {
    const t = i / c.sampleRate;
    d[i] = f(t, i) * Math.min(1, t / fade, (dur - t) / fade);
  }
  return b;
}

/** Le « blabla » d'un bot : une petite voix qui baragouine. */
export function fakeVoice(dur: number): AudioBuffer {
  const base = 110 + Math.random() * 180;
  const a = Math.random() * 6 + 2;
  const b = Math.random() * 3 + 3;
  let ph = 0;
  const sr = ctx()!.sampleRate;
  return synth(dur, (t) => {
    const f = base * (1 + 0.35 * Math.sin(t * a) + 0.2 * Math.sin(t * a * 2.7));
    ph += f / sr;
    const syll = Math.max(0, Math.sin(t * b * 3.14));
    const saw = (ph % 1) * 2 - 1;
    return (saw * 0.5 + Math.sin(ph * 6.28 * 3) * 0.3) * syll * 0.45;
  });
}

/** Une mélodie de karaoké inventée, toujours différente : gamme joyeuse, basse et petite batterie. */
export function karaokeTune(): AudioBuffer {
  const scale = [60, 62, 64, 67, 69, 72, 74, 76];
  const beat = 0.42;
  const notes = Array.from({ length: 8 }, (_, i) => (i === 7 ? 60 : scale[Math.floor(Math.random() * scale.length)]));
  const bass = [48, 45, 41, 43][Math.floor(Math.random() * 4)];
  const sr = ctx()!.sampleRate;
  let a = 0;
  let b = 0;
  return synth(beat * 8, (t) => {
    const i = Math.min(7, Math.floor(t / beat));
    const p = (t % beat) / beat;
    a += midi(notes[i]) / sr;
    b += midi(i < 4 ? bass : bass + 5) / sr;
    const lead = Math.sin(a * 6.283) * Math.exp(-p * 2) * 0.42;
    const low = ((b % 1) * 2 - 1) * 0.14;
    const kick = Math.sin(p * 40) * Math.exp(-p * 12) * (i % 2 ? 0 : 0.3);
    return lead + low + kick;
  });
}

/** Bruits à imiter, joués par la télé. */
export const REF_SOUNDS: { id: string; fr: string; en: string }[] = [
  { id: 'sirene', fr: 'la sirène', en: 'the siren' },
  { id: 'robot', fr: 'le robot', en: 'the robot' },
  { id: 'alien', fr: 'l’extraterrestre', en: 'the alien' },
  { id: 'coucou', fr: 'le coucou', en: 'the cuckoo' },
  { id: 'moto', fr: 'la moto', en: 'the motorbike' },
  { id: 'goutte', fr: 'les gouttes', en: 'the drops' },
  { id: 'klaxon', fr: 'le klaxon', en: 'the horn' },
  { id: 'laser', fr: 'le laser', en: 'the laser' },
];
export function referenceSound(id: string): AudioBuffer {
  const sr = ctx()!.sampleRate;
  let ph = 0;
  const osc = (f: number) => {
    ph += f / sr;
    return ph % 1;
  };
  const sine = (f: number) => Math.sin(osc(f) * 6.283);
  const square = (f: number) => (osc(f) < 0.5 ? 1 : -1);
  const saw = (f: number) => osc(f) * 2 - 1;
  switch (id) {
    case 'sirene':
      return synth(3, (t) => sine(650 + 280 * Math.sin(t * 6)) * 0.5);
    case 'robot':
      return synth(2.6, (t) => square([180, 240, 150, 300][Math.floor(t * 5) % 4]) * 0.28 * (Math.sin(t * 90) > 0 ? 1 : 0.35));
    case 'alien':
      return synth(2.8, (t) => sine(500 + 380 * Math.sin(t * 28) * Math.sin(t * 1.6)) * 0.5);
    case 'coucou':
      return synth(2.4, (t) => {
        const p = t % 0.8;
        return sine(p < 0.22 ? 780 : p < 0.5 ? 620 : 1) * (p < 0.5 ? 0.5 : 0);
      });
    case 'moto':
      return synth(3, (t) => saw(60 + Math.min(100, t * 55) + 6 * Math.sin(t * 40)) * 0.45);
    case 'goutte':
      return synth(2.6, (t) => {
        const p = t % 0.45;
        return sine(500 + p * 2600) * Math.exp(-p * 14) * 0.7;
      });
    case 'klaxon':
      return synth(2.2, (t) => {
        const on = t % 0.7 < 0.42;
        return on ? (square(370) * 0.2 + square(466) * 0.2) * 0.8 : 0;
      });
    default:
      return synth(2.2, (t) => {
        const p = t % 0.55;
        return square(1900 - p * 3000) * Math.exp(-p * 4) * 0.28;
      });
  }
}

/** Sons de victoire (cosmétiques). */
export function playWinSound(id?: string) {
  const seq = (notes: number[], step: number, dur: number, type: OscillatorType, vol: number, at = 0) => notes.forEach((n, i) => tone(midi(n), dur, type, vol, at + i * step));
  switch (id) {
    case 'jingle':
      return seq([72, 76, 79], 0.13, 0.25, 'triangle', 0.25);
    case 'sifflet':
      tone(1500, 0.22, 'sine', 0.2, 0, 2400);
      tone(2400, 0.5, 'sine', 0.2, 0.26, 1400);
      return;
    case 'bit8':
      return seq([60, 64, 67, 72, 76, 79, 84, 88], 0.07, 0.12, 'square', 0.13);
    case 'cloches':
      return seq([84, 88, 91, 96], 0.17, 0.9, 'sine', 0.2);
    case 'cor':
      [0, 0.28, 0.56].forEach((at) => {
        tone(233, 0.24, 'sawtooth', 0.2, at);
        tone(349, 0.24, 'sawtooth', 0.16, at);
      });
      return;
    case 'petroyal':
      seq([67, 72, 76, 79], 0.14, 0.2, 'square', 0.1);
      setTimeout(() => sfx.pet(), 650);
      return;
    case 'orgue':
      [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79, 84]].forEach((ch, i) => ch.forEach((n) => { tone(midi(n), 0.6, 'sawtooth', 0.075, i * 0.42); tone(midi(n - 12), 0.6, 'triangle', 0.1, i * 0.42); }));
      return;
    case 'fanfare':
      seq([67, 67, 67, 72], 0.15, 0.17, 'sawtooth', 0.14);
      seq([76, 79], 0.2, 0.3, 'sawtooth', 0.14, 0.65);
      tone(midi(84), 0.9, 'sawtooth', 0.15, 1.05);
      tone(midi(79), 0.9, 'sawtooth', 0.11, 1.05);
      tone(midi(76), 0.9, 'sawtooth', 0.11, 1.05);
      return;
    case 'choeur':
      [[69, 76, 81], [72, 79, 84], [74, 81, 86], [76, 84, 88]].forEach((ch, i) => ch.forEach((n) => { tone(midi(n), 1.2, 'sine', 0.13, i * 0.55); tone(midi(n) * 1.004, 1.2, 'triangle', 0.07, i * 0.55); }));
      seq([96, 100, 103], 0.14, 0.7, 'sine', 0.06, 2.1);
      return;
    default:
      sfx.win();
  }
}

export const sfx = {
  /** Boîtes : la boîte tremble, le bandeau cliquette, la révélation dépend de la rareté. */
  boxShake() {
    [0, 0.14, 0.27, 0.39, 0.5, 0.6, 0.69, 0.77, 0.84].forEach((at, i) => tone(180 + i * 25, 0.05, 'square', 0.08, at));
    tone(300, 0.9, 'sine', 0.1, 0, 1100);
  },
  boxTick() {
    tone(1250, 0.025, 'square', 0.07);
  },
  boxReveal(r: string) {
    const up = (n: number[], step: number, type: OscillatorType, vol: number, dur = 0.3) => n.forEach((m, i) => tone(midi(m), dur, type, vol, i * step));
    if (r === 'commun') return up([72, 76], 0.1, 'triangle', 0.25);
    if (r === 'rare') return up([72, 76, 79], 0.1, 'triangle', 0.25);
    if (r === 'epique') return up([72, 76, 79, 84], 0.1, 'square', 0.14, 0.4);
    noise(0.5, 0.2, 500, 0, 0.6);
    if (r === 'legendaire') {
      up([67, 72, 76, 79, 84, 88], 0.09, 'sawtooth', 0.13, 0.5);
      tone(midi(96), 1, 'sine', 0.15, 0.55);
      return;
    }
    up([60, 67, 72, 76, 79, 84, 88, 91, 96], 0.08, 'sawtooth', 0.13, 0.55);
    [72, 79, 84, 88].forEach((m) => tone(midi(m), 1.6, 'sine', 0.13, 0.75));
    noise(1, 0.14, 2500, 0.75, 0.5);
  },
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
    if (family) {
      tone(700, 0.12, 'sine', 0.25, 0, 1400);
      tone(1000, 0.14, 'sine', 0.2, 0.1, 1800);
      return;
    }
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
  /** « Plus que 30 secondes ! » : petite montée pressée. */
  hurry() {
    [76, 79, 83, 88].forEach((n, i) => tone(midi(n), 0.12, 'square', 0.1, i * 0.08));
    tone(midi(91), 0.3, 'triangle', 0.2, 0.34);
  },
  /** Tic-tac des 10 dernières secondes (plus aigu sur les 3 dernières). */
  countdown(n: number) {
    const hi = n <= 3;
    tone(hi ? 1480 : 1050, 0.09, 'square', hi ? 0.16 : 0.1);
    noise(0.04, 0.12, 3200, 0, 3);
    if (hi) tone(hi ? 740 : 525, 0.18, 'triangle', 0.22, 0.01);
  },
  /** Fin du chrono : grosse sirène puis coup de sifflet. */
  timeUp() {
    tone(196, 0.75, 'sawtooth', 0.16);
    tone(98, 0.75, 'square', 0.12);
    tone(1900, 0.45, 'sine', 0.22, 0.8, 2600);
    tone(1900, 0.25, 'sine', 0.2, 1.3, 2400);
  },
  finish() {
    tone(midi(79), 0.12, 'square', 0.12);
    tone(midi(84), 0.25, 'square', 0.12, 0.1);
  },
  /** Grosse explosion. */
  boom() {
    tone(120, 0.6, 'sawtooth', 0.22, 0, 35);
    noise(0.7, 0.4, 260, 0, 0.6);
    noise(0.3, 0.2, 1200, 0.02, 0.8);
  },
  whoosh() {
    noise(0.35, 0.18, 900, 0, 0.5);
    tone(300, 0.3, 'sine', 0.08, 0, 900);
  },
  /** Alarme du chrono (dernières secondes) : deux bips qui piquent. */
  alarm() {
    tone(1560, 0.1, 'square', 0.13);
    tone(1560, 0.1, 'square', 0.13, 0.16);
  },
  /** Barillet qui tourne. */
  spin() {
    for (let i = 0; i < 9; i++) noise(0.03, 0.1 - i * 0.008, 4200, i * (0.05 + i * 0.012), 4);
  },
  /** Chien du revolver qu'on arme, puis « clic » à vide. */
  cock() {
    noise(0.04, 0.22, 3000, 0, 5);
    noise(0.03, 0.18, 1800, 0.09, 5);
  },
  dryFire() {
    noise(0.05, 0.3, 2600, 0, 6);
    tone(2200, 0.03, 'square', 0.08);
  },
  /** Coup de feu (mais c'est un pistolet à confettis). */
  gunshot() {
    noise(0.5, 0.55, 700, 0, 0.4);
    noise(0.12, 0.4, 3000, 0, 0.6);
    tone(160, 0.35, 'sawtooth', 0.2, 0, 45);
  },
  /** Cartes claquées sur le comptoir. */
  cards() {
    noise(0.06, 0.22, 2200, 0, 1.5);
    noise(0.05, 0.16, 1800, 0.07, 1.5);
  },
};

// ——— Musique : un petit compositeur. Chaque ambiance a sa grille d'accords (couplet + pont) ;
// la mélodie est réinventée à chaque tour (forme A A' B A), avec basse, batterie et nappe douces. ———

type Q = 'M' | 'm' | '7' | 'M7' | 'm7';
type Chord = [number, Q];

interface Track {
  bpm: number;
  /** Retard des contretemps (0 = droit, 0.3 = chaloupé). */
  swing: number;
  key: number;
  verse: Chord[];
  bridge: Chord[];
  lead: OscillatorType;
  drums: 'chill' | 'pop' | 'drive' | 'march' | 'fight';
  bass: 'walk' | 'pump' | 'root';
  /** Son de la basse (triangle par défaut ; dent de scie = plus musclé). */
  bassWave?: OscillatorType;
  /** Gamme mineure (ambiances tendues ou mystérieuses). */
  minor?: boolean;
  /** Densité de la mélodie (0 à 1). */
  busy: number;
}

const QUAL: Record<Q, number[]> = { M: [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10] };
const PENTA = [0, 2, 4, 7, 9];
const PENTA_MINOR = [0, 3, 5, 7, 10];

const TRACKS: Record<string, Track> = {
  lobby: {
    bpm: 98,
    swing: 0.28,
    key: 65,
    verse: [[0, 'M7'], [9, 'm7'], [2, 'm7'], [7, '7'], [5, 'M7'], [4, 'm7'], [2, 'm7'], [7, '7']],
    bridge: [[5, 'M7'], [7, '7'], [4, 'm7'], [9, 'm7'], [2, 'm7'], [7, '7'], [0, 'M7'], [7, '7']],
    lead: 'triangle',
    drums: 'chill',
    bass: 'walk',
    busy: 0.45,
  },
  race: {
    bpm: 146,
    swing: 0,
    key: 62,
    verse: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M'], [0, 'M'], [7, 'M'], [5, 'M'], [7, 'M']],
    bridge: [[5, 'M'], [7, 'M'], [4, 'm'], [9, 'm'], [5, 'M'], [7, 'M'], [10, 'M'], [7, '7']],
    lead: 'square',
    drums: 'drive',
    bass: 'pump',
    busy: 0.7,
  },
  tumble: {
    bpm: 126,
    swing: 0.18,
    key: 67,
    verse: [[0, 'M'], [5, 'M'], [9, 'm'], [7, 'M'], [0, 'M'], [5, 'M'], [2, 'm'], [7, '7']],
    bridge: [[9, 'm'], [5, 'M'], [0, 'M'], [7, 'M'], [9, 'm'], [5, 'M'], [2, 'm7'], [7, '7']],
    lead: 'square',
    drums: 'pop',
    bass: 'root',
    busy: 0.6,
  },
  /** Baston : mineur, rapide, basse en dent de scie. */
  fight: {
    bpm: 152,
    swing: 0,
    key: 57,
    minor: true,
    verse: [[0, 'm'], [0, 'm'], [8, 'M'], [10, 'M'], [0, 'm'], [0, 'm'], [5, 'm'], [7, 'M']],
    bridge: [[5, 'm'], [8, 'M'], [3, 'M'], [10, 'M'], [5, 'm'], [8, 'M'], [7, 'M'], [7, '7']],
    lead: 'sawtooth',
    drums: 'fight',
    bass: 'pump',
    bassWave: 'sawtooth',
    busy: 0.75,
  },
  /** Jeux électroniques rétro (pétards). */
  arcade: {
    bpm: 164,
    swing: 0,
    key: 64,
    minor: true,
    verse: [[0, 'm'], [3, 'M'], [10, 'M'], [5, 'm'], [0, 'm'], [3, 'M'], [7, 'M'], [7, '7']],
    bridge: [[8, 'M'], [10, 'M'], [0, 'm'], [0, 'm'], [8, 'M'], [10, 'M'], [7, 'M'], [7, '7']],
    lead: 'square',
    drums: 'drive',
    bass: 'pump',
    bassWave: 'square',
    busy: 0.85,
  },
  /** Enquête : jazz feutré et mystérieux (Undercover, Traître). */
  spy: {
    bpm: 90,
    swing: 0.32,
    key: 62,
    minor: true,
    verse: [[0, 'm7'], [0, 'm7'], [5, 'm7'], [5, 'm7'], [0, 'm7'], [0, 'm7'], [7, '7'], [7, '7']],
    bridge: [[8, 'M7'], [7, '7'], [5, 'm7'], [0, 'm7'], [8, 'M7'], [7, '7'], [10, '7'], [7, '7']],
    lead: 'sine',
    drums: 'chill',
    bass: 'walk',
    busy: 0.35,
  },
  /** Saloon (Bar des Bobards) : piano bastringue qui balance. */
  bar: {
    bpm: 118,
    swing: 0.36,
    key: 60,
    verse: [[0, 'M'], [0, '7'], [5, 'M'], [5, 'M'], [0, 'M'], [7, '7'], [0, 'M'], [7, '7']],
    bridge: [[5, 'M'], [5, 'M'], [0, 'M'], [0, 'M'], [2, '7'], [2, '7'], [7, 'M'], [7, '7']],
    lead: 'triangle',
    drums: 'march',
    bass: 'pump',
    busy: 0.6,
  },
  /** Stade : entraînant (foot). */
  sport: {
    bpm: 134,
    swing: 0,
    key: 64,
    verse: [[0, 'M'], [5, 'M'], [7, 'M'], [5, 'M'], [0, 'M'], [5, 'M'], [7, '7'], [7, '7']],
    bridge: [[9, 'm'], [5, 'M'], [0, 'M'], [7, 'M'], [9, 'm'], [5, 'M'], [2, 'm'], [7, '7']],
    lead: 'square',
    drums: 'pop',
    bass: 'root',
    busy: 0.65,
  },
  /** Jeux de salon (dessin, photos, réflexes) : funk léger. */
  party: {
    bpm: 108,
    swing: 0.16,
    key: 65,
    verse: [[0, 'm7'], [5, '7'], [0, 'm7'], [5, '7'], [3, 'M7'], [8, 'M7'], [2, 'm7'], [7, '7']],
    bridge: [[5, 'M7'], [4, 'm7'], [2, 'm7'], [7, '7'], [5, 'M7'], [4, 'm7'], [2, 'm7'], [7, '7']],
    lead: 'triangle',
    drums: 'pop',
    bass: 'walk',
    busy: 0.55,
  },
  podium: {
    bpm: 112,
    swing: 0,
    key: 60,
    verse: [[0, 'M'], [5, 'M'], [7, 'M'], [0, 'M'], [9, 'm'], [5, 'M'], [7, '7'], [0, 'M']],
    bridge: [[5, 'M'], [0, 'M'], [5, 'M'], [7, 'M'], [9, 'm'], [4, 'm'], [2, 'm'], [7, '7']],
    lead: 'triangle',
    drums: 'march',
    bass: 'root',
    busy: 0.55,
  },
};

let music: GainNode | null = null;
function musicBus(): GainNode | null {
  const c = ctx();
  if (!c || !master) return null;
  if (!music) {
    music = c.createGain();
    music.gain.value = 0.55;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    music.connect(lp).connect(master);
  }
  return music;
}

/** Une note de musique (enveloppe douce, passe par le bus musique). */
function note(freq: number, dur: number, type: OscillatorType, vol: number, at: number, attack = 0.01) {
  const c = ctx();
  const bus = musicBus();
  if (!c || !bus) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bus);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function drum(kind: 'kick' | 'snare' | 'hat' | 'clap', at: number) {
  const c = ctx();
  const bus = musicBus();
  if (!c || !bus) return;
  if (kind === 'kick') {
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(130, t0);
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.14);
    g.gain.setValueAtTime(0.38, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    o.connect(g).connect(bus);
    o.start(t0);
    o.stop(t0 + 0.22);
  } else if (kind === 'snare') noise(0.11, 0.07, 1700, at, 0.7);
  else if (kind === 'clap') {
    noise(0.05, 0.05, 1300, at, 1.2);
    noise(0.08, 0.05, 1300, at + 0.012, 1.2);
  } else noise(0.025, 0.025, 9000, at, 1.4);
}

// Un tour de morceau = 32 mesures : A (couplet), A' (couplet, fin variée), B (pont), A.
let timer = 0;
let current = '';
/** Accélération de la musique (fin de chrono). */
let rush = 1;
export function setMusicRush(r: number) {
  rush = r;
}
let nextTime = 0;
let stepIdx = 0;
let melody: (number | null)[][] = [];
let lastPitch = 0;

/** Invente 8 mesures de mélodie (8 croches par mesure) sur une grille. */
function compose(tr: Track, grid: Chord[]): (number | null)[][] {
  // Quelques rythmes de base, piochés puis répétés : la mélodie reste chantable.
  const RHYTHMS = [
    [1, 0, 1, 0, 1, 0, 0, 0],
    [1, 0, 0, 1, 0, 0, 1, 0],
    [1, 1, 0, 1, 1, 0, 1, 0],
    [0, 0, 1, 0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1, 0, 1, 1],
    [1, 1, 1, 1, 1, 0, 0, 0],
  ];
  const motif = [0, 1].map(() => RHYTHMS[Math.floor(Math.random() * (tr.busy > 0.6 ? 6 : 5))]);
  const scale: number[] = [];
  for (let o = 0; o < 2; o++) for (const d of tr.minor ? PENTA_MINOR : PENTA) scale.push(tr.key + 12 * o + d);
  let idx = scale.indexOf(lastPitch);
  if (idx < 0) idx = 4;
  return grid.map(([root, q], bar) => {
    const rhythm = bar === 7 || bar === 3 ? [1, 0, 0, 0, 1, 0, 0, 0] : motif[bar % 2];
    const tones = QUAL[q].map((i) => (tr.key + root + i) % 12);
    return rhythm.map((on, s) => {
      if (!on || (s > 0 && Math.random() > tr.busy + 0.35)) return null;
      // Petits pas dans la gamme, avec un aimant vers les notes de l'accord sur les temps forts
      idx = Math.max(0, Math.min(scale.length - 1, idx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      if (s % 4 === 0) {
        for (let k = 0; k < 3; k++) {
          if (tones.includes(scale[idx] % 12)) break;
          idx = Math.max(0, Math.min(scale.length - 1, idx + (idx > 5 ? -1 : 1)));
        }
      }
      lastPitch = scale[idx];
      return scale[idx];
    });
  });
}

function newRound(tr: Track) {
  const a = compose(tr, tr.verse);
  // A' : même début, fin réinventée
  const a2 = [...a.slice(0, 4), ...compose(tr, tr.verse).slice(4)];
  const b = compose(tr, tr.bridge);
  melody = [...a, ...a2, ...b, ...a];
}

function schedule() {
  const c = ctx();
  if (!c || !current) return;
  const tr = TRACKS[current];
  const eighth = 60 / (tr.bpm * rush) / 2;
  while (nextTime < c.currentTime + 0.2) {
    const bar = Math.floor(stepIdx / 8) % 32;
    const s = stepIdx % 8;
    if (bar === 0 && s === 0) newRound(tr);
    const section = Math.floor(bar / 8);
    const grid = section === 2 ? tr.bridge : tr.verse;
    const [root, q] = grid[bar % 8];
    const chord = QUAL[q].map((i) => tr.key + root + i);
    const at = nextTime - c.currentTime + (s % 2 ? tr.swing * eighth : 0);
    const fill = bar % 8 === 7;

    // Nappe : l'accord tenu toute la mesure, très doux
    if (s === 0) chord.forEach((n) => note(midi(n - 12), eighth * 8, 'triangle', 0.018, at, 0.25));

    // Basse
    const bassRoot = tr.key + root - 24;
    const bw = tr.bassWave ?? 'triangle';
    const bv = bw === 'triangle' ? 1 : 0.32;
    if (tr.bass === 'walk' && s % 2 === 0) note(midi(bassRoot + [0, QUAL[q][1], 7, tr.minor ? 10 : 9][s / 2]), eighth * 1.8, bw, 0.2 * bv, at);
    if (tr.bass === 'pump') note(midi(bassRoot + (s % 2 ? 12 : 0)), eighth * 0.8, bw, 0.17 * bv, at);
    if (tr.bass === 'root' && (s === 0 || s === 3 || s === 4 || s === 6)) note(midi(bassRoot + (s === 6 ? 7 : 0)), eighth * 1.4, bw, 0.2 * bv, at);

    // Batterie (une petite relance en fin de partie)
    const d = tr.drums;
    if (fill && s >= 4) drum(s % 2 ? 'snare' : 'clap', at);
    else if (d === 'fight') {
      if (s === 0 || s === 3 || s === 4 || (s === 7 && bar % 2)) drum('kick', at);
      if (s === 2 || s === 6) drum('snare', at);
      drum('hat', at);
    } else {
      if ((d === 'drive' && s % 2 === 0) || (d !== 'drive' && (s === 0 || (s === 5 && d !== 'march') || (s === 4 && d === 'march')))) drum('kick', at);
      if (s === 2 || s === 6) drum(d === 'chill' ? 'clap' : 'snare', at);
      if (d === 'drive' || d === 'pop' || (d === 'chill' && s % 2 === 1) || (d === 'march' && s % 2 === 0)) drum('hat', at);
    }

    // Mélodie (+ un petit écho), qui se tait sur la première mesure du pont pour respirer
    const m = melody[bar]?.[s];
    if (m && !(section === 2 && bar % 8 === 0)) {
      const v = tr.lead === 'square' ? 0.03 : tr.lead === 'sawtooth' ? 0.022 : 0.07;
      const len = eighth * (melody[bar][s + 1] == null ? 1.7 : 0.9);
      note(midi(m), len, tr.lead, v, at);
      note(midi(m), len, 'sine', v * 0.35, at + eighth * 1.5);
    }
    nextTime += eighth;
    stepIdx++;
  }
}

export type MusicId = 'lobby' | 'race' | 'tumble' | 'podium' | 'fight' | 'arcade' | 'spy' | 'bar' | 'sport' | 'party';

export function playMusic(track: MusicId | '') {
  if (track === current) return;
  current = track;
  rush = 1;
  clearInterval(timer);
  if (!track) return;
  const c = ctx();
  if (!c) return;
  nextTime = c.currentTime + 0.05;
  stepIdx = 0;
  timer = window.setInterval(schedule, 40);
}

// ——— Présentateur (voix de synthèse du navigateur) ———

/** Voix du présentateur, au choix de l'hôte. `accent` = langue de la voix qui lit le texte (fr, puis en). */
export const VOICES: { id: string; fr: string; en: string; accent?: [string, string]; nice?: boolean; local?: boolean; male?: boolean; rate: number; pitch: number }[] = [
  { id: 'classique', fr: 'Classique', en: 'Classic', rate: 1.05, pitch: 1.15 },
  { id: 'naturelle', fr: 'Naturelle (IA)', en: 'Natural (AI)', nice: true, rate: 1.02, pitch: 1 },
  { id: 'quebec', fr: 'Québécoise', en: 'Québécois', accent: ['fr-ca', 'fr-ca'], rate: 1.05, pitch: 1.05 },
  { id: 'anglais', fr: 'Accent anglais', en: 'French accent', accent: ['en-gb', 'fr-fr'], rate: 0.95, pitch: 1.05 },
  { id: 'italien', fr: 'Accent italien', en: 'Italian accent', accent: ['it', 'it'], rate: 1.05, pitch: 1.1 },
  { id: 'espagnol', fr: 'Accent espagnol', en: 'Spanish accent', accent: ['es', 'es'], rate: 1.05, pitch: 1.05 },
  { id: 'grave', fr: 'Bande-annonce', en: 'Movie trailer', local: true, male: true, rate: 0.82, pitch: 0.3 },
  { id: 'ecureuil', fr: 'Écureuil', en: 'Chipmunk', local: true, rate: 1.35, pitch: 2 },
  { id: 'robot', fr: 'Robot', en: 'Robot', local: true, male: true, rate: 0.8, pitch: 0.1 },
  // Accents du monde : une voix de cette langue lit le texte (si le PC l'a ; « a|b » = la première trouvée)
  { id: 'japonais', fr: 'Accent japonais', en: 'Japanese accent', accent: ['ja', 'ja'], male: true, rate: 1.05, pitch: 1.1 },
  { id: 'chinois', fr: 'Accent chinois', en: 'Chinese accent', accent: ['zh', 'zh'], male: true, rate: 1, pitch: 1.05 },
  { id: 'indien', fr: 'Accent indien', en: 'Indian accent', accent: ['en-in|hi', 'en-in|hi'], male: true, rate: 1.05, pitch: 1.05 },
  { id: 'africain', fr: 'Accent africain', en: 'African accent', accent: ['fr-sn|fr-ci|fr-cm|en-ng|en-za|sw', 'en-ng|en-za|en-ke|sw'], male: true, rate: 1, pitch: 1 },
  // Voix drôles (hauteur et vitesse poussées à fond)
  { id: 'mamie', fr: 'Mamie', en: 'Granny', local: true, rate: 0.75, pitch: 1.6 },
  { id: 'ogre', fr: 'Ogre', en: 'Ogre', local: true, male: true, rate: 0.7, pitch: 0.15 },
  { id: 'speede', fr: 'Speedé', en: 'Hyper', local: true, male: true, rate: 1.9, pitch: 1.3 },
  { id: 'fantome', fr: 'Fantôme', en: 'Ghost', local: true, male: true, rate: 0.6, pitch: 1.9 },
  { id: 'escargot', fr: 'Escargot', en: 'Snail', local: true, male: true, rate: 0.45, pitch: 0.8 },
];
let voiceIdx = 0;
export function setVoice(i: number) {
  voiceIdx = Math.max(0, Math.min(VOICES.length - 1, i));
}

const NICE = /natural|neural|online|google|premium|enhanced|siri|wavenet/i;

/**
 * Les voix « en ligne » (Natural, Google…) ignorent la hauteur de la voix : Bande-annonce, Écureuil et Robot
 * sonnaient comme la voix normale. Pour elles, on prend une voix installée sur le PC, qui la respecte.
 */
/** Voix d'homme, reconnues à leur prénom (les navigateurs ne donnent pas le genre). */
const MALE = /(male|homme|paul|henri|r[eé]my|claude|antoine|jean|thomas|guy|david|mark|george|james|ryan|christopher|eric|andrew|brian|roger|steffan|ichiro|keita|naoki|daichi|kangkang|yunxi|yunyang|yunjian|ravi|prabhat|hemant|madhur|abeo|chilemba|elimu|rafiki|luke|william|liam|connor|mitchell|ken|wayne|fabrice|g[eé]rard|alain|denis|maurice|ousmane|kofi|kwame|emeka|sello|thabo|daniel|diego|pablo|jorge|alvaro|giuseppe|cosimo|benigno|kenji|yan)/i;

function findVoice(prefix: string, nice: boolean, local = false, male = false): SpeechSynthesisVoice | undefined {
  // Plusieurs langues possibles « a|b » : on prend la première que le PC possède
  if (prefix.includes('|')) {
    for (const one of prefix.split('|')) {
      const v = findVoice(one, nice, local, male);
      if (v) return v;
    }
    return undefined;
  }
  let all = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix));
  // Voix d'homme demandée : on garde les voix d'homme s'il y en a
  if (male && all.some((v) => MALE.test(v.name))) all = all.filter((v) => MALE.test(v.name));
  if (local) return all.find((v) => v.localService && !NICE.test(v.name)) ?? all.find((v) => v.localService) ?? all[0];
  return (nice ? all.find((v) => NICE.test(v.name)) : undefined) ?? all.find((v) => !NICE.test(v.name)) ?? all[0];
}

/** `voice` : voix propre à une annonce (vitesse et hauteur). */
export function speak(text: string, lang: Lang, voice_?: { rate?: number; pitch?: number }) {
  if (muted || !('speechSynthesis' in window)) return;
  const pre = VOICES[voiceIdx] ?? VOICES[0];
  const u = new SpeechSynthesisUtterance(text);
  const base = lang === 'fr' ? 'fr' : 'en';
  // Accent : une voix d'une autre langue lit le texte (si le PC l'a, sinon voix normale)
  const acc = pre.accent ? findVoice(pre.accent[lang === 'fr' ? 0 : 1], true, false, !!pre.male) : undefined;
  const voice = acc ?? findVoice(base, !!pre.nice, !!pre.local, !!pre.male);
  u.lang = voice?.lang ?? (lang === 'fr' ? 'fr-FR' : 'en-US');
  if (voice) u.voice = voice;
  u.rate = voice_?.rate ?? pre.rate;
  u.pitch = voice_?.pitch ?? pre.pitch;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
