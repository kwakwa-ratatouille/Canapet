import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { gameById } from '../games/registry';
import { CharCanvas } from '../shared/CharCanvas';
import { LIGHT, PREVIEW } from '../shared/device';
import { ordinal, t } from '../shared/i18n';
import { joinUrl } from '../shared/protocol';
import { QR } from '../shared/QR';
import { audioLocked, isMuted, setMuted, unlockAudio } from '../shared/sound';
import { Session, TOURNAMENT_LEN, type Player } from './session';

const W = 1920;
const H = 1080;

export function TvApp() {
  const session = useMemo(() => new Session(PREVIEW), []);
  useSyncExternalStore(session.subscribe, () => session.version);
  const [locked, setLocked] = useState(audioLocked());
  const [muted, setMutedState] = useState(isMuted());
  const lang = session.lang();
  const code = session.net.code;

  useEffect(() => {
    const id = setInterval(() => setLocked(audioLocked()), 800);
    const unlock = () => {
      unlockAudio();
      setLocked(audioLocked());
    };
    const keys = (e: KeyboardEvent) => {
      unlock();
      const k = e.key.toLowerCase();
      if (k === 'enter') session.hostAction(session.phase === 'results' ? 'next' : 'pick', 'pouces');
      if (k === 't') session.hostAction('tournament');
      if (k === 'd') session.hostAction('pick', 'obstacles');
      if (k === 'b') session.hostAction('pick', 'bluff');
      if (k === 'n') session.hostAction('next');
      if (k === 'r') session.hostAction('replay');
      if (k === 'l' || k === 'escape') session.hostAction('lobby');
      if (k === 'f') toggleFullscreen();
      if (k === 'm') {
        setMuted(!isMuted());
        setMutedState(isMuted());
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', keys);
    return () => {
      clearInterval(id);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', keys);
    };
  }, [session]);

  const players = session.list();
  const hostPid = session.hostPid();

  return (
    <div className="tv">
      {session.phase === 'lobby' ? (
        <Lobby session={session} players={players} hostPid={hostPid} />
      ) : (
        <GameView session={session} />
      )}

      {session.phase !== 'lobby' && code && (
        <div className="corner-join">
          <QR text={joinUrl(code)} size={120} />
          <div>
            <small>{t(lang, 'joinCorner')}</small>
            <b>{code}</b>
          </div>
        </div>
      )}

      {session.phase === 'results' && <Results session={session} />}
      {session.phase === 'podium' && <Podium players={players} lang={lang} />}

      <div className="tv-tools">
        {locked && !muted && <span className="pill warn">🔇 {t(lang, 'soundOn')}</span>}
        <button
          className="pill"
          onClick={() => {
            setMuted(!isMuted());
            setMutedState(isMuted());
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="pill" onClick={toggleFullscreen}>
          ⛶ {t(lang, 'fullscreen')}
        </button>
      </div>

      {session.net.status !== 'ready' && (
        <div className="diag">
          {session.net.status === 'connecting' ? t(lang, 'connecting') : t(lang, 'netError', { e: session.net.error })}
        </div>
      )}
    </div>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}

function Lobby({ session, players, hostPid }: { session: Session; players: Player[]; hostPid: string | null }) {
  const lang = session.lang();
  const code = session.net.code;
  const url = joinUrl(code);
  const shortUrl = url.replace(/^https?:\/\//, '').replace(/#.*$/, '');
  const slots = Array.from({ length: 12 }, (_, i) => players[i]);
  return (
    <div className="lobby">
      <div className="lobby-left">
        <h1 className="logo">
          Cana<span>’</span>pet
        </h1>
        <p className="lobby-sub">{t(lang, 'joinWith')}</p>
        <div className="qr-card">{code ? <QR text={url} size={360} /> : <div className="qr-wait" />}</div>
        <p className="lobby-url">
          {t(lang, 'scanOr')} <b>{shortUrl}</b> {t(lang, 'andType')}
        </p>
        <div className="code">{code ? code.split('').map((c, i) => <span key={i}>{c}</span>) : '····'}</div>
      </div>
      <div className="lobby-right">
        <div className="slots">
          {slots.map((p, i) =>
            p ? (
              <div key={p.pid} className={`slot ${p.connected ? '' : 'off'}`} style={{ ['--c' as string]: p.color }}>
                {p.pid === hostPid && <span className="crown">👑</span>}
                <CharCanvas profile={p} size={150} ghost={!p.connected} />
                <div className="slot-name">{p.name}</div>
              </div>
            ) : (
              <div key={'e' + i} className="slot empty">
                <span>{i + 1}</span>
              </div>
            ),
          )}
        </div>
        <p className="lobby-hint">
          {players.length === 0 ? t(lang, 'waitingPlayers') : t(lang, 'hostStarts', { crown: '👑' })}
          {PREVIEW && <span className="kbd"> · Entrée = Course de pouces · D = Dégringolade · B = Bar des Bobards · T = Tournoi</span>}
        </p>
      </div>
    </div>
  );
}

function GameView({ session }: { session: Session }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const scale = LIGHT ? 2 / 3 : 1;
    cv.width = W * scale;
    cv.height = H * scale;
    const g = cv.getContext('2d', { alpha: false })!;
    let raf = 0;
    const loop = (now: number) => {
      session.frame(now);
      g.setTransform(scale, 0, 0, scale, 0, 0);
      const tt = now / 1000;
      if (session.game) session.game.render(g, tt);
      drawIntro(g, session, tt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [session]);
  return <canvas ref={ref} className="game-canvas" />;
}

function drawIntro(g: CanvasRenderingContext2D, session: Session, now: number) {
  if (session.phase !== 'game' || !session.def) return;
  const { title, count } = session.introState();
  const lang = session.lang();
  if (title > 0) {
    const a = Math.min(1, title * 3);
    g.fillStyle = `rgba(255,79,154,${0.92 * a})`;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = a;
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.font = '160px sans-serif';
    g.fillText(session.def.emoji, W / 2, 400);
    g.font = '700 130px Fredoka, sans-serif';
    g.fillText(session.def.name[lang], W / 2, 580);
    g.font = '600 56px Fredoka, sans-serif';
    g.fillText(session.def.how[lang], W / 2, 700);
    if (session.mode === 'tournament') {
      g.font = '600 44px Fredoka, sans-serif';
      g.fillText(t(lang, 'gameStep', { i: session.step + 1, n: TOURNAMENT_LEN }), W / 2, 200);
    }
    g.globalAlpha = 1;
    return;
  }
  if (count > -0.8) {
    const n = Math.ceil(count);
    const frac = count - Math.floor(count);
    const label = n > 0 ? String(n) : t(lang, 'go');
    const s = 1 + (n > 0 ? frac : (count + 0.8) / 0.8) * 0.5;
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(s, s);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 200px Fredoka, sans-serif';
    g.lineWidth = 16;
    g.strokeStyle = '#3a2140';
    g.strokeText(label, 0, 0);
    g.fillStyle = n > 0 ? '#ffd60a' : '#7bd13b';
    g.fillText(label, 0, 0);
    g.restore();
  }
  void now;
}

function Results({ session }: { session: Session }) {
  const lang = session.lang();
  const def = session.def ? gameById(session.def.id) : null;
  return (
    <div className="overlay">
      <div className="results card">
        <h2>
          {def?.emoji} {t(lang, 'results')}
          {session.mode === 'tournament' && (
            <small> · {t(lang, 'gameStep', { i: session.step + 1, n: TOURNAMENT_LEN })}</small>
          )}
        </h2>
        <ol className={session.results.length > 6 ? 'two-cols' : ''}>
          {session.results.map((r) => {
            const p = session.players.get(r.pid);
            return (
              <li key={r.pid} style={{ ['--c' as string]: r.profile.color }}>
                <span className="rank">{ordinal(lang, r.rank)}</span>
                <CharCanvas profile={r.profile} size={70} still />
                <span className="who">{r.profile.name}</span>
                {!r.bot && (
                  <span className="pts">
                    +{r.points} <small>({p?.total ?? 0})</small>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="hint">{t(lang, 'hostChooses')}</p>
      </div>
    </div>
  );
}

function Podium({ players, lang }: { players: Player[]; lang: 'fr' | 'en' }) {
  const ranked = [...players].sort((a, b) => b.total - a.total);
  const top = [ranked[1], ranked[0], ranked[2]];
  return (
    <div className="overlay podium-bg">
      <h2 className="podium-title">🏆 {t(lang, 'podium')}</h2>
      <div className="podium">
        {top.map((p, i) =>
          p ? (
            <div key={p.pid} className={`step step${[2, 1, 3][i]}`}>
              <CharCanvas profile={p} size={[200, 260, 180][i]} mood="wow" />
              <div className="slot-name">{p.name}</div>
              <div className="block" style={{ background: p.color }}>
                <b>{[2, 1, 3][i]}</b>
                <span>
                  {p.total} {t(lang, 'pts')}
                </span>
              </div>
            </div>
          ) : (
            <div key={i} className="step" />
          ),
        )}
      </div>
      {ranked.length > 3 && (
        <p className="podium-rest">
          {ranked.slice(3).map((p, i) => (
            <span key={p.pid}>
              {ordinal(lang, i + 4)} {p.name} ({p.total})
            </span>
          ))}
        </p>
      )}
      <p className="hint">{t(lang, 'hostChooses')}</p>
    </div>
  );
}
