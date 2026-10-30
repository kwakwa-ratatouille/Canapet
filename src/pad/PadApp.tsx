import { TEAMS } from '../games/teams';
import { PresidentPad } from './PresidentPad';
import type { PresidentPadData } from '../games/presidentShared';
import { VOICES } from '../shared/sound';
import { loadCloud, merge, preload, saveCloud, signIn, signOut, watchUser, type CloudUser } from '../shared/cloud';
import { GoogleLogo } from '../shared/GoogleLogo';
import './editor.css';
import { isOwned, itemKey, levelInfo, LEVEL_GIFT, loadProgress, podiumBonus, PRICES, rewardFor, saveProgress, type Kind, type Progress } from '../shared/progress';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CharCanvas } from '../shared/CharCanvas';
import { ACCS, COLORS, EYE_LIST, FOODS, HATS, POSE_LIST } from '../shared/characters';
import { IS_IOS, newId, save, store } from '../shared/device';
import { defaultLang, ordinal, t } from '../shared/i18n';
import { gameIcon, Wordmark } from '../shared/Logo';
import type { GameInfo, HostAction, Lang, PadScreen, Profile, ToTv } from '../shared/protocol';
import { sfx, unlockAudio } from '../shared/sound';
import { PadNet, type PadStatus } from './net';
import { Stick, type Cools } from './Stick';
import { ReactButton, SecretCard } from './ReactPad';
import { BluffPad } from './BluffPad';
import { ScribblePad } from './ScribblePad';
import { TraitorPad } from './TraitorPad';
import { UndercoverPad } from './UndercoverPad';
import { RoulettePad } from './RoulettePad';
import { ReflexPad } from './ReflexPad';
import type { ReflexPadData } from '../games/reflexShared';
import type { RoulettePadData } from '../games/rouletteShared';
import type { UndercoverPadData } from '../games/undercoverShared';
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
  lobby: { s: 'lobby', host: true, hostName: 'Moi', taken: [COLORS[1], COLORS[4], COLORS[6]], games: [], count: 4, family: false, teams: true, team: 0, bots: -1, botLevel: 1, voice: 0, players: [{ pid: 'a', name: 'Lulu', color: COLORS[1] }] },
  tap: { s: 'play', layout: 'tap', game: 'pouces' },
  stick: { s: 'play', layout: 'stick', game: 'kart' },
  president: { s: 'play', layout: 'buttons', game: 'president', data: { hand: [0, 5, 9, 10, 11, 22, 23, 30, 37, 44, 46, 49, 51], phase: 'play', myTurn: true, need: 2, min: 2, give: 0, giveTo: '', role: '🎩 Vice-président', turnName: 'Moi', pile: [8, 10], pileBy: 'Lulu', note: '', done: 0 } },
  results: { s: 'results', gid: 1, host: true, rank: 2, points: 7, total: 17, step: { index: 2, count: 5 } },
  paused: { s: 'paused', host: true, game: 'sumo' },
  podium: { s: 'podium', gid: 1, host: true, rank: 1, total: 42 },
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
  // Fiches des jeux envoyées par la télé (gardées pour afficher le nom du jeu après une reconnexion)
  const [family, setFamily] = useState(() => store<boolean>('family', false));
  useEffect(() => {
    if (screen?.s === 'lobby' && screen.family !== family) {
      setFamily(screen.family);
      save('family', screen.family);
    }
  }, [screen, family]);
  const [catalog, setCatalogState] = useState<GameInfo[]>(() => store<GameInfo[]>('catalog', []));
  const setCatalog = (games: GameInfo[]) => {
    setCatalogState(games);
    save('catalog', games);
  };
  useEffect(() => {
    // Manette de démonstration : pas de télé, on charge le catalogue complet à part
    if (!demo) return;
    import('../games/registry').then(({ GAMES, gameInfo }) => {
      const games = gameInfo(GAMES);
      setCatalogState(games);
      setScreen((s) => (s?.s === 'lobby' ? { ...s, games } : s));
    });
  }, [demo]);
  const [status, setStatus] = useState<PadStatus>(demo ? 'ok' : 'connecting');
  const [kicked, setKicked] = useState(false);
  const [rtt, setRtt] = useState(0);
  // Progression : la première fois, ce que le joueur porte déjà lui appartient.
  const [progress, setProgress] = useState<Progress>(() => {
    const p = loadProgress();
    if (!store('progress', null)) {
      const cur = store<Profile | null>('profile', null);
      if (cur) p.owned = [itemKey('food', cur.food), itemKey('hat', cur.hat), itemKey('acc', cur.acc)];
    }
    return p;
  });
  const [reward, setReward] = useState<{ xp: number; coins: number; level: number | null } | null>(null);
  const level = levelInfo(progress.xp).level;
  // Compte Google : on ne charge Firebase que si le joueur s'est déjà connecté une fois (ou le demande).
  const [user, setUser] = useState<CloudUser | null>(null);
  const [cloud, setCloud] = useState<'off' | 'busy' | 'ok' | 'error'>('off');
  const [useCloud, setUseCloud] = useState(() => store('cloud', false));
  const synced = useRef(false);
  useEffect(() => {
    if (!useCloud || demo) return;
    return watchUser((u) => {
      setUser(u);
      synced.current = false;
      if (!u) {
        setCloud('off');
        return;
      }
      setCloud('busy');
      loadCloud(u.uid)
        .then((remote) => {
          setProgress((p) => merge(p, remote));
          synced.current = true;
          setCloud('ok');
        })
        .catch(() => setCloud('error'));
    });
  }, [useCloud, demo]);
  // Sauvegarde sur le compte (regroupée) à chaque changement.
  useEffect(() => {
    if (!user || !synced.current) return;
    const id = setTimeout(() => {
      saveCloud(user.uid, progress)
        .then(() => setCloud('ok'))
        .catch(() => setCloud('error'));
    }, 800);
    return () => clearTimeout(id);
  }, [progress, user]);
  const connect = () => {
    save('cloud', true);
    setUseCloud(true);
    setCloud('busy');
    signIn().catch(() => setCloud('error'));
  };
  const disconnect = () => {
    void signOut();
  };
  const account = { user, cloud, connect, disconnect };
  const [live, setLive] = useState<{ rank: number; of: number; left: number | null } | null>(demo === 'stick' ? { rank: 2, of: 4, left: 83 } : null);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const netRef = useRef<PadNet | null>(null);
  // Coupure de moins de 4 s : on garde l'écran de jeu avec un petit bandeau
  const [lostLong, setLostLong] = useState(false);
  useEffect(() => {
    if (status !== 'lost') {
      setLostLong(false);
      return;
    }
    const id = setTimeout(() => setLostLong(true), 4000);
    return () => clearTimeout(id);
  }, [status]);
  const [cools, setCools] = useState<Cools>({});
  const lang = profile.lang;

  useEffect(() => {
    if (demo) return;
    const net = new PadNet(code, {
      hello: () => ({ t: 'hello', pid, profile: profileRef.current }),
      onMsg: (m) => {
        if (m.t === 'screen') {
          setScreen(m.screen);
          if (m.screen.s !== 'play') {
            setLive(null);
            setCools({});
          }
        }
        if (m.t === 'kicked') {
          setKicked(true);
          net.stop();
        }
        if (m.t === 'status') setLive({ rank: m.rank, of: m.of, left: m.left });
        if (m.t === 'cool') setCools((c) => ({ ...c, [m.b]: m.s > 0 ? { at: performance.now(), s: m.s } : undefined }));
        if (m.t === 'welcome') save('lastGame', { code, at: Date.now() });
        if (m.t === 'welcome' && m.games) setCatalog(m.games);
        if (m.t === 'screen' && m.screen.s === 'lobby' && m.screen.games.length) setCatalog(m.screen.games);
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

  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => {
    if (profile.level !== level) setProfile((p) => ({ ...p, level }));
  }, [level, profile.level]);

  // Gains de fin de partie et de podium, comptés une seule fois.
  useEffect(() => {
    if (!screen || (screen.s !== 'results' && screen.s !== 'podium') || screen.rank <= 0) return;
    const key = `${code}:${screen.s}:${screen.gid}`;
    if (progress.last === key) return;
    const gain = screen.s === 'results' ? rewardFor(screen.points, screen.rank) : { xp: 0, coins: podiumBonus(screen.rank) };
    const before = levelInfo(progress.xp).level;
    const after = levelInfo(progress.xp + gain.xp).level;
    const up = after > before;
    setProgress((p) => ({
      ...p,
      last: key,
      xp: p.xp + gain.xp,
      coins: p.coins + gain.coins + (up ? LEVEL_GIFT * (after - before) : 0),
      games: p.games + (screen.s === 'results' ? 1 : 0),
      wins: p.wins + (screen.rank === 1 ? 1 : 0),
    }));
    setReward({ xp: gain.xp, coins: gain.coins, level: up ? after : null });
    if (up) sfx.win();
    else sfx.join();
  }, [screen, code]);

  // Profil : sauvegardé sur le téléphone et envoyé à la télé (regroupé pour ne pas inonder la liaison).
  useEffect(() => {
    save('profile', profile);
    const id = setTimeout(() => netRef.current?.send({ t: 'profile', profile }), 250);
    return () => clearTimeout(id);
  }, [profile]);

  // Pas de menu « copier / rechercher », de sélection ni de glisser sur la manette (sauf dans les champs de texte)
  useEffect(() => {
    const block = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      e.preventDefault();
    };
    for (const ev of ['contextmenu', 'selectstart', 'dragstart', 'gesturestart']) document.addEventListener(ev, block);
    return () => {
      for (const ev of ['contextmenu', 'selectstart', 'dragstart', 'gesturestart']) document.removeEventListener(ev, block);
    };
  }, []);

  // Écran toujours allumé pendant la partie.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<unknown> } };
    const lock = () => void nav.wakeLock?.request('screen').catch(() => {});
    lock();
    document.addEventListener('visibilitychange', lock);
    return () => document.removeEventListener('visibilitychange', lock);
  }, []);

  const send = (m: ToTv) => netRef.current?.send(m);
  const host = (action: HostAction, game?: string, opts?: Record<string, number>) => {
    sfx.click();
    send({ t: 'host', action, game, opts });
  };

  if (editing) {
    const taken = screen?.s === 'lobby' ? screen.taken : [];
    return <Editor profile={profile} setProfile={setProfile} taken={taken} onDone={() => setEditing(false)} progress={progress} setProgress={setProgress} />;
  }

  const playing = screen?.s === 'play' && status === 'ok';
  const gameName = screen && 'game' in screen ? catalog.find((g) => g.id === screen.game)?.name?.[lang] : '';

  return (
    // Manettes stick et tapotage : toujours en paysage, même si le téléphone reste droit (on tourne l'écran).
    <div className={`pad ${playing ? 'pad-play' : ''} ${playing && screen.s === 'play' && (screen.layout === 'stick' || screen.layout === 'tap') && !['traitre', 'dessin'].includes(screen.game) ? 'turn' : ''}`} style={{ ['--c' as string]: profile.color }} onPointerDown={unlockAudio}>
      {status === 'lost' && !lostLong && screen && <div className="net-blip">⚡ {lang === 'fr' ? 'Reconnexion…' : 'Reconnecting…'}</div>}
      <header className={`pad-head ${playing ? 'slim' : ''}`}>
        <CharCanvas profile={profile} size={playing ? 34 : 46} still />
        <b className="pad-name">{profile.name || '???'}</b>
        <span className="pad-info">{playing ? gameName : `${code} · ${status === 'ok' ? t(lang, 'ping', { ms: rtt }) : '…'}`}</span>
        {playing && screen?.s === 'play' && screen.host && (
          <button className="pill pause-btn" onClick={() => host('pause')} aria-label={t(lang, 'pause')}>
            ⏸
          </button>
        )}
        {/* Réactions : toujours au même endroit, en haut à droite (avant, la bulle flottante cachait l'écran) */}
        {status === 'ok' && screen && ['wait', 'results', 'podium', 'paused', 'recap'].includes(screen.s) && <ReactButton lang={lang} family={family} send={send} inline />}
        {!playing && (
          <button className="pill" onClick={() => setEditing(true)} aria-label={t(lang, 'editChar')}>
            ✏️
          </button>
        )}
      </header>

      {kicked ? (
        <div className="pad-status">
          <p>{lang === 'fr' ? 'L’hôte t’a retiré de la partie.' : 'The host removed you from the game.'}</p>
          <a className="btn" href="#/">
            {t(lang, 'back')}
          </a>
        </div>
      ) : status !== 'ok' && !(status === 'lost' && screen && lostLong === false) ? (
        <div className="pad-status">
          {status === 'notfound' ? (
            <>
              <p>{t(lang, 'notFound', { code })}</p>
              <a className="btn" href="#/">
                {t(lang, 'back')}
              </a>
            </>
          ) : (
            <>
              <p className="pulse">{status === 'lost' ? t(lang, 'lost') : t(lang, 'connectingTv')}</p>
              {status === 'lost' && netRef.current?.why && <p className="pad-small net-why">{netRef.current.why}</p>}
            </>
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
          profile={profile}
          live={live}
          cools={cools}
          progress={progress}
          reward={reward}
          account={account}
          send={send}
          host={host}
          family={family}
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
  profile,
  live,
  cools,
  progress,
  reward,
  account,
  family,
}: {
  family: boolean;
  cools: Cools;
  account: Account;
  progress: Progress;
  reward: { xp: number; coins: number; level: number | null } | null;
  profile: Profile;
  live: { rank: number; of: number; left: number | null } | null;
  screen: PadScreen;
  lang: Lang;
  code: string;
  myColor: string;
  send: (m: ToTv) => void;
  host: (a: HostAction, g?: string, o?: Record<string, number>) => void;
  edit: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [touring, setTouring] = useState(false);
  const [noTour, setNoTour] = useState<string[]>(() => store<string[]>('noTour', []));
  const [optFor, setOptFor] = useState<string | null>(null);
  /** Menu de réglage ouvert (bots, niveau des bots, voix). */
  const [menu, setMenu] = useState<null | 'bots' | 'botlevel' | 'voice'>(null);
  const [opts, setOpts] = useState<Record<string, number>>({});
  switch (screen.s) {
    case 'lobby':
      if (optFor && screen.host) {
        const def = screen.games.find((g) => g.id === optFor)!;
        return (
          <div className="pad-body top">
            <img className="opt-game-icon" src={gameIcon(def.slug)} alt="" />
            <p className="pad-title">{def.name?.[lang] ?? def.id}</p>
            {def.options!.map((op) => (
              <div key={op.id} className="team-box">
                <p className="opt-title">{op.label[lang]}</p>
                <div className="team-pick">
                  {op.choices.map((c) => {
                    const on = (opts[op.id] ?? op.choices[0].v) === c.v;
                    return (
                      <button key={c.v} className={on ? 'on' : ''} style={{ ['--tc' as string]: def.color }} onClick={() => setOpts((o) => ({ ...o, [op.id]: c.v }))}>
                        <span>{c.label[lang]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              className="btn big mint"
              onClick={() => {
                host('pick', optFor, opts);
                setOptFor(null);
                setPicking(false);
              }}
            >
              ▶ {t(lang, 'launch')}
            </button>
            <button className="btn ghost" onClick={() => setOptFor(null)}>
              {t(lang, 'back')}
            </button>
          </div>
        );
      }
      if (touring && screen.host) {
        const left = screen.games.filter((g) => !g.soon && !noTour.includes(g.id)).length;
        return (
          <div className="pad-body top">
            <p className="pad-title">{lang === 'fr' ? 'Jeux du tournoi' : 'Tournament games'}</p>
            <p className="pad-small">{lang === 'fr' ? 'Touche un jeu pour l’enlever (ou le remettre)' : 'Tap a game to remove it (or bring it back)'}</p>
            <div className="game-list">
              {screen.games.filter((g) => !g.soon).map((g) => {
                const def = g;
                const off = noTour.includes(g.id);
                return (
                  <button
                    key={g.id}
                    className={`game-card ${off ? 'off' : ''}`}
                    style={{ ['--g' as string]: def.color }}
                    aria-pressed={!off}
                    onClick={() => {
                      sfx.click();
                      const n = off ? noTour.filter((x) => x !== g.id) : [...noTour, g.id];
                      setNoTour(n);
                      save('noTour', n);
                    }}
                  >
                    <img src={gameIcon(def.slug)} alt="" />
                    <b>{def.name?.[lang] ?? def.id}</b>
                    {off && <small>✕ {lang === 'fr' ? 'enlevé' : 'removed'}</small>}
                  </button>
                );
              })}
            </div>
            <button
              className="btn big mint"
              disabled={left < 1}
              onClick={() => {
                setTouring(false);
                host('tournament', undefined, Object.fromEntries(noTour.map((id) => [id, 1])));
              }}
            >
              ▶ {t(lang, 'launch')} ({left} {lang === 'fr' ? 'jeux' : 'games'})
            </button>
            <button className="btn ghost" onClick={() => setTouring(false)}>
              {t(lang, 'back')}
            </button>
          </div>
        );
      }
      if (picking && screen.host)
        return (
          <div className="pad-body top">
            <p className="pad-title">{t(lang, 'pickGame')}</p>
            <div className="game-list">
              {screen.games.map((g) => {
                const def = g;
                return (
                  <button
                    key={g.id}
                    className="game-card"
                    style={{ ['--g' as string]: def.color }}
                    disabled={g.soon}
                    onClick={() => {
                      if (def.options?.length) {
                        setOpts({});
                        setOptFor(g.id);
                        return;
                      }
                      setPicking(false);
                      host('pick', g.id);
                    }}
                  >
                    <img src={gameIcon(def.slug)} alt="" />
                    <b>{def.name?.[lang] ?? def.id}</b>
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
          <ProgressCard progress={progress} lang={lang} onShop={edit} account={account} />
          {screen.teams && (
            <div className="team-box">
              <p className="opt-title">{t(lang, 'yourTeam')}</p>
              <div className="team-pick">
                {TEAMS.map((tm, k) => (
                  <button
                    key={k}
                    className={screen.team === k ? 'on' : ''}
                    style={{ ['--tc' as string]: tm.color }}
                    onClick={() => send({ t: 'team', n: k })}
                    aria-pressed={screen.team === k}
                  >
                    <span className="tp-emoji">{tm.emoji}</span>
                    <span>{tm.name[lang]}</span>
                    {screen.team === k && <span className="tp-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {screen.host ? (
            <>
              <p className="pad-title">{t(lang, 'hostAsk')}</p>
              <button className="big-card rose" onClick={() => setTouring(true)}>
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
                  <small>{t(lang, 'catalogue', { n: screen.games.filter((g) => !g.soon).length })}</small>
                </span>
              </button>
              {screen.recap && (
                <button className="btn ghost" onClick={() => host('recap')}>
                  📊 {lang === 'fr' ? 'Bilan de la soirée' : 'Tonight’s awards'}
                </button>
              )}
              {screen.players.length > 0 && (
                <>
                  <p className="opt-title">{lang === 'fr' ? 'Joueurs' : 'Players'}</p>
                  <div className="kick-list">
                    {screen.players.map((pl) => (
                      <div key={pl.pid} className="kick-row">
                        <i style={{ background: pl.color }} />
                        <b>{pl.name}</b>
                        <button
                          className="kick-btn chief-btn"
                          onClick={() => {
                            if (confirm(lang === 'fr' ? `Donner la place de chef à ${pl.name} ?` : `Make ${pl.name} the host?`)) host('chief', pl.pid);
                          }}
                        >
                          👑 {lang === 'fr' ? 'Chef' : 'Host'}
                        </button>
                        <button
                          className="kick-btn"
                          onClick={() => {
                            if (confirm(lang === 'fr' ? `Retirer ${pl.name} de la partie ?` : `Remove ${pl.name} from the game?`)) host('kick', pl.pid);
                          }}
                        >
                          {lang === 'fr' ? 'Retirer' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <p className="opt-title">{t(lang, 'options')}</p>
              <div className="opt-row">
                <button className={`opt mint ${screen.family ? 'on' : ''}`} onClick={() => host('family')} aria-pressed={screen.family}>
                  <span className="opt-ico">👨‍👩‍👧</span>
                  <b>{t(lang, 'family')}</b>
                  <small>{t(lang, screen.family ? 'familyShortOn' : 'familyShortOff')}</small>
                  <span className="opt-state">{t(lang, screen.family ? 'yes' : 'no')}</span>
                </button>
                <button className={`opt rose ${screen.teams ? 'on' : ''}`} onClick={() => host('teams')} aria-pressed={screen.teams}>
                  <span className="opt-ico">{screen.teams ? '🍓🌿' : '🤼'}</span>
                  <b>{t(lang, screen.teams ? 'teams' : 'melee')}</b>
                  <small>{t(lang, screen.teams ? 'teamsShortOn' : 'teamsShortOff')}</small>
                  <span className="opt-state">{t(lang, 'tapToChange')}</span>
                </button>
              </div>
              <div className="opt-row">
                <button className="opt violet on" onClick={() => setMenu('bots')}>
                  <span className="opt-ico">🤖</span>
                  <b>{lang === 'fr' ? 'Bots' : 'Bots'}</b>
                  <small>{screen.bots < 0 ? (lang === 'fr' ? 'Auto (selon le jeu)' : 'Auto (per game)') : screen.bots === 0 ? (lang === 'fr' ? 'Aucun bot' : 'No bots') : `+ ${screen.bots}`}</small>
                  <span className="opt-state">{lang === 'fr' ? 'Choisir ▸' : 'Choose ▸'}</span>
                </button>
                <button className="opt sun on" onClick={() => setMenu('botlevel')}>
                  <span className="opt-ico">{['🐣', '😎', '🔥'][screen.botLevel] ?? '😎'}</span>
                  <b>{lang === 'fr' ? 'Niveau des bots' : 'Bot level'}</b>
                  <small>{(lang === 'fr' ? ['Facile', 'Normal', 'Fort'] : ['Easy', 'Normal', 'Hard'])[screen.botLevel] ?? ''}</small>
                  <span className="opt-state">{lang === 'fr' ? 'Choisir ▸' : 'Choose ▸'}</span>
                </button>
              </div>
              <div className="opt-row">
                <button className="opt mint on" onClick={() => setMenu('voice')}>
                  <span className="opt-ico">🎙️</span>
                  <b>{lang === 'fr' ? 'Voix du présentateur' : 'Announcer voice'}</b>
                  <small>{VOICES[screen.voice ?? 0]?.[lang] ?? ''}</small>
                  <span className="opt-state">{lang === 'fr' ? 'Choisir ▸' : 'Choose ▸'}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="pad-title pulse">{t(lang, 'waitHost', { name: screen.hostName })}</p>
              {screen.family && <p className="pad-small">👨‍👩‍👧 {t(lang, 'family')}</p>}
            </>
          )}
          {menu && screen.s === 'lobby' && (
            <div className="buy-veil" onClick={() => setMenu(null)}>
              <div className="buy-card menu-card" onClick={(e) => e.stopPropagation()}>
                <b>
                  {menu === 'bots'
                    ? lang === 'fr' ? '🤖 Combien de bots ?' : '🤖 How many bots?'
                    : menu === 'botlevel'
                      ? lang === 'fr' ? 'Niveau des bots' : 'Bot level'
                      : lang === 'fr' ? '🎙️ Voix du présentateur' : '🎙️ Announcer voice'}
                </b>
                <div className="menu-list">
                  {(menu === 'bots'
                    ? [-1, 0, 1, 2, 3, 4, 5, 6, 7].map((v) => ({ v, label: v < 0 ? (lang === 'fr' ? 'Auto (selon le jeu)' : 'Auto (per game)') : v === 0 ? (lang === 'fr' ? 'Aucun bot' : 'No bots') : `+ ${v} bot${v > 1 ? 's' : ''}`, on: screen.bots === v }))
                    : menu === 'botlevel'
                      ? [0, 1, 2].map((v) => ({ v, label: `${['🐣', '😎', '🔥'][v]} ${(lang === 'fr' ? ['Facile', 'Normal', 'Fort'] : ['Easy', 'Normal', 'Hard'])[v]}`, on: screen.botLevel === v }))
                      : VOICES.map((x, v) => ({ v, label: x[lang], on: screen.voice === v }))
                  ).map((o) => (
                    <button
                      key={o.v}
                      className={`chip txt ${o.on ? 'on' : ''}`}
                      onClick={() => {
                        host(menu, undefined, { v: o.v });
                        // La voix : on reste dans le menu pour en écouter d'autres
                        if (menu !== 'voice') setMenu(null);
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {menu === 'voice' && <p className="pad-small">{lang === 'fr' ? 'La télé fait écouter chaque voix.' : 'The TV plays each voice.'}</p>}
                <button className="btn" onClick={() => setMenu(null)}>
                  OK
                </button>
              </div>
            </div>
          )}
          <button className="btn ghost" onClick={edit}>
            ✏️ {t(lang, 'editChar')}
          </button>
        </div>
      );
    case 'play':
      if (screen.tuto)
        return (
          <div className="pad-body">
            <p className="pad-title">📺 {t(lang, 'readTuto')}</p>
            <SecretCard secret={screen.secret} lang={lang} />
            <button className="round-btn rose reflex-btn" onClick={() => send({ t: 'act', a: 'tuto' })}>
              ✋ {t(lang, 'imReady')}
            </button>
          </div>
        );
      if (screen.game === 'reflexes' && screen.data) return <ReflexPad data={screen.data as ReflexPadData} lang={lang} send={send} />;
      if (screen.game === 'roulette' && screen.data) return <RoulettePad data={screen.data as RoulettePadData} lang={lang} send={send} />;
      if (screen.game === 'undercover' && screen.data) return <UndercoverPad data={screen.data as UndercoverPadData} lang={lang} send={send} />;
      if (screen.game === 'traitre' && screen.data) return <TraitorPad data={screen.data as TraitorPadData} lang={lang} send={send} />;
      if (screen.game === 'president' && screen.data) return <PresidentPad data={screen.data as PresidentPadData} lang={lang} send={send} />;
      if (screen.game === 'dessin' && screen.data) return <ScribblePad data={screen.data as ScribblePadData} lang={lang} send={send} />;
      if (screen.layout === 'bluff' && screen.data) return <BluffPad data={screen.data as BluffPadData} lang={lang} send={send} />;
      return screen.layout === 'tap' ? <TapPad lang={lang} send={send} /> : <Stick send={send} lang={lang} game={screen.game} profile={profile} live={live} cools={cools} family={family} />;
    case 'paused':
      return (
        <div className="pad-body">
          <p className="pad-title">⏸ {t(lang, 'pause')}</p>
          {screen.host ? (
            <>
              <button className="btn big mint" onClick={() => host('resume')}>
                ▶ {t(lang, 'resume')}
              </button>
              <button className="btn big alt" onClick={() => host('replay')}>
                {t(lang, 'restart')}
              </button>
              <button className="btn big ghost" onClick={() => host('lobby')}>
                🏠 {t(lang, 'toLobby')}
              </button>
            </>
          ) : (
            <p className="pad-small">{t(lang, 'pauseWait')}</p>
          )}
        </div>
      );
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
          {reward && <RewardCard reward={reward} progress={progress} lang={lang} />}
          <SecretCard secret={screen.secret} lang={lang} />
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
          {reward && <RewardCard reward={reward} progress={progress} lang={lang} />}
          <SecretCard secret={screen.secret} lang={lang} />
          {screen.host && (
            <>
              <button className="btn big mint" onClick={() => host('recap')}>
                📊 {lang === 'fr' ? 'Bilan de la soirée' : 'Tonight’s awards'}
              </button>
              <button className="btn ghost" onClick={() => host('lobby')}>
                {t(lang, 'toLobby')}
              </button>
            </>
          )}
        </div>
      );
    case 'recap':
      return (
        <div className="pad-body">
          <p className="pad-title">📊 {lang === 'fr' ? 'Regarde la télé : le bilan de la soirée !' : 'Look at the TV: tonight’s awards!'}</p>
          {screen.host && (
            <button className="btn big mint" onClick={() => host('lobby')}>
              {t(lang, 'toLobby')}
            </button>
          )}
        </div>
      );
  }
}

/** Niveau, barre d'expérience et bonbons, avec l'accès à la boutique. */
interface Account {
  user: CloudUser | null;
  cloud: 'off' | 'busy' | 'ok' | 'error';
  connect: () => void;
  disconnect: () => void;
}

function ProgressCard({ progress, lang, onShop, account }: { progress: Progress; lang: Lang; onShop: () => void; account: Account }) {
  const { level, into, need } = levelInfo(progress.xp);
  const { user, cloud } = account;
  useEffect(() => {
    if (!user) preload();
  }, [user]);
  return (
    <div className="prog-wrap">
    <div className="prog-card">
      <span className="prog-level">
        <small>{lang === 'fr' ? 'Niv.' : 'Lv.'}</small>
        <b>{level}</b>
      </span>
      <div className="prog-mid">
        <div className="prog-bar">
          <i style={{ width: `${(into / need) * 100}%` }} />
        </div>
        <small>
          {into} / {need} XP · 🍬 {progress.coins}
        </small>
      </div>
      <button className="prog-shop" onClick={onShop}>
        🛍️ <span>{t(lang, 'shop')}</span>
      </button>
    </div>
      {user ? (
        <div className="cloud-row">
          {user.photo ? <img src={user.photo} alt="" referrerPolicy="no-referrer" /> : <span className="cloud-ini">{user.name.slice(0, 1)}</span>}
          <span>
            {cloud === 'error' ? t(lang, 'cloudError') : cloud === 'busy' ? t(lang, 'cloudBusy') : t(lang, 'cloudSaved', { name: user.name.split(' ')[0] })}
          </span>
          <button onClick={account.disconnect}>{t(lang, 'signOut')}</button>
        </div>
      ) : (
        <button className="google-btn" onClick={account.connect} disabled={cloud === 'busy'}>
          <GoogleLogo />
          <span>{cloud === 'busy' ? t(lang, 'cloudBusy') : cloud === 'error' ? t(lang, 'cloudError') : t(lang, 'signIn')}</span>
        </button>
      )}
    </div>
  );
}

/** Ce que la partie vient de rapporter (et le niveau gagné). */
function RewardCard({ reward, progress, lang }: { reward: { xp: number; coins: number; level: number | null }; progress: Progress; lang: Lang }) {
  const { level, into, need } = levelInfo(progress.xp);
  return (
    <div className={`reward-card ${reward.level ? 'up' : ''}`}>
      {reward.level && <p className="reward-up">🎉 {t(lang, 'levelUp', { n: reward.level })} +{LEVEL_GIFT} 🍬</p>}
      <div className="reward-row">
        {reward.xp > 0 && <span className="reward-pill xp">+{reward.xp} XP</span>}
        <span className="reward-pill coin">+{reward.coins} 🍬</span>
      </div>
      <div className="prog-bar">
        <i style={{ width: `${(into / need) * 100}%` }} />
      </div>
      <small>
        {lang === 'fr' ? 'Niveau' : 'Level'} {level} · 🍬 {progress.coins}
      </small>
    </div>
  );
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

type Tab = 'perso' | 'color' | 'eyes' | 'pose' | 'hat' | 'deco' | 'more';

function Editor({
  profile,
  setProfile,
  taken,
  onDone,
  progress,
  setProgress,
}: {
  profile: Profile;
  setProfile: (f: (p: Profile) => Profile) => void;
  taken: string[];
  onDone: () => void;
  progress: Progress;
  setProgress: (f: (p: Progress) => Progress) => void;
}) {
  const lang = profile.lang;
  const level = levelInfo(progress.xp).level;
  const [buying, setBuying] = useState<{ kind: Kind; id: string; name: string } | null>(null);
  const owned = (kind: Kind, id: string) => isOwned(progress, kind, id);
  /** Touche un objet : on le met s'il est à nous, sinon on propose de l'acheter. */
  const choose = (kind: Kind, id: string, name: string) => {
    if (owned(kind, id)) set(kind === 'food' ? { food: id } : kind === 'hat' ? { hat: id } : { acc: id });
    else {
      sfx.click();
      setBuying({ kind, id, name });
    }
  };
  const buy = () => {
    if (!buying) return;
    const it = PRICES[itemKey(buying.kind, buying.id)];
    if (!it || progress.coins < it.price || level < (it.level ?? 1)) return;
    setProgress((p) => ({ ...p, coins: p.coins - it.price, owned: [...p.owned, itemKey(buying.kind, buying.id)] }));
    set(buying.kind === 'food' ? { food: buying.id } : buying.kind === 'hat' ? { hat: buying.id } : { acc: buying.id });
    sfx.win();
    setBuying(null);
  };
  const lock = (kind: Kind, id: string) => {
    if (owned(kind, id)) return null;
    const it = PRICES[itemKey(kind, id)];
    return (
      <span className={`lock ${level < (it.level ?? 1) ? 'lvl' : progress.coins >= it.price ? 'ok' : ''}`}>
        {level < (it.level ?? 1) ? `🔒 ${lang === 'fr' ? 'Niv.' : 'Lv.'} ${it.level}` : `🍬 ${it.price}`}
      </span>
    );
  };
  const fileRef = useRef<HTMLInputElement>(null);
  // null = le menu des catégories ; sinon la catégorie ouverte (avec un bouton retour)
  const [tab, setTab] = useState<Tab | null>(null);
  const set = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

  const onSelfie = (file?: File) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 192;
      const s = Math.min(img.width, img.height);
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192);
      set({ selfie: c.toDataURL('image/jpeg', 0.8) });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };
  const randomize = () =>
    set({
      food: pick(FOODS.filter((f) => owned('food', f.id))).id,
      color: pick(COLORS.filter((c) => !taken.includes(c))) ?? profile.color,
      hat: pick(HATS.filter((h) => owned('hat', h.id))).id,
      acc: pick(ACCS.filter((a) => owned('acc', a.id))).id,
    });

  const fr = lang === 'fr';
  const nameOf = (list: { id: string; name: Record<Lang, string> }[], id: string | undefined, none: string) =>
    list.find((x) => x.id === (id ?? ''))?.name[lang] ?? none;
  const tabs: [Tab, string, string, string][] = [
    ['perso', '🍕', fr ? 'Perso' : 'Character', nameOf(FOODS, profile.food, '')],
    ['color', '🎨', fr ? 'Couleur' : 'Color', ''],
    ['eyes', '👀', fr ? 'Regard' : 'Eyes', nameOf(EYE_LIST, profile.eyes, '')],
    ['pose', '🕺', fr ? 'Pose' : 'Pose', nameOf(POSE_LIST, profile.pose, '')],
    ['hat', '🎩', fr ? 'Chapeau' : 'Hat', nameOf(HATS, profile.hat, '')],
    ['deco', '🕶️', fr ? 'Déco' : 'Extras', nameOf(ACCS, profile.acc, '')],
    ['more', '⚙️', fr ? 'Langue' : 'Language', lang === 'fr' ? 'Français' : 'English'],
  ];
  const open = (k: Tab) => {
    sfx.click();
    setTab(k);
    document.querySelector('.editor')?.scrollTo({ top: 0 });
  };
  const cur = tab && tabs.find((x) => x[0] === tab);

  return (
    <div className={`pad editor ${tab ? 'ed-in' : ''}`} style={{ ['--c' as string]: profile.color }}>
      {cur ? (
        <div className="ed-head">
          <button className="ed-back" onClick={() => setTab(null)}>
            ← {t(lang, 'back')}
          </button>
          <h2 className="editor-title">
            {cur[1]} {cur[2]}
          </h2>
        </div>
      ) : (
        <div className="ed-top">
          <h2 className="editor-title">{t(lang, 'myChar')}</h2>
          <span className="ed-badges">
            <span className="ed-level">{fr ? 'Niv.' : 'Lv.'} {level}</span>
            <span className="shop-coins">🍬 {progress.coins}</span>
          </span>
        </div>
      )}
      <div className="ed-stage">
        <div className="editor-preview">
          <CharCanvas profile={profile} size={tab ? 96 : 150} />
        </div>
        {!tab && (
          <div className="ed-quick">
            <button className="ed-round" onClick={randomize} aria-label={t(lang, 'random')}>
              🎲
            </button>
            <button className="ed-round" onClick={() => (profile.selfie ? set({ selfie: undefined }) : fileRef.current?.click())} aria-label={t(lang, 'selfie')}>
              {profile.selfie ? '🗑️' : '📷'}
            </button>
          </div>
        )}
      </div>
      {!tab && (
        <input
          className="name-input"
          value={profile.name}
          maxLength={14}
          autoComplete="off"
          onChange={(e) => set({ name: e.target.value })}
          placeholder={t(lang, 'yourName')}
        />
      )}
      {!tab && (
        <div className="ed-menu">
          {tabs.map(([k, icon, label, value]) => (
            <button key={k} className="ed-cat" onClick={() => open(k)}>
              <span className="ed-cat-ico">{k === 'color' ? <i style={{ background: profile.color }} /> : icon}</span>
              <span className="ed-cat-txt">
                <b>{label}</b>
                {value && <small>{value}</small>}
              </span>
              <span className="ed-cat-go">›</span>
            </button>
          ))}
        </div>
      )}
      {tab === 'eyes' && (
        <div className="pick-grid">
          {EYE_LIST.map((e) => (
            <button key={e.id} className={`pick ${(profile.eyes ?? '') === e.id ? 'on' : ''}`} onClick={() => set({ eyes: e.id || undefined })}>
              <CharCanvas profile={{ ...profile, selfie: undefined, eyes: e.id || undefined }} size={64} still />
              <small>{e.name[lang]}</small>
            </button>
          ))}
        </div>
      )}
      {tab === 'pose' && (
        <div className="pick-grid">
          {POSE_LIST.map((e) => (
            <button key={e.id} className={`pick ${(profile.pose ?? '') === e.id ? 'on' : ''}`} onClick={() => set({ pose: e.id || undefined })}>
              <CharCanvas profile={{ ...profile, selfie: undefined, pose: e.id || undefined }} size={64} still />
              <small>{e.name[lang]}</small>
            </button>
          ))}
        </div>
      )}

      {tab === 'perso' && (
        <div className="pick-grid">
          {FOODS.map((f) => (
            <button key={f.id} className={`pick ${profile.food === f.id ? 'on' : ''} ${owned('food', f.id) ? '' : 'locked'}`} onClick={() => choose('food', f.id, f.name[lang])}>
              <CharCanvas profile={{ ...profile, food: f.id, selfie: undefined, hat: 'aucun', acc: 'aucun' }} size={64} still />
              <small>{f.name[lang]}</small>
              {lock('food', f.id)}
            </button>
          ))}
        </div>
      )}
      {tab === 'hat' && (
        <div className="pick-grid">
          {HATS.map((h) => (
            <button key={h.id} className={`pick ${profile.hat === h.id ? 'on' : ''} ${owned('hat', h.id) ? '' : 'locked'}`} onClick={() => choose('hat', h.id, h.name[lang])}>
              <CharCanvas profile={{ ...profile, selfie: undefined, acc: 'aucun', hat: h.id }} size={64} still />
              <small>{h.name[lang]}</small>
              {lock('hat', h.id)}
            </button>
          ))}
        </div>
      )}
      {tab === 'deco' && (
        <>
          <div className="pick-grid">
            {ACCS.map((a) => (
              <button key={a.id} className={`pick ${profile.acc === a.id ? 'on' : ''} ${owned('acc', a.id) ? '' : 'locked'}`} onClick={() => choose('acc', a.id, a.name[lang])}>
                <CharCanvas profile={{ ...profile, selfie: undefined, hat: 'aucun', acc: a.id }} size={64} still />
                <small>{a.name[lang]}</small>
                {lock('acc', a.id)}
              </button>
            ))}
          </div>
        </>
      )}
      {tab === 'more' && (
        <div className="lang-row">
          {(['fr', 'en'] as Lang[]).map((l) => (
            <button key={l} className={`tab ${lang === l ? 'on' : ''}`} onClick={() => set({ lang: l })}>
              {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
            </button>
          ))}
        </div>
      )}
      {tab === 'color' && (
      <div className="color-row big">
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
      )}
      {tab === 'color' && <p className="pad-small center">{t(lang, 'colorHint')}</p>}
      <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => onSelfie(e.target.files?.[0])} />
      <div className="ed-bottom">
        {tab ? (
          <button className="btn big mint" onClick={() => setTab(null)}>
            ✓ {fr ? 'Valider' : 'Done'}
          </button>
        ) : (
          <button className="btn big mint" disabled={!profile.name.trim()} onClick={onDone}>
            {t(lang, 'itsMe')}
          </button>
        )}
      </div>
      {buying && (
        <div className="buy-veil" onClick={() => setBuying(null)}>
          <div className="buy-card" onClick={(e) => e.stopPropagation()}>
            <CharCanvas
              profile={{
                ...profile,
                selfie: undefined,
                ...(buying.kind === 'food' ? { food: buying.id } : buying.kind === 'hat' ? { hat: buying.id } : { acc: buying.id }),
              }}
              size={120}
              mood="wow"
            />
            <b>{buying.name}</b>
            {(() => {
              const it = PRICES[itemKey(buying.kind, buying.id)];
              if (level < (it.level ?? 1)) return <p className="pad-small">{t(lang, 'needLevel', { n: it.level ?? 1 })}</p>;
              if (progress.coins < it.price) return <p className="pad-small">{t(lang, 'needCoins', { n: it.price - progress.coins })}</p>;
              return (
                <button className="btn big sun" onClick={buy}>
                  {t(lang, 'buyFor', { n: it.price })}
                </button>
              );
            })()}
            <button className="btn ghost" onClick={() => setBuying(null)}>
              {t(lang, 'back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
