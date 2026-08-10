import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTRACT_VERSION,
  ContractError,
  createLocalSessionApi,
} from '../src/contracts/local-session-api.mjs';

const validDraft = {
  scenarioId: 'coffee-order',
  title: 'Ordering coffee',
  turns: [
    { speaker: 'learner', text: 'Can I get a latte?', occurredAt: '2026-08-10T08:00:00.000Z' },
    { speaker: 'coach', text: 'Sure. What size?', occurredAt: '2026-08-10T08:00:05.000Z' },
  ],
};

test('creates, lists, and reads a versioned local session without provider credentials', () => {
  const api = createLocalSessionApi({ now: () => '2026-08-10T08:01:00.000Z', idFactory: () => 'ses_local_001' });

  const created = api.createSession(validDraft);
  assert.equal(created.contractVersion, CONTRACT_VERSION);
  assert.equal(created.id, 'ses_local_001');
  assert.equal(created.storage, 'local');
  assert.equal(created.turns.length, 2);

  assert.deepEqual(api.listSessions(), [created]);
  assert.deepEqual(api.getSession(created.id), created);
});

test('rejects missing sessions and transcript imports that contain unsupported remote data', () => {
  const api = createLocalSessionApi();

  assert.throws(
    () => api.getSession('ses_missing'),
    (error) => error instanceof ContractError && error.code === 'SESSION_NOT_FOUND',
  );
  assert.throws(
    () => api.importTranscript({ source: 'remote-url', transcript: 'hello' }),
    (error) => error instanceof ContractError && error.code === 'VALIDATION_ERROR',
  );
});

test('returns deterministic local feedback and marks it as non-provider-generated', () => {
  const api = createLocalSessionApi({ now: () => '2026-08-10T08:01:00.000Z', idFactory: () => 'ses_local_002' });
  const session = api.createSession(validDraft);

  const feedback = api.requestFeedback(session.id);

  assert.equal(feedback.contractVersion, CONTRACT_VERSION);
  assert.equal(feedback.generator, 'local-rule');
  assert.equal(feedback.providerCallMade, false);
  assert.equal(feedback.sessionId, session.id);
});
