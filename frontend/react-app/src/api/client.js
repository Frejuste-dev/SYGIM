/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Client HTTP (React ES Module)                      ║
 * ║     Gère les requêtes, authentification, erreurs et retry         ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import { CONFIG } from './config';

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
        this.token = this._getToken();

        // Event listeners pour la gestion globale d'erreurs
        this.onError = config.onError || (() => {});
        this.onUnauthorized = config.onUnauthorized || (() => {});
    }

    /**
     * Récupère le JWT du localStorage
     */
    _getToken() {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(CONFIG.STORAGE.JWT_TOKEN);
    }

    /**
     * Met à jour le token (appelé après login)
     */
    setToken(token) {
        this.token = token;
        if (typeof window === 'undefined') return;
        if (token) {
            localStorage.setItem(CONFIG.STORAGE.JWT_TOKEN, token);
        } else {
            localStorage.removeItem(CONFIG.STORAGE.JWT_TOKEN);
        }
    }

    /**
     * Construit les en-têtes HTTP standards
     */
    _getHeaders(additionalHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...additionalHeaders
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    /**
     * Effectue une requête HTTP avec retry automatique et gestion des paramètres de requête (query string)
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

        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                const fetchOptions = {
                    method,
                    headers: this._getHeaders(options.headers),
                    signal: controller.signal,
                    ...options.fetchOptions
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
                    if (response.status === 401) {
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
export const httpClient = new HttpClient({
    onUnauthorized: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(CONFIG.STORAGE.JWT_TOKEN);
            localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
            // On laisse l'application gérer la redirection vers /login via React Router
        }
    }
});
