import { describe, expect, it, vi } from 'vitest'
import { createListeningController, createListeningPlaylist, parseListeningPreferences } from './listening-engine'
import type { Sentence } from './learning'

const sentences: Sentence[] = [
  { id: 'day-02-01', day: 2, korean: '둘', english: 'Two', source: 'builtIn', topic: 'test', level: 'beginner', priority: 1 },
  { id: 'day-01-02', day: 1, korean: '하나 둘', english: 'One two', source: 'builtIn', topic: 'test', level: 'beginner', priority: 1 },
  { id: 'day-01-01', day: 1, korean: '하나', english: 'One', source: 'builtIn', topic: 'test', level: 'beginner', priority: 1 },
  { id: 'custom-01', day: 1, korean: '내 문장', english: 'My sentence', source: 'custom' },
]

describe('listening playlist', () => {
  it('normalizes arbitrary Day selection into day then source order without custom sentences', () => {
    expect(createListeningPlaylist(sentences, [2, 1], false).map((item) => item.id)).toEqual(['day-01-02', 'day-01-01', 'day-02-01'])
  })

  it('does not convert corrupt stored preferences into an all-Day queue', () => {
    expect(parseListeningPreferences('{bad json}')).toMatchObject({ selectedDays: [], includeCustom: false })
  })
})

describe('listening controller', () => {
  it('resumes the paused language stage without re-speaking or skipping it', () => {
    const synth = { speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() }
    const states: Array<{ stage: string }> = []
    const controller = createListeningController({ synth, makeUtterance: () => ({}), setTimeout: () => 1, clearTimeout: vi.fn(), onState: (state) => states.push(state) })
    controller.start(createListeningPlaylist(sentences, [1], false), { koreanRate: 0.85, englishRate: 0.95, pauseMs: 600 })
    controller.pause()
    controller.resume()

    expect(synth.speak).toHaveBeenCalledTimes(1)
    expect(synth.pause).toHaveBeenCalledTimes(1)
    expect(synth.resume).toHaveBeenCalledTimes(1)
    expect(states.map((state) => state.stage)).toEqual(['korean', 'paused', 'korean'])
  })

  it('speaks Korean then English, ignores a stale callback, and advances only after the matching English end', () => {
    const spoken: Array<{ text: string; lang: string; rate: number; onend?: () => void }> = []
    const synth = { speak: vi.fn((utterance) => spoken.push(utterance)), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() }
    const state = vi.fn()
    const controller = createListeningController({ synth, makeUtterance: () => ({}), setTimeout: (callback) => { callback(); return 1 }, clearTimeout: vi.fn(), onState: state })
    controller.start(createListeningPlaylist(sentences, [1], false), { koreanRate: 0.85, englishRate: 0.95, pauseMs: 0 })

    expect(spoken.map(({ text, lang, rate }) => ({ text, lang, rate }))).toEqual([{ text: '하나 둘', lang: 'ko-KR', rate: 0.85 }])
    const staleKoreanEnd = spoken[0].onend!
    staleKoreanEnd()
    expect(spoken[1]).toMatchObject({ text: 'One two', lang: 'en-US', rate: 0.95 })
    controller.next()
    staleKoreanEnd()
    expect(spoken.filter(({ text }) => text === 'One two')).toHaveLength(1)
    spoken[2].onend!()
    spoken[3].onend!()
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({ index: 1, stage: 'complete' }))
  })
})
