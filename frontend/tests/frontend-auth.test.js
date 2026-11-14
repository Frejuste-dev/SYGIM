import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { httpClient } from '../src/api/client.js';
import { API } from '../src/api/services.js';
import { CONFIG } from '../src/api/config.js';

describe('Frontend Auth (HttpOnly)', () => {
    let fetchCalls = [];

    beforeEach(() => {
        fetchCalls = [];
        global.mockApiFailure = null;
        global.mockRefreshFailure = false;
        global.hasRefreshed = false;
        httpClient._refreshPromise = null;
        localStorage.clear();

        global.fetch = vi.fn(async (url, options) => {
            fetchCalls.push({ url, options });
        
            if (url.includes('/auth/login')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ success: true, data: { user: { id: 1, username: 'test' } } }),
                    headers: new Map([['content-type', 'application/json']])
                };
            }
            
            if (url.includes('/auth/logout')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ success: true }),
                    headers: new Map([['content-type', 'application/json']])
                };
            }
        
            if (url.includes('/auth/refresh')) {
                if (global.mockRefreshFailure) {
                    return {
                        ok: false,
                        status: 401,
                        json: async () => ({ success: false, message: 'Invalid refresh token' }),
                        headers: new Map([['content-type', 'application/json']])
                    };
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ success: true }),
                    headers: new Map([['content-type', 'application/json']])
                };
            }
        
            if (url.includes('/api/test')) {
                if (global.mockApiFailure === 401 && !global.hasRefreshed) {
                    global.hasRefreshed = true; // to succeed next time
                    return {
                        ok: false,
                        status: 401,
                        json: async () => ({ message: 'Unauthorized' }),
                        headers: new Map([['content-type', 'application/json']])
                    };
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ success: true, data: 'test data' }),
                    headers: new Map([['content-type', 'application/json']])
                };
            }
        
            return {
                ok: false,
                status: 404,
                json: async () => ({ message: 'Not found' }),
                headers: new Map([['content-type', 'application/json']])
            };
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Login ne stocke aucun JWT et utilise la reponse backend', async () => {
        const res = await API.Auth.login({ username: 'test', password: 'password' });
        expect(res.success).toBe(true);
        expect(res.data.user.username).toBe('test');
        expect(localStorage.getItem('token')).toBeNull(); // Aucun secret ne doit etre ecrit
    });

    it('Requete authentifiee utilise credentials: include et pas de Bearer', async () => {
        await httpClient.get('/api/test');
        expect(fetchCalls.length).toBe(1);
        const call = fetchCalls[0];
        expect(call.options.credentials).toBe('include');
        expect(call.options.headers?.Authorization).toBeUndefined();
    });

    it('Refresh utilise POST, pas de body, pas d\'Auth, et credentials: include', async () => {
        await API.Auth.refreshToken();
        const call = fetchCalls[0];
        expect(call.options.method).toBe('POST');
        expect(call.options.credentials).toBe('include');
        expect(call.options.headers?.Authorization).toBeUndefined();
        expect(call.options.body).toBeUndefined();
    });

    it('Logout utilise POST, pas de body, et credentials: include', async () => {
        localStorage.setItem(CONFIG.STORAGE.CURRENT_USER, '{"id":1}');
        await API.Auth.logout();
        const call = fetchCalls[0];
        expect(call.options.method).toBe('POST');
        expect(call.options.credentials).toBe('include');
        expect(call.options.body).toBeUndefined();
        expect(localStorage.getItem(CONFIG.STORAGE.CURRENT_USER)).toBeNull();
    });

    it('Refresh storm : plusieurs 401 concurrents declenchent un seul /refresh', async () => {
        global.mockApiFailure = 401;
        await Promise.allSettled([
            httpClient.get('/api/test'),
            httpClient.get('/api/test'),
            httpClient.get('/api/test')
        ]);
        
        const refreshCalls = fetchCalls.filter(c => c.url.includes('/auth/refresh'));
        expect(refreshCalls.length).toBe(1);
    });

    it('Refresh failure : si /refresh retourne 401, on deconnecte sans boucle', async () => {
        global.mockApiFailure = 401;
        global.mockRefreshFailure = true;
        
        await expect(httpClient.get('/api/test')).rejects.toThrow();
        
        const refreshCalls = fetchCalls.filter(c => c.url.includes('/auth/refresh'));
        expect(refreshCalls.length).toBe(1);
        const testCalls = fetchCalls.filter(c => c.url.includes('/api/test'));
        expect(testCalls.length).toBe(1); // Ne doit pas rejouer la requete
    });
});
