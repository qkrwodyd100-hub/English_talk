import { expect, test } from '@playwright/test'

test('voice dictation is available before the first answer and only fills the input', async ({ page }) => {
  await page.addInitScript(() => {
    class MockRecognition {
      static instance: MockRecognition
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
  await page.goto('/')
  const answer = page.getByRole('textbox', { name: '영어 답변' })
  const dictation = page.getByRole('button', { name: '음성으로 입력' })
  await expect(answer).toBeVisible()
  await expect(dictation).toBeVisible()
  await expect(dictation).toBeEnabled()

  await dictation.click()
  await page.evaluate(() => {
    const instance = (window as typeof window & { __recognition: { instance: { onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void) | null } } }).__recognition.instance
    instance.onresult?.({ results: [[{ transcript: 'This is my first answer', isFinal: true }]] })
  })

  await expect(answer).toHaveValue('This is my first answer')
  await expect(page.getByText(/정답:/)).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}')
    return {
      activities: payload.state.studyActivities.length,
      attempts: Object.values(payload.state.answerHistory).flat().length,
    }
  })).toEqual({ activities: 0, attempts: 0 })
})

test('unsubmitted next navigation aborts dictation and rejects its stale result', async ({ page }) => {
  await page.addInitScript(() => {
    class MockRecognition {
      static instance: MockRecognition
      lang = ''
      interimResults = false
      continuous = false
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      onend: (() => void) | null = null
      abortCalls = 0
      constructor() { MockRecognition.instance = this }
      start() {}
      stop() { this.onend?.() }
      abort() { this.abortCalls += 1; this.onend?.() }
    }
    ;(window as Window & { SpeechRecognition?: unknown; __recognition?: typeof MockRecognition }).SpeechRecognition = MockRecognition
    ;(window as Window & { __recognition?: typeof MockRecognition }).__recognition = MockRecognition
  })
  await page.goto('/')
  await page.getByRole('button', { name: '음성으로 입력' }).click()
  await page.evaluate(() => {
    const browser = window as typeof window & { __recognition: { instance: { onresult: unknown } }; __staleResult?: unknown }
    browser.__staleResult = browser.__recognition.instance.onresult
  })
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __recognition: { instance: { abortCalls: number } } }).__recognition.instance.abortCalls)).toBe(1)
  await page.evaluate(() => {
    const stale = (window as typeof window & { __staleResult: (event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void }).__staleResult
    stale({ results: [[{ transcript: 'stale answer', isFinal: true }]] })
  })
  await expect(page.getByRole('textbox', { name: '영어 답변' })).toHaveValue('')
  await expect(page.getByRole('heading', { name: /2 \/ 10/ })).toBeVisible()
})

test('voice dictation control remains a 44px touch target on supported mobile widths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('textbox', { name: '영어 답변' }).fill('wrong')
  await page.getByRole('button', { name: '정답 확인' }).click()
  const dictation = page.getByRole('button', { name: '음성으로 입력' })
  await expect(dictation).toBeVisible()
  expect((await dictation.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 430, height: 932 })
  expect((await dictation.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('voice dictation appends one final English transcript without submitting an answer', async ({ page }) => {
  await page.addInitScript(() => {
    type RecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }
    class MockRecognition {
      static instances: MockRecognition[] = []
      lang = ''
      interimResults = true
      continuous = true
      onresult: ((event: RecognitionEvent) => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      onend: (() => void) | null = null
      startCalls = 0
      stopCalls = 0
      abortCalls = 0
      constructor() { MockRecognition.instances.push(this) }
      start() { this.startCalls += 1 }
      stop() { this.stopCalls += 1; this.onend?.() }
      abort() { this.abortCalls += 1; this.onend?.() }
    }
    ;(window as Window & { SpeechRecognition?: unknown; __recognition?: typeof MockRecognition }).SpeechRecognition = MockRecognition
    ;(window as Window & { __recognition?: typeof MockRecognition }).__recognition = MockRecognition
  })
  await page.goto('/')
  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await answer.fill('I already typed this')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await page.getByRole('button', { name: '음성으로 입력' }).click()

  await expect(page.getByRole('button', { name: '음성 입력 중지' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.evaluate(() => {
    const instance = (window as typeof window & { __recognition: { instances: Array<{ lang: string; interimResults: boolean; continuous: boolean; startCalls: number }> } }).__recognition.instances[0]
    return { lang: instance.lang, interimResults: instance.interimResults, continuous: instance.continuous, startCalls: instance.startCalls }
  })).toEqual({ lang: 'en-US', interimResults: false, continuous: false, startCalls: 1 })

  await page.evaluate(() => {
    const instance = (window as typeof window & { __recognition: { instances: Array<{ onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void) | null }> } }).__recognition.instances[0]
    instance.onresult?.({ results: [[{ transcript: 'and then I spoke', isFinal: true }]] })
  })

  await expect(answer).toHaveValue('I already typed this and then I spoke')
  await expect.poll(() => page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}')
    return Object.values(payload.state.answerHistory ?? {}).flat().length
  })).toBe(1)
  await expect(page.getByText('음성 입력이 완료되었습니다. 내용을 확인한 뒤 정답을 제출하세요.')).toBeVisible()
})

test('dictation ignores interim and duplicate final events and reports no speech', async ({ page }) => {
  await page.addInitScript(() => {
    type RecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }
    class MockRecognition {
      static instance: MockRecognition
      lang = ''
      interimResults = false
      continuous = false
      onresult: ((event: RecognitionEvent) => void) | null = null
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
  await page.goto('/')
  await page.getByRole('textbox', { name: '영어 답변' }).fill('wrong')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await page.getByRole('button', { name: '음성으로 입력' }).click()
  await page.evaluate(() => {
    const instance = (window as typeof window & { __recognition: { instance: { onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void) | null } } }).__recognition.instance
    instance.onresult?.({ results: [[{ transcript: 'interim', isFinal: false }]] })
    instance.onresult?.({ results: [[{ transcript: 'final answer', isFinal: true }]] })
    instance.onresult?.({ results: [[{ transcript: 'final answer', isFinal: true }]] })
  })
  await expect(page.getByRole('textbox', { name: '영어 답변' })).toHaveValue('wrong final answer')
  await page.evaluate(() => {
    const instance = (window as typeof window & { __recognition: { instance: { onerror: ((event: { error: string }) => void) | null } } }).__recognition.instance
    instance.onerror?.({ error: 'no-speech' })
  })
  await expect(page.getByText('음성이 감지되지 않았습니다. 다시 시도하거나 텍스트로 입력하세요.')).toBeVisible()
})

test('dictation is aborted on sentence navigation so stale results cannot change the next answer', async ({ page }) => {
  await page.addInitScript(() => {
    class MockRecognition {
      static instance: MockRecognition
      lang = ''
      interimResults = false
      continuous = false
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      onend: (() => void) | null = null
      abortCalls = 0
      constructor() { MockRecognition.instance = this }
      start() {}
      stop() { this.onend?.() }
      abort() { this.abortCalls += 1; this.onend?.() }
    }
    ;(window as Window & { SpeechRecognition?: unknown; __recognition?: typeof MockRecognition }).SpeechRecognition = MockRecognition
    ;(window as Window & { __recognition?: typeof MockRecognition }).__recognition = MockRecognition
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: '영어 답변' }).fill('wrong')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await page.getByRole('button', { name: '음성으로 입력' }).click()
  await page.getByRole('button', { name: '다음 문장' }).click()
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __recognition: { instance: { abortCalls: number } } }).__recognition.instance.abortCalls)).toBe(1)
  await page.evaluate(() => {
    const instance = (window as typeof window & { __recognition: { instance: { onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void) | null } } }).__recognition.instance
    instance.onresult?.({ results: [[{ transcript: 'stale result', isFinal: true }]] })
  })
  await expect(page.getByRole('textbox', { name: '영어 답변' })).toHaveValue('')
})
