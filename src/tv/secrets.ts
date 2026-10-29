// Défis secrets du tournoi : chacun reçoit une mission cachée sur son téléphone, révélée au podium.
import type { GameDef } from '../games/types';
import type { Lang } from '../shared/protocol';

export type SecretKind = 'podium' | 'last' | 'beat' | 'win' | 'neverLast' | 'twoPodiums' | 'react';

export interface Secret {
  pid: string;
  kind: SecretKind;
  /** Jeu visé ({G} dans le texte) et joueur à battre ({F}). */
  game?: string;
  foe?: string;
  n?: number;
  bonus: number;
  done: boolean | null;
  text: Record<Lang, string>;
}

const TEXTS: Record<SecretKind, { bonus: number; fr: string; en: string }> = {
  podium: { bonus: 4, fr: 'Finis dans les 3 premiers à {G}', en: 'Finish top 3 in {G}' },
  last: { bonus: 6, fr: 'Finis DERNIER à {G} (sans te faire griller !)', en: 'Finish LAST in {G} (don’t get caught!)' },
  beat: { bonus: 4, fr: 'Finis devant {F} à {G}', en: 'Finish ahead of {F} in {G}' },
  win: { bonus: 5, fr: 'Gagne au moins un jeu du tournoi', en: 'Win at least one game of the tournament' },
  neverLast: { bonus: 4, fr: 'Ne finis jamais dernier', en: 'Never finish last' },
  twoPodiums: { bonus: 5, fr: 'Monte 2 fois dans le top 3', en: 'Make the top 3 twice' },
  react: { bonus: 3, fr: 'Envoie 25 réactions pendant le tournoi', en: 'Send 25 reactions during the tournament' },
};

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function makeSecrets(players: { pid: string }[], plan: GameDef[]): Map<string, Secret> {
  const out = new Map<string, Secret>();
  // Jeux où l'on peut vraiment être classé (pas les jeux de rôle à camps)
  const ranked = plan.filter((g) => g.id !== 'traitre' && g.id !== 'undercover');
  const games = ranked.length ? ranked : plan;
  const kinds = Object.keys(TEXTS) as SecretKind[];
  let bag: SecretKind[] = [];
  for (const p of players) {
    // On pioche dans un sac pour que les défis soient variés
    if (!bag.length) bag = [...kinds].sort(() => Math.random() - 0.5);
    let kind = bag.pop()!;
    const foes = players.filter((x) => x.pid !== p.pid);
    if (kind === 'beat' && !foes.length) kind = 'win';
    const t = TEXTS[kind];
    out.set(p.pid, {
      pid: p.pid,
      kind,
      game: ['podium', 'last', 'beat'].includes(kind) ? pick(games).id : undefined,
      foe: kind === 'beat' ? pick(foes).pid : undefined,
      n: kind === 'react' ? 25 : undefined,
      bonus: t.bonus,
      done: null,
      text: { fr: t.fr, en: t.en },
    });
  }
  return out;
}
