// Serveur des achats : vérifie auprès de Google qu'un achat est réel, puis l'inscrit sur le compte du joueur.
// Le compte du serveur doit avoir accès à l'appli dans la console Google Play (voir store/google-play.md).
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Stripe = require('stripe');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { GoogleAuth } = require('google-auth-library');
const { createHash } = require('crypto');

initializeApp();

const PACKAGE = 'com.canapet.app';
// Mêmes identifiants que dans src/shared/offer.ts et la console Google Play
const PRODUCTS = new Set(['pass_soiree', 'pack_couples', 'pack_famille', 'pack_boulot', 'pack_minuit', 'coll_noel', 'coll_halloween', 'coll_plage']);
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });

async function google(product, token, method = 'GET') {
  const client = await auth.getClient();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/products/${product}/tokens/${encodeURIComponent(token)}`;
  return client.request({ url: method === 'POST' ? `${url}:acknowledge` : url, method, data: method === 'POST' ? {} : undefined });
}

exports.verifyPurchase = onCall({ region: 'europe-west1', maxInstances: 5 }, async (req) => {
  const uid = req.auth?.uid;
  const { product, token } = req.data ?? {};
  if (!uid) throw new HttpsError('unauthenticated', 'connexion requise');
  if (!PRODUCTS.has(product)) throw new HttpsError('invalid-argument', 'produit inconnu');
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

  // Sans accusé de réception sous 3 jours, Google rembourse tout seul
  if (purchase.acknowledgementState === 0) await google(product, token, 'POST');

  await db.ref(`entitlements/${uid}/${product}`).set({ at: Number(purchase.purchaseTimeMillis) || Date.now(), order: purchase.orderId ?? '' });
  return { ok: true };
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
};

exports.createCheckout = onCall({ region: 'europe-west1', maxInstances: 5, secrets: [STRIPE_KEY] }, async (req) => {
  const uid = req.auth?.uid;
  const { product, consent } = req.data ?? {};
  if (!uid) throw new HttpsError('unauthenticated', 'connexion requise');
  const item = Object.prototype.hasOwnProperty.call(SHOP, product) ? SHOP[product] : null;
  if (!item) throw new HttpsError('invalid-argument', 'produit inconnu');
  // Accès immédiat au contenu numérique : il faut l'accord explicite du joueur avant de payer
  if (consent !== true) throw new HttpsError('failed-precondition', 'accord requis');
  if ((await getDatabase().ref(`entitlements/${uid}/${product}`).get()).exists()) throw new HttpsError('already-exists', 'déjà acheté');
  const meta = { uid, product, consent: new Date().toISOString() };
  const session = await new Stripe(STRIPE_KEY.value()).checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: item.cents, product_data: { name: item.name } } }],
    client_reference_id: uid,
    metadata: meta,
    payment_intent_data: { metadata: meta },
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
  const { uid, product, consent } = o.metadata ?? {};
  if (uid && PRODUCTS.has(product)) {
    if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && o.payment_status === 'paid') {
      await db.ref(`entitlements/${uid}/${product}`).set({ at: Date.now(), order: o.id, via: 'stripe', consent: consent ?? '' });
    }
    if (event.type === 'charge.refunded' && o.refunded) await db.ref(`entitlements/${uid}/${product}`).remove();
  }
  res.json({ received: true });
});
