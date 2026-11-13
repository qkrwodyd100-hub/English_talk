import { useEffect, useRef, useState } from 'react'
import {
  advanceTutorSession,
  createTutorSession,
  tutorScenarios,
  tutorSummary,
  type TutorScenario,
  type TutorSession,
} from './tutor-engine'
import { builtInSentences } from './sentences'

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort?: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getRecognition(): SpeechRecognitionConstructor | null {
  const browser = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ?? null
}

export default function TutorPanel() {
  const [scenario, setScenario] = useState<TutorScenario>(tutorScenarios[0])
  const [session, setSession] = useState<TutorSession>(() => createTutorSession(tutorScenarios[0]))
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  const step = scenario.steps[Math.min(session.stepIndex, scenario.steps.length - 1)]

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [session.turns.length])

  useEffect(() => () => {
    try { recognition.current?.abort?.() ?? recognition.current?.stop() } catch { /* already stopped */ }
    try { window.speechSynthesis?.cancel() } catch { /* audio unavailable */ }
  }, [])

  function speak(text: string) {
    if (!('speechSynthesis' in window)) {
      setNotice('이 브라우저에서는 음성 재생을 지원하지 않습니다. 텍스트로 계속 연습할 수 있습니다.')
      return
    }
    try {
      const synth = window.speechSynthesis
      synth.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.voice = pickEnglishVoice()
      utterance.lang = 'en-US'
      utterance.rate = 0.92
      synth.speak(utterance)
    } catch {
      setNotice('음성 재생을 시작할 수 없습니다. 텍스트로 계속 연습할 수 있습니다.')
    }
  }

  function restart(next: TutorScenario) {
    try { recognition.current?.abort?.() ?? recognition.current?.stop() } catch { /* already stopped */ }
    recognition.current = null
    setIsListening(false)
    try { window.speechSynthesis?.cancel() } catch { /* audio unavailable */ }
    setScenario(next)
    setSession(createTutorSession(next))
    setDraft('')
    setShowHint(false)
    setNotice('선생님의 첫 말을 듣고 영어로 답해 보세요.')
    speak(next.steps[0].coachOpener)
  }

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || session.done) return
    const result = advanceTutorSession(scenario, session, trimmed)
    setSession(result.session)
    setDraft('')
    setShowHint(false)
    setNotice(result.matched ? '잘했어요! 다음 말을 이어 보세요.' : result.assisted ? '모범 답안을 보여줬어요. 듣고 다음으로 넘어가세요.' : '다시 한 번 짧게 말해 보세요.')
    speak(result.coachReply)
  }

  function toggleListening() {
    const Recognition = getRecognition()
    if (!Recognition) {
      setNotice('이 브라우저에서는 음성 입력을 지원하지 않습니다. 텍스트 입력으로 계속 연습할 수 있습니다.')
      return
    }
    if (isListening) {
      try { recognition.current?.abort?.() ?? recognition.current?.stop() } catch { /* already stopped */ }
      recognition.current = null
      setIsListening(false)
      return
    }
    const instance = new Recognition()
    instance.lang = 'en-US'
    instance.interimResults = false
    instance.continuous = false
    let gotFinal = false
    instance.onresult = (event) => {
      if (recognition.current !== instance || gotFinal) return
      const result = event.results[0]?.[0]
      if (!result || result.isFinal === false) return
      const transcript = result.transcript.trim()
      if (!transcript) return
      gotFinal = true
      send(transcript)
    }
    instance.onerror = (event) => {
      if (recognition.current !== instance) return
      recognition.current = null
      setIsListening(false)
      setNotice(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? '마이크 권한이 거부되었습니다. 텍스트 입력으로 계속 연습할 수 있습니다.'
        : event.error === 'no-speech'
          ? '음성이 감지되지 않았습니다. 다시 시도하거나 텍스트로 입력하세요.'
          : '음성 입력 중 오류가 발생했습니다. 텍스트 입력으로 계속 연습할 수 있습니다.')
    }
    instance.onend = () => {
      if (recognition.current !== instance) return
      recognition.current = null
      setIsListening(false)
    }
    recognition.current = instance
    try {
      instance.start()
      setIsListening(true)
      setNotice('듣는 중입니다. 영어로 말하세요.')
    } catch {
      recognition.current = null
      setNotice('음성 입력을 시작할 수 없습니다. 텍스트 입력으로 계속 연습할 수 있습니다.')
    }
  }

  const summary = session.done ? tutorSummary(scenario, session) : null
  const sentenceById = new Map(builtInSentences.map((sentence) => [sentence.id, sentence]))

  return (
    <section className="study-panel" aria-labelledby="tutor-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Conversation tutor</p>
          <h2 id="tutor-heading">선생님과 전화영어처럼 대화하세요.</h2>
          <p className="panel-sub">정해진 문제 맞히기가 아니에요. 선생님 말에 영어로 답하면 말이 통하는 만큼 다음으로 넘어가요. 막히면 두 번까지 다시 시도하고, 그 다음엔 모범 답안을 보여줘요.</p>
        </div>
      </div>

      <div className="learning-controls single-control">
        <label htmlFor="tutor-scenario-select">상황 선택
          <select
            id="tutor-scenario-select"
            aria-label="회화 상황 선택"
            value={scenario.id}
            onChange={(event) => {
              const next = tutorScenarios.find((item) => item.id === event.target.value) ?? tutorScenarios[0]
              restart(next)
            }}
          >
            {tutorScenarios.map((item) => <option key={item.id} value={item.id}>{item.titleKorean} · {item.title}</option>)}
          </select>
        </label>
        <button type="button" className="button secondary" onClick={() => restart(scenario)}>처음부터 다시</button>
      </div>

      <p className="mission-line"><strong>미션:</strong> {scenario.missionKorean} ({scenario.mission})</p>
      {!session.done && <p className="mission-line">진행: {Math.min(session.stepIndex + 1, scenario.steps.length)} / {scenario.steps.length}</p>}

      <div className="tutor-transcript" aria-live="polite">
        {session.turns.map((turn, index) => (
          <div key={index} className={turn.speaker === 'coach' ? 'tutor-coach' : 'tutor-learner'}>
            <span className="tutor-role">{turn.speaker === 'coach' ? '선생님' : '나'}</span>
            <span>{turn.text}</span>
            {turn.speaker === 'coach' && <button type="button" className="text-button" onClick={() => speak(turn.text)}>다시 듣기</button>}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {summary ? (
        <div className="tutor-summary">
          <h3>수고했어요! 이번 대화에서 쓴 표현</h3>
          <ul>
            {summary.covered.map((expression) => <li key={expression}>{expression}</li>)}
          </ul>
          {summary.assisted.length > 0 && <p>모범 답안을 본 단계: {summary.assisted.length}개 — 내일 같은 상황에서 도움 없이 말해 보세요.</p>}
          <div>
            <p><strong>함께 복습하면 좋은 문장</strong></p>
            <ul>
              {scenario.reviewSentenceIds.map((id) => {
                const sentence = sentenceById.get(id)
                return sentence ? <li key={id}>Day {sentence.day} · {sentence.english} ({sentence.korean})</li> : null
              })}
            </ul>
          </div>
          <button type="button" className="button secondary" onClick={() => restart(scenario)}>같은 상황 한 번 더</button>
        </div>
      ) : (
        <>
          <div className="tutor-input-row">
            <label className="tutor-draft" htmlFor="tutor-draft">영어로 답하기
              <input
                id="tutor-draft"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') send(draft) }}
                placeholder="Type your reply in English…"
                autoComplete="off"
              />
            </label>
            <button type="button" className="button" onClick={() => send(draft)}>보내기</button>
            <button type="button" className="button secondary" onClick={toggleListening} aria-pressed={isListening}>
              {isListening ? '듣기 중지' : '말하기'}
            </button>
          </div>
          <div className="actions">
            <button type="button" className="text-button" onClick={() => speak(step.coachOpener)}>선생님 말 다시 듣기</button>
            <button type="button" className="text-button" onClick={() => setShowHint((value) => !value)} aria-expanded={showHint}>
              {showHint ? '힌트 숨기기' : '힌트 보기'}
            </button>
          </div>
          {showHint && <p className="tutor-hint"><strong>힌트:</strong> {step.hint}<br />모범 답: {step.modelAnswer} ({step.modelKorean})</p>}
        </>
      )}
      {notice && <p className="speech-notice" role="status">{notice}</p>}
    </section>
  )
}
