import { vi } from 'vitest';

// Global test setup
vi.mock('@/lib/db/types', () => ({
  // Mock types if needed
}));

// Mock console methods during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console output during tests
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Extend matchers if needed
declare global {
  namespace Vi {
    interface Assertion<T> {
      toBeWithinRange(floor: number, ceiling: number): T;
    }
  }
}
