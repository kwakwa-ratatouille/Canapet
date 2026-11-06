import { TEAMS } from '../games/teams';
import { PresidentPad } from './PresidentPad';
import type { PresidentPadData } from '../games/presidentShared';
import { VOICES } from '../shared/sound';
import { VARIANT_OF } from '../shared/art/canapet-art.js';
import { loadCloud, merge, preload, saveCloud, signIn, signOut, watchUser, type CloudUser, loadItems, loadKeys, openChestCloud } from '../shared/cloud';
import { GoogleLogo } from '../shared/GoogleLogo';
import './editor.css';
import { TiebreakPad, VotePad, WheelPad } from './PartyPad';
import { isOwned, itemKey, levelInfo, LEVEL_GIFT, loadProgress, podiumBonus, PRICES, rewardFor, saveProgress, type Kind, type Progress } from '../shared/progress';
import { useEffect, useMemo, useRef, useState, Fragment, useLayoutEffect } from 'react';
import { CharCanvas } from '../shared/CharCanvas';
import { ACCS, COLORS, EYE_LIST, FOODS, HATS, POSE_LIST } from '../shared/characters';
import { IS_IOS, newId, save, store } from '../shared/device';
import { defaultLang, ordinal, t } from '../shared/i18n';
import { gameIcon } from '../shared/Logo';
import type { GameInfo, HostAction, Lang, PadScreen, Profile, ToTv } from '../shared/protocol';
import { sfx, unlockAudio } from '../shared/sound';
import { PadNet, type PadStatus } from './net';
import { Stick, type Cools } from './Stick';
import { ReactButton, SecretCard } from './ReactPad';
import { BluffPad } from './BluffPad';
import { ScribblePad } from './ScribblePad';
import { TraitorPad } from './TraitorPad';
import { UndercoverPad } from './UndercoverPad';
import { QuizPad } from './QuizPad';
import { ProductCard } from './PassCard';
import { ControlsCard } from './ControlsCard';
import { LegalLinks } from '../pages/Legal';
import type { QuizPadData } from '../games/quizShared';
import { afterGame, claimableCount } from '../shared/quests';
import { BoxShop, FIELD, itemName, ItemThumb } from './BoxPad';
import { FriendsCard, InviteBanner, usePresence } from './Friends';
import { ItemPreview, playItem } from './ItemPreview';
import { Missions } from './Missions';
import { VoicePad } from './VoicePad';
import { ShoutPad } from './ShoutPad';
import type { ShoutPadData } from '../games/shout';
import { VOICE_GAMES, type VoicePadData } from '../games/voiceShared';
import { boxesNow, COLOR_ITEMS, KO_FX, LEVEL_UNLOCKS, levelOf, RARITIES, RARITY_ORDER, seasonOf, SKINS, WIN_FX, WIN_POSES, WIN_SOUNDS, rarityOf, type Rarity } from '../shared/lootTable';
import { currentSeason, ENTRIES, FRAMES, PAD_THEMES, PLATES, REACT_ITEMS, seasonStart, TITLES, TRAILS } from '../shared/cosmetics2';
import { PlayerFrame, PlateName, PlayerTitle } from '../shared/PlayerDeco';
import { KEY_PACKS, KEYS_ALLOWED } from '../shared/offer';
import { isLocked, gameOfDay, PACKS, PASS, PASS_GIFT, SALES_ON } from '../shared/offer';
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
  lobby: { s: 'lobby', host: true, hostName: 'Moi', taken: [COLORS[1], COLORS[4], COLORS[6]], games: [], count: 4, roster: [{ pid: 'a', name: 'Moi', color: COLORS[0], level: 15, chief: true, me: true }, { pid: 'b', name: 'Lulu', color: COLORS[1], level: 3, chief: false, me: false }, { pid: 'c', name: 'Zaza', color: COLORS[4], chief: false, me: false }, { pid: 'd', name: 'Momo', color: COLORS[6], level: 8, chief: false, me: false }], family: false, teams: true, team: 0, bots: -1, botLevel: 1, voice: 0, players: [{ pid: 'a', name: 'Lulu', color: COLORS[1] }] },
  tap: { s: 'play', layout: 'tap', game: 'pouces' },
  stick: { s: 'play', layout: 'stick', game: 'kart' },
  president: { s: 'play', layout: 'buttons', game: 'president', data: { hand: [0, 5, 9, 10, 11, 22, 23, 30, 37, 44, 46, 49, 51], phase: 'play', myTurn: true, need: 2, min: 2, give: 0, giveTo: '', role: '🎩 Vice-président', turnName: 'Moi', pile: [8, 10], pileBy: 'Lulu', note: '', done: 0 } },
  results: { s: 'results', gid: 1, host: true, rank: 2, points: 7, total: 17, step: { index: 2, count: 5 } },
  paused: { s: 'paused', host: true, game: 'sumo' },
  podium: { s: 'podium', gid: 1, host: true, rank: 1, total: 42 },
  vote: { s: 'vote', host: true, q: 'Qui finirait en prison en premier ?', options: [{ id: '1', label: 'Momo', color: '#ff4f9a' }, { id: '2', label: 'Lulu', color: '#ffd60a' }, { id: '3', label: 'Zaza', color: '#2ec5ff' }, { id: '4', label: 'Bot 1', color: '#7bd13b' }], reveal: false, n: 1, of: 3 },
  ab: { s: 'vote', host: true, q: 'Tu préfères…', options: [{ id: 'a', label: 'Ne plus jamais manger de pizza', color: '#ff4f9a' }, { id: 'b', label: 'Ne plus jamais dormir dans un lit', color: '#2ec5ff' }], my: 'a', reveal: false, n: 2, of: 3 },
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
  const [reward, setReward] = useState<Reward | null>(null);
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
        setProfile((p) => (p.items?.length ? { ...p, items: [] } : p));
        setCloud('off');
        return;
      }
      setCloud('busy');
      loadItems(u.uid)
        .then((items) => applyItems(u.uid, items))
        .catch(() => {});
      loadCloud(u.uid)
        .then((remote) => {
          setProgress((p) => merge(p, remote));
          synced.current = true;
          setCloud('ok');
        })
        .catch(() => setCloud('error'));
    });
  }, [useCloud, demo]);
  // Retour sur la manette : un achat a pu être fait sur le site entre-temps
  useEffect(() => {
    if (!user) return;
    let last = 0;
    const again = () => {
      // Au retour sur l'appli, mais pas plus d'une fois par minute
      if (document.visibilityState !== 'visible' || Date.now() - last < 60000) return;
      last = Date.now();
      loadItems(user.uid).then((items) => applyItems(user.uid, items)).catch(() => {});
    };
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [user]);
  // Sauvegarde sur le compte (regroupée) à chaque changement.
  useEffect(() => {
    if (!user || !synced.current) return;
    const run = () => {
      saveCloud(user.uid, progress)
        .then(() => setCloud('ok'))
        .catch(() => setCloud('error'));
    };
    const id = setTimeout(run, 3000);
    const hide = () => {
      if (document.visibilityState === 'hidden') run();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', hide);
    };
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
  // Bonbons du Pass, une seule fois par compte sur ce téléphone (achat dans l'appli ou sur le site)
  const passGift = (uid: string) => {
    if (store(`passGift:${uid}`, false)) return;
    save(`passGift:${uid}`, true);
    setProgress((p) => ({ ...p, coins: p.coins + PASS_GIFT }));
  };
  const applyItems = (uid: string, items: string[]) => {
    setProfile((p) => ({ ...p, items }));
    if (items.includes(PASS) && SALES_ON) passGift(uid);
    const won = items.filter((x) => x.startsWith('cos:')).map((x) => x.slice(4).replace('~', '#'));
    if (won.length) setProgress((p) => ({ ...p, owned: [...new Set([...p.owned, ...won])] }));
  };
  // Achat obtenu dans l'appli
  const gotItem = (id: string, bought: boolean) => {
    setProfile((p) => ({ ...p, items: [...new Set([...(p.items ?? []), id])] }));
    if (bought && id === PASS) passGift(user?.uid ?? '');
  };
  const [keys, setKeys] = useState(0);
  const refreshKeys = () => {
    if (user && SALES_ON && KEYS_ALLOWED) loadKeys(user.uid).then(setKeys).catch(() => {});
  };
  useEffect(refreshKeys, [user?.uid]);
  const openChest = () =>
    openChestCloud(progress.owned).then((r) => {
      refreshKeys();
      return r;
    });
  const account = { user, cloud, connect, disconnect, gotItem, keys, refreshKeys, openChest, setProgress, setProfile };
  /** Quitter la partie : la télé est prévenue, on revient à l'accueil (on peut revenir avec le même code). */
  const leave = () => {
    if (!confirm(lang === 'fr' ? 'Quitter la partie ?' : 'Leave the game?')) return;
    send({ t: 'bye' });
    save('lastGame', null);
    setTimeout(() => {
      netRef.current?.stop();
      location.hash = '#/';
    }, 200);
  };
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
        if (m.t === 'full') {
          alert(lang === 'fr' ? `La partie est complète : ${m.max} joueurs. Le Pass Soirée de l’hôte ouvre le salon à 12.` : `The game is full: ${m.max} players. The host’s Party Pass opens the room to 12.`);
          location.hash = '#/';
          return;
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
    const got = LEVEL_UNLOCKS.filter((u) => u.level <= level && !progress.owned.includes(u.key)).map((u) => u.key);
    if (got.length) setProgress((p) => ({ ...p, owned: [...new Set([...p.owned, ...got])] }));
  }, [level, profile.level]);
  usePresence(user, profile, code);

  // Dernier jeu joué (pour les défis de la semaine)
  const lastGameId = useRef<string | undefined>(undefined);
  if (screen?.s === 'play') lastGameId.current = screen.game;

  // Gains de fin de partie et de podium, comptés une seule fois.
  useEffect(() => {
    if (!screen || (screen.s !== 'results' && screen.s !== 'podium') || screen.rank <= 0) return;
    const key = `${code}:${screen.s}:${screen.gid}`;
    if (progress.last === key) return;
    const gain = screen.s === 'results' ? rewardFor(screen.points, screen.rank) : { xp: 0, coins: podiumBonus(screen.rank) };
    const before = levelInfo(progress.xp).level;
    const after = levelInfo(progress.xp + gain.xp).level;
    const up = after > before;
    const habit = afterGame(progress.habits, { rank: screen.rank, game: lastGameId.current, podium: screen.s === 'podium' });
    setProgress((p) => ({
      ...p,
      last: key,
      habits: habit.habits,
      xp: p.xp + gain.xp,
      coins: p.coins + gain.coins + habit.coins + (up ? LEVEL_GIFT * (after - before) : 0),
      boxes: habit.boxes.reduce((b, id) => ({ ...b, [id]: (b[id] ?? 0) + 1 }), p.boxes ?? {}),
      games: p.games + (screen.s === 'results' ? 1 : 0),
      wins: p.wins + (screen.rank === 1 ? 1 : 0),
    }));
    setReward({ unlocked: up ? LEVEL_UNLOCKS.filter((u) => u.level > before && u.level <= after).map((u) => itemName(u.key, lang)) : [], xp: gain.xp, coins: gain.coins + habit.coins, level: up ? after : null, daily: habit.daily, boxes: habit.boxes, streak: habit.streak, quests: habit.quests.map((q) => q.label[lang]) });
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
    const takenFoods = screen?.s === 'lobby' ? screen.foods ?? {} : {};
    return <Editor profile={profile} setProfile={setProfile} taken={taken} takenFoods={takenFoods} onDone={() => setEditing(false)} progress={progress} setProgress={setProgress} account={account} />;
  }

  const playing = screen?.s === 'play' && status === 'ok';
  const gameName = screen && 'game' in screen ? catalog.find((g) => g.id === screen.game)?.name?.[lang] : '';

  const padTheme = playing ? PAD_THEMES.find((x) => x.id === profile.padTheme) : undefined;
  return (
    // Manettes stick et tapotage : toujours en paysage, même si le téléphone reste droit (on tourne l'écran).
    <div className={`pad ${playing ? 'pad-play' : ''} ${playing && screen.s === 'play' && (screen.layout === 'stick' || screen.layout === 'tap') && !['traitre', 'dessin'].includes(screen.game) ? 'turn' : ''} ${padTheme?.anim ? 'pt-anim' : ''}`} data-pt={padTheme?.id} style={{ ['--c' as string]: profile.color, ...(padTheme ? { ['--pt-bg' as string]: padTheme.bg, ['--pt-grip' as string]: padTheme.grip, ['--pt-ink' as string]: padTheme.ink } : {}) }} onPointerDown={unlockAudio}>
      {status === 'lost' && !lostLong && screen && <div className="net-blip">⚡ {lang === 'fr' ? 'Reconnexion…' : 'Reconnecting…'}</div>}
      <header className={`pad-head ${playing ? 'slim' : ''}`}>
        <CharCanvas profile={profile} size={playing ? 34 : 46} still />
        <b className="pad-name">{profile.name || '???'}{!playing && <small>{code} · {status === 'ok' ? t(lang, 'ping', { ms: rtt }) : '…'}</small>}</b>
        {playing ? <span className="pad-info">{gameName}</span> : <span className="pad-coins">🍬 {fmtCoins(progress.coins)}</span>}
        {playing && screen?.s === 'play' && screen.host && (
          <button className="pill pause-btn" onClick={() => host('pause')} aria-label={t(lang, 'pause')}>
            ⏸
          </button>
        )}
        {/* Réactions : toujours au même endroit, en haut à droite (avant, la bulle flottante cachait l'écran) */}
        {status === 'ok' && screen && ['wait', 'results', 'podium', 'paused', 'recap'].includes(screen.s) && <ReactButton lang={lang} family={family} send={send} inline />}
        {!playing && status === 'ok' && (
          <button className="pill" onClick={leave} aria-label={lang === 'fr' ? 'Quitter la partie' : 'Leave the game'}>
            🚪
          </button>
        )}
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

/** Bonbons lisibles : 12 500, 500 k, 500 M. */
function fmtCoins(n: number) {
  if (n >= 1e6) return `${Math.floor(n / 1e5) / 10} M`.replace('.', ',');
  if (n >= 1e5) return `${Math.floor(n / 1e3)} k`;
  return n.toLocaleString('fr-FR');
}

/** Qui est dans la partie ; le chef peut passer la main ou retirer quelqu'un d'un seul geste. */
function PlayersCard({ roster, host, lang, act }: { roster: { pid: string; name: string; color: string; level?: number; chief: boolean; me: boolean }[]; host: boolean; lang: Lang; act: (a: 'chief' | 'kick', pid: string) => void }) {
  const fr = lang === 'fr';
  return (
    <section className="roster">
      <h3>👥 {fr ? 'Dans la partie' : 'In this game'} <small>{roster.length}</small></h3>
      {roster.map((p) => (
        <div key={p.pid} className={`roster-row ${p.me ? 'me' : ''}`}>
          <i style={{ background: p.color }} />
          <b>{p.name || '???'}{p.me && <em>{fr ? ' (toi)' : ' (you)'}</em>}</b>
          {p.chief && <span className="roster-chief">👑 {fr ? 'Chef' : 'Host'}</span>}
          {p.level && p.level > 1 ? <small>{fr ? 'Niv.' : 'Lv.'} {p.level}</small> : null}
          {host && !p.me && (
            <>
              <button
                className="kick-btn chief-btn"
                onClick={() => {
                  if (confirm(fr ? `Donner la place de chef à ${p.name} ?` : `Make ${p.name} the host?`)) act('chief', p.pid);
                }}
              >
                👑
              </button>
              <button
                className="kick-btn"
                aria-label={fr ? 'Retirer' : 'Remove'}
                onClick={() => {
                  if (confirm(fr ? `Retirer ${p.name} de la partie ?` : `Remove ${p.name} from the game?`)) act('kick', p.pid);
                }}
              >
                ✕
              </button>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

/** Code de test : disparaît dès que les ventes sont ouvertes (les bonbons n'ont aucune valeur avant). */
function TestCode({ progress, setProgress, lang }: { progress: Progress; setProgress: Account['setProgress']; lang: Lang }) {
  const fr = lang === 'fr';
  const [v, setV] = useState('');
  const [msg, setMsg] = useState('');
  const go = () => {
    if (v.trim().toUpperCase() !== 'MATIS500') return setMsg(fr ? 'Code inconnu' : 'Unknown code');
    if (progress.owned.includes('code:matis500')) return setMsg(fr ? 'Déjà utilisé' : 'Already used');
    setProgress((p) => ({ ...p, coins: p.coins + 500000000, owned: [...p.owned, 'code:matis500'] }));
    setV('');
    setMsg(fr ? '+500 000 000 🍬' : '+500,000,000 🍬');
  };
  return (
    <section className="set-card">
      <h3>🎟️ {fr ? 'Code de test' : 'Test code'}</h3>
      <input className="name-input" value={v} onChange={(e) => setV(e.target.value)} placeholder={fr ? 'Ton code' : 'Your code'} autoCapitalize="characters" />
      <button className="btn mint" onClick={go}>{fr ? 'Valider' : 'Apply'}</button>
      {msg && <p className="set-help">{msg}</p>}
    </section>
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
  /** Achat présenté (Pass, pack). */
  const [selling, setSelling] = useState<string | null>(null);
  /** Onglet du salon : jouer, mon perso, réglages. */
  const [tab, setTab] = useState<'play' | 'perso' | 'boxes' | 'settings'>('play');
  // Chaque onglet et la liste des jeux gardent leur position
  const tops = useRef<Record<string, number>>({});
  const spot = picking ? 'picking' : tab;
  useLayoutEffect(() => {
    const el = document.querySelector('.pad-body');
    if (!el) return;
    el.scrollTop = tops.current[spot] ?? 0;
    const save = () => {
      tops.current[spot] = el.scrollTop;
    };
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, [spot]);
  const [keysOpen, setKeysOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  const [noTour, setNoTour] = useState<string[]>(() => store<string[]>('noTour', []));
  const [moodAsked, setMoodAsked] = useState(() => store<boolean>('moodAsked', false));
  const [optFor, setOptFor] = useState<string | null>(null);
  /** Menu de réglage ouvert (bots, niveau des bots, voix). */
  const [menu, setMenu] = useState<null | 'bots' | 'botlevel' | 'voice'>(null);
  /** Voix pas encore débloquée qu'on vient d'écouter. */
  const [voiceTry, setVoiceTry] = useState(-1);
  const voiceOwned = (i: number) => !VOICES[i]?.price || progress.owned.includes(`voice:${VOICES[i].id}`);
  const [opts, setOpts] = useState<Record<string, number>>({});
  switch (screen.s) {
    case 'lobby':
      if (selling)
        return (
          <ProductCard
            id={selling}
            lang={lang}
            signedIn={!!account.user}
            connect={account.connect}
            onGot={(bought) => {
              account.gotItem(selling, bought);
              setSelling(null);
            }}
            onClose={() => setSelling(null)}
          />
        );
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
                  {op.choices.filter((c) => !(screen.family && c.pack && PACKS.find((x) => x.id === c.pack)?.adult)).map((c) => {
                    const on = (opts[op.id] ?? op.choices[0].v) === c.v;
                    const closed = SALES_ON && !!c.pack && !screen.roomItems?.includes(c.pack);
                    if (closed)
                      return (
                        <button key={c.v} onClick={() => setSelling(c.pack!)} style={{ ['--tc' as string]: def.color }}>
                          <span>🔒 {c.label[lang]}</span>
                        </button>
                      );
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
                const ids = screen.games.map((x) => x.id);
                const locked = isLocked(g.id, ids, !!screen.roomItems?.includes(PASS));
                return (
                  <button
                    key={g.id}
                    className="game-card"
                    style={{ ['--g' as string]: def.color }}
                    disabled={g.soon}
                    onClick={() => {
                      if (locked) {
                        setSelling(PASS);
                        return;
                      }
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
                    {locked && <small>🔒 Pass</small>}
                    {SALES_ON && gameOfDay(ids) === g.id && <small>🎁 {lang === 'fr' ? 'Offert aujourd’hui' : 'Free today'}</small>}
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
        <div className="pad-body host pad-lobby">
          {tab === 'play' && (
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
          )}
          {tab === 'perso' && (
            <>
              <button className="perso-hero" onClick={edit}>
                <CharCanvas profile={profile} size={170} />
                <b>{profile.name || '???'}</b>
                <span className="btn big mint">✏️ {lang === 'fr' ? 'Modifier mon perso' : 'Edit my character'}</span>
              </button>
              <ProgressCard progress={progress} lang={lang} onShop={edit} account={account} />
              <FriendsCard user={account.user} lang={lang} room={code} connect={account.connect} />
            </>
          )}
          {tab === 'play' && screen.host && (
            <>
              {!moodAsked && (
                <div className="mood-ask">
                  <b>{lang === 'fr' ? 'Ce soir, c’est plutôt…' : 'Tonight is more…'}</b>
                  <div className="row">
                    {[false, true].map((fam) => (
                      <button
                        key={String(fam)}
                        className={fam ? 'btn mint' : 'btn'}
                        onClick={() => {
                          if (screen.family !== fam) host('family');
                          save('moodAsked', true);
                          setMoodAsked(true);
                        }}
                      >
                        {fam ? (lang === 'fr' ? '👨‍👩‍👧 En famille' : '👨‍👩‍👧 Family') : lang === 'fr' ? '🍕 Entre potes' : '🍕 With friends'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="pad-title">{t(lang, 'hostAsk')}</p>
              {SALES_ON && !screen.roomItems?.includes(PASS) && (
                <button className="btn sun" onClick={() => setSelling(PASS)}>
                  🎟️ {lang === 'fr' ? 'Pass Soirée : tous les jeux pour le salon' : 'Party Pass: all games for the room'}
                </button>
              )}
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
            </>
          )}
          {tab === 'boxes' && (
            <>
              {keysOpen ? (
                <div className="key-packs">
                  {KEY_PACKS.map((k) => (
                    <ProductCard key={k.id} id={k.id} lang={lang} signedIn={!!account.user} connect={account.connect} onGot={() => { setKeysOpen(false); account.refreshKeys(); }} onClose={() => setKeysOpen(false)} />
                  ))}
                </div>
              ) : (
                <BoxShop progress={progress} setProgress={account.setProgress} profile={profile} setProfile={account.setProfile} lang={lang} account={{ signedIn: !!account.user, connect: account.connect, keys: account.keys, openChest: account.openChest, buyKeys: () => setKeysOpen(true) }} />
              )}
            </>
          )}
          {tab === 'settings' && <ControlsCard lang={lang} />}
          {tab === 'settings' && !SALES_ON && <TestCode progress={progress} setProgress={account.setProgress} lang={lang} />}
          {tab === 'settings' && (
            <section className="set-card">
              <h3>🌍 {lang === 'fr' ? 'Langue' : 'Language'}</h3>
              <div className="lang-row set-lang">
                {(['fr', 'en'] as Lang[]).map((l) => (
                  <button key={l} className={`tab ${lang === l ? 'on' : ''}`} onClick={() => account.setProfile((p) => ({ ...p, lang: l }))}>
                    {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                  </button>
                ))}
              </div>
            </section>
          )}
          {tab === 'settings' && screen.host && (
            <>
              {!screen.roster && screen.players.length > 0 && (
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
                <button className={`opt mint ${screen.family ? 'on' : ''}`} onClick={() => { save('moodAsked', true); host('family'); }} aria-pressed={screen.family}>
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
          )}
          {tab === 'settings' && <LegalLinks lang={lang} />}
          {tab === 'play' && !screen.host && (
            <>
              <button className="perso-hero small" onClick={() => setTab('perso')}>
                <CharCanvas profile={profile} size={120} />
              </button>
              <p className="pad-title pulse">{t(lang, 'waitHost', { name: screen.hostName })}</p>
              {screen.family && <p className="pad-small">👨‍👩‍👧 {t(lang, 'family')}</p>}
            </>
          )}
          {tab === 'play' && screen.roster && <PlayersCard roster={screen.roster} host={screen.host} lang={lang} act={(a, pid) => host(a, pid)} />}
          {tab === 'play' && (
            <div className="mission-entry">
              <button className={`mission-open ${claimableCount(progress.habits) ? 'hot' : ''}`} onClick={() => setMissionsOpen((v) => !v)} aria-expanded={missionsOpen}>
                <span>🎯</span>
                <b>{lang === 'fr' ? 'Mes défis' : 'My challenges'}</b>
                {claimableCount(progress.habits) > 0 && <em>{claimableCount(progress.habits)} {lang === 'fr' ? 'à récupérer' : 'to claim'}</em>}
                <i>{missionsOpen ? '▲' : '▼'}</i>
              </button>
              {missionsOpen && <Missions progress={progress} setProgress={account.setProgress} lang={lang} />}
            </div>
          )}
          {tab === 'play' && <InviteBanner user={account.user} lang={lang} room={code} />}
          {tab === 'play' && screen.teams && (
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
                      : VOICES.map((x, v) => ({ v, label: voiceOwned(v) ? x[lang] : `🔒 ${x[lang]} · ${x.price} 🍬`, on: screen.voice === v })).filter((o) => !screen.voicesOk || screen.voicesOk.includes(o.v))
                  ).map((o) => (
                    <button
                      key={o.v}
                      className={`chip txt ${o.on ? 'on' : ''}`}
                      onClick={() => {
                        // Voix à débloquer : la télé la fait écouter, sans la garder
                        if (menu === 'voice' && !voiceOwned(o.v)) {
                          host('voice', undefined, { v: o.v, try: 1 });
                          setVoiceTry(o.v);
                          return;
                        }
                        setVoiceTry(-1);
                        host(menu, undefined, { v: o.v });
                        // La voix : on reste dans le menu pour en écouter d'autres
                        if (menu !== 'voice') setMenu(null);
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {menu === 'voice' && <p className="pad-small">{screen.voiceLoading ? (lang === 'fr' ? 'Les voix à prénom se téléchargent sur la télé (la première fois seulement). Tu les entendras dès que c’est prêt.' : 'Named voices are downloading on the TV (first time only). You’ll hear them when ready.') : lang === 'fr' ? 'La télé fait écouter chaque voix.' : 'The TV plays each voice.'}</p>}
                {menu === 'voice' && voiceTry >= 0 && !voiceOwned(voiceTry) && (
                  <button
                    className="btn mint"
                    disabled={progress.coins < (VOICES[voiceTry].price ?? 0)}
                    onClick={() => {
                      const it = VOICES[voiceTry];
                      account.setProgress((p) => ({ ...p, coins: p.coins - (it.price ?? 0), owned: [...p.owned, `voice:${it.id}`] }));
                      host('voice', undefined, { v: voiceTry });
                      setVoiceTry(-1);
                    }}
                  >
                    {progress.coins < (VOICES[voiceTry].price ?? 0)
                      ? lang === 'fr' ? `Il te manque ${(VOICES[voiceTry].price ?? 0) - progress.coins} 🍬` : `${(VOICES[voiceTry].price ?? 0) - progress.coins} 🍬 short`
                      : lang === 'fr' ? `Débloquer ${VOICES[voiceTry].fr} · ${VOICES[voiceTry].price} 🍬` : `Unlock ${VOICES[voiceTry].en} · ${VOICES[voiceTry].price} 🍬`}
                  </button>
                )}
                <button className="btn" onClick={() => setMenu(null)}>
                  OK
                </button>
              </div>
            </div>
          )}
          <nav className="lobby-tabs">
            {(
              [
                ['play', '🎮', lang === 'fr' ? 'Jouer' : 'Play'],
                ['perso', '🧑', lang === 'fr' ? 'Profil' : 'Profile'],
                ['boxes', '🎁', lang === 'fr' ? 'Boîtes' : 'Boxes'],
                ['settings', '⚙️', lang === 'fr' ? 'Réglages' : 'Settings'],
              ] as const
            ).map(([id, ico, label]) => (
              <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} aria-pressed={tab === id}>
                <i>{ico}</i>
                {label}
              </button>
            ))}
          </nav>
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
      if (screen.game === 'cri' && screen.data) return <ShoutPad data={screen.data as ShoutPadData} lang={lang} send={send} />;
      if (VOICE_GAMES.includes(screen.game) && screen.data) return <VoicePad data={screen.data as VoicePadData} lang={lang} send={send} />;
      if (['tribunal', 'dico', 'plutot', 'chiffre'].includes(screen.game) && screen.data) return <QuizPad data={screen.data as QuizPadData} lang={lang} send={send} />;
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
    case 'vote':
      return <VotePad screen={screen} lang={lang} send={send} />;
    case 'wheel':
      return <WheelPad screen={screen} lang={lang} send={send} />;
    case 'tiebreak':
      return <TiebreakPad screen={screen} lang={lang} send={send} />;
    case 'recap':
      return (
        <div className="pad-body">
          <p className="pad-title">📊 {lang === 'fr' ? 'Regarde l’écran : le bilan de la soirée !' : 'Look at the screen: tonight’s awards!'}</p>
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
  gotItem: (id: string, bought: boolean) => void;
  keys: number;
  refreshKeys: () => void;
  openChest: () => Promise<{ key: string | null; rarity: Rarity; pity: number }>;
  setProgress: (f: (p: Progress) => Progress) => void;
  setProfile: (f: (p: Profile) => Profile) => void;
}

/** Prochaine récompense de niveau. */
function NextLevelGift({ progress, lang }: { progress: Progress; lang: Lang }) {
  const { level } = levelInfo(progress.xp);
  const next = LEVEL_UNLOCKS.find((u) => u.level > level);
  if (!next) return null;
  return (
    <div className="next-gift" style={{ ['--rar' as string]: RARITIES[next.rarity].color }}>
      <span>🔓</span>
      <p>
        <b>{lang === 'fr' ? `Niveau ${next.level}` : `Level ${next.level}`}</b>
        <small>{itemName(next.key, lang)}</small>
      </p>
      <em>{RARITIES[next.rarity].name[lang]}</em>
    </div>
  );
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
      <NextLevelGift progress={progress} lang={lang} />
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

type Reward = { unlocked?: string[]; xp: number; coins: number; level: number | null; daily?: number; boxes?: string[]; streak?: number; quests?: string[] };

/** Ce que la partie vient de rapporter (et le niveau gagné). */
function RewardCard({ reward, progress, lang }: { reward: Reward; progress: Progress; lang: Lang }) {
  const { level, into, need } = levelInfo(progress.xp);
  return (
    <div className={`reward-card ${reward.level ? 'up' : ''}`}>
      {!!reward.daily && <p className="reward-up">🎁 {lang === 'fr' ? `Cadeau du jour : +${reward.daily} 🍬 (série de ${reward.streak})` : `Daily gift: +${reward.daily} 🍬 (${reward.streak}-day streak)`}</p>}
      {reward.boxes?.map((b, i) => <p key={i} className="reward-up">🎉 {lang === 'fr' ? (b === 'grosse' ? 'Caisse de la semaine : une Grosse boîte à ouvrir !' : 'Caisse du jour : une Petite boîte à ouvrir !') : b === 'grosse' ? 'Weekly crate: a Big box to open!' : 'Daily crate: a Small box to open!'}</p>)}
      {reward.quests?.map((q) => <p key={q} className="reward-up">🎯 {lang === 'fr' ? 'Défi réussi' : 'Challenge done'} : {q}</p>)}
      {reward.level && <p className="reward-up">🎉 {t(lang, 'levelUp', { n: reward.level })} +{LEVEL_GIFT} 🍬</p>}
      {reward.unlocked?.map((u) => <p key={u} className="reward-up">🔓 {lang === 'fr' ? 'Débloqué' : 'Unlocked'} : {u}</p>)}
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

type Tab = 'perso' | 'color' | 'skin' | 'eyes' | 'pose' | 'hat' | 'deco' | 'winpose' | 'winsound' | 'ko' | 'winfx' | 'trail' | 'frame' | 'plate' | 'title' | 'reactions' | 'entry' | 'padtheme' | 'more';

function Editor({
  profile,
  setProfile,
  taken,
  takenFoods,
  onDone,
  progress,
  setProgress,
  account,
}: {
  account: Account;
  profile: Profile;
  setProfile: (f: (p: Profile) => Profile) => void;
  taken: string[];
  /** Persos déjà choisis par les autres (on ne peut pas les prendre). */
  takenFoods: Record<string, string>;
  onDone: () => void;
  progress: Progress;
  setProgress: (f: (p: Progress) => Progress) => void;
}) {
  const lang = profile.lang;
  const level = levelInfo(progress.xp).level;
  const [buying, setBuying] = useState<{ kind: Kind; id: string; name: string } | null>(null);
  const collOf = (kind: Kind, id: string) => PRICES[itemKey(kind, id)]?.coll;
  const owned = (kind: Kind, id: string) => isOwned(progress, kind, id) || (!!collOf(kind, id) && !!profile.items?.includes(collOf(kind, id)!));
  /** Touche un objet : on le met s'il est à nous, sinon on propose de l'acheter. */
  const choose = (kind: Kind, id: string, name: string) => {
    if (owned(kind, id)) {
      set({ [FIELD[kind]]: id || undefined });
      if (id && (kind === 'winsound' || kind === 'entry')) playItem(`${kind}:${id}`, profile);
    } else {
      sfx.click();
      setBuying({ kind, id, name });
    }
  };
  const buy = () => {
    if (!buying) return;
    const it = PRICES[itemKey(buying.kind, buying.id)];
    if (!it || !it.price || (SALES_ON && it.coll) || progress.coins < it.price || outOfSeason(itemKey(buying.kind, buying.id))) return;
    setProgress((p) => ({ ...p, coins: p.coins - it.price, owned: [...p.owned, itemKey(buying.kind, buying.id)] }));
    if (buying.kind !== 'react') set({ [FIELD[buying.kind]]: buying.id });
    sfx.win();
    setBuying(null);
  };
  const outOfSeason = (key: string) => {
    const s = seasonOf(key);
    return !!s && currentSeason()?.id !== s.id;
  };
  const lock = (kind: Kind, id: string) => {
    const r = rarityOf(itemKey(kind, id));
    const dot = r ? <i className={`rar-tag rt-${r}`} style={{ background: RARITIES[r].color }}>{RARITIES[r].name[lang]}</i> : null;
    if (owned(kind, id)) return dot;
    const it = PRICES[itemKey(kind, id)];
    if (it.level) return <>{dot}<span className="lock how lvl">🔒 {fr ? 'Niv.' : 'Lv.'} {it.level}</span></>;
    if (SALES_ON && it.coll) return <>{dot}<span className="lock how box">🎁 {fr ? 'Collection' : 'Collection'}</span></>;
    if (outOfSeason(itemKey(kind, id))) return <>{dot}<span className="lock how box">{seasonOf(itemKey(kind, id))!.emoji} {fr ? 'Saison' : 'Season'}</span></>;
    if (seasonOf(itemKey(kind, id))) return <>{dot}<span className={`lock how ${progress.coins >= it.price ? 'ok' : ''}`}>🍬 {it.price}</span></>;
    return (
      <>
        {dot}
        <span className={`lock how ${it.price ? (progress.coins >= it.price ? 'ok' : '') : 'box'}`}>{it.price ? `🍬 ${it.price}` : `🎁 ${fr ? 'Boîte' : 'Box'}`}</span>
      </>
    );
  };
  /** Du plus courant au plus rare, ce qui est gratuit d'abord. */
  const byRarity = <T extends { id: string }>(kind: Kind, list: T[]) =>
    [...list].sort((a, b) => {
      const rank = (x: T) => {
        const r = rarityOf(itemKey(kind, x.id));
        return r ? RARITY_ORDER.indexOf(r) + 1 : 0;
      };
      return rank(a) - rank(b);
    });
  /** Grille des nouvelles catégories : aucun, puis tous les objets. */
  const extraGrid = (kind: Kind, items: { id: string; name: Record<Lang, string> }[], none: string) => (
    <div className="pick-grid">
      <button className={`pick ${!profile[FIELD[kind]] ? 'on' : ''}`} onClick={() => set({ [FIELD[kind]]: undefined })}>
        <span className="thumb-ico" style={{ fontSize: 40 }}>🚫</span>
        <small>{none}</small>
      </button>
      {byRarity(kind, items).map((x) => (
        <button key={x.id} className={`pick ${profile[FIELD[kind]] === x.id ? 'on' : ''} ${owned(kind, x.id) ? '' : 'locked'}`} onClick={() => choose(kind, x.id, x.name[lang])}>
          <ItemThumb item={itemKey(kind, x.id)} profile={profile} size={64} />
          <small>{x.name[lang]}</small>
          {lock(kind, x.id)}
        </button>
      ))}
    </div>
  );
  const fileRef = useRef<HTMLInputElement>(null);
  // null = le menu des catégories ; sinon la catégorie ouverte (avec un bouton retour)
  const [tab, setTab] = useState<Tab | null>(null);
  /** Perso dont on regarde les variantes. */
  const [family, setFamily] = useState<string | null>(null);
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
      food: (pick(FOODS.filter((f) => owned('food', f.id) && !takenFoods[f.id])) ?? FOODS[0]).id,
      color: pick(COLORS.filter((c) => !taken.includes(c) && owned('color', c))) ?? profile.color,
      hat: pick(HATS.filter((h) => owned('hat', h.id))).id,
      acc: pick(ACCS.filter((a) => owned('acc', a.id))).id,
    });

  const fr = lang === 'fr';
  const nameOf = (list: { id: string; name: Record<Lang, string> }[], id: string | undefined, none: string) =>
    list.find((x) => x.id === (id ?? ''))?.name[lang] ?? none;
  const tabs: [Tab, string, string, string][] = [
    ['perso', '🍕', fr ? 'Perso' : 'Character', nameOf(FOODS, profile.food, '')],
    ['color', '🎨', fr ? 'Couleur' : 'Color', ''],
    ['skin', '🌈', fr ? 'Couleur du perso' : 'Character paint', nameOf(SKINS, profile.skin ?? '', fr ? 'Normale' : 'Normal')],
    ['eyes', '👀', fr ? 'Regard' : 'Eyes', nameOf(EYE_LIST, profile.eyes, '')],
    ['pose', '🕺', fr ? 'Pose' : 'Pose', nameOf(POSE_LIST, profile.pose, '')],
    ['hat', '🎩', fr ? 'Chapeau' : 'Hat', nameOf(HATS, profile.hat, '')],
    ['deco', '🕶️', fr ? 'Déco' : 'Extras', nameOf(ACCS, profile.acc, '')],
    ['winpose', '🏆', fr ? 'Pose de victoire' : 'Victory pose', nameOf(WIN_POSES, profile.winPose ?? '', fr ? 'Classique' : 'Classic')],
    ['winsound', '🎺', fr ? 'Son de victoire' : 'Victory sound', nameOf(WIN_SOUNDS, profile.winSound ?? '', fr ? 'Classique' : 'Classic')],
    ['winfx', '🎆', fr ? 'Effet d’écran' : 'Screen effect', nameOf(WIN_FX, profile.winFx ?? '', fr ? 'Aucun' : 'None')],
    ['ko', '💥', fr ? 'Effet de K.-O.' : 'Knockout effect', nameOf(KO_FX, profile.koFx ?? '', fr ? 'Aucun' : 'None')],
    ['frame', '💫', fr ? 'Cadre photo' : 'Photo frame', nameOf(FRAMES, profile.frame ?? '', fr ? 'Aucun' : 'None')],
    ['plate', '🔤', fr ? 'Style de nom' : 'Name style', nameOf(PLATES, profile.plate ?? '', fr ? 'Normal' : 'Normal')],
    ['title', '🏷️', fr ? 'Titre' : 'Title', nameOf(TITLES, profile.title ?? '', fr ? 'Aucun' : 'None')],
    ['entry', '🎙️', fr ? 'Annonce d’entrée' : 'Entrance', nameOf(ENTRIES, profile.entry ?? '', fr ? 'Aucune' : 'None')],
    ['trail', '☄️', fr ? 'Traînée' : 'Trail', nameOf(TRAILS, profile.trail ?? '', fr ? 'Aucune' : 'None')],
    ['reactions', '😂', fr ? 'Réactions' : 'Reactions', ''],
    ['padtheme', '🎮', fr ? 'Thème de manette' : 'Controller theme', nameOf(PAD_THEMES, profile.padTheme ?? '', fr ? 'Classique' : 'Classic')],
    ['more', '⚙️', fr ? 'Langue' : 'Language', lang === 'fr' ? 'Français' : 'English'],
  ];
  const menuTop = useRef(0);
  const open = (k: Tab) => {
    sfx.click();
    menuTop.current = document.querySelector('.editor')?.scrollTop ?? 0;
    setTab(k);
    document.querySelector('.editor')?.scrollTo({ top: 0 });
  };
  // Retour au menu : on retrouve l'endroit où on était
  useLayoutEffect(() => {
    if (tab === null) document.querySelector('.editor')?.scrollTo({ top: menuTop.current });
  }, [tab]);
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
          <span className="thumb-frame">
            <PlayerFrame id={profile.selfie ? undefined : profile.frame} inset={0} />
            <CharCanvas profile={profile} size={tab ? 96 : 150} />
          </span>
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
      {!tab && (profile.plate || profile.title) && (
        <p className="ed-name-preview"><PlateName name={profile.name || 'Cana’pet'} plate={profile.plate} /><PlayerTitle id={profile.title} lang={lang} /></p>
      )}
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
            <Fragment key={k}>
              {k === 'perso' && <p className="ed-sec">🧑 {fr ? 'Mon look' : 'My look'}</p>}
              {k === 'winpose' && <p className="ed-sec">🏆 {fr ? 'Quand je gagne ou je perds' : 'When I win or lose'}</p>}
              {k === 'frame' && <p className="ed-sec">✨ {fr ? 'Mon style à la télé' : 'My style on TV'}</p>}
              {k === 'reactions' && <p className="ed-sec">📱 {fr ? 'Ma manette' : 'My controller'}</p>}
              <button className="ed-cat" onClick={() => open(k)}>
                <span className="ed-cat-ico">{k === 'color' ? <i style={{ background: profile.color }} /> : icon}</span>
                <span className="ed-cat-txt">
                  <b>{label}</b>
                  {value && <small>{value}</small>}
                </span>
                <span className="ed-cat-go">›</span>
              </button>
            </Fragment>
          ))}
        </div>
      )}
      {tab === 'eyes' && (
        <div className="pick-grid">
          {EYE_LIST.map((e) => (
            <button key={e.id} className={`pick ${(profile.eyes ?? '') === e.id ? 'on' : ''} ${!e.id || owned('eyes', e.id) ? '' : 'locked'}`} onClick={() => (e.id ? choose('eyes', e.id, e.name[lang]) : set({ eyes: undefined }))}>
              <CharCanvas profile={{ ...profile, selfie: undefined, eyes: e.id || undefined }} size={64} still />
              <small>{e.name[lang]}</small>
              {!!e.id && lock('eyes', e.id)}
            </button>
          ))}
        </div>
      )}
      {tab === 'skin' && extraGrid('skin', SKINS, fr ? 'Normale' : 'Normal')}
      {tab === 'frame' && extraGrid('frame', FRAMES, fr ? 'Aucun' : 'None')}
      {tab === 'plate' && extraGrid('plate', PLATES, fr ? 'Normal' : 'Normal')}
      {tab === 'title' && extraGrid('title', TITLES, fr ? 'Aucun' : 'None')}
      {tab === 'entry' && extraGrid('entry', ENTRIES, fr ? 'Aucune' : 'None')}
      {tab === 'trail' && (
        <>
          <p className="pad-small center">{fr ? 'Elle s’adapte au jeu : double sillage en kart, longue en course, discrète dans les jeux vus de dessus.' : 'It adapts to the game: double trail in karts, long when racing, subtle in top-down games.'}</p>
          {extraGrid('trail', TRAILS, fr ? 'Aucune' : 'None')}
        </>
      )}
      {tab === 'padtheme' && extraGrid('padtheme', PAD_THEMES, fr ? 'Classique' : 'Classic')}
      {tab === 'reactions' && (
        <>
          <p className="pad-small center">{fr ? 'Celles que tu as gagnées rejoignent ta liste 😂 sur la manette.' : 'The ones you win join your 😂 list on the controller.'}</p>
          <div className="pick-grid">
            {byRarity('react', REACT_ITEMS).map((x) => (
              <button key={x.id} className={`pick ${owned('react', x.id) ? '' : 'locked'}`} onClick={() => !owned('react', x.id) && choose('react', x.id, x.name[lang])}>
                <ItemThumb item={itemKey('react', x.id)} profile={profile} size={64} />
                <small>{x.name[lang]}</small>
                {lock('react', x.id)}
              </button>
            ))}
          </div>
        </>
      )}
      {tab === 'winpose' && extraGrid('winpose', WIN_POSES, fr ? 'Classique' : 'Classic')}
      {tab === 'winsound' && extraGrid('winsound', WIN_SOUNDS, fr ? 'Classique' : 'Classic')}
      {tab === 'winfx' && extraGrid('winfx', WIN_FX, fr ? 'Aucun' : 'None')}
      {tab === 'ko' && extraGrid('ko', KO_FX, fr ? 'Aucun' : 'None')}
      {tab === 'pose' && (
        <div className="pick-grid">
          {byRarity('pose', POSE_LIST).map((e) => (
            <button key={e.id} className={`pick ${(profile.pose ?? '') === e.id ? 'on' : ''} ${!e.id || owned('pose', e.id) ? '' : 'locked'}`} onClick={() => (e.id ? choose('pose', e.id, e.name[lang]) : set({ pose: undefined }))}>
              <CharCanvas profile={{ ...profile, selfie: undefined, pose: e.id || undefined }} size={64} still />
              <small>{e.name[lang]}</small>
              {!!e.id && lock('pose', e.id)}
            </button>
          ))}
        </div>
      )}

      {tab === 'perso' && (
        <div className="pick-grid">
          {byRarity('food', FOODS.filter((x) => !VARIANT_OF[x.id])).map((f) => {
            const vars = FOODS.filter((x) => VARIANT_OF[x.id] === f.id);
            // Sa variante choisie s'affiche à la place du perso normal
            const mine = VARIANT_OF[profile.food] === f.id ? profile.food : f.id;
            const on = profile.food === f.id || mine !== f.id;
            const taken = !vars.length && !!takenFoods[f.id] && profile.food !== f.id;
            const got = vars.filter((v) => owned('food', v.id)).length;
            return (
              <button
                key={f.id}
                className={`pick ${on ? 'on' : ''} ${owned('food', mine) ? '' : 'locked'} ${taken ? 'taken' : ''}`}
                disabled={taken}
                onClick={() => {
                  if (vars.length) {
                    sfx.click();
                    setFamily(f.id);
                  } else choose('food', f.id, f.name[lang]);
                }}
              >
                <CharCanvas profile={{ ...profile, food: mine, selfie: undefined, hat: 'aucun', acc: 'aucun' }} size={64} still />
                <small>{taken ? (fr ? `Pris par ${takenFoods[f.id]}` : `Taken by ${takenFoods[f.id]}`) : f.name[lang]}</small>
                {vars.length > 0 && <em className="fam-badge">✨ {got > 0 ? `${got}/${vars.length}` : vars.length} {fr ? `variante${vars.length > 1 ? 's' : ''}` : `variant${vars.length > 1 ? 's' : ''}`}</em>}
                {lock('food', mine)}
              </button>
            );
          })}
        </div>
      )}
      {tab === 'perso' && family && (
        <div className="buy-veil" onClick={() => setFamily(null)}>
          <div className="buy-card fam-sheet" onClick={(e) => e.stopPropagation()}>
            <b>{FOODS.find((x) => x.id === family)?.name[lang]}</b>
            <p className="pad-small">{fr ? 'Le normal et toutes ses variantes' : 'The original and all its variants'}</p>
            <div className="pick-grid">
              {FOODS.filter((x) => x.id === family || VARIANT_OF[x.id] === family).map((v) => {
                const taken = !!takenFoods[v.id] && profile.food !== v.id;
                return (
                  <button
                    key={v.id}
                    className={`pick ${profile.food === v.id ? 'on' : ''} ${owned('food', v.id) ? '' : 'locked'} ${taken ? 'taken' : ''}`}
                    disabled={taken}
                    onClick={() => {
                      choose('food', v.id, v.name[lang]);
                      if (owned('food', v.id)) setFamily(null);
                    }}
                  >
                    <CharCanvas profile={{ ...profile, food: v.id, selfie: undefined, hat: 'aucun', acc: 'aucun' }} size={64} still />
                    <small>{taken ? (fr ? `Pris par ${takenFoods[v.id]}` : `Taken by ${takenFoods[v.id]}`) : v.id === family ? (fr ? 'Normal' : 'Original') : v.name[lang]}</small>
                    {lock('food', v.id)}
                  </button>
                );
              })}
            </div>
            <button className="btn" onClick={() => setFamily(null)}>{fr ? 'Fermer' : 'Close'}</button>
          </div>
        </div>
      )}
      {tab === 'hat' && (
        <div className="pick-grid">
          {byRarity('hat', HATS).map((h) => (
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
            {byRarity('acc', ACCS).map((a) => (
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
        {[...COLORS.filter((c) => !COLOR_ITEMS.some((x) => x.id === c)), ...COLOR_ITEMS.map((x) => x.id)].map((c) => {
          const item = COLOR_ITEMS.find((x) => x.id === c);
          const mine = owned('color', c);
          return (
            <button
              key={c}
              className={`dot ${profile.color === c ? 'on' : ''} ${mine ? '' : 'dot-locked'}`}
              style={{ background: c, ...(item ? { outline: `3px solid ${RARITIES[rarityOf(itemKey('color', c))!].color}`, outlineOffset: 2 } : {}) }}
              disabled={taken.includes(c)}
              onClick={() => choose('color', c, item?.name[lang] ?? c)}
              aria-label={item?.name[lang] ?? c}
            >
              {!mine && '🔒'}
            </button>
          );
        })}
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
            <ItemPreview item={itemKey(buying.kind, buying.id)} profile={profile} size={120} />
            <b>{buying.name}</b>
            {(() => {
              const r = rarityOf(itemKey(buying.kind, buying.id));
              if (!r) return null;
              const where = levelOf(itemKey(buying.kind, buying.id)) || seasonOf(itemKey(buying.kind, buying.id)) ? [] : boxesNow().filter((b) => !b.season && b.odds[r]).map((b) => b.name[lang]);
              return (
                <>
                  <em className="rar-pill" style={{ background: RARITIES[r].color }}>{RARITIES[r].name[lang]}</em>
                  {where.length > 0 && <p className="buy-where">🎁 {fr ? 'À gagner dans' : 'Win it in'} : {where.join(', ')}</p>}
                </>
              );
            })()}
            {(buying.kind === 'winsound' || buying.kind === 'entry') && (
              <button className="btn alt" onClick={() => playItem(itemKey(buying.kind, buying.id), profile)}>
                🔊 {fr ? 'Écouter' : 'Listen'}
              </button>
            )}
            {(() => {
              const it = PRICES[itemKey(buying.kind, buying.id)];
              // Collection payante : ventes ouvertes, elle s'achète ; sinon on la teste avec des bonbons
              if (SALES_ON && it.coll)
                return (
                  <ProductCard
                    id={it.coll}
                    lang={lang}
                    signedIn={!!account.user}
                    connect={account.connect}
                    onGot={(bought) => {
                      account.gotItem(it.coll!, bought);
                      setBuying(null);
                    }}
                    onClose={() => setBuying(null)}
                  />
                );
              if (it.level) return <p className="buy-info">🔒 {fr ? `Se débloque tout seul au niveau ${it.level}` : `Unlocks by itself at level ${it.level}`}</p>;
              if (!it.price) return <p className="buy-info">{fr ? 'Trop rare pour être vendu : seulement dans les boîtes.' : 'Too rare to be sold: boxes only.'}</p>;
              const sea = seasonOf(itemKey(buying.kind, buying.id));
              if (sea && currentSeason()?.id !== sea.id) return <p className="pad-small">{sea.emoji} {fr ? `Collection ${sea.name.fr} : revient le ${seasonStart(sea, 'fr')}.` : `${sea.name.en} collection: back on ${seasonStart(sea, 'en')}.`}</p>;
              if (progress.coins < it.price) return <p className="pad-small">{t(lang, 'needCoins', { n: it.price - progress.coins })}</p>;
              return (
                <button className="buy-now" onClick={buy}>
                  {fr ? 'Acheter' : 'Buy'} <b>{it.price} 🍬</b>
                </button>
              );
            })()}
            {!(SALES_ON && PRICES[itemKey(buying.kind, buying.id)]?.coll) && (
              <button className="btn ghost" onClick={() => setBuying(null)}>
                {t(lang, 'back')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
