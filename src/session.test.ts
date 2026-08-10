import { describe, expect, it } from 'vitest'
import { advanceScenario, createSession, makeSummary, parseStoredSessions } from './session'

describe('scripted conversation session', () => {
  it('requires two learner turns before it can be completed', () => {
    const session = createSession({ goal: 'travel', difficulty: 'beginner', scenario: 'cafe' })
    const firstTurn = advanceScenario(session, 'Hi, can I have a coffee?')

    expect(firstTurn.session.messages).toHaveLength(2)
    expect(firstTurn.canComplete).toBe(false)

    const secondTurn = advanceScenario(firstTurn.session, 'I would like it to go, please.')
    expect(secondTurn.session.messages).toHaveLength(4)
    expect(secondTurn.canComplete).toBe(true)
  })

  it('creates a useful deterministic summary and rejects incompatible storage payloads', () => {
    const session = createSession({ goal: 'travel', difficulty: 'beginner', scenario: 'cafe' })
    const firstTurn = advanceScenario(session, 'Hello!')
    const completed = advanceScenario(firstTurn.session, 'That is all, thank you.')
    const summary = makeSummary(completed.session)

    expect(summary.turnCount).toBe(2)
    expect(summary.expressions).toContain('I would like')
    expect(parseStoredSessions('{"version":999,"sessions":[]}')).toEqual([])
  })
})
