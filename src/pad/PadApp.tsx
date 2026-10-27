import { useEffect, useMemo, useRef, useState } from 'react';
import { GAMES, gameById, playable } from '../games/registry';
import { CharCanvas } from '../shared/CharCanvas';
import { ACCS, COLORS, FOODS, HATS } from '../shared/characters';
import { IS_IOS, newId, save, store } from '../shared/device';
import { defaultLang, ordinal, t } from '../shared/i18n';
import { gameIcon, Wordmark } from '../shared/Logo';
import type { HostAction, Lang, PadScreen, Profile, ToTv } from '../shared/protocol';
import { sfx, unlockAudio } from '../shared/sound';
import { PadNet, type PadStatus } from './net';
import { Stick } from './Stick';
import { BluffPad } from './BluffPad';
import { ScribblePad } from './ScribblePad';
import { TraitorPad } from './TraitorPad';
import { BoardPad } from './BoardPad';
import type { BoardPadData } from '../games/boardShared';
import type { TraitorPadData } from '../games/traitorShared';
import type { ScribblePadData } from '../games/scribbleShared';
import type { BluffPadData } from '../games/bluffShared';

function defaultProfile(): Profile {
  return {
    name: '',
    food: FOODS[Math.floor(Math.random() * FOODS.length)].id,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    hat: 'aucun',
    acc: 'aucun',
    lang: defaultLang(),
  };
}

const DEMO: Record<string, PadScreen> = {
  lobby: { s: 'lobby', host: true, hostName: 'Moi', taken: [COLORS[1], COLORS[4], COLORS[6]], games: GAMES.map((g) => ({ id: g.id, soon: !!g.soon })), count: 4 },
  tap: { s: 'play', layout: 'tap', game: 'pouces' },
  stick: { s: 'play', layout: 'stick', game: 'kart' },
  results: { s: 'results', host: true, rank: 2, points: 7, total: 17, step: { index: 2, count: 5 } },
  podium: { s: 'podium', host: true, rank: 1, total: 42 },
};

export function PadApp({ code, demo }: { code: string; demo?: string }) {
  const [profile, setProfile] = useState<Profile>(() => store('profile', defaultProfile()));
  const pid = useMemo(() => {
    const id = store('pid', '') || newId();
    save('pid', id);
    return id;
  }, []);
  const [editing, setEditing] = useState(() => !store<Profile | null>('profile', null)?.name && !demo);
  const [screen, setScreen] = useState<PadScreen | null>(demo ? DEMO[demo] ?? DEMO.lobby : null);
  const [status, setStatus] = useState<PadStatus>(demo ? 'ok' : 'connecting');
  const [rtt, setRtt] = useState(0);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const netRef = useRef<PadNet | null>(null);
  const lang = profile.lang;

  useEffect(() => {
    if (demo) return;
    const net = new PadNet(code, {
      hello: () => ({ t: 'hello', pid, profile: profileRef.current }),
      onMsg: (m) => {
        if (m.t === 'screen') setScreen(m.screen);
        if (m.t === 'welcome' && m.color !== profileRef.current.color) setProfile((p) => ({ ...p, color: m.color }));
        if (m.t === 'buzz') {
          if (navigator.vibrate) navigator.vibrate(m.ms);
          else sfx.boing();
        }
      },
      onStatus: () => {
        setStatus(net.status);
        setRtt(net.rtt);
      },
    });
    netRef.current = net;
    net.start();
    return () => net.stop();
  }, [code, pid, demo]);

  // Profil : sauvegardé sur le téléphone et envoyé à la télé (regroupé pour ne pas inonder la liaison).
  useEffect(() => {
    save('profile', profile);
    const id = setTimeout(() => netRef.current?.send({ t: 'profile', profile }), 250);
    return () => clearTimeout(id);
  }, [profile]);

  // Écran toujours allumé pendant la partie.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<unknown> } };
    const lock = () => void nav.wakeLock?.request('screen').catch(() => {});
    lock();
    document.addEventListener('visibilitychange', lock);
    return () => document.removeEventListener('visibilitychange', lock);
  }, []);

  const send = (m: ToTv) => netRef.current?.send(m);
  const host = (action: HostAction, game?: string) => {
    sfx.click();
    send({ t: 'host', action, game });
  };

  if (editing) {
    const taken = screen?.s === 'lobby' ? screen.taken : [];
    return <Editor profile={profile} setProfile={setProfile} taken={taken} onDone={() => setEditing(false)} />;
  }

  const playing = screen?.s === 'play' && status === 'ok';
  const gameName = screen && 'game' in screen ? gameById(screen.game)?.name[lang] : '';

  return (
    <div className={`pad ${playing ? 'pad-play' : ''}`} style={{ ['--c' as string]: profile.color }} onPointerDown={unlockAudio}>
      <header className={`pad-head ${playing ? 'slim' : ''}`}>
        <CharCanvas profile={profile} size={playing ? 34 : 46} still />
        <b className="pad-name">{profile.name || '???'}</b>
        <span className="pad-info">{playing ? gameName : `${code} · ${status === 'ok' ? t(lang, 'ping', { ms: rtt }) : '…'}`}</span>
        {!playing && (
          <button className="pill" onClick={() => setEditing(true)} aria-label={t(lang, 'editChar')}>
            ✏️
          </button>
        )}
      </header>

      {status !== 'ok' ? (
        <div className="pad-status">
          {status === 'notfound' ? (
            <>
              <p>{t(lang, 'notFound', { code })}</p>
              <a className="btn" href="#/">
                {t(lang, 'back')}
              </a>
            </>
          ) : (
            <p className="pulse">{status === 'lost' ? t(lang, 'lost') : t(lang, 'connectingTv')}</p>
          )}
        </div>
      ) : !screen ? (
        <div className="pad-status">
          <p className="pulse">{t(lang, 'connectingTv')}</p>
        </div>
      ) : (
        <PadScreenView
          screen={screen}
          lang={lang}
          code={code}
          myColor={profile.color}
          send={send}
          host={host}
          edit={() => setEditing(true)}
        />
      )}
    </div>
  );
}

function PadScreenView({
  screen,
  lang,
  code,
  myColor,
  send,
  host,
  edit,
}: {
  screen: PadScreen;
  lang: Lang;
  code: string;
  myColor: string;
  send: (m: ToTv) => void;
  host: (a: HostAction, g?: string) => void;
  edit: () => void;
}) {
  const [picking, setPicking] = useState(false);
  switch (screen.s) {
    case 'lobby':
      if (picking && screen.host)
        return (
          <div className="pad-body top">
            <p className="pad-title">{t(lang, 'pickGame')}</p>
            <div className="game-list">
              {screen.games.map((g) => {
                const def = gameById(g.id)!;
                return (
                  <button
                    key={g.id}
                    className="game-card"
                    style={{ ['--g' as string]: def.color }}
                    disabled={g.soon}
                    onClick={() => {
                      setPicking(false);
                      host('pick', g.id);
                    }}
                  >
                    <img src={gameIcon(def.slug)} alt="" />
                    <b>{def.name[lang]}</b>
                    {g.soon && <small>{t(lang, 'soon')}</small>}
                  </button>
                );
              })}
            </div>
            <button className="btn ghost" onClick={() => setPicking(false)}>
              {t(lang, 'back')}
            </button>
          </div>
        );
      return (
        <div className="pad-body host">
          <Wordmark className="pad-wordmark" />
          <div className="code-card">
            <div>
              <small>{t(lang, 'codeLabel')}</small>
              <b>{code}</b>
            </div>
            <div className="code-players">
              <small>{t(lang, 'players', { n: screen.count })}</small>
              <span className="dots">
                {[myColor, ...screen.taken].slice(0, 12).map((c, i) => (
                  <i key={i} style={{ background: c }} />
                ))}
              </span>
            </div>
          </div>
          {screen.host ? (
            <>
              <p className="pad-title">{t(lang, 'hostAsk')}</p>
              <button className="big-card rose" onClick={() => host('tournament')}>
                <svg viewBox="0 0 60 60" className="bc-icon" aria-hidden>
                  <path
                    d="M30 4l7.6 16.4 17.4 2-12.9 12 3.4 17.6L30 43.3 14.5 52l3.4-17.6L5 22.4l17.4-2z"
                    fill="#ffd60a"
                    stroke="#3a2140"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  <b>{t(lang, 'tournament')}</b>
                  <small>{t(lang, 'tournamentSub')}</small>
                </span>
              </button>
              <button className="big-card violet" onClick={() => setPicking(true)}>
                <svg viewBox="0 0 60 60" className="bc-icon" aria-hidden>
                  {[
                    [6, 6, '#ffd60a'],
                    [32, 6, '#1fc9a0'],
                    [6, 32, '#2ec5ff'],
                    [32, 32, '#ff4f9a'],
                  ].map(([x, y, c]) => (
                    <rect key={`${x}${y}`} x={x} y={y} width="22" height="22" rx="6" fill={c as string} stroke="#3a2140" strokeWidth="3.5" />
                  ))}
                </svg>
                <span>
                  <b>{t(lang, 'pickGame')}</b>
                  <small>{t(lang, 'catalogue', { n: playable().length })}</small>
                </span>
              </button>
            </>
          ) : (
            <p className="pad-title pulse">{t(lang, 'waitHost', { name: screen.hostName })}</p>
          )}
          <button className="btn ghost" onClick={edit}>
            ✏️ {t(lang, 'editChar')}
          </button>
        </div>
      );
    case 'play':
      if (screen.game === 'plateau' && screen.data) return <BoardPad data={screen.data as BoardPadData} lang={lang} send={send} />;
      if (screen.game === 'traitre' && screen.data) return <TraitorPad data={screen.data as TraitorPadData} lang={lang} send={send} />;
      if (screen.game === 'dessin' && screen.data) return <ScribblePad data={screen.data as ScribblePadData} lang={lang} send={send} />;
      if (screen.layout === 'bluff' && screen.data) return <BluffPad data={screen.data as BluffPadData} lang={lang} send={send} />;
      return screen.layout === 'tap' ? <TapPad lang={lang} send={send} /> : <Stick send={send} lang={lang} game={screen.game} />;
    case 'wait':
      return (
        <div className="pad-body">
          <p className="pad-title pulse">{t(lang, 'waitNext')}</p>
        </div>
      );
    case 'results':
      return (
        <div className="pad-body">
          {screen.rank > 0 && (
            <div className="rank-card">
              <span className={`rank-disc r${Math.min(4, screen.rank)}`}>{screen.rank}</span>
              <div>
                <p className="pad-title">{t(lang, 'yourRank', { rank: ordinal(lang, screen.rank) })}</p>
                <p className="pad-small">{t(lang, 'plusPts', { p: screen.points, t: screen.total })}</p>
              </div>
            </div>
          )}
          {screen.host && (
            <>
              <button className="btn big mint" onClick={() => host('next')}>
                {screen.step
                  ? screen.step.index >= screen.step.count
                    ? t(lang, 'toPodium')
                    : `${t(lang, 'nextGame')} (${screen.step.index + 1}/${screen.step.count})`
                  : t(lang, 'nextGame')}
              </button>
              <button className="btn alt" onClick={() => host('replay')}>
                {t(lang, 'replay')}
              </button>
              <button className="btn ghost" onClick={() => host('lobby')}>
                {t(lang, 'toLobby')}
              </button>
            </>
          )}
        </div>
      );
    case 'podium':
      return (
        <div className="pad-body">
          <div className="rank-card">
            <span className={`rank-disc r${Math.min(4, screen.rank)}`}>{screen.rank}</span>
            <div>
              <p className="pad-title">{t(lang, 'yourRank', { rank: ordinal(lang, screen.rank) })}</p>
              <p className="pad-small">{screen.total} pts</p>
            </div>
          </div>
          {screen.host && (
            <button className="btn big mint" onClick={() => host('lobby')}>
              {t(lang, 'toLobby')}
            </button>
          )}
        </div>
      );
  }
}

function TapPad({ lang, send }: { lang: Lang; send: (m: ToTv) => void }) {
  const [down, setDown] = useState<number | null>(null);
  const tap = (side: 0 | 1) => (e: React.PointerEvent) => {
    e.preventDefault();
    send({ t: 'tap', side });
    setDown(side);
    if (navigator.vibrate) navigator.vibrate(8);
    if (IS_IOS) sfx.click();
  };
  return (
    <div className="tap-pad">
      {[0, 1].map((s) => (
        <button
          key={s}
          className={`round-btn ${s ? 'sun' : 'rose'} ${down === s ? 'down' : ''}`}
          onPointerDown={tap(s as 0 | 1)}
          onPointerUp={() => setDown(null)}
          onPointerCancel={() => setDown(null)}
        >
          {s === 0 ? t(lang, 'left') : t(lang, 'right')}
        </button>
      ))}
      <p className="tap-hint">{t(lang, 'tapHint')}</p>
    </div>
  );
}

type Tab = 'perso' | 'color' | 'hat' | 'deco';

function Editor({
  profile,
  setProfile,
  taken,
  onDone,
}: {
  profile: Profile;
  setProfile: (f: (p: Profile) => Profile) => void;
  taken: string[];
  onDone: () => void;
}) {
  const lang = profile.lang;
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('perso');
  const set = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

  const onSelfie = (file?: File) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const s = Math.min(img.width, img.height);
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
      set({ selfie: c.toDataURL('image/jpeg', 0.75) });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };
  const randomize = () =>
    set({
      food: pick(FOODS).id,
      color: pick(COLORS.filter((c) => !taken.includes(c))) ?? profile.color,
      hat: pick(HATS).id,
      acc: pick(ACCS).id,
    });

  const labels = lang === 'fr' ? ['Perso', 'Couleur', 'Chapeau', 'Déco'] : ['Character', 'Color', 'Hat', 'Extras'];
  const tabs: [Tab, string][] = (['perso', 'color', 'hat', 'deco'] as Tab[]).map((k, i) => [k, labels[i]]);

  return (
    <div className="pad editor" style={{ ['--c' as string]: profile.color }}>
      <h2 className="editor-title">{t(lang, 'myChar')}</h2>
      <div className="editor-preview">
        <CharCanvas profile={profile} size={150} />
      </div>
      <input
        className="name-input"
        value={profile.name}
        maxLength={14}
        autoComplete="off"
        onChange={(e) => set({ name: e.target.value })}
        placeholder={t(lang, 'yourName')}
      />
      <div className="tabs">
        {tabs.map(([k, label]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'perso' && (
        <div className="pick-grid">
          {FOODS.map((f) => (
            <button key={f.id} className={`pick ${profile.food === f.id ? 'on' : ''}`} onClick={() => set({ food: f.id })}>
              <CharCanvas profile={{ ...profile, food: f.id, selfie: undefined, hat: 'aucun', acc: 'aucun' }} size={52} still />
            </button>
          ))}
        </div>
      )}
      {tab === 'hat' && (
        <div className="pick-grid">
          {HATS.map((h) => (
            <button key={h.id} className={`pick ${profile.hat === h.id ? 'on' : ''}`} onClick={() => set({ hat: h.id })}>
              <CharCanvas profile={{ ...profile, selfie: undefined, acc: 'aucun', hat: h.id }} size={52} still />
              <small>{h.name[lang]}</small>
            </button>
          ))}
        </div>
      )}
      {tab === 'deco' && (
        <>
          <div className="pick-grid">
            {ACCS.map((a) => (
              <button key={a.id} className={`pick ${profile.acc === a.id ? 'on' : ''}`} onClick={() => set({ acc: a.id })}>
                <CharCanvas profile={{ ...profile, selfie: undefined, hat: 'aucun', acc: a.id }} size={52} still />
                <small>{a.name[lang]}</small>
              </button>
            ))}
          </div>
          <div className="lang-row">
            {(['fr', 'en'] as Lang[]).map((l) => (
              <button key={l} className={`tab ${lang === l ? 'on' : ''}`} onClick={() => set({ lang: l })}>
                {l === 'fr' ? 'Français' : 'English'}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="color-row">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`dot ${profile.color === c ? 'on' : ''}`}
            style={{ background: c }}
            disabled={taken.includes(c)}
            onClick={() => set({ color: c })}
            aria-label={c}
          />
        ))}
      </div>
      {tab === 'color' && <p className="pad-small center">{t(lang, 'colorHint')}</p>}

      <div className="editor-actions">
        <button className="btn ghost" onClick={() => (profile.selfie ? set({ selfie: undefined }) : fileRef.current?.click())}>
          📷 {profile.selfie ? t(lang, 'removeSelfie') : t(lang, 'selfie')}
        </button>
        <button className="btn sun" onClick={randomize}>
          {t(lang, 'random')}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => onSelfie(e.target.files?.[0])} />
      </div>
      <button className="btn big mint" disabled={!profile.name.trim()} onClick={onDone}>
        {t(lang, 'itsMe')}
      </button>
    </div>
  );
}
