// db/migrate.js — Crée le schéma puis seed l'utilisateur de démo.
//
// Lancer une fois :  node --env-file=.env db/migrate.js
// Idempotent : schema.sql utilise IF NOT EXISTS, le seed utilise ON CONFLICT.

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import pool from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    // 1. Schéma
    await pool.query(schema);
    console.log('[migrate] Schéma appliqué (tables + index).');

    // 2. Seed : utilisateur "admin" + groupe "Default" (login de démo)
    const hash = bcrypt.hashSync('admin', 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2)
       ON CONFLICT (username) DO NOTHING
       RETURNING id`,
      ['admin', hash]
    );

    if (rows.length > 0) {
      const adminId = rows[0].id;
      const grp = await pool.query(
        `INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING id`,
        ['Default', adminId]
      );
      await pool.query(
        `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        [grp.rows[0].id, adminId]
      );
      console.log('[migrate] Seed : user "admin" / mot de passe "admin" + groupe "Default".');
    } else {
      console.log('[migrate] Seed ignoré (admin existe déjà).');
    }

    console.log('[migrate] Terminé avec succès.');
  } catch (err) {
    console.error('[migrate] Échec —', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
