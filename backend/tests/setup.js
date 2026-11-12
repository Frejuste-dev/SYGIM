// Mock des variables d'environnement pour les tests
process.env.JWT_SECRET = 'test-jwt-secret-key-very-secure';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';
process.env.PORT = '5000';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.dev') });

process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_NAME = process.env.DB_NAME || 'sygim_test'; // Allow override, otherwise sygim_test
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';

// Si on veut mocker la base de données globalement, on peut le faire ici ou dans chaque test.
// Pour les tests unitaires/intégration sans BDD, on utilisera jest.mock('../src/config/database') dans les tests.
