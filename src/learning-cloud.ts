import {
  isPersistableLearningPayload,
  mergeLearningStates,
  parseLearningState,
  type LearningState,
  type CustomSentence,
  type SentenceNote,
} from './learning'

export type LearningProfile = {
  learningState: LearningState
  revision: number
  updatedAt: string
}

export type LearningProfileRow = {
  user_id: string
  learning_state: unknown
  revision: number
  updated_at: string
}

export type LearningGroupMemberRow = {
  group_id: string
  user_id: string
}

export type LearningGroupProfileRow = {
  group_id: string
  learning_state: unknown
  revision: number
  updated_at: string
}

export function hasMeaningfulLearningState(state: LearningState) {
  return state.masteredIds.length > 0
    || state.customSentences.length > 0
    || state.completedChallengeDates.length > 0
    || state.completedSentenceIds.length > 0
    || state.reviewQueueIds.length > 0
    || state.favoriteIds.length > 0
    || state.studyActivities.length > 0
    || Object.keys(state.attemptCounts).length > 0
    || Object.keys(state.sentenceNotes).length > 0
    || Object.keys(state.answerHistory).length > 0
}

function compareProfiles(left: LearningProfile, right: LearningProfile) {
  if (left.revision !== right.revision) return left.revision - right.revision
  return Date.parse(left.updatedAt) - Date.parse(right.updatedAt)
}

function mergeNotes(preferred: Record<string, SentenceNote>, other: Record<string, SentenceNote>) {
  const notes = { ...other, ...preferred }
  for (const id of new Set([...Object.keys(preferred), ...Object.keys(other)])) {
    const left = preferred[id]
    const right = other[id]
    if (left && right) notes[id] = left.updatedAt >= right.updatedAt ? left : right
  }
  return notes
}

export function reconcileLearningProfiles(local: LearningProfile, cloud: LearningProfile): LearningProfile {
  const preferred = compareProfiles(local, cloud) >= 0 ? local : cloud
  const other = preferred === local ? cloud : local
  const merged = mergeLearningStates(preferred.learningState, other.learningState)
  merged.customSentences = preferred.learningState.customSentences
  merged.sentenceNotes = mergeNotes(preferred.learningState.sentenceNotes, other.learningState.sentenceNotes)
  return { learningState: merged, revision: Math.max(local.revision, cloud.revision), updatedAt: preferred.updatedAt }
}

export function shouldReplaceCloudProfile(next: LearningState, cloud: LearningState) {
  return JSON.stringify(next) !== JSON.stringify(cloud)
}

export function mergeCustomSentences(base: CustomSentence[], local: CustomSentence[], cloud: CustomSentence[]) {
  const baseById = new Map(base.map((sentence) => [sentence.id, sentence]))
  const localById = new Map(local.map((sentence) => [sentence.id, sentence]))
  const merged = new Map(cloud.map((sentence) => [sentence.id, sentence]))
  const order = cloud.map((sentence) => sentence.id)
  for (const id of new Set([...baseById.keys(), ...localById.keys()])) {
    const before = baseById.get(id)
    const after = localById.get(id)
    if (JSON.stringify(before) === JSON.stringify(after)) continue
    if (after) {
      merged.set(id, after)
      if (!order.includes(id)) order.push(id)
    } else {
      merged.delete(id)
    }
  }
  return order.flatMap((id) => merged.get(id) ?? [])
}

export function isCurrentAuthOperation(startedGeneration: number, currentGeneration: number, expectedUserId: string | null, currentUserId: string | null) {
  return startedGeneration === currentGeneration && expectedUserId === currentUserId
}

export function mergeOwnedStringSet(base: string[], local: string[], cloud: string[]) {
  const baseSet = new Set(base)
  const localSet = new Set(local)
  const merged = new Set(cloud)
  for (const id of new Set([...base, ...local])) {
    if (baseSet.has(id) === localSet.has(id)) continue
    if (localSet.has(id)) merged.add(id)
    else merged.delete(id)
  }
  return [...merged]
}

export function mergeOwnedRecord<T>(base: Record<string, T>, local: Record<string, T>, cloud: Record<string, T>) {
  const merged = { ...cloud }
  for (const id of new Set([...Object.keys(base), ...Object.keys(local)])) {
    if (JSON.stringify(base[id]) === JSON.stringify(local[id])) continue
    if (local[id] === undefined) delete merged[id]
    else merged[id] = local[id]
  }
  return merged
}

export function rebaseLearningState(base: LearningState, local: LearningState, cloud: LearningState): LearningState {
  const merged = mergeLearningStates(cloud, local)
  const attemptCounts = { ...cloud.attemptCounts }
  for (const id of new Set([...Object.keys(base.attemptCounts), ...Object.keys(local.attemptCounts)])) {
    const before = base.attemptCounts[id] ?? 0
    const after = local.attemptCounts[id] ?? 0
    if (before !== after) attemptCounts[id] = Math.max(0, (cloud.attemptCounts[id] ?? 0) + after - before)
  }
  const sentenceNotes = mergeOwnedRecord(base.sentenceNotes, local.sentenceNotes, cloud.sentenceNotes)
  for (const id of new Set([...Object.keys(base.sentenceNotes), ...Object.keys(local.sentenceNotes)])) {
    const localChanged = JSON.stringify(base.sentenceNotes[id]) !== JSON.stringify(local.sentenceNotes[id])
    const cloudChanged = JSON.stringify(base.sentenceNotes[id]) !== JSON.stringify(cloud.sentenceNotes[id])
    if (localChanged && cloudChanged && local.sentenceNotes[id] && cloud.sentenceNotes[id]) sentenceNotes[id] = local.sentenceNotes[id].updatedAt >= cloud.sentenceNotes[id].updatedAt ? local.sentenceNotes[id] : cloud.sentenceNotes[id]
  }
  return {
    ...merged,
    selectedDay: local.selectedDay !== base.selectedDay ? local.selectedDay : cloud.selectedDay,
    dayPositions: mergeOwnedRecord(base.dayPositions, local.dayPositions, cloud.dayPositions),
    attemptCounts,
    masteredIds: mergeOwnedStringSet(base.masteredIds, local.masteredIds, cloud.masteredIds),
    customSentences: mergeCustomSentences(base.customSentences, local.customSentences, cloud.customSentences),
    completedChallengeDates: mergeOwnedStringSet(base.completedChallengeDates, local.completedChallengeDates, cloud.completedChallengeDates),
    completedSentenceIds: mergeOwnedStringSet(base.completedSentenceIds, local.completedSentenceIds, cloud.completedSentenceIds),
    reviewQueueIds: mergeOwnedStringSet(base.reviewQueueIds, local.reviewQueueIds, cloud.reviewQueueIds),
    favoriteIds: mergeOwnedStringSet(base.favoriteIds, local.favoriteIds, cloud.favoriteIds),
    sentenceNotes,
  }
}

export function parseCloudLearningState(value: unknown): LearningState | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const requiredArrays = ['masteredIds', 'customSentences', 'completedChallengeDates', 'completedSentenceIds', 'reviewQueueIds', 'favoriteIds', 'studyActivities']
  const requiredObjects = ['dayPositions', 'attemptCounts', 'sentenceNotes', 'answerHistory']
  if (!requiredArrays.every((key) => Array.isArray(record[key]))
    || !requiredObjects.every((key) => record[key] !== null && typeof record[key] === 'object' && !Array.isArray(record[key]))) return null
  try {
    const raw = JSON.stringify({ version: 4, state: value })
    if (!isPersistableLearningPayload(raw)) return null
    const parsed = parseLearningState(raw)
    return stableJson(parsed) === stableJson(value) ? parsed : null
  } catch {
    return null
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`
  return JSON.stringify(value)
}
