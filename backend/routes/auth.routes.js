/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Routes d'Authentification                     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();

// Middleware de dépréciation
router.use((req, res, next) => {
    res.setHeader('X-Deprecated', 'Use /api/auth/* instead. Legacy removed 2026-07-15');
    next();
});

const { pool }          = require('../config/db');
const { authenticate, generateToken } = require('../middleware/auth');
const { authLimiter } = require('../src/middleware/rateLimiter');
const { validateEmail, validatePhone, validatePassword } = require('../utils/validators');

// ─── POST /api/auth/login ──────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Nom d\'utilisateur et mot de passe requis'
            });
        }

        const key = username.toLowerCase().trim();

        // Recherche par username, displayName, firstName ou lastName
        const [rows] = await pool.query(
            `SELECT * FROM users 
             WHERE LOWER(username) = ? 
                OR LOWER(display_name) = ? 
                OR LOWER(first_name) = ? 
                OR LOWER(last_name) = ?
                OR LOWER(CONCAT(first_name, ' ', last_name)) = ?
             LIMIT 1`,
            [key, key, key, key, key]
        );

        if (rows.length === 0) {
            // Log tentative échouée
            await _logActivity('login', `❌ Tentative avec nom inconnu : ${username}`);
            return res.status(401).json({
                success: false,
                error: 'Nom non reconnu. Vérifiez votre saisie.'
            });
        }

        const user = rows[0];

        if (!user.active) {
            return res.status(403).json({
                success: false,
                error: 'Ce compte est désactivé. Contactez votre administrateur.'
            });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            await _logActivity('login', `❌ Mot de passe incorrect pour : ${username}`, user.id);
            return res.status(401).json({
                success: false,
                error: 'Mot de passe incorrect.'
            });
        }

        // Mettre à jour last_login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

        // Générer le token JWT
        const token = generateToken(user);

        await _logActivity('login', `✅ Connexion réussie : ${user.display_name} (${user.role})`, user.id);

        res.json({
            success: true,
            token,
            user: {
                id:           user.id,
                username:     user.username,
                role:         user.role,
                firstName:    user.first_name,
                lastName:     user.last_name,
                displayName:  user.display_name,
                avatar:       user.avatar,
                collectorName: user.collector_name,
                userType:     user.role
            }
        });

    } catch (err) {
        console.error('Erreur login :', err);
        res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
});

// ─── POST /api/auth/register ───────────────────────────────────
// Inscription publique pour nouveaux utilisateurs (role collecteur par défaut)
router.post('/register', async (req, res) => {
    try {
        const { username, password, firstName, lastName, phone, email } = req.body;

        // Validation champs requis
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Nom d\'utilisateur et mot de passe requis'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Le mot de passe doit contenir au moins 6 caractères'
            });
        }

        // Validation username
        if (!/^[a-z0-9._-]+$/.test(username.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Nom d\'utilisateur invalide (lettres minuscules, chiffres, . et - seulement)'
            });
        }

        // Validation email optionnel
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Format email invalide'
            });
        }

        // Vérifier unicité du username
        const [existingUser] = await pool.query(
            'SELECT id FROM users WHERE username = ?',
            [username.toLowerCase()]
        );
        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Ce nom d\'utilisateur existe déjà'
            });
        }

        // Vérifier unicité de l'email si fourni
        if (email) {
            const [existingEmail] = await pool.query(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );
            if (existingEmail.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'Cet email est déjà utilisé'
                });
            }
        }

        // Hasher le mot de passe
        const passwordHash = await bcrypt.hash(password, 10);

        // Créer l'utilisateur avec rôle par défaut 'collector'
        const displayName = firstName && lastName 
            ? `${firstName} ${lastName}` 
            : username;

        const [result] = await pool.query(
            `INSERT INTO users 
             (username, password_hash, role, first_name, last_name, display_name, email, phone, avatar, active)
             VALUES (?, ?, 'collector', ?, ?, ?, ?, ?, ?, 1)`,
            [
                username.toLowerCase(),
                passwordHash,
                firstName || '',
                lastName || '',
                displayName,
                email || null,
                phone || null,
                (lastName || 'U').substring(0, 2).toUpperCase()
            ]
        );

        await _logActivity('register', `✅ Nouvel utilisateur créé : ${displayName} (${username})`);

        // Générer token pour auto-login après registration
        const newUser = {
            id: result.insertId,
            username: username.toLowerCase(),
            role: 'collector',
            display_name: displayName
        };

        const token = generateToken(newUser);

        res.status(201).json({
            success: true,
            message: 'Inscription réussie',
            token,
            user: {
                id: result.insertId,
                username: username.toLowerCase(),
                role: 'collector',
                firstName: firstName || '',
                lastName: lastName || '',
                displayName: displayName,
                email: email || null,
                phone: phone || null
            }
        });

    } catch (err) {
        console.error('Erreur register :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur : ' + err.message });
    }
});

// ─── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, username, role, first_name, last_name, display_name, avatar, collector_name, active, last_login FROM users WHERE id = ?',
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
        }

        const user = rows[0];
        res.json({
            success: true,
            user: {
                id:           user.id,
                username:     user.username,
                role:         user.role,
                firstName:    user.first_name,
                lastName:     user.last_name,
                displayName:  user.display_name,
                avatar:       user.avatar,
                collectorName: user.collector_name,
                userType:     user.role,
                lastLogin:    user.last_login
            }
        });
    } catch (err) {
        console.error('Erreur /me :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── Utilitaire : log d'activité ──────────────────────────────
async function _logActivity(type, message, userId = null) {
    try {
        const now = new Date();
        await pool.query(
            `INSERT INTO activity_logs (type, message, user_id, date, time) VALUES (?, ?, ?, CURDATE(), CURTIME())`,
            [type, message, userId]
        );
    } catch (e) {
        console.error('Erreur log :', e.message);
    }
}

module.exports = router;
