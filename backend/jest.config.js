module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/teardown.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/config/',
    '/src/index.js',
    '/src/app.js'
  ],
  collectCoverageFrom: [
    'src/modules/**/*.js',
    'src/services/**/*.js',
    'src/controllers/**/*.js'
  ],
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/functional/**/*.test.js',
    '**/src/**/__tests__/**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      statements: 30,
      branches: 8,
      functions: 25,
      lines: 30
    }
  },
  clearMocks: true
};
