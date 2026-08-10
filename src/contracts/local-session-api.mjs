/**
 * Zero-credential boundary for the text-first MVP.
 * TODO(phase-2-provider): keep provider calls server-side only after consent,
 * usage caps, rate limiting, deletion support, and a fallback are implemented.
 */
export const CONTRACT_VERSION = 'v1';

export class ContractError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'ContractError';
    this.code = code;
    this.details = details;
  }

  toResponse() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

const SPEAKERS = new Set(['learner', 'coach']);
const ALLOWED_IMPORT_SOURCES = new Set(['manual-paste', 'local-file']);

function assertObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractError('VALIDATION_ERROR', `${field} must be an object.`, [{ field, reason: 'invalid_type' }]);
  }
}

function assertString(value, field, { min = 1, max }) {
  if (typeof value !== 'string' || value.trim().length < min || (max && value.length > max)) {
    throw new ContractError('VALIDATION_ERROR', `${field} is invalid.`, [{ field, reason: 'invalid_value' }]);
  }
}

function validateTurns(turns) {
  if (!Array.isArray(turns) || turns.length < 1 || turns.length > 100) {
    throw new ContractError('VALIDATION_ERROR', 'turns must contain 1 to 100 entries.', [{ field: 'turns', reason: 'invalid_length' }]);
  }

  return turns.map((turn, index) => {
    assertObject(turn, `turns[${index}]`);
    if (!SPEAKERS.has(turn.speaker)) {
      throw new ContractError('VALIDATION_ERROR', 'turn speaker is invalid.', [{ field: `turns[${index}].speaker`, reason: 'invalid_value' }]);
    }
    assertString(turn.text, `turns[${index}].text`, { max: 2_000 });
    if (Number.isNaN(Date.parse(turn.occurredAt))) {
      throw new ContractError('VALIDATION_ERROR', 'turn occurredAt must be an ISO date.', [{ field: `turns[${index}].occurredAt`, reason: 'invalid_date' }]);
    }
    return { speaker: turn.speaker, text: turn.text.trim(), occurredAt: new Date(turn.occurredAt).toISOString() };
  });
}

function validateDraft(draft) {
  assertObject(draft, 'session');
  assertString(draft.scenarioId, 'scenarioId', { max: 80 });
  assertString(draft.title, 'title', { max: 120 });
  return {
    scenarioId: draft.scenarioId.trim(),
    title: draft.title.trim(),
    turns: validateTurns(draft.turns),
  };
}

export function createLocalSessionApi({ now = () => new Date().toISOString(), idFactory = () => `ses_local_${crypto.randomUUID()}` } = {}) {
  const sessions = new Map();

  function createSession(draft) {
    const validDraft = validateDraft(draft);
    const createdAt = now();
    if (Number.isNaN(Date.parse(createdAt))) {
      throw new Error('now() must return an ISO date.');
    }
    const session = {
      contractVersion: CONTRACT_VERSION,
      id: idFactory(),
      storage: 'local',
      createdAt: new Date(createdAt).toISOString(),
      updatedAt: new Date(createdAt).toISOString(),
      ...validDraft,
    };
    sessions.set(session.id, session);
    return structuredClone(session);
  }

  function getSession(id) {
    const session = sessions.get(id);
    if (!session) {
      throw new ContractError('SESSION_NOT_FOUND', 'The requested session does not exist.');
    }
    return structuredClone(session);
  }

  return {
    createSession,
    getSession,
    listSessions: () => [...sessions.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((session) => structuredClone(session)),
    importTranscript: (request) => {
      assertObject(request, 'transcript import');
      if (!ALLOWED_IMPORT_SOURCES.has(request.source)) {
        throw new ContractError('VALIDATION_ERROR', 'Only manually supplied local transcripts can be imported.', [{ field: 'source', reason: 'unsupported_source' }]);
      }
      return createSession({
        scenarioId: request.scenarioId ?? 'imported-transcript',
        title: request.title ?? 'Imported transcript',
        turns: request.turns,
      });
    },
    requestFeedback: (id) => {
      const session = getSession(id);
      return {
        contractVersion: CONTRACT_VERSION,
        sessionId: session.id,
        generator: 'local-rule',
        providerCallMade: false,
        summary: `Saved ${session.turns.length} local conversation turn${session.turns.length === 1 ? '' : 's'}.`,
        suggestions: [],
      };
    },
  };
}
