import { useEffect, useMemo, useRef, useState } from 'react';
import { hasGallery, randomFromGallery } from '../shared/native';
import { CHUNK, MAX_MEDIA, MAX_VIDEO_BYTES, MAX_VIDEOS, MAX_VIDEO_SECONDS, type RoulettePadData } from '../games/rouletteShared';
import type { Lang, ToTv } from '../shared/protocol';

const TXT = {
  fr: {
    pick: 'Ouvre ta galerie et sélectionne TOUT (ou un maximum) : on en pioche au hasard, même toi tu ne sais pas lesquelles 🤭',
    pickVideo: 'Ouvre ta galerie de vidéos et sélectionne-en un maximum : on en pioche au hasard 🤭',
    add: '📷 Choisir dans ma galerie',
    reroll: '🔀 Retirer au hasard',
    swap: 'Touche une image pour la changer',
    sendGo: (n: number) => `Envoyer ces ${n} et je suis prêt !`,
    pool: (n: number) => `${n} dans ta sélection`,
    sending: (k: number, n: number) => `Envoi… ${k} / ${n}`,
    sent: (n: number) => `${n} reçue(s) par la télé`,
    ready: 'Je suis prêt !',
    waitReady: 'C’est noté ! On attend les autres…',
    tooBig: 'Certaines vidéos trop longues ou trop lourdes ont été sautées',
    vote: 'À qui est-ce ?',
    owner: 'C’est à toi ! 🤫 Fais semblant de chercher…',
    right: 'Bien vu ! 🎉',
    wrong: 'Raté ! 😅',
    wait: 'Regarde la télé…',
    score: (s: number) => `Ton score : ${s}`,
    privacy: 'Tes fichiers vont directement à la télé et ne sont gardés nulle part.',
  },
  en: {
    pick: 'Open your gallery and select EVERYTHING (or as many as you can): we pick at random, even you won’t know which 🤭',
    pickVideo: 'Open your video gallery and select as many as you can: we pick at random 🤭',
    add: '📷 Pick from my gallery',
    reroll: '🔀 Draw again',
    swap: 'Tap a picture to swap it',
    sendGo: (n: number) => `Send these ${n}, I’m ready!`,
    pool: (n: number) => `${n} in your selection`,
    sending: (k: number, n: number) => `Sending… ${k} / ${n}`,
    sent: (n: number) => `${n} received by the TV`,
    ready: 'I’m ready!',
    waitReady: 'Got it! Waiting for the others…',
    tooBig: 'Video too long or too big (20 s / 8 MB max): skipped',
    vote: 'Whose is it?',
    owner: 'It’s yours! 🤫 Pretend to think…',
    right: 'Nice one! 🎉',
    wrong: 'Nope! 😅',
    wait: 'Watch the TV…',
    score: (s: number) => `Your score: ${s}`,
    privacy: 'Your files go straight to the TV and are not stored anywhere.',
  },
};

/** Photo en JPEG réduit (960 px), pour un envoi rapide. */
function shrinkImage(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 960 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

function videoOk(file: File): Promise<boolean> {
  if (file.size > MAX_VIDEO_BYTES) return Promise.resolve(false);
  return new Promise((res) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      res(v.duration <= MAX_VIDEO_SECONDS + 0.5);
    };
    v.onerror = () => res(false);
    v.src = URL.createObjectURL(file);
  });
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Manette de Photo Roulette : envoi des photos/vidéos, puis vote. */
export function RoulettePad({ data, lang, send }: { data: RoulettePadData; lang: Lang; send: (m: ToTv) => void }) {
  const T = TXT[lang];
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ k: number; n: number } | null>(null);
  const [warn, setWarn] = useState('');
  const nextId = useRef(Math.floor(Math.random() * 1e6));

  const [pool, setPool] = useState<File[]>([]);
  const [picks, setPicks] = useState<File[]>([]);
  const draw = (from: File[]) => {
    const mixed = [...from].sort(() => Math.random() - 0.5);
    const out: File[] = [];
    let vids = 0;
    for (const f of mixed) {
      if (out.length >= MAX_MEDIA) break;
      const v = f.type.startsWith('video/');
      if (v && vids >= MAX_VIDEOS) continue;
      if (v) vids++;
      out.push(f);
    }
    setPicks(out);
  };
  const swap = (i: number) => {
    const rest = pool.filter((f) => !picks.includes(f));
    if (!rest.length) return;
    const n = [...picks];
    n[i] = rest[Math.floor(Math.random() * rest.length)];
    setPicks(n);
  };
  const thumbs = useMemo(() => picks.map((f) => ({ url: URL.createObjectURL(f), video: f.type.startsWith('video/') })), [picks]);
  useEffect(() => () => thumbs.forEach((t) => URL.revokeObjectURL(t.url)), [thumbs]);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    const list = files.slice(0, Math.max(0, MAX_MEDIA - data.sent));
    setWarn('');
    for (let k = 0; k < list.length; k++) {
      setBusy({ k: k + 1, n: list.length });
      const f = list[k];
      const video = f.type.startsWith('video/');
      try {
        if (video && !(await videoOk(f))) {
          setWarn(T.tooBig);
          continue;
        }
        const url = video ? await readAsDataUrl(f) : await shrinkImage(f);
        const id = nextId.current++;
        const total = Math.ceil(url.length / CHUNK);
        for (let p = 0; p < total; p++) {
          send({ t: 'act', a: 'up', n: [id, p, total, video ? 1 : 0], s: url.slice(p * CHUNK, (p + 1) * CHUNK) });
          // Petite pause : la liaison reste fluide (et le ping passe)
          if (p % 4 === 3) await pause(30);
        }
      } catch {
        /* fichier illisible : on passe au suivant */
      }
    }
    setBusy(null);
    send({ t: 'act', a: 'ready' });
  };

  if (data.phase === 'upload')
    return (
      <div className="traitor">
        <p className="pad-title">{data.video ? T.pickVideo : T.pick}</p>
        {data.ready ? (
          <p className="pad-title pulse">{T.waitReady}</p>
        ) : busy ? (
          <p className="pad-title pulse">{T.sending(busy.k, busy.n)}</p>
        ) : (
          <>
            {hasGallery() && (
              <button
                className="btn big mint"
                onClick={async () => {
                  setBusy({ k: 0, n: data.video ? 8 : MAX_MEDIA });
                  try {
                    const files = await randomFromGallery(data.video ? 8 : MAX_MEDIA, !!data.video);
                    if (files.length) return void upload(files);
                  } catch {
                    /* autorisation refusée : on garde le choix manuel */
                  }
                  setBusy(null);
                }}
              >
                🎲 {lang === 'fr' ? 'Piocher au hasard dans ma galerie' : 'Pick at random from my gallery'}
              </button>
            )}
            <button className="btn big sun" onClick={() => fileRef.current?.click()}>
              {T.add}
            </button>
            {false && pool.length > 0 && (
              <>
                <p className="pad-small">
                  {T.pool(pool.length)} · {T.swap}
                </p>
                <div className="roulette-grid">
                  {thumbs.map((t, i) => (
                    <button key={t.url} className="roulette-thumb" onClick={() => swap(i)}>
                      {t.video ? <video src={t.url} muted playsInline /> : <img src={t.url} alt="" />}
                      {t.video && <span>🎬</span>}
                    </button>
                  ))}
                </div>
                <button className="btn alt" onClick={() => draw(pool)}>
                  {T.reroll}
                </button>
                <button className="btn big mint" onClick={() => void upload(picks)}>
                  {T.sendGo(picks.length)}
                </button>
              </>
            )}
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={data.video ? 'video/*' : 'image/*'}
          multiple
          hidden
          onChange={(e) => {
            const all = [...(e.target.files ?? [])].filter((f) => f.type.startsWith(data.video ? 'video/' : 'image/'));
            if (!all.length) return;
            setPool(all);
            // Tirage au hasard puis envoi direct : surprise totale
            const mixed = [...all].sort(() => Math.random() - 0.5).slice(0, data.video ? 8 : MAX_MEDIA);
            void upload(mixed);
          }}
        />
        {warn && <p className="pad-small uc-note">{warn}</p>}
        <p className="pad-small">{T.privacy}</p>
      </div>
    );

  return (
    <div className="traitor">
      <p className="pad-small">{T.score(data.score)}</p>
      {data.act === 'vote' ? (
        <>
          <p className="pad-title">{T.vote}</p>
          <div className="choices">
            {data.options.map((o) => (
              <button
                key={o.i}
                className={`choice ${data.picked === o.i ? 'on' : ''}`}
                style={{ ['--c' as string]: o.color }}
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(20);
                  send({ t: 'act', a: 'pick', n: [o.i] });
                }}
              >
                {o.name}
              </button>
            ))}
          </div>
        </>
      ) : data.act === 'owner' ? (
        <p className="pad-title">{T.owner}</p>
      ) : data.phase === 'reveal' && data.right !== null ? (
        <p className="pad-title">{data.right ? T.right : T.wrong}</p>
      ) : (
        <p className="pad-title pulse">{T.wait}</p>
      )}
    </div>
  );
}
