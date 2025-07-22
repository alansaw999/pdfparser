// Test setup file for Jest
require('dotenv').config({ path: '.env.test' });

// Global test configuration
global.console = {
  ...console,
  // Suppress console output during tests to reduce noise
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Mock file system operations by default
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  createWriteStream: jest.fn(),
}));

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001'; // Use different port for tests
