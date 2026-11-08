// La Bataille des Fusions : deux équipes, deux bacs côte à côte. Chacun son tour, un joueur de l'équipe lâche un aliment.
// Deux aliments identiques qui se touchent fusionnent en un plus gros et rapportent des points. Chaque fusion charge
// un malus envoyé à l'autre équipe. Le bac déborde = perdu ; sinon, le plus gros score à la fin du chrono.
import { drawCharacter } from '../shared/characters';
import { INK, ROSE } from '../shared/palette';
import { sfx, speak } from '../shared/sound';
import { FUSION_COLORS, FUSION_H, FUSION_R, FUSION_W, type FusionPadData } from './fusionShared';
import { candy, tileWall } from './draw';
import { TEAMS } from './teams';
import type { GameBase, GameCtx, GameInstance, Runner } from './types';

const FOODS = ['bonbon', 'tomate', 'oeuf', 'cookie', 'beignet', 'oignon', 'patate', 'pasteque', 'ananas', 'burger'];
const GRAV = 1500;
const LINE = 90;
const OX = [70, 1050];
const OY = 215;
const TURN = 6;
const CHARGE = 6;
const POINTS = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55];

// Des malus qui gênent vraiment : rien qui secoue le bac (ça aidait à fusionner)
type Malus = 'rocher' | 'glouton' | 'brouillard' | 'inverse' | 'presse';
const MALUS: Record<Malus, { emoji: string; fr: string; en: string; t: number }> = {
  rocher: { emoji: '🪨', fr: 'Un rocher tombe !', en: 'A boulder falls!', t: 1.5 },
  glouton: { emoji: '😈', fr: 'Le Glouton mange tes aliments !', en: 'The Glutton eats your food!', t: 1.5 },
  brouillard: { emoji: '🌫️', fr: 'Brouillard !', en: 'Fog!', t: 7 },
  inverse: { emoji: '🔄', fr: 'Visée inversée !', en: 'Reversed aim!', t: 8 },
  presse: { emoji: '⏱️', fr: 'Dépêche-toi !', en: 'Hurry up!', t: 8 },
};
const MALUS_LIST = Object.keys(MALUS) as Malus[];
/** Les rochers et le Glouton tombent bien plus souvent que les autres malus. */
const MALUS_BAG: Malus[] = ['rocher', 'rocher', 'rocher', 'glouton', 'glouton', 'brouillard', 'inverse', 'presse'];
/** Taille d'un rocher : deux pareils se collent en un plus gros, plus lourd. */
const ROCK_R = [0, 66, 96, 126, 156];
/** Un rocher tombe tout seul dans chaque bac de temps en temps : le bac finit par se remplir. */
const ROCK_EVERY = 32;

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  l: number;
  r: number;
  age: number;
  dead?: boolean;
  /** Rocher : ne fusionne qu'avec un rocher pareil, très lourd (de 1 à 4). */
  rock?: number;
  /** Glouton : mange ce qu'il touche, puis repart. */
  bites?: number;
  /** Temps avant de disparaître tout seul. */
  junk?: number;
}
interface Pop {
  x: number;
  y: number;
  text: string;
  life: number;
}
interface Board {
  id: number;
  players: Pl[];
  balls: Ball[];
  pops: Pop[];
  score: number;
  turn: number;
  left: number;
  cool: number;
  aim: number;
  next: number;
  after: number;
  charge: number;
  over: number;
  effects: Partial<Record<Malus, number>>;
  banner: { text: string; t: number } | null;
  botAt: number;
  botAim: number;
  /** La visée affichée à la télé, qui glisse vers la vraie. */
  shownAim: number;
}
interface Pl extends Runner {
  side: number;
}

function create(runners: Runner[], ctx: GameCtx): GameInstance {
  const fr = ctx.lang === 'fr';
  let clock = 0;
  /** Les aliments sont de plus en plus gros au fil de la partie : le bac se remplit plus vite. */
  const pick = () => {
    const boost = Math.min(0.24, clock / 500);
    const r = Math.random();
    return r < 0.35 - boost ? 0 : r < 0.65 - boost ? 1 : r < 0.85 - boost ? 2 : r < 0.96 - boost / 2 ? 3 : 4;
  };
  // Les équipes du salon, sinon un sur deux
  const pls: Pl[] = runners.map((r, i) => ({ ...r, side: r.team ?? i % 2 }));
  const boards: Board[] = [0, 1].map((id) => ({ id, players: pls.filter((p) => p.side === id), balls: [], pops: [], score: 0, turn: 0, left: TURN, cool: 0, aim: FUSION_W / 2, next: pick(), after: pick(), charge: 0, over: 0, effects: {}, banner: null, botAt: 1, botAim: FUSION_W / 2, shownAim: FUSION_W / 2 }));
  let winner = -1;
  let endT = 0;
  let lastPush = 0;
  let nextRock = ROCK_EVERY;
  let shake = 0;

  const current = (b: Board) => b.players[b.turn % Math.max(1, b.players.length)];
  const dropRock = (to: Board) => {
    const r = ROCK_R[1];
    to.balls.push({ x: r + Math.random() * (FUSION_W - r * 2), y: 30, vx: 0, vy: 200, l: -2, r, age: 0, rock: 1 });
  };
  const sendMalus = (from: Board) => {
    const to = boards[1 - from.id];
    const kind = MALUS_BAG[Math.floor(Math.random() * MALUS_BAG.length)];
    const m = MALUS[kind];
    to.effects[kind] = m.t;
    to.banner = { text: `${m.emoji} ${fr ? m.fr : m.en}`, t: 2.2 };
    from.charge = 0;
    sfx.boing();
    if (kind === 'rocher') {
      dropRock(to);
      shake = 0.35;
    }
    if (kind === 'glouton') to.balls.push({ x: 100 + Math.random() * (FUSION_W - 200), y: 30, vx: 0, vy: 0, l: -3, r: 44, age: 0, bites: 2, junk: 20 });
    to.players.forEach((p) => {
      if (!p.bot) ctx.buzz(p.pid, 120);
    });
  };

  const drop = (b: Board) => {
    if (b.cool > 0 || winner >= 0) return;
    const r = FUSION_R[b.next];
    b.balls.push({ x: Math.max(r, Math.min(FUSION_W - r, b.aim)), y: 34, vx: 0, vy: 0, l: b.next, r, age: 0 });
    b.next = b.after;
    b.after = pick();
    b.cool = 0.65;
    b.turn++;
    b.left = TURN + 0.65;
    const nextUp = current(b);
    b.botAt = 0.65 + 0.5 + Math.random() * (1.4 - ctx.botSkill);
    if (nextUp && !nextUp.bot) ctx.buzz(nextUp.pid, 90);
    sfx.pop();
    ctx.refresh();
  };

  const merge = (b: Board, a: Ball, c: Ball) => {
    a.dead = c.dead = true;
    const l = a.l;
    const x = (a.x + c.x) / 2;
    const y = (a.y + c.y) / 2;
    const pts = POINTS[l];
    b.score += pts;
    b.pops.push({ x, y, text: `+${pts}`, life: 0.9 });
    if (l + 1 < FUSION_R.length) b.balls.push({ x, y, vx: (a.vx + c.vx) / 2, vy: (a.vy + c.vy) / 2 - 80, l: l + 1, r: FUSION_R[l + 1], age: 0 });
    else {
      // Les deux plus gros : ils disparaissent, gros bonus
      b.score += 100;
      b.pops.push({ x, y: y - 50, text: '+100 !', life: 1.4 });
    }
    sfx.pop();
    // Plus la fusion est grosse, plus elle charge le malus
    b.charge += l + 1;
    if (b.charge >= CHARGE) sendMalus(b);
  };

  /** Deux rochers pareils : un seul, plus gros et plus lourd. Ça ne rapporte rien. */
  const mergeRocks = (b: Board, a: Ball, c: Ball) => {
    a.dead = c.dead = true;
    const rock = a.rock! + 1;
    const r = ROCK_R[rock];
    b.balls.push({ x: Math.max(r, Math.min(FUSION_W - r, (a.x + c.x) / 2)), y: (a.y + c.y) / 2, vx: 0, vy: 0, l: -2, r, age: 0, rock });
    b.pops.push({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 - 40, text: fr ? 'ENCORE PLUS GROS !' : 'EVEN BIGGER!', life: 1.2 });
    shake = 0.3;
    sfx.boom();
  };
  /** Le Glouton mange un aliment : il disparaît et son équipe perd ses points. */
  const bite = (b: Board, e: Ball, food: Ball) => {
    food.dead = true;
    const lost = Math.max(2, POINTS[food.l]);
    b.score = Math.max(0, b.score - lost);
    b.pops.push({ x: food.x, y: food.y, text: `CROC ! -${lost}`, life: 1.1 });
    e.bites = (e.bites ?? 1) - 1;
    if (e.bites <= 0) e.dead = true;
    sfx.boing();
    b.players.forEach((p) => {
      if (!p.bot) ctx.buzz(p.pid, 100);
    });
  };

  const physics = (b: Board, h: number) => {
    for (const a of b.balls) {
      a.age += h;
      a.vy += GRAV * h;
      a.vx *= 0.996;
      a.x += a.vx * h;
      a.y += a.vy * h;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < b.balls.length; i++) {
        const a = b.balls[i];
        if (a.dead) continue;
        for (let j = i + 1; j < b.balls.length; j++) {
          const c = b.balls[j];
          if (c.dead) continue;
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const min = a.r + c.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          if (a.l === c.l && a.l >= 0) {
            merge(b, a, c);
            break;
          }
          if (a.rock && a.rock === c.rock && a.rock < 4) {
            mergeRocks(b, a, c);
            break;
          }
          if (a.bites && c.l >= 0) {
            bite(b, a, c);
            if (a.dead) break;
            continue;
          }
          if (c.bites && a.l >= 0) {
            bite(b, c, a);
            break;
          }
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const push = (min - d) / 2;
          // Le plus gros bouge moins
          // Un rocher pèse bien plus lourd que tout le reste
          const ma = a.r * a.r * (a.rock ? 10 : 1);
          const mc = c.r * c.r * (c.rock ? 10 : 1);
          const ka = (2 * mc) / (ma + mc);
          const kc = (2 * ma) / (ma + mc);
          a.x -= nx * push * ka;
          a.y -= ny * push * ka;
          c.x += nx * push * kc;
          c.y += ny * push * kc;
          const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = rel * 1.15;
            a.vx += (nx * imp * mc) / (ma + mc);
            a.vy += (ny * imp * mc) / (ma + mc);
            c.vx -= (nx * imp * ma) / (ma + mc);
            c.vy -= (ny * imp * ma) / (ma + mc);
          }
        }
      }
      for (const a of b.balls) {
        if (a.x < a.r) {
          a.x = a.r;
          a.vx = Math.abs(a.vx) * 0.25;
        }
        if (a.x > FUSION_W - a.r) {
          a.x = FUSION_W - a.r;
          a.vx = -Math.abs(a.vx) * 0.25;
        }
        if (a.y > FUSION_H - a.r) {
          a.y = FUSION_H - a.r;
          a.vy = -Math.abs(a.vy) * 0.12;
          a.vx *= 0.96;
        }
      }
    }
    b.balls = b.balls.filter((a) => !a.dead);
  };

  /** Le bot vise un aliment identique, le plus haut, sinon un coin libre. */
  const botThink = (b: Board) => {
    const same = b.balls.filter((a) => a.l === b.next).sort((p, q) => p.y - q.y)[0];
    const clever = Math.random() < 0.35 + ctx.botSkill * 0.55;
    b.botAim = same && clever ? same.x : 80 + Math.random() * (FUSION_W - 160);
  };

  const pushPads = () => ctx.refresh();
  const game: GameInstance = {
    over: false,
    input(pid, m) {
      if (m.t !== 'act' || winner >= 0) return;
      const p = pls.find((x) => x.pid === pid);
      if (!p) return;
      const b = boards[p.side];
      if (current(b) !== p) return;
      const raw = ((m.n?.[0] ?? 500) / 1000) * FUSION_W;
      const aim = (b.effects.inverse ?? 0) > 0 ? FUSION_W - raw : raw;
      if (m.a === 'aim') b.aim = aim;
      if (m.a === 'drop') {
        b.aim = aim;
        drop(b);
      }
    },
    update(dt) {
      clock += dt;
      shake = Math.max(0, shake - dt);
      if (winner >= 0) {
        endT -= dt;
        if (endT <= 0) game.over = true;
      }
      for (const b of boards) {
        physics(b, dt / 2);
        physics(b, dt / 2);
        for (const k of MALUS_LIST) {
          const v = b.effects[k];
          if (v !== undefined) {
            b.effects[k] = v - dt;
            if (b.effects[k]! <= 0) delete b.effects[k];
          }
        }
        if (b.banner && (b.banner.t -= dt) <= 0) b.banner = null;
        for (const o of b.pops) {
          o.y -= 70 * dt;
          o.life -= dt;
        }
        b.pops = b.pops.filter((o) => o.life > 0);
        for (const a of b.balls) if (a.junk !== undefined && (a.junk -= dt) <= 0) a.dead = true;
        b.balls = b.balls.filter((a) => !a.dead);
        if (winner >= 0) continue;
        b.cool = Math.max(0, b.cool - dt);
        b.left -= dt * ((b.effects.presse ?? 0) > 0 ? 2.5 : 1);
        const cur = current(b);
        if (cur && (cur.bot || ctx.away(cur.pid))) {
          b.botAt -= dt;
          if (b.botAt <= 0.5 && b.botAt + dt > 0.5) botThink(b);
          b.aim += (b.botAim - b.aim) * Math.min(1, dt * 6);
          if (b.botAt <= 0 && b.cool <= 0) drop(b);
        } else if (b.left <= 0) drop(b);
        // Débordement : un aliment posé reste au-dessus de la ligne trop longtemps
        const high = b.balls.some((a) => a.age > 1.2 && a.junk === undefined && a.y - a.r < LINE && Math.abs(a.vy) < 120);
        b.over = high ? b.over + dt : 0;
        if (b.over > 2.5) {
          winner = 1 - b.id;
          endT = 4;
          sfx.boom();
          speak(fr ? `${TEAMS[b.id].name.fr} déborde !` : `${TEAMS[b.id].name.en} overflows!`, ctx.lang);
          ctx.refresh();
        }
      }
      // Un rocher tombe tout seul de temps en temps, de plus en plus souvent
      if (winner < 0 && clock >= nextRock) {
        nextRock = clock + Math.max(14, ROCK_EVERY - clock / 12);
        boards.forEach(dropRock);
        sfx.boom();
      }
      for (const b of boards) b.shownAim += (b.aim - b.shownAim) * Math.min(1, dt * 16);
      // Le téléphone n'affiche que le tour et le compte à rebours : une fois par seconde suffit
      if (clock - lastPush > 1) {
        lastPush = clock;
        pushPads();
      }
    },
    render(g, t) {
      tileWall(g, '#ffe9c9');
      boards.forEach((b) => {
        const ox = OX[b.id];
        const team = TEAMS[b.id];
        g.save();
        if (shake > 0) g.translate((Math.random() - 0.5) * 16 * shake * 2, (Math.random() - 0.5) * 12 * shake * 2);
        // L'équipe et son score
        g.fillStyle = team.color;
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.beginPath();
        g.roundRect(ox, 14, FUSION_W, 88, 26);
        g.fill();
        g.stroke();
        candy(g, ox, 14, FUSION_W, 88, 26);
        g.fillStyle = '#fff';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.font = '700 44px Fredoka, sans-serif';
        g.fillText(`${team.emoji} ${team.name[ctx.lang]}`, ox + 24, 58, 470);
        g.textAlign = 'right';
        g.font = '700 58px Fredoka, sans-serif';
        g.fillText(String(b.score), ox + FUSION_W - 24, 58);
        // Qui joue, le suivant et la jauge de malus
        const cur = current(b);
        g.textAlign = 'left';
        g.fillStyle = INK;
        g.font = '700 32px Fredoka, sans-serif';
        g.fillText(cur ? `👉 ${cur.profile.name}` : '', ox + 6, 136, 360);
        g.textAlign = 'right';
        g.fillText(`⏭️`, ox + 480, 136);
        g.fillStyle = 'rgba(58,33,64,.15)';
        g.beginPath();
        g.roundRect(ox + 570, 122, 230, 28, 14);
        g.fill();
        g.fillStyle = ROSE;
        g.beginPath();
        g.roundRect(ox + 570, 122, Math.max(28, 230 * Math.min(1, b.charge / CHARGE)), 28, 14);
        g.fill();
        g.fillStyle = INK;
        g.textAlign = 'center';
        g.font = '700 28px Fredoka, sans-serif';
        g.fillText(fr ? 'malus' : 'malus', ox + 685, 170);
        const ball = (x: number, y: number, l: number, r: number) => {
          if (l < 0) {
            // Rocher gris, ou Glouton violet : on les reconnaît tout de suite
            g.fillStyle = l === -2 ? '#8d8796' : '#7a2fd0';
            g.strokeStyle = INK;
            g.lineWidth = 6;
            g.beginPath();
            g.arc(x, y, r, 0, Math.PI * 2);
            g.fill();
            g.stroke();
            if (l === -2) {
              g.fillStyle = 'rgba(58,33,64,.28)';
              g.beginPath();
              g.arc(x - r * 0.3, y + r * 0.2, r * 0.24, 0, Math.PI * 2);
              g.arc(x + r * 0.38, y - r * 0.28, r * 0.16, 0, Math.PI * 2);
              g.fill();
              g.fillStyle = 'rgba(255,255,255,.3)';
              g.beginPath();
              g.arc(x - r * 0.35, y - r * 0.42, r * 0.17, 0, Math.PI * 2);
              g.fill();
            } else {
              g.font = `${Math.round(r * 1.3)}px sans-serif`;
              g.textAlign = 'center';
              g.textBaseline = 'middle';
              g.fillStyle = INK;
              g.fillText('😈', x, y + r * 0.06);
            }
            return;
          }
          g.fillStyle = FUSION_COLORS[l];
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.save();
          g.beginPath();
          g.arc(x, y, r - 3, 0, Math.PI * 2);
          g.clip();
          drawCharacter(g, x, y + r * 0.92, r * 1.55, { food: FOODS[l], color: '#3a2140', t: 0, mood: 'happy' });
          g.restore();
        };
        ball(ox + 510, 136, b.next, 24);
        // Le bac
        g.fillStyle = '#fffaf2';
        g.strokeStyle = INK;
        g.lineWidth = 8;
        g.beginPath();
        g.roundRect(ox - 6, OY - 6, FUSION_W + 12, FUSION_H + 12, 18);
        g.fill();
        g.stroke();
        g.save();
        g.beginPath();
        g.rect(ox, OY, FUSION_W, FUSION_H);
        g.clip();
        // La ligne à ne pas dépasser
        g.strokeStyle = b.over > 0 && Math.sin(t * 16) > 0 ? '#ff2a2a' : ROSE;
        g.lineWidth = 6;
        g.setLineDash([22, 16]);
        g.beginPath();
        g.moveTo(ox, OY + LINE);
        g.lineTo(ox + FUSION_W, OY + LINE);
        g.stroke();
        g.setLineDash([]);
        // La visée
        if (winner < 0) {
          const nr = FUSION_R[b.next];
          const ax = Math.max(nr, Math.min(FUSION_W - nr, b.shownAim));
          // La visée se voit de loin : on place en regardant la télé
          g.strokeStyle = team.color;
          g.lineWidth = 6;
          g.setLineDash([10, 12]);
          g.beginPath();
          g.moveTo(ox + ax, OY + 34);
          g.lineTo(ox + ax, OY + FUSION_H);
          g.stroke();
          g.setLineDash([]);
          if (b.cool <= 0) ball(ox + ax, OY + 34, b.next, nr);
        }
        for (const a of b.balls) ball(ox + a.x, OY + a.y, a.l, a.r);
        if ((b.effects.brouillard ?? 0) > 0) {
          // Le brouillard cache le haut du bac et une bonne partie du tas
          g.fillStyle = 'rgba(232,236,242,.93)';
          g.fillRect(ox, OY + 120, FUSION_W, FUSION_H - 240);
        }
        g.restore();
        for (const o of b.pops) {
          g.globalAlpha = Math.min(1, o.life * 2);
          g.font = '700 44px Fredoka, sans-serif';
          g.lineWidth = 8;
          g.strokeStyle = INK;
          // Toujours dans l'écran
          const hw = g.measureText(o.text).width / 2 + 12;
          const px = Math.max(hw, Math.min(1920 - hw, ox + o.x));
          g.strokeText(o.text, px, OY + o.y);
          g.fillStyle = '#ffd60a';
          g.fillText(o.text, px, OY + o.y);
          g.globalAlpha = 1;
        }
        if (b.banner) {
          g.font = '700 58px Fredoka, sans-serif';
          g.lineWidth = 10;
          g.strokeStyle = INK;
          g.strokeText(b.banner.text, ox + FUSION_W / 2, OY + 280, FUSION_W - 30);
          g.fillStyle = '#fff';
          g.fillText(b.banner.text, ox + FUSION_W / 2, OY + 280, FUSION_W - 30);
        }
        g.restore();
      });
      if (winner >= 0) {
        g.fillStyle = 'rgba(58,33,64,.45)';
        g.fillRect(0, 0, 1920, 1080);
        g.textAlign = 'center';
        g.font = '700 110px Fredoka, sans-serif';
        g.lineWidth = 14;
        g.strokeStyle = INK;
        const txt = `${TEAMS[winner].emoji} ${TEAMS[winner].name[ctx.lang]} ${fr ? 'gagne !' : 'wins!'}`;
        g.strokeText(txt, 960, 520, 1700);
        g.fillStyle = TEAMS[winner].color;
        g.fillText(txt, 960, 520, 1700);
      }
    },
    ranking() {
      const lead = winner >= 0 ? winner : boards[0].score >= boards[1].score ? 0 : 1;
      return [...boards[lead].players, ...boards[1 - lead].players].map((p) => p.pid);
    },
    leader: () => null,
    padData(pid): FusionPadData {
      const p = pls.find((x) => x.pid === pid)!;
      const b = boards[p.side];
      const cur = current(b);
      return {
        color: TEAMS[p.side].color,
        team: TEAMS[p.side].name[ctx.lang],
        mine: cur === p && winner < 0,
        who: cur?.profile.name ?? '',
        left: Math.ceil(Math.max(0, b.left)),
        next: b.next,
        score: b.score,
        other: boards[1 - p.side].score,
        banner: b.banner?.text ?? '',
      };
    },
  };
  speak(fr ? 'Chacun son tour, fusionnez, et embêtez les autres !' : 'Take turns, merge, and annoy the others!', ctx.lang);
  return game;
}

export const fusion: GameBase = {
  id: 'fusion',
  emoji: '🍉',
  name: { fr: 'La Bataille des Fusions', en: 'Merge Battle' },
  how: {
    fr: 'Chacun son tour, vise en regardant la télé et lâche un aliment : deux pareils fusionnent et envoient des malus à l’autre équipe (rochers, Glouton…). Si ton bac déborde, c’est perdu !',
    en: 'Take turns: aim while watching the TV and drop food. Two alike merge and send penalties to the other team (boulders, the Glutton…). If your tub overflows, you lose!',
  },
  layout: 'buttons',
  min: 2,
  max: 12,
  botFill: 4,
  music: 'arcade',
  limit: 180,
  limitOpt: 'time',
  timerTop: true,
  // Le premier choix sert aussi au tournoi : 3 minutes, pour ne pas y passer trop de temps
  options: [{ id: 'time', label: { fr: 'Temps', en: 'Time' }, choices: [{ v: 180, label: { fr: '3 min', en: '3 min' } }, { v: 300, label: { fr: '5 min', en: '5 min' } }, { v: 480, label: { fr: '8 min', en: '8 min' } }, { v: 0, label: { fr: 'Jusqu’à ce qu’un bac déborde', en: 'Until a tub overflows' } }] }],
  create,
};
