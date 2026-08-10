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

export function createLocalFirstSessionGateway(selectedApi?: SelectedSessionApi) {
  return {
    async submit(draft: CreateSessionRequest): Promise<SessionGatewayResult> {
      if (!selectedApi) return { mode: 'local-fallback', guidance: fallbackGuidance.unavailable }

      try {
        const session = await selectedApi.createSession(draft)
        if (session.contractVersion !== SESSION_CONTRACT_VERSION) {
          return { mode: 'local-fallback', guidance: fallbackGuidance.unavailable }
        }
        return { mode: 'selected-api' }
      } catch (error) {
        return { mode: 'local-fallback', guidance: fallbackFor(error) }
      }
    },
  }
}
