// routes/search.js — /api/search

import { Router } from 'express';
import db from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { runSearch } from '../bot/runner.js';

const router = Router();

// GET /api/search?keyword=...&priceMin=...&priceMax=...&size=...&maxResults=...
// Lance le bot Python, persiste la recherche + ses résultats, renvoie l'id.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { keyword, priceMin, priceMax, size, maxResults } = req.query;
    if (!keyword) {
      return res.status(400).json({ success: false, error: 'Le mot-clé est requis' });
    }

    console.log('[search] Lancement recherche — userId:', req.user.id, '| keyword:', keyword);

    // 1. Persister la recherche (toujours via db.query, même étape 1)
    const search = await db.query('createSearch', {
      userId: req.user.id,
      keyword,
      priceMin: priceMin ? Number(priceMin) : null,
      priceMax: priceMax ? Number(priceMax) : null,
      size: size || null,
      maxResults: maxResults ? Number(maxResults) : null,
    });

    // 2. Lancer le bot Python en subprocess
    const botOutput = await runSearch({ keyword, priceMin, priceMax, size, maxResults });

    if (!botOutput.success) {
      return res.status(502).json({
        success: false,
        error: botOutput.error || 'Le bot n\'a renvoyé aucun résultat',
      });
    }

    // 3. Persister les résultats
    const results = Array.isArray(botOutput.results) ? botOutput.results : [];
    await db.query('insertResults', { searchId: search.id, results });

    console.log('[search] Recherche terminée — searchId:', search.id, '| résultats:', results.length);
    res.json({
      success: true,
      data: { searchId: search.id, results, meta: botOutput.meta || { total: results.length } },
    });
  } catch (err) {
    console.error('[search] / error:', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la recherche' });
  }
});

export default router;
