// Côté téléphone ou PC (Chrome) : lancer Cana'pet sur un Chromecast.
// L'identifiant vient de la console Google Cast (appli « Custom Receiver » pointant vers cast.html).
export const CAST_APP_ID = '';
export const CAST_NS = 'urn:x-cast:com.canapet';

/* eslint-disable @typescript-eslint/no-explicit-any */
type W = Window & { cast?: any; chrome?: any; __onGCastApiAvailable?: (ok: boolean) => void };
const w = window as W;

let loading: Promise<boolean> | null = null;

/** Charge le SDK d'envoi Google Cast (seulement dans Chrome, Android et PC). */
export function loadCast(): Promise<boolean> {
  if (!CAST_APP_ID) return Promise.resolve(false);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    if (!/Chrome/.test(navigator.userAgent) || /iPhone|iPad/.test(navigator.userAgent)) return resolve(false);
    w.__onGCastApiAvailable = (ok) => {
      if (ok) {
        w.cast.framework.CastContext.getInstance().setOptions({
          receiverApplicationId: CAST_APP_ID,
          autoJoinPolicy: w.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
      }
      resolve(ok);
    };
    const s = document.createElement('script');
    s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
    setTimeout(() => resolve(false), 8000);
  });
  return loading;
}

/** Ouvre le choix du Chromecast, puis renvoie le code du salon affiché par la télé. */
export async function castAndGetCode(): Promise<string> {
  const ctx = w.cast.framework.CastContext.getInstance();
  await ctx.requestSession();
  const session = ctx.getCurrentSession();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 40000);
    session.addMessageListener(CAST_NS, (_ns: string, msg: string) => {
      try {
        const d = typeof msg === 'string' ? JSON.parse(msg) : msg;
        if (d.code) {
          clearTimeout(timer);
          resolve(d.code);
        }
      } catch {
        /* message illisible : on attend le suivant */
      }
    });
    // Si la télé tourne déjà, on lui redemande le code.
    session.sendMessage(CAST_NS, { hello: 1 }).catch(() => {});
  });
}
