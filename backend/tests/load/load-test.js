import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5000/api';

const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const queryDuration = new Trend('query_duration');

const CREDENTIALS = {
  admin: { username: __ENV.ADMIN_USER || 'admin', password: __ENV.ADMIN_PASS || 'admin123' },
  collector: { username: __ENV.COLLECTOR_USER || 'collector', password: __ENV.COLLECTOR_PASS || 'collector123' }
};

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 30 },
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05']
  }
};

function getToken(role) {
  const creds = CREDENTIALS[role] || CREDENTIALS.collector;
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify(creds), {
    headers: { 'Content-Type': 'application/json' }
  });
  check(res, { 'login ok': (r) => r.status === 200 }) || errorRate.add(1);
  loginDuration.add(res.timings.duration);
  if (res.status !== 200) return null;
  return res.json().data?.accessToken;
}

function authedGet(url, token, tag) {
  const res = http.get(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  check(res, { [`${tag} ok`]: (r) => r.status === 200 }) || errorRate.add(1);
  queryDuration.add(res.timings.duration);
  return res;
}

export default function () {
  group('Authentification', () => {
    const adminToken = getToken('admin');
    if (!adminToken) { sleep(3); return; }

    group('Endpoints GET', () => {
      authedGet(`${BASE_URL}/clients`, adminToken, 'clients');
      authedGet(`${BASE_URL}/properties`, adminToken, 'properties');
      authedGet(`${BASE_URL}/owners`, adminToken, 'owners');
      authedGet(`${BASE_URL}/transactions`, adminToken, 'transactions');
      authedGet(`${BASE_URL}/collectors`, adminToken, 'collectors');
      authedGet(`${BASE_URL}/alerts/dashboard`, adminToken, 'alerts');
      authedGet(`${BASE_URL}/reports/dashboard`, adminToken, 'reports');
      authedGet(`${BASE_URL}/health`, adminToken, 'health');
    });

    group('Endpoints POST', () => {
      const clientPayload = JSON.stringify({
        first_name: `Test_${__VU}_${__ITER}`,
        last_name: 'LoadTest',
        phone: '+22370000000',
        email: `loadtest${__VU}_${__ITER}@test.com`
      });
      const createRes = http.post(`${BASE_URL}/clients`, clientPayload, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
      });
      check(createRes, { 'create client ok': (r) => r.status === 201 }) || errorRate.add(1);

      if (createRes.status === 201) {
        const clientId = createRes.json().data?.id;
        if (clientId) {
          http.del(`${BASE_URL}/clients/${clientId}`, null, {
            headers: { Authorization: `Bearer ${adminToken}` }
          });
        }
      }
    });
  });

  sleep(1);
}
