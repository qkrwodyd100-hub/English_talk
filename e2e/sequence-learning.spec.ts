import { expect, test } from '@playwright/test'

test('previous and next browse an unsubmitted day without recording learning', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')
  const previous = page.getByRole('button', { name: '이전', exact: true })
  const next = page.getByRole('button', { name: '다음', exact: true })
  await expect(previous).toBeDisabled()
  await expect(next).toBeEnabled()
  for (const button of [page.getByRole('button', { name: '정답 확인' }), previous, next]) {
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const learningRecord = () => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('english-talk.learning') ?? '{}').state
    return {
      answerHistory: state.answerHistory,
      attemptCounts: state.attemptCounts,
      completedSentenceIds: state.completedSentenceIds,
      masteredIds: state.masteredIds,
      reviewQueueIds: state.reviewQueueIds,
      studyActivities: state.studyActivities,
      completedChallengeDates: state.completedChallengeDates,
    }
  })
  const before = await learningRecord()

  await page.getByRole('textbox', { name: '영어 답변' }).fill('not submitted')
  await next.click()
  await expect(page.getByRole('heading', { name: /2 \/ 10/ })).toBeVisible()
  await expect(page.getByText('메뉴판 좀 볼 수 있을까요?')).toBeVisible()
  await expect(page.getByRole('textbox', { name: '영어 답변' })).toHaveValue('')
  expect(await learningRecord()).toEqual(before)

  await previous.click()
  await expect(page.getByRole('heading', { name: /1 \/ 10/ })).toBeVisible()
  await expect(page.getByText('한 명 자리 부탁해요.')).toBeVisible()
  await expect(previous).toBeDisabled()
  expect(await learningRecord()).toEqual(before)

  for (let position = 1; position < 10; position += 1) await next.click()
  await expect(page.getByRole('heading', { name: /10 \/ 10/ })).toBeVisible()
  await expect(next).toBeDisabled()
  expect(await learningRecord()).toEqual(before)
})

test('migrates v1 data and persists sequential progress, review, and favorites across reloads', async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem('seeded-v1')) return
    window.localStorage.setItem('english-talk.learning', JSON.stringify({
      version: 1,
      state: {
        masteredIds: ['day-01-01'],
        customSentences: [{ id: 'custom-1', english: 'Please wait here.', korean: '여기서 기다려 주세요.', day: 1, source: 'custom' }],
        completedChallengeDates: ['2026-08-10'],
      },
    }))
    window.sessionStorage.setItem('seeded-v1', 'true')
  })
  await page.goto('/')

  await expect(page.getByText('601', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: /1 \/ 11/ })).toBeVisible()
  await page.getByLabel('학습 Day 선택').selectOption('2')
  await page.getByRole('textbox', { name: '영어 답변' }).fill('wrong words')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByText('수정 필요')).toBeVisible()
  await page.getByRole('button', { name: '즐겨찾기' }).click()
  await page.reload()

  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('2')
  await expect(page.getByRole('heading', { name: /2 \/ 10/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '오답 복습 (1)' })).toBeVisible()
  await page.getByRole('button', { name: '오답 복습 (1)' }).click()
  await expect(page.getByText('A table for one, please.')).toBeVisible()
  await page.getByRole('button', { name: '내 문장' }).click()
  await expect(page.getByText('Please wait here.')).toBeVisible()

  const persisted = await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}'))
  expect(persisted).toMatchObject({ version: 4, state: { selectedDay: 2, dayPositions: { 2: 1 }, reviewQueueIds: ['day-02-01'], favoriteIds: ['day-02-01'], studyActivities: [{ day: 2, sentenceId: 'day-02-01', action: 'answer-checked', correct: false }] } })
})

test('opens Day 2 after a persisted completed Day 1', async ({ page }) => {
  await page.addInitScript(() => {
    const completed = Array.from({ length: 10 }, (_, index) => `day-01-${String(index + 1).padStart(2, '0')}`)
    window.localStorage.setItem('english-talk.learning', JSON.stringify({ version: 3, state: {
      masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 1, dayPositions: { 1: 10 }, completedSentenceIds: completed, attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [],
    } }))
  })
  await page.goto('/')
  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('2')
  await expect(page.getByRole('heading', { name: /1 \/ 10/ })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('2')
})

test('creates no history on visits, then persists a correctly scoped real study event and timeline', async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem('seeded-history-v2')) return
    window.localStorage.setItem('english-talk.learning', JSON.stringify({
      version: 2,
      state: { masteredIds: ['day-01-01'], customSentences: [], completedChallengeDates: [], selectedDay: 2, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [] },
    }))
    window.sessionStorage.setItem('seeded-history-v2', 'true')
  })
  await page.goto('/')
  await page.getByRole('button', { name: '학습 기록' }).click()
  await expect(page.getByText('아직 학습 기록이 없어요')).toBeVisible()

  await page.getByRole('button', { name: '타이핑 연습' }).click()
  await page.getByLabel('학습 Day 선택').selectOption('2')
  await page.getByRole('textbox', { name: '영어 답변' }).fill('A table for one, please.')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)).toBe(1)
  await page.reload()

  const persisted = await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}'))
  expect(persisted).toMatchObject({ version: 4, state: { masteredIds: ['day-01-01'], selectedDay: 2, studyActivities: [{ day: 2, sentenceId: 'day-02-01', action: 'answer-checked', correct: true }] } })
  await expect(page.getByLabel('최근 학습')).toContainText('Day 2')
  await page.getByRole('button', { name: '학습 기록' }).click()
  await expect(page.getByRole('heading', { name: '학습 기록' })).toBeVisible()
  const timeline = page.getByLabel('학습 기록')
  await expect(timeline.getByText('Day 2', { exact: true })).toBeVisible()
  await expect(timeline.getByText('1/10 완료 문장')).toBeVisible()
})

test('shows date-unknown legacy completions and exports a JSON backup', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('english-talk.learning', JSON.stringify({ version: 2, state: {
      masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 2, dayPositions: { 1: 10 },
      completedSentenceIds: Array.from({ length: 10 }, (_, index) => `day-01-${String(index + 1).padStart(2, '0')}`), attemptCounts: {}, reviewQueueIds: [], favoriteIds: [],
    } }))
  })
  await page.goto('/')
  await page.getByRole('button', { name: '학습 기록' }).click()

  await expect(page.getByText('이전 학습 기록 (날짜 미상)')).toBeVisible()
  await expect(page.getByText('Day 1')).toBeVisible()
  await expect(page.getByText('10/10 완료 문장')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON 백업 내보내기' }).click()
  expect((await download).suggestedFilename()).toBe('english-talk-learning-backup.json')

  await page.getByRole('button', { name: 'JSON 백업 복원' }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'restore.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 3, state: {
      masteredIds: ['day-02-01'], customSentences: [], completedChallengeDates: [], selectedDay: 2, dayPositions: {}, completedSentenceIds: ['day-02-01'], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [],
    } })),
  })
  await expect(page.getByRole('status')).toContainText('기존 데이터는 유지됩니다')
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.completedSentenceIds)).toEqual(expect.arrayContaining(['day-01-01', 'day-02-01']))
})

test('keeps overall progress at 100 percent when built-in and custom sentences are all complete', async ({ page }) => {
  await page.addInitScript(() => {
    const builtInIds = Array.from({ length: 60 }, (_, dayIndex) =>
      Array.from({ length: 10 }, (_, sentenceIndex) =>
        `day-${String(dayIndex + 1).padStart(2, '0')}-${String(sentenceIndex + 1).padStart(2, '0')}`,
      ),
    ).flat()
    const customSentences = Array.from({ length: 10 }, (_, index) => ({
      id: `custom-${index + 1}`,
      english: `Custom sentence ${index + 1}.`,
      korean: `사용자 문장 ${index + 1}.`,
      day: 1,
      source: 'custom',
    }))
    window.localStorage.setItem('english-talk.learning', JSON.stringify({
      version: 2,
      state: {
        masteredIds: [],
        customSentences,
        completedChallengeDates: [],
        selectedDay: 1,
        dayPositions: {},
        completedSentenceIds: [...builtInIds, ...customSentences.map(({ id }) => id)],
        attemptCounts: {},
        reviewQueueIds: [],
        favoriteIds: [],
      },
    }))
  })

  await page.goto('/')

  const dashboard = page.getByLabel('학습 현황')
  await expect(dashboard.getByText('610', { exact: true })).toBeVisible()
  await expect(dashboard.getByText('100%', { exact: true })).toBeVisible()
})

test('resumes and re-practices a persisted custom sentence in the sequential flow', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('english-talk.learning', JSON.stringify({
      version: 2,
      state: {
        masteredIds: [],
        customSentences: [{ id: 'custom-1', english: 'Please wait here.', korean: '여기서 기다려 주세요.', day: 1, source: 'custom' }],
        completedChallengeDates: [],
        selectedDay: 1,
        dayPositions: { 1: 10 },
        completedSentenceIds: [],
        attemptCounts: { 'custom-1': 1 },
        reviewQueueIds: ['custom-1'],
        favoriteIds: [],
      },
    }))
  })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /11 \/ 11/ })).toBeVisible()
  await expect(page.getByText('여기서 기다려 주세요.')).toBeVisible()
  await page.getByRole('button', { name: '오답 복습 (1)' }).click()
  await page.getByRole('button', { name: '다시 연습' }).click()

  await expect(page.getByRole('heading', { name: /11 \/ 11/ })).toBeVisible()
  await expect(page.getByText('여기서 기다려 주세요.')).toBeVisible()
})

test('uses declared alternatives and slots with the engine answer contract', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')

  for (const answer of ['A table for one, please.', 'Can I see the menu?']) {
    await page.getByRole('textbox', { name: '영어 답변' }).fill(answer)
    await page.getByRole('button', { name: '정답 확인' }).click()
    await expect(page.getByText('정확')).toBeVisible()
    await page.getByRole('button', { name: '다음 문장' }).click()
  }

  await page.getByRole('textbox', { name: '영어 답변' }).fill("What's good here?")
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByText('정답 · 더 자연스러운 표현')).toBeVisible()

  await page.getByLabel('학습 Day 선택').selectOption('8')
  await expect(page.getByRole('button', { name: 'Mina Lee · 미나 리' })).toHaveCount(0)
  await page.getByRole('textbox', { name: '영어 답변' }).fill('I have a reservation under the name Mina Lee.')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByText('수정 필요')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mina Lee · 미나 리' })).toBeVisible()
})

test('keeps the Day 16 alternative out of the DOM until the learner checks an answer', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('16')

  await expect(page.getByText('This is too tight.')).toHaveCount(0)
  await expect(page.getByText('This is too loose.')).toHaveCount(0)
  await expect(page.getByText('저장된 표현과 슬롯')).toHaveCount(0)

  await page.getByRole('textbox', { name: '영어 답변' }).fill('This is too loose.')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByText('This is too tight.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'This is too loose.' })).toBeVisible()
  await expect(page.getByText('저장된 표현과 슬롯')).toBeVisible()
})

test('shows real topic metadata and the selected day mini dialogue on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await page.getByLabel('주제 필터').selectOption('asking-for-photo-help')
  await expect(page.getByText('제 사진 좀 찍어 주시겠어요?')).toBeVisible()
  await expect(page.getByRole('button', { name: '미니 대화 연습' })).toHaveCount(0)

  await page.getByLabel('주제 필터').selectOption('restaurant-basics')
  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('2')
  await expect(page.locator('.practice-prompt').getByText('식당 기본 표현')).toHaveCount(0)
  await expect(page.getByText(/Beginner|우선순위/i)).toHaveCount(0)
  await page.getByRole('button', { name: '미니 대화 연습' }).click()
  await expect(page.getByRole('heading', { name: 'Day 2 미니 대화' })).toBeVisible()
  await expect(page.getByText('Of course. Here is the menu.')).toBeVisible()
  await expect(page.getByText('네. 여기 메뉴판입니다.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('sequential learning controls remain visible on a desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await expect(page.getByLabel('학습 Day 선택')).toBeVisible()
  await expect(page.getByLabel('주제별 진행률')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('keeps the desktop overview compact and presents localized topic progress on demand', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  const heading = page.getByRole('heading', { name: '더 넓은 세상으로의 시작' })
  const headingBox = await heading.boundingBox()
  expect(headingBox).not.toBeNull()
  expect(headingBox!.x).toBeGreaterThanOrEqual(0)
  expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(1280)
  expect(headingBox!.y + headingBox!.height).toBeLessThanOrEqual(900)
  expect(await heading.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(64)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const topicProgress = page.getByLabel('주제별 진행률')
  await expect(topicProgress.getByText('현재 Day 주제')).toBeVisible()
  await expect(topicProgress.getByText('기본 생존 회화')).toBeVisible()
  await expect(topicProgress.getByText('survival-communication', { exact: false })).toHaveCount(0)
  await expect(topicProgress.getByRole('button', { name: '전체 주제 진행률 보기' })).toBeVisible()
  await expect(topicProgress.getByText('식당 기본 표현')).toHaveCount(0)

  await topicProgress.getByRole('button', { name: '전체 주제 진행률 보기' }).click()
  await expect(topicProgress.getByText('식당 기본 표현')).toBeVisible()
})

test('topic-filtered practice persists the displayed sentence position across topic gaps', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('주제 필터').selectOption('restaurant-basics')

  for (const answer of ['A table for one, please.', 'Can I see the menu?', 'What do you recommend?', "I'll have this.", 'Not spicy, please.', 'The bill, please.', 'Can I pay with a card?']) {
    await page.getByRole('textbox', { name: '영어 답변' }).fill(answer)
    await page.getByRole('button', { name: '정답 확인' }).click()
    await page.getByRole('button', { name: '다음 문장' }).click()
  }

  await expect(page.getByText('맛있었어요.')).toBeVisible()
  await page.getByRole('textbox', { name: '영어 답변' }).fill('It was delicious.')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByRole('button', { name: '다음 문장' })).toBeDisabled()
  await expect(page.getByText('맛있었어요.')).toBeVisible()
})

test('keeps practice usable and announces a persistence failure without horizontal overflow on mobile', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'english-talk.learning') throw new DOMException('Storage unavailable', 'QuotaExceededError')
      return originalSetItem.call(this, key, value)
    }
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const notice = page.getByRole('status')
  await expect(notice).toContainText('저장소를 읽을 수 없습니다')
  await page.getByLabel('학습 Day 선택').selectOption('2')
  await page.getByRole('textbox', { name: '영어 답변' }).fill('wrong words')
  await page.getByRole('button', { name: '정답 확인' }).click()

  await expect(page.getByText('수정 필요')).toBeVisible()
  await expect(page.getByRole('button', { name: '오답 복습 (1)' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/qa-artifacts/learning-storage-fallback-mobile-390.png', fullPage: true })
})

test('supports keyboard day selection and exposes answer feedback through a polite live region on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  const daySelect = page.getByLabel('학습 Day 선택')
  await daySelect.focus()
  await page.keyboard.press('End')
  await expect(daySelect).toHaveValue('60')
  await expect(page.getByRole('heading', { name: /1 \/ 10/ })).toBeVisible()

  await page.getByRole('textbox', { name: '영어 답변' }).fill('wrong words')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.locator('[aria-live="polite"]')).toContainText('수정 필요')
  await page.screenshot({ path: 'test-results/qa-artifacts/learning-keyboard-desktop-1280.png', fullPage: true })
})

test('completes a desktop practice flow without browser console, page, or network failures', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const failedRequests: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`))

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')
  await page.getByRole('textbox', { name: '영어 답변' }).fill('A table for one, please.')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByText('정확')).toBeVisible()
  await page.getByRole('button', { name: '다음 문장' }).click()

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(failedRequests).toEqual([])
})

test('submits typed answers once with Enter while preserving blank and IME safeguards', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')

  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await answer.press('Enter')
  await expect(page.getByText('정답:', { exact: false })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)).toBe(0)

  await answer.dispatchEvent('compositionstart')
  await answer.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  await answer.dispatchEvent('compositionend')
  await expect(page.getByText('정답:', { exact: false })).toHaveCount(0)

  await answer.fill('A table for one, please.')
  await answer.press('Enter')
  await expect(page.getByText('정확')).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)).toBe(1)
  await page.reload()
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)).toBe(1)

  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')
  await page.getByRole('textbox', { name: '영어 답변' }).fill('wrong words')
  await page.getByRole('textbox', { name: '영어 답변' }).press('Enter')
  await expect(page.getByText('수정 필요')).toBeVisible()
})

test('uses ArrowRight only after checking an answer to advance practice and refocus typing', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')

  const answer = page.getByRole('textbox', { name: '영어 답변' })
  const firstPrompt = page.locator('.practice-prompt').getByText('한 명 자리 부탁해요.')
  await answer.fill('A table for one, please.')
  await answer.press('ArrowLeft')
  await answer.press('ArrowRight')
  await expect(firstPrompt).toBeVisible()
  await expect(answer).toHaveValue('A table for one, please.')
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement)?.selectionStart)).toBe('A table for one, please.'.length)
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)).toBe(0)

  await answer.press('Enter')
  await expect(page.getByRole('button', { name: '다음 문장' })).toBeVisible()
  await answer.press('ArrowRight')
  await expect(page.locator('.practice-prompt').getByText('메뉴판 좀 볼 수 있을까요?')).toBeVisible()
  await expect(answer).toHaveValue('')
  await expect(answer).toBeFocused()
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)).toBe(1)
})

test('restores a checked practice from in-memory history with ArrowLeft without duplicating learning', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')

  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await answer.fill('A table for one, please.')
  await answer.press('Enter')
  await expect(page.getByText('정답 · 정확해요!')).toBeVisible()
  const learningRecord = () => page.evaluate(() => {
    const state = JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state
    return {
      answerHistory: state.answerHistory,
      attemptCounts: state.attemptCounts,
      completedSentenceIds: state.completedSentenceIds,
      masteredIds: state.masteredIds,
      reviewQueueIds: state.reviewQueueIds,
      studyActivities: state.studyActivities,
      completedChallengeDates: state.completedChallengeDates,
    }
  })
  const beforeAdvance = await learningRecord()

  await answer.press('ArrowRight')
  await expect(page.locator('.practice-prompt').getByText('메뉴판 좀 볼 수 있을까요?')).toBeVisible()
  await expect(answer).toHaveValue('')
  await answer.press('ArrowLeft')

  await expect(page.locator('.practice-prompt').getByText('한 명 자리 부탁해요.')).toBeVisible()
  await expect(answer).toHaveValue('A table for one, please.')
  await expect(page.getByText('정답 · 정확해요!')).toBeVisible()
  await expect(answer).toBeFocused()
  expect(await learningRecord()).toEqual(beforeAdvance)

  await answer.press('ArrowRight')
  await expect(page.locator('.practice-prompt').getByText('메뉴판 좀 볼 수 있을까요?')).toBeVisible()
  expect(await learningRecord()).toEqual(beforeAdvance)
})

test('clears practice back history when the learner changes tabs', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')
  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await answer.fill('A table for one, please.')
  await answer.press('Enter')
  await answer.press('ArrowRight')
  await expect(page.locator('.practice-prompt').getByText('메뉴판 좀 볼 수 있을까요?')).toBeVisible()

  await page.getByRole('button', { name: '플래시카드' }).click()
  await page.getByRole('button', { name: '타이핑 연습' }).click()
  await answer.press('ArrowLeft')

  await expect(page.locator('.practice-prompt').getByText('메뉴판 좀 볼 수 있을까요?')).toBeVisible()
  await expect(page.getByRole('button', { name: '이전', exact: true })).toBeEnabled()
})

test('returns from the next Day to a checked final sentence without repeating study activity', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('english-talk.learning', JSON.stringify({ version: 3, state: {
      masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 2, dayPositions: { 2: 9 }, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [],
    } }))
  })
  await page.goto('/')
  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await answer.fill('It was delicious.')
  await answer.press('Enter')
  await answer.press('ArrowRight')
  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('3')
  const activityCount = await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)

  await answer.press('ArrowLeft')
  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('2')
  await expect(page.locator('.practice-prompt').getByText('맛있었어요.')).toBeVisible()
  await expect(page.getByText('정답 · 정확해요!')).toBeVisible()
  await answer.press('ArrowRight')
  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('3')
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)).toBe(activityCount)
})

test('keeps ArrowLeft native for typed and composing answers while preserving multiple practice snapshots', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')
  const answer = page.getByRole('textbox', { name: '영어 답변' })

  await answer.fill('A table for one, please.')
  await answer.press('Enter')
  await answer.press('ArrowRight')
  await answer.fill('Can I see the menu?')
  await answer.press('Enter')
  await answer.press('ArrowRight')
  await expect(page.locator('.practice-prompt').getByText('뭘 추천하시나요?')).toBeVisible()

  await answer.fill('draft')
  await answer.press('ArrowLeft')
  await expect(page.locator('.practice-prompt').getByText('뭘 추천하시나요?')).toBeVisible()
  await expect(answer).toHaveValue('draft')

  await answer.fill('')
  await answer.dispatchEvent('compositionstart')
  await answer.dispatchEvent('keydown', { key: 'ArrowLeft', isComposing: true })
  await answer.dispatchEvent('compositionend')
  await expect(page.locator('.practice-prompt').getByText('뭘 추천하시나요?')).toBeVisible()

  await answer.press('ArrowLeft')
  await expect(page.locator('.practice-prompt').getByText('메뉴판 좀 볼 수 있을까요?')).toBeVisible()
  await expect(page.getByText('정답 · 정확해요!')).toBeVisible()
  await answer.fill('')
  await answer.press('ArrowLeft')
  await expect(page.locator('.practice-prompt').getByText('한 명 자리 부탁해요.')).toBeVisible()
})

test('does not advance an answered practice with composing or modified ArrowRight keys and keeps the button fallback', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')

  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await answer.fill('wrong words')
  await answer.press('Enter')
  await expect(page.getByText('수정 필요')).toBeVisible()
  const prompt = page.locator('.practice-prompt').getByText('한 명 자리 부탁해요.')

  await answer.dispatchEvent('compositionstart')
  await answer.dispatchEvent('keydown', { key: 'ArrowRight', isComposing: true })
  await answer.dispatchEvent('compositionend')
  await answer.press('Control+ArrowRight')
  await answer.press('Alt+ArrowRight')
  await answer.press('Meta+ArrowRight')
  await expect(prompt).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)).toBe(1)

  await page.getByRole('button', { name: '다음 문장' }).click()
  await expect(page.locator('.practice-prompt').getByText('메뉴판 좀 볼 수 있을까요?')).toBeVisible()
  await expect(answer).toBeFocused()
})

test('moves a checked last answer to the next Day first sentence with no extra study event', async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem('seeded-last-answer-day-transition')) return
    window.localStorage.setItem('english-talk.learning', JSON.stringify({ version: 3, state: {
      masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 2, dayPositions: { 2: 9 }, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [],
    } }))
    window.sessionStorage.setItem('seeded-last-answer-day-transition', 'true')
  })
  await page.goto('/')

  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await expect(page.locator('.practice-prompt').getByText('맛있었어요.')).toBeVisible()
  await expect(answer).toHaveAccessibleDescription('정답 확인 후 오른쪽 화살표 키로 다음 문장으로 이동할 수 있습니다.')
  await answer.press('ArrowRight')
  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('2')
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities)).toEqual([])
  await answer.fill('It was delicious.')
  await answer.press('Enter')
  await answer.press('ArrowRight')

  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('3')
  await expect(page.getByLabel('주제 필터')).toHaveValue('all')
  await expect(page.getByRole('heading', { name: /1 \/ 10/ })).toBeVisible()
  await expect(page.getByText('정답:', { exact: false })).toHaveCount(0)
  await expect(answer).toHaveValue('')
  await expect(answer).toBeFocused()
  const persisted = await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state)
  expect(persisted.dayPositions).toEqual({ 2: 10, 3: 0 })
  expect(persisted.studyActivities).toHaveLength(1)
  expect(persisted.studyActivities[0]).toMatchObject({ day: 2, sentenceId: 'day-02-10', action: 'answer-checked', correct: true })
  await page.reload()
  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('3')
  await expect(page.getByRole('heading', { name: /1 \/ 10/ })).toBeVisible()
})

test('keeps a checked final Day answer in place when ArrowRight has no later Day', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('english-talk.learning', JSON.stringify({ version: 3, state: {
      masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 60, dayPositions: { 60: 9 }, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [],
    } }))
  })
  await page.goto('/')

  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await expect(page.getByRole('heading', { name: /10 \/ 10/ })).toBeVisible()
  await answer.fill('wrong words')
  await answer.press('Enter')
  await answer.press('ArrowRight')

  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('60')
  await expect(page.getByRole('heading', { name: /10 \/ 10/ })).toBeVisible()
  await expect(page.getByText('마지막 Day입니다. 다음 문장이 없습니다.')).toBeVisible()
  await expect(answer).toHaveValue('wrong words')
  const persisted = await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state)
  expect(persisted.dayPositions).toEqual({ 60: 10 })
  expect(persisted.studyActivities).toHaveLength(1)
})

test('persists a corrected final Day answer when ArrowRight announces the terminal state', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('english-talk.learning', JSON.stringify({ version: 3, state: {
      masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 60, dayPositions: { 60: 9 }, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: ['day-60-10'], favoriteIds: [], studyActivities: [],
    } }))
  })
  await page.goto('/')

  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await answer.fill('wrong words')
  await answer.press('Enter')
  await answer.fill('Thank you for making my trip better!')
  await answer.press('ArrowRight')

  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('60')
  await expect(page.getByText('마지막 Day입니다. 다음 문장이 없습니다.')).toBeVisible()
  const persisted = await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state)
  expect(persisted.completedSentenceIds).toContain('day-60-10')
  expect(persisted.reviewQueueIds).not.toContain('day-60-10')
  expect(persisted.studyActivities).toHaveLength(2)
  expect(persisted.studyActivities).toContainEqual(expect.objectContaining({ day: 60, sentenceId: 'day-60-10', action: 'review-completed', correct: true }))
})

test('keeps the ArrowRight practice flow usable without horizontal overflow at target widths', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
    await page.getByLabel('학습 Day 선택').selectOption('2')
    const answer = page.getByRole('textbox', { name: '영어 답변' })
    await answer.fill('A table for one, please.')
    await answer.press('Enter')
    await answer.press('ArrowRight')
    await expect(page.locator('.practice-prompt').getByText('메뉴판 좀 볼 수 있을까요?')).toBeVisible()
    await expect(answer).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('submits a single-line answer with Enter or NumpadEnter without inserting a newline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')

  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await expect(answer).toHaveAttribute('type', 'text')
  await answer.fill('A table for one, please.')
  await answer.press('Enter')
  await expect(page.getByText('정답 · 정확해요!')).toBeVisible()
  await expect(answer).not.toHaveValue(/\n/)
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)).toBe(1)

  await page.getByRole('button', { name: '다음 문장' }).click()
  await answer.fill('Can I see the menu?')
  await answer.press('NumpadEnter')
  await expect(page.getByText('정답 · 정확해요!')).toBeVisible()
  await expect(answer).not.toHaveValue(/\n/)
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)).toBe(2)
})

test('treats I will have this as the correct Day 2 contraction equivalent', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('학습 Day 선택').selectOption('2')

  for (const answerText of ['A table for one, please.', 'Can I see the menu?', 'What do you recommend?']) {
    const answer = page.getByRole('textbox', { name: '영어 답변' })
    await answer.fill(answerText)
    await answer.press('Enter')
    await page.getByRole('button', { name: '다음 문장' }).click()
  }

  const answer = page.getByRole('textbox', { name: '영어 답변' })
  await answer.fill('I will have this.')
  await answer.press('Enter')
  await expect(page.getByText('정답 · 정확해요!')).toBeVisible()
  await expect(page.getByText('입력한 표현이 기준 문장과 같거나 축약형만 달라요.')).toBeVisible()
})

test('keeps typing practice topic-free and visually aligned across responsive viewports', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const panel = page.locator('.study-panel')
    const prompt = panel.locator('.practice-prompt strong')
    const answer = panel.getByRole('textbox', { name: '영어 답변' })
    await expect(panel.locator('.practice-prompt').getByText('기본 생존 회화')).toHaveCount(0)
    expect(await prompt.evaluate((element) => getComputedStyle(element).fontSize)).toBe(await answer.evaluate((element) => getComputedStyle(element).fontSize))
    expect(await prompt.evaluate((element) => getComputedStyle(element).fontWeight)).toBe(await answer.evaluate((element) => getComputedStyle(element).fontWeight))
    await answer.fill('wrong words')
    await answer.press('Enter')
    await expect(panel.getByText('수정 필요')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('hides the typing answer label visually while retaining its accessible name', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const panel = page.locator('.study-panel')
    const answer = panel.getByRole('textbox', { name: '영어 답변' })

    await expect(answer).toHaveAttribute('placeholder', '영어 문장을 입력하세요')
    await expect(panel.getByText('영어 답변', { exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('distinguishes persisted first and recent real learning timestamps', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('english-talk.learning', JSON.stringify({ version: 3, state: {
      masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 2, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [],
      studyActivities: [
        { timestamp: '2026-08-13T04:47:00.000Z', day: 2, sentenceId: 'day-02-01', action: 'answer-checked', correct: true },
        { timestamp: '2026-08-12T04:47:00.000Z', day: 1, sentenceId: 'day-01-01', action: 'answer-checked', correct: true },
      ],
    } }))
  })
  await page.goto('/')
  await page.getByRole('button', { name: '학습 기록' }).click()
  const summary = page.getByLabel('학습 날짜 요약')
  await expect(summary.getByRole('heading', { name: '학습 시작일' })).toBeVisible()
  await expect(summary.getByRole('heading', { name: '최근 학습일' })).toBeVisible()
  await expect(summary).toContainText('2026. 8. 12.(수) 13:47')
  await expect(summary).toContainText('2026. 8. 13.(목) 13:47')
  await page.reload()
  await page.getByRole('button', { name: '학습 기록' }).click()
  await expect(page.getByLabel('학습 날짜 요약')).toContainText('2026. 8. 12.(수) 13:47')
})