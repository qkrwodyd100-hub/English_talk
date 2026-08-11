import { expect, test } from '@playwright/test'

test('the 390px learning dashboard remains usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '더 넓은 세상으로의 시작' })).toBeVisible()
  await expect(page.getByText('60일 동안 매일 10문장씩 학습해요.')).toBeVisible()
  await expect(page.getByRole('button', { name: '타이핑 연습' })).toBeVisible()
  expect(await page.locator('.study-tabs button').allTextContents()).toEqual(['타이핑 연습', '플래시카드', '내 문장'])
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
  await page.getByRole('button', { name: '정답 확인' }).click()
  await page.getByRole('button', { name: '정답 듣기' }).click()
  await expect(page.getByText('정답 문장을 재생했습니다.')).toBeVisible()
  await page.getByRole('button', { name: '음성으로 입력' }).click()
  await expect(page.getByText('마이크 권한이 거부되었습니다. 텍스트 입력으로 계속 학습할 수 있습니다.')).toBeVisible()
})

test('today challenge has ten deterministic items and completion persists after a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '타이핑 연습' }).click()

  for (let index = 0; index < 10; index += 1) {
    await expect(page.getByRole('heading', { name: new RegExp(`${index + 1} / 10`) })).toBeVisible()
    await page.getByRole('button', { name: '정답 확인' }).click()
    const answer = await page.locator('.answer-feedback p').first().textContent()
    expect(answer).toBeTruthy()
    await page.getByRole('textbox', { name: '영어 답변' }).fill(answer!.replace(/^정답:\s*/, ''))
    await expect(page.getByText('정확해요!')).toBeVisible()
    await page.getByRole('button', { name: '다음 문장' }).click()
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
