// middleware/auth.js — Vérification du JWT (Bearer token).
// Place req.user = { id, username } si le token est valide, sinon 401.

import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

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
