import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logout } from '../api/client.js';
import SearchForm from '../components/SearchForm.jsx';
import HistoryList from '../components/HistoryList.jsx';
import SharedSearches from '../components/SharedSearches.jsx';

const TABS = [
  { key: 'search', label: 'Recherche' },
  { key: 'group', label: 'Groupe' },
  { key: 'shared', label: 'Partagé' },
  { key: 'history', label: 'Historique' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Onglet initial pilotable depuis l'accueil via ?tab=shared|history|search
  const [tab, setTab] = useState(params.get('tab') || 'search');

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Vinted Bot</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="ghost" onClick={() => navigate('/home')}>← Accueil</button>
          <button className="ghost" onClick={handleLogout}>Déconnexion</button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'tab active' : 'tab'}
            onClick={() => (t.key === 'group' ? navigate('/groups') : setTab(t.key))}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'search' && <SearchForm />}
        {tab === 'shared' && <SharedSearches />}
        {tab === 'history' && <HistoryList />}
      </main>
    </div>
  );
}
