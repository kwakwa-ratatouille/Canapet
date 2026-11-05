import { useState } from 'react';
import { DEFAULT_CONTROLS, loadControls, saveControls, type Btn, type Controls } from '../shared/controls';
import type { Lang } from '../shared/protocol';

const LETTER: Record<Btn, string> = { a: 'A', b: 'B', c: 'X', d: 'Y' };

/** Un interrupteur clair : titre, explication, bouton qui glisse. */
function Toggle({ on, icon, title, desc, onChange }: { on: boolean; icon: string; title: string; desc: string; onChange: () => void }) {
  return (
    <button className="set-toggle" onClick={onChange} role="switch" aria-checked={on}>
      <span className="set-ico">{icon}</span>
      <span className="set-txt">
        <b>{title}</b>
        <small>{desc}</small>
      </span>
      <span className={`set-switch ${on ? 'on' : ''}`}><i /></span>
    </button>
  );
}

/** Réglages du téléphone, rangés par thème. */
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
  const changed = JSON.stringify(c.slots) !== JSON.stringify(DEFAULT_CONTROLS.slots) || c.mirror || c.size !== DEFAULT_CONTROLS.size;
  return (
    <>
      <section className="set-card">
        <h3>🎮 {fr ? 'Ma manette' : 'My controller'}</h3>
        <p className="set-help">
          {first
            ? fr ? `Bouton ${LETTER[first]} choisi : touche celui avec lequel l’échanger.` : `${LETTER[first]} selected: tap the button to swap it with.`
            : fr ? 'Voici ta manette en jeu. Pour changer un bouton de place, touche-le, puis touche sa nouvelle place.' : 'This is your in-game controller. To move a button, tap it, then tap its new spot.'}
        </p>
        <div className={`set-pad ${c.mirror ? 'mirror' : ''}`}>
          <span className="set-stick"><i /></span>
          <div className="ab four ctl-preview" style={{ transform: `scale(${c.size})` }}>
            <div className="ab-cluster">
              {(['c', 'd', 'b', 'a'] as Btn[]).map((b) => (
                <button key={b} className={`ab-btn ${b} slot-${c.slots[b]} ${first === b ? 'picked' : ''}`} onClick={() => tap(b)} aria-label={`Bouton ${LETTER[b]}`}>
                  <i>{LETTER[b]}</i>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="set-seg">
          <span>{fr ? 'Taille des boutons' : 'Button size'}</span>
          <div>
            {[0.85, 1, 1.15].map((s, i) => (
              <button key={s} className={c.size === s ? 'on' : ''} onClick={() => update({ ...c, size: s })}>
                {(fr ? ['Petits', 'Moyens', 'Grands'] : ['Small', 'Medium', 'Large'])[i]}
              </button>
            ))}
          </div>
        </div>
        <Toggle on={c.mirror} icon="🫲" title={fr ? 'Mode gaucher' : 'Left-handed mode'} desc={fr ? 'Le stick passe à droite et les boutons à gauche' : 'Stick on the right, buttons on the left'} onChange={() => update({ ...c, mirror: !c.mirror })} />
        <Toggle on={c.vibrate} icon="📳" title={fr ? 'Vibrations' : 'Vibration'} desc={fr ? 'Le téléphone vibre pendant le jeu' : 'The phone vibrates during games'} onChange={() => update({ ...c, vibrate: !c.vibrate })} />
        {changed && (
          <button className="link-btn" onClick={() => update({ ...DEFAULT_CONTROLS, noBoxAnim: c.noBoxAnim, vibrate: c.vibrate })}>
            {fr ? 'Remettre les boutons comme au début' : 'Reset the buttons'}
          </button>
        )}
      </section>
      <section className="set-card">
        <h3>🎁 {fr ? 'Boîtes' : 'Boxes'}</h3>
        <Toggle on={!c.noBoxAnim} icon="🎰" title={fr ? 'Animation d’ouverture' : 'Opening animation'} desc={fr ? 'Le bandeau qui défile. Coupée, le gain s’affiche tout de suite' : 'The spinning reel. Off, the prize shows at once'} onChange={() => update({ ...c, noBoxAnim: !c.noBoxAnim })} />
      </section>
    </>
  );
}
