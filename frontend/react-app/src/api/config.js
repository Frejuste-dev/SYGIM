/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Configuration Globale (React Frontend)              ║
 * ║     Système de Gestion Immobilière — Configuration Unifiée        ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

export const CONFIG = {
    // ── API Configuration ──────────────────────────────────────
    API: {
        BASE: typeof window !== 'undefined' ? window.location.origin + '/api' : 'http://localhost:5000/api',
        TIMEOUT: 30000, // 30 secondes
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000
    },

    // ── Storage Keys ───────────────────────────────────────────
    STORAGE: {
        JWT_TOKEN: 'sygim_jwt_token',
        CURRENT_USER: 'sygim_current_user',
        USER_PREFERENCES: 'sygim_preferences',
        LAST_SYNC: 'sygim_last_sync'
    },

    // ── Application Settings ────────────────────────────────────
    APP: {
        NAME: 'SYGIM',
        VERSION: '1.0.0',
        DESCRIPTION: 'Système de Gestion Immobilière',
        LANGUAGE: 'fr'
    },

    // ── Roles & Permissions ─────────────────────────────────────
    ROLES: {
        ADMIN: 'admin',
        DIRECTOR: 'director',
        ACCOUNTING: 'accounting',
        COLLECTOR_MANAGER: 'collector_manager',
        COLLECTOR: 'collector'
    },

    // ── Feature Flags ────────────────────────────────────────────
    FEATURES: {
        DARK_MODE: true,
        NOTIFICATIONS: true,
        EXPORT_PDF: true,
        IMPORT_CSV: true
    },

    // ── Error Codes ──────────────────────────────────────────────
    ERRORS: {
        UNAUTHORIZED: 'unauthorized',
        FORBIDDEN: 'forbidden',
        NOT_FOUND: 'not_found',
        VALIDATION: 'validation_error',
        SERVER_ERROR: 'server_error',
        NETWORK_ERROR: 'network_error',
        TIMEOUT: 'request_timeout'
    }
};
