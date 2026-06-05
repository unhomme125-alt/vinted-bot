// routes/auth.js — /api/auth/*

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = Router();

// Coût bcrypt (configurable). 12 = bon compromis sécurité/latence.
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
// Politique de mot de passe (baseline).
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt n'utilise que les 72 premiers octets.

// Hash factice (calculé une fois) : comparé quand l'utilisateur n'existe pas,
// pour égaliser le temps de réponse et limiter l'énumération de comptes.
const DUMMY_HASH = bcrypt.hashSync('user-not-found-placeholder', BCRYPT_ROUNDS);

// POST /api/auth/login — pas d'auth. Retourne un JWT.
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Identifiants manquants' });
    }

    const user = await db.query('getUserByUsername', { username });
    // Toujours comparer (hash réel ou factice) → temps de réponse constant.
    const ok = await bcrypt.compare(String(password), user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      return res.status(401).json({ success: false, error: 'Identifiants invalides' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
    console.log('[auth] Login réussi — userId:', user.id);
    res.json({ success: true, data: { token, username: user.username } });
  } catch (err) {
    console.error('[auth] /login error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/auth/register — crée un compte, retourne un JWT.
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Identifiants manquants' });
    }
    if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return res.status(400).json({
        success: false,
        error: `Mot de passe invalide (${PASSWORD_MIN} à ${PASSWORD_MAX} caractères)`,
      });
    }

    const existing = await db.query('getUserByUsername', { username });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Nom d\'utilisateur déjà pris' });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await db.query('createUser', { username, password_hash });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
    console.log('[auth] Inscription réussie — userId:', user.id);
    res.status(201).json({ success: true, data: { token, username: user.username } });
  } catch (err) {
    console.error('[auth] /register error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
