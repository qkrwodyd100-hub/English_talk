export type Goal = 'travel' | 'work' | 'daily'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type ScenarioId = 'cafe' | 'meeting' | 'directions'
export type Speaker = 'learner' | 'coach'

export interface Message {
  id: string
  speaker: Speaker
  text: string
  timestamp: string
}

export interface Session {
  id: string
  goal: Goal
  difficulty: Difficulty
  scenario: ScenarioId
  startedAt: string
  endedAt?: string
  messages: Message[]
  summary?: SessionSummary
}

export interface SessionSummary {
  turnCount: number
  expressions: string[]
  nextAction: string
}

export const STORAGE_VERSION = 1

export const scenarios: Record<ScenarioId, { title: string; description: string; mission: string; expressions: string[]; coachReplies: string[] }> = {
  cafe: {
    title: 'Order at a café',
    description: 'Order a drink and finish politely.',
    mission: 'Order a drink to take away, then close the conversation.',
    expressions: ['I would like', 'To go, please', 'That is all, thank you'],
    coachReplies: ['Hello! What can I get for you today?', 'Sure. Anything else?', 'Great choice. Your drink will be ready soon.'],
  },
  meeting: {
    title: 'Join a work meeting',
    description: 'Introduce yourself and share a short update.',
    mission: 'Say hello and give one clear update about your work.',
    expressions: ['Nice to meet you', 'I am working on', 'Could you repeat that?'],
    coachReplies: ['Hi! Please introduce yourself to the team.', 'Thanks for the update. What is your next step?', 'Sounds good. Let us continue.'],
  },
  directions: {
    title: 'Ask for directions',
    description: 'Find a nearby place with a polite question.',
    mission: 'Ask how to get to the station and confirm the direction.',
    expressions: ['Excuse me', 'How can I get to', 'Is it far from here?'],
    coachReplies: ['Of course. Where would you like to go?', 'Go straight for one block and turn left.', 'You are welcome. Have a nice day!'],
  },
}

export function createSession(input: Pick<Session, 'goal' | 'difficulty' | 'scenario'>): Session {
  return {
    id: crypto.randomUUID(),
    ...input,
    startedAt: new Date().toISOString(),
    messages: [],
  }
}

export function advanceScenario(session: Session, text: string): { session: Session; canComplete: boolean } {
  const learnerTurns = session.messages.filter((message) => message.speaker === 'learner').length
  const reply = scenarios[session.scenario].coachReplies[Math.min(learnerTurns, scenarios[session.scenario].coachReplies.length - 1)]
  const timestamp = new Date().toISOString()
  const messages: Message[] = [
    ...session.messages,
    { id: crypto.randomUUID(), speaker: 'learner', text: text.trim(), timestamp },
    { id: crypto.randomUUID(), speaker: 'coach', text: reply, timestamp: new Date().toISOString() },
  ]
  const nextSession = { ...session, messages }
  return { session: nextSession, canComplete: messages.filter((message) => message.speaker === 'learner').length >= 2 }
}

export function makeSummary(session: Session): SessionSummary {
  return {
    turnCount: session.messages.filter((message) => message.speaker === 'learner').length,
    expressions: scenarios[session.scenario].expressions,
    nextAction: 'Try the same scenario tomorrow and use one expression without looking.',
  }
}

export function completeSession(session: Session): Session {
  return { ...session, endedAt: new Date().toISOString(), summary: makeSummary(session) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isMessage(value: unknown): value is Message {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.speaker === 'learner' || value.speaker === 'coach')
    && typeof value.text === 'string'
    && isDateString(value.timestamp)
}

function isSessionSummary(value: unknown): value is SessionSummary {
  return isRecord(value)
    && Number.isInteger(value.turnCount)
    && (value.turnCount as number) >= 0
    && Array.isArray(value.expressions)
    && value.expressions.every((expression) => typeof expression === 'string')
    && typeof value.nextAction === 'string'
}

function isStoredSession(value: unknown): value is Session {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.goal === 'travel' || value.goal === 'work' || value.goal === 'daily')
    && (value.difficulty === 'beginner' || value.difficulty === 'intermediate' || value.difficulty === 'advanced')
    && typeof value.scenario === 'string'
    && Object.hasOwn(scenarios, value.scenario)
    && isDateString(value.startedAt)
    && (value.endedAt === undefined || isDateString(value.endedAt))
    && Array.isArray(value.messages)
    && value.messages.every(isMessage)
    && (value.summary === undefined || isSessionSummary(value.summary))
}

export function parseStoredSessions(raw: string | null): Session[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return []
    const stored = value as { version?: unknown; sessions?: unknown }
    return stored.version === STORAGE_VERSION && Array.isArray(stored.sessions) ? stored.sessions.filter(isStoredSession) : []
  } catch {
    return []
  }
}
