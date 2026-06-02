// routes/auth.js — /api/auth/*

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login — pas d'auth. Retourne un JWT.
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Identifiants manquants' });
    }

    const user = await db.query('getUserByUsername', { username });
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
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

// POST /api/auth/register — crée un compte + son groupe personnel, retourne un JWT.
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Identifiants manquants' });
    }
    if (password.length < 4) {
      return res.status(400).json({ success: false, error: 'Mot de passe trop court (4 caractères min)' });
    }

    const existing = await db.query('getUserByUsername', { username });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Nom d\'utilisateur déjà pris' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const user = await db.query('createUser', { username, password_hash });

    // Modèle Discord : aucun groupe auto. L'utilisateur crée le sien depuis l'app.

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
    console.log('[auth] Inscription réussie — userId:', user.id);
    res.status(201).json({ success: true, data: { token, username: user.username } });
  } catch (err) {
    console.error('[auth] /register error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
