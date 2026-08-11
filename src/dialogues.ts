import type { MiniDialogue } from './learning'

export const builtInDialogues: MiniDialogue[] = [
  {
    "day": 1,
    "topic": "survival-communication",
    "turns": [
      {
        "role": "traveler",
        "english": "Excuse me, do you speak English?",
        "korean": "실례합니다, 영어 하세요?"
      },
      {
        "role": "local",
        "english": "A little. How can I help you?",
        "korean": "조금요. 어떻게 도와드릴까요?"
      },
      {
        "role": "traveler",
        "english": "Please speak slowly.",
        "korean": "천천히 말해 주세요."
      }
    ]
  },
  {
    "day": 2,
    "topic": "restaurant-basics",
    "turns": [
      {
        "role": "traveler",
        "english": "A table for one, please.",
        "korean": "한 명 자리 부탁해요."
      },
      {
        "role": "staff",
        "english": "Of course. Here is the menu.",
        "korean": "네. 여기 메뉴판입니다."
      },
      {
        "role": "traveler",
        "english": "What do you recommend?",
        "korean": "뭘 추천하시나요?"
      }
    ]
  },
  {
    "day": 3,
    "topic": "immigration-and-customs",
    "turns": [
      {
        "role": "staff",
        "english": "What is the purpose of your visit?",
        "korean": "방문 목적이 무엇인가요?"
      },
      {
        "role": "traveler",
        "english": "I'm here on vacation.",
        "korean": "휴가차 왔습니다."
      },
      {
        "role": "staff",
        "english": "How long will you stay?",
        "korean": "얼마나 머무르실 건가요?"
      },
      {
        "role": "traveler",
        "english": "I'll be staying for five days.",
        "korean": "5일 동안 머물 예정입니다."
      }
    ]
  },
  {
    "day": 4,
    "topic": "airport-services",
    "turns": [
      {
        "role": "traveler",
        "english": "Where can I pick up my baggage?",
        "korean": "제 짐을 어디서 찾을 수 있나요?"
      },
      {
        "role": "staff",
        "english": "Baggage claim is downstairs.",
        "korean": "수하물 찾는 곳은 아래층에 있습니다."
      },
      {
        "role": "traveler",
        "english": "Thank you. Is there a free shuttle to the city center?",
        "korean": "감사합니다. 시내로 가는 무료 셔틀이 있나요?"
      }
    ]
  },
  {
    "day": 5,
    "topic": "taxis-and-rides",
    "turns": [
      {
        "role": "traveler",
        "english": "Can you take me to this address?",
        "korean": "이 주소로 데려다 주시겠어요?"
      },
      {
        "role": "staff",
        "english": "Sure. It should take about twenty minutes.",
        "korean": "네. 20분 정도 걸릴 거예요."
      },
      {
        "role": "traveler",
        "english": "Great. Please stop at the main entrance.",
        "korean": "좋아요. 정문 앞에 세워 주세요."
      }
    ]
  },
  {
    "day": 6,
    "topic": "asking-for-directions",
    "turns": [
      {
        "role": "traveler",
        "english": "How can I get to the museum?",
        "korean": "박물관에 어떻게 갈 수 있나요?"
      },
      {
        "role": "local",
        "english": "Go straight for two blocks, then turn left.",
        "korean": "두 블록 직진한 다음 왼쪽으로 도세요."
      },
      {
        "role": "traveler",
        "english": "Could you mark it on the map?",
        "korean": "지도에 표시해 주시겠어요?"
      }
    ]
  },
  {
    "day": 7,
    "topic": "public-transportation",
    "turns": [
      {
        "role": "traveler",
        "english": "Does this train go to Central Station?",
        "korean": "이 기차가 중앙역에 가나요?"
      },
      {
        "role": "staff",
        "english": "Yes, but you need to transfer to the red line.",
        "korean": "네, 하지만 빨간색 노선으로 갈아타셔야 해요."
      },
      {
        "role": "traveler",
        "english": "Where do I validate my ticket?",
        "korean": "표는 어디에서 개찰하면 되나요?"
      }
    ]
  },
  {
    "day": 8,
    "topic": "hotel-check-in",
    "turns": [
      {
        "role": "traveler",
        "english": "I have a reservation under the name Alex Kim.",
        "korean": "알렉스 김 이름으로 예약했어요."
      },
      {
        "role": "staff",
        "english": "I found it. Breakfast is included.",
        "korean": "예약을 확인했습니다. 아침 식사가 포함되어 있습니다."
      },
      {
        "role": "traveler",
        "english": "Could I have an extra key card?",
        "korean": "여분의 키 카드를 받을 수 있을까요?"
      }
    ]
  },
  {
    "day": 9,
    "topic": "hotel-room-problems",
    "turns": [
      {
        "role": "traveler",
        "english": "There's no hot water in my room.",
        "korean": "제 방에 뜨거운 물이 안 나와요."
      },
      {
        "role": "staff",
        "english": "I'm sorry. I'll send someone to fix it.",
        "korean": "죄송합니다. 수리할 사람을 보내 드리겠습니다."
      },
      {
        "role": "traveler",
        "english": "Thank you. I also need two more towels.",
        "korean": "감사합니다. 수건도 두 장 더 필요해요."
      }
    ]
  },
  {
    "day": 10,
    "topic": "hotel-services",
    "turns": [
      {
        "role": "traveler",
        "english": "Could you call a taxi for me?",
        "korean": "택시를 한 대 불러 주시겠어요?"
      },
      {
        "role": "staff",
        "english": "Certainly. What time do you need it?",
        "korean": "물론입니다. 몇 시에 필요하세요?"
      },
      {
        "role": "traveler",
        "english": "At eight, please.",
        "korean": "8시로 부탁드려요."
      }
    ]
  },
  {
    "day": 11,
    "topic": "hotel-check-out",
    "turns": [
      {
        "role": "traveler",
        "english": "I'd like to check out now.",
        "korean": "지금 체크아웃하고 싶어요."
      },
      {
        "role": "staff",
        "english": "Of course. Here is your bill.",
        "korean": "네. 여기 계산서입니다."
      },
      {
        "role": "traveler",
        "english": "What is this charge for?",
        "korean": "이 요금은 뭐예요?"
      },
      {
        "role": "staff",
        "english": "That is for room service last night.",
        "korean": "어젯밤 룸서비스 요금입니다."
      }
    ]
  },
  {
    "day": 12,
    "topic": "restaurant-reservations-and-ordering",
    "turns": [
      {
        "role": "traveler",
        "english": "I made a reservation for seven.",
        "korean": "7시에 예약했어요."
      },
      {
        "role": "staff",
        "english": "Welcome. Would you like to sit by the window?",
        "korean": "어서 오세요. 창가에 앉으시겠어요?"
      },
      {
        "role": "traveler",
        "english": "Yes, please. We also have a nut allergy.",
        "korean": "네, 부탁드려요. 저희는 견과류 알레르기도 있어요."
      }
    ]
  },
  {
    "day": 13,
    "topic": "dining-requests",
    "turns": [
      {
        "role": "traveler",
        "english": "This isn't what I ordered.",
        "korean": "이건 제가 주문한 게 아니에요."
      },
      {
        "role": "staff",
        "english": "I'm sorry. What did you order?",
        "korean": "죄송합니다. 무엇을 주문하셨나요?"
      },
      {
        "role": "traveler",
        "english": "I ordered my steak well-done.",
        "korean": "스테이크를 웰던으로 주문했어요."
      }
    ]
  },
  {
    "day": 14,
    "topic": "cafe-orders",
    "turns": [
      {
        "role": "traveler",
        "english": "Can I have a small iced latte, please?",
        "korean": "작은 아이스 라테 한 잔 주세요."
      },
      {
        "role": "staff",
        "english": "Would you like regular milk?",
        "korean": "일반 우유로 드릴까요?"
      },
      {
        "role": "traveler",
        "english": "Do you have almond milk?",
        "korean": "아몬드 우유가 있나요?"
      }
    ]
  },
  {
    "day": 15,
    "topic": "clothing-shopping",
    "turns": [
      {
        "role": "traveler",
        "english": "Do you have this in a different color?",
        "korean": "이거 다른 색상도 있나요?"
      },
      {
        "role": "staff",
        "english": "Yes, we have it in blue and green.",
        "korean": "네, 파란색과 초록색이 있습니다."
      },
      {
        "role": "traveler",
        "english": "Could I try the blue one on?",
        "korean": "파란색으로 입어 봐도 될까요?"
      }
    ]
  },
  {
    "day": 16,
    "topic": "sizes-and-store-policies",
    "turns": [
      {
        "role": "traveler",
        "english": "This is too tight. Do you have a larger size?",
        "korean": "이게 너무 꽉 끼어요. 더 큰 사이즈가 있나요?"
      },
      {
        "role": "staff",
        "english": "Yes, I'll bring you a large.",
        "korean": "네, 라지 사이즈로 가져다드릴게요."
      },
      {
        "role": "traveler",
        "english": "Thank you. What is your return policy?",
        "korean": "감사합니다. 반품 규정이 어떻게 되나요?"
      }
    ]
  },
  {
    "day": 17,
    "topic": "payments-and-returns",
    "turns": [
      {
        "role": "traveler",
        "english": "I'd like to return this.",
        "korean": "이걸 반품하고 싶어요."
      },
      {
        "role": "staff",
        "english": "Do you have the receipt?",
        "korean": "영수증이 있으신가요?"
      },
      {
        "role": "traveler",
        "english": "Yes, and I paid by card.",
        "korean": "네, 카드로 결제했어요."
      }
    ]
  },
  {
    "day": 18,
    "topic": "market-bargaining",
    "turns": [
      {
        "role": "traveler",
        "english": "How much are these apples?",
        "korean": "이 사과는 얼마예요?"
      },
      {
        "role": "staff",
        "english": "They're five dollars per kilogram.",
        "korean": "1킬로그램에 5달러입니다."
      },
      {
        "role": "traveler",
        "english": "Can I get a better deal if I buy two kilograms?",
        "korean": "2킬로그램 사면 더 싸게 해 주실 수 있나요?"
      }
    ]
  },
  {
    "day": 19,
    "topic": "souvenirs-and-shipping",
    "turns": [
      {
        "role": "traveler",
        "english": "I'm looking for a gift for my mother.",
        "korean": "어머니께 드릴 선물을 찾고 있어요."
      },
      {
        "role": "staff",
        "english": "This locally made bowl is popular.",
        "korean": "현지에서 만든 이 그릇이 인기 있어요."
      },
      {
        "role": "traveler",
        "english": "Is it fragile, and do you ship internationally?",
        "korean": "깨지기 쉬운가요? 국제 배송도 하시나요?"
      }
    ]
  },
  {
    "day": 20,
    "topic": "phone-and-tech-support",
    "turns": [
      {
        "role": "traveler",
        "english": "My phone battery is dead.",
        "korean": "제 휴대폰 배터리가 방전되었어요."
      },
      {
        "role": "staff",
        "english": "You can charge it at that counter.",
        "korean": "저쪽 카운터에서 충전하실 수 있어요."
      },
      {
        "role": "traveler",
        "english": "Thank you. Do you also sell universal travel adapters?",
        "korean": "감사합니다. 여행용 멀티 어댑터도 판매하나요?"
      }
    ]
  },
  {
    "day": 21,
    "topic": "flight-booking",
    "turns": [
      {
        "role": "traveler",
        "english": "I'd like to book a flight to Seoul next Friday.",
        "korean": "다음 주 금요일 서울행 항공편을 예약하고 싶어요."
      },
      {
        "role": "staff",
        "english": "We have a morning flight available.",
        "korean": "오전 항공편이 있습니다."
      },
      {
        "role": "traveler",
        "english": "I'd like a window seat, please.",
        "korean": "창가 좌석 부탁드려요."
      }
    ]
  },
  {
    "day": 22,
    "topic": "emergencies-and-police",
    "turns": [
      {
        "role": "traveler",
        "english": "Please help me. My passport was stolen.",
        "korean": "도와주세요. 여권을 도난당했어요."
      },
      {
        "role": "local",
        "english": "I'll call the police for you.",
        "korean": "경찰에 전화해 드릴게요."
      },
      {
        "role": "traveler",
        "english": "Thank you. I need to file a police report.",
        "korean": "감사합니다. 경찰에 신고해야 해요."
      }
    ]
  },
  {
    "day": 23,
    "topic": "medical-symptoms",
    "turns": [
      {
        "role": "staff",
        "english": "Where does it hurt?",
        "korean": "어디가 아프세요?"
      },
      {
        "role": "traveler",
        "english": "My stomach hurts, and I feel dizzy.",
        "korean": "배가 아프고 어지러워요."
      },
      {
        "role": "staff",
        "english": "Have you had a fever?",
        "korean": "열도 나셨나요?"
      }
    ]
  },
  {
    "day": 24,
    "topic": "pharmacy-and-medicine",
    "turns": [
      {
        "role": "traveler",
        "english": "Do you have something for a headache?",
        "korean": "두통에 먹을 약이 있나요?"
      },
      {
        "role": "staff",
        "english": "Are you allergic to any medicine?",
        "korean": "알레르기가 있는 약이 있으세요?"
      },
      {
        "role": "traveler",
        "english": "No. How often should I take it?",
        "korean": "없어요. 얼마나 자주 복용해야 하나요?"
      }
    ]
  },
  {
    "day": 25,
    "topic": "asking-for-help",
    "turns": [
      {
        "role": "traveler",
        "english": "Could you help me carry this suitcase?",
        "korean": "이 여행 가방 옮기는 것 좀 도와주시겠어요?"
      },
      {
        "role": "local",
        "english": "Of course. Where are you going?",
        "korean": "물론이죠. 어디로 가세요?"
      },
      {
        "role": "traveler",
        "english": "Just to the taxi stand. Thank you.",
        "korean": "택시 승강장까지만요. 감사합니다."
      }
    ]
  },
  {
    "day": 26,
    "topic": "opinions-and-recommendations",
    "turns": [
      {
        "role": "traveler",
        "english": "Which museum should I visit?",
        "korean": "어느 박물관에 가 보는 게 좋을까요?"
      },
      {
        "role": "local",
        "english": "I recommend the city history museum.",
        "korean": "시립 역사 박물관을 추천해요."
      },
      {
        "role": "traveler",
        "english": "That sounds like a great idea.",
        "korean": "좋은 생각인 것 같아요."
      }
    ]
  },
  {
    "day": 27,
    "topic": "weather-and-climate",
    "turns": [
      {
        "role": "traveler",
        "english": "It looks like it's going to rain.",
        "korean": "비가 올 것 같아요."
      },
      {
        "role": "local",
        "english": "The forecast says it will rain this afternoon.",
        "korean": "일기 예보에 따르면 오늘 오후에 비가 온대요."
      },
      {
        "role": "traveler",
        "english": "Do you have an umbrella I can borrow?",
        "korean": "빌릴 수 있는 우산이 있나요?"
      }
    ]
  },
  {
    "day": 28,
    "topic": "local-culture-and-language",
    "turns": [
      {
        "role": "traveler",
        "english": "I'd like to learn a few words in Spanish.",
        "korean": "스페인어로 몇 마디 배우고 싶어요."
      },
      {
        "role": "local",
        "english": "What would you like to say?",
        "korean": "어떤 말을 배우고 싶으세요?"
      },
      {
        "role": "traveler",
        "english": "Could you teach me how to say thank you?",
        "korean": "감사합니다를 어떻게 말하는지 가르쳐 주시겠어요?"
      }
    ]
  },
  {
    "day": 29,
    "topic": "phone-calls",
    "turns": [
      {
        "role": "traveler",
        "english": "Hello, I'd like to speak to Alex.",
        "korean": "여보세요, 알렉스와 통화하고 싶습니다."
      },
      {
        "role": "staff",
        "english": "May I ask who's calling?",
        "korean": "누구신지 여쭤봐도 될까요?"
      },
      {
        "role": "traveler",
        "english": "This is Mina Kim. I'm calling about my reservation.",
        "korean": "김미나입니다. 예약 때문에 전화드렸어요."
      },
      {
        "role": "staff",
        "english": "Please hold the line for a moment.",
        "korean": "잠시만 기다려 주세요."
      }
    ]
  },
  {
    "day": 30,
    "topic": "local-information",
    "turns": [
      {
        "role": "traveler",
        "english": "What time does the museum close?",
        "korean": "박물관은 몇 시에 문을 닫나요?"
      },
      {
        "role": "staff",
        "english": "It closes at six, and the last tour starts at five.",
        "korean": "6시에 문을 닫고 마지막 투어는 5시에 시작해요."
      },
      {
        "role": "traveler",
        "english": "Do I need to book the tour in advance?",
        "korean": "투어를 미리 예약해야 하나요?"
      }
    ]
  },
  {
    "day": 31,
    "topic": "travel-support-calls",
    "turns": [
      {
        "role": "traveler",
        "english": "I'm calling to confirm my flight booking.",
        "korean": "항공편 예약을 확인하려고 전화드렸어요."
      },
      {
        "role": "staff",
        "english": "What is your booking number?",
        "korean": "예약 번호가 어떻게 되세요?"
      },
      {
        "role": "traveler",
        "english": "The booking number is AB1234.",
        "korean": "예약 번호는 AB1234입니다."
      }
    ]
  },
  {
    "day": 32,
    "topic": "messages-and-email",
    "turns": [
      {
        "role": "staff",
        "english": "Could you confirm your email address?",
        "korean": "이메일 주소를 확인해 주시겠어요?"
      },
      {
        "role": "traveler",
        "english": "Yes, it's alex.kim@example.com.",
        "korean": "네, alex.kim@example.com입니다."
      },
      {
        "role": "staff",
        "english": "Thank you. I'll send the details there.",
        "korean": "감사합니다. 그 주소로 자세한 내용을 보내드릴게요."
      }
    ]
  },
  {
    "day": 33,
    "topic": "scheduling-and-appointments",
    "turns": [
      {
        "role": "traveler",
        "english": "Is Monday convenient for you?",
        "korean": "월요일이 괜찮으세요?"
      },
      {
        "role": "local",
        "english": "I'm busy then. Can we meet on Tuesday?",
        "korean": "그때는 바빠요. 화요일에 만날 수 있을까요?"
      },
      {
        "role": "traveler",
        "english": "Tuesday works for me. Let's meet at three.",
        "korean": "화요일은 괜찮아요. 3시에 만나요."
      }
    ]
  },
  {
    "day": 34,
    "topic": "feelings-and-emotions",
    "turns": [
      {
        "role": "local",
        "english": "How are you feeling about the trip?",
        "korean": "여행에 대해 기분이 어떠세요?"
      },
      {
        "role": "traveler",
        "english": "I'm excited, but I'm also a little worried.",
        "korean": "신나지만 조금 걱정되기도 해요."
      },
      {
        "role": "local",
        "english": "Don't worry. You're going to have a great time.",
        "korean": "걱정하지 마세요. 정말 즐거운 시간을 보내실 거예요."
      }
    ]
  },
  {
    "day": 35,
    "topic": "compliments-and-encouragement",
    "turns": [
      {
        "role": "traveler",
        "english": "I took this photo at sunrise.",
        "korean": "해 뜰 때 이 사진을 찍었어요."
      },
      {
        "role": "local",
        "english": "That is a beautiful picture. You are very talented.",
        "korean": "정말 아름다운 사진이네요. 재능이 있으시네요."
      },
      {
        "role": "traveler",
        "english": "Thank you. I appreciate your encouragement.",
        "korean": "감사합니다. 격려해 주셔서 기뻐요."
      }
    ]
  },
  {
    "day": 36,
    "topic": "attraction-information",
    "turns": [
      {
        "role": "traveler",
        "english": "What are the opening hours?",
        "korean": "운영 시간이 어떻게 되나요?"
      },
      {
        "role": "staff",
        "english": "We are open from nine to six.",
        "korean": "오전 9시부터 오후 6시까지 운영합니다."
      },
      {
        "role": "traveler",
        "english": "Great. Where can I buy tickets?",
        "korean": "좋네요. 표는 어디에서 살 수 있나요?"
      }
    ]
  },
  {
    "day": 37,
    "topic": "travel-photos",
    "turns": [
      {
        "role": "traveler",
        "english": "Could you take a photo of me here?",
        "korean": "여기서 제 사진을 찍어 주시겠어요?"
      },
      {
        "role": "local",
        "english": "Of course. Stand a little closer to the fountain.",
        "korean": "물론이죠. 분수 쪽으로 조금 더 가까이 서 주세요."
      },
      {
        "role": "traveler",
        "english": "Thanks. Could you take one more?",
        "korean": "감사합니다. 한 장 더 찍어 주시겠어요?"
      }
    ]
  },
  {
    "day": 38,
    "topic": "day-trip-booking",
    "turns": [
      {
        "role": "traveler",
        "english": "I'd like to sign up for the day trip. What does it include?",
        "korean": "당일 투어를 신청하고 싶어요. 무엇이 포함되어 있나요?"
      },
      {
        "role": "staff",
        "english": "It includes transportation, lunch, and a guide.",
        "korean": "교통편과 점심 식사, 가이드가 포함되어 있습니다."
      },
      {
        "role": "traveler",
        "english": "Perfect. What time is pickup?",
        "korean": "좋아요. 픽업은 몇 시인가요?"
      }
    ]
  },
  {
    "day": 39,
    "topic": "asking-locals-for-help",
    "turns": [
      {
        "role": "traveler",
        "english": "Excuse me, could you help me read this sign?",
        "korean": "실례합니다. 이 표지판을 읽는 것 좀 도와주시겠어요?"
      },
      {
        "role": "local",
        "english": "It says the station entrance is around the corner.",
        "korean": "역 입구가 모퉁이를 돌면 있다고 쓰여 있어요."
      },
      {
        "role": "traveler",
        "english": "Thank you for your help.",
        "korean": "도와주셔서 감사합니다."
      }
    ]
  },
  {
    "day": 40,
    "topic": "shows-and-nightlife",
    "turns": [
      {
        "role": "traveler",
        "english": "I'd like two tickets for the eight o'clock show.",
        "korean": "8시 공연 표 두 장 주세요."
      },
      {
        "role": "staff",
        "english": "We have two seats in the front row.",
        "korean": "앞줄에 두 자리가 있습니다."
      },
      {
        "role": "traveler",
        "english": "Those sound good. How long is the show?",
        "korean": "좋네요. 공연은 얼마나 하나요?"
      }
    ]
  },
  {
    "day": 41,
    "topic": "checking-understanding",
    "turns": [
      {
        "role": "staff",
        "english": "The tour starts at nine by the main entrance.",
        "korean": "투어는 정문 앞에서 9시에 시작합니다."
      },
      {
        "role": "traveler",
        "english": "You mean the tour starts at nine, right?",
        "korean": "투어가 9시에 시작한다는 말씀이시죠?"
      },
      {
        "role": "staff",
        "english": "That is correct.",
        "korean": "네, 맞습니다."
      }
    ]
  },
  {
    "day": 42,
    "topic": "business-meetings",
    "turns": [
      {
        "role": "traveler",
        "english": "I'm here for a business meeting with Mr. Smith.",
        "korean": "스미스 씨와 업무 회의가 있어서 왔습니다."
      },
      {
        "role": "staff",
        "english": "He is waiting for you in conference room three.",
        "korean": "3번 회의실에서 기다리고 계십니다."
      },
      {
        "role": "traveler",
        "english": "Thank you. Could you show me the way?",
        "korean": "감사합니다. 어디로 가야 하는지 알려 주시겠어요?"
      }
    ]
  },
  {
    "day": 43,
    "topic": "meeting-new-people",
    "turns": [
      {
        "role": "traveler",
        "english": "Hello. My name is Alex. Nice to meet you.",
        "korean": "안녕하세요. 제 이름은 알렉스예요. 만나서 반가워요."
      },
      {
        "role": "local",
        "english": "Nice to meet you too. Where are you from?",
        "korean": "저도 반가워요. 어디에서 오셨어요?"
      },
      {
        "role": "traveler",
        "english": "I'm from Canada. This is my first visit here.",
        "korean": "캐나다에서 왔어요. 여기는 처음 방문해요."
      }
    ]
  },
  {
    "day": 44,
    "topic": "hobbies-and-interests",
    "turns": [
      {
        "role": "local",
        "english": "What are your hobbies?",
        "korean": "취미가 뭐예요?"
      },
      {
        "role": "traveler",
        "english": "I enjoy hiking and listening to music.",
        "korean": "하이킹과 음악 듣는 것을 좋아해요."
      },
      {
        "role": "local",
        "english": "That sounds fun. What kind of music do you like?",
        "korean": "재미있겠네요. 어떤 음악을 좋아하세요?"
      }
    ]
  },
  {
    "day": 45,
    "topic": "sharing-travel-experiences",
    "turns": [
      {
        "role": "local",
        "english": "How are you enjoying your trip?",
        "korean": "여행은 즐거우세요?"
      },
      {
        "role": "traveler",
        "english": "I'm having a wonderful time. I highly recommend the old town.",
        "korean": "정말 좋은 시간을 보내고 있어요. 구시가지를 정말 추천해요."
      },
      {
        "role": "local",
        "english": "I am glad you liked it. Are you visiting the palace next?",
        "korean": "마음에 드셨다니 기쁘네요. 다음에는 궁궐에 가세요?"
      }
    ]
  },
  {
    "day": 46,
    "topic": "conversation-reactions",
    "turns": [
      {
        "role": "local",
        "english": "I walked all the way here in the rain.",
        "korean": "비를 맞으며 여기까지 걸어왔어요."
      },
      {
        "role": "traveler",
        "english": "Really? That must have been difficult.",
        "korean": "정말요? 힘드셨겠네요."
      },
      {
        "role": "local",
        "english": "It was, but a kind driver gave me an umbrella.",
        "korean": "힘들었지만 친절한 기사님이 우산을 주셨어요."
      },
      {
        "role": "traveler",
        "english": "What a coincidence! A driver helped me yesterday too.",
        "korean": "정말 우연이네요! 저도 어제 기사님께 도움을 받았어요."
      }
    ]
  },
  {
    "day": 47,
    "topic": "ending-a-conversation",
    "turns": [
      {
        "role": "traveler",
        "english": "I have to go now. It was nice talking to you.",
        "korean": "이제 가 봐야 해요. 이야기 나눠서 즐거웠어요."
      },
      {
        "role": "local",
        "english": "Likewise. I hope we meet again.",
        "korean": "저도요. 다시 만나면 좋겠어요."
      },
      {
        "role": "traveler",
        "english": "Take care. I'll be in touch.",
        "korean": "잘 지내세요. 연락드릴게요."
      }
    ]
  },
  {
    "day": 48,
    "topic": "everyday-conversation",
    "turns": [
      {
        "role": "local",
        "english": "How was your day?",
        "korean": "오늘 하루 어땠어요?"
      },
      {
        "role": "traveler",
        "english": "Pretty good. I visited the market and then relaxed at the hotel.",
        "korean": "꽤 좋았어요. 시장에 갔다가 호텔에서 쉬었어요."
      },
      {
        "role": "local",
        "english": "What are you doing later?",
        "korean": "나중에 뭐 할 거예요?"
      }
    ]
  },
  {
    "day": 49,
    "topic": "polite-requests",
    "turns": [
      {
        "role": "traveler",
        "english": "I hope I'm not bothering you. Do you know when the museum closes?",
        "korean": "방해가 되지 않았으면 좋겠는데요. 박물관이 몇 시에 문을 닫는지 아세요?"
      },
      {
        "role": "local",
        "english": "Not at all. It closes at six.",
        "korean": "괜찮아요. 여섯 시에 문을 닫아요."
      },
      {
        "role": "traveler",
        "english": "That is a great help. Thank you.",
        "korean": "큰 도움이 됐어요. 감사합니다."
      }
    ]
  },
  {
    "day": 50,
    "topic": "travel-essentials",
    "turns": [
      {
        "role": "traveler",
        "english": "Excuse me, is this the right way to the station?",
        "korean": "실례합니다. 이 길이 역으로 가는 길이 맞나요?"
      },
      {
        "role": "local",
        "english": "Yes. Turn right at the next traffic light.",
        "korean": "네. 다음 신호등에서 오른쪽으로 도세요."
      },
      {
        "role": "traveler",
        "english": "Thank you. I thought I was lost.",
        "korean": "감사합니다. 길을 잃은 줄 알았어요."
      }
    ]
  },
  {
    "day": 51,
    "topic": "hotel-and-dining",
    "turns": [
      {
        "role": "traveler",
        "english": "I have a reservation. My name is Alex Kim.",
        "korean": "예약했습니다. 제 이름은 알렉스 김입니다."
      },
      {
        "role": "staff",
        "english": "Welcome, Mr. Kim. May I see your passport?",
        "korean": "어서 오세요, 김 고객님. 여권을 보여 주시겠어요?"
      },
      {
        "role": "traveler",
        "english": "Of course. Can I leave my luggage here after checkout tomorrow?",
        "korean": "물론이죠. 내일 체크아웃 후에 짐을 맡길 수 있을까요?"
      }
    ]
  },
  {
    "day": 52,
    "topic": "shopping-and-payments",
    "turns": [
      {
        "role": "traveler",
        "english": "Do you have this jacket in a size eight?",
        "korean": "이 재킷 8사이즈가 있나요?"
      },
      {
        "role": "staff",
        "english": "Yes, here you are. It is also on sale today.",
        "korean": "네, 여기 있습니다. 오늘은 할인도 됩니다."
      },
      {
        "role": "traveler",
        "english": "Great. Can I make a contactless payment?",
        "korean": "좋네요. 비접촉식으로 결제할 수 있나요?"
      }
    ]
  },
  {
    "day": 53,
    "topic": "emergencies-and-local-help",
    "turns": [
      {
        "role": "traveler",
        "english": "I twisted my ankle and I feel nauseous.",
        "korean": "발목을 삐었고 속도 메스꺼워요."
      },
      {
        "role": "local",
        "english": "You should sit down. Do you need me to call emergency services?",
        "korean": "앉아 계세요. 긴급 구조대에 전화해 드릴까요?"
      },
      {
        "role": "traveler",
        "english": "Yes, please. Thank you for helping me.",
        "korean": "네, 부탁드려요. 도와주셔서 감사합니다."
      }
    ]
  },
  {
    "day": 54,
    "topic": "phone-calls-and-arrangements",
    "turns": [
      {
        "role": "staff",
        "english": "Hello, this is the hotel front desk returning your call.",
        "korean": "안녕하세요. 호텔 프런트입니다. 전화 주셔서 연락드렸습니다."
      },
      {
        "role": "traveler",
        "english": "Thank you. I am calling about my lost bag.",
        "korean": "감사합니다. 잃어버린 가방 때문에 전화드렸어요."
      },
      {
        "role": "staff",
        "english": "We found it. What time can you come by?",
        "korean": "가방을 찾았습니다. 몇 시에 오실 수 있나요?"
      },
      {
        "role": "traveler",
        "english": "Let's make it ten tomorrow morning.",
        "korean": "내일 오전 10시로 하죠."
      }
    ]
  },
  {
    "day": 55,
    "topic": "sightseeing-and-transport",
    "turns": [
      {
        "role": "traveler",
        "english": "How do I get to the observation deck?",
        "korean": "전망대에 어떻게 가나요?"
      },
      {
        "role": "staff",
        "english": "Take the elevator to the tenth floor. The entrance is on your left.",
        "korean": "엘리베이터를 타고 10층으로 가세요. 입구는 왼쪽에 있습니다."
      },
      {
        "role": "traveler",
        "english": "Thanks. Do you have a brochure in Korean?",
        "korean": "감사합니다. 한국어 안내 책자도 있나요?"
      }
    ]
  },
  {
    "day": 56,
    "topic": "meeting-locals",
    "turns": [
      {
        "role": "traveler",
        "english": "What do you recommend I do tonight?",
        "korean": "오늘 밤에는 뭘 하면 좋을까요?"
      },
      {
        "role": "local",
        "english": "Try the night market. There is a local noodle dish you should taste.",
        "korean": "야시장에 가 보세요. 꼭 맛봐야 할 현지 국수 요리가 있어요."
      },
      {
        "role": "traveler",
        "english": "That sounds amazing. Thanks for the recommendation.",
        "korean": "정말 멋지겠네요. 추천해 주셔서 감사해요."
      }
    ]
  },
  {
    "day": 57,
    "topic": "detailed-travel-questions",
    "turns": [
      {
        "role": "traveler",
        "english": "Which platform does the train to the airport depart from?",
        "korean": "공항행 기차는 어느 플랫폼에서 출발하나요?"
      },
      {
        "role": "staff",
        "english": "Platform six. The next train leaves in fifteen minutes.",
        "korean": "6번 플랫폼입니다. 다음 기차는 15분 후에 출발합니다."
      },
      {
        "role": "traveler",
        "english": "Do I need to show my passport to buy a ticket?",
        "korean": "표를 사려면 여권을 보여 드려야 하나요?"
      },
      {
        "role": "staff",
        "english": "No, your credit card is enough.",
        "korean": "아니요, 신용카드만 있으면 됩니다."
      }
    ]
  },
  {
    "day": 58,
    "topic": "polite-formal-requests",
    "turns": [
      {
        "role": "traveler",
        "english": "I was wondering if you might be able to assist me.",
        "korean": "혹시 저를 도와주실 수 있을까요?"
      },
      {
        "role": "staff",
        "english": "Certainly. What are you looking for?",
        "korean": "물론입니다. 무엇을 찾고 계세요?"
      },
      {
        "role": "traveler",
        "english": "I was hoping to find a portable charger.",
        "korean": "휴대용 충전기를 찾고 있었어요."
      }
    ]
  },
  {
    "day": 59,
    "topic": "confident-conversation-closings",
    "turns": [
      {
        "role": "staff",
        "english": "The walking route is marked on your map.",
        "korean": "도보 경로를 지도에 표시해 드렸습니다."
      },
      {
        "role": "traveler",
        "english": "Thank you. I know exactly where to go now.",
        "korean": "감사합니다. 이제 어디로 가야 할지 정확히 알겠어요."
      },
      {
        "role": "staff",
        "english": "Have a wonderful rest of your day.",
        "korean": "남은 하루도 즐겁게 보내세요."
      },
      {
        "role": "traveler",
        "english": "You too. Goodbye for now.",
        "korean": "직원분도요. 그럼 이만 가볼게요."
      }
    ]
  },
  {
    "day": 60,
    "topic": "travel-review-essentials",
    "turns": [
      {
        "role": "traveler",
        "english": "My reservation is under the name Park.",
        "korean": "박이라는 이름으로 예약했습니다."
      },
      {
        "role": "staff",
        "english": "I found it. Could I check your passport, please?",
        "korean": "예약을 확인했습니다. 여권을 확인해도 될까요?"
      },
      {
        "role": "traveler",
        "english": "Certainly. Could you also tell me where the closest convenience store is?",
        "korean": "물론이죠. 가장 가까운 편의점이 어디인지도 알려 주시겠어요?"
      }
    ]
  }
]
