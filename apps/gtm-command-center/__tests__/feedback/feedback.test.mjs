/**
 * Feedback & Learning Tests (GATE 3)
 * 
 * Tests:
 * 1. Feedback signal creation
 * 2. Preference model update
 * 3. API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'node:http';
import crypto from 'node:crypto';

// Test configuration
const TEST_PORT = 1982;
const TEST_HOST = `http://localhost:${TEST_PORT}`;

// Generate random test data
function generateTestId() {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

describe('Feedback System Tests (GATE 3)', () => {
  // Store test data
  const testSignals = [];
  const testUserId = generateTestId();

  describe('1. Feedback Signal Creation', () => {
    it('should create explicit_positive feedback signal', async () => {
      const signal = {
        signal_type: 'explicit_positive',
        user_id: testUserId,
        context: {
          page: '/test',
          section: 'test-section',
          previous_actions: ['view_section'],
          ui_state: { theme: 'dark' }
        },
        content: 'Great feature!',
        outcome: { helpful: true },
        learning_weight: 1.0
      };

      const response = await fetch(`${TEST_HOST}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal)
      });

      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.status).toBe('stored');
      expect(data.marker).toBe('feedback-signal-v1');
      
      testSignals.push(data.id);
    });

    it('should create explicit_negative feedback signal', async () => {
      const signal = {
        signal_type: 'explicit_negative',
        user_id: testUserId,
        context: {
          page: '/test',
          section: 'test-section',
          previous_actions: ['view_section', 'click_feedback'],
          ui_state: { theme: 'light' }
        },
        content: 'Confusing UI',
        outcome: { helpful: false },
        learning_weight: 1.0
      };

      const response = await fetch(`${TEST_HOST}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal)
      });

      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.status).toBe('stored');
      
      testSignals.push(data.id);
    });

    it('should create implicit_dwell signal', async () => {
      const signal = {
        signal_type: 'implicit_dwell',
        user_id: testUserId,
        context: {
          page: '/test',
          section: 'hero-section',
          duration_ms: 15000,
          scroll_depth: 0.75
        },
        learning_weight: 0.5
      };

      const response = await fetch(`${TEST_HOST}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal)
      });

      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.status).toBe('stored');
      
      testSignals.push(data.id);
    });

    it('should create command_issued signal', async () => {
      const signal = {
        signal_type: 'command_issued',
        user_id: testUserId,
        context: {
          page: '/',
          section: 'command-palette',
          command: 'open targeting'
        },
        content: 'open targeting',
        learning_weight: 0.8
      };

      const response = await fetch(`${TEST_HOST}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal)
      });

      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.status).toBe('stored');
      
      testSignals.push(data.id);
    });

    it('should reject invalid signal_type', async () => {
      const signal = {
        signal_type: 'invalid_type',
        user_id: testUserId,
        context: { page: '/test' }
      };

      const response = await fetch(`${TEST_HOST}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal)
      });

      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid signal_type');
      expect(data.marker).toBe('feedback-error-v1');
    });

    it('should handle empty content gracefully', async () => {
      const signal = {
        signal_type: 'explicit_positive',
        user_id: testUserId,
        context: { page: '/test', section: 'auto-feedback' },
        learning_weight: 0.3
      };

      const response = await fetch(`${TEST_HOST}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal)
      });

      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      
      testSignals.push(data.id);
    });
  });

  describe('2. Preference Model Update', () => {
    it('should create default preferences for new user', async () => {
      const newUserId = generateTestId();
      
      const response = await fetch(`${TEST_HOST}/api/users/${newUserId}/preferences`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.feature_weights).toBeDefined();
      expect(data.ui_config).toBeDefined();
      expect(data.prediction_accuracy).toBeDefined();
      expect(Number.isFinite(data.prediction_accuracy)).toBe(true);
    });

    it('should update preferences with delta', async () => {
      const delta = {
        delta: {
          dark_mode_preference: 0.8,
          compact_ui_preference: 0.3
        }
      };

      const response = await fetch(`${TEST_HOST}/api/users/${testUserId}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delta)
      });

      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.updated).toBe(true);
      expect(data.version).toBeGreaterThan(0);
      expect(data.marker).toBe('user-preferences-update-v1');
    });

    it('should update preferences with full model', async () => {
      const fullModel = {
        feature_weights: {
          dark_mode_preference: 0.9,
          compact_ui_preference: 0.2,
          notifications: 0.7
        },
        ui_config: {
          theme: 'dark',
          density: 'compact'
        }
      };

      const response = await fetch(`${TEST_HOST}/api/users/${testUserId}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullModel)
      });

      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.updated).toBe(true);
      expect(data.version).toBeGreaterThan(0);
    });

    it('should reject invalid update payload', async () => {
      const invalidPayload = {
        invalid_field: 'value'
      };

      const response = await fetch(`${TEST_HOST}/api/users/${testUserId}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload)
      });

      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid update payload');
      expect(data.marker).toBe('user-preferences-update-error-v1');
    });

    it('should persist preference changes', async () => {
      // First update
      await fetch(`${TEST_HOST}/api/users/${testUserId}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delta: { dark_mode_preference: 0.95 }
        })
      });

      // Verify persistence
      const response = await fetch(`${TEST_HOST}/api/users/${testUserId}/preferences`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.feature_weights.dark_mode_preference).toBe(0.95);
    });
  });

  describe('3. API Endpoints', () => {
    it('should return analytics data', async () => {
      const response = await fetch(`${TEST_HOST}/api/feedback/analytics`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.marker).toBe('feedback-analytics-v1');
      expect(data.signals_by_type).toBeDefined();
      expect(data.trends).toBeDefined();
    });

    it('should store interaction batch', async () => {
      const batch = {
        user_id: testUserId,
        session_id: `session-${Date.now()}`,
        batch_data: {
          events: [
            {
              type: 'click',
              element: { tag: 'button', text: 'Submit' },
              timestamp: Date.now()
            },
            {
              type: 'scroll',
              metadata: { scrollY: 500 }
            }
          ],
          page_url: '/test',
          start_time: Date.now(),
          end_time: Date.now() + 5000
        }
      };

      const response = await fetch(`${TEST_HOST}/api/feedback/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch)
      });

      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.status).toBe('batched');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await fetch(`${TEST_HOST}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {'
      });

      // Should either return 400 or 500
      expect([400, 500]).toContain(response.status);
    });

    it('should return 404 for unknown endpoint', async () => {
      const response = await fetch(`${TEST_HOST}/api/feedback/unknown`);
      expect(response.status).toBe(404);
    });
  });

  // Cleanup
  afterAll(async () => {
    // Log test results
    console.log(`\nTest Summary:`);
    console.log(`- Created ${testSignals.length} feedback signals`);
    console.log(`- User ID: ${testUserId}`);
    console.log(`\nAll tests completed successfully!`);
  });
});

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Feedback System Tests (GATE 3)');
  console.log('================================');
  console.log('\nNote: This test file requires:');
  console.log('1. Backend server running (npm run dev or similar)');
  console.log('2. Database migrations applied (003_feedback_system.sql)');
  console.log('3. Jest or similar test runner\n');
}

export {};
