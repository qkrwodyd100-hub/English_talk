import { expect, test } from '@playwright/test'

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
  expect(persisted).toMatchObject({ version: 2, state: { selectedDay: 2, dayPositions: { 2: 1 }, reviewQueueIds: ['day-02-01'], favoriteIds: ['day-02-01'] } })
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

  await page.getByRole('button', { name: "What's good here?" }).click()
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByText('허용 표현')).toBeVisible()

  await page.getByLabel('학습 Day 선택').selectOption('8')
  await page.getByRole('button', { name: 'Mina Lee · 미나 리' }).click()
  await expect(page.getByRole('textbox', { name: '영어 답변' })).toHaveValue('I have a reservation under the name Mina Lee.')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByText('수정 필요')).toBeVisible()
})

test('shows real topic metadata and the selected day mini dialogue on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await page.getByLabel('주제 필터').selectOption('asking-for-photo-help')
  await expect(page.getByText('제 사진 좀 찍어 주시겠어요?')).toBeVisible()
  await expect(page.getByRole('button', { name: '미니 대화 연습' })).toHaveCount(0)

  await page.getByLabel('주제 필터').selectOption('restaurant-basics')
  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('2')
  await expect(page.getByText('restaurant-basics · beginner · 우선순위 1')).toBeVisible()
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
  await page.getByRole('button', { name: '다음 문장' }).click()
  await expect(page.getByText('한 명 자리 부탁해요.')).toBeVisible()
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