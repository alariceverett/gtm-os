import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{ts,tsx,js}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      include: [
        'lib/**/*.ts',
        'apps/gtm-command-center/**/*.ts',
      ],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        'apps/gtm-command-center/frontend-shell/lib/predictions/simple-forecast.ts',
        'apps/gtm-command-center/frontend-shell/lib/preference-service.ts',
      ],
    },
    reporters: ['default', 'json'], // JSON for CI pipeline
    outputFile: './test-results/test-report.json',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@/lib': path.resolve(__dirname, './lib'),
    },
  },
});
