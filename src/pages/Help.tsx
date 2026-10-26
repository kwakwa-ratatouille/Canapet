import { store } from '../shared/device';
import { defaultLang, t } from '../shared/i18n';
import type { Lang } from '../shared/protocol';

export function Help() {
  const lang: Lang = store('profile', { lang: defaultLang() }).lang ?? defaultLang();
  return (
    <div className="home help">
      <a className="pill" href="#/">
        ← {t(lang, 'back')}
      </a>
      <h1>{t(lang, 'helpTitle')}</h1>
      <div className="home-card">
        <h2>🖥️ {t(lang, 'helpPc')}</h2>
        <p>{t(lang, 'helpPcText')}</p>
      </div>
      <div className="home-card">
        <h2>📡 {t(lang, 'helpCast')}</h2>
        <p>{t(lang, 'helpCastText')}</p>
      </div>
      <div className="home-card">
        <h2>🍏 {t(lang, 'helpIphone')}</h2>
        <p>{t(lang, 'helpIphoneText')}</p>
      </div>
    </div>
  );
}
