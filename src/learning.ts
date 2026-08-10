export type SentenceSource = 'builtIn' | 'custom'

export type Sentence = {
  id: string
  english: string
  korean: string
  day: number
  source: SentenceSource
}

export type LearningState = {
  masteredIds: string[]
  customSentences: Sentence[]
  completedChallengeDates: string[]
}

export type WordFeedback = {
  word: string
  status: 'correct' | 'missing'
}

export const LEARNING_STORAGE_KEY = 'english-talk.learning'
export const LEARNING_STORAGE_VERSION = 1

export const fixtureSentences: Sentence[] = [
  { id: 'fixture-1', english: 'I would like a cup of tea.', korean: '차 한 잔 주세요.', day: 1, source: 'builtIn' },
  { id: 'fixture-2', english: 'Could you help me?', korean: '도와주실 수 있나요?', day: 2, source: 'builtIn' },
  { id: 'fixture-3', english: 'Where is the station?', korean: '역이 어디에 있나요?', day: 3, source: 'builtIn' },
  { id: 'fixture-4', english: 'I have a reservation under Kim.', korean: '김 이름으로 예약했습니다.', day: 4, source: 'builtIn' },
  { id: 'fixture-5', english: 'What time does it open?', korean: '몇 시에 문을 여나요?', day: 5, source: 'builtIn' },
  { id: 'fixture-6', english: 'Can I pay by card?', korean: '카드로 결제할 수 있나요?', day: 6, source: 'builtIn' },
  { id: 'fixture-7', english: 'Please speak a little more slowly.', korean: '조금 더 천천히 말씀해 주세요.', day: 7, source: 'builtIn' },
  { id: 'fixture-8', english: 'I am looking for this address.', korean: '이 주소를 찾고 있어요.', day: 8, source: 'builtIn' },
  { id: 'fixture-9', english: 'That sounds like a good idea.', korean: '좋은 생각인 것 같아요.', day: 9, source: 'builtIn' },
  { id: 'fixture-10', english: 'Could I have the bill, please?', korean: '계산서 부탁드립니다.', day: 10, source: 'builtIn' },
  { id: 'fixture-11', english: 'I will be there in ten minutes.', korean: '10분 후에 도착할게요.', day: 11, source: 'builtIn' },
  { id: 'fixture-12', english: 'Thank you for your time today.', korean: '오늘 시간 내주셔서 감사합니다.', day: 12, source: 'builtIn' },
]

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
    const customSentences = Array.isArray(state.customSentences) ? state.customSentences.filter(isSentence) : []
    return {
      masteredIds: Array.isArray(state.masteredIds) ? state.masteredIds.filter((id): id is string => typeof id === 'string') : [],
      customSentences,
      completedChallengeDates: Array.isArray(state.completedChallengeDates) ? state.completedChallengeDates.filter((date): date is string => typeof date === 'string') : [],
    }
  } catch {
    return createEmptyLearningState()
  }
}

function isSentence(value: unknown): value is Sentence {
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
