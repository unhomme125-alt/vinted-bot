// db/migrate.js — Crée le schéma puis seed l'utilisateur admin.
//
// Lancer :  node --env-file=.env db/migrate.js
// Idempotent : schema.sql utilise IF NOT EXISTS ; l'admin est upserté
// (le mot de passe est (re)défini depuis ADMIN_PASSWORD à chaque exécution).

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

async function migrate() {
  const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  // Mot de passe admin : jamais codé en dur. Pris dans ADMIN_PASSWORD, sinon
  // généré fort et affiché UNE fois pour que l'opérateur le note.
  let adminPassword = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!adminPassword) {
    adminPassword = crypto.randomBytes(15).toString('base64url'); // ~20 caractères
    generated = true;
  }

  try {
    // 1. Schéma
    await pool.query(schema);
    console.log('[migrate] Schéma appliqué (tables + index).');

    // 2. Admin : upsert (insert si absent, sinon (re)définit le mot de passe)
    const hash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, (xmax = 0) AS created`,
      [ADMIN_USERNAME, hash]
    );
    const adminId = rows[0].id;
    const created = rows[0].created;

    // 3. Groupe "Default" de l'admin (créé une seule fois)
    const grp = await pool.query(
      `SELECT id FROM groups WHERE created_by = $1 AND name = 'Default' LIMIT 1`,
      [adminId]
    );
    if (grp.rows.length === 0) {
      const ins = await pool.query(
        `INSERT INTO groups (name, created_by) VALUES ('Default', $1) RETURNING id`,
        [adminId]
      );
      await pool.query(
        `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        [ins.rows[0].id, adminId]
      );
    }

    console.log(`[migrate] Admin "${ADMIN_USERNAME}" ${created ? 'créé' : 'mis à jour'}, mot de passe (re)défini.`);
    if (generated) {
      console.log('\n  ! ADMIN_PASSWORD non défini — mot de passe admin généré :');
      console.log('      ' + adminPassword);
      console.log('  Note-le maintenant (non réaffiché). Définis ADMIN_PASSWORD dans .env pour le fixer.\n');
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
