/**
 * Test manuel du verrou de refresh concurrent (race condition).
 *
 * Simule 3 appels API parallèles avec un JWT expiré.
 * Le test passe si UN SEUL appel POST /auth/refresh est émis.
 *
 * Usage: node tests/manual/refresh-race-test.mjs
 */

const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
store['sygim_jwt_token'] = 'expired-jwt-token';
store['sygim_refresh_token'] = 'valid-refresh-token';

let refreshCallCount = 0;
let apiCallCount = 0;

globalThis.fetch = async (url, options) => {
  if (url.includes('/auth/refresh')) {
    refreshCallCount++;
    console.log(`  [FETCH] /auth/refresh appel #${refreshCallCount}`);
    await new Promise(r => setTimeout(r, 100));
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { accessToken: `new-token-${Date.now()}` } }),
    };
  }
  apiCallCount++;
  const bearer = options?.headers?.Authorization || '';
  const token = bearer.replace('Bearer ', '');
  if (token && token.startsWith('new-token-')) {
    return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({}) };
  }
  return {
    ok: false, status: 401,
    headers: { get: () => 'application/json' },
    json: async () => ({ error: 'Token expiré' }),
  };
};

class HttpClient {
  constructor() {
    this.token = store['sygim_jwt_token'];
    this.retryAttempts = 2;
    this.baseUrl = 'http://localhost:5000/api';
    this.onUnauthorized = () => {};
  }

  _getRefreshToken() { return store['sygim_refresh_token']; }

  setToken(t) {
    this.token = t;
    store['sygim_jwt_token'] = t;
  }

  _getHeaders() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async _refreshToken() {
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = (async () => {
      const refreshToken = this._getRefreshToken();
      if (!refreshToken) throw new Error('Aucun refresh token disponible');

      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (!response.ok) throw new Error('Refresh token expiré');

      const data = await response.json();
      const newToken = data.data?.accessToken || data.accessToken;
      if (!newToken) throw new Error('Aucun token');

      this.setToken(newToken);
      return newToken;
    })();

    this._refreshPromise
      .catch(() => {})
      .finally(() => { this._refreshPromise = null; });

    return this._refreshPromise;
  }

  async request(label) {
    let lastError = null;
    let refreshed = false;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const url = `${this.baseUrl}/any`;
        const response = await fetch(url, { headers: this._getHeaders() });

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 401 && !refreshed && this._getRefreshToken()) {
            try {
              await this._refreshToken();
              refreshed = true;
              continue;
            } catch (refreshError) {
              this.onUnauthorized(data);
              throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' });
            }
          } else if (response.status === 401) {
            this.onUnauthorized(data);
            throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' });
          }
          throw Object.assign(new Error(data.message || 'API Error'), { code: 'SERVER_ERROR' });
        }
        return { ok: true };
      } catch (error) {
        lastError = error;
        if (error.code === 'UNAUTHORIZED') throw error;
        if (error.code === 'VALIDATION') throw error;
        if (attempt < this.retryAttempts - 1) {
          await new Promise(r => setTimeout(r, 10));
        }
      }
    }
    throw lastError;
  }
}

const client = new HttpClient();
let unauthorizedCalled = false;
client.onUnauthorized = () => { unauthorizedCalled = true; };

console.log('\n═ 3 appels API parallèles avec token expiré ═\n');

const t0 = Date.now();
const results = await Promise.allSettled([
  client.request('A'),
  client.request('B'),
  client.request('C'),
]);
const elapsed = Date.now() - t0;

console.log(`\n═ Résultats ═`);
results.forEach((r, i) => {
  const label = String.fromCharCode(65 + i);
  const val = r.status === 'fulfilled' ? '200 OK' : r.reason?.code;
  console.log(`  Requête ${label}: ${val}`);
});

console.log(`\n═ Vérification ═`);
console.log(`  Appels à /auth/refresh     : ${refreshCallCount}`);
console.log(`  onUnauthorized appelé       : ${unauthorizedCalled}`);
console.log(`  Appels API totaux           : ${apiCallCount}`);

const passed = refreshCallCount === 1 && !unauthorizedCalled && elapsed < 250;
console.log(`\n  → ${passed ? '✅ TEST PASSÉ' : '❌ TEST ÉCHOUÉ'}`);
console.log(`    ${refreshCallCount === 1 ? '✓ 1 seul refresh' : '✗ ' + refreshCallCount + ' refreshes'}`);
console.log(`    ${!unauthorizedCalled ? '✓ Pas de redirection' : '✗ Redirection intempestive'}`);
console.log(`    ${elapsed < 250 ? `✓ Temps ~${elapsed}ms` : `✗ Temps ~${elapsed}ms (parallélisation insuffisante)`}`);

process.exit(passed ? 0 : 1);
