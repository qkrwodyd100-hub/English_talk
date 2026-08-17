import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  getDayProgress,
  getResumeTarget,
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
  getLegacyHistory,
  getLearningNotes,
  getStudySummary,
  getTodayKey,
  getWordFeedback,
  isPersistableLearningPayload,
  mergeLearningStates,
  parseLearningState,
  appendAnswerAttempt,
  recordStudyActivity,
  saveSentenceNote,
  type AnswerVerdict,
  type CustomSentence,
  type LearningState,
  type Sentence,
} from './learning'
import { builtInDialogues } from './dialogues'
import { builtInSentences } from './sentences'
import { useLearningCloud } from './use-learning-cloud'

type Tab = 'practice' | 'cards' | 'review' | 'manage' | 'history' | 'notes'
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
type CheckedAnswer = { sentence: Sentence; judgment: AnswerJudgment }

const LEARNING_BACKUP_STORAGE_KEY = `${LEARNING_STORAGE_KEY}.backup`

const topicNames: Record<string, string> = {
  'airport-services': '공항 이용', 'asking-for-directions': '길 묻기', 'asking-for-help': '도움 요청', 'asking-for-photo-help': '사진 부탁', 'asking-locals-for-help': '현지인에게 도움 요청', 'attraction-information': '관광지 정보', 'business-meetings': '비즈니스 미팅', 'cafe-orders': '카페 주문', 'checking-understanding': '이해 확인', 'clothing-shopping': '옷 쇼핑', 'compliments-and-encouragement': '칭찬과 격려', 'confident-conversation-closings': '자신 있는 대화 마무리', 'conversation-reactions': '대화 반응', 'day-trip-booking': '당일 여행 예약', 'detailed-travel-questions': '상세 여행 질문', 'dining-requests': '식사 요청', 'emergencies-and-local-help': '긴급 상황과 현지 도움', 'emergencies-and-police': '긴급 상황과 경찰', 'ending-a-conversation': '대화 마무리', 'everyday-conversation': '일상 대화', 'feelings-and-emotions': '감정 표현', 'flight-booking': '항공권 예약', 'getting-oriented': '방향 파악', 'hobbies-and-interests': '취미와 관심사', 'hotel-and-dining': '호텔과 식사', 'hotel-check-in': '호텔 체크인', 'hotel-check-out': '호텔 체크아웃', 'hotel-room-problems': '호텔 객실 문제', 'hotel-services': '호텔 서비스', 'immigration-and-customs': '입국 심사와 세관', 'local-culture-and-language': '현지 문화와 언어', 'local-dining-customs': '현지 식사 예절', 'local-information': '현지 정보', 'market-bargaining': '시장 흥정', 'medical-symptoms': '증상 설명', 'meeting-locals': '현지인 만나기', 'meeting-new-people': '새로운 사람 만나기', 'messages-and-email': '메시지와 이메일', 'opinions-and-recommendations': '의견과 추천', 'payments-and-returns': '결제와 반품', 'pharmacy-and-medicine': '약국과 의약품', 'phone-and-tech-support': '전화와 기술 지원', 'phone-calls': '전화 통화', 'phone-calls-and-arrangements': '전화와 약속 잡기', 'polite-disagreement': '정중한 반대', 'polite-formal-requests': '격식 있는 정중한 요청', 'polite-requests': '정중한 요청', 'public-transportation': '대중교통', 'restaurant-basics': '식당 기본 표현', 'restaurant-reservations-and-ordering': '식당 예약과 주문', 'scenery-appreciation': '풍경 감상', 'scheduling-and-appointments': '일정과 약속', 'sharing-travel-experiences': '여행 경험 나누기', 'shopping-and-payments': '쇼핑과 결제', 'shows-and-nightlife': '공연과 밤 문화', 'sightseeing-and-transport': '관광과 교통', 'sizes-and-store-policies': '사이즈와 매장 정책', 'souvenirs-and-shipping': '기념품과 배송', 'survival-communication': '기본 생존 회화', 'taxis-and-rides': '택시와 차량 호출', 'travel-essentials': '여행 필수 표현', 'travel-photos': '여행 사진', 'travel-purpose': '여행 목적', 'travel-review-essentials': '여행 복습 핵심', 'travel-support-calls': '여행 지원 전화', 'weather-and-climate': '날씨와 기후', 'weather-forecast': '일기 예보', 'weather-small-talk': '날씨 잡담',
}

function topicName(topic: string) { return topicNames[topic] ?? topic }

function getRecognition() {
  const browser = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

function persist(state: LearningState) {
  const previous = window.localStorage.getItem(LEARNING_STORAGE_KEY)
  if (previous) window.localStorage.setItem(LEARNING_BACKUP_STORAGE_KEY, previous)
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
  const applyCloudState = useCallback((next: LearningState) => {
    setState(next)
    try { persist(next) } catch { setStorageNotice('클라우드 기록을 읽었지만 브라우저 저장소에 저장하지 못했습니다.') }
  }, [])
  const [hideMastered, setHideMastered] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState('all')
  const [attempt, setAttempt] = useState('')
  const [noteQuery, setNoteQuery] = useState('')
  const [noteDay, setNoteDay] = useState('all')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [listNoteDraft, setListNoteDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [noteStatus, setNoteStatus] = useState('')
  const [attemptHistoryOpen, setAttemptHistoryOpen] = useState(false)
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
  const backupInput = useRef<HTMLInputElement | null>(null)
  const isComposingAnswer = useRef(false)
  const answerInput = useRef<HTMLInputElement | null>(null)
  const hasExplicitDaySelection = useRef(false)
  const hasAppliedResumeTarget = useRef(false)
  const cloud = useLearningCloud(state, applyCloudState)

  function cancelListening() {
    const activeRecognition = recognition.current
    if (!activeRecognition) return
    recognition.current = null
    activeRecognition.onresult = null
    activeRecognition.onerror = null
    activeRecognition.onend = null
    try { activeRecognition.abort?.() ?? activeRecognition.stop() } catch { /* The browser already stopped the recognition session. */ }
    setIsListening(false)
  }

  useEffect(() => {
    const raw = window.localStorage.getItem(LEARNING_STORAGE_KEY)
    if (!isPersistableLearningPayload(raw)) {
      setStorageNotice('저장된 학습 데이터를 읽지 못했습니다. 기존 데이터는 덮어쓰지 않았습니다. 브라우저 저장소에서 백업 JSON을 복사한 뒤 지원팀에 전달해 주세요.')
      return
    }
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

  useEffect(() => () => cancelListening(), [])

  const selectedDay = state.selectedDay ?? 1
  const sentences = useMemo(() => [...builtInSentences, ...state.customSentences], [state.customSentences])
  const resumeTarget = useMemo(() => getResumeTarget(sentences, state), [sentences, state])
  const topics = useMemo(() => [...new Set(builtInSentences.map((sentence) => sentence.topic))], [])
  const dayChallenge = getSequentialDayChallenge(sentences, state, selectedDay)
  const currentDayTopic = builtInSentences.find((sentence) => sentence.day === selectedDay)?.topic
  const filteredChallenge = selectedTopic === 'all' ? dayChallenge : dayChallenge.filter((sentence) => sentence.source === 'builtIn' && sentence.topic === selectedTopic)
  const daySentences = sentences.filter((sentence) => sentence.day === selectedDay)
  const flashcardSentences = selectedTopic === 'all' ? daySentences : daySentences.filter((sentence) => sentence.source === 'builtIn' && sentence.topic === selectedTopic)
  const current = checkedAnswer?.sentence ?? filteredChallenge[0]
  const currentPosition = current ? daySentences.findIndex((sentence) => sentence.id === current.id) + 1 : 0
  const navigationSentences = selectedTopic === 'all' ? daySentences : daySentences.filter((sentence) => sentence.source === 'builtIn' && sentence.topic === selectedTopic)
  const navigationPosition = current ? navigationSentences.findIndex((sentence) => sentence.id === current.id) : -1
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
  const legacyHistory = useMemo(() => getLegacyHistory(state), [state])
  const learningNotes = useMemo(() => getLearningNotes(sentences, state, noteQuery, noteDay === 'all' ? undefined : Number(noteDay)), [sentences, state, noteDay, noteQuery])

  useEffect(() => {
    setNoteDraft(current ? state.sentenceNotes[current.id]?.text ?? '' : '')
    setNoteStatus('')
    setAttemptHistoryOpen(false)
  }, [current?.id, state.sentenceNotes])

  useEffect(() => {
    if (hasAppliedResumeTarget.current) return
    hasAppliedResumeTarget.current = true
    if (hasExplicitDaySelection.current || resumeTarget.isCourseComplete) return
    if (resumeTarget.day === selectedDay && (state.dayPositions[resumeTarget.day] ?? 0) === resumeTarget.position) return
    const next = { ...state, selectedDay: resumeTarget.day, dayPositions: { ...state.dayPositions, [resumeTarget.day]: resumeTarget.position } }
    setState(next)
    try { persist(next) } catch { setStorageNotice('저장에 실패했습니다. 화면의 학습은 계속되지만 새로고침하면 변경사항이 사라질 수 있습니다.') }
  }, [resumeTarget, selectedDay, state])

  function updateState(next: LearningState) {
    setState(next)
    try {
      persist(next)
      setStorageNotice('')
    } catch {
      setStorageNotice('저장에 실패했습니다. 화면의 학습은 계속되지만 새로고침하면 변경사항이 사라질 수 있습니다.')
    }
  }

  function exportBackup() {
    const payload = JSON.stringify({ version: LEARNING_STORAGE_VERSION, state }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'english-talk-learning-backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function restoreBackup(file: File | undefined) {
    if (!file) return
    const raw = await file.text()
    if (!isPersistableLearningPayload(raw)) {
      setStorageNotice('백업 파일 형식을 확인할 수 없습니다. 기존 학습 데이터는 변경하지 않았습니다.')
      return
    }
    updateState(mergeLearningStates(state, parseLearningState(raw)))
    setStorageNotice('백업을 현재 학습 기록과 합쳤습니다. 기존 데이터는 유지됩니다.')
  }

  function resetPracticeContext() {
    cancelListening()
    setAttempt('')
    setCheckedAnswer(null)
    setSpeechNotice('')
    setDialogueOpen(false)
    setNoteStatus('')
  }

  function selectDay(day: number) {
    hasExplicitDaySelection.current = true
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
    const timestamp = new Date().toISOString()
    const verdict: AnswerVerdict = nextJudgment.kind === 'exact' ? 'correct' : nextJudgment.kind === 'accepted-alternative' ? 'equivalent' : nextJudgment.kind === 'contextual-correct' ? 'contextual' : 'needs-fix'
    const reason = nextJudgment.kind === 'contextual-correct' && current.source === 'builtIn' ? current.contextualTips?.find((tip) => tip.english.toLocaleLowerCase() === attempt.trim().toLocaleLowerCase())?.reason : undefined
    updateState(withCompletedDay(appendAnswerAttempt(recordStudyActivity({ ...state, ...nextState }, { timestamp, day: current.day, sentenceId: current.id, action: 'answer-checked', correct: nextJudgment.isCorrect }), current.id, { timestamp, attempt: attempt.trim(), verdict, reason }), current, nextJudgment))
  }

  function saveNote() {
    if (!current) return
    if (noteDraft.trim().length > 2000) { setNoteStatus('노트는 2,000자까지 저장할 수 있어요.'); return }
    updateState(saveSentenceNote(state, current.id, noteDraft, new Date().toISOString()))
    setNoteStatus(noteDraft.trim() ? '저장됨' : '노트를 삭제했어요.')
  }

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isComposingAnswer.current && attempt.trim()) checkAnswer()
  }

  function nextPractice(advanceToNextDay = false) {
    let nextState = state
    if (current && checkedAnswer && judgment?.isCorrect && !checkedAnswer.judgment.isCorrect) {
      const correctedState = {
        ...state,
        completedSentenceIds: state.completedSentenceIds.includes(current.id) ? state.completedSentenceIds : [...state.completedSentenceIds, current.id],
        reviewQueueIds: state.reviewQueueIds.filter((id) => id !== current.id),
      }
      nextState = withCompletedDay(recordStudyActivity(correctedState, { timestamp: new Date().toISOString(), day: current.day, sentenceId: current.id, action: 'review-completed', correct: true }), current, judgment)
    }
    if (advanceToNextDay && current && currentPosition === daySentences.length) {
      if (current.day >= 60) {
        if (nextState !== state) updateState(nextState)
        setSpeechNotice('마지막 Day입니다. 다음 문장이 없습니다.')
        return
      }
      recognition.current?.abort?.()
      setIsListening(false)
      hasExplicitDaySelection.current = true
      updateState({ ...nextState, selectedDay: current.day + 1, dayPositions: { ...nextState.dayPositions, [current.day + 1]: 0 } })
      setSelectedTopic('all')
      resetPracticeContext()
      window.requestAnimationFrame(() => answerInput.current?.focus())
      return
    }
    if (nextState !== state) updateState(nextState)
    resetPracticeContext()
    window.requestAnimationFrame(() => answerInput.current?.focus())
  }

  function browsePractice(offset: -1 | 1) {
    if (!current) return
    const nextSentence = navigationSentences[navigationPosition + offset]
    if (!nextSentence) return
    const nextDayPosition = daySentences.findIndex((sentence) => sentence.id === nextSentence.id)
    updateState({ ...state, dayPositions: { ...state.dayPositions, [selectedDay]: nextDayPosition } })
    resetPracticeContext()
    window.requestAnimationFrame(() => answerInput.current?.focus())
  }

  function handleAnswerKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || isComposingAnswer.current)) {
      event.preventDefault()
      return
    }
    if (event.key !== 'ArrowRight' || !checkedAnswer || event.nativeEvent.isComposing || isComposingAnswer.current || event.ctrlKey || event.altKey || event.metaKey) return
    event.preventDefault()
    nextPractice(true)
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
    if (isListening) {
      cancelListening()
      setSpeechNotice('음성 입력을 중지했습니다. 텍스트를 수정한 뒤 정답을 제출하세요.')
      return
    }
    const instance = new Recognition()
    instance.lang = 'en-US'; instance.interimResults = false; instance.continuous = false
    let receivedFinalTranscript = false
    instance.onresult = (event) => {
      if (recognition.current !== instance || receivedFinalTranscript) return
      const result = event.results[0]?.[0]
      if (!result || result.isFinal === false) return
      const transcript = result.transcript.trim()
      if (!transcript) return
      receivedFinalTranscript = true
      setAttempt((currentAttempt) => `${currentAttempt}${currentAttempt.trim() ? ' ' : ''}${transcript}`)
      setSpeechNotice('음성 입력이 완료되었습니다. 내용을 확인한 뒤 정답을 제출하세요.')
    }
    instance.onerror = (event) => {
      if (recognition.current !== instance) return
      recognition.current = null
      setIsListening(false)
      setSpeechNotice(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? '마이크 권한이 거부되었습니다. 텍스트 입력으로 계속 학습할 수 있습니다.'
        : event.error === 'no-speech'
          ? '음성이 감지되지 않았습니다. 다시 시도하거나 텍스트로 입력하세요.'
          : '음성 입력 중 오류가 발생했습니다. 텍스트 입력으로 계속 학습할 수 있습니다.')
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
      setSpeechNotice('듣는 중입니다. 음성은 브라우저 또는 기기 공급자의 음성 인식 서비스에서 처리될 수 있으며 자동 저장·제출하지 않습니다.')
    } catch {
      recognition.current = null
      setSpeechNotice('음성 입력을 시작할 수 없습니다. 텍스트 입력으로 계속 학습할 수 있습니다.')
    }
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

  function openNoteEditor(sentence: Sentence) {
    setEditingNoteId(sentence.id)
    setListNoteDraft(state.sentenceNotes[sentence.id]?.text ?? '')
  }

  function saveListNote(sentence: Sentence) {
    updateState(saveSentenceNote(state, sentence.id, listNoteDraft, new Date().toISOString()))
    setEditingNoteId(null)
  }

  if (!cloud.initialized) return <main className="learning-shell"><p role="status">로그인 상태 확인 중…</p></main>

  return <main className="learning-shell">
    <header className="learning-header"><div><p className="eyebrow">English Talk · 60-day study</p><h1>더 넓은 세상으로의 시작</h1></div><p className="fixture-note">60일 동안 매일 10문장씩 학습해요. 마지막으로 학습한 Day와 문장부터 이어집니다.</p></header>
    <CloudAccountPanel cloud={cloud} />
    <section className="dashboard" aria-label="학습 현황"><div><strong>{sentences.length}</strong><span>전체 문장</span></div><div><strong>{state.masteredIds.length}</strong><span>마스터</span></div><div><strong>{overallProgress}%</strong><span>학습 진행률</span></div><div><strong>{completedToday ? '완료' : `Day ${selectedDay}`}</strong><span>현재 학습</span></div><div className="progress-track" role="progressbar" aria-label="마스터 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={masteryProgress}><span style={{ width: `${masteryProgress}%` }} /></div></section>
    <section className="recent-study" aria-label="최근 학습"><div><strong>최근 학습</strong><span>{studySummary.lastActivity ? `Day ${studySummary.lastDay} · ${formatStudyTimestamp(studySummary.lastActivity.timestamp)}` : '아직 실제 학습 기록이 없습니다.'}</span></div><div><strong>{studySummary.todaySentenceCount}</strong><span>오늘 학습한 문장</span></div><div><strong>{studySummary.streakDays}일</strong><span>현재 연속 학습</span></div><p>{cloud.user ? '로그인한 계정의 기록은 이 기기와 클라우드에 함께 저장됩니다.' : '로그인 전 기록은 이 브라우저에 즉시 저장됩니다.'}</p></section>
    {storageNotice && <p className="notice" role="status">{storageNotice}</p>}
    <nav className="study-tabs" aria-label="학습 메뉴"><button aria-current={tab === 'practice' ? 'page' : undefined} className={tab === 'practice' ? 'active' : ''} onClick={() => setTab('practice')}>타이핑 연습</button><button aria-current={tab === 'cards' ? 'page' : undefined} className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>플래시카드</button><button aria-current={tab === 'review' ? 'page' : undefined} className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}>오답 복습 ({state.reviewQueueIds.length})</button><button aria-current={tab === 'history' ? 'page' : undefined} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>학습 기록</button><button aria-current={tab === 'notes' ? 'page' : undefined} className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}>학습 노트</button><button aria-current={tab === 'manage' ? 'page' : undefined} className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>내 문장</button></nav>
    {speechNotice && <p className="hint" role="status">{speechNotice}</p>}

    {tab === 'practice' && <section className="study-panel" aria-labelledby="practice-heading">
      <div className="learning-controls"><label>학습 Day 선택<select value={selectedDay} onChange={(event) => selectDay(Number(event.target.value))}>{Array.from({ length: 60 }, (_, index) => <option key={index + 1} value={index + 1}>Day {index + 1}</option>)}</select></label><label>주제 필터<select value={selectedTopic} onChange={(event) => chooseTopic(event.target.value)}><option value="all">전체 주제</option>{topics.map((topic) => <option key={topic} value={topic}>{topicName(topic)}</option>)}</select></label></div>
      <section className="topic-progress" aria-label="주제별 진행률"><div className="topic-progress-summary"><div><strong>주제별 진행률</strong><span>현재 Day 주제</span></div>{topicProgress.filter((item) => item.topic === currentDayTopic).map((item) => <span className="topic-summary" key={item.topic}>{topicName(item.topic)} <b>{item.completed}/{item.total}</b></span>)}<button type="button" className="text-button" aria-expanded={topicsExpanded} onClick={() => setTopicsExpanded((value) => !value)}>{topicsExpanded ? '전체 주제 진행률 접기' : '전체 주제 진행률 보기'}</button></div>{topicsExpanded && <div className="topic-progress-list">{topicProgress.map((item) => <span key={item.topic}>{topicName(item.topic)} <b>{item.completed}/{item.total}</b></span>)}</div>}</section>
      {current ? <><p className="eyebrow">Day {selectedDay} 학습</p><h2 id="practice-heading">{currentPosition} / {dayChallenge.length} · 한국어를 영어로 입력하세요.</h2><p className="resume-copy">Day {selectedDay}에서 {progress.completed}/{progress.total}개를 완료했어요. 답을 확인하면 다음 위치가 저장됩니다.</p><div className="practice-workspace"><div><div className="practice-prompt"><strong>{current.korean}</strong></div><form autoComplete="off" onSubmit={submitAnswer}><div className="answer-input-row"><input ref={answerInput} id="practice-answer" name="practice-answer" aria-label="영어 답변" aria-describedby="answer-shortcut" type="text" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-1p-ignore="true" data-lpignore="true" value={attempt} onChange={(event) => setAttempt(event.target.value)} onCompositionStart={() => { isComposingAnswer.current = true }} onCompositionEnd={() => { isComposingAnswer.current = false }} onKeyDown={handleAnswerKeyDown} placeholder="영어 문장을 입력하세요" enterKeyHint="go" /><button className="text-button" type="button" onClick={toggleListening} aria-pressed={isListening}>{isListening ? '음성 입력 중지' : '음성으로 입력'}</button></div><p id="answer-shortcut" className="sr-only">정답 확인 후 오른쪽 화살표 키로 다음 문장으로 이동할 수 있습니다.</p><div className="actions practice-navigation"><button className="button" type="submit" disabled={Boolean(checkedAnswer)}>정답 확인</button><button className="button secondary" type="button" onClick={() => browsePractice(-1)} disabled={navigationPosition <= 0}>이전</button><button className="button secondary" type="button" aria-label={checkedAnswer ? '다음 문장' : '다음'} onClick={checkedAnswer ? () => nextPractice() : () => browsePractice(1)} disabled={navigationPosition >= navigationSentences.length - 1}>다음</button></div></form></div><aside className="sentence-note" aria-labelledby="note-heading"><h3 id="note-heading">내 학습 노트</h3><textarea aria-label="내 학습 노트" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={2000} placeholder="표현 차이, 기억할 상황을 적어 보세요." /><div className="note-footer"><span>{noteStatus || (state.sentenceNotes[current.id] ? `최근 수정 ${formatStudyTimestamp(state.sentenceNotes[current.id].updatedAt)}` : '아직 저장한 노트가 없어요.')}</span><button type="button" className="button secondary" onClick={saveNote}>노트 저장</button></div>{(state.answerHistory[current.id] ?? []).length > 0 && <><button className="text-button" type="button" aria-expanded={attemptHistoryOpen} onClick={() => setAttemptHistoryOpen((value) => !value)}>이전 답변 기록 있음 ({state.answerHistory[current.id].length})</button>{attemptHistoryOpen && <ul className="attempt-history">{state.answerHistory[current.id].map((entry) => <li key={`${entry.timestamp}-${entry.attempt}`}><strong>{entry.verdict}</strong><span>{entry.attempt}</span><small>{formatStudyTimestamp(entry.timestamp)}{entry.reason ? ` · ${entry.reason}` : ''}</small></li>)}</ul>}</>}</aside></div>
      {checkedAnswer && judgment && <div className={`answer-feedback ${judgment.kind === 'exact' ? 'feedback-exact' : judgment.isCorrect ? 'feedback-allowed' : 'feedback-needs-work'}`} aria-live="polite"><p><strong>정답:</strong> {current.english}</p><p><strong>{judgment.kind === 'exact' ? '정답 · 정확해요!' : judgment.kind === 'accepted-alternative' ? '정답' : judgment.kind === 'contextual-correct' ? '정답 · 더 자연스러운 표현' : '수정 필요'}</strong>{judgment.kind === 'exact' ? ' · 입력한 표현이 기준 문장과 같거나 축약형만 달라요.' : judgment.kind === 'accepted-alternative' ? ' · 저장된 동등 표현과 일치해요.' : judgment.kind === 'contextual-correct' ? ' · 상황에 맞는 표현이에요. 기준 표현도 함께 익혀 보세요.' : ' · 누락 또는 오타 단어를 확인해 보세요.'}</p>{!judgment.isCorrect && <p>확인할 단어: {missingWords.length ? missingWords.join(', ') : '어순과 표현'}</p>}<PhraseChoices sentence={current} onChoose={setAttempt} /><div className="word-feedback" aria-label="단어별 피드백">{wordFeedback.map((item, index) => <span className={item.status} key={`${item.word}-${index}`}>{item.word}</span>)}</div><div className="actions"><button className="text-button" onClick={() => speakEnglish(current.english, '정답 문장을 재생했습니다.')}>정답 듣기</button><button className="text-button" aria-pressed={state.favoriteIds.includes(current.id)} onClick={() => updateState({ ...state, ...toggleFavorite(state, current.id) })}>{state.favoriteIds.includes(current.id) ? '즐겨찾기 해제' : '즐겨찾기'}</button></div></div>}</> : <p className="empty-state">Day {selectedDay} 문장이 없습니다. 다른 Day를 선택해 보세요.</p>}
      {dialogue && <section className="dialogue-launch"><div><strong>Day {selectedDay} 미니 대화</strong><p>{dialogue.turns.length}턴으로 오늘 표현을 실제 대화처럼 익혀 보세요.</p></div><button className="button secondary" onClick={() => setDialogueOpen(true)}>미니 대화 연습</button></section>}
      {dialogueOpen && dialogue && <section className="mini-dialogue" aria-labelledby="dialogue-heading"><h2 id="dialogue-heading">Day {selectedDay} 미니 대화</h2><p className="turn-pill">{dialogue.turns.length}턴 · {topicName(dialogue.topic)}</p><div className="dialogue-transcript">{dialogue.turns.map((turn, index) => <p key={`${turn.role}-${index}`}><strong>{turn.role}:</strong> {turn.english}<span>{turn.korean}</span></p>)}</div><button className="button" onClick={() => setDialogueOpen(false)}>대화 마치기</button></section>}
    </section>}

    {tab === 'cards' && <section className="study-panel" aria-labelledby="cards-heading"><div className="panel-heading"><div><p className="eyebrow">Flashcards</p><h2 id="cards-heading">뜻을 보고 영어를 떠올려 보세요.</h2></div><label className="filter"><input type="checkbox" checked={hideMastered} onChange={(event) => setHideMastered(event.target.checked)} /> 마스터 숨기기</label></div><div className="card-grid">{(hideMastered ? flashcardSentences.filter((sentence) => !mastered.has(sentence.id)) : flashcardSentences).map((sentence) => <article key={sentence.id} className="flashcard"><div className="card-copy"><span className="korean-copy">{sentence.korean}</span><span className="reveal-copy">{revealed === sentence.id ? sentence.english : null}</span></div><div className="card-actions"><button className="card-action" onClick={() => setRevealed(revealed === sentence.id ? null : sentence.id)} aria-expanded={revealed === sentence.id}>{revealed === sentence.id ? '영어 문장 숨기기' : '영어 문장 보기'}</button><button className="card-action" onClick={() => speakEnglish(sentence.english, '영어 문장을 재생했습니다.')}>음성으로 듣기</button></div><button className="master-button" aria-pressed={mastered.has(sentence.id)} onClick={() => toggleMastered(sentence)}>{mastered.has(sentence.id) ? '마스터 해제' : '마스터로 표시'}</button></article>)}</div></section>}

    {tab === 'review' && <section className="study-panel" aria-labelledby="review-heading"><p className="eyebrow">Review queue</p><h2 id="review-heading">오답과 즐겨찾기 복습</h2>{reviewSentences.length === 0 && state.favoriteIds.length === 0 ? <p className="empty-state">아직 복습할 문장이 없습니다. 답을 확인하거나 즐겨찾기를 선택해 보세요.</p> : <ul className="review-list">{sentences.filter((sentence) => state.reviewQueueIds.includes(sentence.id) || state.favoriteIds.includes(sentence.id)).map((sentence) => <li key={sentence.id}><div><strong>{sentence.korean}</strong><span>{sentence.english}</span></div><button className="text-button" onClick={() => practiceAgain(sentence)}>다시 연습</button></li>)}</ul>}</section>}

    {tab === 'history' && <section className="study-panel" aria-labelledby="history-heading"><p className="eyebrow">Study timeline</p><h2 id="history-heading">학습 기록</h2><section className="backup-controls" aria-label="학습 데이터 백업"><p>기록은 이 브라우저·이 도메인에만 저장됩니다. JSON 백업을 내려받아 다른 브라우저에서 안전하게 복원할 수 있습니다.</p><div className="actions"><button type="button" className="button secondary" onClick={exportBackup}>JSON 백업 내보내기</button><button type="button" className="button secondary" onClick={() => backupInput.current?.click()}>JSON 백업 복원</button><input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={(event) => { void restoreBackup(event.target.files?.[0]); event.target.value = '' }} /></div></section>{legacyHistory.length > 0 && <section className="study-timeline" aria-label="이전 학습 기록"><h3>이전 학습 기록 (날짜 미상)</h3>{legacyHistory.map((item) => <article key={item.day}><div><strong>Day {item.day}</strong><span>{item.completedSentenceCount}/10 완료 문장</span></div><p>기존 저장 데이터에 정확한 학습 시각이 없어 날짜를 추정하지 않았습니다.</p></article>)}</section>}{historyByDate.length === 0 ? legacyHistory.length === 0 && <p className="empty-state">아직 학습 기록이 없어요</p> : <><section className="history-summary" aria-label="학습 날짜 요약"><article className="history-summary-start"><h3>학습 시작일</h3><p>{formatStudyTimestamp(studySummary.firstActivity!.timestamp)}</p><span>첫 실제 학습 행동을 시작한 시각</span></article><article className="history-summary-recent"><h3>최근 학습일</h3><p>{formatStudyTimestamp(studySummary.lastActivity!.timestamp)}</p><span>가장 최근 실제 학습 행동 시각</span></article></section><div className="study-timeline">{historyByDate.map(([date, activities]) => <section key={date}><h3>{formatStudyDate(activities[0].timestamp)}</h3>{[...new Set(activities.map((activity) => activity.day))].sort((left, right) => left - right).map((day) => { const dayActivities = activities.filter((activity) => activity.day === day); const completed = new Set(dayActivities.filter((activity) => activity.correct || activity.action === 'mastered').map((activity) => activity.sentenceId)).size; return <article key={day}><div><strong>Day {day}</strong><span>{completed}/10 완료 문장</span></div><p>{formatStudyTimestamp(dayActivities[dayActivities.length - 1].timestamp)} 시작 · {formatStudyTimestamp(dayActivities[0].timestamp)} 최근 학습</p></article> })}</section>)}</div></>}</section>}

    {tab === 'notes' && <section className="study-panel" aria-labelledby="notes-heading"><p className="eyebrow">Saved learning notes</p><h2 id="notes-heading">학습 노트</h2><p className="resume-copy">저장한 노트, 한국어 prompt, 기준 영어 문장을 함께 검색합니다. 최근 수정한 노트부터 표시해요.</p><div className="learning-controls"><label>노트 검색<input type="search" value={noteQuery} onChange={(event) => setNoteQuery(event.target.value)} placeholder="상황, 한국어, 영어로 검색" /></label><label>Day 필터<select value={noteDay} onChange={(event) => setNoteDay(event.target.value)}><option value="all">전체 Day</option>{Array.from({ length: 60 }, (_, index) => <option key={index + 1} value={index + 1}>Day {index + 1}</option>)}</select></label></div>{Object.keys(state.sentenceNotes).length === 0 ? <p className="empty-state">아직 저장한 노트가 없어요. 타이핑 연습에서 문장별 노트를 작성해 보세요.</p> : learningNotes.length === 0 ? <p className="empty-state">검색하거나 선택한 Day에 맞는 노트가 없어요.</p> : <ul className="learning-notes-list">{learningNotes.map(({ sentence, note }) => <li key={sentence.id}><div className="note-heading"><strong>Day {sentence.day} · 문장 {sentences.filter((item) => item.day === sentence.day).findIndex((item) => item.id === sentence.id) + 1}</strong><span>최근 수정 {formatStudyTimestamp(note.updatedAt)}</span></div>{editingNoteId === sentence.id ? <><label className="sr-only" htmlFor={`note-${sentence.id}`}>학습 노트 수정</label><textarea id={`note-${sentence.id}`} value={listNoteDraft} maxLength={2000} onChange={(event) => setListNoteDraft(event.target.value)} /><div className="actions"><button type="button" className="button" onClick={() => saveListNote(sentence)}>저장</button><button type="button" className="button secondary" onClick={() => setEditingNoteId(null)}>취소</button></div></> : <><p className="note-copy">{note.text}</p><p className="note-prompt"><strong>한국어:</strong> {sentence.korean}</p><p className="note-answer"><strong>영어:</strong> {sentence.english}</p><div className="actions"><button type="button" className="text-button" onClick={() => practiceAgain(sentence)}>이 문장으로 이동</button><button type="button" className="text-button" onClick={() => openNoteEditor(sentence)}>노트 수정</button></div></>}</li>)}</ul>}</section>}

    {tab === 'manage' && <section className="study-panel" aria-labelledby="manage-heading"><div className="panel-heading"><div><p className="eyebrow">Personal sentences</p><h2 id="manage-heading">나만의 문장을 추가하세요.</h2></div><button className="button" onClick={() => startEditing()}>문장 추가</button></div>{editing && <form className="sentence-form" onSubmit={saveCustom}><label>영어 문장<input value={english} onChange={(event) => setEnglish(event.target.value)} required /></label><label>한국어 뜻<input value={korean} onChange={(event) => setKorean(event.target.value)} required /></label><div className="actions"><button className="button" type="submit">저장</button><button className="button secondary" type="button" onClick={() => setEditing(null)}>취소</button></div></form>}{state.customSentences.length === 0 ? <p className="empty-state">아직 내 문장이 없습니다. 자주 쓰는 문장을 추가해 보세요.</p> : <ul className="custom-list">{state.customSentences.map((sentence) => <li key={sentence.id}><div><strong>{sentence.english}</strong><span>{sentence.korean}</span></div><div className="row-actions"><button className="text-button" onClick={() => startEditing(sentence)}>수정</button><button className="text-button danger" onClick={() => deleteCustom(sentence.id)}>삭제</button></div></li>)}</ul>}</section>}
  </main>
}

function CloudAccountPanel({ cloud }: { cloud: ReturnType<typeof useLearningCloud> }) {
  const [email, setEmail] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setAuthMessage(await cloud.signIn(email.trim()))
    setSending(false)
  }

  return <section className={`cloud-account cloud-${cloud.status}`} aria-label="계정 및 동기화">
    <div>
      <strong>{cloud.user?.email ?? '기기 간 학습 기록 동기화'}</strong>
      <p>{authMessage || cloud.message}</p>
    </div>
    {cloud.user ? <div className="cloud-actions">
      {cloud.status === 'error' && <button type="button" className="button secondary" onClick={cloud.retry}>동기화 다시 시도</button>}
      <button type="button" className="button secondary" onClick={cloud.synchronizeNow} disabled={cloud.status === 'syncing'}>지금 동기화</button>
      <button type="button" className="text-button" onClick={() => { void cloud.signOut() }}>로그아웃</button>
    </div> : cloud.configured ? <form className="cloud-login" onSubmit={sendMagicLink}>
      <label htmlFor="login-email">로그인 이메일</label>
      <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      <button type="submit" className="button" disabled={sending}>{sending ? '보내는 중…' : '로그인 링크 받기'}</button>
      <p className="cloud-auth-help">Magic Link를 요청한 기기와 링크를 여는 기기가 다르면 링크를 연 기기에 로그인 세션이 생성됩니다. 동기화할 각 기기에서 로그인 상태를 확인하고, 필요하면 그 기기에서 링크를 다시 요청하세요.</p>
    </form> : null}
    {cloud.user && cloud.lastSuccessfulAt && <p className="cloud-last-success">마지막 성공 {cloud.lastSuccessfulAt.toLocaleString('ko-KR')}</p>}
  </section>
}

function PhraseChoices({ sentence, onChoose }: { sentence: Sentence; onChoose: (value: string) => void }) {
  if (sentence.source !== 'builtIn') return null
  const alternatives = sentence.alternatives ?? []
  const slots = sentence.slots ?? []
  if (alternatives.length === 0 && slots.length === 0) return null
  return <section className="phrase-choices" aria-label="표현 선택"><strong>저장된 표현과 슬롯</strong>{alternatives.length > 0 && <div>{alternatives.map((alternative) => <button type="button" className="choice-chip" key={alternative.english} onClick={() => onChoose(alternative.english)}>{alternative.english}</button>)}</div>}{slots.map((slot) => <div key={slot.key}><span>{slot.key}</span>{slot.values.map((value) => <button type="button" className="choice-chip" key={value.english} onClick={() => onChoose(sentence.english.replace(slot.values[0].english, value.english))}>{value.english} · {value.korean}</button>)}</div>)}</section>
}