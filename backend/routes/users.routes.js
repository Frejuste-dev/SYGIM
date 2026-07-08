/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Routes Gestion des Utilisateurs (Admin)       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const { pool }       = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validateEmail, validatePhone, validateUsername, validatePassword } = require('../utils/validators');

// Toutes les routes nécessitent authentification + rôle admin
router.use(authenticate);
router.use(authorize('admin'));

// ─── GET /api/users ─ Liste de tous les utilisateurs ───────────
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, username, role, first_name, last_name, display_name, 
                    avatar, email, phone, collector_name, active, last_login, created_at
             FROM users ORDER BY created_at DESC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Erreur GET /users :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── GET /api/users/:id ────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, username, role, first_name, last_name, display_name, 
                    avatar, email, phone, collector_name, active, last_login, created_at
             FROM users WHERE id = ?`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Erreur GET /users/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── POST /api/users ─ Créer un utilisateur ────────────────────
router.post('/', async (req, res) => {
    try {
        const { username, password, role, firstName, lastName, displayName, avatar, email, phone, collectorName } = req.body;

        console.log('[POST /users] Reçu :', { username, role, firstName, lastName, collectorName });

        // Validation champs requis
        if (!username || !password || !role) {
            return res.status(400).json({
                success: false,
                error: 'username, password et role sont requis',
                received: { username: !!username, password: !!password, role: !!role }
            });
        }

        // Valider le username
        if (!validateUsername(username)) {
            return res.status(400).json({
                success: false,
                error: 'Nom d\'utilisateur invalide (3-100 caractères, lettres minuscules, chiffres, @, . et - seulement)'
            });
        }

        // Valider le mot de passe
        if (!validatePassword(password)) {
            return res.status(400).json({
                success: false,
                error: 'Mot de passe invalide (min 6 caractères)'
            });
        }

        // Valider l'email s'il est fourni
        if (email && !validateEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Format email invalide'
            });
        }

        // Valider le téléphone s'il est fourni
        if (phone && !validatePhone(phone)) {
            return res.status(400).json({
                success: false,
                error: 'Format téléphone invalide'
            });
        }

        // Valider le rôle
        const validRoles = ['admin', 'director', 'accounting', 'collector_manager', 'collector'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                error: `Rôle invalide. Acceptés: ${validRoles.join(', ')}`
            });
        }

        // Vérifier unicité du username
        const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, error: 'Ce nom d\'utilisateur existe déjà' });
        }

        // Vérifier unicité de l'email
        if (email) {
            const [existingEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
            if (existingEmail.length > 0) {
                return res.status(409).json({ success: false, error: 'Cet email est déjà utilisé' });
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            `INSERT INTO users (username, password_hash, role, first_name, last_name, display_name, avatar, email, phone, collector_name, active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                username.toLowerCase(),
                passwordHash,
                role,
                firstName || '',
                lastName || '',
                displayName || `${firstName || ''} ${lastName || ''}`.trim() || username,
                avatar || (lastName || 'U').substring(0, 2).toUpperCase(),
                email || null,
                phone || null,
                collectorName || null
            ]
        );

        console.log(`[POST /users] ✅ Créé : ${username} (${role}) avec ID ${result.insertId}`);

        res.status(201).json({
            success: true,
            data: { 
                id: result.insertId, 
                username: username.toLowerCase(), 
                role,
                displayName: displayName || `${firstName || ''} ${lastName || ''}`.trim() || username
            }
        });

    } catch (err) {
        console.error('Erreur POST /users :', err.message);
        res.status(500).json({ success: false, error: 'Erreur serveur : ' + err.message });
    }
});

// ─── PUT /api/users/:id ─ Modifier un utilisateur ──────────────
router.put('/:id', async (req, res) => {
    try {
        const { username, role, firstName, lastName, displayName, avatar, email, phone, collectorName, active, password } = req.body;

        if (username !== undefined) {
            if (!validateUsername(username)) {
                return res.status(400).json({
                    success: false,
                    error: 'Nom d\'utilisateur invalide (3-100 caractères, lettres minuscules, chiffres, @, . et - seulement)'
                });
            }
            const [existing] = await pool.query('SELECT id FROM users WHERE username = ? AND id != ?', [username.toLowerCase(), req.params.id]);
            if (existing.length > 0) {
                return res.status(409).json({ success: false, error: 'Ce nom d\'utilisateur existe déjà' });
            }
        }

        // Construire la requête dynamiquement
        const fields = [];
        const values = [];

        if (username !== undefined)      { fields.push('username = ?');       values.push(username.toLowerCase()); }
        if (role !== undefined)          { fields.push('role = ?');           values.push(role); }
        if (firstName !== undefined)     { fields.push('first_name = ?');     values.push(firstName); }
        if (lastName !== undefined)      { fields.push('last_name = ?');      values.push(lastName); }
        if (displayName !== undefined)   { fields.push('display_name = ?');   values.push(displayName); }
        if (avatar !== undefined)        { fields.push('avatar = ?');         values.push(avatar); }
        if (email !== undefined)         { fields.push('email = ?');          values.push(email); }
        if (phone !== undefined)         { fields.push('phone = ?');          values.push(phone); }
        if (collectorName !== undefined) { fields.push('collector_name = ?'); values.push(collectorName); }
        if (active !== undefined)        { fields.push('active = ?');         values.push(active ? 1 : 0); }
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            fields.push('password_hash = ?');
            values.push(hash);
        }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'Aucun champ à modifier' });
        }

        values.push(req.params.id);

        await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

        res.json({ success: true, message: 'Utilisateur modifié avec succès' });

    } catch (err) {
        console.error('Erreur PUT /users/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── DELETE /api/users/:id ─────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        // Ne pas supprimer le propre compte admin
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({
                success: false,
                error: 'Impossible de supprimer votre propre compte'
            });
        }

        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
        }

        res.json({ success: true, message: 'Utilisateur supprimé avec succès' });

    } catch (err) {
        console.error('Erreur DELETE /users/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
