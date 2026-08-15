import { expect, test, type BrowserContext, type Route } from '@playwright/test'

const groupId = '11111111-1111-4111-8111-111111111111'
const cloud = { row: null as null | { group_id: string; learning_state: Record<string, unknown>; revision: number; updated_at: string } }
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
    if (url.pathname === '/rest/v1/learning_group_members' && request.method() === 'GET') return route.fulfill({ status: 200, json: [{ group_id: groupId, user_id: user.id }] })
    if (url.pathname === '/rest/v1/learning_group_profiles' && request.method() === 'GET') {
      if (profileReadDelayMs) await new Promise((resolve) => setTimeout(resolve, profileReadDelayMs))
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(cloud.row ? [cloud.row] : []) })
    }
    if (url.pathname === '/rest/v1/learning_group_profiles' && request.method() === 'POST') {
      const prefer = request.headers().prefer ?? ''
      if (prefer.includes('resolution=')) insertsUsingUpsert += 1
      const body = request.postDataJSON() as { group_id: string; learning_state: Record<string, unknown> }
      if (cloud.row && prefer.includes('resolution=ignore-duplicates')) {
        return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: '[]' })
      }
      cloud.row = {
        group_id: body.group_id,
        learning_state: body.learning_state,
        revision: (cloud.row?.revision ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }
      const responseBody = url.searchParams.has('select') ? JSON.stringify([cloud.row]) : ''
      return route.fulfill({ status: 201, headers: { 'content-type': 'application/json', 'preference-applied': prefer.includes('resolution=ignore-duplicates') ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates' }, body: responseBody })
    }
    if (url.pathname === '/rest/v1/rpc/update_learning_group_profile' && request.method() === 'POST') {
      optimisticWrites += 1
      const body = request.postDataJSON() as { expected_revision: number; next_learning_state: Record<string, unknown> }
      const expectedRevision = body.expected_revision
      if (!cloud.row || cloud.row.revision !== expectedRevision) return route.fulfill({ status: 200, json: [] })
      cloud.row = { ...cloud.row, learning_state: body.next_learning_state, revision: cloud.row.revision + 1, updated_at: new Date().toISOString() }
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

test('an already-open device can pull another device change with sync now', async ({ browser }) => {
  const deviceA = await browser.newContext()
  const deviceB = await browser.newContext()
  await Promise.all([installCloudMock(deviceA), installCloudMock(deviceB), authenticate(deviceA), authenticate(deviceB)])
  const pageA = await deviceA.newPage()
  const pageB = await deviceB.newPage()
  await pageA.addInitScript(() => localStorage.setItem('english-talk.learning', JSON.stringify({ version: 4, state: {
    masteredIds: ['day-01-01'], customSentences: [], completedChallengeDates: [], selectedDay: 1, dayPositions: {}, completedSentenceIds: ['day-01-01'], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {},
  } })))

  await pageA.goto('/')
  await expect.poll(() => cloud.row?.learning_state.masteredIds).toEqual(['day-01-01'])
  await pageB.goto('/')
  await pageB.getByRole('button', { name: '내 문장' }).click()
  await pageB.getByRole('button', { name: '문장 추가' }).click()
  await pageB.getByLabel('영어 문장').fill('Added on device B.')
  await pageB.getByLabel('한국어 뜻').fill('기기 B에서 추가')
  await pageB.getByRole('button', { name: '저장' }).click()
  await expect.poll(() => (cloud.row?.learning_state.customSentences as unknown[])?.length).toBe(1)

  await pageA.getByRole('button', { name: '지금 동기화' }).click()
  await pageA.getByRole('button', { name: '내 문장' }).click()
  await expect(pageA.getByText('Added on device B.')).toBeVisible()
  await expect(pageA.getByLabel('계정 및 동기화')).toContainText('마지막 성공')

  await deviceA.close()
  await deviceB.close()
})

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
  await expect(page.getByLabel('계정 및 동기화')).toContainText('링크를 연 기기에 로그인 세션이 생성됩니다')
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
    group_id: groupId,
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

test('does not render learning data while an expired signed-out session is still resolving', async ({ page }) => {
  await page.route('https://fixture.supabase.co/auth/v1/token**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    await route.fulfill({ status: 400, json: { error: 'invalid_grant' } })
  })
  await page.addInitScript(({ session, local, privateState }) => {
    localStorage.setItem('sb-fixture-auth-token', JSON.stringify(session))
    localStorage.setItem('english-talk.learning.pre-auth', JSON.stringify({ version: 4, state: local }))
    localStorage.setItem('english-talk.learning', JSON.stringify({ version: 4, state: privateState }))
  }, {
    session: { ...sessionPayload(), expires_at: 1 },
    local: { masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 1, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {} },
    privateState: { masteredIds: ['day-01-01'], customSentences: [], completedChallengeDates: [], selectedDay: 1, dayPositions: {}, completedSentenceIds: ['day-01-01'], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {} },
  })

  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('로그인 상태 확인 중…')
  await expect(page.getByLabel('학습 현황')).not.toBeVisible()
})

test('restores the signed-out snapshot after a cold session loss without retaining account data in backups', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as typeof window & { __privateColdStartRendered?: boolean }).__privateColdStartRendered = false
    new MutationObserver((mutations) => {
      if (mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.textContent?.includes('Private cold-start sentence.')))) {
        ;(window as typeof window & { __privateColdStartRendered?: boolean }).__privateColdStartRendered = true
      }
    }).observe(document, { childList: true, subtree: true })
    const localState = {
      masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 1, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {},
    }
    const privateState = {
      ...localState,
      customSentences: [{ id: 'custom-private-cold-start', english: 'Private cold-start sentence.', korean: '비공개', day: 1, source: 'custom' }],
      completedSentenceIds: Array.from({ length: 10 }, (_, index) => `day-01-${String(index + 1).padStart(2, '0')}`),
    }
    localStorage.setItem('english-talk.learning.pre-auth', JSON.stringify({ version: 4, state: localState }))
    localStorage.setItem('english-talk.learning', JSON.stringify({ version: 4, state: privateState }))
    localStorage.setItem('english-talk.learning.backup', JSON.stringify({ version: 4, state: privateState }))
  })

  await page.goto('/')
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __privateColdStartRendered?: boolean }).__privateColdStartRendered)).toBe(false)
  await page.getByRole('button', { name: '내 문장' }).click()
  await expect(page.getByText('Private cold-start sentence.')).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('english-talk.learning') ?? '{}').state.customSentences)).toEqual([])
  await expect.poll(() => page.evaluate(() => localStorage.getItem('english-talk.learning.pre-auth'))).toBeNull()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('english-talk.learning.backup'))).toBeNull()
})

test('keeps debounced edits account-scoped across a direct authenticated account switch', async ({ page }) => {
  const emptyState = {
    masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 1, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {},
  }
  const usersByToken = {
    'token-a': { id: 'account-a', aud: 'authenticated', role: 'authenticated', email: 'account-a@example.test' },
    'token-b': { id: 'account-b', aud: 'authenticated', role: 'authenticated', email: 'account-b@example.test' },
  }
  const groupsByUser = { 'account-a': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'account-b': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }
  const profiles = new Map(Object.values(groupsByUser).map((id) => [id, { group_id: id, learning_state: structuredClone(emptyState), revision: 1, updated_at: '2026-08-15T00:00:00.000Z' }]))
  const sessionFor = (token: keyof typeof usersByToken) => ({ access_token: token, refresh_token: `refresh-${token}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: usersByToken[token] })

  await page.route('https://fixture.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const token = request.headers().authorization?.replace(/^Bearer /, '') as keyof typeof usersByToken
    const activeUser = usersByToken[token]
    if (url.pathname === '/auth/v1/user') return route.fulfill({ status: activeUser ? 200 : 401, json: activeUser ?? { message: 'invalid session' } })
    if (url.pathname === '/rest/v1/learning_group_members' && activeUser) {
      return route.fulfill({ status: 200, json: [{ group_id: groupsByUser[activeUser.id as keyof typeof groupsByUser], user_id: activeUser.id }] })
    }
    if (url.pathname === '/rest/v1/learning_group_profiles' && request.method() === 'GET' && activeUser) {
      const group = groupsByUser[activeUser.id as keyof typeof groupsByUser]
      return route.fulfill({ status: 200, json: [profiles.get(group)] })
    }
    if (url.pathname === '/rest/v1/rpc/update_learning_group_profile' && request.method() === 'POST' && activeUser) {
      const body = request.postDataJSON() as { target_group_id: string; expected_revision: number; next_learning_state: Record<string, unknown> }
      const current = profiles.get(body.target_group_id)!
      if (current.revision !== body.expected_revision) return route.fulfill({ status: 200, json: [] })
      const updated = { ...current, learning_state: body.next_learning_state, revision: current.revision + 1, updated_at: new Date().toISOString() }
      profiles.set(body.target_group_id, updated)
      return route.fulfill({ status: 200, json: [updated] })
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled ${request.method()} ${url.pathname}` } })
  })

  await page.addInitScript(({ session, local, dirty }) => {
    if (localStorage.getItem('account-switch-fixture-installed')) return
    localStorage.setItem('account-switch-fixture-installed', 'true')
    localStorage.setItem('sb-fixture-auth-token', JSON.stringify(session))
    localStorage.setItem('english-talk.learning.pre-auth', JSON.stringify({ version: 4, state: local }))
    localStorage.setItem('english-talk.learning', JSON.stringify({ version: 4, state: dirty }))
    localStorage.setItem('english-talk.learning.sync-meta', JSON.stringify({ userId: 'account-a', revision: 1, updatedAt: '2026-08-15T00:00:00.000Z', baseState: local }))
  }, {
    session: sessionFor('token-b'),
    local: emptyState,
    dirty: { ...emptyState, customSentences: [{ id: 'custom-pending-a', english: 'Pending account A sentence.', korean: 'A 계정', day: 1, source: 'custom' }] },
  })

  await page.goto('/')
  await expect(page.getByText('account-b@example.test')).toBeVisible()
  await page.getByRole('button', { name: '내 문장' }).click()
  await expect(page.getByText('Pending account A sentence.')).not.toBeVisible()
  expect(profiles.get(groupsByUser['account-b'])?.learning_state.customSentences).toEqual([])
  await expect.poll(() => page.evaluate(() => localStorage.getItem('english-talk.learning.pending.account-a'))).not.toBeNull()

  await page.evaluate((session) => localStorage.setItem('sb-fixture-auth-token', JSON.stringify(session)), sessionFor('token-a'))
  await page.reload()
  await expect(page.getByText('account-a@example.test')).toBeVisible()
  await expect.poll(() => profiles.get(groupsByUser['account-a'])?.learning_state.customSentences).toEqual([
    { id: 'custom-pending-a', english: 'Pending account A sentence.', korean: 'A 계정', day: 1, source: 'custom' },
  ])
  await expect.poll(() => page.evaluate(() => localStorage.getItem('english-talk.learning.pending.account-a'))).toBeNull()
})
