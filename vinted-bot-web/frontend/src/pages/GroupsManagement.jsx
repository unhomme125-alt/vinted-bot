// GroupsManagement.jsx — écran « Groupes » branché sur l'API réelle.
// Layout premium (maquette FRONT.png) + données réelles : mes groupes, membres,
// propriétaire, invitations reçues, invitation par recherche, retrait, départ.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, logout } from '../api/client.js';
import './groups-management.css';

const PALETTE = ['#7c5cfc', '#ff7a45', '#f7b731', '#26de81', '#fd79a8', '#4b7bec', '#fc5c65', '#13b8be'];
const colorFor = (id) => PALETTE[Math.abs(Number(id) || 0) % PALETTE.length];
const initialsOf = (s) => (s || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

// Pseudo de l'utilisateur courant, lu depuis le JWT.
function currentUsername() {
  try { return JSON.parse(atob(localStorage.getItem('token').split('.')[1])).username; }
  catch { return ''; }
}

function Avatar({ name, color, sm }) {
  return <div className={'gm-avatar' + (sm ? ' sm' : '')} style={{ background: color }}>{initialsOf(name)}</div>;
}

/* Icônes SVG inline */
const IconPlus = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>);
const IconSearch = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" /></svg>);
const IconCheck = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.2l-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z" /></svg>);
const IconLink = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7L12 19" /></svg>);

export default function GroupsManagement() {
  const navigate = useNavigate();
  const me = currentUsername();
  const inviteRef = useRef(null);

  const [groups, setGroups] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [members, setMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const selected = groups.find((g) => g.id === selectedId) || null;

  function flash(setter, msg) { setter(msg); setTimeout(() => setter(''), 2500); }

  function loadGroups(keepSel) {
    return get('/groups/mine')
      .then((gs) => {
        setGroups(gs);
        setSelectedId((cur) => {
          if (keepSel && gs.some((g) => g.id === keepSel)) return keepSel;
          if (cur && gs.some((g) => g.id === cur)) return cur;
          return gs.length ? gs[0].id : null;
        });
      })
      .catch((e) => setError(e.message));
  }
  function loadInvitations() {
    return get('/groups/invitations').then(setInvitations).catch((e) => setError(e.message));
  }

  useEffect(() => { loadGroups(); loadInvitations(); /* eslint-disable-next-line */ }, []);

  // Charger les membres du groupe sélectionné
  useEffect(() => {
    if (!selectedId) { setMembers([]); return; }
    get(`/groups/${selectedId}/members`).then(setMembers).catch((e) => setError(e.message));
  }, [selectedId]);

  // Recherche d'utilisateurs à inviter (debounce)
  useEffect(() => {
    if (!selectedId || inviteQuery.trim().length < 1) { setInviteResults([]); return; }
    const t = setTimeout(() => {
      get('/groups/search-users', { q: inviteQuery.trim(), groupId: selectedId })
        .then(setInviteResults)
        .catch(() => setInviteResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [inviteQuery, selectedId]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const g = await post('/groups/create', { name: newName.trim() });
      setNewName(''); setCreating(false);
      await loadGroups(g.id);
      flash(setNotice, `Groupe « ${g.name} » créé`);
    } catch (err) { flash(setError, err.message); }
  }

  async function handleInvite(username) {
    try {
      await post('/groups/invite', { username, groupId: selectedId });
      setInviteResults((r) => r.filter((u) => u.username !== username));
      flash(setNotice, `Invitation envoyée à ${username}`);
    } catch (err) { flash(setError, err.message); }
  }

  async function respondInvite(groupId, action) {
    try {
      await post(`/groups/${action}`, { groupId });
      await Promise.all([loadInvitations(), loadGroups(action === 'accept' ? groupId : undefined)]);
      flash(setNotice, action === 'accept' ? 'Invitation acceptée' : 'Invitation refusée');
    } catch (err) { flash(setError, err.message); }
  }

  async function handleRemove(userId) {
    try {
      await post('/groups/remove', { groupId: selectedId, userId });
      setMembers((m) => m.filter((x) => x.user_id !== userId));
      await loadGroups(selectedId);
      flash(setNotice, 'Membre retiré');
    } catch (err) { flash(setError, err.message); }
  }

  async function handleLeave() {
    try {
      await post('/groups/leave', { groupId: selectedId });
      await loadGroups();
      flash(setNotice, 'Vous avez quitté le groupe');
    } catch (err) { flash(setError, err.message); }
  }

  function copyLink() {
    navigator.clipboard?.writeText(window.location.origin).then(() => flash(setNotice, 'Lien du site copié'));
  }

  return (
    <div className="gm">
      {/* ── Sidebar ── */}
      <aside className="gm-sidebar">
        <div className="gm-logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/home')}>
          Vin<span>ted</span>
        </div>

        {creating ? (
          <form className="gm-search" onSubmit={handleCreate}>
            <input autoFocus placeholder="Nom du groupe..." value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => { if (!newName) setCreating(false); }} />
          </form>
        ) : (
          <button className="gm-create" onClick={() => setCreating(true)}><IconPlus /> Create Group</button>
        )}

        <ul className="gm-grouplist">
          {groups.length === 0 && <li className="gm-gsub" style={{ cursor: 'default' }}>Aucun groupe</li>}
          {groups.map((g) => (
            <li key={g.id} className={g.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(g.id)}>
              <div className="gm-gicon" style={{ background: colorFor(g.id) }}>{initialsOf(g.name)}</div>
              <div>
                <div className="gm-gname">{g.name}</div>
                <div className="gm-gsub">{g.member_count} membre{g.member_count > 1 ? 's' : ''}</div>
              </div>
            </li>
          ))}
        </ul>

        {/* Invitations reçues */}
        {invitations.length > 0 && (
          <div className="gm-invsec">
            <div className="gm-invsec-title">Invitations</div>
            {invitations.map((inv) => (
              <div className="gm-invsec-row" key={inv.group_id}>
                <div className="gm-invsec-name">{inv.group_name}<span> · {inv.invited_by}</span></div>
                <div className="gm-invsec-actions">
                  <button className="ok" onClick={() => respondInvite(inv.group_id, 'accept')}>Accepter</button>
                  <button className="no" onClick={() => respondInvite(inv.group_id, 'decline')}>Refuser</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="gm-me">
          <Avatar name={me} color="#13b8be" sm />
          <div className="grow">
            <div className="gm-name">{me}</div>
            <div className="gm-sub">@{me}</div>
          </div>
          <button className="gm-logout" title="Déconnexion" onClick={() => { logout(); navigate('/login'); }}>⎋</button>
        </div>
      </aside>

      {/* ── Contenu principal ── */}
      <main className="gm-main">
        <div className="gm-header">
          <div>
            <h1>Groups Management</h1>
            <p className="muted">Gère tes groupes, membres et invitations</p>
          </div>
          <button className="gm-btn" onClick={() => navigate('/home')}>← Accueil</button>
        </div>

        {(notice || error) && (
          <div style={{ marginBottom: 14 }}>
            {notice && <div className="notice">{notice}</div>}
            {error && <div className="error">{error}</div>}
          </div>
        )}

        {!selected ? (
          <section className="gm-card" style={{ padding: 40, textAlign: 'center' }}>
            <p className="muted">Tu n'as encore aucun groupe. Clique sur <strong>Create Group</strong> pour en créer un.</p>
          </section>
        ) : (
          <div className="gm-grid">
            {/* Colonne gauche */}
            <div>
              <section className="gm-card gm-hero">
                <div className="gm-hero-cover" style={{ background: colorFor(selected.id) }}>{selected.name}</div>
                <div className="gm-hero-body">
                  <div className="gm-hero-top">
                    <div>
                      <div className="gm-title-row">
                        <h2>{selected.name}</h2>
                        {selected.is_owner && <span className="gm-verified" title="Vous êtes propriétaire"><IconCheck /></span>}
                      </div>
                      <div className="gm-created">Créé le {fmtDate(selected.created_at)}</div>
                    </div>
                    <div className="gm-hero-stat">
                      <div className="num">{selected.member_count}</div>
                      <div className="lbl">Membre{selected.member_count > 1 ? 's' : ''}</div>
                    </div>
                  </div>

                  <div className="gm-hero-actions">
                    {!selected.is_owner && <button className="gm-btn danger" onClick={handleLeave}>Quitter le groupe</button>}
                    <button className="gm-btn teal" onClick={() => inviteRef.current?.focus()}><IconPlus /> Inviter un membre</button>
                  </div>
                </div>
              </section>

              <div className="gm-section-title">Propriétaire</div>
              <section className="gm-card gm-leader">
                <Avatar name={selected.owner_username} color="#13b8be" />
                <div className="grow">
                  <div className="gm-name" style={{ fontWeight: 600 }}>{selected.owner_username}</div>
                  <div className="muted" style={{ fontSize: 12 }}>@{selected.owner_username}</div>
                </div>
                <span className="gm-badge">Group Owner</span>
              </section>

              <section className="gm-card" style={{ marginTop: 12 }}>
                <div className="gm-members-head">
                  <h3>Membres <span className="muted" style={{ fontWeight: 400 }}>({selected.member_count})</span></h3>
                </div>
                {members.map((m) => (
                  <div className="gm-row" key={m.user_id}>
                    <div className="gm-person">
                      <Avatar name={m.username} color={colorFor(m.user_id)} />
                      <div>
                        <div className="gm-name">{m.username}{m.is_owner && ' '}{m.is_owner && <span className="gm-badge" style={{ marginLeft: 6 }}>Owner</span>}</div>
                        <div className="gm-sub">@{m.username}</div>
                      </div>
                    </div>
                    <div className="gm-date">{fmtDate(m.joined_at)}</div>
                    <div><span className="gm-status">Actif</span></div>
                    {selected.is_owner && !m.is_owner
                      ? <button className="gm-remove" onClick={() => handleRemove(m.user_id)}>Retirer</button>
                      : <span />}
                  </div>
                ))}
              </section>
            </div>

            {/* Colonne droite : Inviter */}
            <aside className="gm-card gm-invite">
              <h3>Inviter des membres</h3>
              <p className="muted">Recherche un utilisateur par son pseudo</p>

              <div className="gm-invite-search">
                <IconSearch />
                <input ref={inviteRef} placeholder="Pseudo..." value={inviteQuery}
                  onChange={(e) => setInviteQuery(e.target.value)} />
              </div>

              <div className="gm-invite-list">
                {inviteQuery && inviteResults.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Aucun utilisateur trouvé.</p>}
                {inviteResults.map((u) => (
                  <div className="gm-invite-row" key={u.id}>
                    <Avatar name={u.username} color={colorFor(u.id)} sm />
                    <div className="grow">
                      <div className="gm-name">{u.username}</div>
                      <div className="gm-sub">@{u.username}</div>
                    </div>
                    <button className="gm-invite-btn" onClick={() => handleInvite(u.username)}>Inviter</button>
                  </div>
                ))}
              </div>

              <p className="gm-invite-foot">Partage l'accès au site</p>
              <button className="gm-copy" onClick={copyLink}><IconLink /> Copier le lien</button>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
