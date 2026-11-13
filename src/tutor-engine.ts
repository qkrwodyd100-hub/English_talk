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
        "cafe-dessert",
        "Would you like any dessert with your drink?",
        [["cake"], ["cookie"], ["muffin"], ["pie"], ["bread"], ["yes"], ["no"]],
        "Yes, a cookie, please.",
        "네, 쿠키 주세요.",
        "디저트를 추가하거나 거절하세요. (a cookie / No, thanks)",
      ),
      step(
        "cafe-takeout-check",
        "Just to confirm — is all of this to go?",
        [["to", "go"], ["take", "out"], ["takeout"], ["take", "away"], ["yes"]],
        "Yes, all to go, please.",
        "네, 전부 포장으로 주세요.",
        "포장으로 확인하세요. (to go)",
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
        "taxi-comfort",
        "Sure thing. Would you like the air conditioner or some music?",
        [["air"], ["conditioner"], ["music"], ["radio"], ["window"], ["warmer"], ["cooler"], ["off"], ["on"], ["fine"], ["good"]],
        "Could you turn on the air conditioner?",
        "에어컨 켜 주시겠어요?",
        "에어컨·음악을 요청하세요. (air conditioner / music)",
      ),
      step(
        "taxi-tip",
        "We are here. The meter says 12,000 won.",
        [["keep", "change"], ["tip"], ["card"], ["cash"], ["thank"]],
        "Thank you! Keep the change.",
        "감사합니다! 잔돈은 가지세요.",
        "팁·결제를 말하세요. (Keep the change / by card)",
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
        "hotel-wifi",
        "Your room is on the 5th floor. Do you need anything else?",
        [["wifi"], ["password"], ["internet"], ["checkout"], ["breakfast"]],
        "What is the wifi password?",
        "와이파이 비밀번호가 뭐예요?",
        "와이파이를 물어보세요. (wifi password)",
      ),
      step(
        "hotel-checkout",
        "The password is on your key card. Anything else?",
        [["checkout"], ["check", "out"], ["leave"], ["what", "time"], ["morning"]],
        "What time is checkout?",
        "체크아웃은 몇 시인가요?",
        "체크아웃 시간을 물어보세요. (What time is checkout?)",
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
        "talk-photo",
        "This view is great. Want a photo together?",
        [["yes"], ["sure"], ["great"], ["good", "idea"], ["cheese"], ["photo"], ["picture"], ["no"]],
        "Sure! Let's take a photo.",
        "좋아요! 사진 찍어요.",
        "사진 제안에 답하세요. (Sure! / Good idea)",
      ),
      step(
        "talk-contact",
        "That came out well! Shall we stay in touch?",
        [["number"], ["phone"], ["instagram"], ["kakao"], ["contact"], ["call"], ["text"], ["message"]],
        "Sure! My number is 010-1234-5678.",
        "좋아요! 제 번호예요.",
        "연락처를 교환하세요. (My number is ...)",
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
  {
    "id": "restaurant-table",
    "title": "Get a table at a restaurant",
    "titleKorean": "식당 자리 잡기",
    "mission": "Get a table, order, and pay.",
    "missionKorean": "자리 잡고 주문한 뒤 계산하기",
    "reviewSentenceIds": ["day-86-02", "day-86-10"],
    "steps": [
      step(
        "rest-greet",
        "Hi! Do you have a reservation?",
        [["no"], ["walk", "in"], ["without", "reservation"], ["table"]],
        "No, no reservation. A table for two, please.",
        "아니요, 예약 없어요. 두 명 자리 주세요.",
        "예약 없으면 No부터 말하세요. (No, a table for two, please.)",
      ),
      step(
        "rest-party",
        "Sure. How many people?",
        [["two"], ["three"], ["four"], ["one"], ["five"], ["six"], ["seven"], ["eight"], ["person"], ["people"]],
        "Two, please.",
        "두 명이요.",
        "인원수를 말하세요. (two / three)",
      ),
      step(
        "rest-seat",
        "Where would you like to sit?",
        [["window"], ["outside"], ["inside"], ["quiet"], ["corner"], ["anywhere"]],
        "By the window, please.",
        "창가로 주세요.",
        "창가를 넣어 자리 취향을 말하세요. (By the window)",
      ),
      step(
        "rest-recommend",
        "Here is the menu. Any questions?",
        [["recommend"], ["popular"], ["best"], ["what", "good"]],
        "What do you recommend?",
        "뭐가 맛있나요? 추천해 주세요.",
        "추천을 물어보세요. (recommend)",
      ),
      step(
        "rest-order",
        "Good choice. What would you like to order?",
        [["pasta"], ["pizza"], ["steak"], ["salad"], ["chicken"], ["fish"], ["burger"], ["same"]],
        "I will have the pasta, please.",
        "파스타로 하겠어요.",
        "메인 메뉴를 말하세요. (pasta / steak)",
      ),
      step(
        "rest-drink",
        "Anything to drink with that?",
        [["water"], ["cola"], ["juice"], ["beer"], ["wine"], ["coffee"], ["tea"], ["soda"], ["nothing"], ["no"]],
        "Just water, please.",
        "그냥 물 주세요.",
        "음료를 말하거나 No, thanks라고 하세요.",
      ),
      step(
        "rest-bill",
        "Was everything good? Anything else?",
        [["bill"], ["check"], ["pay"], ["card"], ["cash"], ["all"], ["no"]],
        "It was great. The check, please.",
        "맛있었어요. 계산서 주세요.",
        "계산은 check / bill로 요청하세요.",
      ),
    ],
  },
  {
    "id": "shopping-returns",
    "title": "Exchange at a shop",
    "titleKorean": "매장에서 교환·환불 문의",
    "mission": "Exchange the size and ask about the return policy.",
    "missionKorean": "사이즈를 교환하고 환불 규정을 문의하기",
    "reviewSentenceIds": ["day-89-07", "day-87-09"],
    "steps": [
      step(
        "shop-greet",
        "Hello! Are you looking for anything today?",
        [["looking"], ["just", "looking"], ["need", "help"], ["shirt"], ["pants"], ["jacket"], ["size"], ["browsing"], ["browse"], ["buying"]],
        "I am looking for a shirt.",
        "셔츠를 보고 있어요.",
        "looking을 넣어 목적을 말하세요.",
      ),
      step(
        "shop-try",
        "Sure. What size do you wear?",
        [["medium"], ["small"], ["large"], ["size"]],
        "I wear a medium.",
        "미디엄을 입어요.",
        "사이즈를 말하세요. (small / medium / large)",
      ),
      step(
        "shop-fit",
        "Here you go. How is the fit?",
        [["small"], ["tight"], ["big"], ["loose"], ["short"], ["long"], ["perfect"], ["good"], ["fine"], ["fit"]],
        "It is too small and tight.",
        "너무 작고 꽉 껴요.",
        "맞음새를 말하세요. (too small / just right)",
      ),
      step(
        "shop-exchange",
        "Sorry about that. What can I do for you?",
        [["exchange"], ["change", "size"], ["larger"], ["bigger"], ["one", "size", "up"]],
        "Can I exchange it for a larger size?",
        "더 큰 사이즈로 교환할 수 있나요?",
        "exchange로 교환을 요청하세요.",
      ),
      step(
        "shop-receipt",
        "Of course. Do you have the receipt?",
        [["yes"], ["here"], ["yeah"], ["receipt"], ["got"], ["lost"]],
        "Yes, here is the receipt.",
        "네, 여기 영수증 있어요.",
        "영수증을 건네며 Yes, here라고 하세요.",
      ),
      step(
        "shop-policy",
        "Thanks. Anything else about this item?",
        [["return", "policy"], ["refund", "policy"], ["how", "return"], ["how", "refund"], ["store", "credit"]],
        "Can I ask about your return policy?",
        "반품 규정을 여쭤봐도 될까요?",
        "환불 보장이 아닌 규정 문의로 물어보세요. (return policy)",
      ),
      step(
        "shop-close",
        "You can return it within 30 days with the receipt. Anything else?",
        [["that", "all"], ["no"], ["thank"]],
        "That is all. Thank you!",
        "그게 다예요. 감사합니다!",
        "That is all. Thank you!로 마무리하세요.",
      ),
    ],
  },
  {
    "id": "clinic-visit",
    "title": "Visit a clinic",
    "titleKorean": "병원 방문",
    "mission": "Book a visit, describe symptoms, and set a follow-up.",
    "missionKorean": "진료 예약 후 증상을 말하고 다음 예약 잡기",
    "reviewSentenceIds": ["day-82-02", "day-83-02"],
    "steps": [
      step(
        "clinic-book",
        "Good morning! How can I help you?",
        [["appointment"], ["see", "doctor"], ["checkup"], ["check", "up"], ["book"]],
        "I would like to make an appointment.",
        "진료 예약하고 싶어요.",
        "appointment를 넣어 말하세요.",
      ),
      step(
        "clinic-reason",
        "Sure. What brings you in today?",
        [["cold"], ["cough"], ["fever"], ["headache"], ["stomach"], ["throat"], ["sick"], ["hurt"], ["pain"]],
        "I have a bad cough.",
        "기침이 심해요.",
        "증상을 한 단어로 말하세요. (cough / fever)",
      ),
      step(
        "clinic-since",
        "I see. How long have you had it?",
        [["two", "days"], ["three", "days"], ["week"], ["yesterday"], ["morning"], ["days"], ["since"]],
        "For three days, since Monday.",
        "월요일부터 3일째예요.",
        "언제부터인지 말하세요. (three days / since Monday)",
      ),
      step(
        "clinic-feel",
        "Anything else — fever or pain?",
        [["fever"], ["headache"], ["no"], ["sore", "throat"], ["tired"]],
        "A little fever and a headache.",
        "미열과 두통이 있어요.",
        "다른 증상을 덧붙이세요. (fever / headache)",
      ),
      step(
        "clinic-time",
        "Okay. When would you like to come in?",
        [["today"], ["tomorrow"], ["morning"], ["afternoon"], ["monday"], ["friday"], ["asap"], ["as", "soon", "as", "possible"]],
        "Tomorrow morning, please.",
        "내일 오전으로 해 주세요.",
        "원하는 시간을 말하세요. (tomorrow morning)",
      ),
      step(
        "clinic-followup",
        "Booked for tomorrow. Shall we set a follow-up too?",
        [["yes"], ["follow", "up"], ["next", "week"], ["sure"], ["please"]],
        "Yes, next week please.",
        "네, 다음 주에 한 번 더 잡아 주세요.",
        "next week으로 다음 예약을 잡으세요.",
      ),
      step(
        "clinic-close",
        "All set! Anything else before we finish?",
        [["that", "all"], ["no"], ["thank"]],
        "That is all. Thank you!",
        "그게 다예요. 감사합니다!",
        "감사 인사로 마무리하세요.",
      ),
    ],
  },
  {
    "id": "phone-plan",
    "title": "Call and call back",
    "titleKorean": "전화 걸고 다시 걸기",
    "mission": "Call someone, leave a message, and plan a callback.",
    "missionKorean": "전화해서 부재중 메시지를 남기고 다시 걸 약속 잡기",
    "reviewSentenceIds": ["day-78-04", "day-78-10"],
    "steps": [
      step(
        "phone-call",
        "Hello?",
        [["hello"], ["hi"], ["hey"], ["morning"], ["afternoon"]],
        "Hello! Is Mina there?",
        "안녕하세요! 미나 씨 계신가요?",
        "인사 후 찾는 사람을 말하세요. (Is Mina there?)",
      ),
      step(
        "phone-ask",
        "Sorry, who is calling?",
        [["my", "name"], ["this", "is"], ["i", "am"]],
        "This is Jiyeon.",
        "저는 지연입니다.",
        "This is ...로 이름을 밝히세요.",
      ),
      step(
        "phone-absent",
        "Mina stepped out. Can I take a message?",
        [["yes"], ["message"], ["please", "tell"], ["sure"]],
        "Yes, please take a message.",
        "네, 메시지 남길게요.",
        "message를 넣어 메시지를 남기겠다고 하세요.",
      ),
      step(
        "phone-number",
        "Sure. What is your number?",
        [["number"], ["my", "number"], ["call", "me"], ["phone"]],
        "My number is 010-1234-5678.",
        "제 번호는 010-1234-5678이에요.",
        "전화번호를 말하세요. (My number is ...)",
      ),
      step(
        "phone-callback",
        "Got it. When should she call back?",
        [["tonight"], ["tomorrow"], ["evening"], ["morning"], ["later"], ["after"]],
        "Please call me back tonight.",
        "오늘 밤에 다시 걸어 달라고 전해주세요.",
        "다시 걸 시간을 말하세요. (tonight / tomorrow)",
      ),
      step(
        "phone-confirm",
        "Tonight. Anything else?",
        [["repeat"], ["correct"], ["right"], ["yes"], ["thank"]],
        "Yes, that is correct. Thank you!",
        "네, 맞아요. 감사합니다!",
        "correct로 확인하고 감사하세요.",
      ),
      step(
        "phone-close",
        "I will tell her. Goodbye!",
        [["bye"], ["goodbye"], ["see", "you"], ["thank"], ["later"]],
        "Goodbye! Talk to you later!",
        "안녕히 계세요! 나중에 얘기해요!",
        "Goodbye로 마무리하세요.",
      ),
    ],
  }
]

/** Phase-3 seam: an LLM backend implements this instead of the script. */
export class ScriptedTutorBackend implements TutorBackend {
  respond(_history: TutorTurn[], learnerText: string): string {
    return learnerText
  }
}
