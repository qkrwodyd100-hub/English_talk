import { expect, test } from '@playwright/test'

test('a new learner can complete and save a scripted two-turn practice', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'See today’s mission' }).click()
  await page.getByRole('button', { name: 'Start practice' }).click()

  const reply = page.getByRole('textbox', { name: 'Your English reply' })
  await reply.fill('Hi, can I have a coffee to go, please?')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await reply.fill('That is all, thank you.')
  await page.getByRole('button', { name: 'Send reply' }).click()

  await expect(page.getByText('2 / 2 turns')).toBeVisible()
  await page.getByRole('button', { name: 'Finish session' }).click()
  await expect(page.getByRole('heading', { name: 'You finished 2 turns.' })).toBeVisible()

  await page.getByRole('button', { name: 'View history' }).click()
  await expect(page.getByText('Order at a café')).toBeVisible()
  await expect(page.getByText(/2 turns/)).toBeVisible()
})
