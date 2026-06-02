// db/pool.js — Pool de connexions PostgreSQL (unique, importé partout).
//
// On utilise Pool (et non Client) pour gérer les connexions concurrentes.
// Les variables d'env sont chargées via `node --env-file=.env` (Node >= 20.6).

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'vinted_bot',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[pool] Erreur client PostgreSQL inactif —', err.message);
});

export default pool;
