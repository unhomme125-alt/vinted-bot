// api/client.js — Wrapper fetch avec header JWT.
// Le front ne contient aucune logique métier : il appelle l'API, c'est tout.

const BASE = '/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  // ngrok-skip-browser-warning : évite la page d'avertissement ngrok sur les appels API.
  const base = { 'ngrok-skip-browser-warning': 'true' };
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

// Déballe le format uniforme { success, data | error }.
async function handle(res) {
  let body = {};
  try {
    body = await res.json();
  } catch {
    throw new Error('Réponse serveur illisible');
  }
  if (!res.ok || !body.success) {
    if (res.status === 401) {
      localStorage.removeItem('token');
    }
    throw new Error(body.error || `Erreur ${res.status}`);
  }
  return body.data;
}

export function get(path, params) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetch(BASE + path + qs, { headers: { ...authHeaders() } }).then(handle);
}

export function post(path, payload) {
  return fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload || {}),
  }).then(handle);
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem('token'));
}

export function logout() {
  localStorage.removeItem('token');
}

export default { get, post, isAuthenticated, logout };
