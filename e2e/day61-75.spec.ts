import { expect, test, type Page } from '@playwright/test'

const DAY_61_FIRST = {
  english: 'My connecting flight leaves from a different terminal.',
  korean: '연결편이 다른 터미널에서 출발해요.',
}
const DAY_61_SECOND_KOREAN = '환승하는 데 시간이 얼마나 걸리나요.'
const DAY_61_LAST = {
  english: 'Please endorse my ticket so I can fly with another airline.',
  korean: '다른 항공사 비행기로 갈 수 있게 표를 넘겨 주세요.',
}
const DAY_62_FIRST_KOREAN = '제 여행 가방이 도착하지 않았어요.'
const DAY_75_FIRST_KOREAN = '오늘은 다 꼬였지만 예의를 지켰어요.'

async function installRecognitionMock(page: Page) {
  await page.addInitScript(() => {
    class MockRecognition {
      static instance: MockRecognition | null = null
      lang = ''
      interimResults = false
      continuous = false
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      onend: (() => void) | null = null
      constructor() { MockRecognition.instance = this }
      start() {}
      stop() { this.onend?.() }
      abort() { this.onend?.() }
    }
    ;(window as Window & { SpeechRecognition?: unknown; __recognition?: typeof MockRecognition }).SpeechRecognition = MockRecognition
    ;(window as Window & { __recognition?: typeof MockRecognition }).__recognition = MockRecognition
  })
}

async function installSpeechMocks(page: Page) {
  await page.addInitScript(() => {
    class MockUtterance {
      text = ''
      lang = ''
      rate = 1
      voice: null = null
      constructor(text: string) { this.text = text }
    }
    const spoken: MockUtterance[] = []
    const synth = {
      speak: (utterance: MockUtterance) => { spoken.push(utterance) },
      cancel: () => undefined,
      getVoices: () => [],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance })
    ;(window as typeof window & { __spoken?: MockUtterance[] }).__spoken = spoken
    class MockRecognition {
      static instance: MockRecognition | null = null
      lang = ''
      interimResults = false
      continuous = false
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      onend: (() => void) | null = null
      constructor() { MockRecognition.instance = this }
      start() {}
      stop() { this.onend?.() }
      abort() { this.onend?.() }
    }
    ;(window as Window & { SpeechRecognition?: unknown; __recognition?: typeof MockRecognition }).SpeechRecognition = MockRecognition
    ;(window as Window & { __recognition?: typeof MockRecognition }).__recognition = MockRecognition
  })
}

async function fireTranscript(page: Page, transcript: string) {
  await page.evaluate((text) => {
    const instance = (window as typeof window & { __recognition: { instance: { onresult: ((event: unknown) => void) | null } } }).__recognition.instance
    instance.onresult?.({ results: [[{ transcript: text, isFinal: true }]] })
  }, transcript)
}

test('Day 61-75 days are selectable with content and a matching mini dialogue', async ({ page }) => {
  await page.goto('/')
  const daySelect = page.locator('#practice-day-select')
  expect(await daySelect.locator('option').count()).toBe(75)

  await daySelect.selectOption('61')
  await expect(page.getByRole('heading', { name: /1 \/ 10/ })).toBeVisible()
  await expect(page.getByText(DAY_61_FIRST.korean)).toBeVisible()
  await expect(page.getByRole('button', { name: '미니 대화 연습' })).toBeVisible()
  await page.getByRole('button', { name: '미니 대화 연습' }).click()
  await expect(page.getByRole('heading', { name: 'Day 61 미니 대화' })).toBeVisible()
  await page.getByRole('button', { name: '대화 마치기' }).click()

  await daySelect.selectOption('75')
  await expect(page.getByRole('heading', { name: /1 \/ 10/ })).toBeVisible()
  await expect(page.getByText(DAY_75_FIRST_KOREAN)).toBeVisible()
  await expect(page.getByRole('button', { name: '미니 대화 연습' })).toBeVisible()
})

test('speak-first mode auto-starts voice input and persists', async ({ page }) => {
  await installRecognitionMock(page)
  await page.goto('/')

  const voiceFirst = page.getByLabel('말하기 우선')
  await expect(voiceFirst).toBeVisible()
  await voiceFirst.check()
  await expect(page.getByRole('textbox', { name: '영어 답변' })).toHaveAttribute('placeholder', '먼저 말하기로 답하세요…')
  await expect(page.getByRole('button', { name: '음성 입력 중지' })).toBeVisible()
  await expect(page.getByText(/듣는 중입니다/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('english-talk.voice-first'))).toBe('1')

  await page.reload()
  await expect(page.getByLabel('말하기 우선')).toBeChecked()
  await expect(page.getByRole('textbox', { name: '영어 답변' })).toHaveAttribute('placeholder', '먼저 말하기로 답하세요…')
})

test('shadowing plays TTS and grades a correct spoken transcript as correct', async ({ page }) => {
  await installSpeechMocks(page)
  await page.goto('/')
  await page.locator('#practice-day-select').selectOption('61')

  await page.getByRole('button', { name: '쉐도잉: 듣고 따라말하기' }).click()
  await expect
    .poll(() => page.evaluate(() => (window as typeof window & { __spoken: Array<{ text: string }> }).__spoken.map((utterance) => utterance.text)))
    .toEqual([DAY_61_FIRST.english])
  await expect(page.getByText(/듣는 중입니다/)).toBeVisible()

  await fireTranscript(page, DAY_61_FIRST.english)
  await expect(page.getByText('정답 · 정확해요!')).toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.completedSentenceIds)).toContain('day-61-01')
})

test('shadowing grades a wrong spoken transcript and enqueues the review queue', async ({ page }) => {
  await installSpeechMocks(page)
  await page.goto('/')
  await page.locator('#practice-day-select').selectOption('61')

  await page.getByRole('button', { name: '쉐도잉: 듣고 따라말하기' }).click()
  await fireTranscript(page, 'Something completely different')
  await expect(page.getByText('수정 필요')).toBeVisible()
  await expect(page.getByRole('button', { name: '오답 복습 (1)' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.reviewQueueIds)).toEqual(['day-61-01'])

  await page.getByRole('button', { name: '오답 복습 (1)' }).click()
  await expect(page.getByText(DAY_61_FIRST.korean)).toBeVisible()
  await expect(page.getByText(DAY_61_FIRST.english)).toBeVisible()
})

test('wrong typed answers land in the review queue in persisted order', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('english-talk.learning', JSON.stringify({
      version: 4,
      state: {
        selectedDay: 61,
        selectedDayIsManual: true,
        dayPositions: {},
        completedSentenceIds: [],
        attemptCounts: {},
        reviewQueueIds: ['day-61-02', 'day-61-01'],
        favoriteIds: [],
        masteredIds: [],
        customSentences: [],
        completedChallengeDates: [],
        studyActivities: [],
        sentenceNotes: {},
        answerHistory: {},
      },
    }))
  })
  await page.goto('/')

  await page.getByRole('button', { name: '오답 복습 (2)' }).click()
  const items = page.locator('.review-list li')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText(DAY_61_SECOND_KOREAN)
  await expect(items.nth(1)).toContainText(DAY_61_FIRST.korean)

  await page.getByRole('button', { name: '큐 순서대로 복습 시작' }).click()
  await expect(page.getByRole('heading', { name: /2 \/ 10/ })).toBeVisible()
  await expect(page.getByText(DAY_61_SECOND_KOREAN)).toBeVisible()
})

test('daily volume 12 and 15 build extended sets and persist', async ({ page }) => {
  await page.goto('/')
  await page.locator('#practice-day-select').selectOption('61')

  const volume = page.locator('select[aria-label="오늘 분량"]')
  await expect(volume).toBeVisible()
  await volume.selectOption('12')
  const dailySet = page.locator('.daily-set')
  await expect(dailySet).toContainText('오늘 분량 12문장')
  await expect(dailySet.locator('li')).toHaveCount(12)
  await expect(dailySet.locator('li').first()).toContainText(DAY_61_FIRST.korean)
  await expect(dailySet.locator('li').nth(10)).toContainText('Day 62')
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('english-talk.daily-count'))).toBe('12')

  await volume.selectOption('15')
  await expect(dailySet).toContainText('오늘 분량 15문장')
  await expect(dailySet.locator('li')).toHaveCount(15)

  await page.reload()
  await expect(page.locator('select[aria-label="오늘 분량"]')).toHaveValue('15')
  await expect(page.locator('.daily-set li')).toHaveCount(15)
})

test('ArrowRight on the last Day 61 sentence carries progress over to Day 62', async ({ page }) => {
  await page.goto('/')
  await page.locator('#practice-day-select').selectOption('61')

  const next = page.getByRole('button', { name: '다음', exact: true })
  for (let position = 1; position < 10; position += 1) await next.click()
  await expect(page.getByRole('heading', { name: /10 \/ 10/ })).toBeVisible()
  await expect(page.getByText(DAY_61_LAST.korean)).toBeVisible()

  await page.getByRole('textbox', { name: '영어 답변' }).fill(DAY_61_LAST.english)
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByText('정답 · 정확해요!')).toBeVisible()

  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await answer.focus()
  await page.keyboard.press('ArrowRight')

  await expect(page.locator('#practice-day-select')).toHaveValue('62')
  await expect(page.getByRole('heading', { name: /1 \/ 10/ })).toBeVisible()
  await expect(page.getByText(DAY_62_FIRST_KOREAN)).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.dayPositions))
    .toMatchObject({ 61: 10, 62: 0 })

  await page.reload()
  await expect(page.locator('#practice-day-select')).toHaveValue('62')
  await expect(page.getByRole('heading', { name: /1 \/ 10/ })).toBeVisible()
})
