import { useEffect, useState } from 'react';
import { goGoogle, relayTokens, type googleReturn } from '../shared/cloud';
import { Wordmark } from '../shared/Logo';
import { store } from '../shared/device';
import { defaultLang } from '../shared/i18n';
import type { Lang } from '../shared/protocol';

// Page ouverte dans le vrai navigateur par l'appli (iPhone, Android, .exe) pour se connecter avec Google :
// le jeton est chiffré puis renvoyé à l'appli, qui se connecte toute seule. Il suffit ensuite d'y revenir.
// Aller : bouton → Google. Retour : Google revient sur le site avec le jeton (`back`), on le transmet.
// `here` : page ouverte dans le même onglet (fenêtre bloquée) → on connecte ce navigateur et on revient à l'accueil.
/** Connexion faite dans le même onglet : retour à la boutique si on en venait, sinon à l'accueil. */
function returnTo() {
  try {
    const h = localStorage.getItem('gauth-back') ?? '';
    localStorage.removeItem('gauth-back');
    if (h === '#/site' || h.startsWith('#/site?')) return h;
  } catch {
    /* rien */
  }
  return '#/';
}

export function Relay({ id, k, here = false, back }: { id: string; k: string; here?: boolean; back?: ReturnType<typeof googleReturn> }) {
  const lang = store<{ lang?: Lang }>('profile', {}).lang ?? defaultLang();
  const fr = lang === 'fr';
  const [state, setState] = useState<'wait' | 'busy' | 'done' | 'bad'>(id && k ? (back?.token ? 'busy' : 'wait') : 'bad');
  const [err, setErr] = useState(() =>
    !back?.error ? '' : back.error === 'access_denied' ? (fr ? 'Connexion annulée.' : 'Sign-in cancelled.') : fr ? 'Ça n’a pas marché, réessaie.' : 'That didn’t work, try again.',
  );
  useEffect(() => {
    if (!back?.token || !id || !k) return;
    relayTokens(id, k, back.token, back.here)
      .then(() => {
        setState('done');
        if (back.here) setTimeout(() => location.replace(location.pathname + returnTo()), 800);
        else setTimeout(() => window.close(), 1500);
      })
      .catch(() => {
        setErr(fr ? 'Ça n’a pas marché, réessaie.' : 'That didn’t work, try again.');
        setState('wait');
      });
  }, [back, id, k, fr]);
  const go = () => {
    setState('busy');
    goGoogle(id, k, back?.here ?? here);
  };
  return (
    <div className="home">
      <Wordmark className="home-wordmark" />
      <div className="home-cards">
        <div className="home-card">
          {state === 'done' ? (
            <>
              <h2>✅ {fr ? 'C’est bon !' : 'All set!'}</h2>
              <p>{fr ? 'Retourne sur Cana’pet (l’appli ou l’onglet d’avant) : tu y es déjà connecté. Tu peux fermer cette page.' : 'Go back to Cana’pet (the app or the previous tab): you’re already signed in. You can close this page.'}</p>
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
