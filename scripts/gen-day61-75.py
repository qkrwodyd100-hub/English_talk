# -*- coding: utf-8 -*-
"""Generate Day 61-75 practical-pattern sentences + dialogues (CURRICULUM-BEGINNER-1).

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
add(61, "My connecting flight leaves from a different terminal.", "연결편이 다른 터미널에서 출발해요.", "beginner", 1)
add(61, "How much time do I need for the transfer?", "환승하는 데 시간이 얼마나 걸리나요.", "beginner", 1)
add(61, "Where is the transfer counter?", "환승 카운터가 어디에 있나요.", "beginner", 2)
add(61, "Can I walk to the next terminal?", "다음 터미널까지 걸어갈 수 있나요.", "beginner", 1,
    "Is the next terminal close on foot?", "다음 터미널이 걸어갈 만큼 가까운가요.")
add(61, "Could you show me the way to my gate?", "제 탑승구로 가는 길을 알려 주시겠어요.", "beginner", 1,
    "Which way is my gate, please?", "제 탑승구가 어느 쪽인가요.")
add(61, "I might miss my connection. Please help me.", "연결편을 놓칠 것 같아요. 도와주세요.", "beginner", 1)
add(61, "Can I get on the next flight?", "다음 비행기로 갈 수 있나요.", "beginner", 2,
    "Is there a later flight I can take?", "제가 탈 수 있는 더 늦은 비행기가 있나요.")
add(61, "My first flight was delayed, so I may miss my connection.", "첫 비행기가 연착해서 연결편을 놓칠 것 같아요.", "intermediate", 2,
    "My first flight is late. I may miss my next flight.", "첫 비행기가 늦어서 다음 비행기를 놓칠 수 있어요.")
add(61, "Could you put me on the next flight out?", "다음 출발 비행기로 옮겨 주세요.", "intermediate", 2,
    "Is there another flight today?", "오늘 다른 비행기가 있나요.")
add(61, "I missed my connection. Can I get a hotel for tonight?", "연결편을 놓쳤어요. 오늘 밤 묵을 호텔을 받을 수 있나요.", "intermediate", 3,
    "Do you have a hotel room for tonight?", "오늘 밤 쓸 호텔방이 있나요.")

# Day 62 lost baggage + customs
add(62, "My suitcase did not arrive.", "제 여행 가방이 도착하지 않았어요.", "beginner", 1)
add(62, "Where is the lost baggage office?", "수하물 분실물 센터가 어디에 있나요.", "beginner", 1)
add(62, "I'd like to report my missing bag.", "가방 분실을 신고하고 싶어요.", "beginner", 2,
    "Please help me report my missing bag.", "가방 분실 신고를 도와주세요.")
add(62, "My bag is missing. Please help me.", "가방이 없어졌어요. 도와주세요.", "beginner", 1)
add(62, "Can I have a baggage form, please?", "수하물 서류를 받을 수 있을까요.", "beginner", 2)
add(62, "My tag number is on my boarding pass.", "수하물 표 번호가 탑승권에 있어요.", "beginner", 1)
add(62, "How long will it take to find my bag?", "가방을 찾는 데 얼마나 걸리나요.", "beginner", 1,
    "When will I get my bag back?", "가방을 언제 돌려받나요.")
add(62, "I need clean clothes because my bag is missing.", "가방이 없어서 갈아입을 옷이 필요해요.", "intermediate", 2,
    "My bag is gone, so I need a toothbrush too.", "가방이 없어서 칫솔도 필요해요.")
add(62, "I have something to declare. Where do I go?", "신고할 물건이 있어요. 어디로 가나요.", "intermediate", 2,
    "Where do I show the things I declare?", "신고 물품은 어디에서 보여주나요.")
add(62, "Is this under the duty free limit?", "이게 면세 한도 이내인가요.", "intermediate", 3,
    "All of this is for me, not for sale.", "이건 다 제가 쓸 거고 팔 거 아니에요.")

# Day 63 ride-share + delays
add(63, "My driver cancelled the ride.", "기사님이 운행을 취소했어요.", "beginner", 1)
add(63, "I left my phone in the car.", "차 안에 휴대폰을 두고 내렸어요.", "beginner", 1)
add(63, "The fare is wrong. Can you check it?", "요금이 잘못됐어요. 확인해 주시겠어요.", "beginner", 2,
    "I paid too much for this ride.", "이번 운행에 돈을 너무 많이 냈어요.")
add(63, "Please give me back the extra charge.", "추가 요금을 돌려주세요.", "beginner", 1,
    "I want a refund for the extra money.", "추가 금액을 환불받고 싶어요.")
add(63, "The pickup place on the map is wrong.", "지도상 탑승 위치가 잘못됐어요.", "beginner", 2)
add(63, "My train is 40 minutes late.", "제 기차가 40분 늦었어요.", "beginner", 1)
add(63, "I need a paper that shows the delay.", "지연을 보여주는 서류가 필요해요.", "beginner", 1,
    "I need it for my office.", "회사에 제출해야 해요.")
add(63, "The driver took a much longer road.", "기사님이 훨씬 돌아서 가셨어요.", "intermediate", 2,
    "We did not go the short way.", "지름길로 안 가셨어요.")
add(63, "Is there another way because of the strike?", "파업 때문에 다른 길이 있나요.", "intermediate", 2)
add(63, "How long will the delay be?", "얼마나 더 지연될까요.", "intermediate", 3,
    "When will the next train come?", "다음 기차는 언제 오나요.")

# Day 64 passes + late-night return
add(64, "I'd like to buy a monthly pass.", "정기권을 사고 싶어요.", "beginner", 1,
    "I want a one-month pass, please.", "한 달 정기권 하나 주세요.")
add(64, "Is the airport line included in this pass?", "이 정기권에 공항선이 포함되나요.", "beginner", 2,
    "Can I use this pass for the airport train?", "이걸로 공항철도를 탈 수 있나요.")
add(64, "Where can I charge my travel card?", "교통카드를 어디에서 충전하나요.", "beginner", 1,
    "Where do I put money on this card?", "이 카드에 어디서 돈을 넣나요.")
add(64, "My card did not work at the gate.", "제 카드가 개찰구에서 인식되지 않았어요.", "beginner", 2)
add(64, "What time is the last train to the airport?", "공항행 막차가 몇 시인가요.", "beginner", 1)
add(64, "I need a taxi for tonight.", "오늘 밤 탈 택시가 필요해요.", "beginner", 1,
    "Can you call a taxi for me?", "택시를 불러 주시겠어요.")
add(64, "Please stop under that streetlight.", "저 가로등 밑에 세워 주세요.", "beginner", 2,
    "Please let me out over there.", "저기서 내려 주세요.")
add(64, "Which areas does this pass cover?", "이 정기권은 어느 구간까지 되나요.", "intermediate", 2,
    "Can I use it in every area?", "모든 구간에서 쓸 수 있나요.")
add(64, "My ticket was old, so I paid a fine.", "표가 오래돼서 벌금을 냈어요.", "intermediate", 3,
    "My ticket was out of date, so I paid a fine.", "표의 유효기간이 지나서 벌금을 냈어요.")
add(64, "Is it safe to walk home from here at night?", "밤에 여기서 걸어 귀가해도 안전한가요.", "intermediate", 3)

# Day 65 allergies
add(65, "I have a peanut allergy.", "저는 땅콩 알레르기가 있어요.", "beginner", 1)
add(65, "Does this food have nuts in it?", "이 음식에 견과류가 있나요.", "beginner", 1,
    "Are there nuts in this?", "이 안에 견과류가 있나요.")
add(65, "Could you leave out the shrimp?", "새우는 빼 주시겠어요.", "beginner", 2,
    "No shrimp in my food, please.", "제 음식에 새우는 빼 주세요.")
add(65, "Do you have a menu without gluten?", "글루텐 없는 메뉴가 있나요.", "beginner", 2,
    "I need food with no gluten.", "글루텐 없는 음식이 필요해요.")
add(65, "I feel sick. Please call for help.", "몸이 안 좋아요. 도움을 요청해 주세요.", "beginner", 1,
    "Please get help now.", "지금 당장 도움을 요청해 주세요.")
add(65, "I have my allergy pen with me.", "알레르기 응급펜을 가지고 있어요.", "beginner", 1)
add(65, "Can the cook check the sauce for me?", "요리사님이 소스를 확인해 주실 수 있나요.", "beginner", 2,
    "What is in this sauce?", "이 소스에 뭐가 들어가나요.")
add(65, "Can the kitchen keep nuts away from my food?", "주방에서 제 음식에 견과류가 안 들어가게 해 주실 수 있나요.", "intermediate", 2)
add(65, "I will have fish and plain rice.", "생선구이와 흰쌀밥으로 주세요.", "intermediate", 2,
    "Just fish and rice for me, please.", "저는 생선과 밥만 주세요.")
add(65, "Thank you for checking my food with care.", "음식을 꼼꼼히 확인해 주셔서 감사해요.", "intermediate", 3,
    "Thanks for keeping my food safe.", "음식을 안전하게 챙겨주셔서 감사해요.")

# Day 66 drink ordering
add(66, "Do you have a wine list?", "와인 리스트가 있나요.", "beginner", 1,
    "Can I look at the wine list?", "와인 리스트를 봐도 될까요.")
add(66, "I'd like a glass of red wine.", "레드 와인 한 잔 주세요.", "beginner", 1,
    "Red wine, please. Just one glass.", "레드 와인 한 잔만 주세요.")
add(66, "What do you recommend with steak?", "스테이크에는 무엇을 추천하세요.", "beginner", 2)
add(66, "Is this wine sweet or dry?", "이 와인은 달콤한가요, 드라이한가요.", "beginner", 1,
    "Is it sweet?", "달콤한가요.")
add(66, "Can I try a little first?", "먼저 조금 맛봐도 될까요.", "beginner", 2,
    "Just a small taste, please.", "조금만 맛보게 해 주세요.")
add(66, "Can we share one bottle?", "한 병을 나눠 마셔도 될까요.", "beginner", 1,
    "One bottle for the table, please.", "테이블에 한 병 주세요.")
add(66, "This wine tastes bad. Can I change it?", "이 와인에서 이상한 맛이 나요. 바꿀 수 있나요.", "beginner", 1,
    "Something is wrong with this bottle.", "이 병에 문제가 있어요.")
add(66, "Which year is this wine?", "이 와인은 몇 년산인가요.", "intermediate", 2,
    "Is this the year on the menu?", "메뉴에 적힌 연도가 맞나요.")
add(66, "Do you have white wine by the glass?", "화이트 와인을 잔으로도 파나요.", "intermediate", 2,
    "Can I get white wine in a glass?", "화이트 와인을 한 잔만 받을 수 있나요.")
add(66, "Please keep the change.", "잔돈은 가지세요.", "intermediate", 3,
    "The rest is for you.", "나머지는 가지세요.")

# Day 67 bill + simple bar
add(67, "Could we have the bill, please?", "계산서 주시겠어요.", "beginner", 1)
add(67, "Can we split the bill in half?", "계산서를 반반으로 나눠 주시겠어요.", "beginner", 2,
    "Can we each pay half?", "각자 절반씩 낼 수 있나요.")
add(67, "This one is not ours.", "이건 저희가 주문한 게 아니에요.", "beginner", 2,
    "We did not order this.", "저희는 이걸 주문하지 않았어요.")
add(67, "The menu says a lower price.", "메뉴에는 더 싼 가격으로 적혀 있어요.", "beginner", 1,
    "The price on the bill is wrong.", "계산서 가격이 틀렸어요.")
add(67, "Can I pay my bill now?", "지금 계산해도 될까요.", "beginner", 1,
    "I am ready to pay.", "계산할게요.")
add(67, "Can I pay by card?", "카드로 낼 수 있나요.", "beginner", 2,
    "Do you take cards here?", "여기서 카드 되나요.")
add(67, "Can I have a receipt, please?", "영수증 주시겠어요.", "beginner", 1)
add(67, "The service charge is new to me. What is it for?", "서비스 요금이 처음 보는데, 뭔가요.", "intermediate", 2,
    "Why is there a service charge?", "서비스 요금은 왜 붙었나요.")
add(67, "Is there a fee to sit at the bar?", "바에 앉으면 자릿값이 있나요.", "intermediate", 2,
    "Do bar seats cost more?", "바 좌석이 더 비싼가요.")
add(67, "I will get the next drinks for us.", "다음 음료는 제가 살게요.", "intermediate", 3,
    "Let me buy the next ones.", "다음 건 제가 살게요.")

# Day 68 golf booking + check-in
add(68, "I'd like a tee time for Saturday.", "토요일 티타임을 예약하고 싶어요.", "beginner", 1)
add(68, "We are four people.", "저희는 4명이에요.", "beginner", 1,
    "Four players in our group.", "저희 일행은 4명이에요.")
add(68, "What time should we come?", "몇 시까지 와야 하나요.", "beginner", 2,
    "When should we check in?", "체크인은 언제 해야 하나요.")
add(68, "Our booking is under Kim.", "예약은 김 이름으로 되어 있어요.", "beginner", 1,
    "I booked as Kim for four.", "김으로 4명 예약했어요.")
add(68, "Do you have clubs and shoes to rent?", "빌릴 수 있는 클럽과 신발이 있나요.", "beginner", 2,
    "Can we rent clubs here?", "여기서 클럽을 빌릴 수 있나요.")
add(68, "Is the cart included in the fee?", "카트가 요금에 포함되나요.", "beginner", 1,
    "Does the fee cover the cart?", "요금에 카트가 포함되나요.")
add(68, "Where is the driving range?", "연습장이 어디에 있나요.", "beginner", 2)
add(68, "One of us is new. Is that okay?", "저희 중 한 명이 초보인데 괜찮을까요.", "intermediate", 2,
    "We have a beginner with us.", "저희와 함께 초보가 있어요.")
add(68, "Can you send the booking to my email?", "예약 내용을 제 이메일로 보내 주시겠어요.", "intermediate", 2,
    "Please email me the booking.", "예약 내용을 이메일로 보내 주세요.")
add(68, "How long does one round take?", "한 라운드에 얼마나 걸리나요.", "intermediate", 3,
    "When will we finish the game?", "경기가 언제 끝나나요.")

# Day 69 carts + etiquette
add(69, "How does this cart work?", "이 카트는 어떻게 움직이나요.", "beginner", 1,
    "Can you show me the cart?", "카트 사용법을 보여 주시겠어요.")
add(69, "Who will drive our cart?", "저희 카트는 누가 몰하나요.", "beginner", 2)
add(69, "We will stay on the path.", "길로만 다닐게요.", "beginner", 2)
add(69, "Whose turn is it now?", "지금 누구 차례인가요.", "beginner", 1)
add(69, "Please stay quiet for my putt.", "제 퍼트 때는 조용히 해 주세요.", "beginner", 1,
    "Quiet, please. I am putting.", "조용히 해 주세요. 퍼트 중이에요.")
add(69, "I will fix my mark on the green.", "그린의 제 볼 마크를 고칠게요.", "beginner", 2,
    "I will fix the green after me.", "그린을 고르고 갈게요.")
add(69, "You can go first. We are slow.", "먼저 가세요. 저희가 느려요.", "beginner", 1,
    "Please play through. We are slow.", "먼저 치고 가세요. 저희가 느려요.")
add(69, "My ball is lost. What do I do now?", "공을 잃어버렸어요. 이제 어떻게 하나요.", "intermediate", 2,
    "I cannot find my ball. Can I use a new one?", "공을 못 찾겠어요. 새 공을 써도 되나요.")
add(69, "Is the right side out of bounds?", "오른쪽이 OB인가요.", "intermediate", 3,
    "Is it OB on the right here?", "여기서 오른쪽은 OB인가요.")
add(69, "Could you watch my ball for me?", "제 공이 어디로 가는지 봐 주시겠어요.", "intermediate", 3,
    "Please watch where my ball goes.", "제 공이 어디로 가는지 봐 주세요.")

# Day 70 pro shop + manners
add(70, "Do you sell gloves here?", "여기서 장갑을 파나요.", "beginner", 1,
    "Where are the golf gloves?", "골프 장갑은 어디에 있나요.")
add(70, "I'm looking for cheap used balls.", "싸게 중고공을 찾고 있어요.", "beginner", 2,
    "I want a dozen used balls.", "중고공 한 더즌 주세요.")
add(70, "Can I try this shirt on?", "이 셔츠를 입어 봐도 될까요.", "beginner", 2,
    "Where can I try this on?", "어디서 입어 볼 수 있나요.")
add(70, "Can you fix clubs here today?", "여기서 오늘 클럽을 고칠 수 있나요.", "beginner", 1,
    "Do you fix clubs here?", "여기서 클럽 수리하나요.")
add(70, "Are jeans okay here?", "여기서 청바지를 입어도 되나요.", "beginner", 1,
    "Can I wear jeans today?", "오늘 청바지를 입어도 될까요.")
add(70, "Should I take off my hat in here?", "안에서는 모자를 벗어야 하나요.", "beginner", 2,
    "Is my hat okay inside?", "안에서 모자를 써도 되나요.")
add(70, "Thank you for a fun game today.", "오늘 즐거운 경기 감사합니다.", "beginner", 1,
    "Today was fun. Thank you.", "오늘 즐거웠어요. 감사합니다.")
add(70, "This club feels too long for me.", "이 클럽은 저한테 너무 길어요.", "intermediate", 2,
    "Can you make this club shorter?", "이 클럽을 짧게 조정해 주시겠어요.")
add(70, "How much should I tip the caddie?", "캐디 팁은 얼마가 적당한가요.", "intermediate", 2,
    "Is a cash tip okay for the caddie?", "캐디에게 현금 팁을 줘도 되나요.")
add(70, "Do you have this in my size?", "이거 제 사이즈로 있나요.", "intermediate", 3,
    "Can I get a smaller size?", "더 작은 사이즈로 받을 수 있나요.")

# Day 71 tax-free + refunds
add(71, "Is this store tax free?", "이 매장은 면세가 되나요.", "beginner", 1,
    "Can tourists shop tax free here?", "관광객은 여기서 면세로 살 수 있나요.")
add(71, "How much should I buy for a refund?", "환급받으려면 얼마를 사야 하나요.", "beginner", 2,
    "What is the lowest price for a refund?", "환급 최저 금액이 얼마인가요.")
add(71, "I need a tax refund form.", "면세 환급 서류가 필요해요.", "beginner", 2,
    "Can I have a refund form, please?", "환급 서류를 받을 수 있을까요.")
add(71, "I have my passport with me.", "여권을 가지고 있어요.", "beginner", 1,
    "Here is my passport.", "여기 제 여권이 있어요.")
add(71, "Where can I get the refund at the airport?", "공항 어디에서 환급받나요.", "beginner", 1,
    "Where is the refund desk?", "환급 창구가 어디에 있나요.")
add(71, "I paid twice for this.", "이걸 두 번 결제했어요.", "beginner", 2,
    "My card shows two charges.", "카드에 두 번 청구됐어요.")
add(71, "This does not work. Can I get a refund?", "이게 작동하지 않아요. 환불받을 수 있나요.", "beginner", 1,
    "It is broken. I want my money back.", "고장 났어요. 돈을 돌려받고 싶어요.")
add(71, "I have the receipt and the box.", "영수증과 상자가 있어요.", "intermediate", 2,
    "Here is the receipt with the box.", "상자와 함께 영수증이 있어요.")
add(71, "I'm looking for a gift for my mom.", "엄마께 드릴 선물을 찾고 있어요.", "intermediate", 2,
    "Do you have gifts under fifty dollars?", "50달러 이하 선물이 있나요.")
add(71, "Can you send the refund paper by email?", "환불 서류를 이메일로 보내 주시겠어요.", "intermediate", 3,
    "Please email me the refund paper.", "환불 서류를 이메일로 보내 주세요.")

# Day 72 alterations + size exchanges
add(72, "Do you fix clothes for free?", "옷 수선을 무료로 해 주나요.", "beginner", 1,
    "Is fixing free here?", "여기서 수선이 무료인가요.")
add(72, "These pants are too long.", "이 바지는 너무 길어요.", "beginner", 1,
    "I need shorter pants.", "더 짧은 바지가 필요해요.")
add(72, "Can I change this for a bigger size?", "더 큰 사이즈로 교환할 수 있나요.", "beginner", 2,
    "I need a larger size.", "더 큰 사이즈가 필요해요.")
add(72, "I'm looking for the same shirt in blue.", "같은 셔츠 파란색으로 찾고 있어요.", "beginner", 1,
    "Do you have this shirt in blue?", "이 셔츠 파란색도 있나요.")
add(72, "The seam is open after one wash.", "한 번 빨았더니 박음선이 터졌어요.", "beginner", 2,
    "It broke after one wash.", "한 번 빨았더니 망가졌어요.")
add(72, "The color ran after one wash.", "한 번 빨았더니 물이 빠졌어요.", "beginner", 1,
    "It lost color in the wash.", "세탁했더니 탈색됐어요.")
add(72, "Can I talk to the manager?", "매니저님과 이야기할 수 있을까요.", "beginner", 2,
    "Is the manager here today?", "오늘 매니저님이 계신가요.")
add(72, "Sale goods have their own return rule.", "세일 상품은 반품 규정이 따로 있어요.", "intermediate", 2,
    "Can I return sale goods too?", "세일 상품도 반품되나요.")
add(72, "Do you have this at another store?", "이거 다른 매장에도 있나요.", "intermediate", 2,
    "Can you check another store for me?", "다른 매장에 있는지 확인해 주시겠어요.")
add(72, "Can I take store credit, not cash?", "현금 말고 매장 적립금으로 받을 수 있나요.", "intermediate", 3,
    "Store credit is fine for me.", "매장 적립금으로 받아도 돼요.")

# Day 73 integrated practice 1
add(73, "My time is short. Please show me the fast lane.", "시간이 촉박해요. 빠른 통로로 안내해 주세요.", "beginner", 1,
    "I am in a hurry. Which way is fast?", "급해요. 빠른 길이 어디인가요.")
add(73, "This train is full. I will take the next one.", "이 열차는 꽉 찼어요. 다음 걸 탈게요.", "beginner", 1,
    "Too many people. I will wait.", "사람이 너무 많아요. 기다릴게요.")
add(73, "No pictures here. What do you recommend?", "사진이 없네요. 무엇을 추천하세요.", "beginner", 2,
    "What is good today?", "오늘 뭐가 맛있나요.")
add(73, "My booking time changed. I did not know.", "예약 시간이 바뀌었어요. 몰랐어요.", "beginner", 1,
    "Nobody told me about the change.", "변경을 아무도 알려주지 않았어요.")
add(73, "The machine did not take my passport.", "기계가 제 여권을 인식하지 못했어요.", "beginner", 2,
    "My passport did not work here.", "여기서 제 여권이 안 됐어요.")
add(73, "I need help. My phone is dead.", "도움이 필요해요. 휴대폰이 꺼졌어요.", "beginner", 1,
    "I cannot show my ticket. My phone died.", "표를 보여드릴 수 없어요. 휴대폰이 꺼졌어요.")
add(73, "Can you write the address for my driver?", "기사님께 드릴 주소를 적어 주시겠어요.", "beginner", 2,
    "Please write it down for me.", "저를 위해 적어 주세요.")
add(73, "All flights are stopped. What should I do?", "모든 비행기가 멈췄어요. 어떻게 해야 하나요.", "intermediate", 2,
    "No flights now. Can you help me?", "지금 비행기가 없어요. 도와주시겠어요.")
add(73, "I feel dizzy. Please get help.", "어지러워요. 도움을 요청해 주세요.", "intermediate", 2,
    "Please call the staff for me.", "직원을 불러 주세요.")
add(73, "Let's fix one thing at a time.", "한 번에 하나씩 해결해요.", "intermediate", 3,
    "One by one, please.", "하나씩 해요.")

# Day 74 integrated practice 2
add(74, "The machine charged me for another bag.", "기계가 다른 가방 값을 제게 청구했어요.", "beginner", 1,
    "I paid for a bag that is not mine.", "제 것이 아닌 가방 값을 냈어요.")
add(74, "My golf shoes broke today.", "골프화가 오늘 망가졌어요.", "beginner", 2,
    "They broke on the first day.", "첫날에 망가졌어요.")
add(74, "Can we move? It is too loud here.", "옮겨도 될까요. 여기가 너무 시끄러워요.", "beginner", 1,
    "Can we sit in a quiet place?", "조용한 곳에 앉을 수 있나요.")
add(74, "The bus left early. I missed it.", "버스가 일찍 떠나서 놓쳤어요.", "beginner", 1,
    "The bus is gone. When is the next one?", "버스가 떠났어요. 다음 차는 언제인가요.")
add(74, "They asked for my return ticket.", "귀국 항공권을 요구했어요.", "beginner", 2,
    "Immigration wants to see my ticket.", "입국 심사에서 표를 보고 싶어 해요.")
add(74, "My card did not work, but I have money.", "카드가 안 됐어요. 잔액은 있어요.", "beginner", 1,
    "Why is my card not working?", "제 카드가 왜 안 되나요.")
add(74, "The club is wrong again. Can you change it?", "클럽이 또 잘못됐어요. 바꿔 주시겠어요.", "beginner", 2,
    "This is the wrong club for me.", "이건 제 클럽이 아니에요.")
add(74, "Someone is behind me. Please stay with me.", "누가 뒤따라와요. 곁에 있어 주세요.", "intermediate", 2,
    "Please help me. Someone is following me.", "도와주세요. 누가 따라오고 있어요.")
add(74, "Can we stop the game? Lightning is near.", "경기를 중단해도 될까요. 번개가 가까워요.", "intermediate", 2,
    "Is it safe to keep playing now?", "지금 계속 쳐도 안전한가요.")
add(74, "Thank you for staying with me today.", "오늘 함께 있어 주셔서 감사해요.", "intermediate", 3,
    "Thanks for all your help today.", "오늘 모든 도움에 감사해요.")

# Day 75 communication repair + help + thanks
add(75, "Could you say that again?", "다시 한 번 말씀해 주시겠어요.", "beginner", 1,
    "Sorry, one more time, please.", "죄송해요, 한 번만 더 말씀해 주세요.")
add(75, "Could you speak more slowly?", "더 천천히 말씀해 주시겠어요.", "beginner", 1,
    "Slowly, please.", "천천히 부탁드려요.")
add(75, "What does this word mean?", "이 단어는 무슨 뜻인가요.", "beginner", 2,
    "Can you explain this word?", "이 단어를 설명해 주시겠어요.")
add(75, "Do you mean the next bus?", "다음 버스 말씀이신가요.", "beginner", 1,
    "The next bus, right?", "다음 버스 맞죠.")
add(75, "Is that right?", "맞나요.", "beginner", 1,
    "Did I say it right?", "제가 맞게 말했나요.")
add(75, "Sorry, I don't understand. Please help me.", "죄송해요, 이해가 안 돼요. 도와주세요.", "beginner", 2,
    "I am lost. Can you help me?", "헷갈려요. 도와주시겠어요.")
add(75, "Where can I ask for help?", "어디에서 도움을 요청하나요.", "beginner", 1,
    "Can I ask for help here?", "여기서 도움을 요청해도 될까요.")
add(75, "I need help with this form.", "이 서류를 작성하는 데 도움이 필요해요.", "intermediate", 2,
    "Can you help me fill this out?", "이거 작성하는 걸 도와주시겠어요.")
add(75, "Thank you for explaining that to me.", "설명해 주셔서 감사해요.", "intermediate", 2,
    "Now I understand. Thank you.", "이제 알겠어요. 감사해요.")
add(75, "Thanks for checking. See you next time.", "확인해 주셔서 감사해요. 다음에 봐요.", "intermediate", 3,
    "Thank you for your help today.", "오늘 도와주셔서 감사해요.")

TOPICS = {61: "airport-transit-advanced", 62: "airport-transit-advanced",
          63: "urban-transit-advanced", 64: "urban-transit-advanced",
          65: "restaurant-bar-advanced", 66: "restaurant-bar-advanced", 67: "restaurant-bar-advanced",
          68: "golf-course-basics", 69: "golf-course-basics", 70: "golf-course-basics",
          71: "department-store-advanced", 72: "department-store-advanced",
          73: "daily-life-integration", 74: "daily-life-integration", 75: "daily-life-integration"}

DIALOGUES = {
 61: ("airport-transit-advanced", [("traveler", "I might miss my connection. Can I get on the next flight?", "연결편을 놓칠 것 같아요. 다음 비행기로 갈 수 있나요."),
    ("staff", "Yes. I will put you on the next flight out.", "네. 다음 출발 비행기로 옮겨 드릴게요."),
    ("traveler", "Will my bag go to the next flight too?", "제 가방도 다음 비행기로 가나요."),
    ("staff", "Yes. Your bag will follow you.", "네. 가방도 함께 갈 거예요.")]),
 62: ("airport-transit-advanced", [("traveler", "My suitcase did not arrive. Where do I report it?", "제 여행 가방이 도착하지 않았어요. 어디에 신고하나요."),
    ("staff", "Please fill out this form with your tag number.", "표 번호와 함께 이 서류를 작성해 주세요."),
    ("traveler", "How long will it take to find my bag?", "가방을 찾는 데 얼마나 걸리나요."),
    ("staff", "About three days. We will call you.", "3일쯤 걸려요. 찾으면 전화드릴게요.")]),
 63: ("urban-transit-advanced", [("traveler", "The fare is wrong. Can you check it?", "요금이 잘못됐어요. 확인해 주시겠어요."),
    ("staff", "I see the extra charge. I will give it back.", "추가 요금이 보이네요. 돌려드릴게요."),
    ("traveler", "Thank you for the quick refund.", "빨리 환불해 주셔서 감사해요.")]),
 64: ("urban-transit-advanced", [("traveler", "I'd like to buy a monthly pass. Is the airport line included?", "정기권을 사고 싶어요. 공항선이 포함되나요."),
    ("staff", "Yes. This pass covers the airport line.", "네. 이 정기권으로 공항선을 탈 수 있어요."),
    ("traveler", "Where can I charge my card?", "교통카드는 어디에서 충전하나요."),
    ("staff", "At any gate machine.", "어느 개찰구 기기에서나 돼요.")]),
 65: ("restaurant-bar-advanced", [("traveler", "I have a peanut allergy. Does this food have nuts?", "땅콩 알레르기가 있어요. 이 음식에 견과류가 있나요."),
    ("staff", "I will check with the cook now.", "요리사님께 바로 확인해 드릴게요."),
    ("traveler", "Thank you for checking with care.", "꼼꼼히 확인해 주셔서 감사해요.")]),
 66: ("restaurant-bar-advanced", [("traveler", "Can I try a little first?", "먼저 조금 맛봐도 될까요."),
    ("staff", "Of course. Here is a small taste.", "물론이죠. 여기 조금 드릴게요."),
    ("traveler", "I like it. One bottle, please.", "맛있네요. 한 병 주세요.")]),
 67: ("restaurant-bar-advanced", [("traveler", "Could we have the bill? This one is not ours.", "계산서 주시겠어요. 이건 저희가 주문한 게 아니에요."),
    ("staff", "You are right. I will fix it now.", "맞으시네요. 지금 바로 고쳐 드릴게요."),
    ("traveler", "Can we split the new bill in half?", "고친 계산서를 반반으로 나눠 주시겠어요."),
    ("staff", "Of course. Half and half.", "물론이죠. 반반으로 나눠 드릴게요.")]),
 68: ("golf-course-basics", [("traveler", "I'd like a tee time for Saturday. We are four people.", "토요일 티타임으로 예약하고 싶어요. 저희는 4명이에요."),
    ("staff", "Morning is open. What time will you come?", "오전이 비어 있어요. 몇 시에 오시겠어요."),
    ("traveler", "We will come early. Is the cart included?", "일찍 갈게요. 카트가 요금에 포함되나요."),
    ("staff", "Yes, it is included. See you Saturday.", "네, 포함돼요. 토요일에 봐요.")]),
 69: ("golf-course-basics", [("traveler", "How does this cart work?", "이 카트는 어떻게 움직이나요."),
    ("local", "This is the brake. Please stay on the path.", "이게 브레이크예요. 길로만 다니세요."),
    ("traveler", "Thank you. I will fix my mark too.", "감사해요. 볼 마크도 고칠게요.")]),
 70: ("golf-course-basics", [("traveler", "Do you sell gloves here? I'm looking for cheap used balls.", "여기서 장갑을 파나요. 싸게 중고공을 찾고 있어요."),
    ("staff", "Gloves are here. Used balls are by the door.", "장갑은 여기 있어요. 중고공은 입구 쪽에 있어요."),
    ("traveler", "Thank you. Can I try this shirt on?", "감사해요. 이 셔츠도 입어 봐도 될까요."),
    ("staff", "The fitting room is over there.", "탈의실은 저쪽이에요.")]),
 71: ("department-store-advanced", [("traveler", "Is this store tax free? I need a tax refund form.", "이 매장은 면세가 되나요. 환급 서류가 필요해요."),
    ("staff", "Yes. I need your passport for the form.", "네. 서류에는 여권이 필요해요."),
    ("traveler", "Here it is. Where can I get the refund?", "여기 있어요. 환급은 공항 어디에서 받나요."),
    ("staff", "At the airport refund desk.", "공항 환급 창구에서 받으세요.")]),
 72: ("department-store-advanced", [("traveler", "These pants are too long. Can I change them?", "이 바지는 너무 길어요. 교환할 수 있나요."),
    ("staff", "Of course. Do you need a larger size?", "물론이죠. 더 큰 사이즈가 필요하세요."),
    ("traveler", "No, the same size. Just shorter, please.", "아니요, 같은 사이즈요. 기장만 짧게 해 주세요.")]),
 73: ("daily-life-integration", [("traveler", "I need help. My phone is dead and my time is short.", "도움이 필요해요. 휴대폰이 꺼졌고 시간도 촉박해요."),
    ("staff", "Stay here. I will show you the fast lane.", "여기 계세요. 빠른 통로로 안내해 드릴게요."),
    ("traveler", "Thank you. One thing at a time.", "감사해요. 하나씩 해결해요.")]),
 74: ("daily-life-integration", [("traveler", "The bus left early and my card did not work.", "버스가 일찍 떠났어요. 카드도 안 됐어요."),
    ("local", "Use my phone. I will stay with you.", "제 휴대폰을 쓰세요. 함께 있어 드릴게요."),
    ("traveler", "Thank you for staying with me.", "함께 있어 주셔서 감사해요.")]),
 75: ("daily-life-integration", [("traveler", "Could you say that again? I don't understand.", "다시 한 번 말씀해 주시겠어요. 이해가 안 돼요."),
    ("local", "Of course. I will speak more slowly.", "물론이죠. 더 천천히 말할게요."),
    ("traveler", "Do you mean the next bus? Is that right?", "다음 버스 말씀이신가요. 맞나요."),
    ("local", "Yes, that's right.", "네, 맞아요.")]),
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
    for (day, en, ko, lv, pr, aen, ako) in S:
        if en in existing_en:
            print(f"DUP-EN: {en}")
            sys.exit(1)
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
    print(f"OK sentences={len(S)} dialogues={len(DIALOGUES)}")
    print("sentences.ts", hashlib.sha256(new_sp.encode("utf-8")).hexdigest())
    print("dialogues.ts", hashlib.sha256(new_dp.encode("utf-8")).hexdigest())

main()
