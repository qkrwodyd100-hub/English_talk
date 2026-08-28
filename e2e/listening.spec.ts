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
  await page.locator('.listening-setup summary').click()
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

test('now-playing card exposes only the current bilingual sentences without visible language or wake-lock copy', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '듣기 학습' }).click()
  await page.locator('.listening-setup summary').click()
  await page.getByLabel('Day 1', { exact: true }).check()
  await page.getByRole('button', { name: '재생 시작' }).click()

  const card = page.locator('.now-playing')
  await expect(card).toHaveText('실례합니다, 영어 하세요?Excuse me, do you speak English?')
  await expect(card.locator('[lang="ko"]')).toHaveText('실례합니다, 영어 하세요?')
  await expect(card.locator('[lang="en"]')).toHaveText('Excuse me, do you speak English?')
  await expect(card).not.toContainText(/한국어:|English:|화면 켜짐 유지|재생 중|재생 준비|Day \d|\d+ \/ \d+/)
})

test('learning menu presents listening immediately after flashcards in DOM, keyboard, and visual order', async ({ page }) => {
  await page.goto('/')

  const tabs = page.locator('.study-tabs button')
  await expect(tabs).toHaveText([
    '타이핑 연습',
    '플래시카드',
    '듣기 학습',
    '오답 복습 (0)',
    '학습 기록',
    '학습 노트',
    '내 문장',
  ])

  await tabs.nth(0).focus()
  await page.keyboard.press('Tab')
  await expect(tabs.nth(1)).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(tabs.nth(2)).toBeFocused()

  const positions = await tabs.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().left))
  expect(positions).toEqual([...positions].sort((left, right) => left - right))
})

test('now-playing English and Korean sentences use the same computed font weight', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '듣기 학습' }).click()
  const weights = await page.locator('.now-playing').evaluate((card) => {
    const korean = card.querySelector('.now-korean')
    const english = card.querySelector('.now-english')
    return [korean, english].map((element) => element && getComputedStyle(element).fontWeight)
  })

  expect(weights).toEqual(['800', '800'])
})

for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1440, height: 900 }]) {
  test(`listening controls stay within the viewport at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const tabs = page.locator('.study-tabs button')
    await expect(tabs).toHaveText([
      '타이핑 연습',
      '플래시카드',
      '듣기 학습',
      '오답 복습 (0)',
      '학습 기록',
      '학습 노트',
      '내 문장',
    ])
    await page.getByRole('button', { name: '듣기 학습' }).click()

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    const tabBoxes = await tabs.evaluateAll((buttons) => buttons.slice(1, 3).map((button) => button.getBoundingClientRect().toJSON()))
    expect(tabBoxes[0].x).toBeLessThan(tabBoxes[1].x)
    for (const locator of [page.locator('.now-playing'), page.locator('.listening-controls')]) {
      const box = await locator.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
    }
    for (const button of await page.locator('.listening-controls .button').all()) {
      expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    }
  })
}
