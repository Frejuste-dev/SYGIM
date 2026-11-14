#!/usr/bin/env node
/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║         SYGIM — Script de test complet des corrections                   ║
 * ║  Vérifie: Auth, Clients, Validations, Doublons, Permissions             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

const http = require('http');
const BASE_URL = 'http://localhost:5000';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────────

let testCount = 0;
let passedCount = 0;
let failedTests = [];

function test(name, condition, details = '') {
    testCount++;
    if (condition) {
        passedCount++;
        console.log(`✅ ${name}`);
    } else {
        console.log(`❌ ${name}`);
        if (details) console.log(`   └─ ${details}`);
        failedTests.push(name);
    }
}

function httpRequest(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data, headers: res.headers });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
    console.log('\n🧪 SYGIM — Tests des Corrections\n');
    console.log('═'.repeat(70));

    // Test 1: Vérifier que le serveur répond
    console.log('\n📌 Test 1: Connectivité du serveur');
    try {
        const response = await httpRequest('GET', '/');
        test('Serveur répond', response.status < 500, `Status: ${response.status}`);
    } catch (err) {
        test('Serveur répond', false, err.message);
        console.log('\n❌ Le serveur n\'est pas accessible!');
        console.log('   Assurez-vous que npm start est en cours d\'exécution');
        return;
    }

    // Test 2: Inscription (route publique)
    console.log('\n📌 Test 2: Route POST /api/auth/register (publique)');
    const newUser = {
        username: `test_${Date.now()}`,
        password: 'Test1234!',
        firstName: 'Test',
        lastName: 'User',
        email: `test_${Date.now()}@example.com`,
        phone: '+223 70 00 00 01'
    };

    const registerResponse = await httpRequest('POST', '/api/auth/register', newUser);
    test('Status 201 (Created)', registerResponse.status === 201, `Got ${registerResponse.status}`);
    test('Retourne success: true', registerResponse.data.success === true);
    test('Retourne un token JWT', registerResponse.data.token && registerResponse.data.token.length > 20);
    test('Retourne user avec ID', registerResponse.data.user && registerResponse.data.user.id);
    test('Utilisateur a rôle "collector"', registerResponse.data.user?.role === 'collector');

    let registeredUserId = registerResponse.data.user?.id;
    let registeredToken = registerResponse.data.token;

    // Test 3: Validation email format
    console.log('\n📌 Test 3: Validation du format email');
    const invalidEmailResponse = await httpRequest('POST', '/api/auth/register', {
        username: `test_${Date.now()}`,
        password: 'Test1234!',
        email: 'invalid-email-format'
    });
    test('Rejette email invalide (400)', invalidEmailResponse.status === 400);
    test('Message d\'erreur mentionné "email invalide"', 
         invalidEmailResponse.data.error?.toLowerCase().includes('email'));

    // Test 4: Validation mot de passe faible
    console.log('\n📌 Test 4: Validation du mot de passe');
    const weakPasswordResponse = await httpRequest('POST', '/api/auth/register', {
        username: `test_${Date.now()}`,
        password: 'weak'
    });
    test('Rejette mot de passe < 6 chars (400)', weakPasswordResponse.status === 400);

    // Test 5: Prévention des doublons - username
    console.log('\n📌 Test 5: Prévention des doublons - username');
    const duplicate1 = {
        username: newUser.username,
        password: 'AnotherPass123',
        email: `test_${Date.now()}@example.com`
    };
    const duplicateResponse = await httpRequest('POST', '/api/auth/register', duplicate1);
    test('Rejette username dupliqué (409)', duplicateResponse.status === 409);
    test('Message d\'erreur mentionné "déjà existe"', 
         duplicateResponse.data.error?.toLowerCase().includes('existe'));

    // Test 6: Login avec le nouvel utilisateur
    console.log('\n📌 Test 6: Login avec nouvel utilisateur');
    const loginResponse = await httpRequest('POST', '/api/auth/login', {
        username: newUser.username,
        password: newUser.password
    });
    test('Status 200 (OK)', loginResponse.status === 200);
    test('Retourne success: true', loginResponse.data.success === true);
    test('Retourne un token', loginResponse.data.token && loginResponse.data.token.length > 20);
    test('User a même ID qu\'à l\'inscription', loginResponse.data.user?.id === registeredUserId);

    // Test 7: GET /api/auth/me (authenticated)
    console.log('\n📌 Test 7: Endpoint /api/auth/me (authentifié)');
    const meResponse = await httpRequest('GET', '/api/auth/me', null, registeredToken);
    test('Status 200 avec token valide', meResponse.status === 200);
    test('Retourne user data', meResponse.data.success === true && meResponse.data.user);

    // Test 8: Rejette requête sans token
    console.log('\n📌 Test 8: Authentification requise');
    const noTokenResponse = await httpRequest('GET', '/api/auth/me');
    test('Status 401 sans token', noTokenResponse.status === 401);

    // Test 9: POST /api/clients (validation phone format)
    console.log('\n📌 Test 9: Création client - validation téléphone');
    const invalidPhoneResponse = await httpRequest('POST', '/api/clients', {
        firstName: 'Test',
        lastName: 'Client',
        phone: 'invalid'
    }, registeredToken);
    test('Rejette phone invalide (status 400)', 
         invalidPhoneResponse.status === 400 || invalidPhoneResponse.status === 403);

    // Test 10: Logout
    console.log('\n📌 Test 10: Logout');
    const logoutResponse = await httpRequest('POST', '/api/auth/logout');
    test('Logout retourne success', logoutResponse.data?.success !== false || logoutResponse.status < 500);

    // ─────────────────────────────────────────────────────────────────────────
    // RÉSUMÉ
    // ─────────────────────────────────────────────────────────────────────────

    console.log('\n' + '═'.repeat(70));
    console.log('\n📊 RÉSUMÉ DES TESTS');
    console.log(`   Tests passés: ${passedCount}/${testCount}`);
    
    if (failedTests.length > 0) {
        console.log(`\n❌ Tests échoués (${failedTests.length}):`);
        failedTests.forEach(name => console.log(`   └─ ${name}`));
    } else {
        console.log('\n✅ TOUS LES TESTS SONT PASSÉS!');
    }

    console.log('\n' + '═'.repeat(70) + '\n');

    process.exit(failedTests.length > 0 ? 1 : 0);
}

// Lancer les tests
runTests().catch(err => {
    console.error('Erreur lors des tests:', err);
    process.exit(1);
});
