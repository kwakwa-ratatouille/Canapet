// Types du module de dessin fourni par la DA (canapet-art.js).
export interface CharacterOpts {
  hat?: string;
  acc?: string;
  mood?: 'happy' | 'wow' | 'sad' | 'win' | 'toot';
  selfie?: boolean;
  arms?: boolean;
  toot?: boolean;
}
export const COLORS: { P: string; ROSE: string; VIO: string; VIO2: string; SOL: string; MEN: string; CIEL: string; NUIT: string };
export const PLAYER_COLORS: string[];
export const PLAYER_COLOR_NAMES: string[];
export const CHARACTERS: Record<string, string>;
export const HATS: string[];
export const ACCESSORIES: string[];
export const MOODS: string[];
export function characterSvg(kind: string, color?: string, opts?: CharacterOpts): string;
export function characterGroup(kind: string, color?: string, opts?: CharacterOpts): string;
export function faceSlot(kind: string): { cx: number; cy: number; r: number };
export const CHARACTER_VIEWBOX: string;
export function sofaGroup(): string;
export function mascotThreeQuarterGroup(): string;
export function cloudPath(cx: number, cy: number, s: number): string;
export function starGroup(x: number, y: number, r: number, fill: string, w?: number): string;
export function heartGroup(x: number, y: number, r: number, fill: string): string;
export function stickerText(x: number, y: number, size: number, anchor: string, content: string, fill: string): string;
export function monogramSvg(): string;
export function wordmarkSvg(): string;
export function appIconSvg(dark?: boolean): string;
export const GAME_LIST: { slug: string; name: string; tagline: string; color: string }[];
export function gameIconSvg(i: number): string;
