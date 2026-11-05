// Serveur des achats : vérifie auprès de Google qu'un achat est réel, puis l'inscrit sur le compte du joueur.
// Le compte du serveur doit avoir accès à l'appli dans la console Google Play (voir store/google-play.md).
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Stripe = require('stripe');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { GoogleAuth } = require('google-auth-library');
const { createHash, randomInt } = require('crypto');

initializeApp();

const PACKAGE = 'com.canapet.app';
// Mêmes identifiants que dans src/shared/offer.ts et la console Google Play
const PRODUCTS = new Set(['pass_soiree', 'pack_couples', 'pack_famille', 'pack_boulot', 'pack_minuit', 'coll_noel', 'coll_halloween', 'coll_plage']);
// Clés du coffre : se consomment. Combien chaque pack en donne.
const KEY_PACKS = { keys_1: 1, keys_5: 5, keys_12: 12 };
// Contenu du coffre : mêmes objets et mêmes chances que src/shared/lootTable.ts (coffre). Garanti : mythique au 8e sans en avoir eu.
const CHEST = {
  legendaire: ['hat:couronne', 'hat:aureole', 'hat:licorne', 'hat:flammes', 'hat:samourai', 'hat:pharaon', 'acc:ailes', 'acc:cyborg', 'skin:or', 'skin:arcenciel', 'winpose:disco', 'winpose:heros', 'winsound:fanfare', 'ko:fantome', 'ko:ange', 'winfx:feu', 'winfx:disco', 'color:#ff17c4', 'color:#00f0ff', 'color:#d9a400', 'trail:eclair', 'trail:billets', 'frame:or', 'frame:arcenciel', 'plate:or', 'plate:arcenciel', 'title:boss', 'title:empereur', 'react:boom', 'react:pluieprout', 'entry:roi', 'padtheme:or', 'padtheme:lave'],
  mythique: ['hat:dragon', 'hat:cosmique', 'acc:ailesdragon', 'skin:galaxie', 'skin:diamant', 'winpose:toupie', 'winpose:lacroix', 'winsound:choeur', 'ko:trou', 'winfx:cosmos', 'trail:comete', 'trail:galaxie', 'frame:couronne', 'frame:cosmos', 'plate:cosmos', 'title:createur', 'title:dieu', 'react:trone', 'react:meteore', 'entry:dieu', 'padtheme:galaxie'],
};
const CHEST_MYTHIC = 12;
const CHEST_PITY = 8;
const addKeys = (uid, n) => getDatabase().ref(`keys/${uid}/n`).transaction((cur) => Math.max(0, (cur || 0) + n));
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });

async function google(product, token, method = 'GET') {
  const client = await auth.getClient();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/products/${product}/tokens/${encodeURIComponent(token)}`;
  return client.request({ url: method === 'POST' ? `${url}:acknowledge` : method === 'CONSUME' ? `${url}:consume` : url, method: method === 'CONSUME' ? 'POST' : method, data: method === 'GET' ? undefined : {} });
}

exports.verifyPurchase = onCall({ region: 'europe-west1', maxInstances: 5 }, async (req) => {
  const uid = req.auth?.uid;
  const { product, token } = req.data ?? {};
  if (!uid) throw new HttpsError('unauthenticated', 'connexion requise');
  if (!PRODUCTS.has(product) && !KEY_PACKS[product]) throw new HttpsError('invalid-argument', 'produit inconnu');
  if (typeof token !== 'string' || !token || token.length > 2048) throw new HttpsError('invalid-argument', 'jeton invalide');

  let purchase;
  try {
    purchase = (await google(product, token)).data;
  } catch (e) {
    throw new HttpsError('permission-denied', 'achat inconnu de Google');
  }
  // 0 = payé ; 1 = annulé ; 2 = en attente
  if (purchase.purchaseState !== 0) throw new HttpsError('failed-precondition', 'achat non payé');

  // Un achat ne sert qu'à un seul compte
  const db = getDatabase();
  const hash = createHash('sha256').update(token).digest('hex');
  const claim = await db.ref(`passTokens/${hash}`).transaction((cur) => cur ?? uid);
  if (claim.snapshot.val() !== uid) throw new HttpsError('already-exists', 'achat déjà utilisé par un autre compte');

  // Clés : données une seule fois pour ce jeton, puis l'achat est consommé pour pouvoir en racheter
  if (KEY_PACKS[product]) {
    const first = await db.ref(`keyOrders/${hash}`).transaction((cur) => cur ?? uid);
    if (first.committed && !(await db.ref(`keyOrders/${hash}/done`).get()).exists()) {
      await addKeys(uid, KEY_PACKS[product]);
      await db.ref(`keyOrders/${hash}`).set({ uid, done: true });
    }
    await google(product, token, 'CONSUME');
    return { ok: true };
  }

  // Sans accusé de réception sous 3 jours, Google rembourse tout seul
  if (purchase.acknowledgementState === 0) await google(product, token, 'POST');

  await db.ref(`entitlements/${uid}/${product}`).set({ at: Number(purchase.purchaseTimeMillis) || Date.now(), order: purchase.orderId ?? '' });
  return { ok: true };
});

// Ouvre un coffre : retire une clé, tire le gain ici (jamais sur le téléphone), l'inscrit sur le compte.
exports.openChest = onCall({ region: 'europe-west1', maxInstances: 5 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'connexion requise');
  const db = getDatabase();
  const owned = new Set(Array.isArray(req.data?.owned) ? req.data.owned.filter((x) => typeof x === 'string').slice(0, 500) : []);
  const got = Object.keys((await db.ref(`entitlements/${uid}`).get()).val() ?? {});
  // Le # des couleurs est interdit dans une adresse de la base : il y est écrit ~
  got.filter((k) => k.startsWith('cos:')).forEach((k) => owned.add(k.slice(4).replace('~', '#')));
  const left = (r) => CHEST[r].filter((k) => !owned.has(k));
  if (!left('legendaire').length && !left('mythique').length) throw new HttpsError('failed-precondition', 'coffre vide');
  const spent = await db.ref(`keys/${uid}/n`).transaction((cur) => (cur >= 1 ? cur - 1 : undefined));
  if (!spent.committed) throw new HttpsError('failed-precondition', 'pas de clé');
  const pity = Number((await db.ref(`keys/${uid}/pity`).get()).val()) || 0;
  let rarity = pity + 1 >= CHEST_PITY || randomInt(100) < CHEST_MYTHIC ? 'mythique' : 'legendaire';
  if (!left(rarity).length) rarity = rarity === 'mythique' ? 'legendaire' : 'mythique';
  const list = left(rarity);
  const key = list[randomInt(list.length)];
  await db.ref(`entitlements/${uid}/cos:${key.replace('#', '~')}`).set({ at: Date.now(), via: 'coffre' });
  const next = rarity === 'mythique' ? 0 : pity + 1;
  await db.ref(`keys/${uid}/pity`).set(next);
  return { key, rarity, pity: next };
});

// ——— Vente sur le site (Stripe) ———
// Le prix et le nom viennent d'ici, jamais du navigateur. Le joueur doit être connecté : l'achat va sur son compte.
const STRIPE_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_HOOK = defineSecret('STRIPE_WEBHOOK_SECRET');
const SITE = 'https://kwakwa-ratatouille.github.io/Canapet/';
const SHOP = {
  pass_soiree: { name: "Cana'pet : Pass Soirée", cents: 399 },
  pack_couples: { name: "Cana'pet : pack En couple", cents: 199 },
  pack_famille: { name: "Cana'pet : pack Repas de famille", cents: 199 },
  pack_boulot: { name: "Cana'pet : pack Au boulot", cents: 199 },
  pack_minuit: { name: "Cana'pet : pack Après minuit", cents: 199 },
  coll_noel: { name: "Cana'pet : collection Noël", cents: 199 },
  coll_halloween: { name: "Cana'pet : collection Halloween", cents: 199 },
  coll_plage: { name: "Cana'pet : collection Plage", cents: 199 },
  keys_1: { name: "Cana'pet : 1 clé de coffre", cents: 99 },
  keys_5: { name: "Cana'pet : 5 clés de coffre", cents: 399 },
  keys_12: { name: "Cana'pet : 12 clés de coffre", cents: 799 },
};

exports.createCheckout = onCall({ region: 'europe-west1', maxInstances: 5, secrets: [STRIPE_KEY] }, async (req) => {
  const uid = req.auth?.uid;
  const { product, consent } = req.data ?? {};
  if (!uid) throw new HttpsError('unauthenticated', 'connexion requise');
  const item = Object.prototype.hasOwnProperty.call(SHOP, product) ? SHOP[product] : null;
  if (!item) throw new HttpsError('invalid-argument', 'produit inconnu');
  // Accès immédiat au contenu numérique : il faut l'accord explicite du joueur avant de payer
  if (consent !== true) throw new HttpsError('failed-precondition', 'accord requis');
  if (!KEY_PACKS[product] && (await getDatabase().ref(`entitlements/${uid}/${product}`).get()).exists()) throw new HttpsError('already-exists', 'déjà acheté');
  const meta = { uid, product, consent: new Date().toISOString() };
  const email = req.auth.token?.email;
  // Trace écrite de l'accord : elle figure sur le reçu envoyé par Stripe, en plus de la page de paiement
  const waiver = "Accès immédiat demandé, droit de rétractation de 14 jours perdu à la commande. Conditions : " + SITE + '#/conditions';
  const session = await new Stripe(STRIPE_KEY.value()).checkout.sessions.create({
    mode: 'payment',
    ...(email ? { customer_email: email } : {}),
    custom_text: { submit: { message: waiver } },
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: item.cents, product_data: { name: item.name } } }],
    client_reference_id: uid,
    metadata: meta,
    payment_intent_data: { metadata: meta, description: `${item.name}. ${waiver}`, ...(email ? { receipt_email: email } : {}) },
    success_url: `${SITE}#/site?achat=ok`,
    cancel_url: `${SITE}#/site?achat=annule`,
  });
  return { url: session.url };
});

// Stripe prévient ici : c'est le seul endroit qui donne un achat fait sur le site, ou le retire après un remboursement.
exports.stripeWebhook = onRequest({ region: 'europe-west1', maxInstances: 5, secrets: [STRIPE_KEY, STRIPE_HOOK] }, async (req, res) => {
  let event;
  try {
    event = new Stripe(STRIPE_KEY.value()).webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], STRIPE_HOOK.value());
  } catch (e) {
    res.status(400).send('signature invalide');
    return;
  }
  const db = getDatabase();
  const o = event.data.object;
  // Contestation bancaire : l'achat est retiré pendant le litige, et rendu si le vendeur gagne
  if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed') {
    const pay = o.payment_intent ? await new Stripe(STRIPE_KEY.value()).paymentIntents.retrieve(o.payment_intent) : null;
    const m = pay?.metadata ?? {};
    if (m.uid && KEY_PACKS[m.product]) {
      if (event.type === 'charge.dispute.created') await addKeys(m.uid, -KEY_PACKS[m.product]);
      else if (o.status === 'won') await addKeys(m.uid, KEY_PACKS[m.product]);
    } else if (m.uid && PRODUCTS.has(m.product)) {
      const node = db.ref(`entitlements/${m.uid}/${m.product}`);
      if (event.type === 'charge.dispute.created') await node.remove();
      else if (o.status === 'won') await node.set({ at: Date.now(), order: pay.id, via: 'stripe', consent: m.consent ?? '' });
    }
    res.json({ received: true });
    return;
  }
  const { uid, product, consent } = o.metadata ?? {};
  if (uid && KEY_PACKS[product]) {
    if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && o.payment_status === 'paid') {
      // Stripe peut prévenir deux fois : une commande ne donne ses clés qu'une fois
      const order = db.ref(`keyOrders/${o.id}`);
      const first = await order.transaction((cur) => (cur ? undefined : { uid, product, at: Date.now() }));
      if (first.committed) await addKeys(uid, KEY_PACKS[product]);
    }
    // Remboursement : on retire les clés qui restent
    if (event.type === 'charge.refunded' && o.refunded) await addKeys(uid, -KEY_PACKS[product]);
  } else if (uid && PRODUCTS.has(product)) {
    if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && o.payment_status === 'paid') {
      await db.ref(`entitlements/${uid}/${product}`).set({ at: Date.now(), order: o.id, via: 'stripe', consent: consent ?? '' });
    }
    if (event.type === 'charge.refunded' && o.refunded) await db.ref(`entitlements/${uid}/${product}`).remove();
  }
  res.json({ received: true });
});
