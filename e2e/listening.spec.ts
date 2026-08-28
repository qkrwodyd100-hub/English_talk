import { expect, test } from '@playwright/test'

test('listening study plays selected non-contiguous Days as Korean then English and persists selection without learning activity', async ({ page }) => {
  await page.addInitScript(() => {
    class MockUtterance { text = ''; lang = ''; rate = 1; voice = null; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(text: string) { this.text = text } }
    const spoken: MockUtterance[] = []
    const synth = { speak: (utterance: MockUtterance) => spoken.push(utterance), cancel: () => undefined, pause: () => undefined, resume: () => undefined, getVoices: () => [], addEventListener: () => undefined, removeEventListener: () => undefined }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance })
    ;(window as typeof window & { __spoken?: MockUtterance[] }).__spoken = spoken
  })
  await page.goto('/')
  await page.getByRole('button', { name: '듣기 학습' }).click()
  await page.getByLabel('Day 1', { exact: true }).check()
  await page.getByLabel('Day 3', { exact: true }).check()
  await expect(page.getByText(/기본 문장 20개/)).toBeVisible()
  await page.getByRole('button', { name: '재생 시작' }).click()
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __spoken: Array<{ text: string; lang: string }> }).__spoken.map(({ text, lang }) => ({ text, lang })))).toEqual([{ text: '실례합니다, 영어 하세요?', lang: 'ko-KR' }])
  await page.evaluate(() => (window as typeof window & { __spoken: Array<{ onend: (() => void) | null }> }).__spoken[0].onend?.())
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __spoken: Array<{ text: string; lang: string }> }).__spoken.map(({ text, lang }) => ({ text, lang })))).toEqual([{ text: '실례합니다, 영어 하세요?', lang: 'ko-KR' }, { text: 'Excuse me, do you speak English?', lang: 'en-US' }])
  await expect(page.getByText('영어 재생 중')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: '듣기 학습' }).click()
  await expect(page.getByLabel('Day 1', { exact: true })).toBeChecked()
  await expect(page.getByLabel('Day 3', { exact: true })).toBeChecked()
  await expect.poll(() => page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}')
    return payload.state.studyActivities.length
  })).toBe(0)
})
