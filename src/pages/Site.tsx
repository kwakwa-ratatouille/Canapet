import { CharCanvas } from '../shared/CharCanvas';
import { gameIcon, Wordmark } from '../shared/Logo';
import { COLLECTIONS, PACKS, PASS_GIFT } from '../shared/offer';
import { store } from '../shared/device';
import { defaultLang } from '../shared/i18n';
import type { Lang, Profile } from '../shared/protocol';
import { LegalLinks } from './Legal';
import './site.css';

const GAMES: [string, string, string][] = [
  ['tribunal', 'Le Tribunal', 'The Tribunal'],
  ['dico', 'Le Dico Bidon', 'The Bogus Dictionary'],
  ['plutot', 'Plutôt Ça', 'Rather This'],
  ['chiffre', 'Le Bon Chiffre', 'The Right Number'],
  ['trappe', 'La Trappe', 'The Trapdoor'],
  ['gribouillis', 'Gribouillis', 'Scribbles'],
  ['mini-bolides', 'Mini Bolides', 'Mini Racers'],
  ['coussin-clash', 'Coussin Clash', 'Cushion Clash'],
  ['sumo-tamponneur', 'Sumo Tamponneur', 'Bumper Sumo'],
  ['petards-mouilles', 'Pétards Mouillés', 'Soggy Crackers'],
  ['le-bar-des-bobards', 'Le Bar des Bobards', 'The Fibbers’ Bar'],
  ['la-degringolade', 'La Dégringolade', 'The Tumble'],
];

const CAST: Partial<Profile>[] = [
  { food: 'tartine', color: '#ff4f9a', hat: 'couronne', acc: 'aucun' },
  { food: 'cornichon', color: '#7bd13b', hat: 'cowboy', acc: 'soleil' },
  { food: 'pizza', color: '#ffd60a', hat: 'fete', acc: 'aucun' },
  { food: 'nuage', color: '#2ec5ff', hat: 'licorne', acc: 'rougir' },
  { food: 'banane', color: '#9b5cff', hat: 'pere', acc: 'echarpe' },
];

/** Vitrine du jeu : mignonne, simple, et les prix bien visibles. */
export function Site() {
  const lang: Lang = store('profile', { lang: defaultLang() }).lang ?? defaultLang();
  const fr = lang === 'fr';
  const T = (a: string, b: string) => (fr ? a : b);
  return (
    <div className="site">
      <header className="site-hero">
        <Wordmark className="home-wordmark" />
        <h1>{T('Ton salon devient une soirée de jeux.', 'Your living room becomes a game night.')}</h1>
        <p>{T('La télé affiche le jeu, chaque téléphone devient une manette. Rien à installer pour tes amis. Jusqu’à 12 joueurs.', 'The TV shows the game, every phone becomes a controller. Nothing for your friends to install. Up to 12 players.')}</p>
        <div className="site-cast">
          {CAST.map((c, i) => (
            <span key={i} style={{ ['--d' as string]: `${i * 0.25}s` }}>
              <CharCanvas profile={{ name: '', lang, ...c } as Profile} size={110} />
            </span>
          ))}
        </div>
        <div className="site-cta">
          <a className="btn big" href="#/tv">
            📺 {T('Lancer sur cet écran', 'Start on this screen')}
          </a>
          <a className="btn big mint" href="#/">
            📱 {T('Rejoindre une partie', 'Join a game')}
          </a>
        </div>
      </header>

      <section>
        <h2>{T('Comment ça marche', 'How it works')}</h2>
        <div className="site-steps">
          {[
            ['📺', T('Ouvre le jeu', 'Open the game'), T('Sur une télé, ou un ordinateur branché à la télé.', 'On a TV, or a computer plugged into the TV.')],
            ['📱', T('Scanne le code', 'Scan the code'), T('Chacun scanne le QR code avec son téléphone.', 'Everyone scans the QR code with their phone.')],
            ['🎉', T('Jouez !', 'Play!'), T('Crée ton perso rigolo et choisis un jeu ou un tournoi.', 'Make your funny character and pick a game or a tournament.')],
          ].map(([ico, h, p]) => (
            <div className="site-card" key={h}>
              <i>{ico}</i>
              <b>{h}</b>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>{T('28 jeux pour toutes les soirées', '28 games for every party')}</h2>
        <div className="site-games">
          {GAMES.map(([slug, a, b]) => (
            <div key={slug}>
              <img src={gameIcon(slug)} alt="" loading="lazy" />
              <b>{T(a, b)}</b>
            </div>
          ))}
        </div>
      </section>

      <section id="boutique">
        <h2>{T('Gratuit pour commencer', 'Free to start')}</h2>
        <div className="site-steps">
          <div className="site-card">
            <i>🎮</i>
            <b>{T('Gratuit', 'Free')}</b>
            <p>{T('8 jeux, un jeu offert chaque jour, des tenues à gagner en jouant. Sans pub.', '8 games, a free game every day, outfits to earn by playing. No ads.')}</p>
          </div>
          <div className="site-card star">
            <i>🎟️</i>
            <b>{T('Pass Soirée · 3,99 €', 'Party Pass · €3.99')}</b>
            <p>{T(`Une seule personne l’achète, tout le salon joue à tous les jeux. Avec ${PASS_GIFT} bonbons.`, `One person buys it, the whole room plays every game. With ${PASS_GIFT} candies.`)}</p>
          </div>
        </div>
        <h3>{T('Packs de questions · 1,99 €', 'Question packs · €1.99')}</h3>
        <div className="site-items">
          {PACKS.map((p) => (
            <div className="site-item" key={p.id}>
              <i>{p.emoji}</i>
              <b>{p.name[lang]}</b>
              <p>{p.desc[lang]}</p>
            </div>
          ))}
        </div>
        <h3>{T('Collections de tenues · 1,99 €', 'Outfit collections · €1.99')}</h3>
        <div className="site-items">
          {COLLECTIONS.map((p) => (
            <div className="site-item" key={p.id}>
              <i>{p.emoji}</i>
              <b>{p.name[lang]}</b>
              <p>{p.desc[lang]}</p>
            </div>
          ))}
        </div>
        <p className="site-soon">{T('🚧 Les achats arrivent bientôt dans l’appli Android. Pour l’instant, tout est ouvert : profitez-en !', '🚧 Purchases are coming soon in the Android app. For now, everything is open: enjoy!')}</p>
      </section>

      <footer className="site-foot">
        <a href="#/aide">{T('Aide pour lancer le jeu sur la télé', 'Help starting the game on a TV')}</a>
        <LegalLinks lang={lang} />
      </footer>
    </div>
  );
}
