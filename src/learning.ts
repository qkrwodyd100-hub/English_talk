export type SentenceSource = 'builtIn' | 'custom'

export type LearningLevel = 'beginner' | 'intermediate' | 'advanced'

export type SentenceAlternative = {
  english: string
  korean: string
}

export type SlotValue = {
  english: string
  korean: string
}

export type SentenceSlot = {
  key: string
  type: string
  values: SlotValue[]
}

type SentenceBase = {
  id: string
  english: string
  korean: string
  day: number
}

export type BuiltInSentence = SentenceBase & {
  source: 'builtIn'
  topic: string
  level: LearningLevel
  priority: 1 | 2 | 3
  region?: string
  alternatives?: SentenceAlternative[]
  slots?: SentenceSlot[]
}

export type CustomSentence = SentenceBase & {
  source: 'custom'
}

export type Sentence = BuiltInSentence | CustomSentence

export type DialogueRole = 'traveler' | 'staff' | 'local'

export type DialogueTurn = {
  role: DialogueRole
  english: string
  korean: string
}

export type MiniDialogue = {
  day: number
  topic: string
  turns: DialogueTurn[]
}

export type LearningState = {
  masteredIds: string[]
  customSentences: CustomSentence[]
  completedChallengeDates: string[]
}

export type WordFeedback = {
  word: string
  status: 'correct' | 'missing'
}

export const LEARNING_STORAGE_KEY = 'english-talk.learning'
export const LEARNING_STORAGE_VERSION = 1


export function createEmptyLearningState(): LearningState {
  return { masteredIds: [], customSentences: [], completedChallengeDates: [] }
}

export function parseLearningState(raw: string | null): LearningState {
  if (!raw) return createEmptyLearningState()
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return createEmptyLearningState()
    const record = value as Record<string, unknown>
    if (record.version !== LEARNING_STORAGE_VERSION || !record.state || typeof record.state !== 'object') return createEmptyLearningState()
    const state = record.state as Record<string, unknown>
    const customSentences = Array.isArray(state.customSentences) ? state.customSentences.filter(isCustomSentence) : []
    return {
      masteredIds: Array.isArray(state.masteredIds) ? state.masteredIds.filter((id): id is string => typeof id === 'string') : [],
      customSentences,
      completedChallengeDates: Array.isArray(state.completedChallengeDates) ? state.completedChallengeDates.filter((date): date is string => typeof date === 'string') : [],
    }
  } catch {
    return createEmptyLearningState()
  }
}

function isCustomSentence(value: unknown): value is CustomSentence {
  if (!value || typeof value !== 'object') return false
  const sentence = value as Record<string, unknown>
  return typeof sentence.id === 'string' && typeof sentence.english === 'string' && typeof sentence.korean === 'string' && typeof sentence.day === 'number' && Number.isInteger(sentence.day) && sentence.day >= 1 && sentence.day <= 60 && sentence.source === 'custom'
}

export function normalizeAnswer(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()
}

export function getTodayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getTodayChallenge(sentences: Sentence[], date = new Date()) {
  if (sentences.length === 0) return []
  const key = getTodayKey(date)
  const offset = [...key].reduce((total, character) => total + character.charCodeAt(0), 0) % sentences.length
  return Array.from({ length: 10 }, (_, index) => sentences[(offset + index) % sentences.length])
}

export function getWordFeedback(answer: string, attempt: string): WordFeedback[] {
  const expectedWords = answer.match(/[\p{L}\p{N}']+/gu) ?? []
  const typedWords = normalizeAnswer(attempt).split(' ').filter(Boolean)
  const normalizedExpected = expectedWords.map(normalizeAnswer)
  const matches = Array.from({ length: normalizedExpected.length + 1 }, () => Array<number>(typedWords.length + 1).fill(0))

  for (let expectedIndex = normalizedExpected.length - 1; expectedIndex >= 0; expectedIndex -= 1) {
    for (let typedIndex = typedWords.length - 1; typedIndex >= 0; typedIndex -= 1) {
      matches[expectedIndex][typedIndex] = normalizedExpected[expectedIndex] === typedWords[typedIndex]
        ? matches[expectedIndex + 1][typedIndex + 1] + 1
        : Math.max(matches[expectedIndex + 1][typedIndex], matches[expectedIndex][typedIndex + 1])
    }
  }

  const correct = new Set<number>()
  let expectedIndex = 0
  let typedIndex = 0
  while (expectedIndex < normalizedExpected.length && typedIndex < typedWords.length) {
    if (normalizedExpected[expectedIndex] === typedWords[typedIndex]) {
      correct.add(expectedIndex)
      expectedIndex += 1
      typedIndex += 1
    } else if (matches[expectedIndex + 1][typedIndex] >= matches[expectedIndex][typedIndex + 1]) {
      expectedIndex += 1
    } else {
      typedIndex += 1
    }
  }

  return expectedWords.map((word, index) => ({ word, status: correct.has(index) ? 'correct' : 'missing' }))
}
