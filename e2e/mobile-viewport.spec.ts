import { expect, test } from '@playwright/test'

// The app boots into LearningApp (see src/main.tsx): there is no marketing
// home screen. These assertions cover the real mobile practice experience on
// an iPhone viewport: header, study tabs, Day selector (75 days), practice
// controls, touch-target sizes, and no horizontal overflow.
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})

test('LearningApp practice stays usable on an iPhone viewport', async ({ page }) => {
  await page.goto('/')

  const header = page.getByRole('heading', { name: '더 넓은 세상으로의 시작' })
  await expect(header).toBeVisible()

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

  // Day selector reaches the Day 61-75 advanced pack.
  const daySelect = page.locator('#practice-day-select')
  await expect(daySelect).toBeVisible()
  expect(await daySelect.locator('option').count()).toBe(75)
  await expect(daySelect.locator('option[value="75"]')).toHaveText('Day 75')

  // Core practice controls are visible and operable.
  const answer = page.getByRole('textbox', { name: '영어 답변' })
  const checkButton = page.getByRole('button', { name: '정답 확인' })
  await expect(page.getByRole('heading', { name: /1 \/ 10/ })).toBeVisible()
  await expect(answer).toBeVisible()
  await expect(checkButton).toBeVisible()

  // Touch targets meet the 44px minimum.
  for (const locator of [checkButton, page.getByRole('button', { name: '듣기 학습' }), answer]) {
    const box = await locator.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  }

  // No horizontal overflow on the real practice screen.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  // Day 75 content renders on mobile too.
  await daySelect.selectOption('75')
  await expect(page.getByText('오늘은 다 꼬였지만 예의를 지켰어요.')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  await page.screenshot({ path: 'test-results/qa-artifacts/mobile-learning.png', fullPage: true })
})
