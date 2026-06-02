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

// GET /api/groups/mine — groupes de l'utilisateur (avec propriétaire, nb membres, rôle)
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const groups = await db.query('getMyGroups', { userId: req.user.id });
    res.json({ success: true, data: groups });
  } catch (err) {
    console.error('[groups] /mine error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/groups/search-users?q=&groupId= — utilisateurs invitables (réservé aux membres)
router.get('/search-users', authMiddleware, async (req, res) => {
  try {
    const { q, groupId } = req.query;
    if (!q || !groupId) {
      return res.status(400).json({ success: false, error: 'q et groupId requis' });
    }
    const allowed = await db.query('isAcceptedMember', { groupId, userId: req.user.id });
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Vous n\'êtes pas membre de ce groupe' });
    }
    const users = await db.query('searchInvitableUsers', { q, groupId, userId: req.user.id });
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('[groups] /search-users error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/groups/:id/members — membres acceptés d'un groupe (réservé aux membres)
router.get('/:id/members', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const allowed = await db.query('isAcceptedMember', { groupId, userId: req.user.id });
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const members = await db.query('getGroupMembers', { groupId });
    res.json({ success: true, data: members });
  } catch (err) {
    console.error('[groups] /:id/members error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/groups/remove — le propriétaire retire un membre { groupId, userId }
router.post('/remove', authMiddleware, async (req, res) => {
  try {
    const { groupId, userId } = req.body || {};
    if (!groupId || !userId) {
      return res.status(400).json({ success: false, error: 'groupId et userId requis' });
    }
    const isOwner = await db.query('isGroupOwner', { groupId, userId: req.user.id });
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Seul le propriétaire peut retirer un membre' });
    }
    if (Number(userId) === req.user.id) {
      return res.status(400).json({ success: false, error: 'Le propriétaire ne peut pas se retirer' });
    }
    await db.query('removeMember', { groupId, userId });
    console.log('[groups] Membre retiré — group:', groupId, '| user:', userId);
    res.json({ success: true, data: { groupId, userId } });
  } catch (err) {
    console.error('[groups] /remove error:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/groups/leave — quitter un groupe { groupId } (sauf le propriétaire)
router.post('/leave', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.body || {};
    if (!groupId) {
      return res.status(400).json({ success: false, error: 'groupId requis' });
    }
    const isOwner = await db.query('isGroupOwner', { groupId, userId: req.user.id });
    if (isOwner) {
      return res.status(400).json({ success: false, error: 'Le propriétaire ne peut pas quitter son groupe' });
    }
    const left = await db.query('removeMember', { groupId, userId: req.user.id });
    if (!left) {
      return res.status(404).json({ success: false, error: 'Vous n\'êtes pas membre de ce groupe' });
    }
    console.log('[groups] Membre parti — group:', groupId, '| user:', req.user.id);
    res.json({ success: true, data: { groupId } });
  } catch (err) {
    console.error('[groups] /leave error:', err);
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
