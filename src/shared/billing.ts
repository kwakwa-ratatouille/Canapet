// Achat du Pass Soirée : Google Play encaisse (plugin Billing de l'appli), le serveur vérifie et inscrit le Pass sur le compte.
import { verifyPass } from './cloud';

const PRODUCT = 'pass_soiree';
type Bridge = { nativePromise?: (p: string, m: string, o: unknown) => Promise<unknown> };
const call = <T,>(method: string): Promise<T> => {
  const c = (window as unknown as { Capacitor?: Bridge }).Capacitor;
  if (!c?.nativePromise) return Promise.reject(new Error('indisponible'));
  return c.nativePromise('Billing', method, { id: PRODUCT }) as Promise<T>;
};

export const passPrice = () => call<{ price: string }>('product').then((r) => r.price);

export async function buyPass(): Promise<boolean> {
  const { token } = await call<{ token: string }>('buy');
  return verifyPass(token);
}

/** Retrouve un achat déjà fait sur ce compte Google Play. */
export async function restorePass(): Promise<boolean> {
  const { token } = await call<{ token?: string }>('owned');
  return token ? verifyPass(token) : false;
}
