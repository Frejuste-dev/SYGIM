/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Client HTTP (React ES Module)                      ║
 * ║     Gère les requêtes, authentification, erreurs et retry         ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import { CONFIG } from './config.js';

export class ApiError extends Error {
    constructor(message, code, status, data = {}) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = status;
        this.data = data;
    }
}

export class HttpClient {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || CONFIG.API.BASE;
        this.timeout = config.timeout || CONFIG.API.TIMEOUT;
        this.retryAttempts = config.retryAttempts || CONFIG.API.RETRY_ATTEMPTS;
        this.retryDelay = config.retryDelay || CONFIG.API.RETRY_DELAY;

        // Event listeners pour la gestion globale d'erreurs
        this.onError = config.onError || (() => {});
        this.onUnauthorized = config.onUnauthorized || (() => {});
    }

    /**
     * Construit les en-têtes HTTP standards
     */
    _getHeaders(additionalHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...additionalHeaders
        };

        return headers;
    }

    /**
     * Tente un refresh token (via cookie HttpOnly)
     * Utilise une promesse partagée pour éviter les refreshes concurrents
     * (race condition quand plusieurs appels API reçoivent 401 simultanément)
     */
    async _refreshToken() {
        if (this._refreshPromise) return this._refreshPromise;

        this._refreshPromise = (async () => {
            const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error('Refresh token expiré ou invalide');

            // Succès de la rotation côté backend, le nouveau cookie a été posé.
            return true;
        })();

        this._refreshPromise
            .catch(() => {}) // silently absorb rejection so finally runs
            .finally(() => { this._refreshPromise = null; });

        return this._refreshPromise;
    }

    /**
     * Effectue une requête HTTP avec retry automatique, refresh token et gestion des paramètres de requête
     */
    async request(method, path, options = {}) {
        let url = `${this.baseUrl}${path}`;
        
        // Ajouter les paramètres de requête si présents
        if (options.params && Object.keys(options.params).length > 0) {
            const queryParams = new URLSearchParams();
            Object.entries(options.params).forEach(([key, val]) => {
                if (val !== undefined && val !== null) {
                    queryParams.append(key, val);
                }
            });
            url = `${url}?${queryParams.toString()}`;
        }

        let lastError = null;
        let refreshed = false;
        let maxAttempts = Math.max(1, this.retryAttempts);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                const fetchOptions = {
                    method,
                    headers: this._getHeaders(options.headers),
                    signal: controller.signal,
                    ...options.fetchOptions,
                    // L'authentification dépend exclusivement des cookies HttpOnly.
                    credentials: 'include'
                };

                if (options.body && method !== 'GET') {
                    fetchOptions.body = JSON.stringify(options.body);
                }

                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);

                const isJson = response.headers.get('content-type')?.includes('application/json');
                const data = isJson ? await response.json() : await response.text();

                // Gestion des erreurs HTTP
                if (!response.ok) {
                    if (response.status === 401 && !refreshed && path !== '/auth/refresh') {
                        try {
                            await this._refreshToken();
                            refreshed = true;
                            // Le rejeu après rotation ne consomme pas une tentative réseau.
                            maxAttempts += 1;
                            continue; // retry now that cookies are refreshed
                        } catch (refreshError) {
                            this.onUnauthorized(data);
                            throw new ApiError('Unauthorized', 'UNAUTHORIZED', response.status, data);
                        }
                    } else if (response.status === 401) {
                        this.onUnauthorized(data);
                        throw new ApiError('Unauthorized', 'UNAUTHORIZED', response.status, data);
                    } else if (response.status === 403) {
                        throw new ApiError('Forbidden', 'FORBIDDEN', response.status, data);
                    } else if (response.status === 404) {
                        throw new ApiError('Not Found', 'NOT_FOUND', response.status, data);
                    }
                    throw new ApiError(data.message || 'API Error', 'SERVER_ERROR', response.status, data);
                }

                return data;

            } catch (error) {
                lastError = error;

                // Ne pas retry sur les erreurs d'authentification
                if (error instanceof ApiError && (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN')) {
                    this.onError(error);
                    throw error;
                }

                // Ne pas retry sur les erreurs de validation
                if (error instanceof ApiError && error.code === 'VALIDATION') {
                    this.onError(error);
                    throw error;
                }

                // Retry sur les autres erreurs
                if (attempt < this.retryAttempts - 1) {
                    console.warn(`[HTTP] Tentative ${attempt + 1}/${this.retryAttempts} échouée pour ${method} ${path}`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
                }
            }
        }

        this.onError(lastError);
        throw lastError;
    }

    // ─────────────────────────────────────────────────────────────
    // Raccourcis pour les méthodes HTTP
    // ─────────────────────────────────────────────────────────────

    async get(path, options = {}) {
        return this.request('GET', path, options);
    }

    async post(path, body, options = {}) {
        return this.request('POST', path, { body, ...options });
    }

    async put(path, body, options = {}) {
        return this.request('PUT', path, { body, ...options });
    }

    async patch(path, body, options = {}) {
        return this.request('PATCH', path, { body, ...options });
    }

    async delete(path, options = {}) {
        return this.request('DELETE', path, options);
    }
}

// Client HTTP global
// IMPORTANT : onUnauthorized NE doit PAS faire window.location.href
// car cela bypasse React Router et AuthContext.
// ProtectedRoute + AuthContext gerent la redirection vers /login automatiquement.
export const httpClient = new HttpClient({
    onUnauthorized: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
            // NE PAS faire window.location.href = '/login' ici.
            // AuthContext.setUser(null) -> ProtectedRoute -> <Navigate to="/login" />
        }
    }
});
