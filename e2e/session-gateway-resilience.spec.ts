import { expect, test } from '@playwright/test'

async function openPractice(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'See today’s mission' }).click()
  await page.getByRole('button', { name: 'Start practice' }).click()
}

for (const [failure, guidance] of [
  ['offline', 'Connection is unavailable. Your transcript stays on this device; continue with text practice.'],
  ['timeout', 'The session service took too long. Your transcript stays on this device; continue with text practice.'],
  ['validation', 'The session service could not accept this session. Your transcript stays on this device; continue with text practice.'],
  ['provider-unavailable', 'AI feedback is unavailable. Your transcript stays on this device; continue with text practice.'],
] as const) {
  test(`a ${failure} session API response keeps a completed two-turn transcript local`, async ({ page }) => {
    await page.addInitScript(({ selectedFailure }) => {
      const failureByKind = {
        offline: new TypeError('Failed to fetch'),
        timeout: new DOMException('Timed out', 'TimeoutError'),
        validation: { error: { code: 'VALIDATION_ERROR', message: 'turns are invalid.' } },
        'provider-unavailable': { error: { code: 'PROVIDER_UNAVAILABLE', message: 'Provider unavailable.' } },
      }
      ;(window as Window & { __englishTalkSessionApi?: { createSession: () => Promise<never> } }).__englishTalkSessionApi = {
        createSession: () => Promise.reject(failureByKind[selectedFailure]),
      }
    }, { selectedFailure: failure })

    await openPractice(page)
    const reply = page.getByRole('textbox', { name: 'Your English reply' })
    await reply.fill('Could I have tea, please?')
    await page.getByRole('button', { name: 'Send reply' }).click()
    await reply.fill('That is all, thank you.')
    await page.getByRole('button', { name: 'Send reply' }).click()
    await page.getByRole('button', { name: 'Finish session' }).click()

    await expect(page.getByRole('heading', { name: 'You finished 2 turns.' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText(guidance)
    await page.getByRole('button', { name: 'View history' }).click()
    await expect(page.getByText('Order at a café')).toBeVisible()
    await expect(page.getByText(/2 turns/)).toBeVisible()
  })
}

test('a malformed v1 session response keeps existing local history and the completed transcript', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('english-talk.sessions', JSON.stringify({
      version: 1,
      sessions: [{
        id: 'saved-session',
        goal: 'travel',
        difficulty: 'beginner',
        scenario: 'cafe',
        startedAt: '2026-08-10T08:00:00.000Z',
        endedAt: '2026-08-10T08:02:00.000Z',
        messages: [],
        summary: { turnCount: 0, expressions: [], nextAction: 'Keep practicing.' },
      }],
    }))
    ;(window as Window & { __englishTalkSessionApi?: { createSession: () => Promise<unknown> } }).__englishTalkSessionApi = {
      createSession: async () => ({ contractVersion: 'v1', id: 'malformed-session' }),
    }
  })

  await openPractice(page)
  const reply = page.getByRole('textbox', { name: 'Your English reply' })
  await reply.fill('Could I have tea, please?')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await reply.fill('That is all, thank you.')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await page.getByRole('button', { name: 'Finish session' }).click()

  await expect(page.getByRole('status')).toContainText('The session service is unavailable.')
  await page.getByRole('button', { name: 'View history' }).click()
  await expect(page.locator('.history-list > li')).toHaveCount(2)
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.sessions')!).sessions.map((session: { id: string }) => session.id))).toContain('saved-session')
})
