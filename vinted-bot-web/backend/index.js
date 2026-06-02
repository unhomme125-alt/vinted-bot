// index.js — Point d'entrée Express (serveur unique, pas de microservices).

import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import searchRoutes from './routes/search.js';
import historyRoutes from './routes/history.js';
import groupsRoutes from './routes/groups.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`[server] Express démarré sur http://localhost:${PORT}`);
});
