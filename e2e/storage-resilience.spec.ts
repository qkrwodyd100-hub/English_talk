import { expect, test } from '@playwright/test'

const storageKey = 'english-talk.sessions'

async function openPractice(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'See today’s mission' }).click()
  await page.getByRole('button', { name: 'Start practice' }).click()
}

test('invalid versioned local history is safely ignored and leaves the history screen usable', async ({ page }) => {
  await page.addInitScript(({ key }) => {
    window.localStorage.setItem(key, JSON.stringify({
      version: 1,
      sessions: [{ id: 'broken-record', scenario: 'removed-scenario' }],
    }))
  }, { key: storageKey })

  await page.goto('/')
  await page.getByRole('button', { name: 'History' }).click()

  await expect(page.getByRole('heading', { name: 'Your sessions' })).toBeVisible()
  await expect(page.getByText('No saved sessions yet. Complete a two-turn practice to see it here.')).toBeVisible()
})

test('an unavailable localStorage write reports that text practice completed without history', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError') }
  })

  await openPractice(page)
  const reply = page.getByRole('textbox', { name: 'Your English reply' })
  await reply.fill('Could I have tea, please?')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await reply.fill('That is all, thank you.')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await page.getByRole('button', { name: 'Finish session' }).click()

  await expect(page.getByRole('heading', { name: 'You finished 2 turns.' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('History could not be saved.')
})

test('a completed local session is restored after a browser reload', async ({ page }) => {
  await openPractice(page)
  const reply = page.getByRole('textbox', { name: 'Your English reply' })
  await reply.fill('I would like tea, please.')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await reply.fill('That is all, thank you.')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await page.getByRole('button', { name: 'Finish session' }).click()

  await page.reload()
  await page.getByRole('button', { name: 'History' }).click()
  await expect(page.getByRole('heading', { name: 'Your sessions' })).toBeVisible()
  await expect(page.getByText('Order at a café')).toBeVisible()
  await expect(page.getByText('2 turns')).toBeVisible()
})

test('missing speech recognition leaves the two-turn text flow usable', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition
    delete (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  })

  await openPractice(page)
  await expect(page.getByText('Voice dictation is unavailable in this browser; text input is ready.')).toBeVisible()
  await page.getByRole('button', { name: 'Use voice dictation' }).click()
  await expect(page.getByRole('status')).toContainText('Voice dictation is not available here. Use the text box instead.')

  const reply = page.getByRole('textbox', { name: 'Your English reply' })
  await reply.fill('I would like coffee, please.')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await reply.fill('Thank you.')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await page.getByRole('button', { name: 'Finish session' }).click()
  await expect(page.getByRole('heading', { name: 'You finished 2 turns.' })).toBeVisible()
})

test('microphone permission denial keeps text entry available', async ({ page }) => {
  await page.addInitScript(() => {
    class DeniedSpeechRecognition {
      lang = ''
      interimResults = false
      continuous = false
      onresult: null = null
      onerror: ((event: { error: string }) => void) | null = null
      onend: null = null
      start() { this.onerror?.({ error: 'not-allowed' }) }
      stop() {}
    }
    ;(window as Window & { SpeechRecognition?: unknown }).SpeechRecognition = DeniedSpeechRecognition
  })

  await openPractice(page)
  await page.getByRole('button', { name: 'Use voice dictation' }).click()
  await expect(page.getByRole('status')).toContainText('Microphone permission was denied. Use the text box instead.')
  await expect(page.getByRole('button', { name: 'Use voice dictation' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('textbox', { name: 'Your English reply' })).toBeEditable()
})

test('asynchronous microphone permission denial keeps text entry available', async ({ page }) => {
  await page.addInitScript(() => {
    class DeniedSpeechRecognition {
      lang = ''
      interimResults = false
      continuous = false
      onresult: null = null
      onerror: ((event: { error: string }) => void) | null = null
      onend: null = null
      start() { window.setTimeout(() => this.onerror?.({ error: 'not-allowed' }), 0) }
      stop() {}
    }
    ;(window as Window & { SpeechRecognition?: unknown }).SpeechRecognition = DeniedSpeechRecognition
  })

  await openPractice(page)
  await page.getByRole('button', { name: 'Use voice dictation' }).click()
  await expect(page.getByRole('status')).toContainText('Microphone permission was denied. Use the text box instead.')
  await expect(page.getByRole('button', { name: 'Use voice dictation' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('textbox', { name: 'Your English reply' })).toBeEditable()
})

test('blank replies do not advance the conversation', async ({ page }) => {
  await openPractice(page)
  await page.getByRole('button', { name: 'Send reply' }).click()
  await expect(page.getByRole('status')).toContainText('Write a short English reply before sending.')
  await expect(page.getByText('0 / 2 turns')).toBeVisible()
})

test('a rapid duplicate send does not count the same draft as two learner turns', async ({ page }) => {
  await openPractice(page)
  await page.getByRole('textbox', { name: 'Your English reply' }).fill('Can I have a tea, please?')
  await page.getByRole('button', { name: 'Send reply' }).dblclick()
  await expect(page.getByText('1 / 2 turns')).toBeVisible()
})

test('missing text-to-speech reports a fallback instead of breaking the practice view', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as Window & { speechSynthesis?: unknown }).speechSynthesis
  })

  await openPractice(page)
  await page.getByRole('button', { name: 'Read aloud' }).click()
  await expect(page.getByRole('status')).toContainText('Read-aloud is not available in this browser.')
  await expect(page.getByRole('textbox', { name: 'Your English reply' })).toBeEditable()
})
