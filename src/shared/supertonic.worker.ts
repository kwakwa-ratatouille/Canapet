// Voix Supertonic 3 (Supertone Inc., licence OpenRAIL-M) : fabrique le son sur la carte graphique, dans un fil à part, pour ne pas faire ramer le jeu.
// Le modèle est gardé dans le navigateur après le premier téléchargement.
/* eslint-disable */
declare const ort: any;
declare function importScripts(...urls: string[]): void;

const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
// Modèle officiel, fixé à une révision précise : le fichier ne peut pas changer sous nos pieds.
// Les versions compressées sont 4 fois plus lentes ou ne passent pas sur la carte graphique (mesuré : 0,3 s pour 2,4 s de son).
const BASE = 'https://huggingface.co/Supertone/supertonic-3/resolve/3cadd1ee6394adea1bd021217a0e650ede09a323/';
const CACHE = 'canapet-voix-v1';
const MODELS = [
  ['dp', 'onnx/duration_predictor.onnx', 3700147],
  ['enc', 'onnx/text_encoder.onnx', 36416150],
  ['est', 'onnx/vector_estimator.onnx', 256534781],
  ['voc', 'onnx/vocoder.onnx', 101424195],
] as const;
const TOTAL = MODELS.reduce((n, m) => n + m[2], 0);

const post = (m: unknown, t: Transferable[] = []) => (self as unknown as { postMessage(a: unknown, b: Transferable[]): void }).postMessage(m, t);

let done = 0;
/** Lit un fichier depuis le navigateur, sinon le télécharge et le garde. */
async function file(name: string): Promise<Uint8Array> {
  const url = BASE + name;
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) {
      const b = new Uint8Array(await hit.arrayBuffer());
      done += b.length;
      post({ t: 'progress', k: Math.min(1, done / TOTAL) });
      return b;
    }
  } catch {
    cache = null; // Navigation privée, par exemple : on retélécharge à chaque fois
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`voix : ${res.status}`);
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    parts.push(value);
    size += value.length;
    done += value.length;
    post({ t: 'progress', k: Math.min(1, done / TOTAL) });
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  try {
    await cache?.put(url, new Response(all));
  } catch {
    /* plus de place : tant pis */
  }
  return all;
}
const json = async (name: string) => JSON.parse(new TextDecoder().decode(await file(name)));

let cfg: any;
let indexer: number[];
const s: Record<string, any> = {};
const styles = new Map<string, { ttl: any; dp: any }>();

let ready: Promise<void> | null = null;
function load(voice: string) {
  return (ready ??= (async () => {
    importScripts(ORT + 'ort.webgpu.min.js');
    ort.env.wasm.wasmPaths = ORT;
    ort.env.wasm.numThreads = 1;
    ort.env.logLevel = 'error';
    cfg = await json('onnx/tts.json');
    indexer = await json('onnx/unicode_indexer.json');
    for (const [k, name] of MODELS) s[k] = await ort.InferenceSession.create(await file(name), { executionProviders: ['webgpu'], graphOptimizationLevel: 'all', logSeverityLevel: 3 });
    // La toute première phrase prend une vingtaine de secondes (la carte graphique se prépare) : on la fait ici, sans bruit
    await synth('Bonjour.', 'fr', voice, 5, 1.05);
    post({ t: 'ready' });
  })());
}

async function style(id: string) {
  let v = styles.get(id);
  if (!v) {
    const j = await json(`voice_styles/${id}.json`);
    v = {
      ttl: new ort.Tensor('float32', Float32Array.from(j.style_ttl.data.flat(Infinity)), j.style_ttl.dims),
      dp: new ort.Tensor('float32', Float32Array.from(j.style_dp.data.flat(Infinity)), j.style_dp.dims),
    };
    styles.set(id, v);
  }
  return v;
}

function clean(text: string, lang: string) {
  // Les mots en capitales seraient parfois épelés
  let t = text.replace(/\p{Lu}{2,}/gu, (w) => w.toLowerCase()).normalize('NFKD').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '');
  t = t.replace(/[–‑—]/g, '-').replace(/[_[\]|/#→←]/g, ' ').replace(/[“”«»]/g, '"').replace(/[‘’´`]/g, "'").replace(/…/g, '...');
  t = t.replace(/ ([,.!?;:'])/g, '$1').replace(/\s+/g, ' ').trim();
  if (!/[.!?;:,'")\]}]$/.test(t)) t += '.';
  return `<${lang}>${t}</${lang}>`;
}

function gauss() {
  const u = Math.max(0.0001, Math.random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

async function synth(text: string, lang: string, voice: string, steps: number, speed: number) {
  const st = await style(voice);
  const str = clean(text, lang);
  const chars = Array.from(str);
  const ids = new BigInt64Array(chars.length);
  chars.forEach((c, i) => {
    const cp = c.codePointAt(0)!;
    ids[i] = BigInt(cp < indexer.length ? indexer[cp] : -1);
  });
  const textIds = new ort.Tensor('int64', ids, [1, chars.length]);
  const textMask = new ort.Tensor('float32', new Float32Array(chars.length).fill(1), [1, 1, chars.length]);
  const dur = (await s.dp.run({ text_ids: textIds, style_dp: st.dp, text_mask: textMask })).duration.data[0] / speed;
  const textEmb = (await s.enc.run({ text_ids: textIds, style_ttl: st.ttl, text_mask: textMask })).text_emb;
  const sr: number = cfg.ae.sample_rate;
  const chunk: number = cfg.ae.base_chunk_size * cfg.ttl.chunk_compress_factor;
  const dim: number = cfg.ttl.latent_dim * cfg.ttl.chunk_compress_factor;
  const len = Math.max(1, Math.floor((Math.floor(dur * sr) + chunk - 1) / chunk));
  let xt: Float32Array = new Float32Array(dim * len);
  for (let i = 0; i < xt.length; i++) xt[i] = gauss();
  const latentMask = new ort.Tensor('float32', new Float32Array(len).fill(1), [1, 1, len]);
  const total = new ort.Tensor('float32', new Float32Array([steps]), [1]);
  for (let k = 0; k < steps; k++) {
    const out = await s.est.run({
      noisy_latent: new ort.Tensor('float32', xt, [1, dim, len]),
      text_emb: textEmb,
      style_ttl: st.ttl,
      latent_mask: latentMask,
      text_mask: textMask,
      current_step: new ort.Tensor('float32', new Float32Array([k]), [1]),
      total_step: total,
    });
    xt = out.denoised_latent.data as Float32Array;
  }
  const wav = (await s.voc.run({ latent: new ort.Tensor('float32', xt, [1, dim, len]) })).wav_tts.data as Float32Array;
  return { wav: wav.slice(0, Math.floor(dur * sr)), sr };
}

// Une phrase à la fois : l'ordre et les priorités sont gérés dans supertonic.ts
self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  try {
    if (m.t === 'load') await load(m.voice);
    else if (m.t === 'say') {
      await ready;
      const t0 = performance.now();
      const { wav, sr } = await synth(m.text, m.lang, m.voice, m.steps, m.speed);
      post({ t: 'wav', id: m.id, wav, sr, ms: performance.now() - t0 }, [wav.buffer]);
    }
  } catch (err) {
    post({ t: 'error', id: m.id, msg: String((err as Error)?.message ?? err).slice(0, 200) });
  }
};
