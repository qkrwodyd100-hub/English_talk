import { describe, expect, it } from 'vitest'
import { formatStudyDate, formatStudyTimestamp, getStudySummary, getTodayChallenge, getWordFeedback, normalizeAnswer, parseLearningState, recordStudyActivity, type Sentence } from './learning'

const sentences: Sentence[] = [
  { id: 'fixture-1', english: 'I would like a cup of tea.', korean: '차 한 잔 주세요.', day: 1, source: 'builtIn', topic: 'cafe-orders', level: 'beginner', priority: 1 },
  { id: 'fixture-2', english: 'Could you help me?', korean: '도와주실 수 있나요?', day: 2, source: 'builtIn', topic: 'asking-for-help', level: 'beginner', priority: 1 },
  { id: 'fixture-3', english: 'Where is the station?', korean: '역이 어디에 있나요?', day: 3, source: 'builtIn', topic: 'asking-for-directions', level: 'beginner', priority: 1 },
]

describe('learning helpers', () => {
  it('selects a stable daily challenge and cycles when fewer than ten sentences exist', () => {
    expect(getTodayChallenge(sentences, new Date('2026-08-10T12:00:00'))).toHaveLength(10)
    expect(getTodayChallenge(sentences, new Date('2026-08-10T12:00:00')).map((sentence) => sentence.id)).toEqual(
      getTodayChallenge(sentences, new Date('2026-08-10T12:00:00')).map((sentence) => sentence.id),
    )
  })

  it('ignores case and punctuation while identifying missing and mistyped words', () => {
    expect(normalizeAnswer(' I WOULD like a cup of tea! ')).toBe('i would like a cup of tea')
    expect(getWordFeedback('I would like a cup of tea.', 'I would love cup tea.')).toEqual([
      { word: 'I', status: 'correct' },
      { word: 'would', status: 'correct' },
      { word: 'like', status: 'missing' },
      { word: 'a', status: 'missing' },
      { word: 'cup', status: 'correct' },
      { word: 'of', status: 'missing' },
      { word: 'tea', status: 'correct' },
    ])
  })

  it('migrates v1 persisted learning state without losing legacy and sequential data', () => {
    expect(parseLearningState(JSON.stringify({
      version: 1,
      state: {
        masteredIds: ['fixture-1'],
        customSentences: [{ id: 'custom-1', english: 'Hello.', korean: '안녕하세요.', day: 1, source: 'custom' }],
        completedChallengeDates: ['2026-08-10'],
        selectedDay: 2,
        reviewQueueIds: ['fixture-2'],
        favoriteIds: ['fixture-1'],
      },
    }))).toEqual({
      masteredIds: ['fixture-1'],
      customSentences: [{ id: 'custom-1', english: 'Hello.', korean: '안녕하세요.', day: 1, source: 'custom' }],
      completedChallengeDates: ['2026-08-10'],
      selectedDay: 2,
      dayPositions: {},
      completedSentenceIds: [],
      attemptCounts: {},
      reviewQueueIds: ['fixture-2'],
      favoriteIds: ['fixture-1'],
      studyActivities: [],
    })
  })

  it('formats Korean study timestamps with the browser timezone formatter', () => {
    expect(formatStudyTimestamp('2026-08-12T04:47:00.000Z', 'Asia/Seoul')).toBe('2026. 8. 12.(수) 13:47')
    expect(formatStudyDate('2026-08-12T04:47:00.000Z', 'Asia/Seoul')).toBe('2026. 8. 12.(수)')
  })

  it('falls back safely when persisted learning state is corrupt or incompatible', () => {
    expect(parseLearningState('{"version":999}')).toEqual({ masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: null, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [] })
    expect(parseLearningState('not-json')).toEqual({ masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: null, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [] })
  })

  it('migrates v2 data, records only distinct study actions, and calculates calendar-day streaks', () => {
    const migrated = parseLearningState(JSON.stringify({
      version: 2,
      state: { masteredIds: ['fixture-1'], customSentences: [], completedChallengeDates: [], selectedDay: 2, dayPositions: { 2: 1 }, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: ['fixture-2'], favoriteIds: ['fixture-3'] },
    }))
    expect(migrated).toMatchObject({ masteredIds: ['fixture-1'], selectedDay: 2, reviewQueueIds: ['fixture-2'], favoriteIds: ['fixture-3'], studyActivities: [] })

    const first = recordStudyActivity(migrated, { timestamp: '2026-08-11T12:00:00', day: 2, sentenceId: 'fixture-2', action: 'answer-checked', correct: true })
    const duplicate = recordStudyActivity(first, { timestamp: '2026-08-11T12:00:20', day: 2, sentenceId: 'fixture-2', action: 'answer-checked', correct: true })
    const nextDay = recordStudyActivity(duplicate, { timestamp: '2026-08-12T12:00:00', day: 1, sentenceId: 'fixture-1', action: 'mastered' })
    expect(duplicate.studyActivities).toHaveLength(1)
    expect(getStudySummary(nextDay, new Date(2026, 7, 12, 15))).toMatchObject({ todaySentenceCount: 1, streakDays: 2, lastDay: 1 })
  })

  it('finds the first and most recent real study actions in empty, single, and unsorted histories', () => {
    expect(getStudySummary({ ...parseLearningState(null), studyActivities: [] })).toMatchObject({ firstActivity: null, lastActivity: null })
    const only = { timestamp: '2026-08-12T04:47:00.000Z', day: 1, sentenceId: 'fixture-1', action: 'answer-checked' as const }
    expect(getStudySummary({ ...parseLearningState(null), studyActivities: [only] })).toMatchObject({ firstActivity: only, lastActivity: only })
    const history = [
      { timestamp: '2026-08-14T04:47:00.000Z', day: 3, sentenceId: 'fixture-3', action: 'mastered' as const },
      only,
      { timestamp: '2026-08-13T04:47:00.000Z', day: 2, sentenceId: 'fixture-2', action: 'answer-checked' as const },
    ]
    expect(getStudySummary({ ...parseLearningState(null), studyActivities: history })).toMatchObject({ firstActivity: only, lastActivity: history[0] })
  })
})
