import { useEffect, useMemo, useRef, useState } from 'react';
import { CharCanvas } from '../shared/CharCanvas';
import { ACCS, EYE_LIST, FOODS, HATS, POSE_LIST } from '../shared/characters';
import { currentSeason, ENTRIES, FRAMES, PAD_THEMES, PLATES, REACT_ITEMS, seasonDaysLeft, TITLES, TRAILS } from '../shared/cosmetics2';
import { PlateName, PlayerFrame } from '../shared/PlayerDeco';
import { loadControls } from '../shared/controls';
import { boxesNow, COLOR_ITEMS, iconOf, KO_FX, poolOf, RARITIES, RARITY_ORDER, reelItems, rollBox, SKINS, TEST_KEY_PRICE, WIN_FX, WIN_POSES, WIN_SOUNDS, type BoxDef, type BoxRoll, type LootKind, type Rarity } from '../shared/lootTable';
import { KEYS_ALLOWED, SALES_ON } from '../shared/offer';
import type { Progress } from '../shared/progress';
import type { Lang, Profile } from '../shared/protocol';
import { sfx } from '../shared/sound';
import { BoxArt } from './BoxArt';
import { ItemPreview, playItem } from './ItemPreview';
import './box.css';

/** Champ du profil qui porte chaque type d'objet. */
export const FIELD: Record<LootKind, keyof Profile> = { food: 'food', hat: 'hat', acc: 'acc', color: 'color', eyes: 'eyes', skin: 'skin', pose: 'pose', winpose: 'winPose', winsound: 'winSound', ko: 'koFx', winfx: 'winFx', trail: 'trail', frame: 'frame', plate: 'plate', title: 'title', react: 'name', entry: 'entry', padtheme: 'padTheme' };

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
  trail: { fr: 'Traînée', en: 'Trail' },
  frame: { fr: 'Cadre photo', en: 'Photo frame' },
  plate: { fr: 'Style de nom', en: 'Name style' },
  title: { fr: 'Titre', en: 'Title' },
  react: { fr: 'Réaction', en: 'Reaction' },
  entry: { fr: 'Annonce d’entrée', en: 'Entrance' },
  padtheme: { fr: 'Thème de manette', en: 'Controller theme' },
};

export function itemName(key: string, lang: Lang): string {
  const [kind, id] = key.split(':');
  const lists: Record<string, { id: string; name: Record<Lang, string> }[]> = { food: FOODS, hat: HATS, acc: ACCS, color: COLOR_ITEMS, eyes: EYE_LIST, pose: POSE_LIST, skin: SKINS, trail: TRAILS, frame: FRAMES, plate: PLATES, title: TITLES, react: REACT_ITEMS, entry: ENTRIES, padtheme: PAD_THEMES, winpose: WIN_POSES, winsound: WIN_SOUNDS, ko: KO_FX, winfx: WIN_FX };
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
  if (kind === 'frame')
    return (
      <span className="thumb-frame" style={{ width: size * 1.25, height: size * 1.25 }}>
        <PlayerFrame id={id} inset={0} still />
        <CharCanvas profile={{ ...profile, selfie: undefined }} size={size * 0.8} still />
      </span>
    );
  if (kind === 'plate') return <span className="thumb-name"><PlateName name={profile.name || 'Cana’pet'} plate={id} /></span>;
  if (kind === 'title') return <span className="thumb-title">« {TITLES.find((x) => x.id === id)?.name[profile.lang]} »</span>;
  if (kind === 'react') {
    const r = REACT_ITEMS.find((x) => x.id === id);
    return r?.txt ? <span className="thumb-react">{r.txt[profile.lang]}</span> : <span className="thumb-ico" style={{ fontSize: size * 0.7 }}>{r?.e}</span>;
  }
  if (kind === 'padtheme') {
    const th = PAD_THEMES.find((x) => x.id === id);
    return <span className="thumb-theme" style={{ background: th?.bg }}>🎮</span>;
  }
  return <span className="thumb-ico" style={{ fontSize: size * 0.7 }}>{iconOf(item)}</span>;
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
          <span className="box-big shake"><BoxArt box={box} size={190 * box.scale} /></span>
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
                <ItemPreview item={roll.key} profile={profile} size={130} />
              </div>
              <h2>{itemName(roll.key, lang)}</h2>
              <p className="pad-small">{KIND_NAME[kind!][lang]}</p>
              {(kind === 'winsound' || kind === 'entry') && (
                <button className="btn alt" onClick={() => playItem(roll.key!, profile)}>
                  🔊 {fr ? 'Écouter' : 'Listen'}
                </button>
              )}
              <button className="btn big mint" onClick={() => { equip(roll.key!); close(); }}>
                {kind === 'react' ? (fr ? '🎉 Ajoutée à mes réactions' : '🎉 Added to my reactions') : `✨ ${fr ? 'Équiper' : 'Equip'}`}
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


export interface BoxAccount {
  signedIn: boolean;
  connect: () => void;
  keys: number;
  /** Coffre ouvert par le serveur (clés payantes). */
  openChest: () => Promise<{ key: string | null; rarity: Rarity; pity: number }>;
  buyKeys: () => void;
}

/** Barre des chances : une couleur par rareté. */
function OddsBar({ box, lang }: { box: BoxDef; lang: Lang }) {
  const rs = RARITY_ORDER.filter((r) => box.odds[r]);
  return (
    <div className="odds">
      <div className="odds-bar">
        {rs.map((r) => <i key={r} style={{ width: `${box.odds[r]}%`, background: RARITIES[r].color }} />)}
      </div>
      <div className="odds-legend">
        {rs.map((r) => (
          <span key={r}><i style={{ background: RARITIES[r].color }} />{RARITIES[r].name[lang]} <b>{box.odds[r]} %</b></span>
        ))}
      </div>
    </div>
  );
}

/** Tout ce qu'une boîte peut donner, avec un aperçu de l'objet touché. */
function BoxContent({ box, owned, profile, lang, close }: { box: BoxDef; owned: string[]; profile: Profile; lang: Lang; close: () => void }) {
  const fr = lang === 'fr';
  const rs = RARITY_ORDER.filter((r) => box.odds[r]);
  const [sel, setSel] = useState(() => poolOf(box, rs[rs.length - 1])[0] ?? poolOf(box, rs[0])[0]);
  return (
    <div className="content-veil" style={{ ['--box' as string]: box.color }}>
      <header>
        <BoxArt box={box} size={46} />
        <b>{box.name[lang]}</b>
        <button className="invite-no" onClick={close} aria-label={fr ? 'Fermer' : 'Close'}>✕</button>
      </header>
      {sel && (
        <div className="content-stage" key={sel}>
          <ItemPreview item={sel} profile={profile} size={96} />
          <p>
            <b>{itemName(sel, lang)}</b>
            <small>{KIND_NAME[sel.split(':')[0] as LootKind][lang]}</small>
          </p>
        </div>
      )}
      <div className="content-list">
        {rs.map((r) => {
          const all = poolOf(box, r);
          return (
            <section key={r} style={{ ['--rar' as string]: RARITIES[r].color }}>
              <h4>{RARITIES[r].name[lang]} · {box.odds[r]} % <small>{all.filter((k) => owned.includes(k)).length}/{all.length}</small></h4>
              <div className="content-grid">
                {all.map((k) => (
                  <button key={k} className={`content-item ${sel === k ? 'on' : ''} ${owned.includes(k) ? 'mine' : ''}`} onClick={() => setSel(k)}>
                    <ItemThumb item={k} profile={profile} size={48} />
                    <small>{itemName(k, lang)}</small>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Onglet Boîtes du salon. */
export function BoxShop({ progress, setProgress, profile, setProfile, lang, account }: { progress: Progress; setProgress: (f: (p: Progress) => Progress) => void; profile: Profile; setProfile: (f: (p: Profile) => Profile) => void; lang: Lang; account: BoxAccount }) {
  const fr = lang === 'fr';
  const [open, setOpen] = useState<{ box: BoxDef; roll: BoxRoll } | null>(null);
  const [view, setView] = useState<BoxDef | null>(null);
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
    if (kind === 'react') return; // Une réaction n'a pas besoin d'être équipée : elle rejoint la liste
    setProfile((p) => ({ ...p, [FIELD[kind]]: id }));
  };
  const left = (box: BoxDef) => Math.max(1, box.pity - (progress.pity?.[box.id] ?? 0));
  const season = currentSeason();
  const myKeys = SALES_ON ? account.keys : progress.testKeys ?? 0;

  return (
    <div className="box-shop">
      <div className="box-coins">
        <span>🍬 {progress.coins}</span>
        <span>🔑 {myKeys}</span>
      </div>
      {boxesNow().map((box) => {
        const free = progress.boxes?.[box.id] ?? 0;
        const chest = box.id === 'coffre';
        return (
          <article key={box.id} className={`box-card box-${box.id} ${box.season ? 'limited' : ''}`} style={{ ['--box' as string]: box.color }}>
            {box.season && season && (
              <div className="limited-ribbon">
                <b>⏳ {fr ? 'Édition limitée' : 'Limited edition'}</b>
                <span>{fr ? `Plus que ${seasonDaysLeft(season)} jour${seasonDaysLeft(season) > 1 ? 's' : ''}` : `${seasonDaysLeft(season)} day${seasonDaysLeft(season) > 1 ? 's' : ''} left`}</span>
              </div>
            )}
            <div className="box-top">
              <span className="box-pic"><i className="box-glow" /><BoxArt box={box} size={92 * box.scale} /></span>
              <div className="box-txt">
                <h3>{box.name[lang]}</h3>
                {box.season && <p>{fr ? 'Objets introuvables ailleurs. Revient l’an prochain.' : 'Items you won’t find anywhere else. Back next year.'}</p>}
                {chest && <p>{fr ? 'Que du légendaire et du mythique.' : 'Only legendary and mythic items.'}</p>}
                <OddsBar box={box} lang={lang} />
              </div>
            </div>
            <div className="box-acts">
              {free > 0 && (
                <button className="box-buy free" onClick={() => openLocal(box, { free: true })}>
                  🎁 {fr ? 'Ouvrir ma boîte' : 'Open my box'}{free > 1 && <b>×{free}</b>}
                </button>
              )}
              {!chest && (
                <button className="box-buy" disabled={progress.coins < box.price} onClick={() => openLocal(box, {})}>
                  {fr ? 'Ouvrir' : 'Open'} <small>{box.price} 🍬</small>
                </button>
              )}
              {chest && !KEYS_ALLOWED && <p className="box-note">{fr ? 'Coffre indisponible dans ton pays.' : 'Chest not available in your country.'}</p>}
              {chest && KEYS_ALLOWED && (
                <>
                  <button className="box-buy" disabled={busy || myKeys < 1} onClick={() => (SALES_ON ? openPaidChest(box) : openLocal(box, { testKey: true }))}>
                    {busy ? '…' : fr ? 'Ouvrir' : 'Open'} <small>1 🔑</small>
                  </button>
                  {SALES_ON ? (
                    <button className="box-buy alt" onClick={account.buyKeys}>🛒 {fr ? 'Clés' : 'Keys'}</button>
                  ) : (
                    <button className="box-buy alt" disabled={progress.coins < TEST_KEY_PRICE} onClick={() => setProgress((p) => ({ ...p, coins: p.coins - TEST_KEY_PRICE, testKeys: (p.testKeys ?? 0) + 1 }))}>
                      +1 🔑 <small>{TEST_KEY_PRICE} 🍬</small>
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="box-foot">
              <button onClick={() => setView(box)}>👀 {fr ? 'Voir le contenu' : 'See contents'}</button>
              <span>🎯 {RARITIES[box.top].name[lang]} {fr ? `garanti en ${left(box)} max` : `within ${left(box)}`}</span>
            </div>
          </article>
        );
      })}
      {msg && <p className="box-note">{msg}</p>}
      <div className="box-promises">
        <span><b>🚫</b>{fr ? 'Jamais de doublon' : 'No duplicates'}</span>
        <span><b>🎯</b>{fr ? 'Gros lot garanti' : 'Top prize guaranteed'}</span>
        <span><b>🤝</b>{fr ? 'Style seulement' : 'Style only'}</span>
      </div>
      {view && <BoxContent box={view} owned={progress.owned} profile={profile} lang={lang} close={() => setView(null)} />}
      {open && <Opening box={open.box} roll={open.roll} profile={profile} lang={lang} equip={equip} close={() => setOpen(null)} />}
    </div>
  );
}
