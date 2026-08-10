import { describe, expect, it } from 'vitest'
import { builtInSentences } from './sentences'

describe('converted 60-day curriculum', () => {
  it('contains the complete source workbook sequence with the app sentence contract', () => {
    expect(builtInSentences).toHaveLength(600)
    expect(builtInSentences).toEqual(expect.arrayContaining([
      { id: 'day-01-01', english: 'Excuse me, do you speak English?', korean: '실례합니다, 영어 하세요?', day: 1, source: 'builtIn' },
      { id: 'day-60-10', english: 'Thank you for making my trip better!', korean: '제 여행을 더 좋게 만들어 주셔서 감사합니다!', day: 60, source: 'builtIn' },
    ]))
    expect(builtInSentences.every((sentence) => sentence.source === 'builtIn' && sentence.english.length > 0 && sentence.korean.length > 0)).toBe(true)
    expect([...new Set(builtInSentences.map((sentence) => sentence.day))]).toEqual(Array.from({ length: 60 }, (_, index) => index + 1))
    expect(builtInSentences.reduce<Record<number, number>>((counts, sentence) => ({ ...counts, [sentence.day]: (counts[sentence.day] ?? 0) + 1 }), {})).toEqual(
      Object.fromEntries(Array.from({ length: 60 }, (_, index) => [index + 1, 10])),
    )
  })
})
