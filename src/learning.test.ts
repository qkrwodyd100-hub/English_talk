import { describe, expect, it } from 'vitest'
import { appendAnswerAttempt, formatStudyDate, formatStudyTimestamp, getLearningNotes, getLegacyHistory, getStudySummary, getTodayChallenge, getWordFeedback, isPersistableLearningPayload, mergeLearningStates, normalizeAnswer, parseLearningState, recordStudyActivity, saveSentenceNote, type Sentence } from './learning'

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
      sentenceNotes: {},
      answerHistory: {},
    })
  })

  it('formats Korean study timestamps with the browser timezone formatter', () => {
    expect(formatStudyTimestamp('2026-08-12T04:47:00.000Z', 'Asia/Seoul')).toBe('2026. 8. 12.(수) 13:47')
    expect(formatStudyDate('2026-08-12T04:47:00.000Z', 'Asia/Seoul')).toBe('2026. 8. 12.(수)')
  })

  it('falls back safely when persisted learning state is corrupt or incompatible', () => {
    expect(parseLearningState('{"version":999}')).toMatchObject({ masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: null, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {} })
    expect(parseLearningState('not-json')).toMatchObject({ masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: null, dayPositions: {}, completedSentenceIds: [], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [], sentenceNotes: {}, answerHistory: {} })
  })

  it('marks only recognized versioned payloads as safe to overwrite', () => {
    expect(isPersistableLearningPayload(null)).toBe(true)
    expect(isPersistableLearningPayload('{"version":3,"state":{}}')).toBe(true)
    expect(isPersistableLearningPayload('{"version":4,"state":{}}')).toBe(true)
    expect(isPersistableLearningPayload('not-json')).toBe(false)
    expect(isPersistableLearningPayload('{"version":999,"state":{}}')).toBe(false)
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

  it('preserves legacy completions as date-unknown history without inventing timestamps', () => {
    const migrated = parseLearningState(JSON.stringify({
      version: 2,
      state: {
        masteredIds: [], customSentences: [], completedChallengeDates: [], selectedDay: 2,
        dayPositions: { 1: 10, 2: 3 },
        completedSentenceIds: Array.from({ length: 10 }, (_, index) => `day-01-${String(index + 1).padStart(2, '0')}`),
        attemptCounts: {}, reviewQueueIds: [], favoriteIds: [],
      },
    }))

    expect(getLegacyHistory(migrated)).toEqual([{ day: 1, completedSentenceCount: 10 }])
    expect(migrated.studyActivities).toEqual([])
  })

  it('merges a validated backup without discarding the learner current progress', () => {
    const current = parseLearningState(JSON.stringify({ version: 3, state: {
      masteredIds: ['day-01-01'], customSentences: [], completedChallengeDates: [], selectedDay: 2, dayPositions: { 2: 1 }, completedSentenceIds: ['day-01-01'], attemptCounts: {}, reviewQueueIds: [], favoriteIds: [], studyActivities: [],
    } }))
    const backup = parseLearningState(JSON.stringify({ version: 2, state: {
      masteredIds: ['day-01-02'], customSentences: [{ id: 'custom-backup', english: 'Backup.', korean: '백업.', day: 1, source: 'custom' }], completedChallengeDates: [], selectedDay: 1, dayPositions: { 1: 10 }, completedSentenceIds: Array.from({ length: 10 }, (_, index) => `day-01-${String(index + 1).padStart(2, '0')}`), attemptCounts: {}, reviewQueueIds: [], favoriteIds: [],
    } }))

    expect(mergeLearningStates(current, backup)).toMatchObject({
      masteredIds: ['day-01-01', 'day-01-02'], selectedDay: 2, dayPositions: { 1: 10, 2: 1 }, customSentences: [{ id: 'custom-backup' }],
    })
    expect(getLegacyHistory(mergeLearningStates(current, backup))).toEqual([{ day: 1, completedSentenceCount: 10 }])
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

  it('migrates v3 data without losing progress and recovers valid notes and answer history', () => {
    const migrated = parseLearningState(JSON.stringify({ version: 3, state: {
      masteredIds: ['fixture-1'], customSentences: [], completedChallengeDates: ['2026-08-10'], selectedDay: 2,
      dayPositions: { 2: 1 }, completedSentenceIds: ['fixture-2'], attemptCounts: { 'fixture-2': 2 }, reviewQueueIds: [], favoriteIds: [], studyActivities: [],
      sentenceNotes: { 'fixture-2': { text: '  baggage is for checked bags  ', updatedAt: '2026-08-13T10:00:00.000Z' }, broken: { text: 3 } },
      answerHistory: { 'fixture-2': [{ timestamp: '2026-08-13T10:00:00.000Z', attempt: 'Where can I find my luggage?', verdict: 'contextual', reason: 'A natural alternative.' }], broken: [{}] },
    } }))
    expect(migrated).toMatchObject({ masteredIds: ['fixture-1'], selectedDay: 2, dayPositions: { 2: 1 }, completedSentenceIds: ['fixture-2'], sentenceNotes: { 'fixture-2': { text: 'baggage is for checked bags' } } })
    expect(migrated.answerHistory['fixture-2']).toHaveLength(1)
  })

  it('saves, edits, deletes bounded notes and keeps only five newest answer attempts', () => {
    const initial = parseLearningState(null)
    const saved = saveSentenceNote(initial, 'fixture-1', 'first note', '2026-08-13T10:00:00.000Z')
    const edited = saveSentenceNote(saved, 'fixture-1', 'edited note', '2026-08-13T11:00:00.000Z')
    const deleted = saveSentenceNote(edited, 'fixture-1', '   ', '2026-08-13T12:00:00.000Z')
    expect(edited.sentenceNotes['fixture-1']).toEqual({ text: 'edited note', updatedAt: '2026-08-13T11:00:00.000Z' })
    expect(deleted.sentenceNotes).toEqual({})
    expect(saveSentenceNote(initial, 'fixture-1', 'x'.repeat(2001), '2026-08-13T10:00:00.000Z')).toBe(initial)
    const attempts = Array.from({ length: 6 }, (_, index) => ({ timestamp: `2026-08-13T10:0${index}:00.000Z`, attempt: `attempt ${index}`, verdict: 'needs-fix' as const }))
    const withHistory = attempts.reduce((state, entry) => appendAnswerAttempt(state, 'fixture-1', entry), initial)
    expect(withHistory.answerHistory['fixture-1']).toHaveLength(5)
    expect(withHistory.answerHistory['fixture-1'][0].attempt).toBe('attempt 5')
  })

  it('searches saved notes across note text, Korean prompts, and English answers in recent-update order', () => {
    const state = parseLearningState(null)
    state.sentenceNotes = {
      'fixture-1': { text: 'Ask for a quiet table.', updatedAt: '2026-08-13T10:00:00.000Z' },
      'fixture-2': { text: 'Use this when you need help.', updatedAt: '2026-08-13T12:00:00.000Z' },
    }

    expect(getLearningNotes(sentences, state, 'help')).toEqual([{ sentence: sentences[1], note: state.sentenceNotes['fixture-2'] }])
    expect(getLearningNotes(sentences, state, '차')).toEqual([{ sentence: sentences[0], note: state.sentenceNotes['fixture-1'] }])
    expect(getLearningNotes(sentences, state, 'could')).toEqual([{ sentence: sentences[1], note: state.sentenceNotes['fixture-2'] }])
    expect(getLearningNotes(sentences, state)).toEqual([
      { sentence: sentences[1], note: state.sentenceNotes['fixture-2'] },
      { sentence: sentences[0], note: state.sentenceNotes['fixture-1'] },
    ])
  })

  it('keeps event and answer histories idempotent across repeated cloud reconciliation', () => {
    const activity = { timestamp: '2026-08-14T10:00:00.000Z', day: 1, sentenceId: 'fixture-1', action: 'answer-checked' as const, correct: true }
    const answer = { timestamp: '2026-08-14T10:00:00.000Z', attempt: 'I would like a cup of tea.', verdict: 'correct' as const }
    const original = { ...parseLearningState(null), studyActivities: [activity], answerHistory: { 'fixture-1': [answer] } }
    const once = mergeLearningStates(original, original)
    const twice = mergeLearningStates(once, original)
    expect(twice.studyActivities).toEqual([activity])
    expect(twice.answerHistory['fixture-1']).toEqual([answer])
  })
})
