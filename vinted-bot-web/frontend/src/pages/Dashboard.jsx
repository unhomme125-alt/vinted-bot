import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/client.js';
import SearchForm from '../components/SearchForm.jsx';
import HistoryList from '../components/HistoryList.jsx';
import GroupPanel from '../components/GroupPanel.jsx';
import SharedSearches from '../components/SharedSearches.jsx';

const TABS = [
  { key: 'search', label: 'Recherche' },
  { key: 'group', label: 'Groupe' },
  { key: 'shared', label: 'Partagé' },
  { key: 'history', label: 'Historique' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('search');

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Vinted Bot</h1>
        <button className="ghost" onClick={handleLogout}>Déconnexion</button>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'tab active' : 'tab'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'search' && <SearchForm />}
        {tab === 'group' && <GroupPanel />}
        {tab === 'shared' && <SharedSearches />}
        {tab === 'history' && <HistoryList />}
      </main>
    </div>
  );
}
