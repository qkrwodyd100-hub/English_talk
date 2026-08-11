import { describe, expect, it } from 'vitest'
import {
  advanceDayPosition,
  createSequentialLearningState,
  getDayProgress,
  getReviewQueue,
  getSequentialDayChallenge,
  getTopicProgress,
  judgeAnswer,
  recordAttempt,
  toggleFavorite,
  type SequentialLearningState,
} from './learning-engine'
import type { Sentence } from './learning'

const sentences: Sentence[] = [
  { id: 'day-01-01', english: 'Can I pay by card?', korean: '카드로 결제할 수 있나요?', day: 1, source: 'builtIn', topic: 'payment', alternatives: ['May I pay by card?'] },
  { id: 'day-01-02', english: 'Where is the station?', korean: '역이 어디예요?', day: 1, source: 'builtIn', topic: 'travel' },
  { id: 'day-02-01', english: 'I need help.', korean: '도움이 필요해요.', day: 2, source: 'builtIn', topic: 'travel' },
]

function state(overrides: Partial<SequentialLearningState> = {}): SequentialLearningState {
  return { ...createSequentialLearningState(), ...overrides }
}

describe('sequential learning engine', () => {
  it('resumes a selected day from its persisted position', () => {
    const learning = state({ selectedDay: 1, dayPositions: { 1: 1 } })

    expect(getSequentialDayChallenge(sentences, learning)).toEqual([sentences[1], sentences[0]])
    expect(advanceDayPosition(learning, 1, 2).dayPositions).toEqual({ 1: 0 })
  })

  it('calculates completion for each day and topic from completed sentence ids', () => {
    const learning = state({ completedSentenceIds: ['day-01-01', 'day-02-01'] })

    expect(getDayProgress(sentences, learning, 1)).toEqual({ completed: 1, total: 2, percentage: 50 })
    expect(getTopicProgress(sentences, learning)).toEqual([
      { topic: 'payment', completed: 1, total: 1, percentage: 100 },
      { topic: 'travel', completed: 1, total: 2, percentage: 50 },
    ])
  })

  it('only accepts exact normalized answers or declared alternatives', () => {
    expect(judgeAnswer(sentences[0], ' CAN I PAY BY CARD! ')).toEqual({ kind: 'exact', isCorrect: true })
    expect(judgeAnswer(sentences[0], 'May I pay by card.')).toEqual({ kind: 'accepted-alternative', isCorrect: true })
    expect(judgeAnswer(sentences[0], 'Can I pay with cash?')).toEqual({ kind: 'needs-correction', isCorrect: false })
  })

  it('queues incorrect attempts for review and records correct completion without duplicates', () => {
    const incorrect = recordAttempt(state(), { sentence: sentences[0], position: 0, judgment: { kind: 'needs-correction', isCorrect: false } })
    const correct = recordAttempt(incorrect, { sentence: sentences[0], position: 0, judgment: { kind: 'exact', isCorrect: true } })

    expect(incorrect.reviewQueueIds).toEqual(['day-01-01'])
    expect(correct).toMatchObject({
      completedSentenceIds: ['day-01-01'],
      reviewQueueIds: [],
      attemptCounts: { 'day-01-01': 2 },
      dayPositions: { 1: 1 },
    })
  })

  it('returns review sentences in persisted queue order and toggles favorites', () => {
    const learning = toggleFavorite(state({ reviewQueueIds: ['day-02-01', 'missing', 'day-01-02'] }), 'day-01-02')

    expect(getReviewQueue(sentences, learning).map((sentence) => sentence.id)).toEqual(['day-02-01', 'day-01-02'])
    expect(learning.favoriteIds).toEqual(['day-01-02'])
    expect(toggleFavorite(learning, 'day-01-02').favoriteIds).toEqual([])
  })
})
