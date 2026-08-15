import { expect, test } from '@playwright/test'
import { builtInSentences } from '../src/sentences'

test('the 390px learning dashboard remains usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '더 넓은 세상으로의 시작' })).toBeVisible()
  await expect(page.getByText('60일 동안 매일 10문장씩 학습해요.')).toBeVisible()
  await expect(page.getByRole('button', { name: '타이핑 연습' })).toBeVisible()
  expect(await page.locator('.study-tabs button').allTextContents()).toEqual(['타이핑 연습', '플래시카드', '오답 복습 (0)', '학습 기록', '학습 노트', '내 문장'])
  await expect(page.getByRole('heading', { name: /1 \/ 10/ })).toBeVisible()
  await expect(page.getByLabel('학습 현황')).toContainText('600')
  await expect(page.getByLabel('학습 현황')).toContainText('0%')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/qa-artifacts/learning-mobile-390.png', fullPage: true })
})

test('learner independently reveals and listens to a card, then masters and hides it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '플래시카드' }).click()
  const firstCard = page.locator('.flashcard').first()
  await expect(firstCard.getByText('실례합니다, 영어 하세요?')).toBeVisible()
  await firstCard.getByRole('button', { name: '영어 문장 보기' }).click()
  await expect(firstCard.getByText('Excuse me, do you speak English?')).toBeVisible()
  await firstCard.getByRole('button', { name: '마스터로 표시' }).click()
  await expect(page.getByLabel('학습 현황')).toContainText('1')
  await expect(page.getByLabel('마스터 진행률')).toHaveAttribute('aria-valuenow', '0')
  await page.getByLabel('마스터 숨기기').check()
  await expect(page.getByText('실례합니다, 영어 하세요?')).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel('학습 현황')).toContainText('1')
})

test('flashcards render only the selected day and topic scope', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '플래시카드' }).click()

  await expect(page.locator('.flashcard')).toHaveCount(10)
  await expect(page.getByRole('button', { name: '영어 문장 보기' })).toHaveCount(10)

  await page.getByRole('button', { name: '타이핑 연습' }).click()
  await page.getByLabel('학습 Day 선택').selectOption('2')
  await page.getByRole('button', { name: '플래시카드' }).click()
  await expect(page.locator('.flashcard')).toHaveCount(10)
  await expect(page.getByText('한 명 자리 부탁해요.')).toBeVisible()
  await expect(page.getByText('실례합니다, 영어 하세요?')).toHaveCount(0)

  await page.getByRole('button', { name: '타이핑 연습' }).click()
  await page.getByLabel('주제 필터').selectOption('restaurant-basics')
  await page.getByRole('button', { name: '플래시카드' }).click()
  await expect(page.locator('.flashcard')).toHaveCount(8)
  await expect(page.getByText('한 명 자리 부탁해요.')).toBeVisible()
  await expect(page.getByText('사진 좀 찍어 주시겠어요?')).toHaveCount(0)
})

test('unrevealed flashcards keep the English region empty and the reveal control fits at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: '플래시카드' }).click()

  const firstCard = page.locator('.flashcard').first()
  await expect(firstCard.locator('.reveal-copy')).toBeEmpty()
  await expect(page.getByText('영어 문장을 확인해 보세요.')).toHaveCount(0)
  const revealButton = firstCard.getByRole('button', { name: '영어 문장 보기' })
  await expect(revealButton).toHaveCSS('white-space', 'nowrap')
  expect(await revealButton.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('flashcards prefer the most natural available English voice without revealing the sentence', async ({ page }) => {
  await page.addInitScript(() => {
    type Voice = { name: string; lang: string; localService: boolean }
    type Sample = { text: string; lang: string; rate: number; voiceName?: string }
    const browser = window as typeof window & { __speechSample?: Sample }
    class MockUtterance {
      text: string
      lang = ''
      rate = 1
      voice?: Voice
      constructor(text: string) { this.text = text }
    }
    const synth = {
      cancel() {},
      getVoices: () => [
        { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true },
        { name: 'Microsoft Jenny Online (Natural) - English (United States)', lang: 'en-US', localService: false },
      ],
      speak: (utterance: MockUtterance) => { browser.__speechSample = { text: utterance.text, lang: utterance.lang, rate: utterance.rate, voiceName: utterance.voice?.name } },
      onvoiceschanged: null,
    }
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: MockUtterance, configurable: true })
  })
  await page.goto('/')
  await page.getByRole('button', { name: '플래시카드' }).click()
  const firstCard = page.locator('.flashcard').first()
  await firstCard.getByRole('button', { name: '음성으로 듣기' }).click()
  await expect(firstCard.getByText('Excuse me, do you speak English?')).toHaveCount(0)
  await expect(page.getByText('영어 문장을 재생했습니다.')).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __speechSample?: { text: string; lang: string; rate: number; voiceName?: string } }).__speechSample)).toEqual({
    text: 'Excuse me, do you speak English?',
    lang: 'en-US',
    rate: 0.92,
    voiceName: 'Microsoft Jenny Online (Natural) - English (United States)',
  })
})

test('learner gets normalized typing feedback and can use text when speech is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true })
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await page.getByRole('button', { name: '타이핑 연습' }).click()
  const prompt = await page.locator('.practice-prompt strong').textContent()
  await page.getByRole('textbox', { name: '영어 답변' }).fill('wrong words')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByText('누락 또는 오타 단어를 확인해 보세요.')).toBeVisible()
  await expect(page.locator('.word-feedback .missing').first()).toBeVisible()
  await page.getByRole('button', { name: '음성으로 입력' }).click()
  await expect(page.getByText(/텍스트 입력으로 계속 학습할 수 있습니다/)).toBeVisible()
  expect(prompt).not.toBeNull()
})

test('learner gets explicit speech playback and microphone-permission fallback', async ({ page }) => {
  await page.addInitScript(() => {
    class PermissionDeniedRecognition {
      lang = ''
      interimResults = false
      continuous = false
      onresult = null
      onerror: ((event: { error: string }) => void) | null = null
      onend = null
      start() { queueMicrotask(() => this.onerror?.({ error: 'not-allowed' })) }
      stop() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: PermissionDeniedRecognition, configurable: true })
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await page.getByRole('button', { name: '타이핑 연습' }).click()
  await page.getByRole('textbox', { name: '영어 답변' }).fill('wrong words')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await page.getByRole('button', { name: '정답 듣기' }).click()
  await expect(page.getByText('정답 문장을 재생했습니다.')).toBeVisible()
  await page.getByRole('button', { name: '음성으로 입력' }).click()
  await expect(page.getByText('마이크 권한이 거부되었습니다. 텍스트 입력으로 계속 학습할 수 있습니다.')).toBeVisible()
})

test('today challenge has ten deterministic items and completion persists after a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '타이핑 연습' }).click()
  const dayOneAnswers = builtInSentences.filter((sentence) => sentence.day === 1).map((sentence) => sentence.english)

  for (let index = 0; index < 10; index += 1) {
    await expect(page.getByRole('heading', { name: new RegExp(`${index + 1} / 10`) })).toBeVisible()
    await page.getByRole('textbox', { name: '영어 답변' }).fill(dayOneAnswers[index])
    await page.getByRole('button', { name: '정답 확인' }).click()
    await expect(page.getByText('정확해요!')).toBeVisible()
    if (index < 9) await page.getByRole('button', { name: '다음 문장' }).click()
  }

  await expect(page.getByLabel('학습 현황')).toContainText('완료')
  await page.reload()
  await expect(page.getByLabel('학습 현황')).toContainText('완료')
})

test('learner creates, edits, deletes, and restores a custom sentence', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '내 문장', exact: true }).click()
  await page.getByRole('button', { name: '문장 추가' }).click()
  await page.getByLabel('영어 문장').fill('This is my custom sentence.')
  await page.getByLabel('한국어 뜻').fill('이것은 내 문장입니다.')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('This is my custom sentence.')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: '내 문장', exact: true }).click()
  await expect(page.getByText('This is my custom sentence.')).toBeVisible()
  await page.getByRole('button', { name: '수정' }).click()
  await page.getByLabel('영어 문장').fill('This is an edited custom sentence.')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('This is an edited custom sentence.')).toBeVisible()
  await page.getByRole('button', { name: '삭제' }).click()
  await expect(page.getByText('아직 내 문장이 없습니다. 자주 쓰는 문장을 추가해 보세요.')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: '내 문장', exact: true }).click()
  await expect(page.getByText('아직 내 문장이 없습니다. 자주 쓰는 문장을 추가해 보세요.')).toBeVisible()
})

test('a note persists across sentence navigation and reload without absorbing typing shortcuts', async ({ page }) => {
  await page.goto('/')
  const note = page.getByRole('textbox', { name: '내 학습 노트' })
  await note.fill('pick up means collecting baggage')
  await note.press('Enter')
  await note.press('ArrowRight')
  await expect(note).toHaveValue('pick up means collecting baggage\n')
  await page.getByRole('button', { name: '노트 저장' }).click()
  await expect(page.getByText('저장됨', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: '영어 답변' }).fill('wrong words')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await page.getByRole('button', { name: '다음 문장' }).click()
  await expect(note).toHaveValue('')
  await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}')
    payload.state.dayPositions[1] = 0
    window.localStorage.setItem('english-talk.learning', JSON.stringify(payload))
  })
  await page.reload()
  await expect(page.getByRole('textbox', { name: '내 학습 노트' })).toHaveValue('pick up means collecting baggage')
})

test('searches, edits, and opens a saved middle-sentence note without changing learning completion', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: '영어 답변' }).fill('wrong words')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await page.getByRole('button', { name: '다음 문장' }).click()
  await page.getByRole('textbox', { name: '내 학습 노트' }).fill('Use this when asking for local help.')
  await page.getByRole('button', { name: '노트 저장' }).click()

  await page.getByRole('button', { name: '학습 노트' }).click()
  await expect(page.getByRole('heading', { name: '학습 노트' })).toBeVisible()
  await page.getByLabel('노트 검색').fill('local help')
  await expect(page.getByText('Use this when asking for local help.')).toBeVisible()
  await page.getByRole('button', { name: '노트 수정' }).click()
  await page.getByLabel('학습 노트 수정').fill('Use this for local help after checking in.')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('Use this for local help after checking in.')).toBeVisible()
  await page.getByRole('button', { name: '이 문장으로 이동' }).click()
  await expect(page.getByRole('heading', { name: /2 \/ 10/ })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '내 학습 노트' })).toHaveValue('Use this for local help after checking in.')
  await page.reload()
  await page.getByRole('button', { name: '학습 노트' }).click()
  await expect(page.getByText('Use this for local help after checking in.')).toBeVisible()
})

test('keeps the learning notes tab usable on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('textbox', { name: '내 학습 노트' }).fill('A compact mobile note.')
  await page.getByRole('button', { name: '노트 저장' }).click()
  await page.getByRole('button', { name: '학습 노트' }).click()
  await expect(page.getByRole('heading', { name: '학습 노트' })).toBeVisible()
  await expect(page.getByLabel('Day 필터')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
