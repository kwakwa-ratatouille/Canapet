import { useState } from 'react';
import { CharCanvas } from '../shared/CharCanvas';
import { CODE_LETTERS, type Lang } from '../shared/protocol';
import { save, store, IS_PHONE } from '../shared/device';
import { defaultLang, t } from '../shared/i18n';

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
    <a className="home-card tv-card" href="#/tv">
      <h2>📺 {t(lang, 'tvBtn')}</h2>
      <p>{t(lang, 'tvBtnSub')}</p>
    </a>
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
      <h1 className="logo">
        Cana<span>’</span>pet
      </h1>
      <p className="home-tag">{t(lang, 'tagline')}</p>
      <div className="home-cards">
        {IS_PHONE ? (
          <>
            {join}
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
