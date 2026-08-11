import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  LEARNING_STORAGE_KEY,
  LEARNING_STORAGE_VERSION,
  createEmptyLearningState,
  getTodayKey,
  getWordFeedback,
  normalizeAnswer,
  parseLearningState,
  type LearningState,
  type Sentence,
} from './learning'
import { builtInSentences } from './sentences'

type Tab = 'practice' | 'cards' | 'review' | 'manage'
type Topic = '기초 대화' | '식당·카페' | '여행·이동' | '긴급 상황' | '일상'
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

const topicOrder: Topic[] = ['기초 대화', '식당·카페', '여행·이동', '긴급 상황', '일상']

function getRecognition() {
  const browser = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

function topicForDay(day: number): Topic {
  if (day === 1) return '기초 대화'
  if (day === 2) return '식당·카페'
  if (day >= 3 && day <= 7) return '여행·이동'
  if (day >= 25 && day <= 30) return '긴급 상황'
  return '일상'
}

function displayEnglish(value: string) {
  return value.replace(/\[이름\]/g, 'your name').replace(/\//g, ' or ')
}

function persist(state: LearningState) {
  window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify({ version: LEARNING_STORAGE_VERSION, state }))
}

function pickPreferredEnglishVoice(voices: SpeechSynthesisVoice[]) {
  return voices.filter((voice) => /^en-(us|gb)/i.test(voice.lang)).sort((left, right) => voiceScore(right) - voiceScore(left))[0]
}

function voiceScore(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase()
  return (name.includes('natural') ? 1000 : 0) + (name.includes('online') || name.includes('neural') ? 100 : 0) + (voice.lang.toLowerCase().startsWith('en-us') ? 20 : 0) + (!voice.localService ? 10 : 0)
}

export default function LearningApp() {
  const [tab, setTab] = useState<Tab>('practice')
  const [state, setState] = useState<LearningState>(createEmptyLearningState)
  const [storageNotice, setStorageNotice] = useState('')
  const [hideMastered, setHideMastered] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(1)
  const [selectedTopic, setSelectedTopic] = useState<Topic | '전체'>('전체')
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [attempt, setAttempt] = useState('')
  const [answerRevealed, setAnswerRevealed] = useState(false)
  const [speechNotice, setSpeechNotice] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [editing, setEditing] = useState<Sentence | null>(null)
  const [english, setEnglish] = useState('')
  const [korean, setKorean] = useState('')
  const [reviewIds, setReviewIds] = useState<string[]>([])
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [dialogueTurn, setDialogueTurn] = useState(0)
  const [dialogueReply, setDialogueReply] = useState('')
  const recognition = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    try { setState(parseLearningState(window.localStorage.getItem(LEARNING_STORAGE_KEY))) } catch { setStorageNotice('브라우저 저장소를 읽을 수 없습니다. 이번 학습은 계속할 수 있지만 저장되지 않을 수 있습니다.') }
  }, [])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    const refresh = () => setAvailableVoices(synth.getVoices())
    refresh()
    synth.addEventListener?.('voiceschanged', refresh)
    return () => synth.removeEventListener?.('voiceschanged', refresh)
  }, [])

  const sentences = useMemo(() => [...builtInSentences, ...state.customSentences], [state.customSentences])
  const daySentences = useMemo(() => sentences.filter((sentence) => sentence.day === selectedDay && (selectedTopic === '전체' || topicForDay(sentence.day) === selectedTopic)), [selectedDay, selectedTopic, sentences])
  const current = daySentences[practiceIndex % Math.max(daySentences.length, 1)]
  const mastered = new Set(state.masteredIds)
  const completedToday = state.completedChallengeDates.includes(getTodayKey())
  const progress = sentences.length ? Math.round((state.masteredIds.length / sentences.length) * 100) : 0
  const currentDayProgress = sentences.filter((sentence) => sentence.day === selectedDay).filter((sentence) => mastered.has(sentence.id)).length
  const reviewSentences = sentences.filter((sentence) => reviewIds.includes(sentence.id))
  const isExact = Boolean(current) && normalizeAnswer(attempt) === normalizeAnswer(current.english)
  const wordFeedback = current ? getWordFeedback(current.english, attempt) : []
  const isAllowed = !isExact && wordFeedback.length > 0 && wordFeedback.filter((item) => item.status === 'correct').length / wordFeedback.length >= 0.7
  const feedbackLabel = isExact ? '정확' : isAllowed ? '허용 표현' : '수정 필요'
  const missingWords = wordFeedback.filter((item) => item.status === 'missing').map((item) => item.word)

  function updateState(next: LearningState) {
    setState(next)
    try { persist(next); setStorageNotice('') } catch { setStorageNotice('저장에 실패했습니다. 화면의 학습은 계속되지만 새로고침하면 변경사항이 사라질 수 있습니다.') }
  }

  function toggleMastered(id: string) {
    updateState({ ...state, masteredIds: mastered.has(id) ? state.masteredIds.filter((value) => value !== id) : [...state.masteredIds, id] })
  }

  function checkAnswer() { setAnswerRevealed(true) }

  function nextPractice() {
    if (!current) return
    const completedChallengeDates = isExact && practiceIndex === daySentences.length - 1 && !completedToday ? [...state.completedChallengeDates, getTodayKey()] : state.completedChallengeDates
    if (completedChallengeDates !== state.completedChallengeDates) updateState({ ...state, completedChallengeDates })
    setPracticeIndex((index) => (index + 1) % Math.max(daySentences.length, 1))
    setAttempt('')
    setAnswerRevealed(false)
    setSpeechNotice('')
  }

  function speakEnglish(text: string, successMessage: string) {
    if (!('speechSynthesis' in window)) { setSpeechNotice('이 브라우저에서는 음성 재생을 지원하지 않습니다. 텍스트 정답으로 계속 학습할 수 있습니다.'); return }
    const synth = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickPreferredEnglishVoice(availableVoices.length ? availableVoices : synth.getVoices())
    utterance.voice = voice ?? null
    utterance.lang = voice?.lang ?? 'en-US'
    utterance.rate = 0.92
    try { synth.cancel(); synth.speak(utterance); setSpeechNotice(successMessage) } catch { setSpeechNotice('음성 재생을 시작할 수 없습니다. 텍스트 학습은 계속할 수 있습니다.') }
  }

  function toggleListening() {
    const Recognition = getRecognition()
    if (!Recognition) { setSpeechNotice('이 브라우저에서는 음성 입력을 지원하지 않습니다. 텍스트 입력으로 계속 학습할 수 있습니다.'); return }
    if (isListening) { recognition.current?.stop(); return }
    const instance = new Recognition()
    instance.lang = 'en-US'; instance.interimResults = false; instance.continuous = false
    instance.onresult = (event) => setAttempt(event.results[0][0].transcript)
    instance.onerror = (event) => { setIsListening(false); setSpeechNotice(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? '마이크 권한이 거부되었습니다. 텍스트 입력으로 계속 학습할 수 있습니다.' : '음성 입력을 시작할 수 없습니다. 텍스트 입력으로 계속 학습할 수 있습니다.') }
    instance.onend = () => setIsListening(false)
    recognition.current = instance
    try { instance.start(); setIsListening(true); setSpeechNotice('듣는 중입니다. 자동 녹음이나 저장은 하지 않습니다.') } catch { setSpeechNotice('음성 입력을 시작할 수 없습니다. 텍스트 입력으로 계속 학습할 수 있습니다.') }
  }

  function startEditing(sentence?: Sentence) { setEditing(sentence ?? { id: '', english: '', korean: '', day: selectedDay, source: 'custom' }); setEnglish(sentence?.english ?? ''); setKorean(sentence?.korean ?? '') }
  function saveCustom(event: FormEvent) {
    event.preventDefault()
    if (!editing || !english.trim() || !korean.trim()) return
    const nextSentence: Sentence = { ...editing, id: editing.id || `custom-${crypto.randomUUID()}`, english: english.trim(), korean: korean.trim(), source: 'custom' }
    updateState({ ...state, customSentences: editing.id ? state.customSentences.map((sentence) => sentence.id === editing.id ? nextSentence : sentence) : [...state.customSentences, nextSentence] })
    setEditing(null)
  }
  function deleteCustom(id: string) { updateState({ ...state, customSentences: state.customSentences.filter((sentence) => sentence.id !== id), masteredIds: state.masteredIds.filter((masteredId) => masteredId !== id) }) }
  function addToReview(id: string) { setReviewIds((ids) => ids.includes(id) ? ids : [...ids, id]) }
  function continueDialogue() {
    if (!dialogueReply.trim()) return
    if (dialogueTurn === 0) { setDialogueTurn(1); setDialogueReply('') } else { setDialogueTurn(2); setDialogueReply('') }
  }

  return <main className="learning-shell">
    <header className="learning-header"><div><p className="eyebrow">English Talk · 60-day study</p><h1>더 넓은 세상으로의 시작</h1></div><p className="fixture-note">60일 동안 매일 10문장씩 학습해요. 오늘 날짜가 아니라, 이어서 학습할 Day와 문장 위치를 선택하세요.</p></header>
    <section className="dashboard" aria-label="학습 현황"><div><strong>{sentences.length}</strong><span>전체 문장</span></div><div><strong>{state.masteredIds.length}</strong><span>마스터</span></div><div><strong>{progress}%</strong><span>진행률</span></div><div><strong>{completedToday ? '완료' : `Day ${selectedDay}`}</strong><span>현재 학습</span></div><div className="progress-track" role="progressbar" aria-label="마스터 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div></section>
    {storageNotice && <p className="notice" role="status">{storageNotice}</p>}
    <nav className="study-tabs" aria-label="학습 메뉴"><button className={tab === 'practice' ? 'active' : ''} onClick={() => setTab('practice')}>타이핑 연습</button><button className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>플래시카드</button><button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}>오답 복습 ({reviewIds.length})</button><button className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>내 문장</button></nav>
    {speechNotice && <p className="hint" role="status">{speechNotice}</p>}

    {tab === 'practice' && <section className="study-panel" aria-labelledby="practice-heading">
      <div className="learning-controls"><label>학습 Day 선택<select value={selectedDay} onChange={(event) => { setSelectedDay(Number(event.target.value)); setPracticeIndex(0); setAnswerRevealed(false) }}>{Array.from({ length: 60 }, (_, index) => <option key={index + 1} value={index + 1}>Day {index + 1}</option>)}</select></label><label>주제 필터<select value={selectedTopic} onChange={(event) => { setSelectedTopic(event.target.value as Topic | '전체'); setPracticeIndex(0); setAnswerRevealed(false) }}><option value="전체">전체 주제</option>{topicOrder.map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select></label></div>
      <section className="topic-progress" aria-label="주제별 진행률"><strong>주제별 진행률</strong>{topicOrder.map((topic) => { const topicSentences = sentences.filter((sentence) => topicForDay(sentence.day) === topic); const topicMastered = topicSentences.filter((sentence) => mastered.has(sentence.id)).length; return <span key={topic}>{topic} {topicMastered}/{topicSentences.length}</span> })}</section>
      {current ? <><p className="eyebrow">Day {selectedDay} 학습</p><h2 id="practice-heading">{practiceIndex + 1} / {daySentences.length} · 한국어를 영어로 입력하세요.</h2><p className="resume-copy">Day {selectedDay}에서 {currentDayProgress}/{sentences.filter((sentence) => sentence.day === selectedDay).length}개를 마스터했어요. 지금 문장을 마치면 다음 문장으로 이어집니다.</p><div className="practice-prompt"><strong>{current.korean}</strong><span>{topicForDay(current.day)} · Day {current.day}</span></div><PhraseChoices sentence={current} onAppend={(value) => setAttempt((answer) => `${answer}${answer ? ' ' : ''}${value}`)} /><label htmlFor="answer">영어 답변</label><textarea id="answer" value={attempt} onChange={(event) => setAttempt(event.target.value)} placeholder="영어 문장을 입력하세요" rows={3} /><div className="actions"><button className="button" onClick={checkAnswer}>정답 확인</button>{answerRevealed && <button className="button secondary" onClick={nextPractice}>다음 문장</button>}</div>
      {answerRevealed && <div className={`answer-feedback ${isExact ? 'feedback-exact' : isAllowed ? 'feedback-allowed' : 'feedback-needs-work'}`} aria-live="polite"><p><strong>정답:</strong> {displayEnglish(current.english)}</p><p><strong>{feedbackLabel}</strong>{isExact ? ' · 정확해요! 문장과 정확히 일치해요.' : isAllowed ? ' · 의미가 전달되는 자연스러운 표현이에요.' : ' · 수정 필요: 누락 또는 오타 단어를 확인해 보세요.'}</p>{!isExact && <p>확인할 단어: {missingWords.length ? missingWords.join(', ') : '어순과 표현'}</p>}<div className="word-feedback" aria-label="단어별 피드백">{wordFeedback.map((item, index) => <span className={item.status} key={`${item.word}-${index}`}>{item.word}</span>)}</div><div className="actions"><button className="text-button" onClick={() => speakEnglish(current.english, '정답 문장을 재생했습니다.')}>정답 듣기</button><button className="text-button" onClick={toggleListening} aria-pressed={isListening}>{isListening ? '음성 입력 중지' : '음성으로 입력'}</button>{!isExact && <button className="text-button" onClick={() => addToReview(current.id)}>오답 복습에 추가</button>}<button className="text-button" aria-pressed={favoriteIds.includes(current.id)} onClick={() => setFavoriteIds((ids) => ids.includes(current.id) ? ids.filter((id) => id !== current.id) : [...ids, current.id])}>{favoriteIds.includes(current.id) ? '즐겨찾기 해제' : '즐겨찾기'}</button></div></div>}</> : <p className="empty-state">이 주제에는 Day {selectedDay} 문장이 없습니다. 다른 주제를 선택해 보세요.</p>}
      {current && <section className="dialogue-launch"><div><strong>Day {selectedDay} 미니 대화</strong><p>2턴으로 오늘 표현을 실제 대화처럼 말해 보세요.</p></div><button className="button secondary" onClick={() => { setDialogueOpen(true); setDialogueTurn(0); setDialogueReply('') }}>미니 대화 연습</button></section>}
      {dialogueOpen && current && <section className="mini-dialogue" aria-labelledby="dialogue-heading"><h2 id="dialogue-heading">Day {selectedDay} 미니 대화</h2><p className="turn-pill">{Math.min(dialogueTurn + 1, 2)} / 2 턴</p><div className="dialogue-transcript" aria-live="polite"><p><strong>Coach:</strong> {dialogueTurn === 0 ? `Try saying: ${displayEnglish(current.english)}` : dialogueTurn === 1 ? 'Great. Add one short, polite follow-up.' : 'Nice work. You completed this mini dialogue.'}</p></div>{dialogueTurn < 2 ? <><label htmlFor="dialogue-reply">내 영어 답변</label><textarea id="dialogue-reply" value={dialogueReply} onChange={(event) => setDialogueReply(event.target.value)} rows={2} placeholder="짧게 말해 보세요" /><div className="actions"><button className="button" onClick={continueDialogue}>대화 계속하기</button><button className="button secondary" onClick={() => setDialogueOpen(false)}>나중에 하기</button></div></> : <button className="button" onClick={() => setDialogueOpen(false)}>대화 마치기</button>}</section>}
    </section>}

    {tab === 'cards' && <section className="study-panel" aria-labelledby="cards-heading"><div className="panel-heading"><div><p className="eyebrow">Flashcards</p><h2 id="cards-heading">뜻을 보고 영어를 떠올려 보세요.</h2></div><label className="filter"><input type="checkbox" checked={hideMastered} onChange={(event) => setHideMastered(event.target.checked)} /> 마스터 숨기기</label></div><div className="card-grid">{(hideMastered ? sentences.filter((sentence) => !mastered.has(sentence.id)) : sentences).map((sentence) => <article key={sentence.id} className="flashcard"><div className="card-copy"><span className="korean-copy">{sentence.korean}</span><span className="reveal-copy">{revealed === sentence.id ? displayEnglish(sentence.english) : '영어 문장을 확인해 보세요.'}</span></div><div className="card-actions"><button className="card-action" onClick={() => setRevealed(revealed === sentence.id ? null : sentence.id)} aria-expanded={revealed === sentence.id}>{revealed === sentence.id ? '영어 문장 숨기기' : '영어 문장 보기'}</button><button className="card-action" onClick={() => speakEnglish(sentence.english, '영어 문장을 재생했습니다.')}>음성으로 듣기</button></div><button className="master-button" aria-pressed={mastered.has(sentence.id)} onClick={() => toggleMastered(sentence.id)}>{mastered.has(sentence.id) ? '마스터 해제' : '마스터로 표시'}</button></article>)}</div></section>}

    {tab === 'review' && <section className="study-panel" aria-labelledby="review-heading"><p className="eyebrow">Review queue</p><h2 id="review-heading">오답과 즐겨찾기 복습</h2>{reviewSentences.length === 0 && favoriteIds.length === 0 ? <p className="empty-state">아직 복습할 문장이 없습니다. 답을 확인한 뒤 오답 복습 또는 즐겨찾기를 선택해 보세요.</p> : <ul className="review-list">{sentences.filter((sentence) => reviewIds.includes(sentence.id) || favoriteIds.includes(sentence.id)).map((sentence) => <li key={sentence.id}><div><strong>{sentence.korean}</strong><span>{displayEnglish(sentence.english)}</span></div><button className="text-button" onClick={() => { setSelectedDay(sentence.day); setSelectedTopic('전체'); setPracticeIndex(0); setTab('practice') }}>다시 연습</button></li>)}</ul>}</section>}

    {tab === 'manage' && <section className="study-panel" aria-labelledby="manage-heading"><div className="panel-heading"><div><p className="eyebrow">Personal sentences</p><h2 id="manage-heading">나만의 문장을 추가하세요.</h2></div><button className="button" onClick={() => startEditing()}>문장 추가</button></div>{editing && <form className="sentence-form" onSubmit={saveCustom}><label>영어 문장<input value={english} onChange={(event) => setEnglish(event.target.value)} required /></label><label>한국어 뜻<input value={korean} onChange={(event) => setKorean(event.target.value)} required /></label><div className="actions"><button className="button" type="submit">저장</button><button className="button secondary" type="button" onClick={() => setEditing(null)}>취소</button></div></form>}{state.customSentences.length === 0 ? <p className="empty-state">아직 내 문장이 없습니다. 자주 쓰는 문장을 추가해 보세요.</p> : <ul className="custom-list">{state.customSentences.map((sentence) => <li key={sentence.id}><div><strong>{sentence.english}</strong><span>{sentence.korean}</span></div><div className="row-actions"><button className="text-button" onClick={() => startEditing(sentence)}>수정</button><button className="text-button danger" onClick={() => deleteCustom(sentence.id)}>삭제</button></div></li>)}</ul>}</section>}
  </main>
}

function PhraseChoices({ sentence, onAppend }: { sentence: Sentence; onAppend: (value: string) => void }) {
  const hasNameSlot = sentence.english.includes('[이름]')
  const alternatives = sentence.english.includes('/') ? sentence.english.split('/').map((value) => value.replace(/\[.*?\]/g, '').trim()).filter(Boolean) : []
  if (!hasNameSlot && alternatives.length === 0) return null
  return <section className="phrase-choices" aria-label="표현 선택"><strong>표현을 선택하거나 채워 보세요</strong>{alternatives.length > 0 && <div>{alternatives.map((option) => <button type="button" className="choice-chip" key={option} onClick={() => onAppend(option)}>{option}</button>)}</div>}{hasNameSlot && <label>이름<input aria-label="이름 채우기" placeholder="예: Mina" onChange={(event) => onAppend(event.target.value)} /></label>}</section>
}
