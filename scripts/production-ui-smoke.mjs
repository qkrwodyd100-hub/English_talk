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

const practicePage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
practicePage.on('console', (message) => { if (message.type() === 'error') failures.push(`practice: console ${message.text()}`) })
practicePage.on('pageerror', (error) => failures.push(`practice: page ${error.message}`))
practicePage.on('requestfailed', (request) => failures.push(`practice: network ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`))
const practiceResponse = await practicePage.goto('https://english-talk-nga5.vercel.app', { waitUntil: 'networkidle' })
if (!practiceResponse?.ok()) failures.push(`practice: navigation ${practiceResponse?.status()}`)
await practicePage.evaluate(() => window.localStorage.clear())
await practicePage.reload({ waitUntil: 'networkidle' })
await practicePage.getByLabel('학습 Day 선택').selectOption('2')
const answer = practicePage.getByRole('textbox', { name: '영어 답변' })
await answer.fill('A table for one, please.')
await answer.press('Enter')
await answer.press('ArrowRight')
if (await practicePage.locator('.practice-prompt').getByText('메뉴판 좀 볼 수 있을까요?').count() !== 1) failures.push('practice: ArrowRight did not open the next sentence')
if (await answer.inputValue() !== '') failures.push('practice: next sentence answer was not empty')
if (!(await answer.evaluate((element) => document.activeElement === element))) failures.push('practice: next sentence answer was not focused')
await answer.press('ArrowLeft')
if (await practicePage.locator('.practice-prompt').getByText('한 명 자리 부탁해요.').count() !== 1) failures.push('practice: ArrowLeft did not restore the previous sentence')
if (await answer.inputValue() !== 'A table for one, please.') failures.push('practice: ArrowLeft did not restore the checked answer')
if (await practicePage.getByText('정답 · 정확해요!').count() !== 1) failures.push('practice: ArrowLeft did not restore checked feedback')
const storedActivities = await practicePage.evaluate(() => JSON.parse(window.localStorage.getItem('english-talk.learning') ?? '{}').state.studyActivities.length)
if (storedActivities !== 1) failures.push(`practice: expected one study activity after restore, got ${storedActivities}`)
await practicePage.screenshot({ path: 'test-results/qa-artifacts/production-arrow-left-restore.png', fullPage: true })
await practicePage.close()

await browser.close()
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('Production smoke passed: 10 flashcards at 3 viewports, localized collapsed/expanded topic progress, ArrowRight/ArrowLeft restore, and no console/page/network failures.')
