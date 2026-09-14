import { expect, test, type Page, type Route } from '@playwright/test'

const groupId = '11111111-1111-4111-8111-111111111111'
const user = { id: 'password-user-fixture', aud: 'authenticated', role: 'authenticated', email: 'password-user@example.test' }
const session = {
  access_token: 'fixture-password-access-token', refresh_token: 'fixture-password-refresh-token', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, user,
}
const emptyState = {
  masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 1, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {},
}

async function installAuthenticatedRoutes(page: Page, onRoute?: (route: Route) => Promise<boolean>) {
  await page.route('https://fixture.supabase.co/**', async (route) => {
    if (onRoute && await onRoute(route)) return
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname === '/auth/v1/user') return route.fulfill({ status: 200, json: user })
    if (pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' })
    if (pathname === '/rest/v1/learning_group_members') return route.fulfill({ status: 200, json: [{ group_id: groupId, user_id: user.id }] })
    if (pathname === '/rest/v1/learning_group_profiles') return route.fulfill({ status: 200, json: [{ group_id: groupId, learning_state: emptyState, revision: 7, updated_at: '2026-09-14T00:00:00.000Z' }] })
    return route.fulfill({ status: 404, json: { message: `Unhandled ${request.method()} ${pathname}` } })
  })
}

async function authenticate(page: Page) {
  await page.addInitScript((value) => localStorage.setItem('sb-fixture-auth-token', JSON.stringify(value)), session)
}

test('uses password login as the primary signed-out path and never persists the password', async ({ page }) => {
  let loginBody: Record<string, unknown> | null = null
  await installAuthenticatedRoutes(page, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      loginBody = request.postDataJSON() as Record<string, unknown>
      await route.fulfill({ status: 200, json: session })
      return true
    }
    return false
  })

  await page.goto('/')
  await expect(page.getByRole('button', { name: '이메일로 로그인' })).toBeVisible()
  await expect(page.getByRole('button', { name: /로그인 링크/ })).toHaveCount(0)
  await page.getByLabel('로그인 이메일').fill('password-user@example.test')
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password-123')
  await page.getByRole('button', { name: '이메일로 로그인' }).click()

  await expect(page.getByText('password-user@example.test')).toBeVisible()
  expect(loginBody).toMatchObject({ email: 'password-user@example.test', password: 'fixture-password-123' })
  expect(await page.evaluate(() => Object.values(localStorage).some((value) => value.includes('fixture-password-123')))).toBe(false)
})

test('supports explicit signup and a non-enumerating password reset request', async ({ page }) => {
  let signupBody: Record<string, unknown> | null = null
  let resetBody: Record<string, unknown> | null = null
  await page.route('https://fixture.supabase.co/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname === '/auth/v1/signup') {
      signupBody = request.postDataJSON() as Record<string, unknown>
      return route.fulfill({ status: 200, json: { user: { ...user, identities: [] }, session: null } })
    }
    if (pathname === '/auth/v1/recover') {
      resetBody = request.postDataJSON() as Record<string, unknown>
      return route.fulfill({ status: 200, json: {} })
    }
    return route.fulfill({ status: 404, json: {} })
  })

  await page.goto('/')
  await page.getByRole('button', { name: '회원가입' }).click()
  await page.getByLabel('가입 이메일').fill('new-user@example.test')
  await page.getByLabel('새 비밀번호', { exact: true }).fill('signup-password-123')
  await page.getByLabel('새 비밀번호 확인').fill('signup-password-123')
  await page.getByRole('button', { name: '가입 요청' }).click()
  await expect(page.getByRole('status')).toContainText('가입 또는 로그인 준비 이메일')
  expect(signupBody).toMatchObject({ email: 'new-user@example.test', password: 'signup-password-123' })

  await page.getByRole('button', { name: '비밀번호를 잊었나요?' }).click()
  await page.getByLabel('복구 이메일').fill('unknown@example.test')
  await page.getByRole('button', { name: '재설정 이메일 보내기' }).click()
  await expect(page.getByRole('status')).toContainText('계정이 있는 경우')
  expect(resetBody).toMatchObject({ email: 'unknown@example.test' })
})

test('lets an authenticated Magic-Link-created account safely set or change a password', async ({ page }) => {
  let updateBody: Record<string, unknown> | null = null
  await authenticate(page)
  await installAuthenticatedRoutes(page, async (route) => {
    const request = route.request()
    if (new URL(request.url()).pathname === '/auth/v1/user' && request.method() === 'PUT') {
      updateBody = request.postDataJSON() as Record<string, unknown>
      await route.fulfill({ status: 200, json: { user } })
      return true
    }
    return false
  })

  await page.goto('/')
  await page.getByRole('button', { name: '비밀번호 설정 또는 변경' }).click()
  await page.getByLabel('새 비밀번호', { exact: true }).fill('replacement-password-123')
  await page.getByLabel('새 비밀번호 확인').fill('replacement-password-123')
  await page.getByRole('button', { name: '새 비밀번호 저장' }).click()

  await expect(page.getByRole('status')).toContainText('비밀번호를 저장했습니다')
  expect(updateBody).toMatchObject({ password: 'replacement-password-123' })
  expect(await page.evaluate(() => Object.values(localStorage).some((value) => value.includes('replacement-password-123')))).toBe(false)
})

test('opens the new-password screen for an authenticated recovery session', async ({ page }) => {
  let updateBody: Record<string, unknown> | null = null
  await authenticate(page)
  await installAuthenticatedRoutes(page, async (route) => {
    const request = route.request()
    if (new URL(request.url()).pathname === '/auth/v1/user' && request.method() === 'PUT') {
      updateBody = request.postDataJSON() as Record<string, unknown>
      await route.fulfill({ status: 200, json: { user } })
      return true
    }
    return false
  })

  await page.goto('/?password-recovery=1')
  await expect(page.getByText('새 비밀번호를 설정하세요')).toBeVisible()
  await page.getByLabel('새 비밀번호', { exact: true }).fill('recovered-password-123')
  await page.getByLabel('새 비밀번호 확인').fill('recovered-password-123')
  await page.getByRole('button', { name: '새 비밀번호 저장' }).click()

  await expect(page.getByRole('status')).toContainText('비밀번호를 저장했습니다')
  expect(updateBody).toMatchObject({ password: 'recovered-password-123' })
  expect(page.url()).not.toContain('password-recovery')
})

test('shows provider errors in Korean and unlocks the form after failure', async ({ page }) => {
  await page.route('https://fixture.supabase.co/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/auth/v1/token') return route.fulfill({ status: 400, json: { code: 'invalid_credentials', message: 'Invalid login credentials' } })
    return route.fulfill({ status: 404, json: {} })
  })

  await page.goto('/')
  await page.getByLabel('로그인 이메일').fill('unknown@example.test')
  await page.getByLabel('비밀번호', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: '이메일로 로그인' }).click()
  await expect(page.getByRole('status')).toContainText('이메일 또는 비밀번호를 확인')
  await expect(page.getByRole('button', { name: '이메일로 로그인' })).toBeEnabled()
})
