import { expect, test } from '@playwright/test'
import { builtInSentences } from '../src/sentences'

const storageKey = 'english-talk.learning'

function storedState(overrides: Record<string, unknown> = {}) {
  return {
    version: 4,
    state: {
      masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 1,
      dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [],
      favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {}, ...overrides,
    },
  }
}

test('flashcards use their own shared Day selector without inheriting the typing topic filter', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('주제 필터').selectOption('restaurant-basics')
  await page.getByRole('button', { name: '플래시카드' }).click()

  const selector = page.getByLabel('플래시카드 학습 Day 선택')
  await expect(selector).toHaveAttribute('id', 'cards-day-select')
  await expect(selector.locator('option')).toHaveCount(60)
  await selector.selectOption('2')

  await expect(page.locator('.flashcard')).toHaveCount(10)
  for (const sentence of builtInSentences.filter(({ day }) => day === 2)) {
    await expect(page.getByText(sentence.korean, { exact: true })).toBeVisible()
  }
  await expect(page.getByText(builtInSentences.find(({ day }) => day === 1)!.korean, { exact: true })).toHaveCount(0)
})

test('flashcard Day changes reset revealed cards and audio, and hide-mastered has the exact empty state', async ({ page }) => {
  await page.addInitScript((payload) => {
    localStorage.setItem('english-talk.learning', JSON.stringify(payload))
    const browser = window as typeof window & { __speechCancelCount?: number }
    browser.__speechCancelCount = 0
    class MockUtterance { text: string; lang = ''; rate = 1; voice = null; constructor(text: string) { this.text = text } }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: MockUtterance, configurable: true })
    Object.defineProperty(window, 'speechSynthesis', { value: {
      cancel: () => { browser.__speechCancelCount = (browser.__speechCancelCount ?? 0) + 1 },
      speak: () => {}, getVoices: () => [], addEventListener: () => {}, removeEventListener: () => {},
    }, configurable: true })
  }, storedState({ masteredIds: builtInSentences.filter(({ day }) => day === 2).map(({ id }) => id) }))
  await page.goto('/')
  await page.getByRole('button', { name: '플래시카드' }).click()

  const firstCard = page.locator('.flashcard').first()
  await firstCard.getByRole('button', { name: '영어 문장 보기' }).click()
  await firstCard.getByRole('button', { name: '음성으로 듣기' }).click()
  const cancelsBeforeChange = await page.evaluate(() => (window as typeof window & { __speechCancelCount?: number }).__speechCancelCount)
  await page.getByLabel('플래시카드 학습 Day 선택').selectOption('2')

  await expect(page.locator('.reveal-copy').first()).toBeEmpty()
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __speechCancelCount?: number }).__speechCancelCount)).toBeGreaterThan(cancelsBeforeChange ?? 0)
  await page.getByLabel('마스터 숨기기').check()
  await expect(page.locator('.flashcard')).toHaveCount(0)
  await expect(page.getByText('Day 2에서 표시할 플래시카드가 없습니다')).toBeVisible()
})

test('review scopes the queue and favorites to the selected Day without deleting other Days', async ({ page }) => {
  await page.addInitScript((payload) => localStorage.setItem('english-talk.learning', JSON.stringify(payload)), storedState({
    selectedDay: 2,
    reviewQueueIds: ['day-01-01', 'day-02-01'],
    favoriteIds: ['day-01-02', 'day-02-02'],
  }))
  await page.goto('/')
  await page.getByRole('button', { name: /오답 복습/ }).click()

  const selector = page.getByLabel('오답 복습 학습 Day 선택')
  await expect(selector).toHaveAttribute('id', 'review-day-select')
  await expect(page.locator('.review-list > li')).toHaveCount(2)
  await expect(page.getByText(builtInSentences.find(({ id }) => id === 'day-02-01')!.english, { exact: true })).toBeVisible()
  await expect(page.getByText(builtInSentences.find(({ id }) => id === 'day-01-01')!.english, { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: '복습 완료' }).first().click()
  await page.getByRole('button', { name: '즐겨찾기 해제' }).click()
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state, storageKey)
  expect(stored.reviewQueueIds).toEqual(['day-01-01'])
  expect(stored.favoriteIds).toEqual(['day-01-02'])

  await selector.selectOption('3')
  await expect(page.getByText('Day 3에는 복습할 문장이 없습니다')).toBeVisible()
})

test('manual Day selection stays synchronized across tabs and reload without creating learning records', async ({ page }) => {
  const completedDayOne = builtInSentences.filter(({ day }) => day === 1).map(({ id }) => id)
  await page.addInitScript((payload) => {
    if (sessionStorage.getItem('shared-day-seeded')) return
    localStorage.setItem('english-talk.learning', JSON.stringify(payload))
    sessionStorage.setItem('shared-day-seeded', 'true')
  }, storedState({ completedSentenceIds: completedDayOne }))
  await page.goto('/')

  const recordSnapshot = () => page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) ?? '{}').state
    return { completedSentenceIds: state.completedSentenceIds, attemptCounts: state.attemptCounts, reviewQueueIds: state.reviewQueueIds, studyActivities: state.studyActivities, answerHistory: state.answerHistory }
  }, storageKey)
  const before = await recordSnapshot()

  await page.getByLabel('학습 Day 선택').selectOption('5')
  await page.getByRole('button', { name: '플래시카드' }).click()
  await expect(page.getByLabel('플래시카드 학습 Day 선택')).toHaveValue('5')
  await page.getByLabel('플래시카드 학습 Day 선택').selectOption('8')
  await page.getByRole('button', { name: /오답 복습/ }).click()
  await expect(page.getByLabel('오답 복습 학습 Day 선택')).toHaveValue('8')
  await page.reload()
  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('8')
  expect(await recordSnapshot()).toEqual(before)
})

for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
  test(`Day selectors remain touchable without overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    for (const [tab, label] of [['플래시카드', '플래시카드 학습 Day 선택'], ['오답 복습 (0)', '오답 복습 학습 Day 선택']] as const) {
      await page.getByRole('button', { name: tab }).click()
      const selector = page.getByLabel(label)
      expect((await selector.boundingBox())?.height).toBeGreaterThanOrEqual(44)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })
}