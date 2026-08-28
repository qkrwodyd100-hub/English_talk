import { useEffect, useMemo, useRef, useState } from 'react'
import type { Sentence } from './learning'
import { createListeningController, createListeningPlaylist, LISTENING_STORAGE_KEY, parseListeningPreferences, type ListeningPlayback, type ListeningPreferences } from './listening-engine'

type Props = { sentences: Sentence[]; currentDay: number; stopSignal: number; onPlaybackChange: (playing: boolean) => void; cancelDictation: () => void }

function preferredVoice(voices: SpeechSynthesisVoice[], lang: 'ko-KR' | 'en-US') {
  const prefix = lang.slice(0, 2).toLowerCase()
  return voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase()) ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix))
}

export default function ListeningPanel({ sentences, currentDay, stopSignal, onPlaybackChange, cancelDictation }: Props) {
  const [preferences, setPreferences] = useState<ListeningPreferences>(() => parseListeningPreferences(window.localStorage.getItem(LISTENING_STORAGE_KEY)))
  const [playback, setPlayback] = useState<ListeningPlayback>({ index: 0, stage: 'idle' })
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const wakeLock = useRef<{ release: () => Promise<void>; released?: boolean } | null>(null)
  const controller = useMemo(() => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return null
    const synth = window.speechSynthesis
    return createListeningController({
      synth,
      makeUtterance: (text) => new SpeechSynthesisUtterance(text),
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
      clearTimeout: (timer) => window.clearTimeout(timer),
      pickVoice: (lang) => preferredVoice(voices.length ? voices : synth.getVoices(), lang),
      onState: (next) => {
        setPlayback(next)
        setPreferences((current) => current.position === next.index ? current : { ...current, position: next.index })
      },
    })
  }, [voices])
  const playlist = useMemo(() => createListeningPlaylist(sentences, preferences.selectedDays, preferences.includeCustom), [sentences, preferences.includeCustom, preferences.selectedDays])
  const item = playlist[playback.index]
  const isPlaying = playback.stage === 'korean' || playback.stage === 'english'

  useEffect(() => { onPlaybackChange(isPlaying); return () => onPlaybackChange(false) }, [isPlaying, onPlaybackChange])
  useEffect(() => { try { window.localStorage.setItem(LISTENING_STORAGE_KEY, JSON.stringify(preferences)) } catch { /* preferences remain usable for this visit */ } }, [preferences])
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    const refresh = () => setVoices(synth.getVoices())
    refresh(); synth.addEventListener?.('voiceschanged', refresh)
    return () => synth.removeEventListener?.('voiceschanged', refresh)
  }, [])
  useEffect(() => () => { controller?.stop(); void wakeLock.current?.release(); wakeLock.current = null }, [controller])
  useEffect(() => { controller?.stop() }, [controller, stopSignal])
  useEffect(() => {
    const stop = () => controller?.stop()
    const onVisibility = () => { if (document.visibilityState !== 'visible') stop() }
    window.addEventListener('pagehide', stop); document.addEventListener('visibilitychange', onVisibility)
    return () => { window.removeEventListener('pagehide', stop); document.removeEventListener('visibilitychange', onVisibility) }
  }, [controller])
  useEffect(() => {
    if (!isPlaying) { void wakeLock.current?.release(); wakeLock.current = null; setWakeLockActive(false); return }
    const request = async () => {
      try {
        const sentinel = await navigator.wakeLock?.request('screen')
        if (!sentinel) return
        wakeLock.current = sentinel; setWakeLockActive(true)
        sentinel.addEventListener?.('release', () => setWakeLockActive(false))
      } catch { setWakeLockActive(false) }
    }
    void request()
  }, [isPlaying])

  function update(next: Partial<ListeningPreferences>) { setPreferences((value) => ({ ...value, ...next })) }
  function selectQuick(days: number[]) { update({ selectedDays: [...new Set(days.filter((day) => day >= 1 && day <= 60))].sort((a, b) => a - b), position: 0 }) }
  function start() {
    if (!controller) { setPlayback({ index: 0, stage: 'error', message: '이 브라우저에서는 음성 재생을 지원하지 않습니다. 화면의 한글과 영어를 읽어 보세요.' }); return }
    cancelDictation()
    controller.start(playlist, preferences, preferences.position)
  }
  function label() { return playback.stage === 'korean' ? '한국어 재생 중' : playback.stage === 'english' ? '영어 재생 중' : playback.stage === 'paused' ? '일시정지' : playback.stage === 'complete' ? '완료' : playback.stage === 'error' ? '재생 오류' : '재생 준비' }

  return <section className={`listening-panel ${preferences.drivingMode ? 'driving-mode' : ''}`} aria-labelledby="listening-heading">
    <div className="panel-heading"><div><p className="eyebrow">Hands-free listening</p><h2 id="listening-heading">듣기 학습</h2></div><label className="filter"><input type="checkbox" checked={preferences.drivingMode} onChange={(event) => update({ drivingMode: event.target.checked })} /> 운전·운동 모드</label></div>
    <p className="safety-copy"><strong>출발 전에 Day와 속도를 설정하세요.</strong> 운전 중에는 화면을 조작하지 말고, 화면을 계속 볼 필요가 없도록 재생을 준비해 주세요.</p>
    <fieldset className="listening-days"><legend>들을 Day 선택</legend><div className="quick-actions"><button type="button" onClick={() => selectQuick([currentDay])}>현재 Day</button><button type="button" onClick={() => selectQuick(Array.from({ length: 3 }, (_, i) => currentDay + i))}>현재 Day부터 3일</button><button type="button" onClick={() => selectQuick(Array.from({ length: 7 }, (_, i) => currentDay + i))}>7일</button><button type="button" onClick={() => selectQuick(Array.from({ length: 60 }, (_, i) => i + 1))}>전체 선택</button><button type="button" onClick={() => selectQuick([])}>전체 해제</button></div><div className="day-checkboxes">{Array.from({ length: 60 }, (_, i) => i + 1).map((day) => <label key={day}><input type="checkbox" checked={preferences.selectedDays.includes(day)} onChange={(event) => selectQuick(event.target.checked ? [...preferences.selectedDays, day] : preferences.selectedDays.filter((value) => value !== day))} /> Day {day}</label>)}</div></fieldset>
    <p className="selection-summary">선택: {preferences.selectedDays.length ? preferences.selectedDays.map((day) => `Day ${day}`).join(', ') : '없음'} · 기본 문장 {playlist.length}개</p>
    <label className="filter"><input type="checkbox" checked={preferences.includeCustom} onChange={(event) => update({ includeCustom: event.target.checked })} /> 내 문장도 포함</label>
    <div className="listening-settings"><label>한국어 속도 <input aria-label="한국어 속도" type="range" min="0.5" max="1.2" step="0.05" value={preferences.koreanRate} onChange={(event) => update({ koreanRate: Number(event.target.value) })} /><output>{preferences.koreanRate.toFixed(2)}배</output></label><label>영어 속도 <input aria-label="영어 속도" type="range" min="0.5" max="1.2" step="0.05" value={preferences.englishRate} onChange={(event) => update({ englishRate: Number(event.target.value) })} /><output>{preferences.englishRate.toFixed(2)}배</output></label><label>언어 사이 간격 <select value={preferences.pauseMs} onChange={(event) => update({ pauseMs: Number(event.target.value) })}><option value={300}>0.3초</option><option value={600}>0.6초</option><option value={900}>0.9초</option></select></label></div>
    <article className="now-playing" aria-live="polite"><p><strong>{label()}</strong> · {item ? `Day ${item.day} · ${playback.index + 1} / ${playlist.length}` : `0 / ${playlist.length}`}</p>{item ? <><strong className="now-korean">한국어: {item.korean}</strong><span>English: {item.english}</span></> : <p>Day를 선택한 뒤 재생을 시작하세요.</p>}<small>{wakeLockActive ? '화면 켜짐 유지 활성' : '화면 켜짐 유지는 브라우저가 허용할 때만 활성화됩니다.'}</small>{playback.message && <p role="alert">{playback.message}</p>}</article>
    <div className="listening-controls"><button type="button" className="button" onClick={start} disabled={!playlist.length}>재생 시작</button><button type="button" className="button secondary" onClick={() => controller?.pause()} disabled={!isPlaying}>일시정지</button><button type="button" className="button secondary" onClick={() => controller?.resume()} disabled={playback.stage !== 'paused'}>다시 재생</button><button type="button" className="button secondary" onClick={() => controller?.stop()}>중지</button><button type="button" className="button secondary" aria-label="이전 문장" onClick={() => controller?.previous()} disabled={!playlist.length}>이전</button><button type="button" className="button secondary" aria-label="다음 문장" onClick={() => controller?.next()} disabled={!playlist.length}>다음</button><button type="button" className="button secondary" onClick={() => controller?.repeat()} disabled={!item}>현재 반복</button><label className="repeat-toggle"><input type="checkbox" checked={preferences.repeatAll} onChange={(event) => update({ repeatAll: event.target.checked })} /> 전체 반복</label></div>
    <p className="hint">브라우저가 백그라운드·잠금 화면에서 음성 재생을 중단할 수 있습니다. 이 기능은 그 상태의 연속 재생을 보장하지 않습니다.</p>
  </section>
}
