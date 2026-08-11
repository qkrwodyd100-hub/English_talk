import { describe, expect, it } from 'vitest'
import { getTodayChallenge, getWordFeedback, normalizeAnswer, parseLearningState, type Sentence } from './learning'

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

  it('migrates v1 persisted learning state without losing legacy data', () => {
    expect(parseLearningState(JSON.stringify({
      version: 1,
      state: {
        masteredIds: ['fixture-1'],
        customSentences: [{ id: 'custom-1', english: 'Hello.', korean: '안녕하세요.', day: 1, source: 'custom' }],
        completedChallengeDates: ['2026-08-10'],
      },
    }))).toEqual({
      masteredIds: ['fixture-1'],
      customSentences: [{ id: 'custom-1', english: 'Hello.', korean: '안녕하세요.', day: 1, source: 'custom' }],
      completedChallengeDates: ['2026-08-10'],
      selectedDay: null,
      dayPositions: {},
      completedSentenceIds: [],
      attemptCounts: {},
      reviewQueueIds: [],
      favoriteIds: [],
    })
  })

  it('falls back safely when persisted learning state is corrupt or incompatible', () => {
    expect(parseLearningState('{"version":999}')).toEqual({ masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: null, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [] })
    expect(parseLearningState('not-json')).toEqual({ masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: null, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [] })
  })
})
