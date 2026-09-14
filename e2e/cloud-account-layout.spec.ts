import { expect, test, type Page } from '@playwright/test'

const responsiveWidths = [320, 360, 390, 430, 500, 599, 600, 601, 620, 640, 680, 720, 768, 900, 901, 1024, 1440]

type LayoutMetrics = {
  width: number
  rootOverflow: number
  account: { x: number; width: number; height: number; right: number }
  intro: { x: number; width: number; right: number }
  title: { x: number; width: number; height: number; right: number; lineHeight: number }
  form: { x: number; width: number; right: number }
  childrenInsideAccount: boolean
  controlsAtLeast44: boolean
  fullPageScrollerCount: number
}

async function measureCloudAccount(page: Page): Promise<LayoutMetrics> {
  const account = page.getByLabel('계정 및 동기화')
  await expect(account).toBeVisible()
  return account.evaluate((element) => {
    const section = element as HTMLElement
    const intro = section.firstElementChild as HTMLElement
    const title = intro.querySelector('strong') as HTMLElement
    const form = section.querySelector('.cloud-login') as HTMLElement
    const rect = (node: HTMLElement) => {
      const box = node.getBoundingClientRect()
      return { x: box.x, width: box.width, height: box.height, right: box.right }
    }
    const accountBox = rect(section)
    const titleStyle = getComputedStyle(title)
    const fullPageScrollerCount = [...document.querySelectorAll<HTMLElement>('body *')].filter((node) => {
      const style = getComputedStyle(node)
      return /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1 && node.clientHeight >= innerHeight * 0.8
    }).length
    return {
      width: innerWidth,
      rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      account: accountBox,
      intro: rect(intro),
      title: {
        ...rect(title),
        lineHeight: Number.parseFloat(titleStyle.lineHeight) || Number.parseFloat(titleStyle.fontSize) * 1.2,
      },
      form: rect(form),
      childrenInsideAccount: [...section.querySelectorAll<HTMLElement>('*')].every((child) => {
        const box = (child as HTMLElement).getBoundingClientRect()
        return box.left >= accountBox.x - 1 && box.right <= accountBox.right + 1
      }),
      controlsAtLeast44: [...section.querySelectorAll<HTMLElement>('input, button')].every((control) => control.getBoundingClientRect().height >= 44),
      fullPageScrollerCount,
    }
  })
}

function assertReadableLayout(metrics: LayoutMetrics) {
  expect(metrics.rootOverflow, `root overflow at ${metrics.width}px`).toBeLessThanOrEqual(1)
  expect(metrics.intro.width, `intro width at ${metrics.width}px`).toBeGreaterThanOrEqual(150)
  expect(metrics.title.width, `title width at ${metrics.width}px`).toBeGreaterThanOrEqual(150)
  expect(metrics.title.height, `title wrapping at ${metrics.width}px`).toBeLessThanOrEqual(metrics.title.lineHeight * 2.1)
  expect(metrics.form.width, `form width at ${metrics.width}px`).toBeGreaterThanOrEqual(150)
  expect(metrics.childrenInsideAccount, `account children at ${metrics.width}px`).toBe(true)
  expect(metrics.controlsAtLeast44, `account controls at ${metrics.width}px`).toBe(true)
  expect(metrics.account.x, `account left edge at ${metrics.width}px`).toBeGreaterThanOrEqual(0)
  expect(metrics.account.right, `account right edge at ${metrics.width}px`).toBeLessThanOrEqual(metrics.width + 1)
  expect(metrics.account.height, `account height at ${metrics.width}px`).toBeLessThan(500)
  expect(metrics.fullPageScrollerCount, `nested full-page scrollers at ${metrics.width}px`).toBe(0)
}

async function saveScreenshot(page: Page, state: 'before' | 'after', width: number) {
  if (![390, 601, 1440].includes(width)) return
  await page.screenshot({ path: `test-results/qa-artifacts/cloud-account-${state}-${width}.png`, fullPage: true })
}

async function loadSignedOutAt(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/')
  await expect(page.getByLabel('로그인 이메일')).toBeVisible()
}

test('configured signed-out cloud account stays readable across responsive widths', async ({ page }) => {
  const results: LayoutMetrics[] = []
  for (const width of responsiveWidths) {
    await loadSignedOutAt(page, width)
    await saveScreenshot(page, 'after', width)
    results.push(await measureCloudAccount(page))
  }
  console.log(`CLOUD_ACCOUNT_LAYOUT ${JSON.stringify(results)}`)
  for (const metrics of results) assertReadableLayout(metrics)
})

test('signed-in actions and long account copy remain contained', async ({ page }) => {
  const user = {
    id: 'layout-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'learner-with-an-intentionally-long-address-for-responsive-layout@example.test',
  }
  const session = {
    access_token: 'layout-access-token',
    refresh_token: 'layout-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  }
  const learningState = {
    masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 1,
    dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [],
    favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {},
  }
  const profile = {
    group_id: '11111111-1111-4111-8111-111111111111',
    learning_state: learningState,
    revision: 1,
    updated_at: '2026-09-08T00:00:00.000Z',
  }
  await page.addInitScript((value) => localStorage.setItem('sb-fixture-auth-token', JSON.stringify(value)), session)
  await page.route('https://fixture.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/auth/v1/user') return route.fulfill({ status: 200, json: user })
    if (url.pathname === '/auth/v1/token') return route.fulfill({ status: 200, json: session })
    if (url.pathname === '/rest/v1/learning_group_members') return route.fulfill({ status: 200, json: [{ group_id: profile.group_id, user_id: user.id }] })
    if (url.pathname === '/rest/v1/learning_group_profiles') return route.fulfill({ status: 200, json: [profile] })
    if (url.pathname === '/rest/v1/rpc/update_learning_group_profile') return route.fulfill({ status: 200, json: [{ ...profile, revision: profile.revision + 1 }] })
    return route.fulfill({ status: 404, json: { message: `Unhandled ${request.method()} ${url.pathname}` } })
  })

  for (const width of [320, 601, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const account = page.getByLabel('계정 및 동기화')
    await expect(account).toContainText(user.email)
    await expect(account.getByRole('button', { name: '지금 동기화' })).toBeVisible()
    await expect(account.getByRole('button', { name: '이 기기에서 로그아웃' })).toBeVisible()
    const containment = await account.evaluate((element) => {
      const section = element as HTMLElement
      const box = section.getBoundingClientRect()
      const title = section.querySelector('strong')!.getBoundingClientRect()
      return {
        rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        accountHeight: box.height,
        descendantsInside: [...section.querySelectorAll<HTMLElement>('*')].every((child) => {
          const childBox = child.getBoundingClientRect()
          return childBox.left >= box.left - 1 && childBox.right <= box.right + 1
        }),
        controlsAtLeast44: [...section.querySelectorAll<HTMLElement>('button')].every((control) => control.getBoundingClientRect().height >= 44),
        titleInside: title.left >= box.left - 1 && title.right <= box.right + 1,
      }
    })
    expect(containment.rootOverflow, `signed-in root overflow at ${width}px`).toBeLessThanOrEqual(1)
    expect(containment.accountHeight, `signed-in account height at ${width}px`).toBeLessThan(500)
    expect(containment.descendantsInside, `signed-in descendants at ${width}px`).toBe(true)
    expect(containment.controlsAtLeast44, `signed-in controls at ${width}px`).toBe(true)
    expect(containment.titleInside, `signed-in title at ${width}px`).toBe(true)
  }
})

test('an unbroken status message wraps at the account grid seam', async ({ page }) => {
  for (const width of [320, 601, 768, 1440]) {
    await loadSignedOutAt(page, width)
    await page.getByLabel('계정 및 동기화').locator(':scope > div p').evaluate((node) => {
      node.textContent = `동기화상태${'W'.repeat(96)}`
    })
    const metrics = await measureCloudAccount(page)
    assertReadableLayout(metrics)
  }
})
