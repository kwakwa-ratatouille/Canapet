import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PadApp } from './pad/PadApp';
import { Help } from './pages/Help';
import { Home } from './pages/Home';
import { TvApp } from './tv/TvApp';
import './styles.css';

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
  if (page === 'tv') return <TvApp />;
  if (page === 'm' && arg) {
    const code = arg.toUpperCase().slice(0, 4);
    return <PadApp key={code} code={code} demo={code === 'TEST' ? route.query.get('s') || 'lobby' : undefined} />;
  }
  if (page === 'aide') return <Help />;
  return <Home />;
}

createRoot(document.getElementById('root')!).render(<App />);
