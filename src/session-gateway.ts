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

function isConversationTurn(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const turn = value as Record<string, unknown>
  return (turn.speaker === 'learner' || turn.speaker === 'coach')
    && typeof turn.text === 'string'
    && typeof turn.occurredAt === 'string'
}

function isContractSession(value: unknown): value is ContractSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const session = value as Record<string, unknown>
  return session.contractVersion === SESSION_CONTRACT_VERSION
    && typeof session.id === 'string'
    && (session.storage === 'local' || session.storage === 'remote')
    && typeof session.createdAt === 'string'
    && typeof session.updatedAt === 'string'
    && typeof session.scenarioId === 'string'
    && typeof session.title === 'string'
    && Array.isArray(session.turns)
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
