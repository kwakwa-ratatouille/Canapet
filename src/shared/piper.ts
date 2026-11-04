// Voix réalistes Piper fabriquées par le PC (aucun serveur) : modèle de voix + moteur onnxruntime en WebAssembly.
// Chaque voix (≈ 60 Mo) est téléchargée une fois puis gardée dans le cache du navigateur ; une fois chargée,
// elle reste en mémoire : les phrases suivantes sortent en une seconde environ.
import type * as Ort from 'onnxruntime-web';

const HF = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main';
const ORT_WASM = 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/';
const PHONEMIZE = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';

/** « fr_FR-tom-medium » → « fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx » */
const modelPath = (id: string) => {
  const [locale, name, ...q] = id.split('-');
  return `${locale.split('_')[0]}/${locale}/${name}/${q.join('-')}/${id}.onnx`;
};

let ort: typeof Ort | null = null;
type Voice = { session: Ort.InferenceSession; cfg: { espeak: { voice: string }; audio: { sample_rate: number }; inference: { noise_scale: number; length_scale: number; noise_w: number }; speaker_id_map: Record<string, number> } };
const voices = new Map<string, Promise<Voice>>();

/** Téléchargement avec cache (la 2e fois, rien ne repasse par internet). */
async function cached(url: string): Promise<Response> {
  const c = await caches.open('canapet-piper');
  const hit = await c.match(url);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`piper ${res.status}`);
  await c.put(url, res.clone());
  return res;
}

/** Charge une voix (une seule fois) et la garde prête. */
export function loadVoice(id: string): Promise<Voice> {
  let v = voices.get(id);
  if (!v) {
    v = (async () => {
      ort ??= await import('onnxruntime-web');
      ort.env.allowLocalModels = false;
      ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
      ort.env.wasm.wasmPaths = ORT_WASM;
      const path = modelPath(id);
      const [model, json] = await Promise.all([cached(`${HF}/${path}`), cached(`${HF}/${path}.json`)]);
      const cfg = await json.json();
      const session = await ort.InferenceSession.create(await model.arrayBuffer());
      return { session, cfg };
    })();
    v.catch(() => voices.delete(id));
    voices.set(id, v);
  }
  return v;
}

/** Texte → numéros de sons (espeak), par le petit module WebAssembly de Piper. */
async function phonemize(text: string, espeakVoice: string): Promise<number[]> {
  const { createPiperPhonemize } = await import('./vendor/piperPhonemize.js');
  return new Promise((resolve, reject) => {
    createPiperPhonemize({
      print: (line: string) => resolve(JSON.parse(line).phoneme_ids),
      printErr: (line: string) => reject(new Error(line)),
      locateFile: (f: string) => (f.endsWith('.wasm') ? `${PHONEMIZE}.wasm` : f.endsWith('.data') ? `${PHONEMIZE}.data` : f),
    }).then((m: { callMain: (a: string[]) => void }) => m.callMain(['-l', espeakVoice, '--input', JSON.stringify([{ text: text.trim() }]), '--espeak_data', '/espeak-ng-data']));
  });
}

/** Fabrique la phrase et la rend sous forme de son WAV. */
export async function synth(text: string, id: string): Promise<Blob> {
  const { session, cfg } = await loadVoice(id);
  const ids = await phonemize(text, cfg.espeak.voice);
  const o = ort!;
  const feeds: Record<string, Ort.Tensor> = {
    input: new o.Tensor('int64', BigInt64Array.from(ids.map((x) => BigInt(x))), [1, ids.length]),
    input_lengths: new o.Tensor('int64', BigInt64Array.from([BigInt(ids.length)])),
    scales: new o.Tensor('float32', Float32Array.from([cfg.inference.noise_scale, cfg.inference.length_scale, cfg.inference.noise_w])),
  };
  if (Object.keys(cfg.speaker_id_map ?? {}).length) feeds.sid = new o.Tensor('int64', BigInt64Array.from([0n]));
  const out = await session.run(feeds);
  return wav(out.output.data as Float32Array, cfg.audio.sample_rate);
}

function wav(data: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + data.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + data.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
  return new Blob([buf], { type: 'audio/wav' });
}
