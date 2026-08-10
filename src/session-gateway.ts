import { SESSION_CONTRACT_VERSION, type CreateSessionRequest, type Session as ContractSession } from './contracts/session-contract'

export interface SelectedSessionApi {
  createSession: (draft: CreateSessionRequest) => Promise<ContractSession> | ContractSession
}

export type SessionGatewayResult =
  | { mode: 'selected-api' }
  | { mode: 'local-fallback'; guidance: string }

const fallbackGuidance = {
  offline: 'Connection is unavailable. Your transcript stays on this device; continue with text practice.',
  timeout: 'The session service took too long. Your transcript stays on this device; continue with text practice.',
  validation: 'The session service could not accept this session. Your transcript stays on this device; continue with text practice.',
  provider: 'AI feedback is unavailable. Your transcript stays on this device; continue with text practice.',
  unavailable: 'The session service is unavailable. Your transcript stays on this device; continue with text practice.',
}

const MAX_SESSION_ID_LENGTH = 128
const MAX_SCENARIO_ID_LENGTH = 80
const MAX_TITLE_LENGTH = 120
const MAX_TURN_TEXT_LENGTH = 2_000
const MAX_TURNS = 100
const isoUtcDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/

declare global {
  interface Window {
    __englishTalkSessionApi?: SelectedSessionApi
  }
}

function createDefaultLocalSessionApi(): SelectedSessionApi {
  return {
    createSession(draft) {
      const now = new Date().toISOString()
      return {
        ...draft,
        contractVersion: SESSION_CONTRACT_VERSION,
        id: `ses_local_${crypto.randomUUID()}`,
        storage: 'local',
        createdAt: now,
        updatedAt: now,
      }
    },
  }
}

export function getBrowserSelectedSessionApi(): SelectedSessionApi {
  return window.__englishTalkSessionApi ?? createDefaultLocalSessionApi()
}

function fallbackFor(error: unknown): string {
  if (error instanceof TypeError) return fallbackGuidance.offline
  if (error instanceof DOMException && error.name === 'TimeoutError') return fallbackGuidance.timeout
  if (error && typeof error === 'object' && 'error' in error) {
    const code = (error as { error?: { code?: unknown } }).error?.code
    if (code === 'VALIDATION_ERROR') return fallbackGuidance.validation
    if (code === 'PROVIDER_UNAVAILABLE') return fallbackGuidance.provider
  }
  return fallbackGuidance.unavailable
}

function isBoundedNonEmptyString(value: unknown, maximumLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximumLength
}

function isIsoUtcDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = isoUtcDateTimePattern.exec(value)
  if (!match) return false

  const timestamp = new Date(value)
  return !Number.isNaN(timestamp.getTime())
    && timestamp.getUTCFullYear() === Number(match[1])
    && timestamp.getUTCMonth() + 1 === Number(match[2])
    && timestamp.getUTCDate() === Number(match[3])
    && timestamp.getUTCHours() === Number(match[4])
    && timestamp.getUTCMinutes() === Number(match[5])
    && timestamp.getUTCSeconds() === Number(match[6])
}

function isConversationTurn(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const turn = value as Record<string, unknown>
  return (turn.speaker === 'learner' || turn.speaker === 'coach')
    && isBoundedNonEmptyString(turn.text, MAX_TURN_TEXT_LENGTH)
    && isIsoUtcDateTime(turn.occurredAt)
}

function isContractSession(value: unknown): value is ContractSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const session = value as Record<string, unknown>
  return session.contractVersion === SESSION_CONTRACT_VERSION
    && isBoundedNonEmptyString(session.id, MAX_SESSION_ID_LENGTH)
    && (session.storage === 'local' || session.storage === 'remote')
    && isIsoUtcDateTime(session.createdAt)
    && isIsoUtcDateTime(session.updatedAt)
    && isBoundedNonEmptyString(session.scenarioId, MAX_SCENARIO_ID_LENGTH)
    && isBoundedNonEmptyString(session.title, MAX_TITLE_LENGTH)
    && Array.isArray(session.turns)
    && session.turns.length >= 1
    && session.turns.length <= MAX_TURNS
    && session.turns.every(isConversationTurn)
}

export function createLocalFirstSessionGateway(selectedApi?: SelectedSessionApi) {
  return {
    async submit(draft: CreateSessionRequest): Promise<SessionGatewayResult> {
      if (!selectedApi) return { mode: 'local-fallback', guidance: fallbackGuidance.unavailable }

      try {
        const session = await selectedApi.createSession(draft)
        if (!isContractSession(session)) {
          return { mode: 'local-fallback', guidance: fallbackGuidance.unavailable }
        }
        return { mode: 'selected-api' }
      } catch (error) {
        return { mode: 'local-fallback', guidance: fallbackFor(error) }
      }
    },
  }
}
