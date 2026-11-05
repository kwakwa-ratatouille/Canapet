// Serveur du Pass Soirée : vérifie auprès de Google qu'un achat est réel, puis l'inscrit sur le compte du joueur.
// Le compte du serveur doit avoir accès à l'appli dans la console Google Play (voir store/google-play.md).
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { GoogleAuth } = require('google-auth-library');
const { createHash } = require('crypto');

initializeApp();

const PACKAGE = 'com.canapet.app';
const PRODUCT = 'pass_soiree';
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });

async function google(path, method = 'GET') {
  const client = await auth.getClient();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/products/${PRODUCT}/tokens/${encodeURIComponent(path)}`;
  return client.request({ url: method === 'POST' ? `${url}:acknowledge` : url, method, data: method === 'POST' ? {} : undefined });
}

exports.verifyPass = onCall({ region: 'europe-west1', maxInstances: 5 }, async (req) => {
  const uid = req.auth?.uid;
  const token = req.data?.token;
  if (!uid) throw new HttpsError('unauthenticated', 'connexion requise');
  if (typeof token !== 'string' || !token || token.length > 2048) throw new HttpsError('invalid-argument', 'jeton invalide');

  let purchase;
  try {
    purchase = (await google(token)).data;
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
  if (purchase.acknowledgementState === 0) await google(token, 'POST');

  await db.ref(`entitlements/${uid}/pass`).set({ at: Number(purchase.purchaseTimeMillis) || Date.now(), order: purchase.orderId ?? '' });
  return { pass: true };
});
