import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Help } from './pages/Help';
import { Home } from './pages/Home';
import { Relay } from './pages/Relay';
import './tokens.css';
import './styles.css';

// La télé (tous les jeux) et la manette sont chargées à part : le téléphone ne télécharge pas le code des jeux.
const TvApp = lazy(() => import('./tv/TvApp').then((m) => ({ default: m.TvApp })));
const PadApp = lazy(() => import('./pad/PadApp').then((m) => ({ default: m.PadApp })));

// Navigation par « # » : marche sur GitHub Pages, Chromecast et l'appli PC sans réglage serveur.
function parse() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
}

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
  if (page === 'aide') return <Help />;
  if (page === 'relais-google') return <Relay id={route.query.get('id') ?? ''} k={route.query.get('k') ?? ''} />;
  return <Home />;
}

createRoot(document.getElementById('root')!).render(<App />);
