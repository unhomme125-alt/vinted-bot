import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/client.js';

// Onglet « Partagé » : recherches des autres membres des groupes que j'ai rejoints.
export default function SharedSearches() {
  const [searches, setSearches] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    get('/groups/searches')
      .then((d) => { if (active) setSearches(d); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p className="muted">Chargement…</p>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="card">
      <h2>Recherches du groupe</h2>
      {searches.length === 0 ? (
        <p className="muted">
          Aucune recherche partagée pour l'instant. Rejoignez un groupe (onglet Groupe)
          ou attendez qu'un autre membre lance une recherche.
        </p>
      ) : (
        <ul className="list">
          {searches.map((s) => (
            <li key={s.id}>
              <Link to={`/results/${s.id}`}>
                <strong>{s.keyword}</strong>
              </Link>
              <span className="muted small">
                par {s.owner} · groupe {s.group_name} · {new Date(s.created_at).toLocaleString('fr-FR')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
