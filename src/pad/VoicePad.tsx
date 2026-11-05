// Manette des jeux au micro : le téléphone enregistre seulement quand on appuie.
import { useEffect, useRef, useState } from 'react';
import type { VoicePadData } from '../games/voiceShared';
import { MIC_NEEDS_UPDATE } from '../shared/native';
import type { Lang, ToTv } from '../shared/protocol';

const CHUNK = 48000;

const pickType = () => ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));

export function VoicePad({ data, lang, send }: { data: VoicePadData; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  const [state, setState] = useState<'idle' | 'asking' | 'rec' | 'ready' | 'sending' | 'sent' | 'denied' | 'nope'>('idle');
  const [secs, setSecs] = useState(0);
  const [text, setText] = useState('');
  const [played, setPlayed] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const url = useRef('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipRef = useRef(data.clip);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const release = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  // Nouvelle manche : on repart de zéro. On coupe le micro en quittant le jeu.
  useEffect(() => {
    clipRef.current = data.clip;
    setState('idle');
    setPlayed(false);
    setText('');
    url.current = '';
    stopTimer();
  }, [data.clip]);
  useEffect(
    () => () => {
      stopTimer();
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
    },
    [],
  );
  // Fin de la phase d'enregistrement : le son prêt part tout seul
  useEffect(() => {
    if (data.act === 'record' && data.left <= 2 && data.left > 0 && state === 'ready') upload();
    if (data.act !== 'record') {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.left, data.act, state]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !pickType()) {
      setState('nope');
      return;
    }
    setState('asking');
    try {
      if (!stream.current) stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
    } catch {
      setState('denied');
      return;
    }
    const mimeType = pickType();
    const rec = new MediaRecorder(stream.current, { mimeType, audioBitsPerSecond: 28000 });
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = () => {
      stopTimer();
      release();
      const r = new FileReader();
      r.onload = () => {
        url.current = String(r.result);
        setState('ready');
      };
      r.readAsDataURL(new Blob(parts, { type: rec.mimeType || mimeType }));
    };
    recorder.current = rec;
    rec.start();
    navigator.vibrate?.(30);
    setSecs(data.maxSec);
    setState('rec');
    const began = Date.now();
    timer.current = setInterval(() => {
      const left = data.maxSec - (Date.now() - began) / 1000;
      setSecs(Math.max(0, Math.ceil(left)));
      if (left <= 0 && rec.state === 'recording') rec.stop();
    }, 150);
  };
  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };
  const listen = (src: string) => {
    const a = new Audio(src);
    void a.play().catch(() => {});
  };
  const upload = () => {
    if (!url.current) return;
    setState('sending');
    const total = Math.ceil(url.current.length / CHUNK);
    for (let p = 0; p < total; p++) send({ t: 'act', a: 'up', n: [clipRef.current, p, total], s: url.current.slice(p * CHUNK, (p + 1) * CHUNK) });
    navigator.vibrate?.([20, 30, 20]);
    setState('sent');
  };

  return (
    <div className="traitor voice-pad">
      <p className="pad-small">
        🎙️ {data.step} · ⭐ {data.score}
        {data.left > 0 && ` · ⏱ ${data.left}`}
      </p>
      {data.prompt && <p className="pad-title voice-prompt">{data.prompt}</p>}
      {data.heard && (
        <button className={`btn big ${played ? 'alt' : 'sun'}`} onClick={() => { listen(data.heard!); setPlayed(true); }}>
          ▶️ {fr ? 'Écouter' : 'Listen'}
        </button>
      )}
      {data.act === 'record' && MIC_NEEDS_UPDATE ? (
        <p className="pad-small uc-note">{fr ? 'Pour le micro, mets à jour l’appli avec SideStore, ou rejoins la partie depuis Safari.' : 'For the mic, update the app with SideStore, or join the game from Safari.'}</p>
      ) : data.act === 'record' && (data.sent || state === 'sent' ? (
        <p className="pad-title pulse">✅ {fr ? 'Envoyé ! Regarde la télé' : 'Sent! Watch the TV'}</p>
      ) : state === 'rec' ? (
        <button className="mic-btn on" onClick={stop}>
          <span className="mic-rings" />
          <b>{secs}</b>
          <small>{fr ? 'Touche pour arrêter' : 'Tap to stop'}</small>
        </button>
      ) : state === 'ready' ? (
        <div className="mic-after">
          <button className="btn alt" onClick={() => listen(url.current)}>🔊 {fr ? 'Réécouter' : 'Play back'}</button>
          <button className="btn alt" onClick={() => void start()}>🔁 {fr ? 'Refaire' : 'Redo'}</button>
          <button className="btn big mint" onClick={upload}>✅ {fr ? 'Envoyer à la télé' : 'Send to the TV'}</button>
        </div>
      ) : state === 'denied' ? (
        <div className="mic-after">
          <p className="pad-small uc-note">{fr ? 'Le micro est refusé. Autorise-le dans les réglages du téléphone ou du navigateur, puis réessaie.' : 'The mic is blocked. Allow it in your phone or browser settings, then try again.'}</p>
          <button className="btn alt" onClick={() => void start()}>🔁 {fr ? 'Réessayer' : 'Try again'}</button>
        </div>
      ) : state === 'nope' ? (
        <p className="pad-small uc-note">{fr ? 'Ce navigateur ne sait pas enregistrer. Essaie Safari ou Chrome à jour.' : 'This browser can’t record. Try an up-to-date Safari or Chrome.'}</p>
      ) : (
        <>
          <button className="mic-btn" disabled={state === 'asking' || (!!data.heard && !played)} onClick={() => void start()}>
            <i>🎙️</i>
            <small>{state === 'asking' ? '…' : data.heard && !played ? (fr ? 'Écoute d’abord' : 'Listen first') : fr ? 'Enregistrer' : 'Record'}</small>
          </button>
          <p className="pad-small">{fr ? `${data.maxSec} secondes au maximum. Le micro s’allume seulement quand tu appuies, et rien n’est gardé.` : `${data.maxSec} seconds max. The mic only turns on when you tap, and nothing is kept.`}</p>
        </>
      ))}
      {data.act === 'write' && (
        <form
          className="uc-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send({ t: 'act', a: 'text', s: text.trim().slice(0, 90) });
          }}
        >
          <input value={text} maxLength={90} autoComplete="off" onChange={(e) => setText(e.target.value)} placeholder={fr ? 'Ce que tu as compris…' : 'What you understood…'} />
          <button className="btn big mint" disabled={!text.trim()}>{fr ? 'Envoyer' : 'Send'}</button>
        </form>
      )}
      {data.act === 'choose' && (
        <div className="choices">
          {data.options.map((o) => (
            <button
              key={o.i}
              className={`choice ${data.picked === o.i ? 'on' : ''}`}
              style={{ ['--c' as string]: o.color }}
              onClick={() => {
                navigator.vibrate?.(20);
                send({ t: 'act', a: 'pick', n: [o.i] });
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {!data.act && !data.heard && (data.phase === 'listen' || data.phase === 'end') && <p className="pad-title pulse">📺 {fr ? 'Écoute la télé !' : 'Listen to the TV!'}</p>}
    </div>
  );
}
