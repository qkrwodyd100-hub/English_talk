import { describe, expect, it } from 'vitest'
import {
  advanceTutorSession,
  createTutorSession,
  matchAcceptGroup,
  tutorScenarios,
  tutorSummary,
} from './tutor-engine'
import { builtInSentences } from './sentences'

const cafe = tutorScenarios.find((scenario) => scenario.id === 'cafe-order')!

describe('tutor keyword branching (phase 2 scripted tutor)', () => {
  it('matches whole-word keyword groups, not substrings', () => {
    const greet = cafe.steps[0]
    expect(matchAcceptGroup(greet, 'Hello there!')).not.toBeNull()
    // "hell" alone must not match "hello"
    expect(matchAcceptGroup(greet, 'hell')).toBeNull()
    expect(matchAcceptGroup(greet, '')).toBeNull()
  })

  it('handles contractions like the quiz judge does', () => {
    const togo = cafe.steps[3]
    expect(matchAcceptGroup(togo, 'To go please')).not.toBeNull()
  })

  it('advances through a full cafe order on matching input', () => {
    let session = createTutorSession(cafe)
    expect(session.turns).toHaveLength(1)
    const inputs = ['Hi!', 'An iced americano please', 'A medium please', 'To go please', 'Yes, a cookie please', 'Yes, all to go please', 'That is all, thank you']
    for (const input of inputs) {
      const result = advanceTutorSession(cafe, session, input)
      expect(result.matched).toBe(true)
      session = result.session
    }
    expect(session.done).toBe(true)
    expect(session.turns.filter((turn) => turn.speaker === 'learner')).toHaveLength(7)
  })

  it('repairs once, then reveals the model answer and moves on', () => {
    let session = createTutorSession(cafe)
    const first = advanceTutorSession(cafe, session, 'I want pizza')
    expect(first.matched).toBe(false)
    expect(first.assisted).toBe(false)
    const second = advanceTutorSession(cafe, first.session, 'Pizza pizza pizza')
    expect(second.matched).toBe(false)
    expect(second.assisted).toBe(true)
    expect(second.coachReply).toContain('Hello! An iced americano, please.')
    expect(second.session.stepIndex).toBe(1)
    expect(second.session.assistedSteps).toEqual(['cafe-greet'])
  })

  it('asks again on empty input without advancing', () => {
    const session = createTutorSession(cafe)
    const result = advanceTutorSession(cafe, session, '   ')
    expect(result.matched).toBe(false)
    expect(result.session.stepIndex).toBe(0)
    expect(result.session.turns).toHaveLength(1)
  })

  it('every scenario has matching opener/steps and a full summary', () => {
    for (const scenario of tutorScenarios) {
      expect(scenario.steps.length).toBeGreaterThanOrEqual(4)
      let session = createTutorSession(scenario)
      // Walk through with model answers — every model answer must pass its step.
      for (const step of scenario.steps) {
        const result = advanceTutorSession(scenario, session, step.modelAnswer)
        expect(result.matched).toBe(true)
        session = result.session
      }
      expect(session.done).toBe(true)
      const summary = tutorSummary(scenario, session)
      expect(summary.covered).toHaveLength(scenario.steps.length)
    }
  })

  it('every reviewSentenceId points at a real built-in sentence', () => {
    const known = new Set(builtInSentences.map((sentence) => sentence.id))
    for (const scenario of tutorScenarios) {
      for (const id of scenario.reviewSentenceIds) {
        expect(known.has(id)).toBe(true)
      }
    }
  })

  it('scenario and step ids are unique', () => {
    expect(new Set(tutorScenarios.map((s) => s.id)).size).toBe(tutorScenarios.length)
    for (const scenario of tutorScenarios) {
      expect(new Set(scenario.steps.map((s) => s.id)).size).toBe(scenario.steps.length)
    }
  })
})
