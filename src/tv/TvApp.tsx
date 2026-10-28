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
import { drawCharacter } from '../shared/characters';
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
        u: 'undercover',
        j: 'roulette',
        c: 'combat',
        w: 'bagarre',
        o: 'foot',
        x: 'reflexes',
      };
      if (k === 'h') session.hostAction('family');
      if (k === 'e') session.hostAction('teams');
      if (k === 'escape' || k === ' ') session.hostAction(session.paused ? 'resume' : 'pause');
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

      {/* Pendant le jeu, le QR code se cache (il gênait les joueurs) : il revient en pause et aux résultats */}
      {session.phase !== 'lobby' && code && (session.phase !== 'game' || session.paused) && (
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
                {p.level && p.level > 1 ? <span className="slot-level">{lang === 'fr' ? 'Niv.' : 'Lv.'} {p.level}</span> : null}
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
        {PREVIEW && <span className="kbd"> · Entrée, D, B, S, P, K, A, W, O, V, G, Y, C, U, J, O, X = jeux · T = Tournoi · E = équipes</span>}
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
      // Événements surprises : écran retourné ou qui tremble
      const ev = session.phase === 'game' ? session.event : null;
      if (ev?.kind === 'miroir') {
        g.translate(W, 0);
        g.scale(-1, 1);
      }
      if (ev?.kind === 'seisme') g.translate(Math.sin(tt * 60) * 14, Math.cos(tt * 47) * 10);
      if (session.game) session.game.render(g, tt);
      g.setTransform(scale, 0, 0, scale, 0, 0);
      if (session.game && !LIGHT) drawAmbience(g, tt, session);
      if (ev?.kind === 'disco') {
        g.globalAlpha = 0.22;
        g.fillStyle = ['#ff4f9a', '#ffd60a', '#2ec5ff', '#1fc9a0', '#9b5cff'][Math.floor(tt * 6) % 5];
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
        // Boule à facettes
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.arc(110, 90, 50, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      if (ev && ev.t > 0) {
        // Petite jauge de l'événement en haut à gauche
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(40, 150, 300, 30, 15);
        g.fill();
        g.fillStyle = SOLEIL;
        g.beginPath();
        g.roundRect(40, 150, Math.max(30, 300 * (ev.t / ev.dur)), 30, 15);
        g.fill();
      }
      drawTimer(g, session, tt);
      drawIntro(g, session);
      if (session.paused) drawPause(g, session, tt);
      else if (session.toast.t > 0) {
        // Bandeau du commentateur qui glisse en haut
        const k = Math.min(1, (3 - session.toast.t) * 5, session.toast.t * 4);
        g.save();
        g.globalAlpha = Math.max(0, k);
        g.translate(960, 300 - (1 - k) * 60);
        g.rotate(-0.03);
        stickerText(g, '🎙️ ' + session.toast.text, 0, 0, 64, SOLEIL);
        g.restore();
      }
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

// Ambiance « ciné » commune à tous les jeux : lumière chaude, bords assombris, poussières de lumière.
let ambience: HTMLCanvasElement | null = null;
function drawAmbience(g: CanvasRenderingContext2D, t: number, session: Session) {
  if (!ambience) {
    ambience = document.createElement('canvas');
    ambience.width = W;
    ambience.height = H;
    const a = ambience.getContext('2d')!;
    const light = a.createRadialGradient(W * 0.25, -100, 50, W * 0.25, -100, 1300);
    light.addColorStop(0, 'rgba(255,240,200,0.22)');
    light.addColorStop(1, 'rgba(255,240,200,0)');
    a.fillStyle = light;
    a.fillRect(0, 0, W, H);
    const vig = a.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
    vig.addColorStop(0, 'rgba(42,24,56,0)');
    vig.addColorStop(1, 'rgba(42,24,56,0.32)');
    a.fillStyle = vig;
    a.fillRect(0, 0, W, H);
  }
  g.drawImage(ambience, 0, 0);
  // Poussières de lumière qui flottent doucement
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 18; i++) {
    const x = (i * 277 + t * (8 + (i % 5) * 3)) % W;
    const y = (i * 151 + Math.sin(t * 0.6 + i) * 30 + t * 6) % H;
    g.beginPath();
    g.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
    g.fill();
  }
  // Ouverture en iris au début de la partie
  const st = session.introState();
  if (st.count > -1 && st.count < 3.2 && st.title <= 0) {
    const k = Math.min(1, Math.max(0, (3.2 - st.count) / 0.8));
    if (k < 1) {
      g.save();
      g.fillStyle = '#2a1838';
      g.beginPath();
      g.rect(0, 0, W, H);
      g.arc(W / 2, H / 2, Math.max(1, k * 1200), 0, Math.PI * 2, true);
      g.fill('evenodd');
      g.restore();
    }
  }
}

/** Écran de pause (l'hôte reprend depuis son téléphone, ou touche Échap). */
function drawPause(g: CanvasRenderingContext2D, session: Session, t: number) {
  const fr = session.lang() === 'fr';
  g.save();
  g.fillStyle = 'rgba(42,24,56,0.6)';
  g.fillRect(0, 0, 1920, 1080);
  g.translate(960, 470);
  g.scale(1 + Math.sin(t * 3) * 0.02, 1 + Math.sin(t * 3) * 0.02);
  stickerText(g, '⏸ PAUSE', 0, 0, 160, SOLEIL);
  g.restore();
  stickerText(g, fr ? 'L’hôte reprend la partie sur son téléphone' : 'The host resumes from their phone', 960, 640, 46, '#fff');
}

/** Chrono de la partie : pastille qui se vide, rouge et qui bat sur les 10 dernières secondes. */
function drawTimer(g: CanvasRenderingContext2D, session: Session, t: number) {
  const left = session.timeLeft();
  const def = session.def;
  if (left === null || !def?.limit) return;
  const lang = session.lang();
  if (session.timeUp > 0) {
    // Grand bandeau « Temps écoulé ! »
    const k = Math.min(1, (2.2 - session.timeUp) * 5);
    g.save();
    g.fillStyle = 'rgba(58, 33, 64, 0.35)';
    g.fillRect(0, 0, 1920, 1080);
    g.translate(960, 540);
    g.rotate(-0.06);
    g.scale(0.4 + 0.6 * k + Math.sin(t * 12) * 0.02, 0.4 + 0.6 * k + Math.sin(t * 12) * 0.02);
    stickerText(g, lang === 'fr' ? 'TEMPS ÉCOULÉ !' : "TIME'S UP!", 0, 50, 150, ROSE);
    g.restore();
    return;
  }
  const intro = session.introState();
  if (intro.count > 0) return;
  const s = Math.ceil(left);
  const hot = left <= 10;
  const warm = left <= 30;
  const x = 960;
  const y = def.timerTop ? 74 : 1006;
  const beat = hot ? 1 + 0.22 * Math.pow(left % 1, 3) : warm ? 1 + 0.05 * Math.pow(left % 1, 4) : 1;
  // Alarme : bords de l'écran qui clignotent en rouge, de plus en plus fort
  if (hot) {
    const k = (1 - left / 10) * 0.5 + 0.2;
    const a = Math.pow(left % 1, 2) * k;
    g.save();
    g.globalAlpha = a;
    g.strokeStyle = '#ff2a2a';
    g.lineWidth = 46;
    g.strokeRect(0, 0, 1920, 1080);
    g.globalAlpha = a * 0.5;
    g.lineWidth = 110;
    g.strokeRect(0, 0, 1920, 1080);
    g.restore();
  }
  g.save();
  g.translate(x, y);
  if (hot) {
    const sh = 3 + (10 - left) * 0.9;
    g.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    g.rotate(Math.sin(t * 40) * 0.04);
  }
  g.scale(beat, beat);
  const w = 250;
  const h = 86;
  // Ombre plate puis pastille
  g.fillStyle = INK;
  g.beginPath();
  g.roundRect(-w / 2, -h / 2 + 8, w, h, h / 2);
  g.fill();
  g.fillStyle = hot ? (Math.floor(t * 4) % 2 ? '#ff2a2a' : '#c4002b') : warm ? SOLEIL : '#fff';
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(-w / 2, -h / 2, w, h, h / 2);
  g.fill();
  g.stroke();
  // Cadran qui se vide
  const cx = -w / 2 + 46;
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(cx, 0, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hot ? '#ff3b3b' : MENTHE;
  g.beginPath();
  g.moveTo(cx, 0);
  g.arc(cx, 0, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / def.limit));
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(cx, 0, 30, 0, Math.PI * 2);
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = INK;
  g.fillRect(cx - 8, -44, 16, 10);
  // Temps
  g.font = '700 52px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // Les 10 dernières secondes : juste le nombre, en gros
  const label = hot ? String(s) : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  g.fillStyle = hot ? '#fff' : INK;
  if (hot) {
    g.font = '700 60px Fredoka, sans-serif';
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.strokeText(label, 34, 3);
  }
  g.fillText(label, 34, 3);
  // Petites ondes d'alarme autour de la pastille
  if (hot) {
    const r = (left % 1) * 60;
    g.globalAlpha = Math.max(0, 1 - r / 60) * 0.8;
    g.strokeStyle = '#ff2a2a';
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(-w / 2 - r, -h / 2 - r, w + r * 2, h + r * 2, h / 2 + r);
    g.stroke();
    g.globalAlpha = 1;
  }
  g.restore();
  g.textBaseline = 'alphabetic';
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
      const el = session.clock;
      // Bandes de bonbon qui défilent
      g.save();
      g.globalAlpha = a * 0.13;
      g.fillStyle = '#fff';
      for (let k = -8; k < 22; k++) {
        const x = k * 140 + ((el * 50) % 280);
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 70, 0);
        g.lineTo(x + 70 - 620, H);
        g.lineTo(x - 620, H);
        g.closePath();
        g.fill();
      }
      g.restore();
      g.globalAlpha = a;
      // Titre : icône qui sautille + nom du jeu + carte
      const img = iconImage(def.slug);
      const bob = Math.sin(el * 3) * 10;
      g.save();
      g.translate(300, 150 + bob);
      g.rotate(Math.sin(el * 2) * 0.06);
      if (img.complete && img.naturalWidth) g.drawImage(img, -115, -115, 230, 230);
      g.restore();
      g.save();
      g.textAlign = 'left';
      g.font = '700 104px Fredoka, sans-serif';
      const nameW = g.measureText(def.name[lang]).width;
      g.restore();
      stickerText(g, def.name[lang], 460 + nameW / 2, 165, 104, '#fff');
      if (map) {
        g.font = '700 34px Fredoka, sans-serif';
        const label = '🗺️ ' + (lang === 'fr' ? 'Carte : ' : 'Map: ') + map;
        const mw = g.measureText(label).width + 60;
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(460, 196, mw, 64, 32);
        g.fill();
        g.fillStyle = SOLEIL;
        g.strokeStyle = INK;
        g.lineWidth = 5;
        g.beginPath();
        g.roundRect(460, 190, mw, 64, 32);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.textAlign = 'left';
        g.fillText(label, 490, 234);
      }
      // But : grande bulle
      const bx = 140;
      const by = 290;
      const bw = W - 280;
      const bh = 120;
      g.fillStyle = INK;
      g.beginPath();
      g.roundRect(bx, by + 10, bw, bh, 60);
      g.fill();
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(bx, by, bw, bh, 60);
      g.fill();
      g.stroke();
      g.font = '700 50px Fredoka, sans-serif';
      const goal = '🎯 ' + tuto.goal;
      let gs = 50;
      while (gs > 34 && g.measureText(goal).width > bw - 80) {
        gs -= 2;
        g.font = `700 ${gs}px Fredoka, sans-serif`;
      }
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.fillText(goal, W / 2, by + bh / 2 + gs * 0.36);
      // 3 étapes : cartes qui apparaissent l'une après l'autre
      const cw = 500;
      const gap = 50;
      const cx0 = (W - (cw * 3 + gap * 2)) / 2;
      tuto.steps.forEach(([icon, text], i) => {
        const appear = Math.min(1, Math.max(0, (el - 0.4 - i * 0.45) * 3));
        if (appear <= 0) return;
        const pop = appear < 1 ? 1 + Math.sin(appear * Math.PI) * 0.12 : 1;
        const x = cx0 + i * (cw + gap);
        const y = 460;
        const ch = 370;
        const col = [ROSE, VIOLET, MENTHE][i];
        g.save();
        g.translate(x + cw / 2, y + ch / 2);
        g.scale(appear * pop, appear * pop);
        g.rotate([-0.02, 0.015, -0.01][i]);
        g.translate(-cw / 2, -ch / 2);
        g.fillStyle = INK;
        g.beginPath();
        g.roundRect(0, 14, cw, ch, 40);
        g.fill();
        g.fillStyle = '#fff';
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(0, 0, cw, ch, 40);
        g.fill();
        g.stroke();
        // Bandeau coloré avec la grosse icône
        g.save();
        g.beginPath();
        g.roundRect(0, 0, cw, ch, 40);
        g.clip();
        g.fillStyle = col;
        g.fillRect(0, 0, cw, 160);
        g.fillStyle = 'rgba(255,255,255,0.2)';
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.arc((k * 131) % cw, 30 + ((k * 53) % 110), 26 + (k % 3) * 10, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(0, 160);
        g.lineTo(cw, 160);
        g.stroke();
        g.font = '96px sans-serif';
        g.textAlign = 'center';
        g.fillText(icon, cw / 2, 120 + Math.sin(el * 4 + i) * 5);
        // Pastille numéro
        g.fillStyle = SOLEIL;
        g.beginPath();
        g.arc(44, 40, 34, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = INK;
        g.font = '700 40px Fredoka, sans-serif';
        g.fillText(String(i + 1), 44, 54);
        // Texte
        g.font = '700 36px Nunito, sans-serif';
        let ts = 36;
        const lines = (size: number) => {
          g.font = `700 ${size}px Nunito, sans-serif`;
          let n = 1;
          let line = '';
          for (const w of text.split(' ')) {
            const test = line ? line + ' ' + w : w;
            if (g.measureText(test).width > cw - 60 && line) {
              n++;
              line = w;
            } else line = test;
          }
          return n;
        };
        while (ts > 28 && lines(ts) * ts * 1.25 > ch - 200) ts -= 2;
        g.font = `700 ${ts}px Nunito, sans-serif`;
        g.fillStyle = INK;
        wrap(g, text, cw / 2, 160 + 40 + ts, cw - 60, ts * 1.25, 'center');
        g.restore();
      });
      // Barre de temps
      const px = 160;
      const pw = W - 320;
      g.fillStyle = INK;
      g.beginPath();
      g.roundRect(px, 876, pw, 30, 15);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.roundRect(px, 870, pw, 30, 15);
      g.fill();
      g.fillStyle = SOLEIL;
      g.beginPath();
      g.roundRect(px, 870, Math.max(30, pw * tutoLeft), 30, 15);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.beginPath();
      g.roundRect(px, 870, pw, 30, 15);
      g.stroke();
      // Joueurs prêts
      const humans = session.runners.filter((r) => !r.bot);
      const step = Math.min(110, 1300 / Math.max(1, humans.length));
      humans.forEach((r, i) => {
        const x = W / 2 + (i - (humans.length - 1) / 2) * step;
        const ok = session.ready.has(r.pid);
        g.globalAlpha = a * (ok ? 1 : 0.55);
        drawCharacter(g, x, 1010 + (ok ? Math.sin(el * 8 + i) * 4 : 0), 74, {
          food: r.profile.food,
          color: r.profile.color,
          hat: r.profile.hat,
          acc: r.profile.acc,
          eyes: r.profile.eyes,
          pose: r.profile.pose,
          selfie: r.selfie,
          t: el + i,
          mood: ok ? 'win' : 'happy',
        });
        if (ok) {
          g.fillStyle = MENTHE;
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.beginPath();
          g.arc(x + 34, 948, 20, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.fillStyle = '#fff';
          g.font = '700 26px Fredoka, sans-serif';
          g.textAlign = 'center';
          g.fillText('✓', x + 34, 957);
        }
      });
      g.globalAlpha = a;
      stickerText(
        g,
        lang === 'fr' ? 'Appuie sur un bouton de ta manette quand tu es prêt !' : 'Press a button on your phone when you are ready!',
        W / 2,
        1066,
        38,
        '#fff',
      );
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

/** Petits titres rigolos pour les 3 premiers. */
const TITLES: Record<'fr' | 'en', string[][]> = {
  fr: [
    ['Roi du canapé', 'Légende vivante', 'Boss final', 'Imbattable'],
    ['Presque parfait', 'Éternel challenger', 'Médaille de chocolat… non, d’argent'],
    ['Sur le fil', 'Pas loin !', 'Le bronze, c’est déjà bien'],
  ],
  en: [
    ['Couch King', 'Living legend', 'Final boss', 'Unbeatable'],
    ['Almost perfect', 'Eternal challenger', 'Silver lining'],
    ['Close call', 'So close!', 'Bronze is still shiny'],
  ],
};

function Podium({ players, lang }: { players: Player[]; lang: 'fr' | 'en' }) {
  const ranked = [...players].sort((a, b) => b.total - a.total);
  const top = [ranked[1], ranked[0], ranked[2]];
  return (
    <div className="overlay podium-bg">
      {CONFETTI.map((c, i) => (
        <i key={i} className="confetti" style={{ left: `${c.x}%`, top: `${c.y}%`, background: c.c, transform: `rotate(${c.r}deg)` }} />
      ))}
      {/* Projecteurs qui balaient la scène */}
      <span className="spot s1" />
      <span className="spot s2" />
      <span className="spot s3" />
      <h2 className="sticker title sun">{t(lang, 'champions')}</h2>
      {ranked[0] && (
        <p className="podium-winner">
          👑 {ranked[0].name} {lang === 'fr' ? 'remporte la soirée !' : 'wins the night!'}
        </p>
      )}
      <div className="podium">
        {top.map((p, i) => {
          const place = [2, 1, 3][i];
          return p ? (
            <div key={p.pid} className={`step step${place}`}>
              {place === 1 && <span className="podium-star" dangerouslySetInnerHTML={{ __html: STAR }} />}
              <div className="podium-char">
                <CharCanvas profile={p} size={[170, 210, 160][i]} mood="win" arms />
              </div>
              <div className="block">
                <b>{place}</b>
                <span>{p.name}</span>
                <small>
                  {p.total} {t(lang, 'pts')}
                </small>
                <em className="podium-title">{TITLES[lang][place - 1][p.pid.charCodeAt(0) % TITLES[lang][place - 1].length]}</em>
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
