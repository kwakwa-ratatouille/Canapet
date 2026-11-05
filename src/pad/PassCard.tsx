import { useEffect, useState } from 'react';
import { IS_NATIVE, IS_PLAY } from '../shared/native';
import { buyProduct, productPrice, restoreProduct } from '../shared/billing';
import { FREE_GAMES, PASS, PASS_GIFT, productById } from '../shared/offer';
import type { Lang } from '../shared/protocol';

/** Présentation d'un achat (Pass, pack, collection) : par Google Play, avec un compte connecté pour le retrouver partout. */
export function ProductCard({ id, lang, signedIn, connect, onGot, onClose }: { id: string; lang: Lang; signedIn: boolean; connect: () => void; onGot: (bought: boolean) => void; onClose: () => void }) {
  const fr = lang === 'fr';
  const product = productById(id)!;
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (IS_PLAY) productPrice(id).then(setPrice).catch(() => {});
  }, [id]);
  const run = (act: (id: string) => Promise<boolean>, bought: boolean) => {
    setBusy(true);
    setMsg('');
    act(id)
      .then((ok) => {
        if (ok) onGot(bought);
        else setMsg(fr ? 'Aucun achat trouvé sur ce compte Google Play.' : 'No purchase found on this Google Play account.');
      })
      .catch((e: { message?: string }) => {
        const c = e?.message ?? '';
        if (c.includes('annule')) return;
        setMsg(c.includes('attente') ? (fr ? 'Paiement en attente : ton achat arrivera une fois payé.' : 'Payment pending: your purchase arrives once paid.') : fr ? 'Ça n’a pas marché. Réessaie, ou touche « Je l’ai déjà acheté » si Google a confirmé le paiement.' : 'That didn’t work. Try again, or tap “I already bought it” if Google confirmed the payment.');
      })
      .finally(() => setBusy(false));
  };
  return (
    <div className="pad-body top pass-card">
      <h2>{product.emoji} {product.name[lang]}</h2>
      <p>{product.desc[lang]}</p>
      {id === PASS && (
        <ul>
          <li>🎮 {fr ? `Tous les jeux, en plus des ${FREE_GAMES.length} gratuits` : `All games, on top of the ${FREE_GAMES.length} free ones`}</li>
          <li>👥 {fr ? 'Jusqu’à 12 joueurs au lieu de 6' : 'Up to 12 players instead of 6'}</li>
          <li>🏆 {fr ? 'Le tournoi avec tout le catalogue' : 'Tournaments with the whole catalogue'}</li>
          <li>🍬 {fr ? `${PASS_GIFT} bonbons offerts` : `${PASS_GIFT} free candies`}</li>
        </ul>
      )}
      {id.startsWith('pack_') && <p className="pad-small">{fr ? 'Un seul achat : tout le salon en profite quand tu joues.' : 'One purchase: the whole room enjoys it when you play.'}</p>}
      {id.startsWith('coll_') && <p className="pad-small">{fr ? 'Pour le style seulement : aucun avantage dans les jeux.' : 'Just for style: no advantage in games.'}</p>}
      {!IS_PLAY ? (
        IS_NATIVE ? (
          <p className="pad-small">{fr ? 'À acheter depuis un navigateur, sur le site de Cana’pet, avec ton compte Google.' : 'Buy it from a browser, on the Cana’pet site, with your Google account.'}</p>
        ) : (
          <a className="btn big mint" href="#/site" target="_blank" rel="noreferrer">
            🛒 {fr ? 'Acheter sur le site' : 'Buy on the site'}
          </a>
        )
      ) : !signedIn ? (
        <>
          <p className="pad-small">{fr ? 'Connecte-toi d’abord pour retrouver ton achat sur tes téléphones.' : 'Sign in first to keep your purchase across phones.'}</p>
          <button className="btn big mint" onClick={connect}>
            {fr ? 'Se connecter avec Google' : 'Sign in with Google'}
          </button>
        </>
      ) : (
        <>
          <button className="btn big mint" disabled={busy || !price} onClick={() => run(buyProduct, true)}>
            {busy ? '…' : `${fr ? 'Acheter' : 'Buy'} ${price}`}
          </button>
          <button className="btn alt" disabled={busy} onClick={() => run(restoreProduct, false)}>
            {fr ? 'Je l’ai déjà acheté' : 'I already bought it'}
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
