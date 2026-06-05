import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Users, Share2, History, Sparkles, User } from 'lucide-react';
import { logout } from '../api/client.js';
import SearchForm from '../components/SearchForm.jsx';
import HistoryList from '../components/HistoryList.jsx';
import SharedSearches from '../components/SharedSearches.jsx';

const TABS = [
  { key: 'search', label: 'Recherche', icon: Search },
  { key: 'group', label: 'Groupe', icon: Users },
  { key: 'shared', label: 'Partagé', icon: Share2 },
  { key: 'history', label: 'Historique', icon: History },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'search');

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div
      className="srch dark relative min-h-screen w-full text-white"
      style={{ background: 'radial-gradient(120% 75% at 50% -12%, #0a1a1d 0%, #050b0e 40%, #020405 100%)' }}
    >
      <style>{`
        .srch { --vinted: #16b5c0; --vinted-d: #0b818b; }
        .srch input { all: unset; box-sizing: border-box; width: 100%; font-size: 0.875rem; line-height: 1.3; color: #fff; }
        .srch input::placeholder { color: rgba(255,255,255,0.28); }
        .srch input[type=number] { -moz-appearance: textfield; }
        .srch input::-webkit-inner-spin-button, .srch input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .srch button { background: none; border: 0; padding: 0; border-radius: 0; color: inherit; font: inherit; cursor: pointer; }
        .srch .btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          width: 100%; padding: 0.95rem 1rem; border-radius: 14px; font-weight: 600; color: #fff;
          background: linear-gradient(180deg, var(--vinted), var(--vinted-d));
          box-shadow: 0 14px 34px -14px color-mix(in srgb, var(--vinted) 90%, transparent);
          transition: filter .15s ease, transform .1s ease;
        }
        .srch .btn-primary:hover { filter: brightness(1.07); }
        .srch .btn-primary:active { transform: translateY(1px); }
        .srch .tab {
          display: inline-flex; align-items: center; gap: 0.45rem;
          padding: 0.5rem 0.95rem; border-radius: 9999px;
          font-size: 0.85rem; font-weight: 500; color: rgba(255,255,255,0.5);
          transition: color .15s ease, background .15s ease;
        }
        .srch .tab:hover { color: rgba(255,255,255,0.85); }
        .srch .tab[data-active="true"] {
          color: #fff;
          background: linear-gradient(180deg, var(--vinted), var(--vinted-d));
          box-shadow: 0 8px 20px -10px color-mix(in srgb, var(--vinted) 90%, transparent);
        }
        .srch .navlink { color: rgba(255,255,255,0.55); font-size: 0.85rem; transition: color .15s ease; }
        .srch .navlink:hover { color: #fff; }
      `}</style>

      <div className="mx-auto max-w-3xl px-5 py-6">
        {/* Barre du haut */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/vinted-logo.png" alt="Vinted" className="size-7 rounded-md" />
            <span className="text-[15px] font-semibold">Vinted Bot</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="navlink" onClick={() => navigate('/home')}>Accueil</button>
            <button className="navlink" onClick={handleLogout}>Déconnexion</button>
            <div className="grid size-8 place-items-center rounded-full border border-white/15 bg-white/[0.04]">
              <User size={15} className="text-white/70" />
            </div>
          </div>
        </header>

        {/* Titre */}
        <div className="mb-5 mt-7 flex items-center gap-2.5">
          <Sparkles size={22} style={{ color: 'var(--vinted)' }} />
          <h1 className="text-2xl font-semibold tracking-tight">Recherche</h1>
        </div>

        {/* Onglets */}
        <nav className="mb-5 inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                className="tab"
                data-active={tab === t.key}
                onClick={() => (t.key === 'group' ? navigate('/groups') : setTab(t.key))}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Contenu */}
        <main>
          {tab === 'search' && <SearchForm />}
          {tab === 'shared' && <SharedSearches />}
          {tab === 'history' && <HistoryList />}
        </main>
      </div>
    </div>
  );
}
