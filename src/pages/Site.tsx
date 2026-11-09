import { CharCanvas } from '../shared/CharCanvas';
import { gameIcon, Wordmark } from '../shared/Logo';
import { useEffect, useRef, useState } from 'react';
import { createCheckout, loadItems, signIn, watchUser, type CloudUser } from '../shared/cloud';
import { IS_NATIVE } from '../shared/native';
import { COLLECTIONS, FREE_PLAYERS, KEY_PACKS, KEYS_ALLOWED, PACKS, PASS, PASS_GIFT, SALES_ON, WEB_PRICE } from '../shared/offer';
import { store } from '../shared/device';
import { defaultLang } from '../shared/i18n';
import type { Lang, Profile } from '../shared/protocol';
import { LegalLinks } from './Legal';
import './site.css';

const BUY_AFTER = 'buy-after';

const GAMES: [string, string, string][] = [
  ['duos', 'Les Inséparables', 'The Inseparables'],
  ['sondage', 'Le Sondage du Salon', 'The Couch Survey'],
  ['motus', 'Mot en Couleurs', 'Colour Word'],
  ['longmot', 'Le Mot le Plus Long', 'The Longest Word'],
  ['meme', 'Le Mème Mystère', 'Mystery Meme'],
  ['tribunal', 'Le Tribunal du Canapé', 'Couch Court'],
  ['dico', 'Le Petit Bobard Illustré', 'The Oxford Fibber'],
  ['lettre', 'Ça Commence Par…', 'Starts With…'],
  ['trous', 'Les Mots à Trous', 'Words With Holes'],
  ['tranche', 'Tranche de Rire', 'Slice of Laughs'],
  ['chef', 'Code Canapé', 'Couch Code'],
  ['fusion', 'La Bataille des Fusions', 'Merge Battle'],
  ['traverse', 'Traverse Pas Ici !', 'Don’t Cross Here!'],
  ['tour', 'La Tour Branlante', 'The Wobbly Tower'],
  ['gateau', 'Le Gâteau qui Penche', 'The Leaning Cake'],
  ['plutot', 'Le Pire des Deux', 'Worst of Two'],
  ['chiffre', 'Le Juste Pif', 'Nose for Numbers'],
  ['cri', 'Crie Plus Fort', 'Shout Louder'],
  ['karaoke', 'Le Karaoké Bidon', 'Fake Karaoke'],
  ['doublage', 'Le Doublage', 'The Dub'],
  ['imite', 'Le Grand Bruiteur', 'The Great Noisemaker'],
  ['casse', 'Le Téléphone Cassé', 'Broken Telephone'],
  ['trappe', 'Questions pour un Trou', 'Who Wants to Fall?'],
  ['gribouillis', 'Dessine-moi un Truc', 'Draw Me a Thing'],
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

/** Vente sur le site : compte Google, accord pour l'accès immédiat, puis paiement sur la page Stripe. */
function Buy({ id, lang, user, items }: { id: string; lang: Lang; user: CloudUser | null; items: string[] }) {
  const fr = lang === 'fr';
  // Revenu de la connexion Google dans le même onglet : on rouvre l'achat commencé
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(BUY_AFTER) === id;
    } catch {
      return false;
    }
  });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    try {
      if (localStorage.getItem(BUY_AFTER) !== id) return;
      localStorage.removeItem(BUY_AFTER);
    } catch {
      return;
    }
    box.current?.scrollIntoView({ block: 'center' });
  }, [open, id]);
  const connect = () => {
    try {
      localStorage.setItem(BUY_AFTER, id);
    } catch {
      /* rien */
    }
    signIn().catch(() => setMsg(fr ? 'Connexion impossible, réessaie.' : 'Could not sign in, try again.'));
  };
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!SALES_ON || IS_NATIVE) return null;
  if (items.includes(id)) return <p className="site-owned">✅ {fr ? 'Déjà à toi' : 'Yours already'}</p>;
  if (!open)
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        🛒 {fr ? 'Acheter' : 'Buy'} {WEB_PRICE(id)}
      </button>
    );
  const pay = () => {
    setBusy(true);
    setMsg('');
    createCheckout(id, consent)
      .then((url) => location.assign(url))
      .catch(() => {
        setMsg(fr ? 'Le paiement n’a pas pu s’ouvrir, réessaie.' : 'Payment could not open, try again.');
        setBusy(false);
      });
  };
  return (
    <div className="site-buy" ref={box}>
      {!user ? (
        <>
          <p>{fr ? 'Connecte-toi : l’achat ira sur ton compte Google, sur tous tes appareils.' : 'Sign in: the purchase goes on your Google account, on all your devices.'}</p>
          <button className="btn mint" onClick={connect}>
            {fr ? 'Se connecter avec Google' : 'Sign in with Google'}
          </button>
        </>
      ) : (
        <>
          <label>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{fr ? 'Je veux l’accès tout de suite et je renonce à mon droit de rétractation de 14 jours pour ce contenu numérique.' : 'I want access right away and I give up my 14-day right of withdrawal for this digital content.'}</span>
          </label>
          <button className="btn mint" disabled={!consent || busy} onClick={pay}>
            {busy ? '…' : `${fr ? 'Commander et payer' : 'Order and pay'} ${WEB_PRICE(id)}`}
          </button>
          <p className="pad-small">
            <a href="#/conditions" target="_blank" rel="noreferrer">{fr ? 'Lire les conditions de vente' : 'Read the terms of sale'}</a>
            <br />
            {fr ? 'Paiement sécurisé par Stripe : nous ne voyons jamais ta carte. Le reçu arrive par e-mail.' : 'Secure payment by Stripe: we never see your card. The receipt comes by e-mail.'}
          </p>
        </>
      )}
      {msg && <p className="pad-small uc-note">{msg}</p>}
    </div>
  );
}

/** Vitrine du jeu : mignonne, simple, et les prix bien visibles. */
export function Site({ result }: { result?: string | null }) {
  const lang: Lang = store('profile', { lang: defaultLang() }).lang ?? defaultLang();
  const fr = lang === 'fr';
  const T = (a: string, b: string) => (fr ? a : b);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    if (!SALES_ON) return;
    return watchUser((u) => {
      setUser(u);
      setItems([]);
      if (!u) return;
      const read = () => loadItems(u.uid).then(setItems).catch(() => {});
      void read();
      // Retour du paiement : Stripe prévient le serveur quelques secondes après
      if (result === 'ok') [3000, 8000, 15000].forEach((ms) => setTimeout(read, ms));
    });
  }, [result]);
  return (
    <div className="site">
      {result === 'ok' && <p className="site-note">🎉 {T('Merci ! Ton achat arrive sur ton compte dans quelques secondes, et ton reçu par e-mail. Reconnecte ta manette si besoin.', 'Thank you! Your purchase reaches your account in a few seconds, and your receipt by e-mail. Reconnect your controller if needed.')}</p>}
      {result === 'annule' && <p className="site-note">{T('Paiement annulé : tu n’as rien payé.', 'Payment cancelled: you paid nothing.')}</p>}
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
        <h2>{T('37 jeux pour toutes les soirées', '37 games for every party')}</h2>
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
            <p>{T(`8 jeux, un jeu offert chaque jour, jusqu’à ${FREE_PLAYERS} joueurs, des boîtes à gagner en jouant. Sans pub.`, `8 games, a free game every day, up to ${FREE_PLAYERS} players, boxes to earn by playing. No ads.`)}</p>
          </div>
          <div className="site-card star">
            <i>🎟️</i>
            <b>{T('Pass Soirée · 3,99 €', 'Party Pass · €3.99')}</b>
            <p>{T(`Une seule personne l’achète, tout le salon joue à tous les jeux, jusqu’à 12 joueurs. Avec ${PASS_GIFT} bonbons.`, `One person buys it, the whole room plays every game, up to 12 players. With ${PASS_GIFT} candies.`)}</p>
            <Buy id={PASS} lang={lang} user={user} items={items} />
          </div>
        </div>
        <h3>{T('Packs de questions · 1,99 €', 'Question packs · €1.99')}</h3>
        <div className="site-items">
          {PACKS.map((p) => (
            <div className="site-item" key={p.id}>
              <i>{p.emoji}</i>
              <b>{p.name[lang]}</b>
              <p>{p.desc[lang]}</p>
              <Buy id={p.id} lang={lang} user={user} items={items} />
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
              <Buy id={p.id} lang={lang} user={user} items={items} />
            </div>
          ))}
        </div>
        {KEYS_ALLOWED && (
          <>
            <h3>{T('Clés du coffre', 'Chest keys')}</h3>
            <p>{T('Une clé ouvre un Coffre : légendaire 88 %, mythique 12 %, mythique garanti au plus tard au 8e. Jamais de doublon. Style uniquement, aucun avantage en jeu. Les gains ne se revendent pas.', 'A key opens a Chest: legendary 88%, mythic 12%, mythic guaranteed by the 8th at the latest. Never a duplicate. Style only, no in-game advantage. Prizes cannot be resold.')}</p>
            <div className="site-items">
              {KEY_PACKS.map((p) => (
                <div className="site-item" key={p.id}>
                  <i>{p.emoji}</i>
                  <b>{p.name[lang]} · {WEB_PRICE(p.id)}</b>
                  <Buy id={p.id} lang={lang} user={user} items={items} />
                </div>
              ))}
            </div>
          </>
        )}
        {!SALES_ON && <p className="site-soon">{T('🚧 Les achats arrivent bientôt. Pour l’instant, tout est ouvert : profitez-en !', '🚧 Purchases are coming soon. For now, everything is open: enjoy!')}</p>}
      </section>

      <footer className="site-foot">
        <a href="#/aide">{T('Aide pour lancer le jeu sur la télé', 'Help starting the game on a TV')}</a>
        <LegalLinks lang={lang} />
      </footer>
    </div>
  );
}
