// db/index.js — Accès aux données (étape 2 : PostgreSQL, SQL brut via le Pool).
//
// La signature query(action, params) est INCHANGÉE : les routes Express ne sont
// pas modifiées. Chaque action exécute pool.query(SQL, [params]) et retourne les
// données extraites (.rows / .rows[0]) — jamais l'objet pg brut.
//
// Règles : aucune route ne fait de pool.query() direct ; chaque case a son try/catch.

import pool from './pool.js';

// ─── users ───────────────────────────────────────────────────────────────────
async function getUserByUsername({ username }) {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return rows[0] || null;
  } catch (err) {
    console.error('[db] getUserByUsername —', err.message);
    throw err;
  }
}

async function getUserById({ id }) {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  } catch (err) {
    console.error('[db] getUserById —', err.message);
    throw err;
  }
}

// Reçoit un password_hash DÉJÀ haché par la route auth (bcryptjs) — jamais de clair.
async function createUser({ username, password_hash }) {
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
      [username, password_hash]
    );
    return rows[0];
  } catch (err) {
    console.error('[db] createUser —', err.message);
    throw err;
  }
}

// ─── searches ─────────────────────────────────────────────────────────────────
async function createSearch({
  userId, keyword, priceMin = null, priceMax = null, size = null,
  intervalSearch = null, intervalRecheck = null, maxResults = null, groupId = null,
}) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO searches
         (user_id, group_id, keyword, price_min, price_max, size,
          interval_search, interval_recheck, max_results)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, groupId, keyword, priceMin, priceMax, size, intervalSearch, intervalRecheck, maxResults]
    );
    return rows[0];
  } catch (err) {
    console.error('[db] createSearch —', err.message);
    throw err;
  }
}

async function getSearches({ userId }) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM searches WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  } catch (err) {
    console.error('[db] getSearches —', err.message);
    throw err;
  }
}

// Accessible si l'utilisateur en est propriétaire OU partage un groupe accepté
// avec son auteur (consultation des recherches des autres membres).
async function getSearchById({ id, userId }) {
  try {
    const { rows } = await pool.query(
      `SELECT s.* FROM searches s
        WHERE s.id = $1 AND (
          s.user_id = $2
          OR EXISTS (
            SELECT 1
              FROM group_members me
              JOIN group_members owner
                ON owner.group_id = me.group_id AND owner.status = 'accepted'
             WHERE me.user_id = $2 AND me.status = 'accepted'
               AND owner.user_id = s.user_id
          )
        )`,
      [id, userId]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('[db] getSearchById —', err.message);
    throw err;
  }
}

// ─── results ──────────────────────────────────────────────────────────────────
async function insertResults({ searchId, results }) {
  try {
    if (!results || results.length === 0) return [];
    const values = [];
    const placeholders = results.map((r, i) => {
      const b = i * 7;
      values.push(
        searchId,
        r.title,
        // colonne price en INTEGER (cf. schema.sql) → arrondi des prix décimaux
        Math.round(Number(r.price) || 0),
        r.size,
        r.seller,
        r.url,
        r.found_at || new Date().toISOString()
      );
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`;
    });
    const { rows } = await pool.query(
      `INSERT INTO results (search_id, title, price, size, seller, url, found_at)
       VALUES ${placeholders.join(', ')}
       RETURNING *`,
      values
    );
    return rows;
  } catch (err) {
    console.error('[db] insertResults —', err.message);
    throw err;
  }
}

async function getResults({ searchId }) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM results WHERE search_id = $1 ORDER BY id',
      [searchId]
    );
    return rows;
  } catch (err) {
    console.error('[db] getResults —', err.message);
    throw err;
  }
}

// ─── groups ───────────────────────────────────────────────────────────────────
async function createGroup({ name, createdBy }) {
  try {
    const { rows } = await pool.query(
      'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, createdBy]
    );
    return rows[0];
  } catch (err) {
    console.error('[db] createGroup —', err.message);
    throw err;
  }
}

async function getUserGroup({ userId }) {
  try {
    const { rows } = await pool.query(
      `SELECT g.*
         FROM groups g
         JOIN group_members m ON m.group_id = g.id
        WHERE m.user_id = $1 AND m.status = 'accepted'
        ORDER BY m.id
        LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('[db] getUserGroup —', err.message);
    throw err;
  }
}

// Ajoute un membre. status='accepted' pour l'auto-inscription (registration),
// status='pending' pour une invitation à accepter. Idempotent : si la ligne
// existe déjà (quel que soit son statut), on n'écrase rien.
async function addMember({ groupId, userId, status = 'accepted' }) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO group_members (group_id, user_id, status) VALUES ($1, $2, $3)
       ON CONFLICT (group_id, user_id) DO NOTHING
       RETURNING *`,
      [groupId, userId, status]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('[db] addMember —', err.message);
    throw err;
  }
}

// Vérifie qu'un utilisateur est membre accepté d'un groupe (autorisation d'invitation).
async function isAcceptedMember({ groupId, userId }) {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM group_members
        WHERE group_id = $1 AND user_id = $2 AND status = 'accepted' LIMIT 1`,
      [groupId, userId]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('[db] isAcceptedMember —', err.message);
    throw err;
  }
}

// Invitations en attente reçues par l'utilisateur (qui doit accepter/refuser).
async function getPendingInvitations({ userId }) {
  try {
    const { rows } = await pool.query(
      `SELECT g.id AS group_id, g.name AS group_name,
              inviter.username AS invited_by, gm.joined_at
         FROM group_members gm
         JOIN groups g ON g.id = gm.group_id
         JOIN users inviter ON inviter.id = g.created_by
        WHERE gm.user_id = $1 AND gm.status = 'pending'
        ORDER BY gm.id DESC`,
      [userId]
    );
    return rows;
  } catch (err) {
    console.error('[db] getPendingInvitations —', err.message);
    throw err;
  }
}

async function acceptInvitation({ groupId, userId }) {
  try {
    const { rows } = await pool.query(
      `UPDATE group_members SET status = 'accepted', joined_at = NOW()
        WHERE group_id = $1 AND user_id = $2 AND status = 'pending'
        RETURNING *`,
      [groupId, userId]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('[db] acceptInvitation —', err.message);
    throw err;
  }
}

async function declineInvitation({ groupId, userId }) {
  try {
    const { rows } = await pool.query(
      `DELETE FROM group_members
        WHERE group_id = $1 AND user_id = $2 AND status = 'pending'
        RETURNING *`,
      [groupId, userId]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('[db] declineInvitation —', err.message);
    throw err;
  }
}

// Seuls les membres ACCEPTÉS sont retournés.
async function getMembers({ groupId }) {
  try {
    const { rows } = await pool.query(
      `SELECT m.user_id, u.username, m.joined_at
         FROM group_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.group_id = $1 AND m.status = 'accepted'
        ORDER BY m.id`,
      [groupId]
    );
    return rows;
  } catch (err) {
    console.error('[db] getMembers —', err.message);
    throw err;
  }
}

// Membres acceptés de TOUS les groupes où l'utilisateur est lui-même accepté
// (avec le nom du groupe). Sert à l'affichage « Mes groupes ».
async function getGroupMembersForUser({ userId }) {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT other.user_id, u.username, g.id AS group_id,
              g.name AS group_name, other.joined_at
         FROM group_members me
         JOIN group_members other
           ON other.group_id = me.group_id AND other.status = 'accepted'
         JOIN groups g ON g.id = me.group_id
         JOIN users u ON u.id = other.user_id
        WHERE me.user_id = $1 AND me.status = 'accepted'
        ORDER BY g.name, u.username`,
      [userId]
    );
    return rows;
  } catch (err) {
    console.error('[db] getGroupMembersForUser —', err.message);
    throw err;
  }
}

// Groupes (acceptés) de l'utilisateur, avec propriétaire, nb de membres, rôle.
async function getMyGroups({ userId }) {
  try {
    const { rows } = await pool.query(
      `SELECT g.id, g.name, g.created_at, g.created_by,
              ou.username AS owner_username,
              (g.created_by = $1) AS is_owner,
              (SELECT COUNT(*) FROM group_members x
                WHERE x.group_id = g.id AND x.status = 'accepted')::int AS member_count
         FROM groups g
         JOIN group_members m ON m.group_id = g.id AND m.user_id = $1 AND m.status = 'accepted'
         JOIN users ou ON ou.id = g.created_by
        ORDER BY g.id`,
      [userId]
    );
    return rows;
  } catch (err) {
    console.error('[db] getMyGroups —', err.message);
    throw err;
  }
}

// Membres acceptés d'un groupe précis (propriétaire en tête).
async function getGroupMembers({ groupId }) {
  try {
    const { rows } = await pool.query(
      `SELECT m.user_id, u.username, m.joined_at,
              (g.created_by = m.user_id) AS is_owner
         FROM group_members m
         JOIN users u ON u.id = m.user_id
         JOIN groups g ON g.id = m.group_id
        WHERE m.group_id = $1 AND m.status = 'accepted'
        ORDER BY (g.created_by = m.user_id) DESC, m.id`,
      [groupId]
    );
    return rows;
  } catch (err) {
    console.error('[db] getGroupMembers —', err.message);
    throw err;
  }
}

// Recherche d'utilisateurs à inviter : match sur le pseudo, hors soi-même et hors
// personnes déjà liées au groupe (membre ou invitation en cours).
async function searchInvitableUsers({ q, groupId, userId }) {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username
         FROM users u
        WHERE u.username ILIKE $1
          AND u.id <> $2
          AND NOT EXISTS (
            SELECT 1 FROM group_members m WHERE m.group_id = $3 AND m.user_id = u.id
          )
        ORDER BY u.username
        LIMIT 8`,
      [`%${q}%`, userId, groupId]
    );
    return rows;
  } catch (err) {
    console.error('[db] searchInvitableUsers —', err.message);
    throw err;
  }
}

async function isGroupOwner({ groupId, userId }) {
  try {
    const { rows } = await pool.query(
      'SELECT 1 FROM groups WHERE id = $1 AND created_by = $2 LIMIT 1',
      [groupId, userId]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('[db] isGroupOwner —', err.message);
    throw err;
  }
}

async function removeMember({ groupId, userId }) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING *',
      [groupId, userId]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('[db] removeMember —', err.message);
    throw err;
  }
}

// Recherches des AUTRES membres acceptés des groupes où l'utilisateur est accepté.
async function getSharedSearches({ userId }) {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT s.id, s.keyword, s.price_min, s.price_max, s.size,
              s.max_results, s.created_at, u.username AS owner, g.name AS group_name
         FROM group_members me
         JOIN group_members other
           ON other.group_id = me.group_id
          AND other.user_id <> me.user_id
          AND other.status = 'accepted'
         JOIN groups g ON g.id = me.group_id
         JOIN users u ON u.id = other.user_id
         JOIN searches s ON s.user_id = other.user_id
        WHERE me.user_id = $1 AND me.status = 'accepted'
        ORDER BY s.created_at DESC`,
      [userId]
    );
    return rows;
  } catch (err) {
    console.error('[db] getSharedSearches —', err.message);
    throw err;
  }
}

// ─── Dispatcher (signature identique à l'étape 1) ──────────────────────────────
const ops = {
  getUserByUsername,
  getUserById,
  createUser,
  createSearch,
  getSearches,
  getSearchById,
  insertResults,
  getResults,
  createGroup,
  getUserGroup,
  addMember,
  isAcceptedMember,
  getPendingInvitations,
  acceptInvitation,
  declineInvitation,
  getMembers,
  getGroupMembersForUser,
  getMyGroups,
  getGroupMembers,
  searchInvitableUsers,
  isGroupOwner,
  removeMember,
  getSharedSearches,
};

export async function query(operation, params = {}) {
  const fn = ops[operation];
  if (!fn) {
    throw new Error(`Opération db inconnue : ${operation}`);
  }
  return fn(params);
}

export default { query };
