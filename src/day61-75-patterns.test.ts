import { describe, expect, it } from 'vitest'
import { builtInDialogues } from './dialogues'
import { builtInSentences } from './sentences'
import dialoguesRaw from './dialogues.ts?raw'
import sentencesRaw from './sentences.ts?raw'

// New legitimate beginner spec for Day 61-75 (CURRICULUM-BEGINNER-1):
// reuse first60-day knowledge through short everyday substitution patterns.
// Zero advanced in days 61-75, >= 6 beginner per day.

function sha256Hex(text: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then((buf) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''),
  )
}

// Independently captured baseline digests (first60 slices, taken before any edit).
const BASELINE_SENTENCES_FIRST60_SHA = '800af9e2a74477a9ed8874525c12e74c1ba532bf9175f93504a3f6287dd512f9'
const BASELINE_DIALOGUES_FIRST60_SHA = '3e9bf0f96f058b3ae915ea884bed0322277bb9639d1c2a0e4c8741167f42348c'

function sliceBefore(marker: string, raw: string): string {
  const idx = raw.indexOf(marker)
  expect(idx, `marker missing: ${marker}`).toBeGreaterThan(0)
  return raw.slice(0, idx + 1) // keep trailing newline: byte-identical to head -n slice
}

const newSentences = builtInSentences.filter((s) => s.day >= 61)
const norm = (t: string) => t.toLowerCase().replace(/[?!.,']/g, '')

describe('day61-75 practical-patterns curriculum shape', () => {
  it('keeps 150 sentences, 10 per day, stable IDs and day/topic contracts', () => {
    expect(newSentences).toHaveLength(150)
    for (let day = 61; day <= 75; day += 1) {
      const items = newSentences.filter((s) => s.day === day)
      expect(items.map((s) => s.id)).toEqual(
        Array.from({ length: 10 }, (_, i) => `day-${day}-${String(i + 1).padStart(2, '0')}`),
      )
    }
    expect(new Set(newSentences.map((s) => s.id)).size).toBe(150)
    const topics = (day: number) => [...new Set(newSentences.filter((s) => s.day === day).map((s) => s.topic))]
    expect(topics(61)).toEqual(['airport-transit-advanced'])
    expect(topics(62)).toEqual(['airport-transit-advanced'])
    expect(topics(63)).toEqual(['urban-transit-advanced'])
    expect(topics(64)).toEqual(['urban-transit-advanced'])
    expect(topics(65)).toEqual(['restaurant-bar-advanced'])
    expect(topics(66)).toEqual(['restaurant-bar-advanced'])
    expect(topics(67)).toEqual(['restaurant-bar-advanced'])
    expect(topics(68)).toEqual(['golf-course-basics'])
    expect(topics(69)).toEqual(['golf-course-basics'])
    expect(topics(70)).toEqual(['golf-course-basics'])
    expect(topics(71)).toEqual(['department-store-advanced'])
    expect(topics(72)).toEqual(['department-store-advanced'])
    expect(topics(73)).toEqual(['daily-life-integration'])
    expect(topics(74)).toEqual(['daily-life-integration'])
    expect(topics(75)).toEqual(['daily-life-integration'])
  })

  it('has zero advanced and at least 6 beginner sentences every day', () => {
    expect(newSentences.some((s) => s.level === 'advanced')).toBe(false)
    for (let day = 61; day <= 75; day += 1) {
      const items = newSentences.filter((s) => s.day === day)
      expect(items.every((s) => s.level === 'beginner' || s.level === 'intermediate')).toBe(true)
      expect(items.filter((s) => s.level === 'beginner').length, `day ${day}`).toBeGreaterThanOrEqual(6)
    }
  })

  it('keeps beginner chunks short and intermediate extensions manageable', () => {
    for (const s of newSentences) {
      const words = s.english.split(/\s+/).length
      if (s.level === 'beginner') expect(words, s.id).toBeLessThanOrEqual(12)
      else expect(words, s.id).toBeLessThanOrEqual(18)
    }
  })

  it('reuses the required everyday substitution patterns across situations', () => {
    const en = newSentences.map((s) => norm(s.english))
    const count = (re: RegExp) => en.filter((t) => re.test(t)).length
    expect(count(/^can i\b/), 'Can I').toBeGreaterThanOrEqual(8)
    expect(count(/^could you\b/), 'Could you').toBeGreaterThanOrEqual(6)
    expect(count(/\bi(d| would) like\b/), "I'd like").toBeGreaterThanOrEqual(4)
    expect(count(/^do you have\b/), 'Do you have').toBeGreaterThanOrEqual(6)
    expect(count(/^where can i\b/), 'Where can I').toBeGreaterThanOrEqual(3)
    expect(count(/^how long\b/), 'How long').toBeGreaterThanOrEqual(3)
    expect(count(/included/), 'included').toBeGreaterThanOrEqual(2)
    expect(count(/^i need\b/), 'I need').toBeGreaterThanOrEqual(3)
    expect(count(/i(m| am) looking for/), "I'm looking for").toBeGreaterThanOrEqual(3)
    expect(count(/^can we\b/), 'Can we').toBeGreaterThanOrEqual(2)
  })

  it('includes conversational rescue patterns', () => {
    const en = newSentences.map((s) => norm(s.english))
    const any = (re: RegExp) => en.some((t) => re.test(t))
    expect(any(/say that again/), 'say that again').toBe(true)
    expect(any(/speak more slowly/), 'speak more slowly').toBe(true)
    expect(any(/what does .* mean/), 'What does ... mean').toBe(true)
    expect(any(/do you mean/), 'Do you mean').toBe(true)
    expect(any(/is that right/), 'Is that right').toBe(true)
  })

  it('removes forced-advanced jargon, legalese, and awkward pinned wording', () => {
    const texts = newSentences.flatMap((s) => [
      s.english.toLowerCase(),
      s.korean,
      ...(s.alternatives ?? []).flatMap((a) => [a.english.toLowerCase(), a.korean]),
    ])
    const banned = [
      'endorse my ticket',
      'entitled to compensation',
      'decant',
      'corked',
      'vintage',
      'penalty fare',
      '외상 장부',
      '성수기',
      'lost my transfer',
      'pair us kindly',
      'my flight, my bag',
      'dispute on my receipt',
      'would like to dispute',
      'red channel',
      'cross contact',
      'written statement',
      'inbound flight',
      'back nine',
    ]
    for (const word of banned) {
      expect(texts.some((t) => t.includes(word)), `banned: ${word}`).toBe(false)
    }
  })

  it('makes day 75 practical repair/help/confirmation/thanks, not self-congratulation', () => {
    const day75 = newSentences.filter((s) => s.day === 75).map((s) => s.english.toLowerCase())
    for (const p of ['say that again', 'speak more slowly', 'what does', 'do you mean', 'is that right']) {
      expect(day75.some((t) => t.includes(p)), p).toBe(true)
    }
    expect(day75.some((t) => t.includes('thank'))).toBe(true)
    expect(day75.some((t) => t.includes('help'))).toBe(true)
    for (const bad of ['seventy five days', 'speak with courage', 'feels natural', 'no longer scare', 'kept my manners', 'missed my flight']) {
      expect(day75.some((t) => t.includes(bad)), `day75 banned: ${bad}`).toBe(false)
    }
  })

  it('retains at least 20 easy same-meaning alternatives without harder formal wording', () => {
    const withAlt = newSentences.filter((s) => (s.alternatives?.length ?? 0) > 0)
    expect(withAlt.length).toBeGreaterThanOrEqual(20)
    for (const s of withAlt) {
      for (const a of s.alternatives ?? []) {
        expect(a.english.split(/\s+/).length, `${s.id} alt`).toBeLessThanOrEqual(14)
        expect(a.english.toLowerCase(), `${s.id} alt`).not.toMatch(/inbound|penalty fare|written statement|vintage|hereby|pursuant/)
      }
    }
  })

  it('keeps 15 coherent dialogues aligned to the day sentence patterns', () => {
    const dialogues = builtInDialogues.filter((d) => d.day >= 61)
    expect(dialogues.map((d) => d.day)).toEqual(Array.from({ length: 15 }, (_, i) => i + 61))
    for (const d of dialogues) {
      expect(d.turns.length, `day ${d.day}`).toBeGreaterThanOrEqual(2)
      expect(d.turns.length, `day ${d.day}`).toBeLessThanOrEqual(4)
      expect(d.turns.some((t) => t.role === 'traveler'), `day ${d.day}`).toBe(true)
      expect(d.topic, `day ${d.day}`).toBe(newSentences.find((s) => s.day === d.day)?.topic)
      const dayEn = [
        ...newSentences.filter((s) => s.day === d.day).map((s) => norm(s.english)),
        ...newSentences.filter((s) => s.day === d.day).flatMap((s) => (s.alternatives ?? []).map((a) => norm(a.english))),
      ]
      const travelerOk = d.turns
        .filter((t) => t.role === 'traveler')
        .some((t) => {
          const n = norm(t.english)
          const head = n.split(' ').slice(0, 3).join(' ')
          return dayEn.includes(n) || dayEn.some((e) => e.startsWith(head))
        })
      expect(travelerOk, `day ${d.day} traveler aligns to sentence patterns`).toBe(true)
    }
  })

  it('preserves the first60 curriculum byte-for-byte (baseline digest)', async () => {
    expect(await sha256Hex(sliceBefore('\n  {\n    "id": "day-61-01",', sentencesRaw))).toBe(BASELINE_SENTENCES_FIRST60_SHA)
    expect(await sha256Hex(sliceBefore('\n  {\n    "day": 61,', dialoguesRaw))).toBe(BASELINE_DIALOGUES_FIRST60_SHA)
    const legacy = builtInSentences.filter((s) => s.day <= 60)
    expect(legacy).toHaveLength(600)
    expect(new Set(legacy.map((s) => s.id)).size).toBe(600)
  })
})
