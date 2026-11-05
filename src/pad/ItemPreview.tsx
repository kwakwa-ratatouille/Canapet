// Essayer avant d'acheter : chaque cosmétique est montré en action, tel qu'il sera à la télé ou sur la manette.
import { useEffect, useMemo } from 'react';
import { CharCanvas } from '../shared/CharCanvas';
import { ENTRIES, PAD_THEMES, REACT_ITEMS, TITLES, TRAILS } from '../shared/cosmetics2';
import { KO_FX, WIN_FX, WIN_POSES, type LootKind } from '../shared/lootTable';
import { PlateName, PlayerFrame } from '../shared/PlayerDeco';
import type { Profile } from '../shared/protocol';
import { playWinSound, speak } from '../shared/sound';

const FIELD_OF: Partial<Record<LootKind, keyof Profile>> = { hat: 'hat', acc: 'acc', color: 'color', eyes: 'eyes', skin: 'skin', pose: 'pose' };

let lastPlay = 0;
/** Joue le son d'un objet quand il y en a un (pas plus d'une fois toutes les 1,5 s : on ne peut pas le mitrailler). */
export function playItem(key: string, profile: Profile) {
  const [kind, id] = key.split(':');
  if (kind !== 'winsound' && kind !== 'entry') return;
  const now = Date.now();
  if (now - lastPlay < 1500) return;
  lastPlay = now;
  if (kind === 'winsound') playWinSound(id);
  if (kind === 'entry') {
    const en = ENTRIES.find((x) => x.id === id);
    if (!en) return;
    if (en.sound) playWinSound(en.sound);
    speak(en.line[profile.lang].replace('{n}', profile.name || 'Cana’pet'), profile.lang, { rate: en.rate, pitch: en.pitch });
  }
}

export function ItemPreview({ item, profile, size = 130 }: { item: string; profile: Profile; size?: number }) {
  const [kind, id] = item.split(':') as [LootKind, string];
  const base = { ...profile, selfie: undefined };
  const sparks = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ i, x: Math.random() * 100, d: Math.random() * 1.6, s: 0.8 + Math.random() * 0.7 })), []);
  // Les objets sonores se font entendre dès l'ouverture
  useEffect(() => {
    if (kind === 'winsound' || kind === 'entry') playItem(item, profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const char = <CharCanvas profile={base} size={size} />;
  switch (kind) {
    case 'food':
      return <div className="prev"><CharCanvas profile={{ ...base, food: id, hat: 'aucun', acc: 'aucun' }} size={size} /></div>;
    case 'hat':
    case 'acc':
    case 'color':
    case 'eyes':
    case 'skin':
    case 'pose':
      return <div className="prev"><CharCanvas profile={{ ...base, [FIELD_OF[kind]!]: id }} size={size} /></div>;
    case 'frame':
      return (
        <div className="prev">
          {/* Avec une photo, le cadre va autour de la photo ; sinon autour de la bulle */}
          <span className="thumb-frame" style={{ width: size * 1.25, height: size * 1.25 }}>
            {!profile.selfie && <PlayerFrame id={id} inset={0} />}
            <CharCanvas profile={{ ...profile, frame: id }} size={size * 0.8} />
          </span>
        </div>
      );
    case 'plate':
      return (
        <div className="prev prev-col">
          {char}
          <span className="prev-name"><PlateName name={profile.name || 'Cana’pet'} plate={id} /></span>
        </div>
      );
    case 'title':
      return (
        <div className="prev prev-col">
          {char}
          <span className="prev-name">{profile.name || 'Cana’pet'}</span>
          <em className="prev-title">« {TITLES.find((x) => x.id === id)?.name[profile.lang]} »</em>
        </div>
      );
    case 'winpose': {
      const wp = WIN_POSES.find((x) => x.id === id);
      return <div className={`prev`}><div className={wp?.anim}><CharCanvas profile={base} size={size} mood="win" arms={!wp?.pose} wp={wp?.pose} /></div></div>;
    }
    case 'trail': {
      const t = TRAILS.find((x) => x.id === id);
      return (
        <div className="prev prev-road">
          {sparks.slice(0, 7).map((s) => (
            <i key={s.i} className="prev-trail" style={{ top: `${50 + (s.i % 5) * 7}%`, animationDelay: `${s.d}s`, background: t?.colors ? t.colors[s.i % t.colors.length] : undefined, width: t?.colors ? 9 * s.s : undefined, height: t?.colors ? 9 * s.s : undefined, fontSize: 13 * s.s }}>
              {t?.icons?.[s.i % t.icons.length]}
            </i>
          ))}
          <div className="prev-runner"><CharCanvas profile={base} size={size * 0.8} /></div>
        </div>
      );
    }
    case 'winfx':
    case 'ko': {
      const fx = kind === 'winfx' ? WIN_FX.find((x) => x.id === id) : KO_FX.find((x) => x.id === id);
      const icons = fx?.icons ?? ['✨'];
      return (
        <div className={`prev prev-tv ${kind}`}>
          <span className="prev-tv-label">📺</span>
          {sparks.map((s) => (
            <i key={s.i} className={kind === 'winfx' ? 'prev-rain' : 'prev-burst'} style={{ left: kind === 'winfx' ? `${s.x}%` : '50%', animationDelay: `${s.d}s`, fontSize: 26 * s.s, ['--a' as string]: `${(s.i / 14) * 360}deg` }}>
              {icons[s.i % icons.length]}
            </i>
          ))}
          {char}
        </div>
      );
    }
    case 'react': {
      const r = REACT_ITEMS.find((x) => x.id === id);
      return (
        <div className="prev prev-tv">
          <span className="prev-tv-label">📺</span>
          <span className={`prev-react ${r?.big ? 'big' : ''}`}>{r?.txt ? r.txt[profile.lang] : r?.e}</span>
          {r?.rain && sparks.map((s) => <i key={s.i} className="prev-rain" style={{ left: `${s.x}%`, animationDelay: `${s.d}s`, fontSize: 26 * s.s }}>{r.e}</i>)}
        </div>
      );
    }
    case 'padtheme': {
      const th = PAD_THEMES.find((x) => x.id === id);
      return (
        <div className={`prev-pad ${th?.anim ? 'anim' : ''}`} style={{ background: th?.bg }}>
          <span className="pp-stick"><i /></span>
          <span className="pp-btns"><b className="a" /><b className="b" /><b className="c" /><b className="d" /></span>
        </div>
      );
    }
    case 'entry': {
      const en = ENTRIES.find((x) => x.id === id);
      return (
        <div className="prev prev-col">
          {char}
          <p className="prev-line">🎙️ {en?.line[profile.lang].replace('{n}', profile.name || 'Cana’pet')}</p>
        </div>
      );
    }
    case 'winsound':
      return <div className="prev prev-col">{char}<p className="prev-line">🎵</p></div>;
    default:
      return <div className="prev">{char}</div>;
  }
}
