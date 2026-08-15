import { expect, test, type BrowserContext, type Route } from '@playwright/test'

type FixtureUser = { id: string; aud: string; role: string; email: string }
type ProfileRow = { group_id: string; learning_state: Record<string, unknown>; revision: number; updated_at: string }

const groupId = '11111111-1111-4111-8111-111111111111'
const members = new Map([
  ['member-a', groupId],
  ['member-b', groupId],
  ['member-c', groupId],
])
let profile: ProfileRow | null = null
let outsiderProfileRequests = 0

function sessionPayload(user: FixtureUser) {
  return {
    access_token: `fixture-token-${user.id}`,
    refresh_token: `fixture-refresh-${user.id}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  }
}

async function installAuthenticatedGroup(context: BrowserContext, user: FixtureUser) {
  await context.addInitScript(({ session }) => {
    localStorage.setItem('sb-fixture-auth-token', JSON.stringify(session))
  }, { session: sessionPayload(user) })
  await context.route('https://fixture.supabase.co/**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/auth/v1/user') return route.fulfill({ status: 200, json: user })
    if (url.pathname === '/auth/v1/token') return route.fulfill({ status: 200, json: sessionPayload(user) })
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' })

    if (url.pathname === '/rest/v1/learning_group_members' && request.method() === 'GET') {
      const memberGroup = members.get(user.id)
      return route.fulfill({ status: 200, json: memberGroup ? [{ group_id: memberGroup, user_id: user.id }] : [] })
    }
    if (url.pathname === '/rest/v1/learning_group_profiles') {
      if (!members.has(user.id)) {
        outsiderProfileRequests += 1
        return route.fulfill({ status: 403, json: { code: '42501', message: 'row-level security policy' } })
      }
      if (request.method() === 'GET') return route.fulfill({ status: 200, json: profile ? [profile] : [] })
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as { group_id: string; learning_state: Record<string, unknown> }
        profile = { group_id: body.group_id, learning_state: body.learning_state, revision: 1, updated_at: new Date().toISOString() }
        return route.fulfill({ status: 201, json: [profile] })
      }
    }
    if (url.pathname === '/rest/v1/rpc/update_learning_group_profile' && request.method() === 'POST') {
      const body = request.postDataJSON() as { expected_revision: number; next_learning_state: Record<string, unknown> }
      if (!profile || body.expected_revision !== profile.revision) return route.fulfill({ status: 200, json: [] })
      profile = { ...profile, learning_state: body.next_learning_state, revision: profile.revision + 1, updated_at: new Date().toISOString() }
      return route.fulfill({ status: 200, json: [profile] })
    }
    return route.fulfill({ status: 404, json: { message: `Unhandled ${request.method()} ${url.pathname}` } })
  })
}

const users = {
  a: { id: 'member-a', aud: 'authenticated', role: 'authenticated', email: 'member-a@example.test' },
  b: { id: 'member-b', aud: 'authenticated', role: 'authenticated', email: 'member-b@example.test' },
  c: { id: 'member-c', aud: 'authenticated', role: 'authenticated', email: 'member-c@example.test' },
  outsider: { id: 'outsider', aud: 'authenticated', role: 'authenticated', email: 'outsider@example.test' },
}

test.beforeEach(() => { profile = null; outsiderProfileRequests = 0 })

test('three verified accounts share one private group profile while a non-member stays isolated', async ({ browser }) => {
  const contexts = await Promise.all([users.a, users.b, users.c, users.outsider].map(async (user) => {
    const context = await browser.newContext()
    await installAuthenticatedGroup(context, user)
    return context
  }))
  const [contextA, contextB, contextC, outsiderContext] = contexts
  const [pageA, pageB, pageC, outsiderPage] = await Promise.all(contexts.map((context) => context.newPage()))

  await pageA.addInitScript(() => localStorage.setItem('english-talk.learning', JSON.stringify({ version: 4, state: {
    masteredIds: ['day-01-01'], customSentences: [], completedChallengeDates: [], selectedDay: 1, dayPositions: {}, completedSentenceIds: ['day-01-01'], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {},
  } })))
  await pageA.goto('/')
  await expect.poll(() => profile?.learning_state.masteredIds).toEqual(['day-01-01'])

  await pageB.goto('/')
  await expect.poll(() => pageB.evaluate(() => JSON.parse(localStorage.getItem('english-talk.learning') ?? '{}').state.masteredIds)).toEqual(['day-01-01'])
  await pageB.getByRole('button', { name: '내 문장' }).click()
  await pageB.getByRole('button', { name: '문장 추가' }).click()
  await pageB.getByLabel('영어 문장').fill('Shared group sentence.')
  await pageB.getByLabel('한국어 뜻').fill('공유 그룹 문장')
  await pageB.getByRole('button', { name: '저장' }).click()
  await expect.poll(() => (profile?.learning_state.customSentences as unknown[])?.length).toBe(1)

  await pageA.getByRole('button', { name: '지금 동기화' }).click()
  await pageA.getByRole('button', { name: '내 문장' }).click()
  await expect(pageA.getByText('Shared group sentence.')).toBeVisible()
  await pageC.goto('/')
  await pageC.getByRole('button', { name: '내 문장' }).click()
  await expect(pageC.getByText('Shared group sentence.')).toBeVisible()

  await outsiderPage.goto('/')
  await expect(outsiderPage.getByLabel('계정 및 동기화')).toContainText('공유 그룹에 등록되지 않은 계정')
  expect(outsiderProfileRequests).toBe(0)

  await pageC.getByRole('button', { name: '로그아웃' }).click()
  await expect(pageC.getByLabel('계정 및 동기화')).toContainText('로그아웃')
  await expect(pageC.getByText('Shared group sentence.')).not.toBeVisible()
  await expect.poll(() => pageC.evaluate(() => localStorage.getItem('english-talk.learning.sync-meta'))).toBeNull()

  await Promise.all(contexts.map((context) => context.close()))
})
