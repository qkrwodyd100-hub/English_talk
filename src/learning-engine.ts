import { getContractionEquivalentForms, normalizeAnswer, type Sentence } from './learning'

export type AnswerJudgment = {
  kind: 'exact' | 'accepted-alternative' | 'contextual-correct' | 'needs-correction'
  isCorrect: boolean
}

export type Progress = {
  completed: number
  total: number
  percentage: number
}

export type TopicProgress = Progress & {
  topic: string
}

export type SequentialLearningState = {
  selectedDay: number | null
  dayPositions: Record<number, number>
  completedSentenceIds: string[]
  attemptCounts: Record<string, number>
  reviewQueueIds: string[]
  favoriteIds: string[]
}

export function createSequentialLearningState(): SequentialLearningState {
  return {
    selectedDay: null,
    dayPositions: {},
    completedSentenceIds: [],
    attemptCounts: {},
    reviewQueueIds: [],
    favoriteIds: [],
  }
}

export function getSequentialDayChallenge(sentences: Sentence[], state: SequentialLearningState, day = state.selectedDay): Sentence[] {
  if (!day || day < 1 || day > 60) return []
  const daySentences = sentences.filter((sentence) => sentence.day === day)
  if (daySentences.length === 0) return []
  const start = state.dayPositions[day] ?? 0
  return Array.from({ length: daySentences.length }, (_, index) => daySentences[(start + index) % daySentences.length])
}

export function advanceDayPosition(state: SequentialLearningState, day: number, sentenceCount: number): SequentialLearningState {
  if (day < 1 || day > 60 || sentenceCount < 1) return state
  const current = state.dayPositions[day] ?? 0
  return { ...state, selectedDay: day, dayPositions: { ...state.dayPositions, [day]: (current + 1) % sentenceCount } }
}

export function getDayProgress(sentences: Sentence[], state: SequentialLearningState, day: number): Progress {
  return calculateProgress(sentences.filter((sentence) => sentence.day === day), state.completedSentenceIds)
}

export function getTopicProgress(sentences: Sentence[], state: SequentialLearningState): TopicProgress[] {
  const byTopic = new Map<string, Sentence[]>()
  for (const sentence of sentences) {
    const topic = sentence.source === 'builtIn' ? sentence.topic : 'custom'
    byTopic.set(topic, [...(byTopic.get(topic) ?? []), sentence])
  }
  return [...byTopic.entries()].map(([topic, topicSentences]) => ({ topic, ...calculateProgress(topicSentences, state.completedSentenceIds) }))
}

export function judgeAnswer(sentence: Sentence, attempt: string): AnswerJudgment {
  const normalizedAttempt = normalizeAnswer(attempt)
  if (getContractionEquivalentForms(sentence.english).has(normalizedAttempt)) return { kind: 'exact', isCorrect: true }
  if (sentence.source === 'builtIn' && sentence.acceptedAlternatives?.some((alternative) => getContractionEquivalentForms(alternative.english).has(normalizedAttempt))) {
    return { kind: 'accepted-alternative', isCorrect: true }
  }
  if (sentence.source === 'builtIn' && [...(sentence.alternatives ?? []), ...(sentence.contextualTips ?? [])].some((alternative) => getContractionEquivalentForms(alternative.english).has(normalizedAttempt))) {
    return { kind: 'contextual-correct', isCorrect: true }
  }
  return { kind: 'needs-correction', isCorrect: false }
}

export function recordAttempt(
  state: SequentialLearningState,
  input: { sentence: Sentence; position: number; judgment: AnswerJudgment },
): SequentialLearningState {
  const { sentence, position, judgment } = input
  const completedSentenceIds = judgment.isCorrect ? addUnique(state.completedSentenceIds, sentence.id) : state.completedSentenceIds
  const reviewQueueIds = judgment.isCorrect
    ? state.reviewQueueIds.filter((id) => id !== sentence.id)
    : addUnique(state.reviewQueueIds, sentence.id)
  return {
    ...state,
    completedSentenceIds,
    reviewQueueIds,
    attemptCounts: { ...state.attemptCounts, [sentence.id]: (state.attemptCounts[sentence.id] ?? 0) + 1 },
    selectedDay: sentence.day,
    dayPositions: { ...state.dayPositions, [sentence.day]: Math.max(0, position) + 1 },
  }
}

export function getReviewQueue(sentences: Sentence[], state: SequentialLearningState): Sentence[] {
  const byId = new Map(sentences.map((sentence) => [sentence.id, sentence]))
  return state.reviewQueueIds.flatMap((id) => {
    const sentence = byId.get(id)
    return sentence ? [sentence] : []
  })
}

export function toggleFavorite(state: SequentialLearningState, sentenceId: string): SequentialLearningState {
  const favoriteIds = state.favoriteIds.includes(sentenceId)
    ? state.favoriteIds.filter((id) => id !== sentenceId)
    : [...state.favoriteIds, sentenceId]
  return { ...state, favoriteIds }
}

function calculateProgress(sentences: Sentence[], completedSentenceIds: string[]): Progress {
  const completed = sentences.filter((sentence) => completedSentenceIds.includes(sentence.id)).length
  const total = sentences.length
  return { completed, total, percentage: total ? Math.round((completed / total) * 100) : 0 }
}

function addUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value]
}
