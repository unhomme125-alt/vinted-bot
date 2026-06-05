// index.js — Point d'entrée Express (serveur unique, pas de microservices).

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import searchRoutes from './routes/search.js';
import historyRoutes from './routes/history.js';
import groupsRoutes from './routes/groups.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── En-têtes de sécurité ───────────────────────────────────────────────
app.use(helmet());

// ── CORS : liste blanche d'origines (override via CORS_ORIGIN, séparées par ,)
const defaultOrigins = ['http://localhost:5173', 'http://localhost:5800', 'http://localhost:3001'];
const envOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);
app.use(cors({
  origin(origin, cb) {
    // Pas d'Origin (same-origin, curl, app mobile) ou origine autorisée → OK.
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error('CORS: origine non autorisée'));
  },
  credentials: true,
}));

// ── Corps JSON limité (anti-DoS) ───────────────────────────────────────
app.use(express.json({ limit: '100kb' }));

// ── Limitation de débit sur l'auth (anti brute-force) ──────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Trop de tentatives, réessaie plus tard.' },
});
app.use('/api/auth', authLimiter);

// Healthcheck
app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/groups', groupsRoutes);

// 404 JSON uniforme
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route introuvable' });
});

// Gestionnaire d'erreurs JSON (CORS, payload trop gros, etc.)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && /CORS/.test(err.message)) {
    return res.status(403).json({ success: false, error: 'Origine non autorisée' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Requête trop volumineuse' });
  }
  console.error('[server] erreur —', err && err.message);
  res.status(500).json({ success: false, error: 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`[server] Express démarré sur http://localhost:${PORT}`);
});
