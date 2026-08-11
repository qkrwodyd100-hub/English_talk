import { describe, expect, it } from 'vitest'
import { builtInDialogues } from './dialogues'
import { builtInSentences } from './sentences'

describe('converted 60-day curriculum', () => {
  it('contains the complete source workbook sequence with the app sentence contract', () => {
    expect(builtInSentences).toHaveLength(600)
    expect(builtInSentences).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'day-01-01', english: 'Excuse me, do you speak English?', korean: '실례합니다, 영어 하세요?', day: 1, source: 'builtIn' }),
      expect.objectContaining({ id: 'day-60-10', english: 'Thank you for making my trip better!', korean: '제 여행을 더 즐겁게 해 주셔서 감사합니다!', day: 60, source: 'builtIn' }),
    ]))
    expect(builtInSentences.every((sentence) => sentence.source === 'builtIn' && sentence.english.length > 0 && sentence.korean.length > 0)).toBe(true)
    expect([...new Set(builtInSentences.map((sentence) => sentence.day))]).toEqual(Array.from({ length: 60 }, (_, index) => index + 1))
    expect(builtInSentences.reduce<Record<number, number>>((counts, sentence) => ({ ...counts, [sentence.day]: (counts[sentence.day] ?? 0) + 1 }), {})).toEqual(
      Object.fromEntries(Array.from({ length: 60 }, (_, index) => [index + 1, 10])),
    )
  })

  it('has stable identifiers and exactly ten sentences for every day', () => {
    expect(new Set(builtInSentences.map(({ id }) => id)).size).toBe(600)
    expect(builtInSentences.map(({ id }) => id)).toEqual(
      Array.from({ length: 60 }, (_, dayIndex) =>
        Array.from({ length: 10 }, (_, sentenceIndex) =>
          `day-${String(dayIndex + 1).padStart(2, '0')}-${String(sentenceIndex + 1).padStart(2, '0')}`,
        ),
      ).flat(),
    )
  })

  it('contains clean primary learning prompts with complete metadata', () => {
    for (const sentence of builtInSentences) {
      expect(sentence.english, sentence.id).not.toMatch(/[가-힣]/)
      expect(sentence.english, sentence.id).not.toMatch(/[\[\]()/]/)
      expect(sentence.korean, sentence.id).not.toMatch(/[\[\]()/]/)
      expect(sentence.topic, sentence.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/)
      expect(['beginner', 'intermediate', 'advanced'], sentence.id).toContain(sentence.level)
      expect([1, 2, 3], sentence.id).toContain(sentence.priority)

      for (const alternative of sentence.alternatives ?? []) {
        expect(alternative.english, sentence.id).not.toMatch(/[가-힣\[\]()/]/)
        expect(alternative.korean, sentence.id).not.toMatch(/[\[\]()/]/)
      }
      for (const slot of sentence.slots ?? []) {
        expect(slot.values.length, `${sentence.id}:${slot.key}`).toBeGreaterThanOrEqual(2)
        expect(new Set(slot.values.map(({ english, korean }) => `${english}\u0000${korean}`)).size, `${sentence.id}:${slot.key}`).toBe(slot.values.length)
        for (const value of slot.values) {
          expect(value.english, `${sentence.id}:${slot.key}`).not.toMatch(/[가-힣\[\]()/]/)
          expect(value.korean, `${sentence.id}:${slot.key}`).not.toMatch(/[\[\]()/]/)
        }
      }
    }
  })

  it('provides one realistic two-to-four-turn mini dialogue for every day', () => {
    expect(builtInDialogues.map(({ day }) => day)).toEqual(Array.from({ length: 60 }, (_, index) => index + 1))
    for (const dialogue of builtInDialogues) {
      expect(dialogue.topic).toBe(builtInSentences.find(({ day }) => day === dialogue.day)?.topic)
      expect(dialogue.turns.length, `day ${dialogue.day}`).toBeGreaterThanOrEqual(2)
      expect(dialogue.turns.length, `day ${dialogue.day}`).toBeLessThanOrEqual(4)
      expect(dialogue.turns.some(({ role }) => role === 'traveler'), `day ${dialogue.day}`).toBe(true)
      expect(dialogue.turns.every(({ english, korean }) => english.length > 0 && korean.length > 0), `day ${dialogue.day}`).toBe(true)
      expect(dialogue.turns.every(({ english }) => !/[가-힣]/.test(english)), `day ${dialogue.day}`).toBe(true)
    }
  })
})
