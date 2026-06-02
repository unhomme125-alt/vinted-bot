// routes/history.js — /api/history/*

import { Router } from 'express';
import db from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/history — liste des recherches de l'utilisateur
router.get('/', authMiddleware, async (req, res) => {
  try {
    const searches = await db.query('getSearches', { userId: req.user.id });
    res.json({ success: true, data: searches });
  } catch (err) {
    console.error('[history] / error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/history/:id — résultats d'une recherche précise (de l'utilisateur)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const search = await db.query('getSearchById', { id: req.params.id, userId: req.user.id });
    if (!search) {
      return res.status(404).json({ success: false, error: 'Recherche introuvable' });
    }
    const results = await db.query('getResults', { searchId: search.id });
    res.json({ success: true, data: { search, results } });
  } catch (err) {
    console.error('[history] /:id error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
