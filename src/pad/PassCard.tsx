import { useEffect, useState } from 'react';
import { IS_PLAY } from '../shared/native';
import { buyPass, passPrice, restorePass } from '../shared/billing';
import { FREE_GAMES, PASS_GIFT } from '../shared/offer';
import type { Lang } from '../shared/protocol';

/** Présentation du Pass Soirée : achat par Google Play, réservé à un compte connecté pour le retrouver partout. */
export function PassCard({ lang, signedIn, connect, onGot, onClose }: { lang: Lang; signedIn: boolean; connect: () => void; onGot: (bought: boolean) => void; onClose: () => void }) {
  const fr = lang === 'fr';
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (IS_PLAY) passPrice().then(setPrice).catch(() => {});
  }, []);
  const run = (act: () => Promise<boolean>, bought: boolean) => {
    setBusy(true);
    setMsg('');
    act()
      .then((ok) => {
        if (ok) onGot(bought);
        else setMsg(fr ? 'Aucun achat trouvé sur ce compte Google Play.' : 'No purchase found on this Google Play account.');
      })
      .catch((e: { message?: string }) => {
        const c = e?.message ?? '';
        if (c.includes('annule')) return;
        setMsg(c.includes('attente') ? (fr ? 'Paiement en attente : le Pass arrivera une fois payé.' : 'Payment pending: the Pass arrives once paid.') : fr ? 'Ça n’a pas marché. Tu n’as pas été débité si Google ne l’a pas confirmé. Réessaie.' : 'That didn’t work. You weren’t charged unless Google confirmed it. Try again.');
      })
      .finally(() => setBusy(false));
  };
  return (
    <div className="pad-body top pass-card">
      <h2>🎟️ {fr ? 'Pass Soirée' : 'Party Pass'}</h2>
      <p>{fr ? 'Un seul achat, une seule personne, et tout le salon en profite, à chaque soirée.' : 'One purchase, one person, and the whole room enjoys it, every party.'}</p>
      <ul>
        <li>🎮 {fr ? `Tous les jeux, en plus des ${FREE_GAMES.length} gratuits` : `All games, on top of the ${FREE_GAMES.length} free ones`}</li>
        <li>🏆 {fr ? 'Le tournoi avec tout le catalogue' : 'Tournaments with the whole catalogue'}</li>
        <li>🍬 {fr ? `${PASS_GIFT} bonbons offerts` : `${PASS_GIFT} free candies`}</li>
        <li>🚫 {fr ? 'Sans pub ni abonnement' : 'No ads, no subscription'}</li>
      </ul>
      {!IS_PLAY ? (
        <p className="pad-small">{fr ? 'Le Pass s’achète dans l’appli Android installée depuis Google Play.' : 'The Pass is sold in the Android app from Google Play.'}</p>
      ) : !signedIn ? (
        <>
          <p className="pad-small">{fr ? 'Connecte-toi d’abord pour retrouver ton Pass sur tes téléphones.' : 'Sign in first to keep your Pass across phones.'}</p>
          <button className="btn big mint" onClick={connect}>
            {fr ? 'Se connecter avec Google' : 'Sign in with Google'}
          </button>
        </>
      ) : (
        <>
          <button className="btn big mint" disabled={busy || !price} onClick={() => run(buyPass, true)}>
            {busy ? '…' : `${fr ? 'Acheter' : 'Buy'} ${price}`}
          </button>
          <button className="btn alt" disabled={busy} onClick={() => run(restorePass, false)}>
            {fr ? 'J’ai déjà acheté le Pass' : 'I already bought the Pass'}
          </button>
        </>
      )}
      {msg && <p className="pad-small uc-note">{msg}</p>}
      <button className="btn ghost" onClick={onClose}>
        {fr ? 'Plus tard' : 'Later'}
      </button>
    </div>
  );
}
