// Jest setup file
import 'jest-environment-jsdom';

// Global test configuration
global.console = {
  ...console,
  // Override console methods if needed for tests
};

// Mock implementations can go here