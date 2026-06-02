// routes/groups.js — /api/groups/*
//
// Système d'invitation avec acceptation :
//   invite (pending) → l'invité voit /invitations → accept (accepted) | decline (suppression)
// Les membres acceptés peuvent consulter les recherches des autres via /searches.

import { Router } from 'express';
import db from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// POST /api/groups/create — crée un groupe nommé (le créateur en devient membre accepté)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const name = (req.body && req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, error: 'Nom du groupe requis' });
    }
    const group = await db.query('createGroup', { name, createdBy: req.user.id });
    await db.query('addMember', { groupId: group.id, userId: req.user.id, status: 'accepted' });
    console.log('[groups] Groupe créé — id:', group.id, '| par:', req.user.id);
    res.status(201).json({ success: true, data: { id: group.id, name: group.name } });
  } catch (err) {
    console.error('[groups] /create error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/groups/invite — invite un utilisateur dans un groupe précis (statut pending)
router.post('/invite', authMiddleware, async (req, res) => {
  try {
    const { username, groupId } = req.body || {};
    if (!username || !groupId) {
      return res.status(400).json({ success: false, error: 'username et groupId requis' });
    }

    // L'invitant doit être membre accepté du groupe.
    const allowed = await db.query('isAcceptedMember', { groupId, userId: req.user.id });
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Vous n\'êtes pas membre de ce groupe' });
    }

    const target = await db.query('getUserByUsername', { username });
    if (!target) {
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
    }
    if (target.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'Vous ne pouvez pas vous inviter vous-même' });
    }

    await db.query('addMember', { groupId, userId: target.id, status: 'pending' });
    console.log('[groups] Invitation envoyée — group:', groupId, '| user:', target.id);
    res.status(201).json({ success: true, data: { groupId, username: target.username } });
  } catch (err) {
    console.error('[groups] /invite error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/groups/invitations — invitations en attente reçues par l'utilisateur
router.get('/invitations', authMiddleware, async (req, res) => {
  try {
    const invitations = await db.query('getPendingInvitations', { userId: req.user.id });
    res.json({ success: true, data: invitations });
  } catch (err) {
    console.error('[groups] /invitations error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/groups/accept — accepte une invitation { groupId }
router.post('/accept', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.body || {};
    if (!groupId) {
      return res.status(400).json({ success: false, error: 'groupId requis' });
    }
    const accepted = await db.query('acceptInvitation', { groupId, userId: req.user.id });
    if (!accepted) {
      return res.status(404).json({ success: false, error: 'Invitation introuvable' });
    }
    console.log('[groups] Invitation acceptée — group:', groupId, '| user:', req.user.id);
    res.json({ success: true, data: { groupId } });
  } catch (err) {
    console.error('[groups] /accept error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/groups/decline — refuse une invitation { groupId }
router.post('/decline', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.body || {};
    if (!groupId) {
      return res.status(400).json({ success: false, error: 'groupId requis' });
    }
    const declined = await db.query('declineInvitation', { groupId, userId: req.user.id });
    if (!declined) {
      return res.status(404).json({ success: false, error: 'Invitation introuvable' });
    }
    console.log('[groups] Invitation refusée — group:', groupId, '| user:', req.user.id);
    res.json({ success: true, data: { groupId } });
  } catch (err) {
    console.error('[groups] /decline error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/groups/members — membres acceptés de tous les groupes de l'utilisateur
router.get('/members', authMiddleware, async (req, res) => {
  try {
    const members = await db.query('getGroupMembersForUser', { userId: req.user.id });
    res.json({ success: true, data: { members } });
  } catch (err) {
    console.error('[groups] /members error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/groups/searches — recherches des autres membres des groupes de l'utilisateur
router.get('/searches', authMiddleware, async (req, res) => {
  try {
    const searches = await db.query('getSharedSearches', { userId: req.user.id });
    res.json({ success: true, data: searches });
  } catch (err) {
    console.error('[groups] /searches error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
