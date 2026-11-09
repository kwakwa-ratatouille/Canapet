import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Help } from './pages/Help';
import { Home } from './pages/Home';
import { Legal, isLegal } from './pages/Legal';
import { Relay } from './pages/Relay';
import { Site } from './pages/Site';
import { googleReturn } from './shared/cloud';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/unbounded/800.css';
import '@fontsource/unbounded/900.css';
import './tokens.css';
import './styles.css';
import './y2k.css';

// Après une mise à jour du site, une page restée ouverte réclame des morceaux qui n'existent plus :
// on recharge alors la page une fois (pas plus d'une fois par minute, pour ne jamais tourner en boucle).
function reloadOnce(): boolean {
  try {
    const last = +(sessionStorage.getItem('canapet.reload') || 0);
    if (Date.now() - last < 60000) return false;
    sessionStorage.setItem('canapet.reload', String(Date.now()));
  } catch {
    /* stockage bloqué : on recharge quand même */
  }
  location.reload();
  return true;
}
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  reloadOnce();
});
function load<T>(get: () => Promise<T>): Promise<T> {
  return get().catch((err) => {
    // Nouvelle version en ligne : on recharge, sinon on laisse l'écran « Oups » s'afficher
    if (reloadOnce()) return new Promise<T>(() => {});
    throw err;
  });
}

// La télé (tous les jeux) et la manette sont chargées à part : le téléphone ne télécharge pas le code des jeux.
const TvApp = lazy(() => load(() => import('./tv/TvApp')).then((m) => ({ default: m.TvApp })));
const PadApp = lazy(() => load(() => import('./pad/PadApp')).then((m) => ({ default: m.PadApp })));
const PhoneHost = lazy(() => load(() => import('./tv/PhoneHost')).then((m) => ({ default: m.PhoneHost })));

/** Si quelque chose casse, on affiche un message et un bouton au lieu d'une page blanche. */
class Oops extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  componentDidCatch(e: unknown) {
    console.error('Cana’pet :', e);
  }
  render() {
    if (!this.state.err) return this.props.children;
    const fr = !navigator.language.startsWith('en');
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center', fontFamily: 'Fredoka, sans-serif', color: '#3a2140', background: '#fff1f8' }}>
        <div style={{ fontSize: 64 }}>🛋️💨</div>
        <b style={{ fontSize: 26 }}>{fr ? 'Oups, la page a calé !' : 'Oops, the page got stuck!'}</b>
        <span style={{ fontSize: 18, maxWidth: 320 }}>{fr ? 'Le site vient sûrement d’être mis à jour. Recharge pour avoir la nouvelle version.' : 'The site was probably just updated. Reload to get the new version.'}</span>
        <button className="btn big" onClick={() => location.reload()}>
          {fr ? '🔄 Recharger' : '🔄 Reload'}
        </button>
      </div>
    );
  }
}

// Navigation par « # » : marche sur GitHub Pages, Chromecast et l'appli PC sans réglage serveur.
function parse() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
}

// Retour de la connexion Google (lu une seule fois : l'adresse est nettoyée aussitôt)
const fromGoogle = googleReturn();

function App() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [page, arg] = route.parts;
  if (page === 'tv')
    return (
      <Suspense fallback={null}>
        <TvApp />
      </Suspense>
    );
  if (page === 'm' && arg) {
    const code = arg.toUpperCase().slice(0, 4);
    return (
      <Suspense fallback={null}>
        <PadApp key={code} code={code} demo={code === 'TEST' ? route.query.get('s') || 'lobby' : undefined} />
      </Suspense>
    );
  }
  if (page === 'hote')
    return (
      <Suspense fallback={null}>
        <PhoneHost />
      </Suspense>
    );
  if (page === 'aide') return <Help />;
  if (page === 'site') return <Site result={route.query.get('achat')} />;
  if (page && isLegal(page)) return <Legal page={page} />;
  if (fromGoogle && !route.parts.length) return <Relay id={fromGoogle.id} k={fromGoogle.k} back={fromGoogle} />;
  if (page === 'relais-google') return <Relay id={route.query.get('id') ?? ''} k={route.query.get('k') ?? ''} here={route.query.has('ici')} />;
  return <Home />;
}

createRoot(document.getElementById('root')!).render(
  <Oops>
    <App />
  </Oops>,
);
