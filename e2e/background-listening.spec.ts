import { expect, test, type Page } from '@playwright/test'

async function installSpeechMocks(page: Page) {
  await page.addInitScript(() => {
    class MockUtterance { text = ''; lang = ''; rate = 1; voice: null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(text: string) { this.text = text } }
    const spoken: MockUtterance[] = []
    const synth = { speak: (utterance: MockUtterance) => spoken.push(utterance), cancel: () => undefined, pause: () => undefined, resume: () => undefined, getVoices: () => [], addEventListener: () => undefined, removeEventListener: () => undefined }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance })
    ;(window as typeof window & { __spoken?: MockUtterance[] }).__spoken = spoken
  })
}

test('listening keeps playing across tabs with a mini player for pause, resume and stop', async ({ page }) => {
  await installSpeechMocks(page)
  await page.goto('/')
  await page.getByRole('button', { name: '듣기 학습' }).click()
  await page.locator('.listening-setup summary').click()
  await page.getByLabel('Day 1', { exact: true }).check()
  await page.getByRole('button', { name: '재생 시작' }).click()
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __spoken: Array<{ text: string; lang: string }> }).__spoken.map(({ text, lang }) => ({ text, lang })))).toEqual([{ text: '실례합니다, 영어 하세요?', lang: 'ko-KR' }])

  await page.getByRole('button', { name: '타이핑 연습' }).click()
  const mini = page.locator('.listening-mini')
  await expect(mini).toContainText('듣기 재생 중')
  await expect(mini).toContainText('Day 1 · 1 / 10')

  await page.evaluate(() => (window as typeof window & { __spoken: Array<{ onend: (() => void) | null }> }).__spoken[0].onend?.())
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __spoken: Array<{ text: string; lang: string }> }).__spoken.map(({ text, lang }) => ({ text, lang })))).toEqual([
    { text: '실례합니다, 영어 하세요?', lang: 'ko-KR' },
    { text: 'Excuse me, do you speak English?', lang: 'en-US' },
  ])
  await expect(mini).toContainText('듣기 재생 중')

  await mini.getByRole('button', { name: '일시정지' }).click()
  await expect(mini).toContainText('듣기 일시정지됨')

  await mini.getByRole('button', { name: '이어듣기' }).click()
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __spoken: Array<{ text: string }> }).__spoken.length)).toBe(3)

  await mini.getByRole('button', { name: '중지' }).click()
  await expect(mini).toHaveCount(0)
})
