import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assistantMaxRoundsFallbackMessage,
  categorizeAssistantErrorMessage,
  isAssistantEventTypeAllowed,
  isAssistantProposalExpired,
} from './assistantPolicy.js';

test('categorizeAssistantErrorMessage maps expected categories', () => {
  assert.deepEqual(categorizeAssistantErrorMessage('Too many requests from OpenRouter'), {
    status: 429,
    code: 'rate_limit',
  });
  assert.deepEqual(categorizeAssistantErrorMessage('Request timeout:120000'), {
    status: 504,
    code: 'timeout',
  });
  assert.deepEqual(categorizeAssistantErrorMessage('OpenRouter returned no message'), {
    status: 502,
    code: 'upstream_error',
  });
  assert.deepEqual(categorizeAssistantErrorMessage('unknown tool failed'), {
    status: 502,
    code: 'tool_error',
  });
});

test('assistant event policy enforces teacher and CR restrictions', () => {
  assert.equal(isAssistantEventTypeAllowed('admin', 'defense').ok, true);
  assert.equal(isAssistantEventTypeAllowed('teacher', 'lecture').ok, true);
  assert.equal(isAssistantEventTypeAllowed('teacher', 'defense').ok, false);
  assert.equal(isAssistantEventTypeAllowed('student', 'lab').ok, true);
  assert.equal(isAssistantEventTypeAllowed('student', 'exam').ok, false);
});

test('assistant proposal expiry helper covers valid and invalid timestamps', () => {
  const now = new Date('2026-04-04T12:00:00.000Z').getTime();
  assert.equal(isAssistantProposalExpired('2026-04-04T11:59:59.000Z', now), true);
  assert.equal(isAssistantProposalExpired('2026-04-04T12:00:01.000Z', now), false);
  assert.equal(isAssistantProposalExpired('not-a-date', now), true);
});

test('max rounds fallback message stays non-empty and user-friendly', () => {
  const msg = assistantMaxRoundsFallbackMessage();
  assert.equal(msg.length > 20, true);
  assert.equal(msg.toLowerCase().includes('step limit'), true);
});
