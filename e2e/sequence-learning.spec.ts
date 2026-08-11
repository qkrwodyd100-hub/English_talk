import { expect, test } from '@playwright/test'

test('learner can choose a day and topic, review a missed answer, and complete a mini dialogue', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await page.getByLabel('학습 Day 선택').selectOption('2')
  await expect(page.getByText('Day 2 학습', { exact: true })).toBeVisible()
  await page.getByLabel('주제 필터').selectOption('식당·카페')
  await expect(page.getByLabel('주제별 진행률')).toBeVisible()

  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByText('수정 필요')).toBeVisible()
  await page.getByRole('button', { name: '오답 복습에 추가' }).click()
  await expect(page.getByRole('button', { name: /오답 복습 \(1\)/ })).toBeVisible()

  await page.getByRole('button', { name: '미니 대화 연습' }).click()
  await expect(page.getByRole('heading', { name: 'Day 2 미니 대화' })).toBeVisible()
  const reply = page.getByRole('textbox', { name: '내 영어 답변' })
  await reply.fill('Hello! Nice to meet you.')
  await page.getByRole('button', { name: '대화 계속하기' }).click()
  await reply.fill('Thank you.')
  await page.getByRole('button', { name: '대화 계속하기' }).click()
  await expect(page.getByText('2 / 2 턴')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/qa-artifacts/sequential-learning-mobile-390.png', fullPage: true })
})

test('sequential learning controls remain visible on a desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await expect(page.getByLabel('학습 Day 선택')).toBeVisible()
  await expect(page.getByLabel('주제별 진행률')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/qa-artifacts/sequential-learning-desktop.png', fullPage: true })
})

test('topic quick access and phrase controls produce usable answers without leaking template syntax', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.getByRole('button', { name: '타이핑 연습' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('textbox', { name: '영어 답변' }).fill('stale answer')
  await page.getByLabel('주제 필터').selectOption('긴급 상황')
  await expect(page.getByLabel('학습 Day 선택')).toHaveValue('25')
  await expect(page.getByRole('textbox', { name: '영어 답변' })).toHaveValue('')
  await expect(page.getByText('이 주제에는 Day 1 문장이 없습니다.')).toHaveCount(0)

  await page.getByLabel('학습 Day 선택').selectOption('5')
  const uberChoice = page.getByRole('button', { name: 'Can I book an Uber here?' })
  await expect(uberChoice).toBeVisible()
  await expect(page.getByRole('button', { name: 'Can I book an Uber', exact: true })).toHaveCount(0)
  await uberChoice.click()
  await expect(page.getByRole('textbox', { name: '영어 답변' })).toHaveValue('Can I book an Uber here?')

  await page.getByLabel('학습 Day 선택').selectOption('8')
  await page.getByRole('textbox', { name: '이름 채우기' }).pressSequentially('Mina')
  await expect(page.getByRole('textbox', { name: '영어 답변' })).toHaveValue('I have a reservation under the name Mina.')
  await page.getByRole('button', { name: '정답 확인' }).click()
  await expect(page.getByText('허용 표현')).toBeVisible()
  await expect(page.locator('.answer-feedback')).not.toContainText('[이름]')
})
