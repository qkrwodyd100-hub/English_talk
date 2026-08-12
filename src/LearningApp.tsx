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
  formatStudyDate,
  formatStudyTimestamp,
  getLocalDateKey,
  getStudySummary,
  getTodayKey,
  getWordFeedback,
  parseLearningState,
  recordStudyActivity,
  type CustomSentence,
  type LearningState,
  type Sentence,
} from './learning'
import { builtInDialogues } from './dialogues'
import { builtInSentences } from './sentences'

type Tab = 'practice' | 'cards' | 'review' | 'manage' | 'history'
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

const topicNames: Record<string, string> = {
  'airport-services': '공항 이용', 'asking-for-directions': '길 묻기', 'asking-for-help': '도움 요청', 'asking-for-photo-help': '사진 부탁', 'asking-locals-for-help': '현지인에게 도움 요청', 'attraction-information': '관광지 정보', 'business-meetings': '비즈니스 미팅', 'cafe-orders': '카페 주문', 'checking-understanding': '이해 확인', 'clothing-shopping': '옷 쇼핑', 'compliments-and-encouragement': '칭찬과 격려', 'confident-conversation-closings': '자신 있는 대화 마무리', 'conversation-reactions': '대화 반응', 'day-trip-booking': '당일 여행 예약', 'detailed-travel-questions': '상세 여행 질문', 'dining-requests': '식사 요청', 'emergencies-and-local-help': '긴급 상황과 현지 도움', 'emergencies-and-police': '긴급 상황과 경찰', 'ending-a-conversation': '대화 마무리', 'everyday-conversation': '일상 대화', 'feelings-and-emotions': '감정 표현', 'flight-booking': '항공권 예약', 'getting-oriented': '방향 파악', 'hobbies-and-interests': '취미와 관심사', 'hotel-and-dining': '호텔과 식사', 'hotel-check-in': '호텔 체크인', 'hotel-check-out': '호텔 체크아웃', 'hotel-room-problems': '호텔 객실 문제', 'hotel-services': '호텔 서비스', 'immigration-and-customs': '입국 심사와 세관', 'local-culture-and-language': '현지 문화와 언어', 'local-dining-customs': '현지 식사 예절', 'local-information': '현지 정보', 'market-bargaining': '시장 흥정', 'medical-symptoms': '증상 설명', 'meeting-locals': '현지인 만나기', 'meeting-new-people': '새로운 사람 만나기', 'messages-and-email': '메시지와 이메일', 'opinions-and-recommendations': '의견과 추천', 'payments-and-returns': '결제와 반품', 'pharmacy-and-medicine': '약국과 의약품', 'phone-and-tech-support': '전화와 기술 지원', 'phone-calls': '전화 통화', 'phone-calls-and-arrangements': '전화와 약속 잡기', 'polite-disagreement': '정중한 반대', 'polite-formal-requests': '격식 있는 정중한 요청', 'polite-requests': '정중한 요청', 'public-transportation': '대중교통', 'restaurant-basics': '식당 기본 표현', 'restaurant-reservations-and-ordering': '식당 예약과 주문', 'scenery-appreciation': '풍경 감상', 'scheduling-and-appointments': '일정과 약속', 'sharing-travel-experiences': '여행 경험 나누기', 'shopping-and-payments': '쇼핑과 결제', 'shows-and-nightlife': '공연과 밤 문화', 'sightseeing-and-transport': '관광과 교통', 'sizes-and-store-policies': '사이즈와 매장 정책', 'souvenirs-and-shipping': '기념품과 배송', 'survival-communication': '기본 생존 회화', 'taxis-and-rides': '택시와 차량 호출', 'travel-essentials': '여행 필수 표현', 'travel-photos': '여행 사진', 'travel-purpose': '여행 목적', 'travel-review-essentials': '여행 복습 핵심', 'travel-support-calls': '여행 지원 전화', 'weather-and-climate': '날씨와 기후', 'weather-forecast': '일기 예보', 'weather-small-talk': '날씨 잡담',
}

function topicName(topic: string) { return topicNames[topic] ?? topic }

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
  const [state, setState] = useState<LearningState>(() => {
    try { return parseLearningState(window.localStorage.getItem(LEARNING_STORAGE_KEY)) }
    catch { return createEmptyLearningState() }
  })
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
  const [topicsExpanded, setTopicsExpanded] = useState(false)
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const isComposingAnswer = useRef(false)

  useEffect(() => {
    try { persist(state) }
    catch { setStorageNotice('브라우저 저장소를 읽을 수 없습니다. 이번 학습은 계속할 수 있지만 저장되지 않을 수 있습니다.') }
  // The initial snapshot is deliberately written once to complete v1/v2 migration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const currentDayTopic = builtInSentences.find((sentence) => sentence.day === selectedDay)?.topic
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
  const studySummary = getStudySummary(state)
  const historyByDate = useMemo(() => {
    const groups = new Map<string, typeof state.studyActivities>()
    for (const activity of state.studyActivities) {
      const date = getLocalDateKey(new Date(activity.timestamp))
      groups.set(date, [...(groups.get(date) ?? []), activity])
    }
    return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left))
  }, [state.studyActivities])

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
    setTopicsExpanded(false)
    if (topic !== 'all') {
      const firstMatch = builtInSentences.find((sentence) => sentence.topic === topic)
      if (firstMatch) {
        const position = sentences.filter((sentence) => sentence.day === firstMatch.day).findIndex((sentence) => sentence.id === firstMatch.id)
        updateState({ ...state, selectedDay: firstMatch.day, dayPositions: { ...state.dayPositions, [firstMatch.day]: position } })
      }
    }
    resetPracticeContext()
  }

  function toggleMastered(sentence: Sentence) {
    const next = { ...state, masteredIds: mastered.has(sentence.id) ? state.masteredIds.filter((value) => value !== sentence.id) : [...state.masteredIds, sentence.id] }
    updateState(mastered.has(sentence.id) ? next : recordStudyActivity(next, { timestamp: new Date().toISOString(), day: sentence.day, sentenceId: sentence.id, action: 'mastered' }))
  }

  function checkAnswer() {
    if (!current || checkedAnswer) return
    const nextJudgment = judgeAnswer(current, attempt)
    const position = daySentences.findIndex((sentence) => sentence.id === current.id)
    const nextState = recordAttempt(state, { sentence: current, position: Math.max(0, position), judgment: nextJudgment })
    setCheckedAnswer({ sentence: current, judgment: nextJudgment })
    updateState(withCompletedDay(recordStudyActivity({ ...state, ...nextState }, { timestamp: new Date().toISOString(), day: current.day, sentenceId: current.id, action: 'answer-checked', correct: nextJudgment.isCorrect }), current, nextJudgment))
  }

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isComposingAnswer.current && attempt.trim()) checkAnswer()
  }

  function nextPractice() {
    if (current && checkedAnswer && judgment?.isCorrect && !checkedAnswer.judgment.isCorrect) {
      const correctedState = {
        ...state,
        completedSentenceIds: state.completedSentenceIds.includes(current.id) ? state.completedSentenceIds : [...state.completedSentenceIds, current.id],
        reviewQueueIds: state.reviewQueueIds.filter((id) => id !== current.id),
      }
      updateState(withCompletedDay(recordStudyActivity(correctedState, { timestamp: new Date().toISOString(), day: current.day, sentenceId: current.id, action: 'review-completed', correct: true }), current, judgment))
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
    <section className="recent-study" aria-label="최근 학습"><div><strong>최근 학습</strong><span>{studySummary.lastActivity ? `Day ${studySummary.lastDay} · ${formatStudyTimestamp(studySummary.lastActivity.timestamp)}` : '아직 실제 학습 기록이 없습니다.'}</span></div><div><strong>{studySummary.todaySentenceCount}</strong><span>오늘 학습한 문장</span></div><div><strong>{studySummary.streakDays}일</strong><span>현재 연속 학습</span></div><p>기록은 이 브라우저에만 저장되며 기기·브라우저 간 동기화되지 않습니다.</p></section>
    {storageNotice && <p className="notice" role="status">{storageNotice}</p>}
    <nav className="study-tabs" aria-label="학습 메뉴"><button aria-current={tab === 'practice' ? 'page' : undefined} className={tab === 'practice' ? 'active' : ''} onClick={() => setTab('practice')}>타이핑 연습</button><button aria-current={tab === 'cards' ? 'page' : undefined} className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>플래시카드</button><button aria-current={tab === 'review' ? 'page' : undefined} className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}>오답 복습 ({state.reviewQueueIds.length})</button><button aria-current={tab === 'history' ? 'page' : undefined} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>학습 기록</button><button aria-current={tab === 'manage' ? 'page' : undefined} className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>내 문장</button></nav>
    {speechNotice && <p className="hint" role="status">{speechNotice}</p>}

    {tab === 'practice' && <section className="study-panel" aria-labelledby="practice-heading">
      <div className="learning-controls"><label>학습 Day 선택<select value={selectedDay} onChange={(event) => selectDay(Number(event.target.value))}>{Array.from({ length: 60 }, (_, index) => <option key={index + 1} value={index + 1}>Day {index + 1}</option>)}</select></label><label>주제 필터<select value={selectedTopic} onChange={(event) => chooseTopic(event.target.value)}><option value="all">전체 주제</option>{topics.map((topic) => <option key={topic} value={topic}>{topicName(topic)}</option>)}</select></label></div>
      <section className="topic-progress" aria-label="주제별 진행률"><div className="topic-progress-summary"><div><strong>주제별 진행률</strong><span>현재 Day 주제</span></div>{topicProgress.filter((item) => item.topic === currentDayTopic).map((item) => <span className="topic-summary" key={item.topic}>{topicName(item.topic)} <b>{item.completed}/{item.total}</b></span>)}<button type="button" className="text-button" aria-expanded={topicsExpanded} onClick={() => setTopicsExpanded((value) => !value)}>{topicsExpanded ? '전체 주제 진행률 접기' : '전체 주제 진행률 보기'}</button></div>{topicsExpanded && <div className="topic-progress-list">{topicProgress.map((item) => <span key={item.topic}>{topicName(item.topic)} <b>{item.completed}/{item.total}</b></span>)}</div>}</section>
      {current ? <><p className="eyebrow">Day {selectedDay} 학습</p><h2 id="practice-heading">{currentPosition} / {dayChallenge.length} · 한국어를 영어로 입력하세요.</h2><p className="resume-copy">Day {selectedDay}에서 {progress.completed}/{progress.total}개를 완료했어요. 답을 확인하면 다음 위치가 저장됩니다.</p><div className="practice-prompt"><strong>{current.korean}</strong></div><form onSubmit={submitAnswer}><label htmlFor="answer">영어 답변</label><input id="answer" type="text" value={attempt} onChange={(event) => setAttempt(event.target.value)} onCompositionStart={() => { isComposingAnswer.current = true }} onCompositionEnd={() => { isComposingAnswer.current = false }} onKeyDown={(event) => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || isComposingAnswer.current)) event.preventDefault() }} placeholder="영어 문장을 입력하세요" enterKeyHint="go" /><div className="actions"><button className="button" type="submit" disabled={Boolean(checkedAnswer)}>정답 확인</button>{checkedAnswer && <button className="button secondary" type="button" onClick={nextPractice}>다음 문장</button>}</div></form>
      {checkedAnswer && judgment && <div className={`answer-feedback ${judgment.kind === 'exact' ? 'feedback-exact' : judgment.kind === 'accepted-alternative' ? 'feedback-allowed' : 'feedback-needs-work'}`} aria-live="polite"><p><strong>정답:</strong> {current.english}</p><p><strong>{judgment.kind === 'exact' ? '정확' : judgment.kind === 'accepted-alternative' ? '허용 표현' : '수정 필요'}</strong>{judgment.kind === 'exact' ? ' · 정확해요! 저장된 문장과 일치해요.' : judgment.kind === 'accepted-alternative' ? ' · 저장된 허용 표현과 일치해요.' : ' · 누락 또는 오타 단어를 확인해 보세요.'}</p>{!judgment.isCorrect && <p>확인할 단어: {missingWords.length ? missingWords.join(', ') : '어순과 표현'}</p>}<PhraseChoices sentence={current} onChoose={setAttempt} /><div className="word-feedback" aria-label="단어별 피드백">{wordFeedback.map((item, index) => <span className={item.status} key={`${item.word}-${index}`}>{item.word}</span>)}</div><div className="actions"><button className="text-button" onClick={() => speakEnglish(current.english, '정답 문장을 재생했습니다.')}>정답 듣기</button><button className="text-button" onClick={toggleListening} aria-pressed={isListening}>{isListening ? '음성 입력 중지' : '음성으로 입력'}</button><button className="text-button" aria-pressed={state.favoriteIds.includes(current.id)} onClick={() => updateState({ ...state, ...toggleFavorite(state, current.id) })}>{state.favoriteIds.includes(current.id) ? '즐겨찾기 해제' : '즐겨찾기'}</button></div></div>}</> : <p className="empty-state">Day {selectedDay} 문장이 없습니다. 다른 Day를 선택해 보세요.</p>}
      {dialogue && <section className="dialogue-launch"><div><strong>Day {selectedDay} 미니 대화</strong><p>{dialogue.turns.length}턴으로 오늘 표현을 실제 대화처럼 익혀 보세요.</p></div><button className="button secondary" onClick={() => setDialogueOpen(true)}>미니 대화 연습</button></section>}
      {dialogueOpen && dialogue && <section className="mini-dialogue" aria-labelledby="dialogue-heading"><h2 id="dialogue-heading">Day {selectedDay} 미니 대화</h2><p className="turn-pill">{dialogue.turns.length}턴 · {topicName(dialogue.topic)}</p><div className="dialogue-transcript">{dialogue.turns.map((turn, index) => <p key={`${turn.role}-${index}`}><strong>{turn.role}:</strong> {turn.english}<span>{turn.korean}</span></p>)}</div><button className="button" onClick={() => setDialogueOpen(false)}>대화 마치기</button></section>}
    </section>}

    {tab === 'cards' && <section className="study-panel" aria-labelledby="cards-heading"><div className="panel-heading"><div><p className="eyebrow">Flashcards</p><h2 id="cards-heading">뜻을 보고 영어를 떠올려 보세요.</h2></div><label className="filter"><input type="checkbox" checked={hideMastered} onChange={(event) => setHideMastered(event.target.checked)} /> 마스터 숨기기</label></div><div className="card-grid">{(hideMastered ? flashcardSentences.filter((sentence) => !mastered.has(sentence.id)) : flashcardSentences).map((sentence) => <article key={sentence.id} className="flashcard"><div className="card-copy"><span className="korean-copy">{sentence.korean}</span><span className="reveal-copy">{revealed === sentence.id ? sentence.english : null}</span></div><div className="card-actions"><button className="card-action" onClick={() => setRevealed(revealed === sentence.id ? null : sentence.id)} aria-expanded={revealed === sentence.id}>{revealed === sentence.id ? '영어 문장 숨기기' : '영어 문장 보기'}</button><button className="card-action" onClick={() => speakEnglish(sentence.english, '영어 문장을 재생했습니다.')}>음성으로 듣기</button></div><button className="master-button" aria-pressed={mastered.has(sentence.id)} onClick={() => toggleMastered(sentence)}>{mastered.has(sentence.id) ? '마스터 해제' : '마스터로 표시'}</button></article>)}</div></section>}

    {tab === 'review' && <section className="study-panel" aria-labelledby="review-heading"><p className="eyebrow">Review queue</p><h2 id="review-heading">오답과 즐겨찾기 복습</h2>{reviewSentences.length === 0 && state.favoriteIds.length === 0 ? <p className="empty-state">아직 복습할 문장이 없습니다. 답을 확인하거나 즐겨찾기를 선택해 보세요.</p> : <ul className="review-list">{sentences.filter((sentence) => state.reviewQueueIds.includes(sentence.id) || state.favoriteIds.includes(sentence.id)).map((sentence) => <li key={sentence.id}><div><strong>{sentence.korean}</strong><span>{sentence.english}</span></div><button className="text-button" onClick={() => practiceAgain(sentence)}>다시 연습</button></li>)}</ul>}</section>}

    {tab === 'history' && <section className="study-panel" aria-labelledby="history-heading"><p className="eyebrow">Study timeline</p><h2 id="history-heading">학습 기록</h2>{historyByDate.length === 0 ? <p className="empty-state">아직 기록이 없습니다. 정답을 확인하거나 문장을 마스터하면 실제 학습 기록이 남습니다.</p> : <div className="study-timeline">{historyByDate.map(([date, activities]) => <section key={date}><h3>{formatStudyDate(activities[0].timestamp)}</h3>{[...new Set(activities.map((activity) => activity.day))].sort((left, right) => left - right).map((day) => { const dayActivities = activities.filter((activity) => activity.day === day); const completed = new Set(dayActivities.filter((activity) => activity.correct || activity.action === 'mastered').map((activity) => activity.sentenceId)).size; return <article key={day}><div><strong>Day {day}</strong><span>{completed}/10 완료 문장</span></div><p>{formatStudyTimestamp(dayActivities[dayActivities.length - 1].timestamp)} 시작 · {formatStudyTimestamp(dayActivities[0].timestamp)} 최근 학습</p></article> })}</section>)}</div>}</section>}

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