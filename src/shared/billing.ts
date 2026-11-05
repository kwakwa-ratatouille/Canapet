// Achats : Google Play encaisse (plugin Billing de l'appli), le serveur vérifie et inscrit l'achat sur le compte.
import { verifyPurchase } from './cloud';

type Bridge = { nativePromise?: (p: string, m: string, o: unknown) => Promise<unknown> };
const call = <T,>(method: string, id: string): Promise<T> => {
  const c = (window as unknown as { Capacitor?: Bridge }).Capacitor;
  if (!c?.nativePromise) return Promise.reject(new Error('indisponible'));
  return c.nativePromise('Billing', method, { id }) as Promise<T>;
};

export const productPrice = (id: string) => call<{ price: string }>('product', id).then((r) => r.price);

export async function buyProduct(id: string): Promise<boolean> {
  const { token } = await call<{ token: string }>('buy', id);
  return verifyPurchase(id, token);
}

/** Retrouve un achat déjà fait sur ce compte Google Play. */
export async function restoreProduct(id: string): Promise<boolean> {
  const { token } = await call<{ token?: string }>('owned', id);
  return token ? verifyPurchase(id, token) : false;
}
