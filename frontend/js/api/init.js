/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Initialisation API                                 ║
 * ║     Init le client HTTP et restaure la session si disponible      ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

(function initializeAPI() {
    'use strict';

    // Créer une instance globale du client HTTP
    window.httpClient = new HttpClient({
        onUnauthorized: (data) => {
            console.warn('[API] Session expirée - 401 Unauthorized');
            console.warn('[API] Raison:', data.message || data.error);
            localStorage.removeItem(CONFIG.STORAGE.JWT_TOKEN);
            localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
            
            // Afficher message erreur et rediriger
            alert('Votre session a expiré. Veuillez vous reconnecter.');
            if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
                window.location.href = '/index.html';
            }
        },
        onError: (error) => {
            console.error('[API] Erreur:', error);
            // Des erreurs network, timeout, etc. - ne pas rediriger
        }
    });

    // ─────────────────────────────────────────────────────────────
    // RESTAURER LA SESSION
    // ─────────────────────────────────────────────────────────────
    const savedToken = localStorage.getItem(CONFIG.STORAGE.JWT_TOKEN);
    if (savedToken) {
        window.httpClient.setToken(savedToken);
        console.log('[API] Session restaurée du localStorage');
    }

    // ─────────────────────────────────────────────────────────────
    // UTILITAIRES GLOBAUX
    // ─────────────────────────────────────────────────────────────
    window.APIUtils = {
        /**
         * Formate une erreur API en message utilisateur
         */
        formatError: (error) => {
            if (error instanceof ApiError) {
                const messages = {
                    'UNAUTHORIZED': 'Votre session a expiré. Veuillez vous reconnecter.',
                    'FORBIDDEN': 'Vous n\'avez pas les droits d\'accès pour cette action.',
                    'NOT_FOUND': 'La ressource demandée n\'existe pas.',
                    'VALIDATION': 'Les données fournies sont invalides.',
                    'NETWORK_ERROR': 'Erreur de connexion réseau. Vérifiez votre connexion internet.',
                    'TIMEOUT': 'La requête a pris trop de temps. Réessayez.',
                    'SERVER_ERROR': 'Erreur du serveur. Veuillez réessayer ou contactez l\'administrateur.'
                };
                return messages[error.code] || error.message || 'Une erreur inconnue est survenue';
            }
            return error.message || 'Une erreur inconnue est survenue';
        },

        /**
         * Vérifie si l'utilisateur est authentifié
         */
        isAuthenticated: () => {
            return !!localStorage.getItem(CONFIG.STORAGE.JWT_TOKEN);
        },

        /**
         * Récupère l'utilisateur courant depuis le storage
         */
        getCurrentUser: () => {
            const userJson = localStorage.getItem(CONFIG.STORAGE.CURRENT_USER);
            return userJson ? JSON.parse(userJson) : null;
        },

        /**
         * Stocke l'utilisateur courant après login
         */
        setCurrentUser: (user) => {
            localStorage.setItem(CONFIG.STORAGE.CURRENT_USER, JSON.stringify(user));
        },

        /**
         * Vérifie si l'utilisateur a un rôle spécifique
         */
        hasRole: (role) => {
            const user = window.APIUtils.getCurrentUser();
            return user && user.role === role;
        },

        /**
         * Vérifie si l'utilisateur a au moins un des rôles spécifiés
         */
        hasAnyRole: (roles) => {
            const user = window.APIUtils.getCurrentUser();
            return user && roles.includes(user.role);
        },

        /**
         * Déconnecte l'utilisateur
         */
        logout: () => {
            localStorage.removeItem(CONFIG.STORAGE.JWT_TOKEN);
            localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
            window.httpClient.setToken(null);
            console.log('[API] Déconnexion effectuée');
            window.location.href = '/index.html';
        },

        /**
         * Synchroniser les données locales vers l'API
         * Utile après login pour remonter les données de localStorage
         */
        syncLocalDataToAPI: async () => {
            console.log('[API] Début synchronisation données locales → API');
            
            try {
                // Clients
                const clientsJson = localStorage.getItem('CLIENTS_DB');
                if (clientsJson) {
                    const clients = JSON.parse(clientsJson);
                    for (const client of clients) {
                        try {
                            await API.Clients.create(client);
                            console.log(`[API] Client ${client.firstName} ${client.lastName} synchronisé`);
                        } catch (e) {
                            console.warn(`[API] Erreur sync client:`, e);
                        }
                    }
                }

                // Properties
                const propsJson = localStorage.getItem('PROPERTIES_DB');
                if (propsJson) {
                    const props = JSON.parse(propsJson);
                    for (const prop of props) {
                        try {
                            await API.Properties.create(prop);
                            console.log(`[API] Propriété ${prop.name} synchronisée`);
                        } catch (e) {
                            console.warn(`[API] Erreur sync propriété:`, e);
                        }
                    }
                }

                // Transactions
                const transJson = localStorage.getItem('TRANSACTIONS_DB');
                if (transJson) {
                    const trans = JSON.parse(transJson);
                    for (const t of trans) {
                        try {
                            await API.Transactions.create(t);
                            console.log(`[API] Transaction #${t.id} synchronisée`);
                        } catch (e) {
                            console.warn(`[API] Erreur sync transaction:`, e);
                        }
                    }
                }

                console.log('[API] ✓ Synchronisation complétée');
                return true;
            } catch (error) {
                console.error('[API] Erreur synchronisation:', error);
                return false;
            }
        },

        /**
         * Nettoie complètement le localStorage et les données en cache
         * Supprime tous les items du cache qui ne sont pas en base de données
         */
        cleanAllCache: () => {
            try {
                const itemsCleared = [];
                
                // Récupérer tous les clés du localStorage
                const keys = Object.keys(localStorage);
                
                for (let key of keys) {
                    localStorage.removeItem(key);
                    itemsCleared.push(key);
                }

                console.log('🧹 [API] Cache nettoyé:', itemsCleared);
                console.log(`✓ ${itemsCleared.length} éléments supprimés du cache`);
                
                return {
                    success: true,
                    itemsCleared: itemsCleared,
                    count: itemsCleared.length,
                    message: `${itemsCleared.length} éléments supprimés du cache`
                };
            } catch (error) {
                console.error('[API] Erreur lors du nettoyage:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    };

    // ─────────────────────────────────────────────────────────────
    // AFFICHER STATUT DANS LA CONSOLE
    // ─────────────────────────────────────────────────────────────
    const user = window.APIUtils.getCurrentUser();
    if (user) {
        console.log(`🚀 [SYGIM] API initialisée — Connecté: ${user.firstName || user.username}`);
    } else {
        console.log('🚀 [SYGIM] API initialisée — Non authentifié');
    }
})();
