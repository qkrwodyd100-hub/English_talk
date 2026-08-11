import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LEARNING_STORAGE_KEY,
  LEARNING_STORAGE_VERSION,
  createEmptyLearningState,
  getTodayChallenge,
  getTodayKey,
  getWordFeedback,
  normalizeAnswer,
  parseLearningState,
  type LearningState,
  type Sentence,
} from './learning'
import { builtInSentences } from './sentences'

type Tab = 'cards' | 'practice' | 'manage'
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getRecognition() {
  const browser = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

function persist(state: LearningState) {
  window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify({ version: LEARNING_STORAGE_VERSION, state }))
}

function pickPreferredEnglishVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) => /^en-(us|gb)/i.test(voice.lang))
  return englishVoices.sort((left, right) => voiceScore(right) - voiceScore(left))[0]
}

function voiceScore(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase()
  return (name.includes('natural') ? 1000 : 0)
    + (name.includes('online') || name.includes('neural') ? 100 : 0)
    + (voice.lang.toLowerCase().startsWith('en-us') ? 20 : 0)
    + (!voice.localService ? 10 : 0)
}

export default function LearningApp() {
  const [tab, setTab] = useState<Tab>('practice')
  const [state, setState] = useState<LearningState>(createEmptyLearningState)
  const [storageNotice, setStorageNotice] = useState('')
  const [hideMastered, setHideMastered] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [attempt, setAttempt] = useState('')
  const [answerRevealed, setAnswerRevealed] = useState(false)
  const [speechNotice, setSpeechNotice] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [editing, setEditing] = useState<Sentence | null>(null)
  const [english, setEnglish] = useState('')
  const [korean, setKorean] = useState('')
  const recognition = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    try {
      setState(parseLearningState(window.localStorage.getItem(LEARNING_STORAGE_KEY)))
    } catch {
      setStorageNotice('브라우저 저장소를 읽을 수 없습니다. 이번 학습은 계속할 수 있지만 저장되지 않을 수 있습니다.')
    }
  }, [])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    const refresh = () => setAvailableVoices(synth.getVoices())
    refresh()
    if (typeof synth.addEventListener !== 'function') return
    synth.addEventListener('voiceschanged', refresh)
    return () => synth.removeEventListener('voiceschanged', refresh)
  }, [])

  const sentences = useMemo(() => [...builtInSentences, ...state.customSentences], [state.customSentences])
  const todayKey = getTodayKey()
  const challenge = useMemo(() => getTodayChallenge(sentences), [sentences])
  const current = challenge[practiceIndex % Math.max(challenge.length, 1)]
  const mastered = new Set(state.masteredIds)
  const visibleCards = hideMastered ? sentences.filter((sentence) => !mastered.has(sentence.id)) : sentences
  const completedToday = state.completedChallengeDates.includes(todayKey)
  const progress = sentences.length ? Math.round((state.masteredIds.length / sentences.length) * 100) : 0

  function updateState(next: LearningState) {
    setState(next)
    try {
      persist(next)
      setStorageNotice('')
    } catch {
      setStorageNotice('저장에 실패했습니다. 화면의 학습은 계속되지만 새로고침하면 변경사항이 사라질 수 있습니다.')
    }
  }

  function toggleMastered(id: string) {
    const masteredIds = mastered.has(id) ? state.masteredIds.filter((value) => value !== id) : [...state.masteredIds, id]
    updateState({ ...state, masteredIds })
  }

  function checkAnswer() {
    setAnswerRevealed(true)
  }

  function nextPractice() {
    const isCorrect = current && normalizeAnswer(attempt) === normalizeAnswer(current.english)
    const completedChallengeDates = isCorrect && practiceIndex === challenge.length - 1 && !completedToday
      ? [...state.completedChallengeDates, todayKey]
      : state.completedChallengeDates
    if (completedChallengeDates !== state.completedChallengeDates) updateState({ ...state, completedChallengeDates })
    setPracticeIndex((index) => (index + 1) % Math.max(challenge.length, 1))
    setAttempt('')
    setAnswerRevealed(false)
    setSpeechNotice('')
  }

  function speakEnglish(text: string, successMessage: string) {
    if (!('speechSynthesis' in window)) {
      setSpeechNotice('이 브라우저에서는 음성 재생을 지원하지 않습니다. 텍스트 정답으로 계속 학습할 수 있습니다.')
      return
    }
    const synth = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickPreferredEnglishVoice(availableVoices.length ? availableVoices : synth.getVoices())
    utterance.voice = voice ?? null
    utterance.lang = voice?.lang ?? 'en-US'
    utterance.rate = 0.92
    try {
      synth.cancel()
      synth.speak(utterance)
      setSpeechNotice(successMessage)
    } catch {
      setSpeechNotice('음성 재생을 시작할 수 없습니다. 텍스트 학습은 계속할 수 있습니다.')
    }
  }

  function toggleListening() {
    const Recognition = getRecognition()
    if (!Recognition) {
      setSpeechNotice('이 브라우저에서는 음성 입력을 지원하지 않습니다. 텍스트 입력으로 계속 학습할 수 있습니다.')
      return
    }
    if (isListening) {
      recognition.current?.stop()
      return
    }
    const instance = new Recognition()
    instance.lang = 'en-US'
    instance.interimResults = false
    instance.continuous = false
    instance.onresult = (event) => setAttempt(event.results[0][0].transcript)
    instance.onerror = (event) => {
      setIsListening(false)
      setSpeechNotice(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? '마이크 권한이 거부되었습니다. 텍스트 입력으로 계속 학습할 수 있습니다.'
        : '음성 입력을 시작할 수 없습니다. 텍스트 입력으로 계속 학습할 수 있습니다.')
    }
    instance.onend = () => setIsListening(false)
    recognition.current = instance
    try {
      instance.start()
      setIsListening(true)
      setSpeechNotice('듣는 중입니다. 자동 녹음이나 저장은 하지 않습니다.')
    } catch {
      setSpeechNotice('음성 입력을 시작할 수 없습니다. 텍스트 입력으로 계속 학습할 수 있습니다.')
    }
  }

  function startEditing(sentence?: Sentence) {
    setEditing(sentence ?? { id: '', english: '', korean: '', day: 1, source: 'custom' })
    setEnglish(sentence?.english ?? '')
    setKorean(sentence?.korean ?? '')
  }

  function saveCustom(event: React.FormEvent) {
    event.preventDefault()
    if (!editing || !english.trim() || !korean.trim()) return
    const nextSentence: Sentence = { ...editing, id: editing.id || `custom-${crypto.randomUUID()}`, english: english.trim(), korean: korean.trim(), source: 'custom' }
    const customSentences = editing.id
      ? state.customSentences.map((sentence) => sentence.id === editing.id ? nextSentence : sentence)
      : [...state.customSentences, nextSentence]
    updateState({ ...state, customSentences })
    setEditing(null)
  }

  function deleteCustom(id: string) {
    updateState({
      ...state,
      customSentences: state.customSentences.filter((sentence) => sentence.id !== id),
      masteredIds: state.masteredIds.filter((masteredId) => masteredId !== id),
    })
  }

  return <main className="learning-shell">
    <header className="learning-header"><div><p className="eyebrow">English Talk · 60-day study</p><h1>오늘의 문장을 내 것으로 만들어요.</h1></div><p className="fixture-note">60일 동안 매일 10문장씩 학습해요.</p></header>
    <section className="dashboard" aria-label="학습 현황">
      <div><strong>{sentences.length}</strong><span>전체 문장</span></div><div><strong>{state.masteredIds.length}</strong><span>마스터</span></div><div><strong>{progress}%</strong><span>진행률</span></div><div><strong>{completedToday ? '완료' : `${practiceIndex + 1}/10`}</strong><span>오늘 challenge</span></div>
      <div className="progress-track" role="progressbar" aria-label="마스터 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
    </section>
    {storageNotice && <p className="notice" role="status">{storageNotice}</p>}
    <nav className="study-tabs" aria-label="학습 메뉴"><button className={tab === 'practice' ? 'active' : ''} onClick={() => setTab('practice')}>타이핑 연습</button><button className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>플래시카드</button><button className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>내 문장</button></nav>
    {speechNotice && <p className="hint" role="status">{speechNotice}</p>}

    {tab === 'cards' && <section className="study-panel" aria-labelledby="cards-heading"><div className="panel-heading"><div><p className="eyebrow">Flashcards</p><h2 id="cards-heading">뜻을 보고 영어를 떠올려 보세요.</h2></div><label className="filter"><input type="checkbox" checked={hideMastered} onChange={(event) => setHideMastered(event.target.checked)} /> 마스터 숨기기</label></div>{visibleCards.length === 0 ? <p className="empty-state">숨길 수 있는 카드가 없습니다. 필터를 끄거나 마스터를 해제하세요.</p> : <div className="card-grid">{visibleCards.map((sentence) => <article key={sentence.id} className="flashcard"><div className="card-copy"><span className="korean-copy">{sentence.korean}</span><span className="reveal-copy">{revealed === sentence.id ? sentence.english : '영어 문장을 확인해 보세요.'}</span></div><div className="card-actions"><button className="card-action" onClick={() => setRevealed(revealed === sentence.id ? null : sentence.id)} aria-expanded={revealed === sentence.id}>{revealed === sentence.id ? '영어 문장 숨기기' : '영어 문장 보기'}</button><button className="card-action" onClick={() => speakEnglish(sentence.english, '영어 문장을 재생했습니다.')}>음성으로 듣기</button></div><button className="master-button" aria-pressed={mastered.has(sentence.id)} onClick={() => toggleMastered(sentence.id)}>{mastered.has(sentence.id) ? '마스터 해제' : '마스터로 표시'}</button></article>)}</div>}</section>}

    {tab === 'practice' && current && <section className="study-panel" aria-labelledby="practice-heading"><p className="eyebrow">Today’s 10</p><h2 id="practice-heading">{practiceIndex + 1} / {challenge.length} · 한국어를 영어로 입력하세요.</h2><div className="practice-prompt"><strong>{current.korean}</strong><span>Day {current.day} · {current.source === 'custom' ? '내 문장' : '기본 문장'}</span></div><label htmlFor="answer">영어 답변</label><textarea id="answer" value={attempt} onChange={(event) => setAttempt(event.target.value)} placeholder="영어 문장을 입력하세요" rows={3} /><div className="actions"><button className="button" onClick={checkAnswer}>정답 확인</button>{answerRevealed && <button className="button secondary" onClick={nextPractice}>다음 문장</button>}</div>{answerRevealed && <div className="answer-feedback" aria-live="polite"><p><strong>정답:</strong> {current.english}</p><p className={normalizeAnswer(attempt) === normalizeAnswer(current.english) ? 'correct-copy' : 'needs-work'}>{normalizeAnswer(attempt) === normalizeAnswer(current.english) ? '정확해요!' : '누락 또는 오타 단어를 확인해 보세요.'}</p><div className="word-feedback" aria-label="단어별 피드백">{getWordFeedback(current.english, attempt).map((item, index) => <span className={item.status} key={`${item.word}-${index}`}>{item.word}</span>)}</div><div className="actions"><button className="text-button" onClick={() => speakEnglish(current.english, '정답 문장을 재생했습니다.')}>정답 듣기</button><button className="text-button" onClick={toggleListening} aria-pressed={isListening}>{isListening ? '음성 입력 중지' : '음성으로 입력'}</button></div></div>}</section>}

    {tab === 'manage' && <section className="study-panel" aria-labelledby="manage-heading"><div className="panel-heading"><div><p className="eyebrow">Personal sentences</p><h2 id="manage-heading">나만의 문장을 추가하세요.</h2></div><button className="button" onClick={() => startEditing()}>문장 추가</button></div>{editing && <form className="sentence-form" onSubmit={saveCustom}><label>영어 문장<input value={english} onChange={(event) => setEnglish(event.target.value)} required /></label><label>한국어 뜻<input value={korean} onChange={(event) => setKorean(event.target.value)} required /></label><div className="actions"><button className="button" type="submit">저장</button><button className="button secondary" type="button" onClick={() => setEditing(null)}>취소</button></div></form>}{state.customSentences.length === 0 ? <p className="empty-state">아직 내 문장이 없습니다. 자주 쓰는 문장을 추가해 보세요.</p> : <ul className="custom-list">{state.customSentences.map((sentence) => <li key={sentence.id}><div><strong>{sentence.english}</strong><span>{sentence.korean}</span></div><div className="row-actions"><button className="text-button" onClick={() => startEditing(sentence)}>수정</button><button className="text-button danger" onClick={() => deleteCustom(sentence.id)}>삭제</button></div></li>)}</ul>}</section>}
  </main>
}
