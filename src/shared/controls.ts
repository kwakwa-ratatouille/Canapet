// Réglages de la manette, gardés sur le téléphone : place des boutons, stick à droite (gauchers), taille, vibrations.
import { save, store } from './device';

export type Btn = 'a' | 'b' | 'c' | 'd';
export type Slot = 'top' | 'left' | 'right' | 'bottom';

export interface Controls {
  /** Place de chaque bouton dans la croix. */
  slots: Record<Btn, Slot>;
  /** Stick à droite et boutons à gauche. */
  mirror: boolean;
  size: number;
  vibrate: boolean;
  /** Ouvrir les boîtes sans animation. */
  noBoxAnim?: boolean;
}

export const DEFAULT_CONTROLS: Controls = { slots: { c: 'top', d: 'left', b: 'right', a: 'bottom' }, mirror: false, size: 1, vibrate: true };

export const loadControls = (): Controls => {
  const c = store<Partial<Controls>>('controls', {});
  return { ...DEFAULT_CONTROLS, ...c, slots: { ...DEFAULT_CONTROLS.slots, ...c.slots } };
};
export const saveControls = (c: Controls) => save('controls', c);
