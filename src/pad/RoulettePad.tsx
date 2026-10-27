import { useRef, useState } from 'react';
import { CHUNK, MAX_MEDIA, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, type RoulettePadData } from '../games/rouletteShared';
import type { Lang, ToTv } from '../shared/protocol';

const TXT = {
  fr: {
    pick: 'Choisis des photos et vidéos de ta galerie (8 max). La télé en tirera quelques-unes au hasard 🤭',
    add: '📷 Ajouter des photos / vidéos',
    sending: (k: number, n: number) => `Envoi… ${k} / ${n}`,
    sent: (n: number) => `${n} reçue(s) par la télé`,
    ready: 'Je suis prêt !',
    waitReady: 'C’est noté ! On attend les autres…',
    tooBig: 'Vidéo trop longue ou trop lourde (20 s / 8 Mo max) : ignorée',
    vote: 'À qui est-ce ?',
    owner: 'C’est à toi ! 🤫 Fais semblant de chercher…',
    right: 'Bien vu ! 🎉',
    wrong: 'Raté ! 😅',
    wait: 'Regarde la télé…',
    score: (s: number) => `Ton score : ${s}`,
    privacy: 'Tes fichiers vont directement à la télé et ne sont gardés nulle part.',
  },
  en: {
    pick: 'Pick photos and videos from your gallery (8 max). The TV will draw a few at random 🤭',
    add: '📷 Add photos / videos',
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

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files].slice(0, Math.max(0, MAX_MEDIA - data.sent));
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
  };

  if (data.phase === 'upload')
    return (
      <div className="traitor">
        <p className="pad-title">{T.pick}</p>
        <button className="btn big sun" disabled={!!busy || data.sent >= MAX_MEDIA} onClick={() => fileRef.current?.click()}>
          {busy ? T.sending(busy.k, busy.n) : T.add}
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
        <p className="pad-small">{T.sent(data.sent)}</p>
        {warn && <p className="pad-small uc-note">{warn}</p>}
        {data.ready ? (
          <p className="pad-title pulse">{T.waitReady}</p>
        ) : (
          <button className="btn big mint" disabled={!!busy || data.sent === 0} onClick={() => send({ t: 'act', a: 'ready' })}>
            {T.ready}
          </button>
        )}
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
