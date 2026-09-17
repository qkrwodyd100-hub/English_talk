import { describe, expect, it } from 'vitest'
import { builtInDialogues } from './dialogues'
import { builtInSentences } from './sentences'
import {
  clampDailyCount,
  getTodayChallenge,
  MAX_COURSE_DAY,
  parseLearningState,
} from './learning'
import {
  createSequentialLearningState,
  getDailyPracticeSet,
  getResumeTarget,
  getReviewChallenge,
  getSequentialDayChallenge,
  gradeShadowingAttempt,
  recordAttempt,
  type SequentialLearningState,
} from './learning-engine'
import { createListeningPlaylist, parseListeningPreferences } from './listening-engine'

function state(overrides: Partial<SequentialLearningState> = {}): SequentialLearningState {
  return { ...createSequentialLearningState(), ...overrides }
}

describe('Day 61-75 advanced pack (issue #7)', () => {
  it('extends the course to 75 days with ten new sentences per day', () => {
    expect(MAX_COURSE_DAY).toBe(75)
    for (let day = 61; day <= 75; day += 1) {
      expect(builtInSentences.filter((sentence) => sentence.day === day)).toHaveLength(10)
    }
  })

  it('covers the requested topic groups without overlapping the first 60 days', () => {
    const topics = (day: number) => [...new Set(builtInSentences.filter((sentence) => sentence.day === day).map((sentence) => sentence.topic))]
    expect(topics(61)).toEqual(['airport-transit-advanced'])
    expect(topics(62)).toEqual(['airport-transit-advanced'])
    expect(topics(63)).toEqual(['urban-transit-advanced'])
    expect(topics(65)).toEqual(['restaurant-bar-advanced'])
    expect(topics(68)).toEqual(['golf-course-basics'])
    expect(topics(71)).toEqual(['department-store-advanced'])
    expect(topics(73)).toEqual(['daily-life-integration'])
    const legacyTopics = new Set(builtInSentences.filter((sentence) => sentence.day <= 60).map((sentence) => sentence.topic))
    for (const topic of ['airport-transit-advanced', 'urban-transit-advanced', 'restaurant-bar-advanced', 'golf-course-basics', 'department-store-advanced', 'daily-life-integration']) {
      expect(legacyTopics.has(topic)).toBe(false)
    }
  })

  it('mixes beginner, intermediate, and advanced levels with alternatives on every new day group', () => {
    for (let day = 61; day <= 75; day += 1) {
      const levels = new Set(builtInSentences.filter((sentence) => sentence.day === day).map((sentence) => sentence.level))
      expect([...levels].sort()).toEqual(['advanced', 'beginner', 'intermediate'])
    }
    const withAlternatives = builtInSentences.filter((sentence) => sentence.day >= 61 && (sentence.alternatives?.length ?? 0) > 0)
    expect(withAlternatives.length).toBeGreaterThanOrEqual(20)
  })

  it('adds one mini dialogue per new day whose topic matches the day', () => {
    for (let day = 61; day <= 75; day += 1) {
      const dialogue = builtInDialogues.find((item) => item.day === day)
      expect(dialogue).toBeDefined()
      expect(dialogue!.topic).toBe(builtInSentences.find((sentence) => sentence.day === day)?.topic)
      expect(dialogue!.turns.some((turn) => turn.role === 'traveler')).toBe(true)
    }
  })
})

describe('75-day engine guards (issue #7)', () => {
  it('keeps Day 75 in persisted learning state and drops Day 76', () => {
    expect(parseLearningState(JSON.stringify({ version: 4, state: { selectedDay: 75, dayPositions: { 75: 3 } } }))).toMatchObject({ selectedDay: 75, dayPositions: { 75: 3 } })
    expect(parseLearningState(JSON.stringify({ version: 4, state: { selectedDay: 76, dayPositions: { 76: 3 } } }))).toMatchObject({ selectedDay: null, dayPositions: {} })
  })

  it('keeps Day 75 in listening preferences and drops Day 76', () => {
    expect(parseListeningPreferences(JSON.stringify({ selectedDays: [74, 75, 76] }))).toMatchObject({ selectedDays: [74, 75] })
    expect(createListeningPlaylist(builtInSentences, [75], false)).toHaveLength(10)
  })

  it('serves the Day 75 challenge and rejects Day 76', () => {
    expect(getSequentialDayChallenge(builtInSentences, state(), 75).map((sentence) => sentence.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `day-75-${String(index + 1).padStart(2, '0')}`),
    )
    expect(getSequentialDayChallenge(builtInSentences, state(), 76)).toEqual([])
  })
})

describe('listening-first learning improvements (issue #7)', () => {
  it('builds 12-15 sentence daily sets from the current Day, then review queue, then following Days', () => {
    const twelve = getDailyPracticeSet(builtInSentences, state(), 61, 12)
    expect(twelve).toHaveLength(12)
    expect(twelve.slice(0, 10).map((sentence) => sentence.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `day-61-${String(index + 1).padStart(2, '0')}`),
    )
    expect(twelve[10].day).toBe(62)

    const fifteen = getDailyPracticeSet(builtInSentences, state(), 61, 15)
    expect(fifteen).toHaveLength(15)
    expect(new Set(fifteen.map((sentence) => sentence.id)).size).toBe(15)
  })

  it('fills extra daily slots from the review queue without duplicates', () => {
    const queued = state({ selectedDay: 61, reviewQueueIds: ['day-63-01'] })
    const set = getDailyPracticeSet(builtInSentences, queued, 61, 12)
    expect(set).toHaveLength(12)
    expect(set.map((sentence) => sentence.id)).toContain('day-63-01')
    expect(new Set(set.map((sentence) => sentence.id)).size).toBe(12)
  })

  it('re-presents incorrect attempts in persisted queue order', () => {
    const queued = state({ reviewQueueIds: ['day-62-03', 'day-61-01'] })
    expect(getReviewChallenge(builtInSentences, queued, 10).map((sentence) => sentence.id)).toEqual(['day-62-03', 'day-61-01'])
    expect(getReviewChallenge(builtInSentences, queued, 1).map((sentence) => sentence.id)).toEqual(['day-62-03'])
  })

  it('grades shadowing transcripts with the same judgment as typed answers', () => {
    const sentence = builtInSentences.find((item) => item.id === 'day-61-01')!
    expect(gradeShadowingAttempt(sentence, 'My connecting flight leaves from a different terminal.')).toMatchObject({ isCorrect: true })
    expect(gradeShadowingAttempt(sentence, 'Something completely different.')).toMatchObject({ isCorrect: false })
  })

  it('supports 10, 12, and 15 sentence daily volumes', () => {
    expect(clampDailyCount(10)).toBe(10)
    expect(clampDailyCount(12)).toBe(12)
    expect(clampDailyCount(15)).toBe(15)
    expect(clampDailyCount(11)).toBe(10)
    expect(clampDailyCount('twelve')).toBe(10)
    expect(getTodayChallenge(builtInSentences)).toHaveLength(10)
    expect(getTodayChallenge(builtInSentences, new Date(), 15)).toHaveLength(15)
  })

  it('carries unsolved sentences over when advancing past Day end', () => {
    const sentence = builtInSentences.find((item) => item.id === 'day-61-01')!
    const after = recordAttempt(state({ selectedDay: 61, dayPositions: { 62: 4 } }), { sentence, position: 0, judgment: { kind: 'exact', isCorrect: true } })
    expect(after.dayPositions).toMatchObject({ 61: 1, 62: 4 })
    expect(getResumeTarget(builtInSentences, after)).toEqual({ day: 61, position: 1, isCourseComplete: false })
  })
})
