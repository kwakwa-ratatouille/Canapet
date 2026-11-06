// Défis du jour (orange) et de la semaine (violet), avec difficulté, barre et récompense à récupérer.
import { useEffect, useState } from 'react';
import type { Progress } from '../shared/progress';
import type { Lang } from '../shared/protocol';
import { claimQuest, dailyNow, questsNow, weekNow } from '../shared/quests';
import { sfx } from '../shared/sound';

const DIFF = [
  { fr: 'Facile', en: 'Easy', c: '#22c99a' },
  { fr: 'Moyen', en: 'Medium', c: '#ff9d0a' },
  { fr: 'Dur', en: 'Hard', c: '#ff3b5c' },
];

/** Bonbons qui jaillissent quand on récupère. */
function Burst({ gift, seed }: { gift: number; seed: number }) {
  return (
    <span className="claim-burst" key={seed} aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <i key={i} style={{ ['--a' as string]: `${(i / 16) * 360}deg`, ['--d' as string]: `${70 + (i % 4) * 26}px`, animationDelay: `${(i % 3) * 0.04}s` }}>{i % 2 ? '🍬' : '✨'}</i>
      ))}
      <b>+{gift} 🍬</b>
    </span>
  );
}

export function Missions({ progress, setProgress, lang }: { progress: Progress; setProgress: (f: (p: Progress) => Progress) => void; lang: Lang }) {
  const fr = lang === 'fr';
  const week = weekNow(progress.habits);
  useEffect(() => {
    document.querySelector('.mission.ready')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);
  const [burst, setBurst] = useState<{ id: string; gift: number; n: number } | null>(null);
  const claim = (id: string) => {
    const r = claimQuest(progress.habits, id);
    if (!r) return;
    setProgress((p) => ({ ...p, habits: r.habits, coins: p.coins + r.gift }));
    setBurst({ id, gift: r.gift, n: Date.now() });
    sfx.boxReveal('epique');
    navigator.vibrate?.([20, 30, 40]);
    setTimeout(() => setBurst((b) => (b?.id === id ? null : b)), 1400);
  };
  type Row = ReturnType<typeof dailyNow>[number];
  const row = (q: Row) => {
    const d = DIFF[q.diff];
    const pct = Math.min(100, (q.have / q.n) * 100);
    return (
      <div key={q.id} className={`mission ${q.claimable ? 'ready' : ''} ${q.claimed ? 'ok' : ''}`}>
        <span className="mission-ico">{q.icon}</span>
        <div className="mission-main">
          <span className="mission-top">
            <b>{q.label[lang]}</b>
            <em style={{ background: d.c }}>{d[lang]}</em>
          </span>
          <span className="mission-low">
            <span className="mission-bar"><i style={{ width: `${pct}%` }} /></span>
            <small>{q.have}/{q.n}</small>
          </span>
        </div>
        {q.claimable ? (
          <button className="claim-btn" onClick={() => claim(q.id)}>
            {fr ? 'Récupérer' : 'Claim'}
            <small>+{q.gift} 🍬</small>
          </button>
        ) : (
          <span className={`mission-gift ${q.claimed ? 'done' : ''}`}>{q.claimed ? '✅' : `+${q.gift} 🍬`}</span>
        )}
        {burst?.id === q.id && <Burst gift={burst.gift} seed={burst.n} />}
      </div>
    );
  };
  const streak = progress.habits?.streak ?? 0;
  return (
    <div className="missions">
      <section className="mission-group day">
        <header>
          <b>☀️ {fr ? 'Défis du jour' : 'Daily challenges'}</b>
          <span>{streak > 1 ? `🔥 ${streak} ${fr ? 'jours' : 'days'}` : fr ? 'Changent chaque jour' : 'New every day'}</span>
        </header>
        <div className={`crate-row ${week.todayDone ? 'got' : ''}`}>
          <span>🎁</span>
          <p>
            <b>{fr ? 'Caisse gratuite du jour' : 'Free daily crate'}</b>
            <small>{week.todayDone ? (fr ? 'Reçue ! À ouvrir dans Boîtes' : 'Received! Open it in Boxes') : fr ? 'Joue une partie pour la recevoir' : 'Play one game to get it'}</small>
          </p>
          <i>{week.todayDone ? '✅' : '0/1'}</i>
        </div>
        {dailyNow(progress.habits).map(row)}
      </section>
      <section className="mission-group week">
        <header>
          <b>📅 {fr ? 'Défis de la semaine' : 'Weekly challenges'}</b>
          <span>{fr ? 'Lundi au dimanche' : 'Monday to Sunday'}</span>
        </header>
        <div className={`crate-row ${week.boxGot ? 'got' : ''}`}>
          <span>🏆</span>
          <p>
            <b>{fr ? 'Grosse boîte de la semaine' : 'Big weekly box'}</b>
            <small>{week.boxGot ? (fr ? 'Reçue ! À ouvrir dans Boîtes' : 'Received! Open it in Boxes') : fr ? 'Joue les 7 jours de la semaine' : 'Play all 7 days of the week'}</small>
          </p>
          <i>{week.days}/7</i>
        </div>
        <span className="week-pips">
          {week.pips.map((p, i) => (
            <i key={i} className={p}>{(fr ? 'LMMJVSD' : 'MTWTFSS')[i]}</i>
          ))}
        </span>
        {questsNow(progress.habits).map(row)}
      </section>
    </div>
  );
}
