import { useState } from 'react';
import { relayTokens } from '../shared/cloud';
import { Wordmark } from '../shared/Logo';
import { store } from '../shared/device';
import { defaultLang } from '../shared/i18n';
import type { Lang } from '../shared/protocol';

// Page ouverte dans le vrai navigateur par l'appli (iPhone, Android, .exe) pour se connecter avec Google :
// le jeton est chiffré puis renvoyé à l'appli, qui se connecte toute seule. Il suffit ensuite d'y revenir.
export function Relay({ id, k }: { id: string; k: string }) {
  const lang = store<{ lang?: Lang }>('profile', {}).lang ?? defaultLang();
  const fr = lang === 'fr';
  const [state, setState] = useState<'wait' | 'busy' | 'done' | 'bad'>(id && k ? 'wait' : 'bad');
  const [err, setErr] = useState('');
  const go = async () => {
    setState('busy');
    setErr('');
    try {
      await relayTokens(id, k);
      setState('done');
      setTimeout(() => window.close(), 1500);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setErr(code === 'auth/popup-closed-by-user' ? (fr ? 'Connexion annulée.' : 'Sign-in cancelled.') : fr ? 'Ça n’a pas marché, réessaie.' : 'That didn’t work, try again.');
      setState('wait');
    }
  };
  return (
    <div className="home">
      <Wordmark className="home-wordmark" />
      <div className="home-cards">
        <div className="home-card">
          {state === 'done' ? (
            <>
              <h2>✅ {fr ? 'C’est bon !' : 'All set!'}</h2>
              <p>{fr ? 'Retourne dans l’appli Cana’pet : tu y es déjà connecté. Tu peux fermer cette page.' : 'Go back to the Cana’pet app: you’re already signed in. You can close this page.'}</p>
            </>
          ) : state === 'bad' ? (
            <>
              <h2>{fr ? 'Lien incomplet' : 'Broken link'}</h2>
              <p>{fr ? 'Relance la connexion Google depuis l’appli.' : 'Start the Google sign-in again from the app.'}</p>
            </>
          ) : (
            <>
              <h2>🔑 {fr ? 'Connexion à l’appli' : 'Sign in to the app'}</h2>
              <p>{fr ? 'Connecte-toi avec Google ici, puis reviens dans l’appli : elle se connectera toute seule.' : 'Sign in with Google here, then go back to the app: it will sign in by itself.'}</p>
              {err && <p className="cast-msg">{err}</p>}
              <button className="btn big" onClick={go} disabled={state === 'busy'}>
                {state === 'busy' ? (fr ? 'Connexion…' : 'Connecting…') : fr ? 'Continuer avec Google' : 'Continue with Google'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
