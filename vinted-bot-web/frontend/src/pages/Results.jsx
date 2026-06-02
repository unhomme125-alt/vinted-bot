import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { get } from '../api/client.js';
import ResultsTable from '../components/ResultsTable.jsx';

export default function Results() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    get(`/history/${id}`)
      .then((d) => { if (active) setData(d); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  return (
    <div className="page">
      <header className="topbar">
        <h1>Résultats</h1>
        <Link className="ghost" to="/dashboard">← Retour</Link>
      </header>
      <main className="content">
        {loading && <p className="muted">Chargement…</p>}
        {error && <div className="error">{error}</div>}
        {data && (
          <>
            <p className="muted">
              Recherche « {data.search.keyword} » — {data.results.length} résultat(s)
            </p>
            <ResultsTable results={data.results} />
          </>
        )}
      </main>
    </div>
  );
}
