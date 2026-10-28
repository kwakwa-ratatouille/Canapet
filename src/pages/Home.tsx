import { useEffect, useState } from 'react';
import { castAndGetCode, loadCast } from '../shared/cast';
import { CharCanvas } from '../shared/CharCanvas';
import { Wordmark } from '../shared/Logo';
import { CODE_LETTERS, type Lang } from '../shared/protocol';
import { save, store, IS_PHONE } from '../shared/device';
import { defaultLang, t } from '../shared/i18n';
import { ANDROID_APK_URL, IOS_IPA_URL, IS_INSTALLED, PLATFORM } from '../shared/native';

export const PC_APP_URL = 'https://github.com/kwakwa-ratatouille/Canapet/releases/download/pc-latest/Canapet-Setup.exe';
const IN_APP = /Electron/.test(navigator.userAgent);

const MASCOTS = [
  { food: 'coussin', color: '#ff4f9a', hat: 'couronne', acc: 'aucun' },
  { food: 'cornichon', color: '#2ec5ff', hat: 'casquette', acc: 'soleil' },
  { food: 'cupcake', color: '#ffd60a', hat: 'aucun', acc: 'moustache' },
  { food: 'tartine', color: '#9b5cff', hat: 'haut', acc: 'monocle' },
];

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
          {fr ? ' sur ton PC et installe-la avec Sideloadly (gratuit). Sinon, plus simple :' : ' on your PC and install it with Sideloadly (free). Or, simpler:'}
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
      <div className="home-cards">
        {IS_PHONE ? (
          <>
            {join}
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
