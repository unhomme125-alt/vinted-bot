import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/client.js';

export default function HistoryList() {
  const [searches, setSearches] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    get('/history')
      .then((d) => { if (active) setSearches(d); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p className="muted">Chargement…</p>;
  if (error) return <div className="error">{error}</div>;
  if (searches.length === 0) return <p className="muted">Aucune recherche enregistrée.</p>;

  return (
    <div className="card">
      <h2>Historique</h2>
      <ul className="list">
        {searches.map((s) => (
          <li key={s.id}>
            <Link to={`/results/${s.id}`}>
              <strong>{s.keyword}</strong>
            </Link>
            <span className="muted small">
              {s.size ? `taille ${s.size} · ` : ''}
              {s.price_min ? `min ${s.price_min}€ · ` : ''}
              {s.price_max ? `max ${s.price_max}€ · ` : ''}
              {new Date(s.created_at).toLocaleString('fr-FR')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
