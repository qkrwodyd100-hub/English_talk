import { useEffect, useMemo, useRef, useState } from 'react'
import { getBrowserSelectedSessionApi, createLocalFirstSessionGateway } from './session-gateway'
import { advanceScenario, completeSession, createSession, parseStoredSessions, scenarios, STORAGE_VERSION, type Difficulty, type Goal, type ScenarioId, type Session } from './session'

type Screen = 'home' | 'prepare' | 'practice' | 'result' | 'history'
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

const STORAGE_KEY = 'english-talk.sessions'

function hasSpeechRecognition() {
  const browser = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function toContractDraft(session: Session) {
  return {
    scenarioId: session.scenario,
    title: scenarios[session.scenario].title,
    turns: session.messages.map(({ speaker, text, timestamp }) => ({ speaker, text, occurredAt: timestamp })),
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [goal, setGoal] = useState<Goal>('travel')
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [scenario, setScenario] = useState<ScenarioId>('cafe')
  const [session, setSession] = useState<Session | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [storageStatus, setStorageStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speechAvailable = useMemo(() => Boolean(hasSpeechRecognition()), [])
  const sessionGateway = useMemo(() => createLocalFirstSessionGateway(getBrowserSelectedSessionApi()), [])
  const activeScenario = scenarios[scenario]

  useEffect(() => {
    try {
      setSessions(parseStoredSessions(window.localStorage.getItem(STORAGE_KEY)))
      setStorageStatus('ready')
    } catch {
      setStorageStatus('error')
      setNotice('Practice history cannot be read in this browser. You can still practice, but it may not be saved.')
    }
  }, [])

  function persist(nextSessions: Session[]) {
    setSessions(nextSessions)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, sessions: nextSessions }))
      setStorageStatus('ready')
    } catch {
      setStorageStatus('error')
      setNotice('This session is complete, but your browser could not save the history.')
    }
  }

  function startPractice() {
    setSession(createSession({ goal, difficulty, scenario }))
    setDraft('')
    setNotice('')
    setScreen('practice')
  }

  function sendMessage() {
    if (!session) return
    if (!draft.trim()) {
      setNotice('Write a short English reply before sending.')
      return
    }
    const progressed = advanceScenario(session, draft)
    setSession(progressed.session)
    setDraft('')
    setNotice(progressed.canComplete ? 'Nice work — you can finish now or take one more turn.' : 'Keep going: complete at least two learner turns.')
  }

  function finishPractice() {
    if (!session) return
    const learnerTurns = session.messages.filter((message) => message.speaker === 'learner').length
    if (learnerTurns < 2) {
      setNotice('Complete two learner turns before finishing this practice.')
      return
    }
    const completed = completeSession(session)
    setSession(completed)
    persist([completed, ...sessions])
    setScreen('result')
    void sessionGateway.submit(toContractDraft(completed)).then((result) => {
      if (result.mode === 'local-fallback') setNotice(result.guidance)
    })
  }

  function toggleListening() {
    if (!speechAvailable) {
      setNotice('Voice dictation is not available here. Use the text box instead.')
      return
    }
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }
    const Recognition = hasSpeechRecognition()
    if (!Recognition) return
    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => setDraft((current) => `${current}${current ? ' ' : ''}${event.results[0][0].transcript}`)
    recognition.onerror = (event) => {
      setIsListening(false)
      setNotice(event.error === 'not-allowed' ? 'Microphone permission was denied. Use the text box instead.' : 'Voice dictation stopped. Use the text box or try again.')
    }
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
      setNotice('Listening… speak now. Nothing is sent anywhere.')
    } catch {
      setNotice('Voice dictation could not start. Use the text box instead.')
    }
  }

  function speak(text: string) {
    if (!('speechSynthesis' in window)) {
      setNotice('Read-aloud is not available in this browser.')
      return
    }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
  }

  if (screen === 'prepare') {
    return <main className="shell"><Header onHistory={() => setScreen('history')} /><section className="panel"><p className="eyebrow">Today’s mission</p><h1>{activeScenario.title}</h1><p>{activeScenario.mission}</p><div className="expression-list">{activeScenario.expressions.map((expression) => <span key={expression}>{expression}</span>)}</div><p className="hint">Use text first. The coach uses a scripted response, so you can practice without an account or AI key.</p><div className="actions"><button className="button secondary" onClick={() => setScreen('home')}>Back</button><button className="button" onClick={startPractice}>Start practice</button></div></section></main>
  }

  if (screen === 'practice' && session) {
    const learnerTurns = session.messages.filter((message) => message.speaker === 'learner').length
    return <main className="shell"><Header onHistory={() => setScreen('history')} /><section className="panel practice"><div className="practice-heading"><div><p className="eyebrow">{activeScenario.title}</p><h1>Speak your turn</h1></div><span className="turn-pill">{learnerTurns} / 2 turns</span></div><div className="transcript" aria-live="polite">{session.messages.length === 0 ? <div className="coach-message"><strong>Coach</strong><p>{activeScenario.coachReplies[0]}</p><button className="text-button" onClick={() => speak(activeScenario.coachReplies[0])}>Read aloud</button></div> : session.messages.map((message) => <div key={message.id} className={`message ${message.speaker}`}><strong>{message.speaker === 'learner' ? 'You' : 'Coach'}</strong><p>{message.text}</p>{message.speaker === 'coach' && <button className="text-button" onClick={() => speak(message.text)}>Read aloud</button>}</div>)}</div><label htmlFor="reply">Your English reply</label><textarea id="reply" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="For example: I would like a tea, please." rows={3} /><div className="actions"><button className="button secondary" onClick={toggleListening} aria-pressed={isListening}>{isListening ? 'Stop listening' : 'Use voice dictation'}</button><button className="button" onClick={sendMessage}>Send reply</button></div><p className="hint">{speechAvailable ? 'Voice is optional and starts only when you press the button.' : 'Voice dictation is unavailable in this browser; text input is ready.'}</p>{notice && <p className="notice" role="status">{notice}</p>}<button className="button finish" onClick={finishPractice}>Finish session</button></section></main>
  }

  if (screen === 'result' && session?.summary) {
    return <main className="shell"><Header onHistory={() => setScreen('history')} /><section className="panel"><p className="eyebrow">Session complete</p><h1>You finished {session.summary.turnCount} turns.</h1><h2>Expressions to reuse</h2><div className="expression-list">{session.summary.expressions.map((expression) => <span key={expression}>{expression}</span>)}</div><h2>Next action</h2><p>{session.summary.nextAction}</p>{storageStatus === 'error' && <p className="notice" role="status">History could not be saved.</p>}{storageStatus !== 'error' && notice && <p className="notice" role="status">{notice}</p>}<div className="actions"><button className="button secondary" onClick={() => setScreen('history')}>View history</button><button className="button" onClick={() => setScreen('home')}>Practice another scenario</button></div></section></main>
  }

  if (screen === 'history') {
    return <main className="shell"><Header onHistory={() => setScreen('history')} /><section className="panel"><p className="eyebrow">Local practice history</p><h1>Your sessions</h1>{storageStatus === 'loading' ? <p role="status">Loading local history…</p> : storageStatus === 'error' ? <p className="notice" role="status">History is unavailable in this browser.</p> : sessions.length === 0 ? <p>No saved sessions yet. Complete a two-turn practice to see it here.</p> : <ul className="history-list">{sessions.map((item) => <li key={item.id}><strong>{scenarios[item.scenario].title}</strong><span>{item.summary?.turnCount ?? 0} turns · {item.endedAt ? formatDate(item.endedAt) : 'in progress'}</span></li>)}</ul>}<div className="actions"><button className="button" onClick={() => setScreen('home')}>Start a practice</button></div></section></main>
  }

  return <main className="shell"><Header onHistory={() => setScreen('history')} /><section className="hero"><p className="eyebrow">English Talk</p><h1>Practice one useful conversation at a time.</h1><p className="lead">A private, scripted practice space. No sign-in, AI key, or automatic recording.</p></section><section className="panel choices"><fieldset><legend>What do you want to practice?</legend><OptionGroup value={goal} onChange={setGoal} options={[['travel', 'Travel'], ['work', 'Work'], ['daily', 'Daily life']]} /></fieldset><fieldset><legend>Choose your level</legend><OptionGroup value={difficulty} onChange={setDifficulty} options={[['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]} /></fieldset><fieldset><legend>Pick a situation</legend><OptionGroup value={scenario} onChange={setScenario} options={(Object.entries(scenarios) as [ScenarioId, typeof scenarios[ScenarioId]][]).map(([id, details]) => [id, details.title])} /></fieldset>{notice && <p className="notice" role="status">{notice}</p>}<button className="button" onClick={() => setScreen('prepare')}>See today’s mission</button></section></main>
}

function Header({ onHistory }: { onHistory: () => void }) {
  return <header><button className="wordmark" onClick={() => window.location.reload()} aria-label="Return to English Talk home">English Talk</button><button className="text-button" onClick={onHistory}>History</button></header>
}

function OptionGroup<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: [T, string][] }) {
  return <div className="option-group">{options.map(([id, label]) => <label className={value === id ? 'selected' : ''} key={id}><input type="radio" name={label.includes(' ') ? 'scenario' : label === 'Beginner' ? 'difficulty' : 'goal'} value={id} checked={value === id} onChange={() => onChange(id)} />{label}</label>)}</div>
}
