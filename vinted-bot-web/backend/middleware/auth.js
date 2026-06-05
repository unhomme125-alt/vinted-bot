// middleware/auth.js — Vérification du JWT (Bearer token).
// Place req.user = { id, username } si le token est valide, sinon 401.

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Résout le secret JWT en refusant les valeurs faibles/par défaut.
// - production : on REFUSE de démarrer si le secret est absent/faible.
// - dev : on génère un secret aléatoire éphémère (sessions invalidées au
//   redémarrage) plutôt que d'utiliser un secret codé en dur.
function resolveJwtSecret() {
  const fromEnv = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const weak = !fromEnv || /^(change-me|dev-secret)/i.test(fromEnv) || fromEnv.length < 16;

  if (weak) {
    if (isProd) {
      throw new Error('[auth] JWT_SECRET manquant ou trop faible — démarrage refusé en production.');
    }
    console.warn('[auth] JWT_SECRET absent/faible — secret aléatoire éphémère généré (dev). Définis un JWT_SECRET fort dans .env.');
    return crypto.randomBytes(32).toString('hex');
  }
  return fromEnv;
}

export const JWT_SECRET = resolveJwtSecret();

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Non authentifié' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch (err) {
    console.error('[auth] Token invalide —', err.message);
    return res.status(401).json({ success: false, error: 'Session expirée ou invalide' });
  }
}

export default authMiddleware;
