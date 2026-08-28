import type { Sentence } from './learning'

export type ListeningPreferences = {
  selectedDays: number[]
  includeCustom: boolean
  koreanRate: number
  englishRate: number
  pauseMs: number
  repeatAll: boolean
  drivingMode: boolean
  position: number
}

export type ListeningStage = 'idle' | 'korean' | 'english' | 'paused' | 'complete' | 'error'
export type ListeningPlayback = { index: number; stage: ListeningStage; message?: string }

type SynthLike = { speak: (utterance: any) => void; cancel: () => void; pause: () => void; resume: () => void }

export const LISTENING_STORAGE_KEY = 'english-talk.listening.v1'
export const defaultListeningPreferences: ListeningPreferences = { selectedDays: [], includeCustom: false, koreanRate: 0.85, englishRate: 0.92, pauseMs: 600, repeatAll: false, drivingMode: false, position: 0 }

export function parseListeningPreferences(raw: string | null): ListeningPreferences {
  try {
    const value = JSON.parse(raw ?? '') as Partial<ListeningPreferences>
    const selectedDays = Array.isArray(value.selectedDays) ? [...new Set(value.selectedDays.filter((day) => Number.isInteger(day) && day >= 1 && day <= 60))].sort((a, b) => a - b) : []
    return { ...defaultListeningPreferences, ...value, selectedDays, position: Number.isInteger(value.position) && (value.position ?? -1) >= 0 ? value.position! : 0,
      koreanRate: validRate(value.koreanRate, defaultListeningPreferences.koreanRate), englishRate: validRate(value.englishRate, defaultListeningPreferences.englishRate), pauseMs: validPause(value.pauseMs) }
  } catch { return { ...defaultListeningPreferences } }
}

function validRate(rate: unknown, fallback: number) { return typeof rate === 'number' && rate >= 0.5 && rate <= 1.5 ? rate : fallback }
function validPause(pause: unknown) { return typeof pause === 'number' && pause >= 0 && pause <= 3000 ? pause : defaultListeningPreferences.pauseMs }

export function createListeningPlaylist(sentences: Sentence[], selectedDays: number[], includeCustom: boolean) {
  const days = new Set(selectedDays)
  return sentences.filter((sentence) => days.has(sentence.day) && (includeCustom || sentence.source === 'builtIn'))
    .sort((left, right) => left.day - right.day || sentences.indexOf(left) - sentences.indexOf(right))
}

export function createListeningController(deps: {
  synth: SynthLike
  makeUtterance: (text: string) => any
  setTimeout: (callback: () => void, ms?: number) => ReturnType<typeof setTimeout>
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void
  onState: (state: ListeningPlayback) => void
  pickVoice?: (lang: 'ko-KR' | 'en-US') => SpeechSynthesisVoice | undefined
}) {
  let playlist: Sentence[] = []
  let preferences = defaultListeningPreferences
  let index = 0
  let stage: ListeningStage = 'idle'
  let pausedStage: 'korean' | 'english' = 'korean'
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const publish = (message?: string) => deps.onState({ index, stage, message })
  const clear = () => { if (timer) deps.clearTimeout(timer); timer = undefined }
  const cancel = () => { generation += 1; clear(); try { deps.synth.cancel() } catch { /* cancellation is best effort */ } }
  const schedule = (callback: () => void, ms: number, token: number) => { timer = deps.setTimeout(() => { if (generation === token && stage !== 'paused') callback() }, ms) }
  const speak = (text: string, lang: 'ko-KR' | 'en-US', rate: number, token: number, onend: () => void) => {
    const utterance = deps.makeUtterance(text)
    utterance.text = text; utterance.lang = lang; utterance.rate = rate; utterance.voice = deps.pickVoice?.(lang) ?? null
    utterance.onend = () => { if (generation === token && stage !== 'paused') onend() }
    utterance.onerror = () => { if (generation === token) { stage = 'error'; publish('음성 재생이 중단되었습니다. 다시 재생하거나 텍스트를 확인하세요.') } }
    try { deps.synth.speak(utterance) } catch { stage = 'error'; publish('음성 재생을 시작할 수 없습니다. 텍스트를 확인하세요.') }
  }
  const speakKorean = (token: number) => {
    const item = playlist[index]
    if (!item) { stage = 'complete'; publish(); return }
    stage = 'korean'; publish()
    speak(item.korean, 'ko-KR', preferences.koreanRate, token, () => schedule(() => speakEnglish(token), preferences.pauseMs, token))
  }
  const speakEnglish = (token: number) => {
    const item = playlist[index]
    if (!item) return
    stage = 'english'; publish()
    speak(item.english, 'en-US', preferences.englishRate, token, () => schedule(() => {
      if (index + 1 < playlist.length) { index += 1; speakKorean(token) }
      else if (preferences.repeatAll && playlist.length) { index = 0; speakKorean(token) }
      else { stage = 'complete'; publish() }
    }, preferences.pauseMs, token))
  }
  return {
    start(nextPlaylist: Sentence[], nextPreferences: Pick<ListeningPreferences, 'koreanRate' | 'englishRate' | 'pauseMs'> & Partial<Pick<ListeningPreferences, 'repeatAll'>>, startIndex = 0) {
      cancel(); playlist = nextPlaylist; preferences = { ...defaultListeningPreferences, ...nextPreferences }; index = Math.min(Math.max(0, startIndex), Math.max(0, playlist.length - 1)); const token = generation
      if (!playlist.length) { stage = 'error'; publish('먼저 들을 Day를 선택하세요.'); return }
      speakKorean(token)
    },
    pause() { if (stage === 'korean' || stage === 'english') { pausedStage = stage; try { deps.synth.pause() } catch { /* browser may have interrupted already */ }; stage = 'paused'; publish() } },
    resume() { if (stage === 'paused') { try { deps.synth.resume() } catch { /* state remains recoverable */ }; stage = pausedStage; publish() } },
    stop() { cancel(); stage = 'idle'; index = 0; publish() },
    next() { if (!playlist.length) return; cancel(); index = Math.min(index + 1, playlist.length - 1); const token = generation; speakKorean(token) },
    previous() { if (!playlist.length) return; cancel(); index = Math.max(index - 1, 0); const token = generation; speakKorean(token) },
    repeat() { if (!playlist.length) return; cancel(); const token = generation; speakKorean(token) },
  }
}
