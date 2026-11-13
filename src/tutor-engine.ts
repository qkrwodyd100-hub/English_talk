import { getContractionEquivalentForms, normalizeAnswer } from './learning'

/**
 * Scripted conversation tutor (phase 2).
 *
 * The coach follows a scenario script but branches on keywords in the
 * learner's utterance, so it feels like a phone-English call instead of a
 * fixed quiz. Free-form AI (phase 3) plugs in through the TutorBackend
 * interface without touching scenario data or the UI.
 */

export interface TutorStep {
  id: string
  /** What the coach says when this step starts. */
  coachOpener: string
  /** Learner passes the step when ANY group is fully present (whole words). */
  acceptGroups: string[][]
  /** Model expression shown as a hint / after two misses. */
  modelAnswer: string
  modelKorean: string
  /** Short Korean hint shown when the learner asks for help. */
  hint: string
  praise: string[]
  repair: string[]
}

export interface TutorScenario {
  id: string
  title: string
  titleKorean: string
  mission: string
  missionKorean: string
  /** IDs in builtInSentences worth reviewing before/after this scenario. */
  reviewSentenceIds: string[]
  steps: TutorStep[]
}

export interface TutorTurn {
  speaker: 'coach' | 'learner'
  text: string
}

export interface TutorSession {
  scenarioId: string
  stepIndex: number
  attemptsAtStep: number
  assistedSteps: string[]
  turns: TutorTurn[]
  done: boolean
}

export interface TutorBackend {
  respond(history: TutorTurn[], learnerText: string): Promise<string> | string
}

function groupMatches(words: Set<string>, forms: string[], group: string[]): boolean {
  return group.every((keyword) => {
    const normalized = normalizeAnswer(keyword)
    // Multi-word keywords match as phrases; single words match whole tokens.
    if (normalized.includes(' ')) return forms.some((form) => form.includes(normalized))
    return words.has(normalized)
  })
}

/** Returns the first matching keyword group, or null. */
export function matchAcceptGroup(step: TutorStep, transcript: string): string[] | null {
  const forms = [...getContractionEquivalentForms(transcript)]
  const words = new Set<string>()
  for (const form of forms) {
    for (const word of normalizeAnswer(form).split(' ')) {
      if (word) words.add(word)
    }
  }
  return step.acceptGroups.find((group) => groupMatches(words, forms, group)) ?? null
}

export function createTutorSession(scenario: TutorScenario): TutorSession {
  return {
    scenarioId: scenario.id,
    stepIndex: 0,
    attemptsAtStep: 0,
    assistedSteps: [],
    turns: [{ speaker: 'coach', text: scenario.steps[0].coachOpener }],
    done: false,
  }
}

export interface AdvanceResult {
  session: TutorSession
  matched: boolean
  coachReply: string
  /** True when the coach revealed the model answer after repeated misses. */
  assisted: boolean
}

export function advanceTutorSession(
  scenario: TutorScenario,
  session: TutorSession,
  transcript: string,
): AdvanceResult {
  if (session.done) return { session, matched: false, coachReply: '', assisted: false }
  const step = scenario.steps[session.stepIndex]
  const trimmed = transcript.trim()
  if (!trimmed) {
    return {
      session,
      matched: false,
      coachReply: "I didn't catch that. Could you say it once more?",
      assisted: false,
    }
  }
  const turns: TutorTurn[] = [...session.turns, { speaker: 'learner', text: trimmed }]
  if (matchAcceptGroup(step, trimmed)) {
    const stepIndex = session.stepIndex + 1
    const done = stepIndex >= scenario.steps.length
    const coachReply = done
      ? `Nice work! ${pick(step.praise)} You finished: ${scenario.mission}`
      : `${pick(step.praise)} ${scenario.steps[stepIndex].coachOpener}`
    return {
      session: { ...session, stepIndex, attemptsAtStep: 0, turns: [...turns, { speaker: 'coach', text: coachReply }], done },
      matched: true,
      coachReply,
      assisted: false,
    }
  }
  const attemptsAtStep = session.attemptsAtStep + 1
  // After two misses, show the model answer and move on instead of blocking.
  if (attemptsAtStep >= 2) {
    const stepIndex = session.stepIndex + 1
    const done = stepIndex >= scenario.steps.length
    const coachReply = done
      ? `Good try! You can say: "${step.modelAnswer}" You finished: ${scenario.mission}`
      : `Good try! You can say: "${step.modelAnswer}" ${scenario.steps[stepIndex].coachOpener}`
    return {
      session: {
        ...session,
        stepIndex,
        attemptsAtStep: 0,
        assistedSteps: [...session.assistedSteps, step.id],
        turns: [...turns, { speaker: 'coach', text: coachReply }],
        done,
      },
      matched: false,
      coachReply,
      assisted: true,
    }
  }
  const coachReply = pick(step.repair)
  return {
    session: { ...session, attemptsAtStep, turns: [...turns, { speaker: 'coach', text: coachReply }] },
    matched: false,
    coachReply,
    assisted: false,
  }
}

function pick(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)]
}

export function tutorSummary(scenario: TutorScenario, session: TutorSession): { covered: string[]; assisted: string[] } {
  return {
    covered: scenario.steps.map((step) => step.modelAnswer),
    assisted: session.assistedSteps,
  }
}

const PRAISE = ['Great!', 'Well done!', 'Sounds good!', 'Nice!']
const REPAIR = [
  'Almost! Try once more — short is fine.',
  'Good effort! Say it once more, slowly.',
  'Not quite. Give it one more try!',
]

function step(
  id: string,
  coachOpener: string,
  acceptGroups: string[][],
  modelAnswer: string,
  modelKorean: string,
  hint: string,
): TutorStep {
  return { id, coachOpener, acceptGroups, modelAnswer, modelKorean, hint, praise: PRAISE, repair: REPAIR }
}

export const tutorScenarios: TutorScenario[] = [
  {
    id: 'cafe-order',
    title: 'Order at a café',
    titleKorean: '카페 주문',
    mission: 'Order a drink to go and close politely.',
    missionKorean: '음료를 포장 주문하고 정중하게 마무리하기',
    reviewSentenceIds: ['day-01-01', 'day-01-07', 'day-01-08'],
    steps: [
      step(
        'cafe-greet',
        'Hello! What can I get for you today?',
        [['hello'], ['hi'], ['morning'], ['afternoon'], ['hey']],
        'Hello! An iced americano, please.',
        '안녕하세요! 아이스 아메리카노 주세요.',
        '먼저 인사부터 하세요. (Hello / Hi)',
      ),
      step(
        'cafe-order',
        'Sure! Which drink would you like?',
        [['americano'], ['latte'], ['coffee'], ['tea'], ['juice'], ['ade']],
        'An iced americano, please.',
        '아이스 아메리카노 주세요.',
        '음료 이름을 말하세요. (americano / latte / tea)',
      ),
      step(
        'cafe-size',
        'Got it. What size would you like?',
        [['small'], ['regular'], ['medium'], ['large'], ['tall'], ['grande']],
        'A medium, please.',
        '미디엄으로 주세요.',
        '사이즈를 말하세요. (small / medium / large)',
      ),
      step(
        'cafe-togo',
        'For here or to go?',
        [['to', 'go'], ['take', 'away'], ['takeout'], ['take', 'out']],
        'To go, please.',
        '포장해 주세요.',
        '포장 주문은 "To go, please."라고 하세요.',
      ),
      step(
        'cafe-close',
        'Anything else? Your drink will be ready soon.',
        [['that', 'all'], ['no'], ['nothing', 'else'], ['thank']],
        'That is all. Thank you!',
        '그게 다예요. 감사합니다!',
        '마무리는 "That is all. Thank you!"라고 하세요.',
      ),
    ],
  },
  {
    id: 'taxi-destination',
    title: 'Take a taxi',
    titleKorean: '택시 타기',
    mission: 'Give your destination and confirm the route.',
    missionKorean: '목적지를 말하고 경로 확인하기',
    reviewSentenceIds: ['day-01-01', 'day-01-04', 'day-05-01'],
    steps: [
      step(
        'taxi-greet',
        'Hello! Where would you like to go?',
        [['hello'], ['hi'], ['station'], ['hotel'], ['airport'], ['go']],
        'Hello! To the station, please.',
        '안녕하세요! 역으로 가 주세요.',
        '인사 + 목적지를 말하세요. (To the station, please.)',
      ),
      step(
        'taxi-destination',
        'Sure. Which station — the main station?',
        [['main'], ['central'], ['seoul'], ['yes'], ['right'], ['yeah'], ['correct']],
        'Yes, the main station.',
        '네, 중앙역이요.',
        '맞으면 "Yes"부터 말하세요.',
      ),
      step(
        'taxi-time',
        'Okay. How urgent is it — are you in a hurry?',
        [['hurry'], ['late'], ['fast'], ['quick'], ['rush'], ['no', 'rush'], ['fine'], ['okay']],
        "I'm a little late. Please hurry.",
        '조금 늦었어요. 빨리 가 주세요.',
        '급하면 "hurry", 괜찮으면 "no rush"라고 하세요.',
      ),
      step(
        'taxi-stop',
        'We are almost there. Where should I stop?',
        [['here'], ['entrance'], ['front'], ['corner'], ['stop']],
        'Please stop at the main entrance.',
        '정문 앞에 세워 주세요.',
        '"stop"을 넣어 세울 곳을 말하세요.',
      ),
      step(
        'taxi-close',
        'Here we are! That will be 12,000 won.',
        [['thank'], ['card'], ['cash'], ['keep', 'change']],
        'Thank you! Can I pay by card?',
        '감사합니다! 카드로 계산할 수 있나요?',
        '감사 인사 + 결제 수단을 말하세요. (Thank you / by card)',
      ),
    ],
  },
  {
    id: 'hotel-checkin',
    title: 'Check in at a hotel',
    titleKorean: '호텔 체크인',
    mission: 'Check in with your reservation and ask about breakfast.',
    missionKorean: '예약 확인 후 체크인하고 조식 문의하기',
    reviewSentenceIds: ['day-01-01', 'day-01-03'],
    steps: [
      step(
        'hotel-greet',
        'Good evening! Welcome. How can I help you?',
        [['hello'], ['hi'], ['evening'], ['check', 'in'], ['reservation']],
        'Hello! I have a reservation.',
        '안녕하세요! 예약했어요.',
        '"reservation(예약)" 단어를 넣어 보세요.',
      ),
      step(
        'hotel-name',
        'Certainly. May I have your name, please?',
        [['my', 'name'], ['i am', 'im'], ['this', 'is']],
        'My name is Jaeyong Park.',
        '제 이름은 박재용입니다.',
        '"My name is ..."로 이름을 말하세요.',
      ),
      step(
        'hotel-nights',
        'Thank you. How many nights will you stay?',
        [['one', 'night'], ['two', 'nights'], ['three', 'nights'], ['night'], ['nights'], ['week']],
        'Two nights, please.',
        '2박이요.',
        '몇 박인지 숫자를 넣으세요. (two nights)',
      ),
      step(
        'hotel-breakfast',
        'All set. Is there anything else I can do for you?',
        [['breakfast'], ['wifi'], ['pool'], ['checkout'], ['check', 'out']],
        'What time is breakfast?',
        '조식은 몇 시인가요?',
        '궁금한 시설을 물어보세요. (breakfast / wifi)',
      ),
      step(
        'hotel-close',
        'Breakfast is from 7 to 10. Enjoy your stay!',
        [['thank'], ['great'], ['perfect']],
        'Thank you for your help!',
        '도와주셔서 감사합니다!',
        '감사 인사로 마무리하세요.',
      ),
    ],
  },
  {
    id: 'small-talk',
    title: 'Make small talk',
    titleKorean: '스몰토크',
    mission: 'Greet, chat a little, and close warmly.',
    missionKorean: '인사하고 짧게 대화한 뒤 따뜻하게 마무리하기',
    reviewSentenceIds: ['day-01-05', 'day-01-06', 'day-01-07'],
    steps: [
      step(
        'talk-greet',
        'Hi! How is it going?',
        [['hello'], ['hi'], ['hey'], ['morning'], ['good']],
        'Hi! I am good. How are you?',
        '안녕하세요! 저는 잘 지내요. 당신은요?',
        '가볍게 인사로 답하세요. (Hi!)',
      ),
      step(
        'talk-weekend',
        'Good! Did you do anything special this weekend?',
        [['yes'], ['yeah'], ['went'], ['golf'], ['rested'], ['rest'], ['trip'], ['no'], ['nothing', 'much']],
        'I played golf on Saturday.',
        '토요일에 골프 쳤어요.',
        '주말 일을 한 문장으로 말하세요. (I played ...)',
      ),
      step(
        'talk-react',
        'That sounds fun! Was the weather nice?',
        [['yes'], ['yeah'], ['sunny'], ['nice'], ['great'], ['no'], ['rainy'], ['cloudy'], ['cold'], ['hot']],
        'Yes, it was sunny and nice.',
        '네, 맑고 좋았어요.',
        '날씨를 답하세요. (sunny / nice / rainy)',
      ),
      step(
        'talk-plan',
        'Lovely. What are your plans for next weekend?',
        [['golf'], ['rest'], ['trip'], ['family'], ['work'], ['study'], ['english'], ['nothing']],
        'I will rest with my family.',
        '가족과 쉴 거예요.',
        '"I will ..."로 계획을 말하세요.',
      ),
      step(
        'talk-close',
        'Sounds good! I have to run, but it was nice talking to you.',
        [['bye'], ['see', 'you'], ['nice', 'talking'], ['thank'], ['later']],
        'Nice talking to you. See you soon!',
        '이야기 즐거웠어요. 곧 봐요!',
        '"See you"로 마무리하세요.',
      ),
    ],
  },
]

/** Phase-3 seam: an LLM backend implements this instead of the script. */
export class ScriptedTutorBackend implements TutorBackend {
  respond(_history: TutorTurn[], learnerText: string): string {
    return learnerText
  }
}
