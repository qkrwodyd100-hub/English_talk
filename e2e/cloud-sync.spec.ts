import { expect, test, type BrowserContext, type Route } from '@playwright/test'

const cloud = { row: null as null | { user_id: string; learning_state: Record<string, unknown>; revision: number; updated_at: string } }
let optimisticWrites = 0
let insertsUsingUpsert = 0
let profileReadDelayMs = 0
const user = { id: 'user-fixture', aud: 'authenticated', role: 'authenticated', email: 'learner@example.com' }

async function installCloudMock(context: BrowserContext) {
  await context.route('https://fixture.supabase.co/**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/auth/v1/user') return route.fulfill({ status: 200, json: user })
    if (url.pathname === '/auth/v1/token') return route.fulfill({ status: 200, json: sessionPayload() })
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' })
    if (url.pathname === '/auth/v1/otp') return route.fulfill({ status: 200, json: {} })
    if (url.pathname === '/rest/v1/learning_profiles' && request.method() === 'GET') {
      if (profileReadDelayMs) await new Promise((resolve) => setTimeout(resolve, profileReadDelayMs))
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(cloud.row ? [cloud.row] : []) })
    }
    if (url.pathname === '/rest/v1/learning_profiles' && request.method() === 'POST') {
      const prefer = request.headers().prefer ?? ''
      if (prefer.includes('resolution=')) insertsUsingUpsert += 1
      const body = request.postDataJSON() as { user_id: string; learning_state: Record<string, unknown> }
      if (cloud.row && prefer.includes('resolution=ignore-duplicates')) {
        return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: '[]' })
      }
      cloud.row = {
        user_id: body.user_id,
        learning_state: body.learning_state,
        revision: (cloud.row?.revision ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }
      const responseBody = url.searchParams.has('select') ? JSON.stringify([cloud.row]) : ''
      return route.fulfill({ status: 201, headers: { 'content-type': 'application/json', 'preference-applied': prefer.includes('resolution=ignore-duplicates') ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates' }, body: responseBody })
    }
    if (url.pathname === '/rest/v1/learning_profiles' && request.method() === 'PATCH') {
      optimisticWrites += 1
      const expectedRevision = Number(url.searchParams.get('revision')?.replace('eq.', ''))
      if (!cloud.row || cloud.row.revision !== expectedRevision) return route.fulfill({ status: 200, json: [] })
      const body = request.postDataJSON() as { learning_state: Record<string, unknown> }
      cloud.row = { ...cloud.row, learning_state: body.learning_state, revision: cloud.row.revision + 1, updated_at: new Date().toISOString() }
      return route.fulfill({ status: 200, json: [cloud.row] })
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled ${request.method()} ${url.pathname}` } })
  })
}

function sessionPayload() {
  return {
    access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, user,
  }
}

async function authenticate(context: BrowserContext) {
  await context.addInitScript((session) => {
    localStorage.setItem('sb-fixture-auth-token', JSON.stringify(session))
  }, sessionPayload())
}

test.beforeEach(() => { cloud.row = null; optimisticWrites = 0; insertsUsingUpsert = 0; profileReadDelayMs = 0 })

test('restores a session, uploads local v4 data, and reads device B changes in a fresh context', async ({ browser }) => {
  const deviceB = await browser.newContext()
  await installCloudMock(deviceB)
  await authenticate(deviceB)
  const pageB = await deviceB.newPage()
  await pageB.addInitScript(() => localStorage.setItem('english-talk.learning', JSON.stringify({ version: 4, state: {
    masteredIds: ['day-01-01'], customSentences: [], completedChallengeDates: [], selectedDay: 1, dayPositions: {}, completedSentenceIds: ['day-01-01'], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {},
  } })))
  await pageB.goto('/')
  await expect(pageB.getByText('learner@example.com')).toBeVisible()
  await expect(pageB.getByLabel('계정 및 동기화')).toContainText('동기화됨')
  await expect.poll(() => cloud.row?.learning_state.masteredIds).toEqual(['day-01-01'])
  expect(insertsUsingUpsert).toBe(1)

  await pageB.getByRole('button', { name: '내 문장' }).click()
  await pageB.getByRole('button', { name: '문장 추가' }).click()
  await pageB.getByLabel('영어 문장').fill('Device B sentence.')
  await pageB.getByLabel('한국어 뜻').fill('기기 B 문장')
  await pageB.getByRole('button', { name: '저장' }).click()
  await expect.poll(() => (cloud.row?.learning_state.customSentences as unknown[])?.length).toBe(1)
  expect(optimisticWrites).toBeGreaterThan(0)

  const remoteSentence = { id: 'custom-remote', english: 'Remote sentence.', korean: '원격 문장', day: 2, source: 'custom' }
  cloud.row!.learning_state.customSentences = [...cloud.row!.learning_state.customSentences as unknown[], remoteSentence]
  cloud.row!.revision += 1
  await pageB.getByRole('button', { name: '문장 추가' }).click()
  await pageB.getByLabel('영어 문장').fill('Second local sentence.')
  await pageB.getByLabel('한국어 뜻').fill('두 번째 로컬 문장')
  await pageB.getByRole('button', { name: '저장' }).click()
  await expect.poll(() => (cloud.row?.learning_state.customSentences as unknown[])?.length).toBe(3)
  await expect(pageB.getByText('Remote sentence.')).toBeVisible()
  await pageB.getByRole('button', { name: '문장 추가' }).click()
  await pageB.getByLabel('영어 문장').fill('Third local sentence.')
  await pageB.getByLabel('한국어 뜻').fill('세 번째 로컬 문장')
  await pageB.getByRole('button', { name: '저장' }).click()
  await expect.poll(() => (cloud.row?.learning_state.customSentences as unknown[])?.length).toBe(4)
  expect((cloud.row!.learning_state.customSentences as Array<{ id: string }>).map(({ id }) => id)).toContain('custom-remote')

  const deviceA = await browser.newContext()
  await installCloudMock(deviceA)
  await authenticate(deviceA)
  const pageA = await deviceA.newPage()
  await pageA.goto('/')
  await pageA.getByRole('button', { name: '내 문장' }).click()
  await expect(pageA.getByText('Device B sentence.')).toBeVisible()
  await expect.poll(() => pageA.evaluate(() => JSON.parse(localStorage.getItem('english-talk.learning') ?? '{}').state.customSentences.length)).toBe(4)

  await pageA.reload()
  await pageA.getByRole('button', { name: '내 문장' }).click()
  await expect(pageA.getByText('Device B sentence.')).toBeVisible()
  await pageA.getByRole('button', { name: '로그아웃' }).click()
  await expect(pageA.getByLabel('계정 및 동기화')).toContainText('로그아웃')
  await expect(pageA.getByText('Device B sentence.')).not.toBeVisible()
  await expect.poll(() => pageA.evaluate(() => JSON.parse(localStorage.getItem('english-talk.learning') ?? '{}').state.customSentences.length)).toBe(0)

  await deviceA.close()
  await deviceB.close()
})

test('sends a magic link with the current origin and keeps local-only mode available', async ({ page }) => {
  let otpBody: Record<string, unknown> | null = null
  let redirectTo = ''
  await page.route('https://fixture.supabase.co/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/auth/v1/otp') {
      redirectTo = new URL(route.request().url()).searchParams.get('redirect_to') ?? ''
      otpBody = route.request().postDataJSON() as Record<string, unknown>
      return route.fulfill({ status: 200, json: {} })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/')
  await page.getByLabel('로그인 이메일').fill('learner@example.com')
  await page.getByRole('button', { name: '로그인 링크 받기' }).click()
  await expect(page.getByLabel('계정 및 동기화')).toContainText('이메일을 확인')
  expect(otpBody).toMatchObject({ email: 'learner@example.com' })
  expect(redirectTo).toBe('http://127.0.0.1:4174')
})

test('merges two concurrent first-device uploads instead of overwriting either device', async ({ browser }) => {
  profileReadDelayMs = 250
  const deviceA = await browser.newContext()
  const deviceB = await browser.newContext()
  await Promise.all([installCloudMock(deviceA), installCloudMock(deviceB), authenticate(deviceA), authenticate(deviceB)])
  const pageA = await deviceA.newPage()
  const pageB = await deviceB.newPage()
  const installLocalProgress = (page: typeof pageA, id: string) => page.addInitScript((sentenceId) => localStorage.setItem('english-talk.learning', JSON.stringify({ version: 4, state: {
    masteredIds: [sentenceId], customSentences: [], completedChallengeDates: [], selectedDay: 1, dayPositions: {}, completedSentenceIds: [sentenceId], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {},
  } })), id)
  await Promise.all([installLocalProgress(pageA, 'day-01-01'), installLocalProgress(pageB, 'day-01-02')])

  await Promise.all([pageA.goto('/'), pageB.goto('/')])
  await expect(pageA.getByLabel('계정 및 동기화')).toContainText('동기화됨')
  await expect(pageB.getByLabel('계정 및 동기화')).toContainText('동기화됨')
  await expect.poll(() => [...(cloud.row?.learning_state.masteredIds as string[] ?? [])].sort()).toEqual(['day-01-01', 'day-01-02'])

  await deviceA.close()
  await deviceB.close()
})

test('does not apply an old account cloud response after logout', async ({ browser }) => {
  cloud.row = {
    user_id: user.id,
    learning_state: { masteredIds: [], customSentences: [{ id: 'custom-private', english: 'Private cloud sentence.', korean: '비공개', day: 1, source: 'custom' }], completedChallengeDates: [], selectedDay: 1, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {} },
    revision: 2,
    updated_at: new Date().toISOString(),
  }
  profileReadDelayMs = 500
  const context = await browser.newContext()
  await installCloudMock(context)
  await authenticate(context)
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByText('learner@example.com')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: '로그아웃' }).click()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: '내 문장' }).click()
  await expect(page.getByText('Private cloud sentence.')).not.toBeVisible()
  await context.close()
})
