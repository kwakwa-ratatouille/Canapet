import { TEAMS } from '../games/teams';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { gameById } from '../games/registry';
import { TUTOS } from '../games/tutos';
import { sofaGroup, characterGroup, starGroup } from '../shared/art/canapet-art.js';
import { CharCanvas } from '../shared/CharCanvas';
import { LIGHT, PREVIEW } from '../shared/device';
import { ordinal, t } from '../shared/i18n';
import { gameIcon, tint, Wordmark } from '../shared/Logo';
import { INK, MENTHE, ROSE, SOLEIL, VIOLET } from '../shared/palette';
import { joinUrl } from '../shared/protocol';
import { QR } from '../shared/QR';
import { audioLocked, isMuted, setMuted, unlockAudio } from '../shared/sound';
import { Session, TOURNAMENT_LEN, type Player } from './session';

const W = 1920;
const H = 1080;
const CODE_TILES = [ROSE, VIOLET, MENTHE, '#ff9a1f'];

export function TvApp() {
  const session = useMemo(() => new Session(PREVIEW), []);
  // En aperçu, la session est accessible depuis la console pour les tests.
  if (PREVIEW) (window as unknown as { __session: Session }).__session = session;
  useSyncExternalStore(session.subscribe, () => session.version);
  const [locked, setLocked] = useState(audioLocked());
  const [muted, setMutedState] = useState(isMuted());
  const lang = session.lang();
  const code = session.net.code;

  // Dans le récepteur Chromecast (iframe), on transmet le code du salon pour que le téléphone s'y connecte.
  useEffect(() => {
    if (window.parent !== window && code) window.parent.postMessage({ canapet: 'code', code }, '*');
  }, [code]);
  useEffect(() => {
    if (window.parent === window) return;
    const net = session.net;
    if (net.status === 'error') window.parent.postMessage({ canapet: 'status', text: t(lang, 'netError', { e: net.error }) }, '*');
  });

  useEffect(() => {
    const id = setInterval(() => setLocked(audioLocked()), 800);
    const unlock = () => {
      unlockAudio();
      setLocked(audioLocked());
    };
    const keys = (e: KeyboardEvent) => {
      unlock();
      const k = e.key.toLowerCase();
      const pick: Record<string, string> = {
        d: 'obstacles',
        b: 'bluff',
        s: 'sumo',
        p: 'bombes',
        k: 'kart',
        a: 'archers',
        g: 'dessin',
        v: 'traitre',
        c: 'combat',
        w: 'bagarre',
        o: 'cuisine',
        y: 'plateau',
      };
      if (k === 'h') session.hostAction('family');
      if (k === 'e') session.hostAction('teams');
      if (k === 'enter') session.hostAction(session.phase === 'results' ? 'next' : 'pick', 'pouces');
      if (pick[k]) session.hostAction('pick', pick[k]);
      if (k === 't') session.hostAction('tournament');
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
  const def = session.def;

  return (
    <div className="tv">
      {session.phase === 'lobby' ? <Lobby session={session} players={players} hostPid={hostPid} /> : <GameView session={session} />}

      {session.phase !== 'lobby' && code && (
        <div className="corner-join">
          <QR text={joinUrl(code)} size={120} />
          <div>
            {def && <small>{def.name[lang]}</small>}
            {session.mode === 'tournament' && <small>{t(lang, 'gameStep', { i: session.step + 1, n: TOURNAMENT_LEN })}</small>}
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
  const host = players.find((p) => p.pid === hostPid);
  const connected = players.filter((p) => p.connected).length;
  return (
    <div className="lobby">
      <header className="tv-top">
        <Wordmark className="tv-wordmark" />
        <span className="tv-top-right">
          {session.family && <span className="family-pill">👨‍👩‍👧 {t(lang, 'family')}</span>}
          {session.teams && <span className="family-pill teams-pill">🍓 {t(lang, 'teams')} 🌿</span>}
          <span className="count-pill">{t(lang, 'playersCount', { n: connected })}</span>
        </span>
      </header>
      <div className="lobby-main">
        <div className="join-card">
          <div className="qr-box">{code ? <QR text={url} size={360} /> : <div className="qr-wait" />}</div>
          <p className="join-title">{t(lang, 'scanWith')}</p>
          <p className="join-sub">{t(lang, 'orType', { url: shortUrl })}</p>
          <div className="code">
            {(code || '····').split('').map((c, i) => (
              <span key={i} style={{ background: CODE_TILES[i % 4] }}>
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="slots">
          {slots.map((p, i) =>
            p ? (
              <div key={p.pid} className={`slot ${p.connected ? '' : 'off'} ${session.teams ? 'team' + p.team : ''}`}>
                {p.pid === hostPid && <span className="slot-badge">👑</span>}
                {session.teams && (
                  <span className="slot-team" style={{ background: TEAMS[p.team].color }}>
                    {TEAMS[p.team].emoji}
                  </span>
                )}
                <div className="slot-disc" style={{ background: tint(p.color, 0.35) }}>
                  <CharCanvas profile={p} size={160} ghost={!p.connected} />
                </div>
                <div className="slot-name">{p.name}</div>
              </div>
            ) : (
              <div key={'e' + i} className="slot empty">
                <span>+</span>
                <small>{t(lang, 'freeSlot')}</small>
              </div>
            ),
          )}
        </div>
      </div>
      <p className="lobby-hint">
        {host ? t(lang, 'hostLaunches', { name: host.name }) : t(lang, 'waitingPlayers')}
        {PREVIEW && <span className="kbd"> · Entrée, D, B, S, P, K, A, W, O, V, G, Y, C = jeux · T = Tournoi · E = équipes</span>}
      </p>
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
      drawIntro(g, session);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [session]);
  return <canvas ref={ref} className="game-canvas" />;
}

/** Icônes de jeux chargées une seule fois pour l'écran d'intro. */
const icons = new Map<string, HTMLImageElement>();
function iconImage(slug: string) {
  let img = icons.get(slug);
  if (!img) {
    img = new Image();
    img.src = gameIcon(slug);
    icons.set(slug, img);
  }
  return img;
}

/** Texte « autocollant » : ombre prune décalée, rebord blanc, puis la couleur. */
export function stickerText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string) {
  g.save();
  g.font = `700 ${size}px Fredoka, sans-serif`;
  g.textAlign = 'center';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.28;
  g.strokeStyle = INK;
  g.strokeText(text, x, y + size * 0.08);
  g.fillStyle = INK;
  g.fillText(text, x, y + size * 0.08);
  g.strokeStyle = '#fff';
  g.strokeText(text, x, y);
  g.lineWidth = size * 0.1;
  g.strokeStyle = INK;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
  g.restore();
}

function drawIntro(g: CanvasRenderingContext2D, session: Session) {
  if (session.phase !== 'game' || !session.def) return;
  const { title, count, tutoLeft } = session.introState();
  const lang = session.lang();
  const def = session.def;
  if (title > 0) {
    const a = Math.min(1, title * 3);
    g.globalAlpha = a;
    g.fillStyle = def.color;
    g.fillRect(0, 0, W, H);
    // Ronds décoratifs dans le fond
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      g.arc((k * 337) % W, 120 + ((k * 211) % 860), 90 + (k % 3) * 50, 0, Math.PI * 2);
      g.fill();
    }
    const tuto = TUTOS[def.id]?.[lang];
    const map = session.game?.mapName?.[lang];
    if (session.mode === 'tournament') stickerText(g, t(lang, 'gameStep', { i: session.step + 1, n: TOURNAMENT_LEN }), W / 2, 80, 52, SOLEIL);
    if (tuto && tutoLeft > 0) {
      // Carte tuto : icône + nom à gauche, but et 3 étapes à droite.
      const x0 = 150;
      const y0 = 130;
      const cw = 1620;
      const ch = 820;
      g.fillStyle = INK;
      g.beginPath();
      g.roundRect(x0, y0 + 14, cw, ch, 56);
      g.fill();
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(x0, y0, cw, ch, 56);
      g.fill();
      g.stroke();
      const img = iconImage(def.slug);
      if (img.complete && img.naturalWidth) g.drawImage(img, x0 + 70, y0 + 70, 320, 320);
      stickerText(g, def.name[lang], x0 + 230, y0 + 480, 64, ROSE);
      if (map) {
        g.fillStyle = def.color;
        g.beginPath();
        g.roundRect(x0 + 60, y0 + 530, 340, 64, 32);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.font = '700 30px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.fillText((lang === 'fr' ? 'Carte : ' : 'Map: ') + map, x0 + 230, y0 + 573);
      }
      // But
      g.textAlign = 'left';
      g.fillStyle = INK;
      g.font = '700 46px Fredoka, sans-serif';
      wrap(g, tuto.goal, x0 + 480, y0 + 110, 1060, 54, 'left');
      // Étapes
      tuto.steps.forEach(([icon, text], i) => {
        const y = y0 + 250 + i * 170;
        g.fillStyle = [ROSE, VIOLET, MENTHE][i];
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.arc(x0 + 540, y + 40, 52, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.font = '56px sans-serif';
        g.textAlign = 'center';
        g.fillText(icon, x0 + 540, y + 60);
        g.fillStyle = INK;
        g.font = '700 36px Nunito, sans-serif';
        g.textAlign = 'left';
        wrap(g, text, x0 + 620, y + 30, 940, 44, 'left');
      });
      // Barre de temps restant
      g.fillStyle = '#f1e6f7';
      g.beginPath();
      g.roundRect(x0 + 60, y0 + ch - 90, cw - 120, 28, 14);
      g.fill();
      g.fillStyle = def.color;
      g.beginPath();
      g.roundRect(x0 + 60, y0 + ch - 90, (cw - 120) * tutoLeft, 28, 14);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 4;
      g.beginPath();
      g.roundRect(x0 + 60, y0 + ch - 90, cw - 120, 28, 14);
      g.stroke();
      stickerText(g, lang === 'fr' ? 'Prends ton téléphone, ça commence !' : 'Grab your phone, here we go!', W / 2, H - 22, 44, '#fff');
      g.globalAlpha = 1;
      return;
    }
    // Intro courte (jeu déjà vu) : icône + nom
    g.fillStyle = INK;
    g.beginPath();
    g.roundRect(560, 170, 800, 700, 48);
    g.fill();
    g.fillStyle = '#fff';
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(560, 155, 800, 700, 48);
    g.fill();
    g.stroke();
    const img = iconImage(def.slug);
    if (img.complete && img.naturalWidth) g.drawImage(img, 810, 195, 300, 300);
    stickerText(g, def.name[lang], W / 2, 620, 92, ROSE);
    g.fillStyle = INK;
    g.font = '700 38px Nunito, sans-serif';
    g.textAlign = 'center';
    wrap(g, def.how[lang], W / 2, 700, 720, 46);
    if (map) stickerText(g, (lang === 'fr' ? 'Carte : ' : 'Map: ') + map, W / 2, 960, 52, '#fff');
    g.globalAlpha = 1;
    return;
  }
  if (count > -0.8) {
    const n = Math.ceil(count);
    const frac = count - Math.floor(count);
    const label = n > 0 ? String(n) : t(lang, 'go');
    const s = 1 + (n > 0 ? frac : (count + 0.8) / 0.8) * 0.4;
    g.save();
    g.translate(W / 2, H / 2 + 70);
    g.scale(s, s);
    stickerText(g, label, 0, 0, 200, n > 0 ? SOLEIL : MENTHE);
    g.restore();
  }
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, align: CanvasTextAlign = 'center') {
  g.textAlign = align;
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, y);
}

function Results({ session }: { session: Session }) {
  const lang = session.lang();
  const def = session.def;
  const rows = session.results;
  const maxTotal = Math.max(1, ...rows.map((r) => session.players.get(r.pid)?.total ?? 0));
  const tournament = session.mode === 'tournament';
  const nextId = tournament ? session.plan[session.step + 1] : null;
  const next = nextId ? gameById(nextId) : null;
  const compact = rows.length > 7;
  return (
    <div className="overlay results-bg">
      <h2 className="sticker title">{t(lang, 'roundResults')}</h2>
      <p className="results-sub">
        {tournament ? `${t(lang, 'roundOf', { i: session.step + 1, n: TOURNAMENT_LEN })} · ` : ''}
        {def?.name[lang]}
      </p>
      {session.teamScore && (
        <div className="team-score">
          {TEAMS.map((tm, k) => (
            <span key={k} className={session.teamScore!.winner >= 0 && session.teamScore!.winner !== k ? 'lose' : ''} style={{ background: tm.color }}>
              {session.teamScore!.winner === k ? '👑 ' : ''}
              {tm.emoji} {tm.name[lang]} · {session.teamScore!.avg[k]}
            </span>
          ))}
        </div>
      )}
      <div className="results-wrap">
        <ol className={`results-list ${compact ? 'compact' : ''}`}>
          {rows.map((r) => {
            const total = session.players.get(r.pid)?.total ?? 0;
            return (
              <li key={r.pid} className="res-row">
                <span className={`rank-disc r${Math.min(4, r.rank)}`}>{r.rank}</span>
                {r.team !== undefined && <span className="team-dot" style={{ background: TEAMS[r.team].color }} />}
                <CharCanvas profile={r.profile} size={compact ? 52 : 64} still mood={r.rank === 1 ? 'win' : 'happy'} />
                <span className="who">{r.profile.name}</span>
                {!r.bot && (
                  <>
                    <span className="bar">
                      <i style={{ width: `${(total / maxTotal) * 100}%`, background: r.profile.color }} />
                    </span>
                    <span className="total">{total}</span>
                    <span className="plus">+{r.points}</span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
        <aside className="next-card">
          {next ? (
            <>
              <b>{t(lang, 'nextUp')}</b>
              <img src={gameIcon(next.slug)} alt="" />
              <span>{next.name[lang]}</span>
            </>
          ) : (
            <span className="next-hint">{t(lang, 'hostChooses')}</span>
          )}
        </aside>
      </div>
    </div>
  );
}

const SOFA = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${sofaGroup()}<g transform="translate(44 24) scale(.88)">${characterGroup('coussin', SOLEIL, { mood: 'win' })}</g></svg>`;
const CONFETTI = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 53) % 100,
  y: (i * 37) % 70,
  r: (i * 47) % 180,
  c: [ROSE, SOLEIL, MENTHE, VIOLET, '#2ec5ff'][i % 5],
}));
const STAR = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${starGroup(20, 20, 16, SOLEIL, 3)}</svg>`;

function Podium({ players, lang }: { players: Player[]; lang: 'fr' | 'en' }) {
  const ranked = [...players].sort((a, b) => b.total - a.total);
  const top = [ranked[1], ranked[0], ranked[2]];
  return (
    <div className="overlay podium-bg">
      {CONFETTI.map((c, i) => (
        <i key={i} className="confetti" style={{ left: `${c.x}%`, top: `${c.y}%`, background: c.c, transform: `rotate(${c.r}deg)` }} />
      ))}
      <h2 className="sticker title sun">{t(lang, 'champions')}</h2>
      <div className="podium">
        {top.map((p, i) => {
          const place = [2, 1, 3][i];
          return p ? (
            <div key={p.pid} className={`step step${place}`}>
              {place === 1 && <span className="podium-star" dangerouslySetInnerHTML={{ __html: STAR }} />}
              <CharCanvas profile={p} size={[180, 210, 165][i]} mood="win" arms />
              <div className="block">
                <b>{place}</b>
                <span>{p.name}</span>
                <small>
                  {p.total} {t(lang, 'pts')}
                </small>
              </div>
            </div>
          ) : (
            <div key={i} className="step" />
          );
        })}
      </div>
      {ranked.length > 3 && (
        <p className="podium-rest">
          {ranked.slice(3).map((p, i) => (
            <span key={p.pid}>
              {ordinal(lang, i + 4)} {p.name} · {p.total}
            </span>
          ))}
        </p>
      )}
      <div className="podium-sofa" dangerouslySetInnerHTML={{ __html: SOFA }} />
      <p className="hint">{t(lang, 'podiumHint')}</p>
    </div>
  );
}
