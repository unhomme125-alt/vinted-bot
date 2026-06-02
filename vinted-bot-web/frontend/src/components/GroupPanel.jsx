import { useEffect, useState } from 'react';
import { get, post } from '../api/client.js';

export default function GroupPanel() {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteInputs, setInviteInputs] = useState({}); // { [groupId]: username }
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load() {
    get('/groups/members')
      .then((d) => setMembers(d.members))
      .then(() => get('/groups/invitations').then(setInvitations))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  // Regroupe la liste plate des membres par groupe.
  const groups = {};
  members.forEach((m) => {
    if (!groups[m.group_id]) {
      groups[m.group_id] = { id: m.group_id, name: m.group_name, members: [] };
    }
    groups[m.group_id].members.push(m);
  });
  const groupList = Object.values(groups);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!newGroupName.trim()) return;
    try {
      await post('/groups/create', { name: newGroupName });
      setNotice(`Groupe « ${newGroupName} » créé`);
      setNewGroupName('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleInvite(e, groupId) {
    e.preventDefault();
    setError('');
    setNotice('');
    const username = (inviteInputs[groupId] || '').trim();
    if (!username) return;
    try {
      await post('/groups/invite', { username, groupId });
      setNotice(`Invitation envoyée à ${username}`);
      setInviteInputs({ ...inviteInputs, [groupId]: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function respond(groupId, action) {
    setError('');
    setNotice('');
    try {
      await post(`/groups/${action}`, { groupId });
      setNotice(action === 'accept' ? 'Invitation acceptée' : 'Invitation refusée');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <form className="card row" onSubmit={handleCreate}>
        <label style={{ flex: 1 }}>
          Créer un groupe
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="nom du groupe (ex: Sneakers Squad)"
          />
        </label>
        <button type="submit" style={{ alignSelf: 'flex-end' }}>Créer</button>
      </form>

      {invitations.length > 0 && (
        <div className="card">
          <h2>Invitations reçues</h2>
          <ul className="list">
            {invitations.map((inv) => (
              <li key={inv.group_id} className="invite-row">
                <span>
                  <strong>{inv.group_name}</strong>{' '}
                  <span className="muted small">invité par {inv.invited_by}</span>
                </span>
                <span className="actions">
                  <button onClick={() => respond(inv.group_id, 'accept')}>Accepter</button>
                  <button className="ghost" onClick={() => respond(inv.group_id, 'decline')}>Refuser</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {groupList.length === 0 ? (
        <div className="card">
          <p className="muted">
            Vous n'avez encore aucun groupe. Créez-en un ci-dessus, puis invitez d'autres
            membres pour partager vos recherches.
          </p>
        </div>
      ) : (
        groupList.map((g) => (
          <div className="card" key={g.id}>
            <h2>{g.name}</h2>
            <ul className="list">
              {g.members.map((m) => (
                <li key={m.user_id}>
                  <strong>{m.username}</strong>
                  <span className="muted small">depuis {new Date(m.joined_at).toLocaleDateString('fr-FR')}</span>
                </li>
              ))}
            </ul>
            <form className="row" onSubmit={(e) => handleInvite(e, g.id)}>
              <label style={{ flex: 1 }}>
                Inviter dans « {g.name} »
                <input
                  value={inviteInputs[g.id] || ''}
                  onChange={(e) => setInviteInputs({ ...inviteInputs, [g.id]: e.target.value })}
                  placeholder="nom d'utilisateur"
                />
              </label>
              <button type="submit" style={{ alignSelf: 'flex-end' }}>Inviter</button>
            </form>
          </div>
        ))
      )}

      {notice && <div className="notice">{notice}</div>}
      {error && <div className="error">{error}</div>}
    </>
  );
}
