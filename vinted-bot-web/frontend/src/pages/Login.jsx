import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { post } from '../api/client.js';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await post('/auth/login', { username, password });
      localStorage.setItem('token', data.token);
      navigate('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Vinted Bot</h1>
        <p className="muted">Connexion</p>
        <label>
          Utilisateur
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </label>
        <label>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        <p className="muted small">Démo : admin / admin</p>
        <p className="muted small">
          Pas de compte ? <Link to="/register">Créer un compte</Link>
        </p>
      </form>
    </div>
  );
}
