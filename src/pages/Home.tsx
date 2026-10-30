import { useEffect, useState } from 'react';
import { castAndGetCode, loadCast } from '../shared/cast';
import { CharCanvas } from '../shared/CharCanvas';
import { Wordmark } from '../shared/Logo';
import { CODE_LETTERS, type Lang } from '../shared/protocol';
import { save, store, IS_PHONE } from '../shared/device';
import { defaultLang, t } from '../shared/i18n';
import { ANDROID_APK_URL, IOS_IPA_URL, IOS_SOURCE_URL, IS_INSTALLED, IS_NATIVE, PLATFORM } from '../shared/native';
import { loadCloud, merge, preload, saveCloud, signIn, signOut, watchUser, type CloudUser } from '../shared/cloud';
import { levelInfo, loadProgress, saveProgress } from '../shared/progress';
import { GoogleLogo } from '../shared/GoogleLogo';

export const PC_APP_URL = 'https://github.com/kwakwa-ratatouille/Canapet/releases/download/pc-latest/Canapet-Setup.exe';
const IN_APP = /Electron/.test(navigator.userAgent);

const MASCOTS = [
  { food: 'coussin', color: '#ff4f9a', hat: 'couronne', acc: 'aucun' },
  { food: 'cornichon', color: '#2ec5ff', hat: 'casquette', acc: 'soleil' },
  { food: 'cupcake', color: '#ffd60a', hat: 'aucun', acc: 'moustache' },
  { food: 'tartine', color: '#9b5cff', hat: 'haut', acc: 'monocle' },
];

/** Compte Google sur l'accueil : connexion, et la progression du téléphone fusionnée avec celle du compte. */
function AccountCard({ lang }: { lang: Lang }) {
  const fr = lang === 'fr';
  const [user, setUser] = useState<CloudUser | null>(null);
  const [state, setState] = useState<'off' | 'busy' | 'ok' | 'error'>('off');
  const [on, setOn] = useState(() => store('cloud', false));
  useEffect(() => {
    if (!on) return void preload();
    return watchUser((u) => {
      setUser(u);
      if (!u) return setState('off');
      setState('busy');
      loadCloud(u.uid)
        .then((remote) => {
          const p = merge(loadProgress(), remote);
          saveProgress(p);
          return saveCloud(u.uid, p);
        })
        .then(() => setState('ok'))
        .catch(() => setState('error'));
    });
  }, [on]);
  const connect = () => {
    save('cloud', true);
    setOn(true);
    setState('busy');
    signIn().catch(() => setState('error'));
  };
  const lv = levelInfo(loadProgress().xp).level;
  return (
    <div className="home-card account-card">
      <h2>👤 {fr ? 'Mon compte' : 'My account'}</h2>
      {user ? (
        <div className="cloud-row">
          {user.photo ? <img src={user.photo} alt="" referrerPolicy="no-referrer" /> : <span className="cloud-ini">{user.name.slice(0, 1)}</span>}
          <span>
            {state === 'error' ? t(lang, 'cloudError') : state === 'busy' ? t(lang, 'cloudBusy') : `${user.name.split(' ')[0]} · ${fr ? 'Niv.' : 'Lv.'} ${lv}`}
          </span>
          <button onClick={() => void signOut()}>{t(lang, 'signOut')}</button>
        </div>
      ) : (
        <>
          <p>{fr ? 'Garde ton niveau, tes bonbons et tes objets, même en changeant de téléphone.' : 'Keep your level, candies and items, even on a new phone.'}</p>
          <button className="google-btn" onClick={connect} disabled={state === 'busy'}>
            <GoogleLogo />
            <span>{state === 'busy' ? t(lang, 'cloudBusy') : state === 'error' ? t(lang, 'cloudError') : fr ? 'Se connecter avec Google' : 'Sign in with Google'}</span>
          </button>
          {state === 'busy' && IS_NATIVE && <p className="pad-small">{fr ? 'Connecte-toi dans la page qui s’ouvre, puis reviens ici.' : 'Sign in on the page that opens, then come back here.'}</p>}
        </>
      )}
    </div>
  );
}

export function Home() {
  const [lang, setLang] = useState<Lang>(() => store('profile', { lang: defaultLang() }).lang ?? defaultLang());
  const [code, setCode] = useState('');
  const valid = code.length === 4;
  const go = () => valid && (location.hash = `#/m/${code}`);
  const [canCast, setCanCast] = useState(false);
  const [castMsg, setCastMsg] = useState('');
  useEffect(() => {
    void loadCast().then(setCanCast);
  }, []);
  const startCast = async () => {
    setCastMsg(t(lang, 'casting'));
    try {
      const c = await castAndGetCode();
      location.hash = `#/m/${c}`;
    } catch {
      setCastMsg(t(lang, 'castFail'));
    }
  };
  const fr = lang === 'fr';
  const install = IS_PHONE && !IS_INSTALLED && (
    <div className="home-card install-card">
      <h2>📲 {fr ? 'Installer l’appli' : 'Install the app'}</h2>
      <p>{fr ? 'Plein écran, sans la barre d’adresse : la manette est plus grande.' : 'Full screen, no address bar: a bigger controller.'}</p>
      {PLATFORM === 'android' && (
        <div className="row">
          <a className="btn" href={ANDROID_APK_URL}>
            🤖 {fr ? 'Appli Android' : 'Android app'}
          </a>
        </div>
      )}
      {PLATFORM === 'android' && (
        <p className="pad-small">
          {fr
            ? 'L’appli Android pioche elle-même les photos de Photo Roulette. Android demandera d’autoriser l’installation : accepte.'
            : 'The Android app picks Photo Roulette pictures by itself. Android will ask to allow the install: accept.'}
        </p>
      )}
      {PLATFORM === 'ios' && (
        <p className="pad-small">
          {fr ? '🍏 Appli iPhone : télécharge ' : '🍏 iPhone app: download '}
          <a href={IOS_IPA_URL}>Canapet.ipa</a>
          {fr
            ? ' ou ajoute la source SideStore (mises à jour automatiques) : '
            : ' or add the SideStore source (automatic updates): '}
          <a href={IOS_SOURCE_URL}>sidestore.json</a>
          {fr ? '. Sinon, plus simple :' : '. Or, simpler:'}
        </p>
      )}
      {PLATFORM === 'ios' && (
        <p>
          {fr ? 'Dans Safari : touche ' : 'In Safari: tap '}
          <b>{fr ? 'Partager ⬆️' : 'Share ⬆️'}</b>
          {fr ? ' puis ' : ' then '}
          <b>{fr ? '« Sur l’écran d’accueil »' : '“Add to Home Screen”'}</b>.
        </p>
      )}
    </div>
  );
  const switchLang = (l: Lang) => {
    setLang(l);
    const p = store<Record<string, unknown>>('profile', {});
    save('profile', { ...p, lang: l });
  };

  const join = (
    <div className="home-card join">
      <h2>📱 {t(lang, 'joinBtn')}</h2>
      <p>{t(lang, 'joinSub')}</p>
      <div className="row">
        <input
          className="code-input"
          value={code}
          inputMode="text"
          autoCapitalize="characters"
          maxLength={4}
          placeholder="ABCD"
          onChange={(e) =>
            setCode(
              e.target.value
                .toUpperCase()
                .split('')
                .filter((c) => CODE_LETTERS.includes(c))
                .join('')
                .slice(0, 4),
            )
          }
          onKeyDown={(e) => e.key === 'Enter' && go()}
        />
        <button className="btn" disabled={!valid} onClick={go}>
          {t(lang, 'join')}
        </button>
      </div>
    </div>
  );
  const tv = (
    <div className="home-card tv-card">
      <h2>📺 {t(lang, 'tvBtn')}</h2>
      <p>{t(lang, 'tvBtnSub')}</p>
      <div className="row">
        <a className="btn" href="#/tv">
          {t(lang, 'tvBtn')}
        </a>
        {canCast && (
          <button className="btn alt" onClick={startCast}>
            📡 {t(lang, 'castBtn')}
          </button>
        )}
      </div>
      {castMsg && <p className="cast-msg">{castMsg}</p>}
      {!IN_APP && !IS_PHONE && (
        <a className="pc-link" href={PC_APP_URL}>
          💻 <b>{t(lang, 'pcApp')}</b> · {t(lang, 'pcAppSub')}
        </a>
      )}
    </div>
  );

  // Dernière partie rejointe il y a moins de 4 h : bouton pour y revenir
  const last = store<{ code: string; at: number } | null>('lastGame', null);
  const back = last && Date.now() - last.at < 4 * 3600 * 1000 ? last.code : '';

  return (
    <div className="home">
      <div className="lang-switch">
        {(['fr', 'en'] as Lang[]).map((l) => (
          <button key={l} className={`pill ${l === lang ? 'on' : ''}`} onClick={() => switchLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="mascots">
        {MASCOTS.map((m, i) => (
          <CharCanvas key={i} profile={m} size={IS_PHONE ? 70 : 110} />
        ))}
      </div>
      <h1 className="sr-only">Cana’pet</h1>
      <Wordmark className="home-wordmark" />
      <p className="home-tag">{t(lang, 'tagline')}</p>
      {back && (
        <button className="btn big mint home-back" onClick={() => (location.hash = `#/m/${back}`)}>
          ↩️ {lang === 'fr' ? `Revenir dans la partie ${back}` : `Back to game ${back}`}
        </button>
      )}
      <div className="home-cards">
        {IS_PHONE ? (
          <>
            {join}
            <AccountCard lang={lang} />
            {install}
            {tv}
          </>
        ) : (
          <>
            {tv}
            {join}
          </>
        )}
      </div>
      <a className="home-help" href="#/aide">
        {t(lang, 'howTv')}
      </a>
    </div>
  );
}
