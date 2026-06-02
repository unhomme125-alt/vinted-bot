import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../api/client.js';

export default function SearchForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    keyword: '', priceMin: '', priceMax: '', size: '', maxResults: 20,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.keyword.trim()) {
      setError('Le mot-clé est requis');
      return;
    }
    setLoading(true);
    try {
      // On n'envoie que les champs renseignés.
      const params = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v !== null) params[k] = v;
      });
      const data = await get('/search', params);
      navigate(`/results/${data.searchId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Nouvelle recherche</h2>
      <label>
        Mot-clé
        <input value={form.keyword} onChange={update('keyword')} placeholder="ray ban wayfarer" />
      </label>
      <div className="row">
        <label>
          Prix min (€)
          <input type="number" value={form.priceMin} onChange={update('priceMin')} />
        </label>
        <label>
          Prix max (€)
          <input type="number" value={form.priceMax} onChange={update('priceMax')} />
        </label>
      </div>
      <div className="row">
        <label>
          Taille
          <input value={form.size} onChange={update('size')} placeholder="38" />
        </label>
        <label>
          Max résultats
          <input type="number" value={form.maxResults} onChange={update('maxResults')} />
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Recherche en cours…' : 'Lancer la recherche'}
      </button>
      {loading && <p className="muted small">Le bot ouvre un navigateur — cela peut prendre un moment.</p>}
    </form>
  );
}
