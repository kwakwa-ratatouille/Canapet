import { useState } from 'react';
import { DEFAULT_CONTROLS, loadControls, saveControls, type Btn, type Controls } from '../shared/controls';
import type { Lang } from '../shared/protocol';

const LETTER: Record<Btn, string> = { a: 'A', b: 'B', c: 'X', d: 'Y' };

/** Réglages de la manette : on touche deux boutons pour les échanger. */
export function ControlsCard({ lang }: { lang: Lang }) {
  const fr = lang === 'fr';
  const [c, setC] = useState<Controls>(loadControls);
  const [first, setFirst] = useState<Btn | null>(null);
  const update = (n: Controls) => {
    setC(n);
    saveControls(n);
  };
  const tap = (b: Btn) => {
    navigator.vibrate?.(15);
    if (!first) return setFirst(b);
    if (first !== b) update({ ...c, slots: { ...c.slots, [first]: c.slots[b], [b]: c.slots[first] } });
    setFirst(null);
  };
  return (
    <div className="controls-card">
      <p className="opt-title">🎮 {fr ? 'Ma manette' : 'My controller'}</p>
      <p className="pad-small">{first ? (fr ? `Touche le bouton à échanger avec ${LETTER[first]}` : `Tap the button to swap with ${LETTER[first]}`) : fr ? 'Touche deux boutons pour les échanger.' : 'Tap two buttons to swap them.'}</p>
      <div className="ab four ctl-preview">
        <div className="ab-cluster">
          {(['c', 'd', 'b', 'a'] as Btn[]).map((b) => (
            <button key={b} className={`ab-btn ${b} slot-${c.slots[b]} ${first === b ? 'picked' : ''}`} onClick={() => tap(b)}>
              <i>{LETTER[b]}</i>
            </button>
          ))}
        </div>
      </div>
      <div className="ctl-rows">
        <button className={`ctl-toggle ${c.mirror ? 'on' : ''}`} onClick={() => update({ ...c, mirror: !c.mirror })} aria-pressed={c.mirror}>
          🫲 {fr ? 'Stick à droite, boutons à gauche' : 'Stick right, buttons left'}
          <b>{c.mirror ? '✓' : ''}</b>
        </button>
        <button className={`ctl-toggle ${c.vibrate ? 'on' : ''}`} onClick={() => update({ ...c, vibrate: !c.vibrate })} aria-pressed={c.vibrate}>
          📳 {fr ? 'Vibrations' : 'Vibration'}
          <b>{c.vibrate ? '✓' : ''}</b>
        </button>
        <div className="ctl-size">
          <span>{fr ? 'Taille des boutons' : 'Button size'}</span>
          {[0.85, 1, 1.15].map((s, i) => (
            <button key={s} className={`pill ${c.size === s ? 'on' : ''}`} onClick={() => update({ ...c, size: s })}>
              {['S', 'M', 'L'][i]}
            </button>
          ))}
        </div>
        <button className="link-btn" onClick={() => update(DEFAULT_CONTROLS)}>
          {fr ? 'Remettre par défaut' : 'Reset to default'}
        </button>
      </div>
    </div>
  );
}
