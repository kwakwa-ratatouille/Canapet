import type { Lang, PadLayout, Profile, ToTv } from '../shared/protocol';

export interface Runner {
  pid: string;
  profile: Profile;
  bot: boolean;
  selfie: HTMLImageElement | null;
  /** Mode équipes : 0 ou 1. Absent = mêlée générale. */
  team?: number;
}

export interface GameCtx {
  lang: Lang;
  light: boolean;
  /** Mode famille : textes et bruitages adoucis. */
  family: boolean;
  buzz(pid: string, ms: number): void;
  /** Renvoie aux téléphones leur écran (à appeler quand padData change). */
  refresh(): void;
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
  /** Données privées affichées sur le téléphone de ce joueur (sa main, ses choix…). */
  padData?(pid: string): unknown;
  /** Nom de la carte tirée pour cette partie (affiché à l'intro). */
  mapName?: Record<Lang, string>;
}

/** Ce que chaque fichier de jeu définit ; le catalogue y ajoute l'icône et la couleur de la DA. */
export interface GameBase {
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
  /** Temps de jeu maximum (s) : chrono à l'écran, la partie s'arrête à zéro avec le classement du moment. */
  limit?: number;
  /** Chrono en haut de l'écran (quand le bas est pris par l'interface du jeu). */
  timerTop?: boolean;
  soon?: boolean;
  create?(runners: Runner[], ctx: GameCtx): GameInstance;
}

export interface GameDef extends GameBase {
  /** Icône (public/da/jeux/<slug>.svg) et couleur du jeu, venues de la DA. */
  slug: string;
  color: string;
}
