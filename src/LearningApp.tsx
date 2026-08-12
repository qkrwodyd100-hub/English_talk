import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  getDayProgress,
  getReviewQueue,
  getSequentialDayChallenge,
  getTopicProgress,
  judgeAnswer,
  recordAttempt,
  toggleFavorite,
  type AnswerJudgment,
} from './learning-engine'
import {
  LEARNING_STORAGE_KEY,
  LEARNING_STORAGE_VERSION,
  createEmptyLearningState,
  getTodayKey,
  getWordFeedback,
  parseLearningState,
  type CustomSentence,
  type LearningState,
  type Sentence,
} from './learning'
import { builtInDialogues } from './dialogues'
import { builtInSentences } from './sentences'

type Tab = 'practice' | 'cards' | 'review' | 'manage'
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
type CheckedAnswer = { sentence: Sentence; judgment: AnswerJudgment }

function getRecognition() {
  const browser = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
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
  const [selectedTopic, setSelectedTopic] = useState('all')
  const [attempt, setAttempt] = useState('')
  const [checkedAnswer, setCheckedAnswer] = useState<CheckedAnswer | null>(null)
  const [speechNotice, setSpeechNotice] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [editing, setEditing] = useState<CustomSentence | null>(null)
  const [english, setEnglish] = useState('')
  const [korean, setKorean] = useState('')
  const [dialogueOpen, setDialogueOpen] = useState(false)
  const recognition = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    try {
      const loaded = parseLearningState(window.localStorage.getItem(LEARNING_STORAGE_KEY))
      setState(loaded)
      persist(loaded)
    } catch {
      setStorageNotice('브라우저 저장소를 읽을 수 없습니다. 이번 학습은 계속할 수 있지만 저장되지 않을 수 있습니다.')
    }
  }, [])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    const refresh = () => setAvailableVoices(synth.getVoices())
    refresh()
    synth.addEventListener?.('voiceschanged', refresh)
    return () => synth.removeEventListener?.('voiceschanged', refresh)
  }, [])

  const selectedDay = state.selectedDay ?? 1
  const sentences = useMemo(() => [...builtInSentences, ...state.customSentences], [state.customSentences])
  const topics = useMemo(() => [...new Set(builtInSentences.map((sentence) => sentence.topic))], [])
  const dayChallenge = getSequentialDayChallenge(sentences, state, selectedDay)
  const filteredChallenge = selectedTopic === 'all' ? dayChallenge : dayChallenge.filter((sentence) => sentence.source === 'builtIn' && sentence.topic === selectedTopic)
  const daySentences = sentences.filter((sentence) => sentence.day === selectedDay)
  const flashcardSentences = selectedTopic === 'all' ? daySentences : daySentences.filter((sentence) => sentence.source === 'builtIn' && sentence.topic === selectedTopic)
  const current = checkedAnswer?.sentence ?? filteredChallenge[0]
  const currentPosition = current ? daySentences.findIndex((sentence) => sentence.id === current.id) + 1 : 0
  const mastered = new Set(state.masteredIds)
  const progress = getDayProgress(sentences, state, selectedDay)
  const topicProgress = getTopicProgress(builtInSentences, state)
  const reviewSentences = getReviewQueue(sentences, state)
  const selectedDayDialogue = builtInDialogues.find((item) => item.day === selectedDay)
  const dialogue = selectedDayDialogue && (selectedTopic === 'all' || selectedDayDialogue.topic === selectedTopic) ? selectedDayDialogue : undefined
  const judgment = checkedAnswer && current ? judgeAnswer(current, attempt) : undefined
  const wordFeedback = current ? getWordFeedback(current.english, attempt) : []
  const missingWords = wordFeedback.filter((item) => item.status === 'missing').map((item) => item.word)
  const completedIds = new Set(state.completedSentenceIds)
  const overallProgress = sentences.length ? Math.round((sentences.filter(({ id }) => completedIds.has(id)).length / sentences.length) * 100) : 0
  const masteryProgress = sentences.length ? Math.round((state.masteredIds.length / sentences.length) * 100) : 0
  const completedToday = state.completedChallengeDates.includes(getTodayKey())

  function updateState(next: LearningState) {
    setState(next)
    try {
      persist(next)
      setStorageNotice('')
    } catch {
      setStorageNotice('저장에 실패했습니다. 화면의 학습은 계속되지만 새로고침하면 변경사항이 사라질 수 있습니다.')
    }
  }

  function resetPracticeContext() {
    setAttempt('')
    setCheckedAnswer(null)
    setSpeechNotice('')
    setDialogueOpen(false)
  }

  function selectDay(day: number) {
    updateState({ ...state, selectedDay: day })
    setSelectedTopic('all')
    resetPracticeContext()
  }

  function chooseTopic(topic: string) {
    setSelectedTopic(topic)
    if (topic !== 'all') {
      const firstMatch = builtInSentences.find((sentence) => sentence.topic === topic)
      if (firstMatch) {
        const position = sentences.filter((sentence) => sentence.day === firstMatch.day).findIndex((sentence) => sentence.id === firstMatch.id)
        updateState({ ...state, selectedDay: firstMatch.day, dayPositions: { ...state.dayPositions, [firstMatch.day]: position } })
      }
    }
    resetPracticeContext()
  }

  function toggleMastered(id: string) {
    updateState({ ...state, masteredIds: mastered.has(id) ? state.masteredIds.filter((value) => value !== id) : [...state.masteredIds, id] })
  }

  function checkAnswer() {
    if (!current || checkedAnswer) return
    const nextJudgment = judgeAnswer(current, attempt)
    const position = daySentences.findIndex((sentence) => sentence.id === current.id)
    const nextState = recordAttempt(state, { sentence: current, position: Math.max(0, position), judgment: nextJudgment })
    setCheckedAnswer({ sentence: current, judgment: nextJudgment })
    updateState(withCompletedDay({ ...state, ...nextState }, current, nextJudgment))
  }

  function nextPractice() {
    if (current && checkedAnswer && judgment?.isCorrect && !checkedAnswer.judgment.isCorrect) {
      const correctedState = {
        ...state,
        completedSentenceIds: state.completedSentenceIds.includes(current.id) ? state.completedSentenceIds : [...state.completedSentenceIds, current.id],
        reviewQueueIds: state.reviewQueueIds.filter((id) => id !== current.id),
      }
      updateState(withCompletedDay(correctedState, current, judgment))
    }
    resetPracticeContext()
  }

  function withCompletedDay(next: LearningState, sentence: Sentence, answer: AnswerJudgment) {
    if (!answer.isCorrect) return next
    const dayIds = sentences.filter((item) => item.day === sentence.day).map((item) => item.id)
    if (!dayIds.every((id) => next.completedSentenceIds.includes(id))) return next
    const today = getTodayKey()
    return next.completedChallengeDates.includes(today) ? next : { ...next, completedChallengeDates: [...next.completedChallengeDates, today] }
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

  function startEditing(sentence?: CustomSentence) {
    setEditing(sentence ?? { id: '', english: '', korean: '', day: selectedDay, source: 'custom' })
    setEnglish(sentence?.english ?? '')
    setKorean(sentence?.korean ?? '')
  }

  function saveCustom(event: FormEvent) {
    event.preventDefault()
    if (!editing || !english.trim() || !korean.trim()) return
    const nextSentence: CustomSentence = { ...editing, id: editing.id || `custom-${crypto.randomUUID()}`, english: english.trim(), korean: korean.trim(), source: 'custom' }
    updateState({ ...state, customSentences: editing.id ? state.customSentences.map((sentence) => sentence.id === editing.id ? nextSentence : sentence) : [...state.customSentences, nextSentence] })
    setEditing(null)
  }

  function deleteCustom(id: string) {
    updateState({
      ...state,
      customSentences: state.customSentences.filter((sentence) => sentence.id !== id),
      masteredIds: state.masteredIds.filter((value) => value !== id),
      completedSentenceIds: state.completedSentenceIds.filter((value) => value !== id),
      reviewQueueIds: state.reviewQueueIds.filter((value) => value !== id),
      favoriteIds: state.favoriteIds.filter((value) => value !== id),
    })
  }

  function practiceAgain(sentence: Sentence) {
    const daySentences = sentences.filter((item) => item.day === sentence.day)
    const position = daySentences.findIndex((item) => item.id === sentence.id)
    updateState({ ...state, selectedDay: sentence.day, dayPositions: { ...state.dayPositions, [sentence.day]: Math.max(0, position) } })
    setSelectedTopic('all')
    resetPracticeContext()
    setTab('practice')
  }

  return <main className="learning-shell">
    <header className="learning-header"><div><p className="eyebrow">English Talk · 60-day study</p><h1>더 넓은 세상으로의 시작</h1></div><p className="fixture-note">60일 동안 매일 10문장씩 학습해요. 마지막으로 학습한 Day와 문장부터 이어집니다.</p></header>
    <section className="dashboard" aria-label="학습 현황"><div><strong>{sentences.length}</strong><span>전체 문장</span></div><div><strong>{state.masteredIds.length}</strong><span>마스터</span></div><div><strong>{overallProgress}%</strong><span>학습 진행률</span></div><div><strong>{completedToday ? '완료' : `Day ${selectedDay}`}</strong><span>현재 학습</span></div><div className="progress-track" role="progressbar" aria-label="마스터 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={masteryProgress}><span style={{ width: `${masteryProgress}%` }} /></div></section>
    {storageNotice && <p className="notice" role="status">{storageNotice}</p>}
    <nav className="study-tabs" aria-label="학습 메뉴"><button aria-current={tab === 'practice' ? 'page' : undefined} className={tab === 'practice' ? 'active' : ''} onClick={() => setTab('practice')}>타이핑 연습</button><button aria-current={tab === 'cards' ? 'page' : undefined} className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>플래시카드</button><button aria-current={tab === 'review' ? 'page' : undefined} className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}>오답 복습 ({state.reviewQueueIds.length})</button><button aria-current={tab === 'manage' ? 'page' : undefined} className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>내 문장</button></nav>
    {speechNotice && <p className="hint" role="status">{speechNotice}</p>}

    {tab === 'practice' && <section className="study-panel" aria-labelledby="practice-heading">
      <div className="learning-controls"><label>학습 Day 선택<select value={selectedDay} onChange={(event) => selectDay(Number(event.target.value))}>{Array.from({ length: 60 }, (_, index) => <option key={index + 1} value={index + 1}>Day {index + 1}</option>)}</select></label><label>주제 필터<select value={selectedTopic} onChange={(event) => chooseTopic(event.target.value)}><option value="all">전체 주제</option>{topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select></label></div>
      <section className="topic-progress" aria-label="주제별 진행률"><strong>주제별 진행률</strong>{topicProgress.map((item) => <span key={item.topic}>{item.topic} {item.completed}/{item.total}</span>)}</section>
      {current ? <><p className="eyebrow">Day {selectedDay} 학습</p><h2 id="practice-heading">{currentPosition} / {dayChallenge.length} · 한국어를 영어로 입력하세요.</h2><p className="resume-copy">Day {selectedDay}에서 {progress.completed}/{progress.total}개를 완료했어요. 답을 확인하면 다음 위치가 저장됩니다.</p><div className="practice-prompt"><strong>{current.korean}</strong><span>{current.source === 'builtIn' ? `${current.topic} · ${current.level} · 우선순위 ${current.priority}` : `내 문장 · Day ${current.day}`}</span></div><PhraseChoices key={current.id} sentence={current} onChoose={setAttempt} /><label htmlFor="answer">영어 답변</label><textarea id="answer" value={attempt} onChange={(event) => setAttempt(event.target.value)} placeholder="영어 문장을 입력하세요" rows={3} /><div className="actions"><button className="button" disabled={Boolean(checkedAnswer)} onClick={checkAnswer}>정답 확인</button>{checkedAnswer && <button className="button secondary" onClick={nextPractice}>다음 문장</button>}</div>
      {checkedAnswer && judgment && <div className={`answer-feedback ${judgment.kind === 'exact' ? 'feedback-exact' : judgment.kind === 'accepted-alternative' ? 'feedback-allowed' : 'feedback-needs-work'}`} aria-live="polite"><p><strong>정답:</strong> {current.english}</p><p><strong>{judgment.kind === 'exact' ? '정확' : judgment.kind === 'accepted-alternative' ? '허용 표현' : '수정 필요'}</strong>{judgment.kind === 'exact' ? ' · 정확해요! 저장된 문장과 일치해요.' : judgment.kind === 'accepted-alternative' ? ' · 저장된 허용 표현과 일치해요.' : ' · 누락 또는 오타 단어를 확인해 보세요.'}</p>{!judgment.isCorrect && <p>확인할 단어: {missingWords.length ? missingWords.join(', ') : '어순과 표현'}</p>}<div className="word-feedback" aria-label="단어별 피드백">{wordFeedback.map((item, index) => <span className={item.status} key={`${item.word}-${index}`}>{item.word}</span>)}</div><div className="actions"><button className="text-button" onClick={() => speakEnglish(current.english, '정답 문장을 재생했습니다.')}>정답 듣기</button><button className="text-button" onClick={toggleListening} aria-pressed={isListening}>{isListening ? '음성 입력 중지' : '음성으로 입력'}</button><button className="text-button" aria-pressed={state.favoriteIds.includes(current.id)} onClick={() => updateState({ ...state, ...toggleFavorite(state, current.id) })}>{state.favoriteIds.includes(current.id) ? '즐겨찾기 해제' : '즐겨찾기'}</button></div></div>}</> : <p className="empty-state">Day {selectedDay} 문장이 없습니다. 다른 Day를 선택해 보세요.</p>}
      {dialogue && <section className="dialogue-launch"><div><strong>Day {selectedDay} 미니 대화</strong><p>{dialogue.turns.length}턴으로 오늘 표현을 실제 대화처럼 익혀 보세요.</p></div><button className="button secondary" onClick={() => setDialogueOpen(true)}>미니 대화 연습</button></section>}
      {dialogueOpen && dialogue && <section className="mini-dialogue" aria-labelledby="dialogue-heading"><h2 id="dialogue-heading">Day {selectedDay} 미니 대화</h2><p className="turn-pill">{dialogue.turns.length}턴 · {dialogue.topic}</p><div className="dialogue-transcript">{dialogue.turns.map((turn, index) => <p key={`${turn.role}-${index}`}><strong>{turn.role}:</strong> {turn.english}<span>{turn.korean}</span></p>)}</div><button className="button" onClick={() => setDialogueOpen(false)}>대화 마치기</button></section>}
    </section>}

    {tab === 'cards' && <section className="study-panel" aria-labelledby="cards-heading"><div className="panel-heading"><div><p className="eyebrow">Flashcards</p><h2 id="cards-heading">뜻을 보고 영어를 떠올려 보세요.</h2></div><label className="filter"><input type="checkbox" checked={hideMastered} onChange={(event) => setHideMastered(event.target.checked)} /> 마스터 숨기기</label></div><div className="card-grid">{(hideMastered ? flashcardSentences.filter((sentence) => !mastered.has(sentence.id)) : flashcardSentences).map((sentence) => <article key={sentence.id} className="flashcard"><div className="card-copy"><span className="korean-copy">{sentence.korean}</span><span className="reveal-copy">{revealed === sentence.id ? sentence.english : '영어 문장을 확인해 보세요.'}</span></div><div className="card-actions"><button className="card-action" onClick={() => setRevealed(revealed === sentence.id ? null : sentence.id)} aria-expanded={revealed === sentence.id}>{revealed === sentence.id ? '영어 문장 숨기기' : '영어 문장 보기'}</button><button className="card-action" onClick={() => speakEnglish(sentence.english, '영어 문장을 재생했습니다.')}>음성으로 듣기</button></div><button className="master-button" aria-pressed={mastered.has(sentence.id)} onClick={() => toggleMastered(sentence.id)}>{mastered.has(sentence.id) ? '마스터 해제' : '마스터로 표시'}</button></article>)}</div></section>}

    {tab === 'review' && <section className="study-panel" aria-labelledby="review-heading"><p className="eyebrow">Review queue</p><h2 id="review-heading">오답과 즐겨찾기 복습</h2>{reviewSentences.length === 0 && state.favoriteIds.length === 0 ? <p className="empty-state">아직 복습할 문장이 없습니다. 답을 확인하거나 즐겨찾기를 선택해 보세요.</p> : <ul className="review-list">{sentences.filter((sentence) => state.reviewQueueIds.includes(sentence.id) || state.favoriteIds.includes(sentence.id)).map((sentence) => <li key={sentence.id}><div><strong>{sentence.korean}</strong><span>{sentence.english}</span></div><button className="text-button" onClick={() => practiceAgain(sentence)}>다시 연습</button></li>)}</ul>}</section>}

    {tab === 'manage' && <section className="study-panel" aria-labelledby="manage-heading"><div className="panel-heading"><div><p className="eyebrow">Personal sentences</p><h2 id="manage-heading">나만의 문장을 추가하세요.</h2></div><button className="button" onClick={() => startEditing()}>문장 추가</button></div>{editing && <form className="sentence-form" onSubmit={saveCustom}><label>영어 문장<input value={english} onChange={(event) => setEnglish(event.target.value)} required /></label><label>한국어 뜻<input value={korean} onChange={(event) => setKorean(event.target.value)} required /></label><div className="actions"><button className="button" type="submit">저장</button><button className="button secondary" type="button" onClick={() => setEditing(null)}>취소</button></div></form>}{state.customSentences.length === 0 ? <p className="empty-state">아직 내 문장이 없습니다. 자주 쓰는 문장을 추가해 보세요.</p> : <ul className="custom-list">{state.customSentences.map((sentence) => <li key={sentence.id}><div><strong>{sentence.english}</strong><span>{sentence.korean}</span></div><div className="row-actions"><button className="text-button" onClick={() => startEditing(sentence)}>수정</button><button className="text-button danger" onClick={() => deleteCustom(sentence.id)}>삭제</button></div></li>)}</ul>}</section>}
  </main>
}

function PhraseChoices({ sentence, onChoose }: { sentence: Sentence; onChoose: (value: string) => void }) {
  if (sentence.source !== 'builtIn') return null
  const alternatives = sentence.alternatives ?? []
  const slots = sentence.slots ?? []
  if (alternatives.length === 0 && slots.length === 0) return null
  return <section className="phrase-choices" aria-label="표현 선택"><strong>저장된 표현과 슬롯</strong>{alternatives.length > 0 && <div>{alternatives.map((alternative) => <button type="button" className="choice-chip" key={alternative.english} onClick={() => onChoose(alternative.english)}>{alternative.english}</button>)}</div>}{slots.map((slot) => <div key={slot.key}><span>{slot.key}</span>{slot.values.map((value) => <button type="button" className="choice-chip" key={value.english} onClick={() => onChoose(sentence.english.replace(slot.values[0].english, value.english))}>{value.english} · {value.korean}</button>)}</div>)}</section>
}