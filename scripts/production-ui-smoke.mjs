import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const failures = []
const targets = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1280', width: 1280, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 900 },
]

for (const target of targets) {
  const page = await browser.newPage({ viewport: { width: target.width, height: target.height } })
  page.on('console', (message) => { if (message.type() === 'error') failures.push(`${target.name}: console ${message.text()}`) })
  page.on('pageerror', (error) => failures.push(`${target.name}: page ${error.message}`))
  page.on('requestfailed', (request) => failures.push(`${target.name}: network ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`))
  const response = await page.goto('https://english-talk-nga5.vercel.app', { waitUntil: 'networkidle' })
  if (!response?.ok()) failures.push(`${target.name}: navigation ${response?.status()}`)

  const heading = page.getByRole('heading', { name: '더 넓은 세상으로의 시작' })
  const headingBox = await heading.boundingBox()
  if (!headingBox || headingBox.x < 0 || headingBox.y < 0 || headingBox.x + headingBox.width > target.width || headingBox.y + headingBox.height > target.height) failures.push(`${target.name}: heading outside viewport`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  if (overflow) failures.push(`${target.name}: horizontal overflow`)

  const progress = page.getByLabel('주제별 진행률')
  if (await progress.getByText('survival-communication', { exact: false }).count()) failures.push(`${target.name}: raw topic slug exposed`)
  if (await progress.getByText('기본 생존 회화').count() !== 1) failures.push(`${target.name}: current Korean topic missing`)
  if (await progress.getByText('식당 기본 표현').count() !== 0) failures.push(`${target.name}: all topics unexpectedly expanded`)

  await page.getByRole('button', { name: '전체 주제 진행률 보기' }).click()
  if (await progress.getByText('식당 기본 표현').count() !== 1) failures.push(`${target.name}: expanded topics unavailable`)
  await page.getByRole('button', { name: '플래시카드' }).click()
  if (await page.locator('.flashcard').count() !== 10) failures.push(`${target.name}: selected Day does not show 10 flashcards`)
  await page.screenshot({ path: `test-results/qa-artifacts/production-${target.name}.png`, fullPage: true })
  await page.close()
}

await browser.close()
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('Production smoke passed: 10 flashcards at 3 viewports, localized collapsed/expanded topic progress, no console/page/network failures.')
