-- 59개 교육 영상 seed (care-match.kr bbs8/bbs14 기반)
-- 순서: 앱 사용법 → 교육영상 1~35회 → 간병정보 1~12회

INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용1회] 케어매치 간병인은 어디서, 어떤 일을 하게 될까요?', NULL, 'https://www.youtube.com/watch?v=pRM-FzUzBWw', 10, 1, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용2회] 간병 시작 전/후 확인해볼까요?', NULL, 'https://www.youtube.com/watch?v=nkCe1GD-yns', 10, 2, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용3회] 간병인으로서 대처하는 방법(서비스인)', NULL, 'https://www.youtube.com/watch?v=K5XqyRyGFGg', 10, 3, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용4회] 간병인으로서 대처하는 방법(전문인)', NULL, 'https://www.youtube.com/watch?v=e_DhBgwsyKo', 10, 4, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용5회] 케어매치 간병인의 약속(직업인)', NULL, 'https://www.youtube.com/watch?v=v_RIwUBUQYk', 10, 5, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용6회] 케어매치 간병인으로 일하는 방법', NULL, 'https://www.youtube.com/watch?v=du4oCFIEPAk', 10, 6, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용8회] 케어매치 간병인 등록 앱으로 신청하는 방법', NULL, 'https://www.youtube.com/watch?v=3Oili-noDNw', 10, 7, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용9회] 간병인 배상책임보험에 대한 정보', NULL, 'https://www.youtube.com/watch?v=ALsRpoy_xJ4', 10, 8, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용10회] 신입 간병인의 첫 간병을 위한 꿀팁!', NULL, 'https://www.youtube.com/watch?v=sMNwkcqMaU4', 10, 9, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용11회] 초보 간병인을 위한 필수 용어 정리', NULL, 'https://www.youtube.com/watch?v=Ma147IT2u_k', 10, 10, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용12회] 간병인이 꼭 알아야 하는 병원 용어', NULL, 'https://www.youtube.com/watch?v=io6e4DVbA9E', 10, 11, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병인용13회] 케어매치 매칭 노하우', NULL, 'https://www.youtube.com/watch?v=WAEmRe6c7xY', 10, 12, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상1회] 케어매치 간병인이 하는 일', NULL, 'https://www.youtube.com/watch?v=NWc8QQZ9-EY', 10, 13, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상2회] 케어매치 간병인은 어떤 자세로 일을 해야 하는지', NULL, 'https://www.youtube.com/watch?v=9d98luzEltc', 10, 14, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상3회] 케어매치 간병인이 준수 해야 하는 것', NULL, 'https://www.youtube.com/watch?v=gC2AV34OKSk', 10, 15, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상4회]  케어매치 간병인 서비스 활동 목적이 무엇 인지와 업무 유형이 무엇인지', NULL, 'https://www.youtube.com/watch?v=06jJiJ6jFBA', 10, 16, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상5회] 케어매치 신체 활동 지원 서비스 1(세면 도움과 구강 관리 도움을 주는 방법)', NULL, 'https://www.youtube.com/watch?v=gFJcRJl0MI0', 10, 17, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상6회] 케어매치 신체 활동 지원 서비스 2(머리 감기기와 몸 단장 도움 주는 방법)', NULL, 'https://www.youtube.com/watch?v=EUl9_FleQTE', 10, 18, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상7회] 케어매치 신체 활동 지원 서비스 3(면도/면도지커보기와 옷 갈아입히기 도움)', NULL, 'https://www.youtube.com/watch?v=8kY8ew1yMHs', 10, 19, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상8회]  케어매치 신체 활동 서비스 4(목욕 도움)', NULL, 'https://www.youtube.com/watch?v=NZ8zS71L5oY', 10, 20, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상9회] 케어매치 신체 활동 지원 5(식사 돕기)', NULL, 'https://www.youtube.com/watch?v=YxJ2cl24Qt4', 10, 21, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상10회] 케어매치 신체 활동 지원 서비스 6(체위 변경의 원칙과 신체 정렬 방법, 침대 위에서 이동 돕기)', NULL, 'https://www.youtube.com/watch?v=mj1O7s4wKsE', 10, 22, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상11회]  케어매치 신체 활동 지원 서비스 7(체위변경 침대위에서 이동 돕기)', NULL, 'https://www.youtube.com/watch?v=scH3qsPNcyc', 10, 23, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상12회] 케어매치 신체 활동 지원 서비스 8(휠체어 이동 도움)', NULL, 'https://www.youtube.com/watch?v=Xoe9xoEeA1E', 10, 24, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상13회] 케어매치 신체 활동 지원 서비스 9(휠체어 이동 도움)', NULL, 'https://www.youtube.com/watch?v=PuvUmMILS-M', 10, 25, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상14회] 케어매치 신체 활동 서비스 지원 10(보행 도움)', NULL, 'https://www.youtube.com/watch?v=2OtnlhnMwYk', 10, 26, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상15회] 케어매치 신체 활동 지원 서비스 11(화장실 이용 돕기)', NULL, 'https://www.youtube.com/watch?v=AuKgon_mxW4', 10, 27, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상16회] 케어매치 신체 활동 지원 서비스 12(화장실 이용 돕기)', NULL, 'https://www.youtube.com/watch?v=X_8mJp2IGqw', 10, 28, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상17회] 케어매치 일상생활 지원 서비스 1(취사에 식 재료~주방 위생 모든 것)', NULL, 'https://www.youtube.com/watch?v=iSiYK-yVXbY', 10, 29, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상18회] 케어매치 일상생활 지원 서비스 2(침상청결, 세탁하기)', NULL, 'https://www.youtube.com/watch?v=WqxuzIEWA-U', 10, 30, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상19회] 케어매치 개인활동 서비스(외출 동행, 일상업무 대행)', NULL, 'https://www.youtube.com/watch?v=v4zydbj7aWM', 10, 31, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 20회] 안전하고 쾌적하고 청결한 주거환경 관리', NULL, 'https://www.youtube.com/watch?v=zW9BAJUYwDQ', 10, 32, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 21회] 의사소통의 필요성, 의사소통의 유형', NULL, 'https://www.youtube.com/watch?v=ZrcCx-1mukA', 10, 33, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 22회] 효과적인 의사소통 방법', NULL, 'https://www.youtube.com/watch?v=ArUOWcRxcXg', 10, 34, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 23회] 상황별 의사소통', NULL, 'https://www.youtube.com/watch?v=ykzTYryOr4E', 10, 35, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 24회] 낙상예방과 화재예방', NULL, 'https://www.youtube.com/watch?v=DOP9K7ZzkbQ', 10, 36, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 25회] 응급상황 대처방법, 질식, 경련, 화상, 골절, 출혈, 약물오남용 및 중독', NULL, 'https://www.youtube.com/watch?v=qkpGk_wOvVI', 10, 37, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 26회] 심페소생술과 자동심장충격기', NULL, 'https://www.youtube.com/watch?v=VyXLbHatLb8', 10, 38, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 27회] 치매대상자의 일상생활 지원 10가지 ①', NULL, 'https://www.youtube.com/watch?v=-xGwy-6l1S8', 10, 39, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 28회] 치매대상자의 일상생활 지원 10가지 ②', NULL, 'https://www.youtube.com/watch?v=8Sqlh05Xu8Y', 10, 40, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 29회] 치매대상자의 일상생활 지원③', NULL, 'https://www.youtube.com/watch?v=4RQrNBPa_5k', 10, 41, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 30회] 치매대상자의 문제행동 대처', NULL, 'https://www.youtube.com/watch?v=gaheAPgWMQc', 10, 42, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 31회] 치매 대상자와의 의사소통', NULL, 'https://www.youtube.com/watch?v=kcDmqlyhboI', 10, 43, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 32회] 신체활동지원 유형별 대처방안 사례 ①', NULL, 'https://www.youtube.com/watch?v=9HSsTVOUxVM', 10, 44, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 33회] 신체활동지원 유형별 대처방안 사례 ②', NULL, 'https://www.youtube.com/watch?v=gWDsdmcQB9k', 10, 45, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 34회] 신체활동지원 유형별 대처방안 사례 ③', NULL, 'https://www.youtube.com/watch?v=qi39cuPn_ZQ', 10, 46, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[교육영상 35회] 여러가지 유형별 대처방안 사례', NULL, 'https://www.youtube.com/watch?v=3ZzwLe0AikM', 10, 47, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보12회] 간병비용은 어떤 기준으로 책정될까요?', NULL, 'https://www.youtube.com/watch?v=agEhqjRm8yM', 10, 48, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보11회] 간호간병통합서비스 알고 계신가요?', NULL, 'https://www.youtube.com/watch?v=RBEluz2yGro', 10, 49, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보10회] 가족요양보호', NULL, 'https://www.youtube.com/watch?v=l5uLecU8508', 10, 50, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보9회] 가족 간병휴직제도란?', NULL, 'https://www.youtube.com/watch?v=zxtcw9L71UI', 10, 51, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보8회] 요양보호사가 되는 방법', NULL, 'https://www.youtube.com/watch?v=bAQdcg8rLIE', 10, 52, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보7회] 노인장기요양보험제도에 대한 모든것!', NULL, 'https://www.youtube.com/watch?v=9CjKeDQnLxE', 10, 53, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보6회] 집에서 간병인 구하고 싶을 때 어떻게 해야하나요?', NULL, 'https://www.youtube.com/watch?v=0F6zslFk1BA', 10, 54, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보5회] 선택하면 안되는 간병인 업체 유형', NULL, 'https://www.youtube.com/watch?v=aL4pfinDfiY', 10, 55, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보4회] 간병인 업체에 대한 모든 정보', NULL, 'https://www.youtube.com/watch?v=WXDycUE9IG4', 10, 56, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보3회] 간병인 자격증 꼭 필요한가요?', NULL, 'https://www.youtube.com/watch?v=zHLFK09xFiU', 10, 57, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보2회] 요양보호사 VS 간병인 무엇이 더 좋을까?', NULL, 'https://www.youtube.com/watch?v=BqAmaC7K9T8', 10, 58, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
INSERT INTO "Education" (id, title, description, "videoUrl", duration, "order", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '[간병정보1회] 모두가 행복한 간병을 하는 방법', NULL, 'https://www.youtube.com/watch?v=4X8grPo3b70', 10, 59, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
