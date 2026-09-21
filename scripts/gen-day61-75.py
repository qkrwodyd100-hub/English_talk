# -*- coding: utf-8 -*-
"""Generate Day 61-75 sentences + dialogues and splice into sentences.ts / dialogues.ts."""
import io, json, re, sys

R = "C:/Users/gojin/AppData/Local/hermes/hermes-agent/.worktrees/t_a63d5552/_task_work/English_talk"

S = []  # (day, english, korean, level, priority, alt_en, alt_ko)
def add(day, en, ko, lv, pr, aen=None, ako=None):
    S.append((day, en, ko, lv, pr, aen, ako))

# Day 61 airport transit (connecting flights)
add(61, "My connecting flight leaves from a different terminal.", "연결편이 다른 터미널에서 출발해요.", "beginner", 1)
add(61, "How much time do I need for the transfer?", "환승하는 데 시간이 얼마나 걸리나요.", "beginner", 1)
add(61, "Where is the transfer counter?", "환승 카운터가 어디에 있나요.", "beginner", 2)
add(61, "My first flight was delayed and I might miss my connection.", "첫 비행기가 연착해서 연결편을 놓칠 것 같아요.", "intermediate", 2,
    "My inbound flight was late, so I may miss my connection.", "들어오는 비행기가 늦어서 연결편을 놓칠 수 있어요.")
add(61, "Could you rebook me on the next available flight?", "다음 가능한 비행기로 다시 예약해 주시겠어요.", "intermediate", 2,
    "Please put me on the next flight out.", "다음 출발 비행기로 옮겨 주세요.")
add(61, "Will my checked baggage go straight through?", "위탁 수하물이 바로 연결되나요.", "intermediate", 2)
add(61, "I need a hotel voucher because of the missed connection.", "연결편을 놓쳐서 호텔 바우처가 필요해요.", "intermediate", 3,
    "The missed connection was your delay, so I need a hotel for tonight.", "연결편을 놓친 건 지연 때문이니 오늘 밤 호텔이 필요해요.")
add(61, "The airline lost my transfer and I need written proof of the delay.", "항공사 사정으로 환승을 놓쳐서 지연 증명서가 필요해요.", "advanced", 3,
    "Please give me a written statement confirming the delay.", "지연을 확인하는 서면을 발급해 주세요.")
add(61, "Am I entitled to compensation for the overnight delay?", "밤샘 지연에 대해 보상을 받을 수 있나요.", "advanced", 3)
add(61, "Please endorse my ticket so I can fly with another airline.", "다른 항공사 비행기로 갈 수 있게 표를 넘겨 주세요.", "advanced", 3)

# Day 62 lost baggage + customs
add(62, "My suitcase did not arrive.", "제 여행 가방이 도착하지 않았어요.", "beginner", 1)
add(62, "Where is the lost baggage office?", "수하물 분실물 센터가 어디에 있나요.", "beginner", 1)
add(62, "I would like to file a missing baggage report.", "수하물 분실 신고를 하고 싶어요.", "beginner", 2,
    "Please help me report my missing bag.", "가방 분실을 신고하게 도와주세요.")
add(62, "My bag tag number is on my boarding pass.", "수하물 표 번호가 탑승권에 있어요.", "intermediate", 2)
add(62, "How long does tracing usually take?", "수하물 추적에 보통 얼마나 걸리나요.", "intermediate", 2)
add(62, "I need basic necessities because my bag is missing.", "가방이 없어서 기본 생필품이 필요해요.", "intermediate", 2,
    "My luggage is missing, so I need toiletries and a change of clothes.", "짐이 없어서 세면도구와 갈아입을 옷이 필요해요.")
add(62, "I have goods to declare.", "신고할 물품이 있어요.", "intermediate", 3)
add(62, "The total value is under the duty free allowance.", "총액이 면세 한도 이내예요.", "advanced", 3,
    "Everything I bought is within the duty free limit.", "산 물건이 모두 면세 한도 안에 들어요.")
add(62, "Could you show me where the red channel is?", "세관 신고 통로가 어디인지 알려 주시겠어요.", "advanced", 3)
add(62, "I bought this watch abroad and I have the receipt.", "이 시계는 해외에서 샀고 영수증이 있어요.", "advanced", 3)

# Day 63 ride-share disputes + delays
add(63, "My driver cancelled the ride.", "기사님이 운행을 취소했어요.", "beginner", 1)
add(63, "The app charged me a cancellation fee by mistake.", "앱에서 취소 수수료를 잘못 부과했어요.", "beginner", 2,
    "I was wrongly charged for a cancellation.", "취소 요금이 잘못 청구됐어요.")
add(63, "I left my phone in the car.", "차 안에 휴대폰을 두고 내렸어요.", "beginner", 1)
add(63, "The driver took a much longer route.", "기사님이 훨씬 돌아서 가셨어요.", "intermediate", 2)
add(63, "I would like to dispute this fare.", "이 요금에 이의를 제기하고 싶어요.", "intermediate", 2,
    "This fare looks wrong, so I want to challenge it.", "요금이 이상해서 정정을 요청하고 싶어요.")
add(63, "Please refund the surge charge.", "성수기 할증 요금을 환불해 주세요.", "intermediate", 3)
add(63, "The pickup point on the map is wrong.", "지도상 탑승 위치가 잘못 표시됐어요.", "intermediate", 2)
add(63, "My train is delayed by forty minutes.", "제 기차가 40분 연착됐어요.", "advanced", 2)
add(63, "Is there an alternative route because of the strike?", "파업 때문에 다른 경로가 있나요.", "advanced", 3)
add(63, "I need a delay certificate for my employer.", "회사에 낼 연착 증명서가 필요해요.", "advanced", 3,
    "Please issue proof of the delay for work.", "회사 제출용으로 연착 증명을 발급해 주세요.")

# Day 64 passes + late-night return
add(64, "I would like to buy a monthly pass.", "정기권을 사고 싶어요.", "beginner", 1)
add(64, "Which zones does this pass cover?", "이 정기권은 어느 구간까지 되나요.", "beginner", 2)
add(64, "Where can I top up my travel card?", "교통카드를 어디에서 충전하나요.", "beginner", 1)
add(64, "My card did not work at the gate.", "제 카드가 개찰구에서 인식되지 않았어요.", "intermediate", 2)
add(64, "I was fined because my ticket had expired.", "표가 만료돼서 벌금을 물었어요.", "intermediate", 3,
    "My ticket was out of date, so I got a penalty fare.", "표 유효기간이 지나서 과태료를 냈어요.")
add(64, "What is the last train to the airport?", "공항행 막차가 몇 시인가요.", "intermediate", 2)
add(64, "Is it safe to walk home from this station at night?", "밤에 이 역에서 걸어 귀가해도 안전한가요.", "intermediate", 3)
add(64, "Could you call me a licensed night taxi?", "정식 심야 택시를 불러 주시겠어요.", "advanced", 3)
add(64, "Please drop me off under the streetlight over there.", "저기 가로등 밑에 내려 주세요.", "advanced", 3)
add(64, "I will share my live location with my family.", "가족에게 실시간 위치를 공유할게요.", "advanced", 2)

# Day 65 allergies
add(65, "I have a peanut allergy.", "저는 땅콩 알레르기가 있어요.", "beginner", 1)
add(65, "Does this dish contain nuts?", "이 요리에 견과류가 들어가나요.", "beginner", 1,
    "Are there any nuts in this?", "이 음식에 견과류가 있나요.")
add(65, "Could you leave out the shrimp?", "새우는 빼 주시겠어요.", "beginner", 2)
add(65, "I need a gluten free menu.", "글루텐 프리 메뉴가 필요해요.", "intermediate", 2)
add(65, "My throat feels itchy, so please call for help quickly.", "목이 간지러우니 빨리 도움을 요청해 주세요.", "intermediate", 3,
    "I think I am having an allergic reaction, so please act fast.", "알레르기 반응이 온 것 같으니 빨리 조치해 주세요.")
add(65, "Is the kitchen able to avoid cross contact?", "주방에서 혼입을 피할 수 있나요.", "intermediate", 3)
add(65, "I carry an allergy pen in my bag.", "가방에 알레르기 응급펜이 있어요.", "intermediate", 2)
add(65, "Could the chef confirm the ingredients in the sauce?", "셰프님께 소스 재료를 확인해 주시겠어요.", "advanced", 3)
add(65, "I will have the grilled fish with plain rice.", "구운 생선에 흰쌀밥으로 주세요.", "advanced", 2)
add(65, "Thank you for taking my allergy seriously.", "알레르기를 진지하게 받아주셔서 감사합니다.", "advanced", 2)

# Day 66 wine ordering
add(66, "Could I see the wine list?", "와인 리스트를 볼 수 있을까요.", "beginner", 1)
add(66, "I would like a glass of red wine.", "레드 와인 한 잔 주세요.", "beginner", 1)
add(66, "What do you recommend with steak?", "스테이크에는 무엇을 추천하세요.", "beginner", 2)
add(66, "Is this wine dry or sweet?", "이 와인은 드라이한가요, 달콤한가요.", "intermediate", 2)
add(66, "Could I taste it before ordering a bottle?", "한 병 주문 전에 시음할 수 있나요.", "intermediate", 2,
    "May I try a small sip first?", "먼저 조금 맛봐도 될까요.")
add(66, "This bottle tastes corked, so I would like another one.", "이 병은 코르크 맛이 나니 다른 병으로 바꾸고 싶어요.", "intermediate", 3)
add(66, "We will share one bottle for the table.", "테이블에서 한 병을 나눠 마실게요.", "intermediate", 2)
add(66, "Could you decant the wine for us?", "와인을 디캔팅해 주시겠어요.", "advanced", 3)
add(66, "The vintage on the menu is different from this bottle.", "메뉴의 빈티지와 이 병이 달라요.", "advanced", 3,
    "This bottle is a different year from the listed vintage.", "이 병은 적힌 빈티지와 연도가 달라요.")
add(66, "Please keep the change from the wine service.", "와인 서비스 수고비로 잔돈은 가지세요.", "advanced", 3)

# Day 67 bill disputes + bar etiquette
add(67, "Could we have the bill, please?", "계산서 주시겠어요.", "beginner", 1)
add(67, "We would like to split the bill evenly.", "더치페이로 똑같이 나누고 싶어요.", "beginner", 2,
    "Please divide the check equally.", "계산서를 균등하게 나눠 주세요.")
add(67, "This charge is not ours.", "이 금액은 저희 것이 아니에요.", "beginner", 2)
add(67, "The menu price and the bill are different.", "메뉴 가격과 계산서가 달라요.", "intermediate", 2)
add(67, "The service charge was added without telling us.", "서비스 요금이 알리지 않고 추가됐어요.", "intermediate", 3)
add(67, "I paid by card but the receipt shows cash.", "카드로 냈는데 영수증에 현금으로 찍혔어요.", "intermediate", 3,
    "I used my card, yet the receipt says cash.", "카드 결제했는데 영수증에 현금이라고 나와요.")
add(67, "Is there a cover charge for the bar seats?", "바 좌석에 입장료가 있나요.", "intermediate", 2)
add(67, "Could I sit at the bar if a stool opens up?", "바 자리가 나면 앉아도 될까요.", "advanced", 2)
add(67, "I will buy the next round for our group.", "다음 한 순배는 제가 살게요.", "advanced", 2)
add(67, "Please close my tab and give me the receipt.", "제 외상 장부를 마감하고 영수증을 주세요.", "advanced", 3)

# Day 68 golf booking + check-in
add(68, "I would like to book a tee time for Saturday.", "토요일 티타임을 예약하고 싶어요.", "beginner", 1)
add(68, "We are a group of four players.", "저희는 4명 일행이에요.", "beginner", 1)
add(68, "What time should we check in?", "몇 시까지 체크인해야 하나요.", "beginner", 2)
add(68, "Our booking is under the name Kim for four players.", "4명 예약이 김 이름으로 되어 있어요.", "intermediate", 2)
add(68, "Could we rent clubs and shoes?", "클럽과 신발을 빌릴 수 있나요.", "intermediate", 2)
add(68, "Are carts included in the green fee?", "카트비가 그린피에 포함되나요.", "intermediate", 2,
    "Does the green fee cover the cart?", "그린피에 카트가 포함되나요.")
add(68, "Where is the driving range?", "연습장이 어디에 있나요.", "intermediate", 2)
add(68, "Could we start from the back nine today?", "오늘은 백나인부터 시작할 수 있나요.", "advanced", 3)
add(68, "One of our players is a beginner, so please pair us kindly.", "일행 중 한 명이 초보라 배려해 주세요.", "advanced", 3)
add(68, "Please send the confirmation to my email.", "확정 메일을 제 이메일로 보내 주세요.", "advanced", 2)

# Day 69 carts + etiquette
add(69, "Could you show me how this cart works?", "이 카트 사용법을 알려 주시겠어요.", "beginner", 1)
add(69, "Who drives the cart in our group?", "저희 일행에서 누가 카트를 몰아야 하나요.", "beginner", 2)
add(69, "We will keep the cart on the path.", "카트는 길 위에만 두겠습니다.", "beginner", 2)
add(69, "Whose turn is it to play first?", "누가 먼저 치는 순서인가요.", "intermediate", 2)
add(69, "Could you stay quiet while I putt?", "퍼트할 때 조용히 해 주시겠어요.", "intermediate", 2,
    "Please keep still and quiet on the green.", "그린에서는 가만히 조용히 해 주세요.")
add(69, "I will repair my ball mark on the green.", "그린의 볼 마크를 수리할게요.", "intermediate", 2)
add(69, "Let the faster group behind us play through.", "뒤에 빠른 팀을 먼저 보내 드릴게요.", "intermediate", 3)
add(69, "I lost my ball, so I will take a penalty and drop.", "공을 잃어버려서 벌타 받고 드롭할게요.", "advanced", 3)
add(69, "Out of bounds runs along the right side here.", "여기서는 오른쪽이 OB예요.", "advanced", 3,
    "The right side of this hole is out of bounds.", "이 홀 오른쪽은 OB 구역이에요.")
add(69, "Could you watch my ball flight for me?", "제 공 방향을 봐 주시겠어요.", "advanced", 2)

# Day 70 pro shop + manners
add(70, "Do you sell golf gloves here?", "여기서 골프 장갑을 파나요.", "beginner", 1)
add(70, "I am looking for a dozen used balls.", "중고공 한 더즌을 찾고 있어요.", "beginner", 2)
add(70, "Could I try on this polo shirt?", "이 카라티를 입어 봐도 될까요.", "beginner", 2)
add(70, "Do you offer same day club repair?", "당일 클럽 수리가 되나요.", "intermediate", 2)
add(70, "My driver shaft feels too stiff for me.", "드라이버 샤프트가 저한테 너무 뻣뻣해요.", "intermediate", 3)
add(70, "Could you adjust the loft on this club?", "이 클럽 로프트를 조정해 주시겠어요.", "intermediate", 3)
add(70, "The dress code bans denim, as I read it.", "복장 규정상 데님은 안 되는 걸로 알아요.", "intermediate", 3,
    "Denim is not allowed under the dress code.", "복장 규정상 데님은 허용되지 않아요.")
add(70, "Hats should be removed inside the clubhouse.", "클럽하우스 안에서는 모자를 벗어야 해요.", "advanced", 2)
add(70, "Tipping the caddie in cash is the custom here.", "캐디에게는 현금 팁이 관례예요.", "advanced", 3)
add(70, "Thank you for a wonderful round today.", "오늘 멋진 라운드 감사합니다.", "advanced", 2)

# Day 71 tax-free + refunds
add(71, "Is this store tax free for tourists?", "이 매장은 관광객 면세가 되나요.", "beginner", 1)
add(71, "What is the minimum purchase for a refund?", "환급받으려면 최소 얼마를 사야 하나요.", "beginner", 2)
add(71, "Could I have a tax refund form?", "면세 환급 서류를 주시겠어요.", "beginner", 2)
add(71, "I need my passport for the tax free process.", "면세 절차에 여권이 필요해요.", "intermediate", 2)
add(71, "Where do I claim the refund at the airport?", "공항 어디에서 환급받나요.", "intermediate", 2,
    "Where is the tax refund counter at the airport?", "공항 면세 환급 카운터가 어디에 있나요.")
add(71, "The refund did not arrive on my card.", "환급금이 카드로 들어오지 않았어요.", "intermediate", 3)
add(71, "I was charged twice for the same item.", "같은 물건이 두 번 결제됐어요.", "intermediate", 3,
    "My card shows a double charge for one item.", "카드에 한 물건이 중복 청구됐어요.")
add(71, "This item is faulty, so I would like a full refund.", "이 물건에 하자가 있어서 전액 환불받고 싶어요.", "advanced", 3)
add(71, "I have the receipt and the original packaging.", "영수증과 원래 포장이 있어요.", "advanced", 2)
add(71, "Could you send the refund confirmation by email?", "환불 확인서를 이메일로 보내 주세요.", "advanced", 3)

# Day 72 alterations + size exchanges
add(72, "Do you offer free alterations?", "무료 수선해 주나요.", "beginner", 1)
add(72, "These pants are too long for me.", "이 바지는 저한테 너무 길어요.", "beginner", 1)
add(72, "Could I exchange this for a larger size?", "더 큰 사이즈로 교환할 수 있나요.", "beginner", 2)
add(72, "I wore it once, but the seam came apart.", "한 번 입었는데 박음선이 터졌어요.", "intermediate", 3)
add(72, "The color faded after one wash.", "한 번 빨았는데 색이 바랬어요.", "intermediate", 3,
    "It lost its color after a single wash.", "한 번 세탁했더니 탈색됐어요.")
add(72, "The sale item has a different return rule.", "세일 상품은 반품 규정이 다르네요.", "intermediate", 2)
add(72, "Could you check the stock in another branch?", "다른 지점 재고를 확인해 주시겠어요.", "intermediate", 2)
add(72, "I would like store credit instead of a refund.", "환불 대신 매장 적립금으로 받고 싶어요.", "advanced", 3)
add(72, "The manager approved the exchange yesterday.", "어제 매니저님이 교환을 승인하셨어요.", "advanced", 3)
add(72, "Please note the dispute on my receipt today.", "오늘 영수증에 분쟁 내용을 적어 주세요.", "advanced", 3)

# Day 73 integrated practice 1
add(73, "My connection is tight, so please guide me to the express lane.", "연결 시간이 촉박하니 빠른 통로로 안내해 주세요.", "intermediate", 2)
add(73, "The subway is packed, so I will take the next one.", "지하철이 너무 붐벼서 다음 걸 타겠어요.", "beginner", 1)
add(73, "This menu has no pictures, so please explain the special.", "이 메뉴에는 사진이 없어서 특선을 설명해 주세요.", "intermediate", 2)
add(73, "Our tee time was moved without notice.", "티타임이 알림 없이 바뀌었어요.", "intermediate", 3)
add(73, "The tax free machine rejected my passport scan.", "면세 기계가 여권 스캔을 거부했어요.", "intermediate", 3)
add(73, "A sudden storm just stopped all flights.", "갑작스러운 폭풍으로 모든 비행기가 멈췄어요.", "advanced", 3)
add(73, "My phone died, so I cannot show my ticket.", "휴대폰이 꺼져서 표를 보여드릴 수 없어요.", "intermediate", 3)
add(73, "Could you write down the address for my driver?", "기사님께 드릴 주소를 적어 주시겠어요.", "beginner", 2)
add(73, "I feel dizzy, so please call the station staff.", "어지러우니 역 직원을 불러 주세요.", "advanced", 3,
    "I am feeling faint, so please get help.", "기절할 것 같으니 도와주세요.")
add(73, "Let us stay calm and solve one problem at a time.", "침착하게 한 번에 하나씩 해결해요.", "beginner", 2,
    "Please stay calm while we fix things step by step.", "단계별로 해결하는 동안 침착해 주세요.")

# Day 74 integrated practice 2
add(74, "The self checkout charged me for someone else's bag.", "무인 계산대에서 남의 가방 값이 찍혔어요.", "intermediate", 3)
add(74, "My golf shoes broke on the first hole.", "골프화가 첫 홀에서 망가졌어요.", "intermediate", 2)
add(74, "The bar is too loud, so could we move inside?", "바가 너무 시끄러우니 안쪽으로 옮겨도 될까요.", "beginner", 2)
add(74, "The bus left early and I missed it.", "버스가 일찍 떠나서 놓쳤어요.", "beginner", 2,
    "The bus departed ahead of schedule.", "버스가 예정보다 일찍 출발했어요.")
add(74, "Immigration asked for my return ticket.", "입국 심사에서 귀국 항공권을 요구했어요.", "intermediate", 2)
add(74, "My card was declined though I have enough balance.", "잔액이 충분한데 카드가 거절됐어요.", "intermediate", 3)
add(74, "The caddie gave me the wrong club twice.", "캐디가 클럽을 두 번 잘못 줬어요.", "advanced", 3)
add(74, "A stranger is following me, so please walk with me.", "낯선 사람이 따라오니 같이 걸어 주세요.", "advanced", 3,
    "Someone is following me, so please stay with me.", "누가 따라오니 곁에 있어 주세요.")
add(74, "Could we pause the round because of lightning?", "낙뢰 때문에 라운드를 중단해도 될까요.", "advanced", 3)
add(74, "Thank you for handling this trouble so kindly.", "이 문제를 친절히 처리해 주셔서 감사합니다.", "beginner", 1)

# Day 75 integrated practice 3
add(75, "Everything went wrong today, but I kept my manners.", "오늘은 다 꼬였지만 예의를 지켰어요.", "intermediate", 2)
add(75, "I missed my flight, my bag, and my bus in one day.", "하루에 비행기, 가방, 버스를 다 놓쳤어요.", "intermediate", 2)
add(75, "The waiter, the driver, and the clerk all helped me.", "웨이터, 기사, 점원이 모두 도와줬어요.", "beginner", 1)
add(75, "I learned to ask for help earlier next time.", "다음에는 더 빨리 도움을 요청하겠다고 배웠어요.", "beginner", 2)
add(75, "Could you review my whole day and tell me what worked?", "제 하루를 복기하고 잘한 점을 알려 주시겠어요.", "intermediate", 3)
add(75, "I can now handle the airport without fear.", "이제 공항을 무서워하지 않고 이용할 수 있어요.", "intermediate", 2)
add(75, "Ordering wine feels natural to me now.", "이제 와인 주문이 자연스러워요.", "beginner", 1)
add(75, "I follow golf manners even when I play badly.", "못 쳐도 골프 예절은 지켜요.", "intermediate", 2)
add(75, "Shopping disputes no longer scare me.", "쇼핑 분쟁이 더는 두렵지 않아요.", "advanced", 2)
add(75, "I finished seventy five days and I speak with courage!", "75일을 마치고 용기 있게 말해요!", "advanced", 3)

TOPICS = {61: "airport-transit-advanced", 62: "airport-transit-advanced",
          63: "urban-transit-advanced", 64: "urban-transit-advanced",
          65: "restaurant-bar-advanced", 66: "restaurant-bar-advanced", 67: "restaurant-bar-advanced",
          68: "golf-course-basics", 69: "golf-course-basics", 70: "golf-course-basics",
          71: "department-store-advanced", 72: "department-store-advanced",
          73: "daily-life-integration", 74: "daily-life-integration", 75: "daily-life-integration"}

DIALOGUES = {
 61: ("airport-transit-advanced", [("traveler", "I might miss my connection. What should I do?", "연결편을 놓칠 것 같아요. 어떻게 해야 하나요."),
    ("staff", "I will rebook you on the next flight right away.", "다음 비행기로 바로 다시 예약해 드릴게요."),
    ("traveler", "Will my bag follow me to the new flight?", "제 가방도 새 비행기로 따라오나요?")]),
 62: ("airport-transit-advanced", [("traveler", "My suitcase did not arrive. Where do I report it?", "가방이 안 왔어요. 어디에 신고하나요."),
    ("staff", "Please fill out this missing baggage form with your tag number.", "표 번호와 함께 이 분실 신고서를 작성해 주세요."),
    ("traveler", "And I have a watch to declare. Where is the red channel?", "그리고 신고할 시계가 있어요. 신고 통로가 어디인가요?"),
    ("staff", "Follow me. I will guide you to customs.", "따라오세요. 세관까지 안내해 드릴게요.")]),
 63: ("urban-transit-advanced", [("traveler", "The driver took a long detour. I want to dispute this fare.", "기사님이 돌아서 가셨어요. 요금에 이의가 있어요."),
    ("staff", "I see the route issue. I will refund the extra charge.", "경로 문제를 확인했어요. 추가 요금을 환불해 드릴게요."),
    ("traveler", "Thank you. Please also help me find my phone in the car.", "감사합니다. 차 안의 휴대폰도 찾아주세요.")]),
 64: ("urban-transit-advanced", [("traveler", "Which monthly pass covers the airport line?", "공항선이 포함된 정기권은 어느 건가요?"),
    ("staff", "This pass covers all zones, including the airport.", "이 정기권은 공항 포함 전 구간이 돼요."),
    ("traveler", "Good. Could you also call me a licensed night taxi?", "좋아요. 정식 심야 택시도 불러 주시겠어요?")]),
 65: ("restaurant-bar-advanced", [("traveler", "I have a peanut allergy. Does this dish contain nuts?", "땅콩 알레르기가 있어요. 이 요리에 견과류가 있나요?"),
    ("staff", "Let me confirm with the chef right away.", "셰프님께 바로 확인해 드릴게요."),
    ("traveler", "Thank you for taking my allergy seriously.", "알레르기를 진지하게 받아주셔서 감사합니다.")]),
 66: ("restaurant-bar-advanced", [("traveler", "What do you recommend with steak?", "스테이크에는 무엇을 추천하세요?"),
    ("staff", "This dry red matches the steak very well.", "이 드라이 레드가 스테이크와 잘 어울려요."),
    ("traveler", "Could I taste it before ordering a bottle?", "한 병 주문 전에 시음할 수 있나요?")]),
 67: ("restaurant-bar-advanced", [("traveler", "The bill has a charge that is not ours.", "계산서에 저희 것이 아닌 금액이 있어요."),
    ("staff", "You are right. I will fix the bill now.", "맞으시네요. 지금 바로 정정해 드릴게요."),
    ("traveler", "We will split the corrected bill evenly.", "정정된 계산서를 똑같이 나눠 주세요.")]),
 68: ("golf-course-basics", [("traveler", "Our booking is under the name Kim for four players.", "4명 예약이 김 이름으로 되어 있어요."),
    ("staff", "Found it. What time should I set for your check-in?", "확인됐어요. 체크인 시간을 언제로 할까요?"),
    ("traveler", "Are carts included in the green fee?", "카트비가 그린피에 포함되나요?")]),
 69: ("golf-course-basics", [("traveler", "Whose turn is it to play first?", "누가 먼저 치는 순서인가요?"),
    ("local", "You are away, so you play first.", "손님이 멀리 있으니 먼저 치세요."),
    ("traveler", "I will repair my ball mark after my putt.", "퍼트 후에 볼 마크를 수리할게요.")]),
 70: ("golf-course-basics", [("traveler", "Do you offer same day club repair?", "당일 클럽 수리가 되나요?"),
    ("staff", "Yes. We can adjust the loft within an hour.", "네. 한 시간 안에 로프트를 조정해 드려요."),
    ("traveler", "Thank you for a wonderful round today.", "오늘 멋진 라운드 감사합니다.")]),
 71: ("department-store-advanced", [("traveler", "Is this store tax free for tourists?", "이 매장은 관광객 면세가 되나요?"),
    ("staff", "Yes. I will prepare the refund form with your passport.", "네. 여권으로 환급 서류를 준비해 드릴게요."),
    ("traveler", "Where do I claim the refund at the airport?", "공항 어디에서 환급받나요?")]),
 72: ("department-store-advanced", [("traveler", "I wore it once, but the seam came apart.", "한 번 입었는데 박음선이 터졌어요."),
    ("staff", "I am sorry. We will exchange it for a larger size.", "죄송합니다. 더 큰 사이즈로 교환해 드릴게요."),
    ("traveler", "Could you check the stock in another branch?", "다른 지점 재고를 확인해 주시겠어요?")]),
 73: ("daily-life-integration", [("traveler", "My connection is tight and my phone just died.", "연결 시간이 촉박한데 휴대폰까지 꺼졌어요."),
    ("staff", "Stay calm. I will guide you to the express lane.", "침착하세요. 빠른 통로로 안내해 드릴게요."),
    ("traveler", "Thank you. Let us solve one problem at a time.", "감사합니다. 하나씩 해결해요.")]),
 74: ("daily-life-integration", [("traveler", "The bus left early and my card was just declined.", "버스를 놓쳤는데 카드까지 거절됐어요."),
    ("local", "Use my phone to call the station staff.", "제 휴대폰으로 역 직원에게 전화하세요."),
    ("traveler", "Thank you for handling this trouble so kindly.", "이 문제를 친절히 처리해 주셔서 감사합니다.")]),
 75: ("daily-life-integration", [("traveler", "I missed my flight, my bag, and my bus in one day.", "하루에 비행기, 가방, 버스를 다 놓쳤어요."),
    ("local", "Yet you asked for help in English all day.", "그래도 하루 종일 영어로 도움을 요청했잖아요."),
    ("traveler", "I finished seventy five days and I speak with courage!", "75일을 마치고 용기 있게 말해요!")]),
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
        lines.append('    , "alternatives": [') if False else None
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
    # duplicate english check vs existing
    sp = io.open(f"{R}/src/sentences.ts", encoding="utf-8").read()
    existing_en = set(re.findall(r'"english": "(.*?)"', sp))
    new_entries = []
    by_day = {}
    for (day, en, ko, lv, pr, aen, ako) in S:
        by_day.setdefault(day, []).append((en, ko, lv, pr, aen, ako))
    for day in range(61, 76):
        assert len(by_day.get(day, [])) == 10, f"day {day}: {len(by_day.get(day, []))}"
    for (day, en, ko, lv, pr, aen, ako) in S:
        if en in existing_en:
            print(f"DUP-EN: {en}")
    # char checks
    bad = []
    for (day, en, ko, lv, pr, aen, ako) in S:
        if re.search(r"[가-힣]", en): bad.append(("KO-in-EN", en))
        if re.search(r"[\[\]()/]", en): bad.append(("BRK-in-EN", en))
        if re.search(r"[\[\]()/]", ko): bad.append(("BRK-in-KO", ko))
        for t in [aen, ako]:
            if not t: continue
            if t == aen and re.search(r"[가-힣\[\]()/]", t): bad.append(("ALT-EN", t))
            if t == ako and re.search(r"[\[\]()/]", t): bad.append(("ALT-KO", t))
    if bad:
        for b in bad: print("BAD:", b)
        sys.exit(1)
    # build fragment
    parts = []
    for day in range(61, 76):
        for n, (en, ko, lv, pr, aen, ako) in enumerate(by_day[day], 1):
            parts.append(ts_entry(day, n, en, ko, lv, pr, aen, ako))
    fragment = ",\n".join(parts)
    # splice into sentences.ts (replace final "\n]\n" of array)
    assert sp.rstrip().endswith("]")
    idx = sp.rstrip().rfind("\n]")
    new_sp = sp[:idx] + ",\n" + fragment + "\n]\n"
    io.open(f"{R}/src/sentences.ts", "w", encoding="utf-8", newline="\n").write(new_sp)
    # dialogues
    dp = io.open(f"{R}/src/dialogues.ts", encoding="utf-8").read()
    dparts = []
    for day in range(61, 76):
        topic, turns = DIALOGUES[day]
        assert topic == TOPICS[day]
        assert 2 <= len(turns) <= 4 and any(r == "traveler" for r, _, _ in turns)
        tl = []
        for role, en, ko in turns:
            assert not re.search(r"[가-힣]", en)
            tl.append('      {\n'
                      f'        "role": "{role}",\n'
                      f'        "english": {json.dumps(en, ensure_ascii=False)},\n'
                      f'        "korean": {json.dumps(ko, ensure_ascii=False)}\n'
                      '      }')
        dparts.append('  {\n'
                      f'    "day": {day},\n'
                      f'    "topic": "{topic}",\n'
                      '    "turns": [\n' + ",\n".join(tl) + '\n    ]\n  }')
    dfrag = ",\n".join(dparts)
    idx2 = dp.rstrip().rfind("\n]")
    new_dp = dp[:idx2] + ",\n" + dfrag + "\n]\n"
    io.open(f"{R}/src/dialogues.ts", "w", encoding="utf-8", newline="\n").write(new_dp)
    print(f"OK sentences={len(S)} dialogues={len(DIALOGUES)}")

main()
