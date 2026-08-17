import { describe, expect, it } from 'vitest'
import { createEmptyLearningState, type LearningState } from './learning'
import {
  hasMeaningfulLearningState,
  isCurrentAuthOperation,
  mergeCustomSentences,
  mergeOwnedRecord,
  mergeOwnedStringSet,
  parseCloudLearningState,
  reconcileLearningProfiles,
  rebaseLearningState,
  shouldReplaceCloudProfile,
  type LearningProfile,
} from './learning-cloud'

function state(overrides: Partial<LearningState>): LearningState {
  return { ...createEmptyLearningState(), ...overrides }
}

function profile(learningState: LearningState, revision: number, updatedAt: string): LearningProfile {
  return { learningState, revision, updatedAt }
}

describe('learning cloud reconciliation', () => {
  it('does not consider defaults or malformed parsed data uploadable', () => {
    expect(hasMeaningfulLearningState(createEmptyLearningState())).toBe(false)
    expect(hasMeaningfulLearningState(state({ selectedDay: 1 }))).toBe(false)
    expect(hasMeaningfulLearningState(state({ completedSentenceIds: ['day-01-01'] }))).toBe(true)
    expect(hasMeaningfulLearningState(state({ sentenceNotes: { 'day-01-01': { text: 'remember this', updatedAt: '2026-08-14T01:00:00.000Z' } } }))).toBe(true)
    expect(parseCloudLearningState({ broken: true })).toBeNull()
    expect(parseCloudLearningState(createEmptyLearningState())).toEqual(createEmptyLearningState())
  })

  it('uses the newer profile for positional values while unioning owned sets and history', () => {
    const local = profile(state({
      selectedDay: 4,
      dayPositions: { 4: 3 },
      masteredIds: ['local-mastered'],
      favoriteIds: ['shared-favorite'],
      studyActivities: [{ timestamp: '2026-08-14T02:00:00.000Z', day: 4, sentenceId: 'local-mastered', action: 'mastered' }],
      sentenceNotes: { 'shared-favorite': { text: 'new local note', updatedAt: '2026-08-14T02:00:00.000Z' } },
    }), 8, '2026-08-14T02:00:00.000Z')
    const cloud = profile(state({
      selectedDay: 2,
      dayPositions: { 2: 8 },
      masteredIds: ['cloud-mastered'],
      favoriteIds: ['cloud-favorite'],
      studyActivities: [{ timestamp: '2026-08-13T02:00:00.000Z', day: 2, sentenceId: 'cloud-mastered', action: 'mastered' }],
      sentenceNotes: { 'shared-favorite': { text: 'old cloud note', updatedAt: '2026-08-13T02:00:00.000Z' } },
    }), 7, '2026-08-13T02:00:00.000Z')

    const merged = reconcileLearningProfiles(local, cloud)

    expect(merged.learningState).toMatchObject({
      selectedDay: 4,
      dayPositions: { 2: 8, 4: 3 },
      masteredIds: ['local-mastered', 'cloud-mastered'],
      favoriteIds: ['shared-favorite', 'cloud-favorite'],
      sentenceNotes: { 'shared-favorite': { text: 'new local note' } },
    })
    expect(merged.learningState.studyActivities).toHaveLength(2)
    expect(merged.revision).toBe(8)
  })

  it('prefers revision before timestamps and only writes when local content changes', () => {
    const local = profile(state({ selectedDay: 5, completedSentenceIds: ['local'] }), 3, '2026-08-14T04:00:00.000Z')
    const cloud = profile(state({ selectedDay: 7, completedSentenceIds: ['cloud'] }), 4, '2026-08-14T03:00:00.000Z')
    const merged = reconcileLearningProfiles(local, cloud)

    expect(merged.learningState.selectedDay).toBe(7)
    expect(merged.learningState.completedSentenceIds).toEqual(['cloud', 'local'])
    expect(shouldReplaceCloudProfile(merged.learningState, cloud.learningState)).toBe(true)
    expect(shouldReplaceCloudProfile(cloud.learningState, cloud.learningState)).toBe(false)
  })

  it('propagates a newer custom-content deletion instead of resurrecting stale cloud content', () => {
    const local = profile(state({ customSentences: [] }), 6, '2026-08-14T06:00:00.000Z')
    const cloud = profile(state({ customSentences: [{ id: 'custom-stale', english: 'Old.', korean: '오래됨', day: 1, source: 'custom' }] }), 5, '2026-08-14T05:00:00.000Z')
    expect(reconcileLearningProfiles(local, cloud).learningState.customSentences).toEqual([])
  })

  it('three-way merges concurrent custom additions while preserving intentional deletions', () => {
    const original = { id: 'custom-original', english: 'Original.', korean: '원본', day: 1, source: 'custom' as const }
    const remote = { id: 'custom-remote', english: 'Remote.', korean: '원격', day: 2, source: 'custom' as const }
    const local = { id: 'custom-local', english: 'Local.', korean: '로컬', day: 3, source: 'custom' as const }
    expect(mergeCustomSentences([original], [original, local], [original, remote])).toEqual([original, remote, local])
    expect(mergeCustomSentences([original], [], [original, remote])).toEqual([remote])
  })

  it('rejects stale authentication completions after a session transition', () => {
    expect(isCurrentAuthOperation(4, 4, 'user-a', 'user-a')).toBe(true)
    expect(isCurrentAuthOperation(4, 5, 'user-a', 'user-b')).toBe(false)
    expect(isCurrentAuthOperation(4, 4, 'user-a', null)).toBe(false)
  })

  it('three-way merges removable owned sets and records', () => {
    expect(mergeOwnedStringSet(['keep', 'remove'], ['keep', 'local'], ['keep', 'remove', 'remote'])).toEqual(['keep', 'remote', 'local'])
    expect(mergeOwnedRecord({ old: { value: 1 } }, {}, { old: { value: 1 }, remote: { value: 2 } })).toEqual({ remote: { value: 2 } })
  })

  it('rebases offline and in-flight local edits without replacing untouched cloud progress', () => {
    const base = state({ selectedDay: 1, favoriteIds: ['remove'], attemptCounts: { sentence: 1 }, sentenceNotes: { sentence: { text: 'base', updatedAt: '2026-08-14T01:00:00.000Z' } }, customSentences: [{ id: 'delete-me', english: 'Delete.', korean: '삭제', day: 1, source: 'custom' }] })
    const local = state({ selectedDay: 1, favoriteIds: ['local'], attemptCounts: { sentence: 2 }, sentenceNotes: { sentence: { text: 'older local', updatedAt: '2026-08-14T02:00:00.000Z' } }, customSentences: [] })
    const cloud = state({ selectedDay: 5, favoriteIds: ['remove', 'remote'], attemptCounts: { sentence: 3 }, sentenceNotes: { sentence: { text: 'newer remote', updatedAt: '2026-08-14T03:00:00.000Z' } }, customSentences: [{ id: 'delete-me', english: 'Delete.', korean: '삭제', day: 1, source: 'custom' }, { id: 'remote', english: 'Remote.', korean: '원격', day: 2, source: 'custom' }] })
    expect(rebaseLearningState(base, local, cloud)).toMatchObject({ selectedDay: 5, favoriteIds: ['remote', 'local'], attemptCounts: { sentence: 4 }, sentenceNotes: { sentence: { text: 'newer remote' } }, customSentences: [{ id: 'remote' }] })
  })

  it('keeps a manual Day selection coupled during cloud rebase', () => {
    const base = state({ selectedDay: 1 })
    const local = state({ selectedDay: 1, selectedDayIsManual: true })
    const cloud = state({ selectedDay: 5 })

    expect(rebaseLearningState(base, local, cloud)).toMatchObject({ selectedDay: 1, selectedDayIsManual: true })
  })
})
