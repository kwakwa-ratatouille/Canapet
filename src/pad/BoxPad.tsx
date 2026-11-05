import { useEffect, useMemo, useRef, useState } from 'react';
import { CharCanvas } from '../shared/CharCanvas';
import { ACCS, EYE_LIST, FOODS, HATS, POSE_LIST } from '../shared/characters';
import { loadControls } from '../shared/controls';
import { BOXES, COLOR_ITEMS, iconOf, KO_FX, LOOT_PRICES, RARITIES, rarityOf, reelItems, rollBox, SKINS, TEST_KEY_PRICE, WIN_FX, WIN_POSES, WIN_SOUNDS, type BoxDef, type BoxRoll, type LootKind, type Rarity } from '../shared/lootTable';
import { KEYS_ALLOWED, SALES_ON } from '../shared/offer';
import type { Progress } from '../shared/progress';
import type { Lang, Profile } from '../shared/protocol';
import { dailyNow, questsNow, weekNow } from '../shared/quests';
import { playWinSound, sfx } from '../shared/sound';
import './box.css';

/** Champ du profil qui porte chaque type d'objet. */
export const FIELD: Record<LootKind, keyof Profile> = { food: 'food', hat: 'hat', acc: 'acc', color: 'color', eyes: 'eyes', skin: 'skin', pose: 'pose', winpose: 'winPose', winsound: 'winSound', ko: 'koFx', winfx: 'winFx' };

const KIND_NAME: Record<LootKind, Record<Lang, string>> = {
  food: { fr: 'Perso', en: 'Character' },
  hat: { fr: 'Chapeau', en: 'Hat' },
  acc: { fr: 'Déco', en: 'Extra' },
  color: { fr: 'Couleur', en: 'Color' },
  eyes: { fr: 'Regard', en: 'Eyes' },
  skin: { fr: 'Couleur de perso', en: 'Character paint' },
  pose: { fr: 'Pose', en: 'Pose' },
  winpose: { fr: 'Pose de victoire', en: 'Victory pose' },
  winsound: { fr: 'Son de victoire', en: 'Victory sound' },
  ko: { fr: 'Effet d’élimination', en: 'Knockout effect' },
  winfx: { fr: 'Effet d’écran', en: 'Screen effect' },
};

export function itemName(key: string, lang: Lang): string {
  const [kind, id] = key.split(':');
  const lists: Record<string, { id: string; name: Record<Lang, string> }[]> = { food: FOODS, hat: HATS, acc: ACCS, color: COLOR_ITEMS, eyes: EYE_LIST, pose: POSE_LIST, skin: SKINS, winpose: WIN_POSES, winsound: WIN_SOUNDS, ko: KO_FX, winfx: WIN_FX };
  return lists[kind]?.find((x) => x.id === id)?.name[lang] ?? id;
}

/** Aperçu d'un objet : le perso qui le porte, ou son icône. */
export function ItemThumb({ item, profile, size }: { item: string; profile: Profile; size: number }) {
  const [kind, id] = item.split(':') as [LootKind, string];
  if (kind === 'food' || kind === 'hat' || kind === 'acc' || kind === 'skin' || kind === 'pose' || kind === 'color' || kind === 'eyes') {
    const base = { ...profile, selfie: undefined };
    const shown = kind === 'food' ? { ...base, food: id, hat: 'aucun', acc: 'aucun' } : { ...base, [FIELD[kind]]: id };
    return <CharCanvas profile={shown} size={size} still={size < 80} />;
  }
  return <span className="thumb-ico" style={{ fontSize: size * 0.7 }}>{iconOf(item)}</span>;
}

/** La boîte dessinée, à sa couleur : plus elle est grosse, plus elle est décorée. */
function BoxIcon({ box, size }: { box: BoxDef; size: number }) {
  const ink = '#3a2140';
  if (box.id === 'coffre')
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <path d="M12 44C12 18 88 18 88 44V52H12Z" fill="#b5532a" stroke={ink} strokeWidth="5" />
        <rect x="12" y="50" width="76" height="38" rx="6" fill="#d9713c" stroke={ink} strokeWidth="5" />
        <path d="M28 26V88M72 26V88" stroke="#ffc400" strokeWidth="7" />
        <rect x="39" y="42" width="22" height="26" rx="5" fill="#ffc400" stroke={ink} strokeWidth="5" />
        <circle cx="50" cy="53" r="4" fill={ink} />
        <path d="M50 53V62" stroke={ink} strokeWidth="4" />
      </svg>
    );
  const big = box.id === 'grosse';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <rect x="16" y="42" width="68" height="46" rx="6" fill={box.color} stroke={ink} strokeWidth="5" />
      <rect x="10" y="28" width="80" height="20" rx="6" fill={box.color} stroke={ink} strokeWidth="5" />
      <rect x="42" y="28" width="16" height="60" fill="#fff" stroke={ink} strokeWidth="4" />
      <path d="M50 28C38 8 18 12 24 22C28 29 42 28 50 28C58 28 72 29 76 22C82 12 62 8 50 28Z" fill="#ffc400" stroke={ink} strokeWidth="5" />
      {big && <path d="M24 58l3 7l7 1l-5 5l1 7l-6-3l-6 3l1-7l-5-5l7-1ZM76 58l3 7l7 1l-5 5l1 7l-6-3l-6 3l1-7l-5-5l7-1Z" fill="#ffc400" stroke={ink} strokeWidth="2.5" transform="translate(0 -2)" />}
    </svg>
  );
}

/** Barre de progression d'une mission. */
function Bar({ have, n }: { have: number; n: number }) {
  return (
    <span className="mission-bar">
      <i style={{ width: `${Math.min(100, (have / n) * 100)}%` }} />
    </span>
  );
}

/** Missions du jour, de la semaine et caisse de la semaine. */
export function Missions({ progress, lang }: { progress: Progress; lang: Lang }) {
  const fr = lang === 'fr';
  const week = weekNow(progress.habits);
  const streak = progress.habits?.streak ?? 0;
  const row = (q: { id: string; label: Record<Lang, string>; have: number; n: number; gift: number; ok: boolean }) => (
    <div key={q.id} className={`mission ${q.ok ? 'ok' : ''}`}>
      <span className="mission-top">
        <span>{q.ok ? '✅' : '🎯'} {q.label[lang]}</span>
        <small>+{q.gift} 🍬</small>
      </span>
      <span className="mission-low">
        <Bar have={q.have} n={q.n} />
        <small>{q.have}/{q.n}</small>
      </span>
    </div>
  );
  return (
    <div className="missions">
      <p className="opt-title">☀️ {fr ? 'Défis du jour' : 'Today’s challenges'}{streak > 1 ? ` · 🔥 ${streak} ${fr ? 'jours' : 'days'}` : ''}</p>
      <div className={`mission ${week.todayDone ? 'ok' : ''}`}>
        <span className="mission-top">
          <span>{week.todayDone ? '✅' : '🎁'} {fr ? 'Joue une partie : caisse gratuite du jour' : 'Play one game: free daily crate'}</span>
          <small>{fr ? 'Petite boîte' : 'Small box'}</small>
        </span>
        <span className="mission-low">
          <Bar have={week.todayDone ? 1 : 0} n={1} />
          <small>{week.todayDone ? 1 : 0}/1</small>
        </span>
      </div>
      {dailyNow(progress.habits).map(row)}
      <p className="opt-title">📅 {fr ? 'Défis de la semaine' : 'This week’s challenges'}</p>
      <div className={`mission week ${week.boxGot ? 'ok' : ''}`}>
        <span className="mission-top">
          <span>{week.boxGot ? '✅' : '🎁'} {fr ? 'Joue tous les jours : caisse de la semaine' : 'Play every day: weekly crate'}</span>
          <small>{fr ? 'Grosse boîte' : 'Big box'}</small>
        </span>
        <span className="week-pips">
          {week.pips.map((p, i) => (
            <i key={i} className={p}>{(fr ? 'LMMJVSD' : 'MTWTFSS')[i]}</i>
          ))}
        </span>
        <span className="mission-low">
          <Bar have={week.days} n={7} />
          <small>{week.days}/7</small>
        </span>
      </div>
      {questsNow(progress.habits).map(row)}
    </div>
  );
}

const PARTS = { commun: 14, rare: 26, epique: 42, legendaire: 70, mythique: 110 } satisfies Record<Rarity, number>;
const CELL = 112;
const WIN_AT = 42;
const LENGTH = 50;

/** Ouverture façon roulette : la boîte tremble, le bandeau défile puis ralentit sur le gain. */
function Opening({ box, roll, profile, lang, equip, close }: { box: BoxDef; roll: BoxRoll; profile: Profile; lang: Lang; equip: (key: string) => void; close: () => void }) {
  const fr = lang === 'fr';
  const controls = useMemo(loadControls, []);
  const animate = !controls.noBoxAnim && !!roll.key;
  const [step, setStep] = useState<'shake' | 'reel' | 'done'>(animate ? 'shake' : 'done');
  const reel = useMemo(() => reelItems(box, roll.key, roll.rarity, WIN_AT, LENGTH), [box, roll]);
  const track = useRef<HTMLDivElement>(null);
  // Arrêt pas tout à fait au milieu de la case, comme une vraie roue
  const jitter = useMemo(() => (Math.random() - 0.5) * CELL * 0.7, []);
  const vibrate = (ms: number | number[]) => controls.vibrate && navigator.vibrate?.(ms);

  useEffect(() => {
    if (step === 'shake') {
      sfx.boxShake();
      const id = setTimeout(() => setStep('reel'), 950);
      return () => clearTimeout(id);
    }
    if (step === 'done') {
      sfx.boxReveal(roll.rarity);
      vibrate(roll.rarity === 'mythique' ? [60, 40, 60, 40, 200] : roll.rarity === 'legendaire' ? [60, 40, 120] : 40);
      return;
    }
    const el = track.current!;
    const wrap = el.parentElement!;
    // Le gagnant finit sous le repère, au centre
    const end = -(WIN_AT * CELL + CELL / 2 - wrap.clientWidth / 2 + jitter);
    let raf = 0;
    let last = 0;
    // Plus la boîte et le gain sont rares, plus la fin fait durer le suspense
    const duration = 5200 + (box.id === 'coffre' ? 1400 : box.id === 'grosse' ? 800 : 0);
    requestAnimationFrame(() => {
      el.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.72, 0.1, 1)`;
      el.style.transform = `translateX(${end}px)`;
    });
    const tick = () => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const i = Math.floor((wrap.clientWidth / 2 - m.m41) / CELL);
      if (i !== last) {
        last = i;
        sfx.boxTick();
        vibrate(4);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = setTimeout(() => setStep('done'), duration + 450);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const rar = RARITIES[roll.rarity];
  const kind = roll.key?.split(':')[0] as LootKind | undefined;
  const parts = useMemo(() => Array.from({ length: PARTS[roll.rarity] }, (_, i) => ({ i, a: Math.random() * 360, d: 90 + Math.random() * 190, s: 6 + Math.random() * 10, t: Math.random() * 0.25 })), [roll.rarity]);

  return (
    <div className={`box-open box-${box.id} ${step === 'done' ? `reveal r-${roll.rarity}` : ''}`} style={{ ['--box' as string]: box.color, ['--rar' as string]: rar.color }}>
      {step === 'shake' && (
        <div className="box-stage">
          <span className="box-big shake"><BoxIcon box={box} size={170 * box.scale} /></span>
          <b>{box.name[lang]}</b>
        </div>
      )}
      {step === 'reel' && (
        <div className="box-stage">
          <b>{box.name[lang]}</b>
          <div className="reel">
            <div className="reel-mark" />
            <div className="reel-track" ref={track}>
              {reel.map((it, i) => (
                <div key={i} className="reel-cell" style={{ ['--c' as string]: RARITIES[it.rarity].color }}>
                  <ItemThumb item={it.key} profile={profile} size={64} />
                  <small>{RARITIES[it.rarity].name[lang]}</small>
                </div>
              ))}
            </div>
          </div>
          <button className="btn ghost" onClick={() => setStep('done')}>
            {fr ? 'Passer' : 'Skip'}
          </button>
        </div>
      )}
      {step === 'done' && (
        <div className="box-stage">
          <span className="rays" />
          {animate && parts.map((p) => <i key={p.i} className="spark" style={{ ['--a' as string]: `${p.a}deg`, ['--d' as string]: `${p.d}px`, width: p.s, height: p.s, animationDelay: `${p.t}s` }} />)}
          {roll.key ? (
            <>
              <p className="rar-tag">{rar.name[lang]}</p>
              <div className="won-item">
                <ItemThumb item={roll.key} profile={profile} size={150} />
              </div>
              <h2>{itemName(roll.key, lang)}</h2>
              <p className="pad-small">{KIND_NAME[kind!][lang]}</p>
              {kind === 'winsound' && (
                <button className="btn alt" onClick={() => playWinSound(roll.key!.split(':')[1])}>
                  🔊 {fr ? 'Écouter' : 'Listen'}
                </button>
              )}
              <button className="btn big mint" onClick={() => { equip(roll.key!); close(); }}>
                ✨ {fr ? 'Équiper' : 'Equip'}
              </button>
              <button className="btn ghost" onClick={close}>
                {fr ? 'Garder pour plus tard' : 'Keep for later'}
              </button>
            </>
          ) : (
            <>
              <h2>🏆 {fr ? 'Tu as déjà tout !' : 'You have it all!'}</h2>
              <p>{fr ? `Cette boîte n’a plus rien de nouveau : ${roll.refund} 🍬 rendus.` : `This box has nothing new left: ${roll.refund} 🍬 back.`}</p>
              <button className="btn big mint" onClick={close}>OK</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const TABLE_KEYS = Object.keys(LOOT_PRICES);

export interface BoxAccount {
  signedIn: boolean;
  connect: () => void;
  keys: number;
  /** Coffre ouvert par le serveur (clés payantes). */
  openChest: () => Promise<{ key: string | null; rarity: Rarity; pity: number }>;
  buyKeys: () => void;
}

/** Onglet Boîtes du salon. */
export function BoxShop({ progress, setProgress, profile, setProfile, lang, account }: { progress: Progress; setProgress: (f: (p: Progress) => Progress) => void; profile: Profile; setProfile: (f: (p: Profile) => Profile) => void; lang: Lang; account: BoxAccount }) {
  const fr = lang === 'fr';
  const [open, setOpen] = useState<{ box: BoxDef; roll: BoxRoll } | null>(null);
  const [odds, setOdds] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  /** Ouvre une boîte payée en bonbons, offerte, ou avec une clé d'essai. */
  const openLocal = (box: BoxDef, pay: { free?: boolean; testKey?: boolean }) => {
    const roll = rollBox(box, progress.owned, progress.pity?.[box.id] ?? 0);
    setProgress((p) => ({
      ...p,
      coins: p.coins - (pay.free || pay.testKey ? 0 : box.price) + roll.refund,
      testKeys: (p.testKeys ?? 0) - (pay.testKey ? 1 : 0),
      boxes: pay.free ? { ...p.boxes, [box.id]: Math.max(0, (p.boxes?.[box.id] ?? 0) - 1) } : p.boxes,
      pity: { ...p.pity, [box.id]: roll.pity },
      owned: roll.key ? [...new Set([...p.owned, roll.key])] : p.owned,
    }));
    setOpen({ box, roll });
  };
  const openPaidChest = (box: BoxDef) => {
    setBusy(true);
    setMsg('');
    account
      .openChest()
      .then((r) => {
        if (r.key) setProgress((p) => ({ ...p, owned: [...new Set([...p.owned, r.key!])] }));
        setOpen({ box, roll: { key: r.key, rarity: r.rarity, refund: 0, pity: r.pity } });
      })
      .catch(() => setMsg(fr ? 'Le coffre n’a pas pu s’ouvrir, ta clé est gardée. Réessaie.' : 'The chest could not open, your key is safe. Try again.'))
      .finally(() => setBusy(false));
  };
  const equip = (key: string) => {
    const [kind, id] = key.split(':') as [LootKind, string];
    setProfile((p) => ({ ...p, [FIELD[kind]]: id }));
  };
  const left = (box: BoxDef) => Math.max(1, box.pity - (progress.pity?.[box.id] ?? 0));

  return (
    <div className="box-shop">
      <div className="box-coins">
        <span>🍬 {progress.coins}</span>
        <span>🔑 {SALES_ON ? account.keys : progress.testKeys ?? 0}</span>
      </div>
      <div className="box-list">
        {BOXES.map((box) => {
          const free = progress.boxes?.[box.id] ?? 0;
          const chest = box.id === 'coffre';
          const myKeys = SALES_ON ? account.keys : progress.testKeys ?? 0;
          return (
            <div key={box.id} className={`box-card ${chest ? 'chest' : ''}`} style={{ ['--box' as string]: box.color }}>
              <span className="box-pic"><BoxIcon box={box} size={72 * box.scale} /></span>
              <div className="box-txt">
                <b>{box.name[lang]}</b>
                <span className="box-odds">
                  {(Object.keys(box.odds) as Rarity[]).map((r) => (
                    <em key={r} style={{ background: RARITIES[r].color }}>{RARITIES[r].name[lang]} {box.odds[r]} %</em>
                  ))}
                </span>
                <small>{fr ? `${RARITIES[box.top].name.fr} garanti dans ${left(box)} boîte${left(box) > 1 ? 's' : ''} max` : `${RARITIES[box.top].name.en} guaranteed within ${left(box)} box${left(box) > 1 ? 'es' : ''}`}</small>
              </div>
              <div className="box-acts">
                {free > 0 && (
                  <button className="btn mint" onClick={() => openLocal(box, { free: true })}>
                    🎉 {fr ? 'Offerte' : 'Free'} ×{free}
                  </button>
                )}
                {!chest && (
                  <button className="btn" disabled={progress.coins < box.price} onClick={() => openLocal(box, {})}>
                    {box.price} 🍬
                  </button>
                )}
                {chest && !KEYS_ALLOWED && <small>{fr ? 'Coffre indisponible dans ton pays.' : 'Chest not available in your country.'}</small>}
                {chest && KEYS_ALLOWED && (
                  <>
                    <button className="btn" disabled={busy || myKeys < 1} onClick={() => (SALES_ON ? openPaidChest(box) : openLocal(box, { testKey: true }))}>
                      {busy ? '…' : `${fr ? 'Ouvrir' : 'Open'} · 1 🔑`}
                    </button>
                    {SALES_ON ? (
                      <button className="btn alt" onClick={account.buyKeys}>🛒 {fr ? 'Clés' : 'Keys'}</button>
                    ) : (
                      <button className="btn alt" disabled={progress.coins < TEST_KEY_PRICE} onClick={() => setProgress((p) => ({ ...p, coins: p.coins - TEST_KEY_PRICE, testKeys: (p.testKeys ?? 0) + 1 }))}>
                        🔑 {TEST_KEY_PRICE} 🍬
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {msg && <p className="pad-small uc-note">{msg}</p>}
      <p className="pad-small">{fr ? 'Pas de doublon : une boîte donne toujours un objet que tu n’as pas. Si une rareté est complète, tu reçois la rareté voisine. Rien ne donne d’avantage en jeu.' : 'No duplicates: a box always gives an item you don’t own. If a rarity is complete, you get the next one. Nothing gives an in-game advantage.'}</p>
      {!SALES_ON && <p className="pad-small">{fr ? '🧪 Phase de test : les clés s’obtiennent avec des bonbons.' : '🧪 Test phase: keys are bought with candies.'}</p>}
      <button className="link-btn" onClick={() => setOdds(!odds)}>
        {odds ? (fr ? 'Fermer' : 'Close') : fr ? 'Voir tout ce qu’on peut gagner' : 'See everything you can win'}
      </button>
      {odds && <OddsList lang={lang} owned={progress.owned} />}
      <Missions progress={progress} lang={lang} />
      {open && <Opening box={open.box} roll={open.roll} profile={profile} lang={lang} equip={equip} close={() => setOpen(null)} />}
    </div>
  );
}

function OddsList({ lang, owned }: { lang: Lang; owned: string[] }) {
  return (
    <div className="odds-list">
      {(Object.keys(RARITIES) as Rarity[]).map((r) => {
        const all = TABLE_KEYS.filter((k) => rarityOf(k) === r);
        return (
          <div key={r}>
            <b style={{ color: RARITIES[r].color }}>{RARITIES[r].name[lang]} · {all.filter((k) => owned.includes(k)).length}/{all.length}</b>
            <p>{all.map((k) => `${owned.includes(k) ? '✅ ' : ''}${itemName(k, lang)}`).join(' · ')}</p>
          </div>
        );
      })}
    </div>
  );
}
