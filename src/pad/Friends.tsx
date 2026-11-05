// Amis : un code à partager, la liste avec « en ligne / vu il y a… », inviter dans sa partie, rejoindre un ami.
import { useEffect, useState } from 'react';
import { CharCanvas } from '../shared/CharCanvas';
import { addFriend, friendsWatch, inviteFriend, invitesWatch, myFriendCode, removeFriend, dropInvite, publishPresence, type CloudUser, type FriendInfo, type InviteInfo } from '../shared/cloud';
import type { Lang, Profile } from '../shared/protocol';

const ONLINE_MS = 330000;

export function seenText(at: number, fr: boolean) {
  const d = Date.now() - at;
  if (d < ONLINE_MS) return fr ? 'En ligne' : 'Online';
  const min = Math.round(d / 60000);
  if (min < 60) return fr ? `Vu il y a ${min} min` : `Seen ${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return fr ? `Vu il y a ${h} h` : `Seen ${h} h ago`;
  const j = Math.round(h / 24);
  return fr ? `Vu il y a ${j} jour${j > 1 ? 's' : ''}` : `Seen ${j} day${j > 1 ? 's' : ''} ago`;
}

let lastPresence = 0;
/** Dit aux amis qu'on est là, toutes les 3 minutes, tant que l'appli est ouverte. */
export function usePresence(user: CloudUser | null, profile: Profile, room: string) {
  useEffect(() => {
    if (!user) return;
    const send = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastPresence < 60000) return;
      lastPresence = Date.now();
      void publishPresence({ name: profile.name, food: profile.food, color: profile.color, hat: profile.hat, room }).catch(() => {});
    };
    lastPresence = 0; // Le pseudo, le perso ou la salle viennent de changer
    send();
    const id = setInterval(send, 180000);
    document.addEventListener('visibilitychange', send);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', send);
    };
  }, [user, profile.name, profile.food, profile.color, profile.hat, room]);
}

/** Bandeau d'invitation, visible partout. */
export function InviteBanner({ user, lang, room }: { user: CloudUser | null; lang: Lang; room?: string }) {
  const fr = lang === 'fr';
  const [list, setList] = useState<InviteInfo[]>([]);
  useEffect(() => {
    if (!user) return setList([]);
    return invitesWatch(setList);
  }, [user]);
  const fresh = list.filter((i) => Date.now() - i.at < 900000 && i.code !== room);
  if (!fresh.length) return null;
  const inv = fresh[0];
  return (
    <div className="invite-banner">
      <span>📨</span>
      <p><b>{inv.name}</b> {fr ? 't’invite à jouer !' : 'invites you to play!'}</p>
      <button className="claim-btn" onClick={() => { void dropInvite(inv.from); location.hash = `#/m/${inv.code}`; }}>{fr ? 'Rejoindre' : 'Join'}</button>
      <button className="invite-no" onClick={() => void dropInvite(inv.from)} aria-label={fr ? 'Refuser' : 'Decline'}>✕</button>
    </div>
  );
}

export function FriendsCard({ user, lang, room, connect }: { user: CloudUser | null; lang: Lang; room: string; connect: () => void }) {
  const fr = lang === 'fr';
  const [code, setCode] = useState('');
  const [list, setList] = useState<FriendInfo[]>([]);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState<string[]>([]);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!user) return;
    myFriendCode().then(setCode).catch(() => setBroken(true));
    return friendsWatch(setList);
  }, [user]);
  if (!user)
    return (
      <section className="set-card friends">
        <h3>👯 {fr ? 'Mes amis' : 'My friends'}</h3>
        <p className="set-help">{fr ? 'Connecte-toi avec Google pour ajouter des amis, voir qui est en ligne et les inviter dans ta partie.' : 'Sign in with Google to add friends, see who is online and invite them to your game.'}</p>
        <button className="btn mint" onClick={connect}>{fr ? 'Se connecter' : 'Sign in'}</button>
      </section>
    );
  if (broken)
    return (
      <section className="set-card friends">
        <h3>👯 {fr ? 'Mes amis' : 'My friends'}</h3>
        <p className="set-help">{fr ? 'Les amis ne sont pas encore disponibles. Réessaie un peu plus tard.' : 'Friends are not available yet. Try again later.'}</p>
      </section>
    );
  const add = () => {
    const c = input.trim().toUpperCase();
    if (c.length < 4) return;
    setMsg('');
    addFriend(c)
      .then((name) => {
        setInput('');
        setMsg(fr ? `✅ ${name} est maintenant ton ami !` : `✅ ${name} is now your friend!`);
      })
      .catch((e: Error) => setMsg(e.message === 'moi' ? (fr ? 'C’est ton propre code 😄' : 'That’s your own code 😄') : fr ? 'Code introuvable. Vérifie les lettres.' : 'Code not found. Check the letters.'));
  };
  const sorted = [...list].sort((a, b) => b.seen - a.seen);
  const online = sorted.filter((f) => Date.now() - f.seen < ONLINE_MS).length;
  return (
    <section className="set-card friends">
      <h3>👯 {fr ? 'Mes amis' : 'My friends'} {list.length > 0 && <small>{online} {fr ? 'en ligne' : 'online'} / {list.length}</small>}</h3>
      <div className="my-code">
        <small>{fr ? 'Mon code ami' : 'My friend code'}</small>
        <b>{code || '…'}</b>
        {code && (
          <button className="pill" onClick={() => {
            const text = fr ? `Ajoute-moi sur Cana’pet, mon code ami : ${code}` : `Add me on Cana’pet, my friend code: ${code}`;
            if (navigator.share) void navigator.share({ text }).catch(() => {});
            else void navigator.clipboard?.writeText(code);
          }}>{fr ? 'Partager' : 'Share'}</button>
        )}
      </div>
      <div className="add-friend">
        <input value={input} maxLength={8} autoCapitalize="characters" autoComplete="off" placeholder={fr ? 'Code d’un ami' : 'A friend’s code'} onChange={(e) => setInput(e.target.value)} />
        <button className="btn mint" disabled={input.trim().length < 4} onClick={add}>{fr ? 'Ajouter' : 'Add'}</button>
      </div>
      {msg && <p className="set-help">{msg}</p>}
      {sorted.length === 0 && <p className="set-help">{fr ? 'Pas encore d’amis : partage ton code !' : 'No friends yet: share your code!'}</p>}
      {sorted.map((f) => {
        const on = Date.now() - f.seen < ONLINE_MS;
        return (
          <div key={f.uid} className="friend-row">
            <span className="friend-pic">
              <CharCanvas profile={{ food: f.food, color: f.color, hat: f.hat ?? 'aucun', acc: 'aucun' }} size={46} still />
            </span>
            <span className="friend-txt">
              <b>{f.name}</b>
              <small className={on ? 'on' : ''}><i />{seenText(f.seen, fr)}</small>
            </span>
            {on && f.room && f.room !== room ? (
              <button className="claim-btn" onClick={() => (location.hash = `#/m/${f.room}`)}>{fr ? 'Rejoindre' : 'Join'}</button>
            ) : room && f.room !== room ? (
              <button className="claim-btn alt" disabled={sent.includes(f.uid)} onClick={() => inviteFriend(f.uid, room).then(() => setSent((s) => [...s, f.uid])).catch(() => setMsg(fr ? 'Invitation impossible.' : 'Could not invite.'))}>
                {sent.includes(f.uid) ? (fr ? 'Invité ✓' : 'Invited ✓') : fr ? 'Inviter' : 'Invite'}
              </button>
            ) : null}
            <button className="invite-no" aria-label={fr ? 'Retirer' : 'Remove'} onClick={() => confirm(fr ? `Retirer ${f.name} de tes amis ?` : `Remove ${f.name}?`) && void removeFriend(f.uid)}>✕</button>
          </div>
        );
      })}
    </section>
  );
}
