import { describe, expect, it } from 'vitest'
import { createLocalFirstSessionGateway, type SelectedSessionApi } from './session-gateway'

const draft = {
  scenarioId: 'cafe',
  title: 'Order at a café',
  turns: [{ speaker: 'learner' as const, text: 'I would like tea.', occurredAt: '2026-08-10T08:00:00.000Z' }],
}

function rejectedApi(reason: unknown): SelectedSessionApi {
  return { createSession: () => Promise.reject(reason) }
}

describe('local-first session gateway', () => {
  it.each([
    ['offline', new TypeError('Failed to fetch'), 'Connection is unavailable. Your transcript stays on this device; continue with text practice.'],
    ['timeout', new DOMException('Timed out', 'TimeoutError'), 'The session service took too long. Your transcript stays on this device; continue with text practice.'],
    ['validation', { error: { code: 'VALIDATION_ERROR', message: 'turns are invalid.' } }, 'The session service could not accept this session. Your transcript stays on this device; continue with text practice.'],
    ['provider unavailable', { error: { code: 'PROVIDER_UNAVAILABLE', message: 'Provider unavailable.' } }, 'AI feedback is unavailable. Your transcript stays on this device; continue with text practice.'],
  ])('keeps the transcript local when the selected API is %s', async (_failure, reason, guidance) => {
    const gateway = createLocalFirstSessionGateway(rejectedApi(reason))

    await expect(gateway.submit(draft)).resolves.toEqual({ mode: 'local-fallback', guidance })
  })

  it('accepts a v1 response from an injected selected API', async () => {
    const gateway = createLocalFirstSessionGateway({
      createSession: async () => ({
        ...draft,
        contractVersion: 'v1',
        id: 'session-1',
        storage: 'local',
        createdAt: '2026-08-10T08:00:00.000Z',
        updatedAt: '2026-08-10T08:00:00.000Z',
      }),
    })

    await expect(gateway.submit(draft)).resolves.toEqual({ mode: 'selected-api' })
  })

  it('falls back locally when a v1 response omits required session fields', async () => {
    const gateway = createLocalFirstSessionGateway({
      createSession: async () => ({
        ...draft,
        contractVersion: 'v1',
        id: 'session-1',
        storage: 'local',
        createdAt: '2026-08-10T08:00:00.000Z',
        updatedAt: '2026-08-10T08:00:00.000Z',
        turns: undefined,
      } as unknown as import('./contracts/session-contract').Session),
    })

    await expect(gateway.submit(draft)).resolves.toEqual({
      mode: 'local-fallback',
      guidance: 'The session service is unavailable. Your transcript stays on this device; continue with text practice.',
    })
  })

  it('falls back locally when a v1 response has a malformed turn', async () => {
    const gateway = createLocalFirstSessionGateway({
      createSession: async () => ({
        ...draft,
        contractVersion: 'v1',
        id: 'session-1',
        storage: 'local',
        createdAt: '2026-08-10T08:00:00.000Z',
        updatedAt: '2026-08-10T08:00:00.000Z',
        turns: [{ speaker: 'learner', text: 42, occurredAt: '2026-08-10T08:00:00.000Z' }],
      } as unknown as import('./contracts/session-contract').Session),
    })

    await expect(gateway.submit(draft)).resolves.toMatchObject({ mode: 'local-fallback' })
  })

  it('falls back locally when a v1 response has shallowly valid but contract-invalid values', async () => {
    const gateway = createLocalFirstSessionGateway({
      createSession: async () => ({
        contractVersion: 'v1',
        id: '',
        storage: 'local',
        scenarioId: '',
        title: '',
        createdAt: 'not-a-date',
        updatedAt: 'not-a-date',
        turns: [],
      } as unknown as import('./contracts/session-contract').Session),
    })

    await expect(gateway.submit(draft)).resolves.toMatchObject({ mode: 'local-fallback' })
  })

  it('falls back locally when a v1 response contains an impossible ISO calendar date', async () => {
    const gateway = createLocalFirstSessionGateway({
      createSession: async () => ({
        ...draft,
        contractVersion: 'v1',
        id: 'session-1',
        storage: 'local',
        createdAt: '2026-02-30T08:00:00.000Z',
        updatedAt: '2026-08-10T08:00:00.000Z',
      }),
    })

    await expect(gateway.submit(draft)).resolves.toMatchObject({ mode: 'local-fallback' })
  })
})
