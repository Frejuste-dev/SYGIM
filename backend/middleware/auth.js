/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Middleware d'Authentification JWT              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'sygim_default_secret';

/**
 * Middleware : Vérifier que l'utilisateur est authentifié
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Token d\'authentification requis'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, username, role, displayName }
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: 'Token invalide ou expiré'
        });
    }
}

/**
 * Middleware : Vérifier que l'utilisateur a un rôle autorisé
 * @param  {...string} allowedRoles - Rôles autorisés
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentification requise'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Accès interdit — rôle insuffisant'
            });
        }

        next();
    };
}

/**
 * Générer un token JWT
 */
function generateToken(user) {
    return jwt.sign(
        {
            id:          user.id,
            username:    user.username,
            role:        user.role,
            displayName: user.display_name || user.displayName || ''
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
}

module.exports = { authenticate, authorize, generateToken };
