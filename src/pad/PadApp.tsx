import { useEffect, useMemo, useRef, useState } from 'react';
import { GAMES, gameById } from '../games/registry';
import { CharCanvas } from '../shared/CharCanvas';
import { ACCS, COLORS, FOODS, HATS } from '../shared/characters';
import { IS_IOS, newId, save, store } from '../shared/device';
import { defaultLang, ordinal, t } from '../shared/i18n';
import type { HostAction, Lang, PadScreen, Profile, ToTv } from '../shared/protocol';
import { sfx, unlockAudio } from '../shared/sound';
import { PadNet, type PadStatus } from './net';
import { Stick } from './Stick';
import { BluffPad } from './BluffPad';
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
  lobby: { s: 'lobby', host: true, hostName: 'Moi', taken: [COLORS[1], COLORS[4]], games: GAMES.map((g) => ({ id: g.id, soon: !!g.soon })), count: 3 },
  tap: { s: 'play', layout: 'tap', game: 'pouces' },
  stick: { s: 'play', layout: 'stick', game: 'pouces' },
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

  return (
    <div className={`pad ${playing ? 'pad-play' : ''}`} style={{ ['--c' as string]: profile.color }} onPointerDown={unlockAudio}>
      {!playing && (
        <header className="pad-head">
          <CharCanvas profile={profile} size={56} />
          <div className="pad-me">
            <b>{profile.name || '???'}</b>
            <small>
              {code} · {status === 'ok' ? t(lang, 'ping', { ms: rtt }) : '…'}
            </small>
          </div>
          <button className="pill" onClick={() => setEditing(true)}>
            ✏️
          </button>
        </header>
      )}

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
        <PadScreenView screen={screen} lang={lang} send={send} host={host} edit={() => setEditing(true)} />
      )}
    </div>
  );
}

function PadScreenView({
  screen,
  lang,
  send,
  host,
  edit,
}: {
  screen: PadScreen;
  lang: Lang;
  send: (m: ToTv) => void;
  host: (a: HostAction, g?: string) => void;
  edit: () => void;
}) {
  const [picking, setPicking] = useState(false);
  switch (screen.s) {
    case 'lobby':
      if (picking && screen.host)
        return (
          <div className="pad-body">
            <div className="game-list">
              {screen.games.map((g) => {
                const def = gameById(g.id)!;
                return (
                  <button
                    key={g.id}
                    className="game-card"
                    disabled={g.soon}
                    onClick={() => {
                      setPicking(false);
                      host('pick', g.id);
                    }}
                  >
                    <span className="emoji">{def.emoji}</span>
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
        <div className="pad-body">
          {screen.host ? (
            <>
              <p className="pad-title">👑 {t(lang, 'youHost')}</p>
              <button className="btn big" onClick={() => host('tournament')}>
                🏆 {t(lang, 'tournament')}
                <small>{t(lang, 'tournamentSub')}</small>
              </button>
              <button className="btn big alt" onClick={() => setPicking(true)}>
                🎮 {t(lang, 'pickGame')}
                <small>{t(lang, 'pickGameSub')}</small>
              </button>
            </>
          ) : (
            <p className="pad-title pulse">{t(lang, 'waitHost', { name: screen.hostName })}</p>
          )}
          <p className="pad-small">{t(lang, 'players', { n: screen.count })}</p>
          <button className="btn ghost" onClick={edit}>
            ✏️ {t(lang, 'editChar')}
          </button>
        </div>
      );
    case 'play':
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
            <>
              <p className="pad-big">{screen.rank === 1 ? '🥇' : screen.rank === 2 ? '🥈' : screen.rank === 3 ? '🥉' : '🎉'}</p>
              <p className="pad-title">{t(lang, 'yourRank', { rank: ordinal(lang, screen.rank) })}</p>
              <p className="pad-small">{t(lang, 'plusPts', { p: screen.points, t: screen.total })}</p>
            </>
          )}
          {screen.host && (
            <>
              <button className="btn big" onClick={() => host('next')}>
                ⏭{' '}
                {screen.step
                  ? screen.step.index >= screen.step.count
                    ? t(lang, 'toPodium')
                    : `${t(lang, 'nextGame')} (${screen.step.index + 1}/${screen.step.count})`
                  : t(lang, 'nextGame')}
              </button>
              <button className="btn alt" onClick={() => host('replay')}>
                🔁 {t(lang, 'replay')}
              </button>
              <button className="btn ghost" onClick={() => host('lobby')}>
                🏠 {t(lang, 'toLobby')}
              </button>
            </>
          )}
        </div>
      );
    case 'podium':
      return (
        <div className="pad-body">
          <p className="pad-big">{screen.rank === 1 ? '🏆' : '🎉'}</p>
          <p className="pad-title">{t(lang, 'yourRank', { rank: ordinal(lang, screen.rank) })}</p>
          <p className="pad-small">
            {screen.total} pts
          </p>
          {screen.host && (
            <button className="btn big" onClick={() => host('lobby')}>
              🏠 {t(lang, 'toLobby')}
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
      <p className="tap-hint">{t(lang, 'tapHint')}</p>
      {[0, 1].map((s) => (
        <button
          key={s}
          className={`tap-btn ${down === s ? 'down' : ''}`}
          onPointerDown={tap(s as 0 | 1)}
          onPointerUp={() => setDown(null)}
          onPointerCancel={() => setDown(null)}
        >
          {s === 0 ? `◀ ${t(lang, 'left')}` : `${t(lang, 'right')} ▶`}
        </button>
      ))}
    </div>
  );
}

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
  const set = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));

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

  return (
    <div className="pad editor" style={{ ['--c' as string]: profile.color }}>
      <div className="editor-preview">
        <CharCanvas profile={profile} size={130} />
      </div>
      <label className="field">
        {t(lang, 'yourName')}
        <input
          value={profile.name}
          maxLength={14}
          autoComplete="off"
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Pseudo"
        />
      </label>

      <h3>{t(lang, 'character')}</h3>
      <div className="chips foods">
        {FOODS.map((f) => (
          <button key={f.id} className={`chip ${profile.food === f.id ? 'on' : ''}`} onClick={() => set({ food: f.id })}>
            <CharCanvas profile={{ ...profile, food: f.id, selfie: undefined, hat: 'aucun', acc: 'aucun' }} size={48} still />
            <small>{f.name[lang]}</small>
          </button>
        ))}
      </div>

      <h3>{t(lang, 'color')}</h3>
      <div className="chips colors">
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

      <h3>{t(lang, 'hat')}</h3>
      <div className="chips">
        {HATS.map((h) => (
          <button key={h.id} className={`chip txt ${profile.hat === h.id ? 'on' : ''}`} onClick={() => set({ hat: h.id })}>
            {h.name[lang]}
          </button>
        ))}
      </div>

      <h3>{t(lang, 'acc')}</h3>
      <div className="chips">
        {ACCS.map((a) => (
          <button key={a.id} className={`chip txt ${profile.acc === a.id ? 'on' : ''}`} onClick={() => set({ acc: a.id })}>
            {a.name[lang]}
          </button>
        ))}
      </div>

      <div className="row">
        <button className="btn alt" onClick={() => fileRef.current?.click()}>
          📸 {t(lang, 'selfie')}
        </button>
        {profile.selfie && (
          <button className="btn ghost" onClick={() => set({ selfie: undefined })}>
            {t(lang, 'removeSelfie')}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          hidden
          onChange={(e) => onSelfie(e.target.files?.[0])}
        />
      </div>

      <h3>{t(lang, 'language')}</h3>
      <div className="chips">
        {(['fr', 'en'] as Lang[]).map((l) => (
          <button key={l} className={`chip txt ${lang === l ? 'on' : ''}`} onClick={() => set({ lang: l })}>
            {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
          </button>
        ))}
      </div>

      <button className="btn big sticky" disabled={!profile.name.trim()} onClick={onDone}>
        {t(lang, 'ok')} ✓
      </button>
    </div>
  );
}
