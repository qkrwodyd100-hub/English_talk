# -*- coding: utf-8 -*-
"""Generate Day 61-75 practical-pattern sentences + dialogues (CURRICULUM-BEGINNER-1).

Round 2: parent linguistic review corrections applied. Alternatives reduced to
reviewed equivalent pairs only. Blanket primary-English uniqueness dropped on
purpose: IDs stay unique, intentional repeats of learned chunks are allowed and
reported (see DUP-REPORT below), never achieved by distorting natural English.

Single source of truth for days 61-75. Rebuilds ONLY the day>=61 sections of
src/sentences.ts and src/dialogues.ts; the first60 slices are preserved
byte-for-byte (verified against independently captured baseline digests).
Idempotent: running twice yields identical target files.
"""
import hashlib
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Independently captured baseline digests of the first60 slices (pre-edit).
EXPECTED_SENTENCES_FIRST60_SHA = "800af9e2a74477a9ed8874525c12e74c1ba532bf9175f93504a3f6287dd512f9"
EXPECTED_DIALOGUES_FIRST60_SHA = "3e9bf0f96f058b3ae915ea884bed0322277bb9639d1c2a0e4c8741167f42348c"

BANNED = [
    "endorse my ticket", "entitled to compensation", "decant", "corked",
    "vintage", "penalty fare", "외상 장부", "성수기", "lost my transfer",
    "pair us kindly", "my flight, my bag", "dispute on my receipt",
    "would like to dispute", "red channel", "cross contact",
    "written statement", "inbound flight", "back nine",
]

S = []  # (day, english, korean, level, priority, alt_en, alt_ko)
def add(day, en, ko, lv, pr, aen=None, ako=None):
    S.append((day, en, ko, lv, pr, aen, ako))

# Day 61 airport transit (connecting flights)
add(61, "Which terminal does my next flight leave from?", "다음 비행기가 어느 터미널에서 출발하나요.", "beginner", 1)
add(61, "How long does the transfer take?", "환승하는 데 얼마나 걸리나요.", "beginner", 1)
add(61, "Where is the transfer counter?", "환승 카운터가 어디에 있나요.", "beginner", 2)
add(61, "Can I walk to the next terminal?", "다음 터미널까지 걸어갈 수 있나요.", "beginner", 1,
    "Can I get to the next terminal on foot?", "걸어서 다음 터미널에 갈 수 있나요.")
add(61, "Could you show me the way to my gate?", "제 탑승구로 가는 길을 알려 주시겠어요.", "beginner", 1,
    "Could you tell me how to get to my gate?", "탑승구로 가는 방법을 알려 주시겠어요.")
add(61, "I might miss my connection. Please help me.", "연결편을 놓칠 것 같아요. 도와주세요.", "beginner", 1)
add(61, "Can I get on the next flight?", "다음 비행기로 갈 수 있나요.", "beginner", 2)
add(61, "My first flight was delayed, so I may miss my connection.", "첫 비행기가 연착해서 연결편을 놓칠 것 같아요.", "intermediate", 2)
add(61, "Could you help me change my flight?", "비행기 변경을 도와주시겠어요.", "intermediate", 2,
    "Could you help me switch to a different flight?", "다른 비행기로 바꾸는 걸 도와주시겠어요.")
add(61, "I missed my connection. Can you help me find a hotel?", "연결편을 놓쳤어요. 호텔 찾는 걸 도와주시겠어요.", "intermediate", 3)

# Day 62 lost baggage + customs
add(62, "My suitcase didn't arrive.", "제 여행 가방이 도착하지 않았어요.", "beginner", 1,
    "My bag didn't arrive.", "가방이 도착하지 않았어요.")
add(62, "Where is the lost baggage office?", "수하물 분실물 센터가 어디에 있나요.", "beginner", 1)
add(62, "I'd like to report my missing bag.", "가방 분실을 신고하고 싶어요.", "beginner", 2,
    "I want to report my missing bag.", "가방 분실을 신고하고 싶어요.")
add(62, "My bag is missing. Please help me.", "가방이 없어졌어요. 도와주세요.", "beginner", 1)
add(62, "Could you help me fill out this form?", "이 서류 작성을 도와주시겠어요.", "beginner", 2,
    "Can you help me complete this form?", "이 서류 작성을 도와주시겠어요.")
add(62, "Here's my baggage claim tag.", "여기 제 수하물 표가 있어요.", "beginner", 1)
add(62, "How long will it take to find my bag?", "가방을 찾는 데 얼마나 걸리나요.", "beginner", 1)
add(62, "I need clean clothes because my bag is missing.", "가방이 없어서 갈아입을 옷이 필요해요.", "intermediate", 2)
add(62, "I have something to declare. Where do I go?", "신고할 물건이 있어요. 어디로 가나요.", "intermediate", 2)
add(62, "Do I need to declare this?", "이걸 신고해야 하나요.", "intermediate", 3)

# Day 63 ride-share + delays
add(63, "My driver canceled the ride.", "기사님이 운행을 취소했어요.", "beginner", 1)
add(63, "I left my phone in the car.", "차 안에 휴대폰을 두고 내렸어요.", "beginner", 1)
add(63, "The fare is wrong. Can you check it?", "요금이 잘못됐어요. 확인해 주시겠어요.", "beginner", 2,
    "This fare looks wrong. Could you check it?", "요금이 이상해 보여요. 확인해 주시겠어요.")
add(63, "Can I get a refund for this extra charge?", "이 추가 요금을 환불받을 수 있나요.", "beginner", 1,
    "Could you refund this extra charge?", "이 추가 요금을 환불해 주시겠어요.")
add(63, "The pickup location is wrong.", "지도상 탑승 위치가 잘못됐어요.", "beginner", 2)
add(63, "My train is 40 minutes late.", "제 기차가 40분 늦었어요.", "beginner", 1)
add(63, "Could you help me contact the driver?", "기사님께 연락하는 걸 도와주시겠어요.", "beginner", 1)
add(63, "The driver took a longer route.", "기사님이 돌아서 가셨어요.", "intermediate", 2)
add(63, "Is there another way to get there?", "그리로 가는 다른 길이 있나요.", "intermediate", 2)
add(63, "How long do we have to wait?", "얼마나 기다려야 하나요.", "intermediate", 3)

# Day 64 passes + late-night return
add(64, "I'd like to buy a monthly pass.", "정기권을 사고 싶어요.", "beginner", 1,
    "Can I buy a monthly pass, please?", "정기권을 살 수 있을까요.")
add(64, "Is the airport line included in this pass?", "이 정기권에 공항선이 포함되나요.", "beginner", 2)
add(64, "Where can I add money to this card?", "이 카드에 어디서 돈을 넣나요.", "beginner", 1,
    "Where can I reload this card?", "이 카드를 어디서 충전하나요.")
add(64, "My card did not work at the gate.", "제 카드가 개찰구에서 인식되지 않았어요.", "beginner", 2,
    "My card didn't work at the gate.", "제 카드가 개찰구에서 안 됐어요.")
add(64, "What time is the last train to the airport?", "공항행 막차가 몇 시인가요.", "beginner", 1)
add(64, "Could you call a taxi for tonight?", "오늘 밤 탈 택시를 불러 주시겠어요.", "beginner", 1)
add(64, "Could you drop me off by that streetlight?", "저 가로등 근처에 내려 주세요.", "beginner", 2)
add(64, "Which areas does this pass cover?", "이 정기권은 어느 구간까지 되나요.", "intermediate", 2)
add(64, "My ticket has expired. What should I do?", "제 표 유효기간이 지났어요. 어떻게 해야 하나요.", "intermediate", 3)
add(64, "Is it safe to walk home from here at night?", "밤에 여기서 걸어 귀가해도 안전한가요.", "intermediate", 3)

# Day 65 allergies
add(65, "I have a peanut allergy.", "저는 땅콩 알레르기가 있어요.", "beginner", 1)
add(65, "Does this food have nuts in it?", "이 음식에 견과류가 있나요.", "beginner", 1,
    "Are there any nuts in this food?", "이 음식에 견과류가 있나요.")
add(65, "Could you leave out the shrimp?", "새우는 빼 주시겠어요.", "beginner", 2,
    "Could you make it without shrimp?", "새우 없이 만들어 주시겠어요.")
add(65, "Do you have any gluten-free options?", "글루텐 프리 음식이 있나요.", "beginner", 2)
add(65, "I'm having an allergic reaction. Please call for help.", "알레르기 반응이 일어나고 있어요. 도움을 요청해 주세요.", "intermediate", 3)
add(65, "My allergy medicine is in my bag.", "가방에 알레르기 약이 있어요.", "beginner", 1)
add(65, "Could you check what's in this sauce?", "이 소스에 뭐가 들었는지 확인해 주시겠어요.", "beginner", 2,
    "Could you check the ingredients in this sauce?", "이 소스의 재료를 확인해 주시겠어요.")
add(65, "Can you prepare my food without any contact with nuts?", "제 음식이 견과류에 닿지 않게 준비해 주시겠어요.", "intermediate", 2)
add(65, "I'll have the grilled fish and plain rice.", "구운 생선과 흰쌀밥으로 주세요.", "intermediate", 2)
add(65, "Thank you for checking the ingredients.", "재료 확인해 주셔서 감사해요.", "intermediate", 3)

# Day 66 drink ordering
add(66, "Do you have a wine list?", "와인 리스트가 있나요.", "beginner", 1)
add(66, "I'd like a glass of red wine.", "레드 와인 한 잔 주세요.", "beginner", 1,
    "A glass of red wine, please.", "레드 와인 한 잔 주세요.")
add(66, "What do you recommend with steak?", "스테이크에는 무엇을 추천하세요.", "beginner", 2)
add(66, "Is this wine sweet or dry?", "이 와인은 달콤한가요, 드라이한가요.", "beginner", 1)
add(66, "Can I try a little first?", "먼저 조금 맛봐도 될까요.", "beginner", 2,
    "Could I taste a little first?", "먼저 조금 맛봐도 될까요.")
add(66, "Can we share one bottle?", "한 병을 나눠 마셔도 될까요.", "beginner", 1)
add(66, "This wine tastes off. Could I try a different one?", "이 와인에서 이상한 맛이 나요. 다른 걸로 맛봐도 될까요.", "intermediate", 2)
add(66, "Could we have some water too?", "물도 좀 주시겠어요.", "intermediate", 2)
add(66, "Do you have white wine by the glass?", "화이트 와인을 잔으로도 파나요.", "intermediate", 2)
add(66, "Please keep the change.", "잔돈은 가지세요.", "intermediate", 3)

# Day 67 bill + simple bar
add(67, "Could we have the check, please?", "계산서 주시겠어요.", "beginner", 1,
    "Could we have the bill, please?", "계산서 주시겠어요.")
add(67, "Can we split the check in half?", "계산서를 반반으로 나눠 주시겠어요.", "beginner", 2,
    "Could we each pay half?", "각자 절반씩 낼 수 있나요.")
add(67, "We didn't order this.", "저희는 이걸 주문하지 않았어요.", "beginner", 2)
add(67, "This costs more than the price on the menu.", "메뉴 가격보다 비싸게 나왔어요.", "beginner", 1)
add(67, "Can I pay my bill now?", "지금 계산해도 될까요.", "beginner", 1)
add(67, "Can I pay by card?", "카드로 낼 수 있나요.", "beginner", 2,
    "Do you take cards?", "카드 결제가 되나요?")
add(67, "Can I have a receipt, please?", "영수증 주시겠어요.", "beginner", 1,
    "Could I get a receipt, please?", "영수증 주시겠어요.")
add(67, "What's this service charge for?", "이 서비스 요금은 뭔가요.", "intermediate", 2)
add(67, "Is there a fee to sit at the bar?", "바에 앉으면 자릿값이 있나요.", "intermediate", 2)
add(67, "I'll get the next round.", "다음 음료는 제가 살게요.", "intermediate", 3)

# Day 68 golf booking + check-in
add(68, "I'd like a tee time for Saturday.", "토요일 티타임을 예약하고 싶어요.", "beginner", 1)
add(68, "There are four of us.", "저희는 4명이에요.", "beginner", 1,
    "We're a group of four.", "저희는 4명 일행이에요.")
add(68, "What time should we come?", "몇 시까지 와야 하나요.", "beginner", 2)
add(68, "The reservation is under Kim.", "예약은 김 이름으로 되어 있어요.", "beginner", 1,
    "We have a reservation under Kim.", "김 이름으로 예약했어요.")
add(68, "Do you have clubs and shoes to rent?", "빌릴 수 있는 클럽과 신발이 있나요.", "beginner", 2)
add(68, "Is the cart included in the fee?", "카트가 요금에 포함되나요.", "beginner", 1,
    "Does the fee include the cart?", "요금에 카트가 포함되나요.")
add(68, "Where is the driving range?", "연습장이 어디에 있나요.", "beginner", 2)
add(68, "One of us is new. Is that okay?", "저희 중 한 명이 초보인데 괜찮을까요.", "intermediate", 2)
add(68, "Could you email me the booking confirmation?", "예약 확인서를 이메일로 보내 주시겠어요.", "intermediate", 2)
add(68, "How long does a round usually take?", "한 라운드는 보통 얼마나 걸리나요.", "intermediate", 3)

# Day 69 carts + etiquette
add(69, "How does this cart work?", "이 카트는 어떻게 움직이나요.", "beginner", 1)
add(69, "Who's driving the cart?", "카트는 누가 운전하나요.", "beginner", 2)
add(69, "We'll keep the cart on the path.", "카트는 길로만 다닐게요.", "beginner", 2)
add(69, "Whose turn is it now?", "지금 누구 차례인가요.", "beginner", 1)
add(69, "Could you be quiet while I putt?", "퍼트할 때 조용히 해 주시겠어요.", "beginner", 1)
add(69, "I'll fix my ball mark.", "제 볼 마크를 고칠게요.", "beginner", 2)
add(69, "Would you like to play through?", "저희 앞서 먼저 치고 가시겠어요.", "beginner", 1)
add(69, "I can't find my ball. What should I do?", "공을 못 찾겠어요. 어떻게 해야 하나요.", "intermediate", 2)
add(69, "Is the right side out of bounds?", "오른쪽이 OB인가요.", "intermediate", 3)
add(69, "Could you watch my ball for me?", "제 공이 어디로 가는지 봐 주시겠어요.", "intermediate", 3,
    "Please keep an eye on my ball.", "제 공을 잘 봐 주세요.")

# Day 70 pro shop + manners
add(70, "Do you sell gloves here?", "여기서 장갑을 파나요.", "beginner", 1)
add(70, "I'm looking for some used golf balls.", "중고 골프공을 찾고 있어요.", "beginner", 2)
add(70, "Can I try this shirt on?", "이 셔츠를 입어 봐도 될까요.", "beginner", 2,
    "May I try this shirt on?", "이 셔츠를 입어 봐도 될까요.")
add(70, "Can you fix my club today?", "오늘 제 클럽을 고칠 수 있나요.", "beginner", 1,
    "Could you repair my club today?", "오늘 제 클럽을 수리해 주시겠어요.")
add(70, "Are jeans okay here?", "여기서 청바지를 입어도 되나요.", "beginner", 1)
add(70, "Should I take off my hat in here?", "안에서는 모자를 벗어야 하나요.", "beginner", 2)
add(70, "Thanks for the round. I had a good time.", "함께 쳐서 즐거웠어요. 감사합니다.", "beginner", 1)
add(70, "This club feels too long for me.", "이 클럽은 저한테 너무 길어요.", "intermediate", 2)
add(70, "How much should I tip the caddie?", "캐디 팁은 얼마가 적당한가요.", "intermediate", 2)
add(70, "Do you have this in my size?", "이거 제 사이즈로 있나요.", "intermediate", 3)

# Day 71 tax-free + refunds
add(71, "Do you offer tax-free shopping for tourists?", "관광객 면세 쇼핑이 되나요.", "beginner", 1)
add(71, "How much do I need to spend for a tax refund?", "환급받으려면 얼마를 써야 하나요.", "beginner", 2)
add(71, "I need a tax refund form.", "면세 환급 서류가 필요해요.", "beginner", 2)
add(71, "I have my passport with me.", "여권을 가지고 있어요.", "beginner", 1)
add(71, "Where can I get the refund at the airport?", "공항 어디에서 환급받나요.", "beginner", 1)
add(71, "I was charged twice for this.", "이걸 두 번 결제했어요.", "beginner", 2,
    "I was billed twice for this.", "이게 두 번 청구됐어요.")
add(71, "This doesn't work. Can I get a refund?", "이게 작동하지 않아요. 환불받을 수 있나요.", "beginner", 1,
    "This isn't working. Could I have a refund?", "작동이 안 되는데, 환불받을 수 있을까요.")
add(71, "I have the receipt and the box.", "영수증과 상자가 있어요.", "intermediate", 2)
add(71, "I'm looking for a gift for my mom.", "엄마께 드릴 선물을 찾고 있어요.", "intermediate", 2)
add(71, "Could you email me a receipt for the refund?", "환불 영수증을 이메일로 보내 주시겠어요.", "intermediate", 3)

# Day 72 alterations + size exchanges
add(72, "Do you offer free alterations?", "무료 수선해 주나요.", "beginner", 1)
add(72, "These pants are too long.", "이 바지는 너무 길어요.", "beginner", 1)
add(72, "Can I exchange this for a larger size?", "더 큰 사이즈로 교환할 수 있나요.", "beginner", 2,
    "Could I swap this for a bigger size?", "더 큰 사이즈로 바꿀 수 있나요.")
add(72, "I'm looking for the same shirt in blue.", "같은 셔츠 파란색으로 찾고 있어요.", "beginner", 1,
    "Do you have this same shirt in blue?", "이 셔츠 같은 걸로 파란색도 있나요.")
add(72, "The seam came apart after one wash.", "한 번 빨았더니 박음선이 터졌어요.", "beginner", 2)
add(72, "The color faded after one wash.", "한 번 빨았더니 색이 바랬어요.", "beginner", 1)
add(72, "Can I talk to the manager?", "매니저님과 이야기할 수 있을까요.", "beginner", 2)
add(72, "Can I return this if it's on sale?", "세일 상품도 반품되나요.", "intermediate", 2)
add(72, "Do you have this at another store?", "이거 다른 매장에도 있나요.", "intermediate", 2)
add(72, "Can I get store credit instead of a refund?", "환불 대신 매장 적립금으로 받을 수 있나요.", "intermediate", 3)

# Day 73 integrated practice 1
add(73, "I'm in a hurry. Which way is the gate?", "급해요. 탑승구가 어느 쪽인가요.", "beginner", 1)
add(73, "This train is full. I'll take the next one.", "이 열차는 꽉 찼어요. 다음 걸 탈게요.", "beginner", 1)
add(73, "What do you recommend from this menu?", "이 메뉴에서 무엇을 추천하세요.", "beginner", 2)
add(73, "My booking time changed, but no one told me.", "예약 시간이 바뀌었는데, 아무도 알려주지 않았어요.", "beginner", 1)
add(73, "The machine won't scan my passport.", "기계가 제 여권을 인식하지 못해요.", "beginner", 2)
add(73, "My phone died. I can't show my ticket.", "휴대폰이 꺼져서 표를 보여드릴 수 없어요.", "beginner", 1)
add(73, "Could you write down the address for my driver?", "기사님께 드릴 주소를 적어 주시겠어요.", "beginner", 2)
add(73, "My flight was canceled. What should I do?", "제 비행기가 취소됐어요. 어떻게 해야 하나요.", "intermediate", 2)
add(73, "I feel dizzy. Please get help.", "어지러워요. 도움을 요청해 주세요.", "intermediate", 2)
add(73, "Let's deal with one thing at a time.", "한 번에 하나씩 해결해요.", "intermediate", 3)

# Day 74 integrated practice 2
add(74, "I was charged for something I didn't buy.", "사지 않은 게 결제됐어요.", "beginner", 1)
add(74, "My golf shoes are damaged.", "골프화가 망가졌어요.", "beginner", 2)
add(74, "It's too loud here. Can we move somewhere quieter?", "여기가 너무 시끄러워요. 더 조용한 곳으로 옮겨도 될까요.", "beginner", 1)
add(74, "The bus left early. I missed it.", "버스가 일찍 떠나서 놓쳤어요.", "beginner", 1)
add(74, "Do I need to show my return ticket?", "귀국 항공권을 보여드려야 하나요.", "beginner", 2)
add(74, "My card was declined. Can I try another one?", "카드가 거절됐어요. 다른 카드로 해도 될까요.", "beginner", 1)
add(74, "Could you hand me the other club?", "다른 클럽을 건네 주시겠어요.", "beginner", 2)
add(74, "Someone is following me. Please stay with me.", "누가 따라오고 있어요. 곁에 있어 주세요.", "intermediate", 2)
add(74, "There's lightning. Let's stop playing and go inside.", "번개가 쳐요. 그만 치고 안으로 들어가요.", "intermediate", 2)
add(74, "Thanks for all your help today.", "오늘 모든 도움에 감사해요.", "intermediate", 3)

# Day 75 communication repair + help + thanks
add(75, "Could you say that again?", "다시 한 번 말씀해 주시겠어요.", "beginner", 1,
    "Sorry, could you repeat that?", "죄송해요, 다시 말씀해 주시겠어요.")
add(75, "Could you speak more slowly?", "더 천천히 말씀해 주시겠어요.", "beginner", 1,
    "Could you slow down a little, please?", "조금만 천천히 말씀해 주시겠어요.")
add(75, "What does this word mean?", "이 단어는 무슨 뜻인가요.", "beginner", 2,
    "Could you tell me what this word means?", "이 단어가 무슨 뜻인지 알려 주시겠어요.")
add(75, "Do you mean the next bus?", "다음 버스 말씀이신가요.", "beginner", 1,
    "Are you talking about the next bus?", "다음 버스 말씀이세요.")
add(75, "Is that right?", "맞나요.", "beginner", 1)
add(75, "Sorry, I don't understand. Could you explain?", "죄송해요, 이해가 안 돼요. 설명해 주시겠어요.", "beginner", 2)
add(75, "Where can I ask for help?", "어디에서 도움을 요청하나요.", "beginner", 1)
add(75, "I need help with this form.", "이 서류를 작성하는 데 도움이 필요해요.", "intermediate", 2)
add(75, "Thank you for explaining that to me.", "설명해 주셔서 감사해요.", "intermediate", 2,
    "Thanks for explaining that.", "설명해 주셔서 감사해요.")
add(75, "Thanks for checking that for me.", "확인해 주셔서 감사해요.", "intermediate", 3)

TOPICS = {61: "airport-transit-advanced", 62: "airport-transit-advanced",
          63: "urban-transit-advanced", 64: "urban-transit-advanced",
          65: "restaurant-bar-advanced", 66: "restaurant-bar-advanced", 67: "restaurant-bar-advanced",
          68: "golf-course-basics", 69: "golf-course-basics", 70: "golf-course-basics",
          71: "department-store-advanced", 72: "department-store-advanced",
          73: "daily-life-integration", 74: "daily-life-integration", 75: "daily-life-integration"}

DIALOGUES = {
 61: ("airport-transit-advanced", [("traveler", "I might miss my connection. Can you help me change my flight?", "연결편을 놓칠 것 같아요. 비행기 변경을 도와주시겠어요."),
    ("staff", "Sure. I'll check the next flight for you.", "그럼요. 다음 비행기를 알아볼게요."),
    ("traveler", "Will my bag be on that flight too?", "제 가방도 그 비행기에 실리나요."),
    ("staff", "I'll check that too.", "그것도 확인해 볼게요.")]),
 62: ("airport-transit-advanced", [("traveler", "My suitcase didn't arrive. Where do I report it?", "제 여행 가방이 도착하지 않았어요. 어디에 신고하나요."),
    ("staff", "Please fill out this form. Do you have your baggage claim tag?", "이 서류를 작성해 주세요. 수하물 표 있으세요."),
    ("traveler", "Here it is. How long will it take?", "여기 있어요. 얼마나 걸리나요."),
    ("staff", "We'll call you when we find it.", "찾으면 전화드릴게요.")]),
 63: ("urban-transit-advanced", [("traveler", "This fare looks wrong. Could you check it?", "요금이 이상해 보여요. 확인해 주시겠어요."),
    ("staff", "Sure. I'll check the charge for you.", "그럼요. 요금을 확인해 볼게요."),
    ("traveler", "Thank you for checking.", "확인해 주셔서 감사해요.")]),
 64: ("urban-transit-advanced", [("traveler", "I'd like to buy a monthly pass. Is the airport line included?", "정기권을 사고 싶어요. 공항선이 포함되나요."),
    ("staff", "Yes. This pass covers the airport line.", "네. 이 정기권으로 공항선을 탈 수 있어요."),
    ("traveler", "Where can I add money to this card?", "이 카드에 어디서 돈을 넣나요."),
    ("staff", "At the ticket machine over there.", "저기 표 사는 기계에서 돼요.")]),
 65: ("restaurant-bar-advanced", [("traveler", "I have a peanut allergy. Does this food have nuts?", "땅콩 알레르기가 있어요. 이 음식에 견과류가 있나요."),
    ("staff", "I'll check the ingredients with the cook.", "요리사님과 함께 재료를 확인할게요."),
    ("traveler", "Thank you for checking the ingredients.", "재료 확인해 주셔서 감사해요.")]),
 66: ("restaurant-bar-advanced", [("traveler", "Can I try a little first?", "먼저 조금 맛봐도 될까요."),
    ("staff", "Sure. A small taste is okay.", "그럼요. 조금 맛보는 건 괜찮아요."),
    ("traveler", "I like it. One bottle, please.", "맛있네요. 한 병 주세요.")]),
 67: ("restaurant-bar-advanced", [("traveler", "We didn't order this. Could you check the bill?", "저희는 이걸 주문하지 않았어요. 계산서를 확인해 주시겠어요."),
    ("staff", "You're right. I'll fix it now.", "맞으시네요. 지금 바로 고쳐 드릴게요."),
    ("traveler", "Can we split the check in half?", "계산서를 반반으로 나눠 주시겠어요."),
    ("staff", "Of course. Half and half.", "물론이죠. 반반으로 나눠 드릴게요.")]),
 68: ("golf-course-basics", [("traveler", "I'd like a tee time for Saturday. There are four of us.", "토요일 티타임으로 예약하고 싶어요. 저희는 4명이에요."),
    ("staff", "We have a spot at nine. Does that work?", "아홉 시가 비어 있어요. 괜찮으세요."),
    ("traveler", "Nine works for us. Is the cart included?", "아홉 시 좋아요. 카트가 요금에 포함되나요."),
    ("staff", "Yes. The fee includes the cart.", "네. 요금에 카트가 포함돼요.")]),
 69: ("golf-course-basics", [("traveler", "How does this cart work?", "이 카트는 어떻게 움직이나요."),
    ("local", "This is the brake. Please stay on the path.", "이게 브레이크예요. 길로만 다니세요."),
    ("traveler", "Okay. I'll keep the cart on the path.", "알겠어요. 길로만 다닐게요.")]),
 70: ("golf-course-basics", [("traveler", "Do you sell gloves here? I'm looking for some used golf balls.", "여기서 장갑을 파나요. 중고 골프공을 찾고 있어요."),
    ("staff", "Gloves are here. Used balls are by the door.", "장갑은 여기 있어요. 중고공은 입구 쪽에 있어요."),
    ("traveler", "Thanks. May I try this shirt on?", "감사해요. 이 셔츠를 입어 봐도 될까요."),
    ("staff", "The fitting room is over there.", "탈의실은 저쪽이에요.")]),
 71: ("department-store-advanced", [("traveler", "Do you offer tax-free shopping for tourists? I need a tax refund form.", "관광객 면세 쇼핑이 되나요. 환급 서류가 필요해요."),
    ("staff", "Yes. I need your passport for the form.", "네. 서류에는 여권이 필요해요."),
    ("traveler", "Here it is. Where can I get the refund at the airport?", "여기 있어요. 환급은 공항 어디에서 받나요."),
    ("staff", "You can get it at the airport refund desk.", "공항 환급 창구에서 받으세요.")]),
 72: ("department-store-advanced", [("traveler", "These pants are too long.", "이 바지는 너무 길어요."),
    ("staff", "We can shorten them for you.", "줄여 드릴 수 있어요."),
    ("traveler", "Great. How long will it take?", "좋아요. 얼마나 걸리나요.")]),
 73: ("daily-life-integration", [("traveler", "My phone died. I can't show my ticket.", "휴대폰이 꺼져서 표를 보여드릴 수 없어요."),
    ("staff", "That's okay. Can you tell me your booking number?", "괜찮아요. 예약 번호를 알려 주시겠어요."),
    ("traveler", "Yes. Here it is.", "네. 여기 있어요."),
    ("staff", "Found it. Here's your gate information.", "찾았어요. 탑승구 안내예요.")]),
 74: ("daily-life-integration", [("traveler", "There's lightning. Let's stop playing and go inside.", "번개가 쳐요. 그만 치고 안으로 들어가요."),
    ("local", "Good idea. Let's head to the clubhouse.", "좋은 생각이에요. 클럽하우스로 가요."),
    ("traveler", "Okay. Let's go.", "좋아요. 가요.")]),
 75: ("daily-life-integration", [("traveler", "Could you say that again? I don't understand.", "다시 한 번 말씀해 주시겠어요. 이해가 안 돼요."),
    ("local", "Of course. The next bus leaves at ten.", "물론이죠. 다음 버스는 10시에 출발해요."),
    ("traveler", "Do you mean the next bus? Is that right?", "다음 버스 말씀이신가요. 맞나요."),
    ("local", "Yes. That's right.", "네, 맞아요.")]),
}

def ts_entry(day, n, en, ko, lv, pr, aen, ako):
    lines = []
    lines.append("  {")
    lines.append(f'    "id": "day-{day:02d}-{n:02d}",')
    lines.append(f'    "english": {json.dumps(en, ensure_ascii=False)},')
    lines.append(f'    "korean": {json.dumps(ko, ensure_ascii=False)},')
    lines.append(f'    "day": {day},')
    lines.append('    "source": "builtIn",')
    lines.append(f'    "topic": "{TOPICS[day]}",')
    lines.append(f'    "level": "{lv}",')
    lines.append(f'    "priority": {pr}')
    if aen:
        lines[-1] = f'    "priority": {pr},'
        lines.append('    "alternatives": [')
        lines.append('      {')
        lines.append(f'        "english": {json.dumps(aen, ensure_ascii=False)},')
        lines.append(f'        "korean": {json.dumps(ako, ensure_ascii=False)}')
        lines.append('      }')
        lines.append('    ]')
    lines.append("  }")
    return "\n".join(lines)

def main():
    assert len(S) == 150, f"need 150, got {len(S)}"
    by_day = {}
    for (day, en, ko, lv, pr, aen, ako) in S:
        by_day.setdefault(day, []).append((en, ko, lv, pr, aen, ako))
    for day in range(61, 76):
        assert len(by_day.get(day, [])) == 10, f"day {day}: {len(by_day.get(day, []))}"
        lvls = [lv for (en, ko, lv, pr, aen, ako) in by_day[day]]
        assert set(lvls) <= {"beginner", "intermediate"}, f"day {day}: {set(lvls)}"
        assert sum(1 for lv in lvls if lv == "beginner") >= 6, f"day {day} beginners"
    with_alt = sum(1 for (day, en, ko, lv, pr, aen, ako) in S if aen)
    assert with_alt >= 20, f"alternatives: {with_alt}"
    bad = []
    for (day, en, ko, lv, pr, aen, ako) in S:
        for t in [en, aen]:
            if not t:
                continue
            if re.search(r"[가-힣]", t):
                bad.append(("KO-in-EN", t))
            if re.search(r"[\[\]()/]", t):
                bad.append(("BRK-in-EN", t))
        for t in [ko, ako]:
            if not t:
                continue
            if re.search(r"[\[\]()/]", t):
                bad.append(("BRK-in-KO", t))
        for t in [en.lower(), ko, (aen or "").lower(), (ako or "")]:
            for w in BANNED:
                if w in t:
                    bad.append(("BANNED", w, en))
        n = len(en.split())
        if (lv == "beginner" and n > 12) or (lv == "intermediate" and n > 18):
            bad.append(("TOO-LONG", en))
        if aen and len(aen.split()) > 14:
            bad.append(("ALT-LONG", aen))
    if bad:
        for b in bad:
            print("BAD:", b)
        sys.exit(1)
    # sentences: keep first60 byte-exact, rebuild day>=61
    sp = io.open(ROOT / "src" / "sentences.ts", encoding="utf-8").read()
    m61 = re.search(r'\n  \{\n    "id": "day-61-01",', sp)
    assert m61, "day-61-01 marker missing"
    first60 = sp[: m61.start() + 1]
    assert hashlib.sha256(first60.encode("utf-8")).hexdigest() == EXPECTED_SENTENCES_FIRST60_SHA, "first60 sentences slice changed!"
    existing_en = set(re.findall(r'"english": "(.*?)"', first60))
    dups = []
    for (day, en, ko, lv, pr, aen, ako) in S:
        if en in existing_en:
            dups.append(en)
    if dups:
        print("DUP-REPORT (intentional repeats of learned chunks allowed, IDs stay unique):")
        for d in dups:
            print(f"  DUP-EN: {d}")
    parts = []
    for day in range(61, 76):
        for n, (en, ko, lv, pr, aen, ako) in enumerate(by_day[day], 1):
            parts.append(ts_entry(day, n, en, ko, lv, pr, aen, ako))
    new_sp = first60 + ",\n".join(parts) + "\n]\n"
    # dialogues: keep first60 byte-exact, rebuild day>=61
    dp = io.open(ROOT / "src" / "dialogues.ts", encoding="utf-8").read()
    d61 = re.search(r'\n  \{\n    "day": 61,', dp)
    assert d61, "day 61 dialogue marker missing"
    dfirst60 = dp[: d61.start() + 1]
    assert hashlib.sha256(dfirst60.encode("utf-8")).hexdigest() == EXPECTED_DIALOGUES_FIRST60_SHA, "first60 dialogues slice changed!"
    dparts = []
    for day in range(61, 76):
        topic, turns = DIALOGUES[day]
        assert topic == TOPICS[day]
        assert 2 <= len(turns) <= 4 and any(r == "traveler" for r, _, _ in turns)
        tl = []
        for role, en, ko in turns:
            assert not re.search(r"[가-힣]", en), en
            assert not re.search(r"[\[\]()/]", en), en
            assert not re.search(r"[\[\]()/]", ko), ko
            tl.append('      {\n'
                      f'        "role": "{role}",\n'
                      f'        "english": {json.dumps(en, ensure_ascii=False)},\n'
                      f'        "korean": {json.dumps(ko, ensure_ascii=False)}\n'
                      '      }')
        dparts.append('  {\n'
                      f'    "day": {day},\n'
                      f'    "topic": "{topic}",\n'
                      '    "turns": [\n' + ",\n".join(tl) + '\n    ]\n  }')
    new_dp = dfirst60 + ",\n".join(dparts) + "\n]\n"
    io.open(ROOT / "src" / "sentences.ts", "w", encoding="utf-8", newline="\n").write(new_sp)
    io.open(ROOT / "src" / "dialogues.ts", "w", encoding="utf-8", newline="\n").write(new_dp)
    print(f"OK sentences={len(S)} dialogues={len(DIALOGUES)} alts={with_alt}")
    print("sentences.ts", hashlib.sha256(new_sp.encode("utf-8")).hexdigest())
    print("dialogues.ts", hashlib.sha256(new_dp.encode("utf-8")).hexdigest())

main()
