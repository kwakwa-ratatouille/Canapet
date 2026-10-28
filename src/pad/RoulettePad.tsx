import { useEffect, useMemo, useRef, useState } from 'react';
import { hasGallery, randomFromGallery } from '../shared/native';
import { CHUNK, MAX_MEDIA, MAX_VIDEO_BYTES, MAX_VIDEOS, MAX_VIDEO_SECONDS, type RoulettePadData } from '../games/rouletteShared';
import type { Lang, ToTv } from '../shared/protocol';

const TXT = {
  fr: {
    pick: 'Sélectionne une large partie de ta galerie. Trois photos seront tirées au sort, sans que tu saches lesquelles.',
    auto: 'Seize photos tirées au sort dans ta galerie. Relance si elles ne te conviennent pas, puis valide : la télé en gardera trois.',
    autoBtn: 'Tirer au sort',
    orManual: 'ou sélectionner moi-même',
    digging: 'Tirage en cours…',
    noAccess: 'Accès aux photos refusé. Autorise-le dans les réglages du téléphone, puis touche Tirer au sort.',
    pickVideo: 'Sélectionne plusieurs vidéos de 20 secondes maximum. Certaines seront tirées au sort.',
    add: 'Ouvrir la galerie',
    reroll: 'Relancer le tirage',
    swap: 'Touche une image pour la changer',
    sendGo: (n: number) => `Valider ces ${n} photos`,
    pool: (n: number) => `${n} dans ta sélection`,
    sending: (k: number, n: number) => `Envoi à la télé : ${k}/${n}`,
    sent: (n: number) => `${n} reçue(s) par la télé`,
    ready: 'Je suis prêt !',
    waitReady: 'Envoyé. En attente des autres joueurs.',
    tooBig: 'Les vidéos de plus de 20 secondes ont été ignorées.',
    vote: 'À qui est-ce ?',
    owner: 'C’est à toi ! 🤫 Fais semblant de chercher…',
    right: 'Bien vu ! 🎉',
    wrong: 'Raté ! 😅',
    wait: 'Regarde la télé…',
    score: (s: number) => `Ton score : ${s}`,
    privacy: 'Les fichiers ne sont pas conservés : ils transitent seulement par la télé.',
  },
  en: {
    pick: 'Select a large part of your gallery. Three photos will be drawn at random, without you knowing which.',
    auto: 'Sixteen random photos from your gallery. Draw again if you don’t like them, then confirm: the TV will keep three.',
    autoBtn: 'Draw at random',
    orManual: 'or select them myself',
    digging: 'Drawing…',
    noAccess: 'Photo access denied. Allow it in your phone settings, then tap Draw at random.',
    pickVideo: 'Select several videos of 20 seconds or less. Some will be drawn at random.',
    add: 'Open gallery',
    reroll: 'Draw again',
    swap: 'Tap a picture to swap it',
    sendGo: (n: number) => `Confirm these ${n} photos`,
    pool: (n: number) => `${n} in your selection`,
    sending: (k: number, n: number) => `Sending to the TV: ${k}/${n}`,
    sent: (n: number) => `${n} received by the TV`,
    ready: 'I’m ready!',
    waitReady: 'Sent. Waiting for the other players.',
    tooBig: 'Videos longer than 20 seconds were skipped.',
    vote: 'Whose is it?',
    owner: 'It’s yours! 🤫 Pretend to think…',
    right: 'Nice one! 🎉',
    wrong: 'Nope! 😅',
    wait: 'Watch the TV…',
    score: (s: number) => `Your score: ${s}`,
    privacy: 'Files are not kept: they only pass through the TV.',
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

  // Appli : tirage de 16 photos dans la galerie, montrées avant l'envoi ; on peut relancer autant qu'on veut
  const fromGallery = async () => {
    setBusy({ k: 0, n: data.video ? 8 : MAX_MEDIA });
    setWarn('');
    try {
      const files = await randomFromGallery(data.video ? 8 : MAX_MEDIA, !!data.video);
      if (files.length) setPicks(files);
      else setWarn(T.noAccess);
    } catch {
      setWarn(T.noAccess);
    }
    setBusy(null);
  };
  const autoDone = useRef(false);
  useEffect(() => {
    if (data.phase !== 'upload' || data.ready || data.sent > 0 || autoDone.current || !hasGallery()) return;
    autoDone.current = true;
    void fromGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.phase]);

  if (data.phase === 'upload')
    return (
      <div className="traitor">
        <p className="pad-title">{data.video ? T.pickVideo : hasGallery() ? T.auto : T.pick}</p>
        {data.ready ? (
          <p className="pad-title pulse">{T.waitReady}</p>
        ) : busy ? (
          <p className="pad-title pulse">{busy.k ? T.sending(busy.k, busy.n) : T.digging}</p>
        ) : hasGallery() ? (
          <>
            {picks.length > 0 && (
              <div className="roulette-grid">
                {thumbs.map((t) => (
                  <div key={t.url} className="roulette-thumb">
                    {t.video ? <video src={t.url} muted playsInline /> : <img src={t.url} alt="" />}
                    {t.video && <span>🎬</span>}
                  </div>
                ))}
              </div>
            )}
            <button className="btn alt" onClick={() => void fromGallery()}>
              {picks.length ? T.reroll : T.autoBtn}
            </button>
            {picks.length > 0 && (
              <button className="btn big mint" onClick={() => void upload(picks)}>
                {T.sendGo(picks.length)}
              </button>
            )}
          </>
        ) : (
          <button className="btn big sun" onClick={() => fileRef.current?.click()}>
            {T.add}
          </button>
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
