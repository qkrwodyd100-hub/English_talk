export type SentenceSource = 'builtIn' | 'custom'

export type LearningLevel = 'beginner' | 'intermediate' | 'advanced'

export type SentenceAlternative = {
  english: string
  korean: string
  reason?: string
  recommendedWhen?: string
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
  acceptedAlternatives?: SentenceAlternative[]
  contextualTips?: SentenceAlternative[]
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
  selectedDay: number | null
  dayPositions: Record<number, number>
  completedSentenceIds: string[]
  attemptCounts: Record<string, number>
  reviewQueueIds: string[]
  favoriteIds: string[]
  studyActivities: StudyActivity[]
  sentenceNotes: Record<string, SentenceNote>
  answerHistory: Record<string, AnswerAttempt[]>
}

export type SentenceNote = { text: string; updatedAt: string }
export type LearningNoteEntry = { sentence: Sentence; note: SentenceNote }
export type AnswerVerdict = 'correct' | 'equivalent' | 'contextual' | 'needs-fix'
export type AnswerAttempt = { timestamp: string; attempt: string; verdict: AnswerVerdict; reason?: string }

export type StudyAction = 'answer-checked' | 'mastered' | 'review-completed'

export type StudyActivity = {
  timestamp: string
  day: number
  sentenceId: string
  action: StudyAction
  correct?: boolean
}

export type StudySummary = {
  firstActivity: StudyActivity | null
  lastDay: number | null
  lastActivity: StudyActivity | null
  todaySentenceCount: number
  streakDays: number
}

export type LegacyHistoryItem = {
  day: number
  completedSentenceCount: number
}

export type WordFeedback = {
  word: string
  status: 'correct' | 'missing'
}

export const LEARNING_STORAGE_KEY = 'english-talk.learning'
export const LEARNING_STORAGE_VERSION = 4
export const MAX_SENTENCE_NOTE_LENGTH = 2000
export const MAX_ANSWER_HISTORY = 5

export function createEmptyLearningState(): LearningState {
  return {
    masteredIds: [],
    customSentences: [],
    completedChallengeDates: [],
    selectedDay: null,
    dayPositions: {},
    completedSentenceIds: [],
    attemptCounts: {},
    reviewQueueIds: [],
    favoriteIds: [],
    studyActivities: [],
    sentenceNotes: {},
    answerHistory: {},
  }
}

export function parseLearningState(raw: string | null): LearningState {
  if (!raw) return createEmptyLearningState()
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return createEmptyLearningState()
    const record = value as Record<string, unknown>
    if (!record.state || typeof record.state !== 'object') return createEmptyLearningState()
    const state = record.state as Record<string, unknown>
    if (record.version === 1) return migrateV1LearningState(state)
    if (record.version === 2) return migrateV2LearningState(state)
    if (record.version === 3) return migrateV3LearningState(state)
    if (record.version !== LEARNING_STORAGE_VERSION) return createEmptyLearningState()
    return {
      ...readLegacyLearningFields(state),
      selectedDay: isDay(state.selectedDay) ? state.selectedDay : null,
      dayPositions: readDayPositions(state.dayPositions),
      completedSentenceIds: readStringArray(state.completedSentenceIds),
      attemptCounts: readAttemptCounts(state.attemptCounts),
      reviewQueueIds: readStringArray(state.reviewQueueIds),
      favoriteIds: readStringArray(state.favoriteIds),
      studyActivities: readStudyActivities(state.studyActivities),
      sentenceNotes: readSentenceNotes(state.sentenceNotes),
      answerHistory: readAnswerHistory(state.answerHistory),
    }
  } catch {
    return createEmptyLearningState()
  }
}

export function isPersistableLearningPayload(raw: string | null) {
  if (!raw) return true
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    return [1, 2, 3, LEARNING_STORAGE_VERSION].includes(Number(record.version)) && Boolean(record.state) && typeof record.state === 'object'
  } catch {
    return false
  }
}

export function getLegacyHistory(state: LearningState): LegacyHistoryItem[] {
  const completedByDay = new Map<number, Set<string>>()
  for (const sentenceId of state.completedSentenceIds) {
    const match = /^day-(\d{2})-\d{2}$/.exec(sentenceId)
    if (!match) continue
    const day = Number(match[1])
    if (!isDay(day)) continue
    const ids = completedByDay.get(day) ?? new Set<string>()
    ids.add(sentenceId)
    completedByDay.set(day, ids)
  }
  const datedDays = new Set(state.studyActivities.map((activity) => activity.day))
  return [...completedByDay.entries()]
    .filter(([day, ids]) => ids.size > 0 && !datedDays.has(day))
    .map(([day, ids]) => ({ day, completedSentenceCount: ids.size }))
    .sort((left, right) => left.day - right.day)
}

export function mergeLearningStates(current: LearningState, backup: LearningState): LearningState {
  const unique = <T>(values: T[]) => [...new Set(values)]
  const customSentences = new Map(current.customSentences.map((sentence) => [sentence.id, sentence]))
  for (const sentence of backup.customSentences) if (!customSentences.has(sentence.id)) customSentences.set(sentence.id, sentence)
  return {
    ...current,
    masteredIds: unique([...current.masteredIds, ...backup.masteredIds]),
    customSentences: [...customSentences.values()],
    completedChallengeDates: unique([...current.completedChallengeDates, ...backup.completedChallengeDates]),
    dayPositions: { ...backup.dayPositions, ...current.dayPositions },
    completedSentenceIds: unique([...current.completedSentenceIds, ...backup.completedSentenceIds]),
    attemptCounts: { ...backup.attemptCounts, ...current.attemptCounts },
    reviewQueueIds: unique([...current.reviewQueueIds, ...backup.reviewQueueIds]),
    favoriteIds: unique([...current.favoriteIds, ...backup.favoriteIds]),
    studyActivities: readStudyActivities([...current.studyActivities, ...backup.studyActivities]),
    sentenceNotes: { ...backup.sentenceNotes, ...current.sentenceNotes },
    answerHistory: Object.fromEntries([...new Set([...Object.keys(backup.answerHistory), ...Object.keys(current.answerHistory)])].map((id) => [id, readAnswerHistory({ [id]: [...(current.answerHistory[id] ?? []), ...(backup.answerHistory[id] ?? [])] })[id] ?? []]).filter(([, history]) => history.length)),
  }
}

function migrateV1LearningState(state: Record<string, unknown>): LearningState {
  return { ...readLegacyLearningFields(state), ...createSequentialState(state), studyActivities: [], sentenceNotes: {}, answerHistory: {} }
}

function migrateV2LearningState(state: Record<string, unknown>): LearningState {
  return { ...readLegacyLearningFields(state), ...createSequentialState(state), studyActivities: [], sentenceNotes: {}, answerHistory: {} }
}

function migrateV3LearningState(state: Record<string, unknown>): LearningState {
  return { ...readLegacyLearningFields(state), ...createSequentialState(state), studyActivities: readStudyActivities(state.studyActivities), sentenceNotes: readSentenceNotes(state.sentenceNotes), answerHistory: readAnswerHistory(state.answerHistory) }
}

function readLegacyLearningFields(state: Record<string, unknown>) {
  return {
    masteredIds: readStringArray(state.masteredIds),
    customSentences: Array.isArray(state.customSentences) ? state.customSentences.filter(isCustomSentence) : [],
    completedChallengeDates: readStringArray(state.completedChallengeDates),
  }
}

function createSequentialState(state?: Record<string, unknown>) {
  if (state) return {
    selectedDay: isDay(state.selectedDay) ? state.selectedDay : null,
    dayPositions: readDayPositions(state.dayPositions), completedSentenceIds: readStringArray(state.completedSentenceIds),
    attemptCounts: readAttemptCounts(state.attemptCounts), reviewQueueIds: readStringArray(state.reviewQueueIds), favoriteIds: readStringArray(state.favoriteIds),
  }
  const { selectedDay, dayPositions, completedSentenceIds, attemptCounts, reviewQueueIds, favoriteIds } = createEmptyLearningState()
  return { selectedDay, dayPositions, completedSentenceIds, attemptCounts, reviewQueueIds, favoriteIds }
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function isDay(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 60
}

function readDayPositions(value: unknown): Record<number, number> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).flatMap(([day, position]) => {
    const numericDay = Number(day)
    return isDay(numericDay) && typeof position === 'number' && Number.isInteger(position) && position >= 0
      ? [[numericDay, position]]
      : []
  }))
}

function readAttemptCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).flatMap(([id, count]) =>
    typeof count === 'number' && Number.isInteger(count) && count >= 0 ? [[id, count]] : [],
  ))
}

function readStudyActivities(value: unknown): StudyActivity[] {
  if (!Array.isArray(value)) return []
  const unique = new Map(value.filter(isStudyActivity).map((activity) => [JSON.stringify(activity), activity]))
  return [...unique.values()].sort((left, right) => right.timestamp.localeCompare(left.timestamp))
}

function readSentenceNotes(value: unknown): Record<string, SentenceNote> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).flatMap(([id, note]) => {
    if (!note || typeof note !== 'object') return []
    const record = note as Record<string, unknown>
    const text = typeof record.text === 'string' ? record.text.trim() : ''
    return text && text.length <= MAX_SENTENCE_NOTE_LENGTH && typeof record.updatedAt === 'string' && !Number.isNaN(Date.parse(record.updatedAt)) ? [[id, { text, updatedAt: record.updatedAt }]] : []
  }))
}

function readAnswerHistory(value: unknown): Record<string, AnswerAttempt[]> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).flatMap(([id, history]) => {
    if (!Array.isArray(history)) return []
    const unique = new Map(history.filter(isAnswerAttempt).map((entry) => [JSON.stringify(entry), entry]))
    const entries = [...unique.values()].sort((left, right) => right.timestamp.localeCompare(left.timestamp)).slice(0, MAX_ANSWER_HISTORY)
    return entries.length ? [[id, entries]] : []
  }))
}

function isAnswerAttempt(value: unknown): value is AnswerAttempt {
  if (!value || typeof value !== 'object') return false
  const attempt = value as Record<string, unknown>
  return typeof attempt.timestamp === 'string' && !Number.isNaN(Date.parse(attempt.timestamp)) && typeof attempt.attempt === 'string' && attempt.attempt.length <= MAX_SENTENCE_NOTE_LENGTH && ['correct', 'equivalent', 'contextual', 'needs-fix'].includes(String(attempt.verdict)) && (attempt.reason === undefined || typeof attempt.reason === 'string')
}

export function saveSentenceNote(state: LearningState, sentenceId: string, value: string, updatedAt: string): LearningState {
  const text = value.trim()
  if (text.length > MAX_SENTENCE_NOTE_LENGTH || !sentenceId || Number.isNaN(Date.parse(updatedAt))) return state
  const sentenceNotes = { ...state.sentenceNotes }
  if (text) sentenceNotes[sentenceId] = { text, updatedAt }
  else delete sentenceNotes[sentenceId]
  return { ...state, sentenceNotes }
}

export function appendAnswerAttempt(state: LearningState, sentenceId: string, entry: AnswerAttempt): LearningState {
  if (!sentenceId || !isAnswerAttempt(entry)) return state
  return { ...state, answerHistory: { ...state.answerHistory, [sentenceId]: [entry, ...(state.answerHistory[sentenceId] ?? [])].sort((left, right) => right.timestamp.localeCompare(left.timestamp)).slice(0, MAX_ANSWER_HISTORY) } }
}

export function getLearningNotes(sentences: Sentence[], state: LearningState, query = '', day?: number): LearningNoteEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return sentences.flatMap((sentence) => {
    const note = state.sentenceNotes[sentence.id]
    if (!note || (day !== undefined && sentence.day !== day)) return []
    const searchable = `${note.text}\n${sentence.korean}\n${sentence.english}`.toLocaleLowerCase()
    return !normalizedQuery || searchable.includes(normalizedQuery) ? [{ sentence, note }] : []
  }).sort((left, right) => right.note.updatedAt.localeCompare(left.note.updatedAt))
}

function isStudyActivity(value: unknown): value is StudyActivity {
  if (!value || typeof value !== 'object') return false
  const activity = value as Record<string, unknown>
  return typeof activity.timestamp === 'string' && !Number.isNaN(Date.parse(activity.timestamp)) && isDay(activity.day)
    && typeof activity.sentenceId === 'string' && ['answer-checked', 'mastered', 'review-completed'].includes(String(activity.action))
    && (activity.correct === undefined || typeof activity.correct === 'boolean')
}

export function recordStudyActivity(state: LearningState, activity: StudyActivity, dedupeWindowMs = 60_000): LearningState {
  const timestamp = Date.parse(activity.timestamp)
  const duplicate = state.studyActivities.some((existing) => existing.day === activity.day && existing.sentenceId === activity.sentenceId
    && existing.action === activity.action && Math.abs(Date.parse(existing.timestamp) - timestamp) < dedupeWindowMs)
  if (duplicate) return state
  return { ...state, studyActivities: [activity, ...state.studyActivities].sort((left, right) => right.timestamp.localeCompare(left.timestamp)) }
}

export function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatStudyTimestamp(timestamp: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('ko-KR', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp))
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}. ${value('month')}. ${value('day')}.(${value('weekday')}) ${value('hour')}:${value('minute')}`
}

export function formatStudyDate(timestamp: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('ko-KR', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(new Date(timestamp))
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}. ${value('month')}. ${value('day')}.(${value('weekday')})`
}

export function getStudySummary(state: LearningState, now = new Date()): StudySummary {
  const firstActivity = state.studyActivities.reduce<StudyActivity | null>((earliest, activity) => !earliest || Date.parse(activity.timestamp) < Date.parse(earliest.timestamp) ? activity : earliest, null)
  const lastActivity = state.studyActivities.reduce<StudyActivity | null>((latest, activity) => !latest || Date.parse(activity.timestamp) > Date.parse(latest.timestamp) ? activity : latest, null)
  const today = getLocalDateKey(now)
  const todaySentenceCount = new Set(state.studyActivities.filter((activity) => getLocalDateKey(new Date(activity.timestamp)) === today).map((activity) => activity.sentenceId)).size
  const dates = new Set(state.studyActivities.map((activity) => getLocalDateKey(new Date(activity.timestamp))))
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!dates.has(getLocalDateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streakDays = 0
  while (dates.has(getLocalDateKey(cursor))) { streakDays += 1; cursor.setDate(cursor.getDate() - 1) }
  return { firstActivity, lastDay: lastActivity?.day ?? null, lastActivity, todaySentenceCount, streakDays }
}

function isCustomSentence(value: unknown): value is CustomSentence {
  if (!value || typeof value !== 'object') return false
  const sentence = value as Record<string, unknown>
  return typeof sentence.id === 'string' && typeof sentence.english === 'string' && typeof sentence.korean === 'string' && isDay(sentence.day) && sentence.source === 'custom'
}

export function normalizeAnswer(value: string) {
  return value.toLocaleLowerCase().replace(/[‘’]/g, "'").replace(/[^\p{L}\p{N}'\s]/gu, '').replace(/\s+/g, ' ').trim()
}

const contractionPairs: ReadonlyArray<readonly [string, string[]]> = [
  ["i'll", ['i will']], ["i'm", ['i am']], ["i've", ['i have']],
  ["we're", ['we are']], ["we'll", ['we will']], ["we've", ['we have']],
  ["you're", ['you are']], ["you'll", ['you will']], ["you've", ['you have']],
  ["they're", ['they are']], ["they'll", ['they will']], ["they've", ['they have']],
  ["he's", ['he is']], ["he'll", ['he will']],
  ["she's", ['she is']], ["she'll", ['she will']],
  ["it's", ['it is']], ["it'll", ['it will']],
  ["that's", ['that is']], ["there's", ['there is']], ["here's", ['here is']],
  ["don't", ['do not']], ["doesn't", ['does not']], ["didn't", ['did not']],
  ["can't", ['cannot', 'can not']], ["couldn't", ['could not']], ["won't", ['will not']],
  ["wouldn't", ['would not']], ["shouldn't", ['should not']], ["isn't", ['is not']],
  ["aren't", ['are not']], ["wasn't", ['was not']], ["weren't", ['were not']],
  ["haven't", ['have not']], ["hasn't", ['has not']], ["hadn't", ['had not']],
]

function replaceWholePhrase(value: string, from: string, to: string) {
  return value.replace(new RegExp(`(^| )${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?= |$)`, 'g'), `$1${to}`)
}

/** Returns only explicit, token-bound contraction spellings; it never changes vocabulary or word order. */
export function getContractionEquivalentForms(value: string) {
  const forms = new Set([normalizeAnswer(value)])
  for (let pass = 0; pass < 4; pass += 1) {
    for (const form of [...forms]) {
      for (const [contraction, expansions] of contractionPairs) {
        for (const expansion of expansions) {
          forms.add(replaceWholePhrase(form, contraction, expansion))
          forms.add(replaceWholePhrase(form, expansion, contraction))
        }
      }
    }
  }
  return forms
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
