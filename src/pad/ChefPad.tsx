// Manette du Chef Cachottier : le chef voit les couleurs et donne l'indice ; les autres touchent les mots.
import { useEffect, useState } from 'react';
import type { ChefPadData } from '../games/chefShared';
import type { Lang, ToTv } from '../shared/protocol';

const KEY_COLORS = ['#ff4f9a', '#1fc9a0', '#e8dcc4', '#3a2140'];

export function ChefPad({ data, lang, send }: { data: ChefPadData; lang: Lang; send: (m: ToTv) => void }) {
  const fr = lang === 'fr';
  const [text, setText] = useState('');
  const [n, setN] = useState(2);
  useEffect(() => {
    if (data.phase !== 'clue') setText('');
  }, [data.phase]);
  const myTurn = data.turnTeam === data.team;
  const writing = data.role === 'chef' && data.phase === 'clue' && myTurn;
  const guessing = data.role === 'guess' && data.phase === 'guess';
  const title =
    data.phase === 'end'
      ? `🏆 ${data.win}`
      : writing
        ? fr ? 'À toi, chef : donne un indice' : 'Your turn, chef: give a clue'
        : guessing
          ? `💡 ${data.clue} · ${data.count}`
          : data.phase === 'guess'
            ? `💡 ${data.clue} · ${data.count} (${data.turnTeam})`
            : fr ? `${data.turnTeam} : le chef réfléchit…` : `${data.turnTeam}: the chef is thinking…`;
  return (
    <div className="traitor chef-pad" style={{ ['--c' as string]: data.color }}>
      <p className="chef-badge">{data.role === 'chef' ? (fr ? `👨‍🍳 Tu es le chef · ${data.team}` : `👨‍🍳 You’re the chef · ${data.team}`) : data.team}{data.left > 0 && data.phase !== 'end' ? ` · ⏱ ${data.left}` : ''}</p>
      <p className="pad-title">{title}</p>
      {data.note && <p className="pad-small uc-note">{data.note}</p>}
      {writing && (
        <form
          className="uc-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            navigator.vibrate?.(30);
            send({ t: 'act', a: 'clue', s: text.trim(), n: [n] });
          }}
        >
          <input value={text} maxLength={24} autoComplete="off" placeholder={fr ? 'Un seul mot' : 'One word'} onChange={(e) => setText(e.target.value)} />
          <div className="chef-count">
            <small>{fr ? 'Pour combien de mots ?' : 'For how many words?'}</small>
            {[1, 2, 3, 4, 5].map((v) => (
              <button type="button" key={v} className={n === v ? 'on' : ''} onClick={() => setN(v)}>{v}</button>
            ))}
          </div>
          <button className="btn big mint" disabled={!text.trim()}>{fr ? 'Donner l’indice' : 'Give the clue'}</button>
        </form>
      )}
      {data.role === 'chef' && data.phase !== 'end' && <p className="pad-small">{fr ? 'Toi seul vois les couleurs. 💀 = le mot maudit, à éviter !' : 'Only you see the colours. 💀 = the cursed word, avoid it!'}</p>}
      <div className="chef-grid">
        {data.cards.map((c, i) => {
          const shown = c.owner >= 0;
          const col = shown ? KEY_COLORS[c.owner] : c.key !== undefined ? KEY_COLORS[c.key] : '#fff';
          const dark = shown ? c.owner !== 2 : c.key === 3 || c.key === 0 || c.key === 1;
          return (
            <button
              key={i}
              disabled={!guessing || shown}
              className={`${data.voted === i ? 'on' : ''} ${shown ? 'done' : ''}`}
              style={{ background: col, color: dark ? '#fff' : '#3a2140', opacity: shown && c.key === undefined ? 0.75 : shown ? 0.45 : 1 }}
              onClick={() => {
                navigator.vibrate?.(15);
                send({ t: 'act', a: 'guess', n: [i] });
              }}
            >
              {(shown ? c.owner : c.key) === 3 ? '💀 ' : ''}{c.w}{c.votes > 0 && !shown ? ` (${c.votes})` : ''}
            </button>
          );
        })}
      </div>
      {guessing && data.canPass && (
        <button className="btn" onClick={() => send({ t: 'act', a: 'pass' })}>{fr ? 'On s’arrête là' : 'Stop here'}</button>
      )}
    </div>
  );
}
