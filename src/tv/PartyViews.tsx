// Écrans de soirée à la télé : roue de la honte, questions de la soirée, départage au chrono.
import { useEffect, useRef, useState } from 'react';
import { CharCanvas } from '../shared/CharCanvas';
import { INK } from '../shared/palette';
import { TIE_TARGET, VOTE_TIME, type Session } from './session';

type L = 'fr' | 'en';
const SEG_COLORS = ['#ff4f9a', '#ffd60a', '#2ec5ff', '#1fc9a0', '#9b5cff', '#ff9a1f', '#7bd13b', '#ff6b6b'];

/** Redessine le composant à chaque image (pour les chronos et la roue). */
function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      set((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

// ——— Roue de la honte ———

export function Wheel({ session, lang }: { session: Session; lang: L }) {
  const w = session.wheel;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const wh = session.wheel;
      if (!wh) return;
      const n = wh.items.length;
      const seg = (Math.PI * 2) / n;
      let rot = Math.sin(performance.now() / 600) * 0.04;
      if (wh.pick >= 0) {
        const e = Math.min(1, (performance.now() - wh.spinAt) / 6000);
        const k = 1 - Math.pow(1 - e, 4);
        const final = -Math.PI / 2 - (wh.pick + 0.5) * seg + Math.PI * 2 * 7;
        rot = final * k;
      }
      const R = 400;
      g.clearRect(0, 0, 900, 900);
      g.save();
      g.translate(450, 460);
      // Ombre plate
      g.fillStyle = INK;
      g.beginPath();
      g.arc(0, 14, R + 14, 0, Math.PI * 2);
      g.fill();
      g.rotate(rot);
      wh.items.forEach((it, i) => {
        g.fillStyle = SEG_COLORS[i % SEG_COLORS.length];
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, R, i * seg, (i + 1) * seg);
        g.closePath();
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.stroke();
        g.save();
        g.rotate((i + 0.5) * seg);
        g.translate(R * 0.66, 0);
        g.rotate(Math.PI / 2);
        g.font = '96px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(it.icon, 0, 0);
        g.restore();
      });
      g.lineWidth = 12;
      g.strokeStyle = INK;
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      g.stroke();
      g.restore();
      // Moyeu (le coussin) et flèche en haut
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 8;
      g.beginPath();
      g.arc(450, 460, 70, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.font = '80px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('💨', 450, 464);
      g.fillStyle = '#ff2a2a';
      g.beginPath();
      g.moveTo(450, 110);
      g.lineTo(410, 30);
      g.lineTo(490, 30);
      g.closePath();
      g.fill();
      g.stroke();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [session]);
  if (!w) return null;
  const fr = lang === 'fr';
  const victim = session.players.get(w.victim);
  const other = session.players.get(w.other)?.name ?? '?';
  const it = w.done ? w.items[w.pick] : null;
  return (
    <div className="overlay wheel-bg">
      <h2 className="sticker title">{fr ? '🎡 La roue de la honte' : '🎡 Wheel of shame'}</h2>
      <div className="wheel-wrap">
        <div className="wheel-side">
          {victim && <CharCanvas profile={victim} size={200} mood={it ? (it.joker ? 'win' : 'sad') : 'wow'} />}
          <b className="wheel-victim">{victim?.name}</b>
          <small>{w.pick < 0 ? (fr ? 'Touche TOURNER sur ton téléphone !' : 'Tap SPIN on your phone!') : fr ? 'Ça tourne…' : 'Spinning…'}</small>
        </div>
        <canvas ref={ref} width={900} height={900} className="wheel-canvas" />
        <ul className="wheel-list">
          {w.items.map((x, i) => (
            <li key={i} className={it && i === w.pick ? 'on' : it ? 'off' : ''} style={{ ['--sc' as string]: SEG_COLORS[i % SEG_COLORS.length] }}>
              <i>{x.icon}</i>
              {x.text[lang].replace('{X}', other)}
            </li>
          ))}
        </ul>
      </div>
      {it && (
        <div className="wheel-result">
          <span>{it.icon}</span>
          <b>
            {it.swap || it.other ? other : victim?.name} : {it.text[lang].replace('{X}', other)}
            {w.swapGage ? ` ${w.swapGage.icon} ${w.swapGage.text[lang]}` : ''}
          </b>
        </div>
      )}
    </div>
  );
}

// ——— Questions de la soirée ———

export function Vote({ session, lang }: { session: Session; lang: L }) {
  useTick();
  const v = session.vote;
  if (!v || v.i < 0 || v.i >= v.list.length) return null;
  const fr = lang === 'fr';
  const q = v.list[v.i];
  const people = session.list().filter((p) => p.connected);
  const left = Math.max(0, Math.ceil((v.endsAt - performance.now()) / 1000));
  const count = new Map<string, number>();
  for (const c of v.votes.values()) count.set(c, (count.get(c) ?? 0) + 1);
  const total = Math.max(1, v.votes.size);
  return (
    <div className="overlay vote-bg">
      <p className="vote-step">
        🗳️ {fr ? 'Questions de la soirée' : 'Party questions'} · {v.i + 1}/{v.list.length}
      </p>
      <h2 className="sticker title vote-q">{q.q.q[lang]}</h2>
      {q.kind === 'ab' && !v.reveal && (
        <div className="ab-row">
          <div className="ab-card a">{q.q.a[lang]}</div>
          <b className="ab-or">{fr ? 'OU' : 'OR'}</b>
          <div className="ab-card b">{q.q.b[lang]}</div>
        </div>
      )}
      {!v.reveal && (
        <>
          <div className="vote-timer">
            <i key={v.i} style={{ animationDuration: `${VOTE_TIME}s` }} />
            <span>{left}</span>
          </div>
          <div className="vote-who">
            {people.map((p) => (
              <span key={p.pid} className={v.votes.has(p.pid) ? 'done' : ''}>
                <CharCanvas profile={p} size={70} still mood={v.votes.has(p.pid) ? 'happy' : 'wow'} />
                {p.name} {v.votes.has(p.pid) ? '✓' : '…'}
              </span>
            ))}
          </div>
          <p className="hint">{fr ? 'Votez sur vos téléphones !' : 'Vote on your phones!'}</p>
        </>
      )}
      {v.reveal && q.kind === 'who' && (
        <div className="vote-reveal">
          {[...people]
            .sort((a, b) => (count.get(b.pid) ?? 0) - (count.get(a.pid) ?? 0))
            .slice(0, 5)
            .map((p, i) => {
              const n = count.get(p.pid) ?? 0;
              const win = v.elected.includes(p.pid);
              return (
                <div key={p.pid} className={`vote-bar ${win ? 'win' : ''}`} style={{ animationDelay: `${i * 0.25}s` }}>
                  <CharCanvas profile={p} size={win ? 120 : 80} mood={win ? 'wow' : 'happy'} />
                  <b>{p.name}</b>
                  <span className="vote-fill">
                    <i style={{ width: `${(n / total) * 100}%`, background: p.color }} />
                  </span>
                  <em>
                    {n} {fr ? 'vote' : 'vote'}
                    {n > 1 ? 's' : ''}
                  </em>
                  {win && <strong className="vote-title">{q.q.t[lang]}</strong>}
                </div>
              );
            })}
        </div>
      )}
      {v.reveal && q.kind === 'ab' && (
        <div className="ab-row reveal">
          {(['a', 'b'] as const).map((k) => {
            const n = count.get(k) ?? 0;
            return (
              <div key={k} className={`ab-card ${k} ${v.win === k ? 'win' : v.win ? 'lose' : ''}`}>
                <span>{q.q[k][lang]}</span>
                <b>{Math.round((n / total) * 100)} %</b>
                <small>
                  {people
                    .filter((p) => v.votes.get(p.pid) === k)
                    .map((p) => p.name)
                    .join(' · ')}
                </small>
              </div>
            );
          })}
        </div>
      )}
      {v.reveal && <p className="hint">{q.kind === 'who' ? (fr ? 'Ceux qui ont voté comme la majorité : +1 point' : 'Voted with the majority: +1 point') : fr ? 'La majorité marque 2 points' : 'The majority scores 2 points'}</p>}
    </div>
  );
}

// ——— Départage ———

export function Tiebreak({ session, lang }: { session: Session; lang: L }) {
  useTick();
  const tb = session.tie;
  if (!tb) return null;
  const fr = lang === 'fr';
  const e = (performance.now() - tb.startAt) / 1000;
  const shown = e < 0 ? '' : e < 3 ? e.toFixed(2).replace('.', fr ? ',' : '.') : '??' + (fr ? ',' : '.') + '??';
  const fmt = (x: number) => x.toFixed(2).replace('.', fr ? ',' : '.');
  return (
    <div className="overlay tie-bg">
      <h2 className="sticker title sun">{fr ? '⚡ Départage !' : '⚡ Tiebreak!'}</h2>
      <p className="results-sub">{fr ? `Arrêtez le chrono à ${TIE_TARGET},00 s pile… il disparaît après 3 secondes !` : `Stop the clock at exactly ${TIE_TARGET}.00 s… it vanishes after 3 seconds!`}</p>
      <div className={`tie-clock ${e >= 3 && !tb.winner ? 'hidden' : ''}`}>{tb.winner ? '🏁' : e < 0 ? Math.ceil(-e) : shown}</div>
      <div className="tie-players">
        {tb.pids.map((pid) => {
          const p = session.players.get(pid);
          if (!p) return null;
          const t = tb.stops.get(pid);
          const win = tb.winner === pid;
          return (
            <div key={pid} className={`tie-card ${win ? 'win' : ''}`}>
              <CharCanvas profile={p} size={150} mood={win ? 'win' : tb.winner ? 'sad' : 'wow'} arms={win} />
              <b>{p.name}</b>
              <span>
                {tb.winner ? (t !== undefined ? `${fmt(t)} s (${t >= TIE_TARGET ? '+' : '−'}${fmt(Math.abs(t - TIE_TARGET))})` : fr ? 'trop tard !' : 'too late!') : t !== undefined ? (fr ? '✋ Arrêté !' : '✋ Stopped!') : '⏱️'}
              </span>
              {win && <strong>👑 +1</strong>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
