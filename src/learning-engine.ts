import { getContractionEquivalentForms, normalizeAnswer, MAX_COURSE_DAY, type Sentence } from './learning'

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

export type ResumeTarget = {
  day: number
  position: number
  isCourseComplete: boolean
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
  if (!day || day < 1 || day > MAX_COURSE_DAY) return []
  const daySentences = sentences.filter((sentence) => sentence.day === day)
  if (daySentences.length === 0) return []
  const start = state.dayPositions[day] ?? 0
  return Array.from({ length: daySentences.length }, (_, index) => daySentences[(start + index) % daySentences.length])
}

/** Chooses the first unfinished sentence of the current day, or the next unfinished day. */
export function getResumeTarget(sentences: Sentence[], state: SequentialLearningState): ResumeTarget {
  const days = [...new Set(sentences.map((sentence) => sentence.day))].sort((left, right) => left - right)
  const selectedDay = state.selectedDay ?? days[0] ?? 1
  const completed = new Set(state.completedSentenceIds)
  const targetForDay = (day: number) => {
    const daySentences = sentences.filter((sentence) => sentence.day === day)
    const savedPosition = state.dayPositions[day] ?? 0
    const currentPosition = savedPosition % daySentences.length
    if (daySentences[currentPosition] && !completed.has(daySentences[currentPosition].id)) return currentPosition
    return daySentences.findIndex((sentence) => !completed.has(sentence.id))
  }

  const selectedPosition = targetForDay(selectedDay)
  if (selectedPosition >= 0) return { day: selectedDay, position: selectedPosition, isCourseComplete: false }

  for (const day of [...days.filter((value) => value > selectedDay), ...days]) {
    const position = targetForDay(day)
    if (position >= 0) return { day, position, isCourseComplete: false }
  }
  return { day: Math.min(MAX_COURSE_DAY, selectedDay), position: 0, isCourseComplete: true }
}

export function advanceDayPosition(state: SequentialLearningState, day: number, sentenceCount: number): SequentialLearningState {
  if (day < 1 || day > MAX_COURSE_DAY || sentenceCount < 1) return state
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

/** Builds one daily practice set of `count` sentences: the current Day from its
 * saved position first, then the review queue, then the following Days in order.
 * Unfinished positions on other Days are never reset, so unsolved sentences
 * carry over instead of being lost. */
export function getDailyPracticeSet(
  sentences: Sentence[],
  state: SequentialLearningState,
  day: number,
  count: number,
): Sentence[] {
  const safeCount = Math.min(Math.max(1, Math.floor(count) || 10), sentences.length)
  if (!day || day < 1 || day > MAX_COURSE_DAY || sentences.length === 0) return []
  const ordered = getSequentialDayChallenge(sentences, state, day)
  const review = getReviewQueue(sentences, state)
  const days = [...new Set(sentences.map((sentence) => sentence.day))].sort((left, right) => left - right)
  const following = days.filter((value) => value > day).flatMap((nextDay) => getSequentialDayChallenge(sentences, state, nextDay))
  const picked: Sentence[] = []
  const seen = new Set<string>()
  for (const sentence of [...ordered, ...review, ...following]) {
    if (seen.has(sentence.id)) continue
    seen.add(sentence.id)
    picked.push(sentence)
    if (picked.length >= safeCount) break
  }
  return picked
}

/** Returns up to `count` review-queue sentences in persisted queue order for
 * automatic re-presentation of incorrect attempts (spaced repetition). */
export function getReviewChallenge(sentences: Sentence[], state: SequentialLearningState, count: number): Sentence[] {
  const safeCount = Math.min(Math.max(1, Math.floor(count) || 10), sentences.length)
  return getReviewQueue(sentences, state).slice(0, safeCount)
}

/** Grades one shadowing attempt: listen to TTS, repeat by voice, and score the
 * transcript with the same judgment used for typed answers. */
export function gradeShadowingAttempt(sentence: Sentence, transcript: string): AnswerJudgment {
  return judgeAnswer(sentence, transcript)
}
