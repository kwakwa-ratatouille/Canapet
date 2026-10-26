import type { Lang, PadLayout, Profile, ToTv } from '../shared/protocol';

export interface Runner {
  pid: string;
  profile: Profile;
  bot: boolean;
  selfie: HTMLImageElement | null;
}

export interface GameCtx {
  lang: Lang;
  light: boolean;
  buzz(pid: string, ms: number): void;
}

/** Une partie en cours. La télé l'appelle à 60 Hz (update) et à chaque image (render). */
export interface GameInstance {
  input(pid: string, m: ToTv): void;
  update(dt: number): void;
  /** Dessine dans un repère fixe de 1920 × 1080. */
  render(g: CanvasRenderingContext2D, t: number): void;
  over: boolean;
  /** Identifiants des joueurs, du premier au dernier. */
  ranking(): string[];
  /** Pour le présentateur : nom du premier arrivé dès qu'il y en a un. */
  leader?(): string | null;
}

export interface GameDef {
  id: string;
  emoji: string;
  name: Record<Lang, string>;
  how: Record<Lang, string>;
  inspired: string;
  layout: PadLayout;
  min: number;
  max: number;
  /** Nombre de participants minimum : on complète avec des bots. */
  botFill: number;
  music: 'race' | 'lobby' | 'tumble';
  soon?: boolean;
  create?(runners: Runner[], ctx: GameCtx): GameInstance;
}
