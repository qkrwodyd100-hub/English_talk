import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})

test('the home screen keeps its hierarchy and mission CTA usable on an iPhone viewport', async ({ page }) => {
  await page.goto('/')

  const heading = page.getByRole('heading', { name: 'Practice one useful conversation at a time.' })
  const missionButton = page.getByRole('button', { name: 'See today’s mission' })

  await expect(heading).toBeVisible()
  await expect(missionButton).toBeVisible()
  await expect(page.getByRole('group')).toHaveCount(3)

  for (const locator of [heading, missionButton]) {
    const box = await locator.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
  }

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/qa-artifacts/mobile-home.png', fullPage: true })
})
