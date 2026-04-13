import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 시드 데이터 삽입 시작...');

  // ==========================================
  // 1. 플랫폼 설정
  // ==========================================
  await prisma.platformConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      individualFeePercent: 10,
      individualFeeFixed: 0,
      familyFeePercent: 15,
      familyFeeFixed: 0,
      taxRate: 3.3,
      referralPoints: 10000,
      noShowPenaltyThreshold: 3,
      badgeThreshold: 10,
    },
  });
  console.log('✅ 플랫폼 설정');

  // ==========================================
  // 2. 관리자 계정
  // ==========================================
  const pw = await bcrypt.hash('1234', 12);
  await prisma.user.upsert({
    where: { email: 'admin' },
    update: {},
    create: {
      email: 'admin',
      password: pw,
      name: '관리자',
      phone: '010-0000-0000',
      role: 'ADMIN',
      referralCode: 'CM-ADMIN',
      points: 50000,
      guardian: { create: {} },
      caregiver: {
        create: {
          status: 'APPROVED',
          workStatus: 'AVAILABLE',
          identityVerified: true,
          criminalCheckDone: true,
          gender: 'M',
          nationality: 'KR',
          experienceYears: 10,
          specialties: ['치매', '중환자', '감염관리', '재활'],
          preferredRegions: ['서울', '경기', '인천'],
          avgRating: 5.0,
          totalMatches: 100,
          rehireRate: 1.0,
          hasBadge: true,
          badgeGrantedAt: new Date(),
        },
      },
    },
  });
  console.log('✅ 관리자 계정 (보호자+간병인+포인트 포함)');

  // 관리자용 환자 등록
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin' },
    include: { guardian: true },
  });
  if (adminUser?.guardian) {
    await prisma.patient.create({
      data: {
        guardianId: adminUser.guardian.id,
        name: '테스트환자',
        birthDate: new Date(1950, 0, 1),
        gender: 'M',
        mobilityStatus: 'PARTIAL',
        hasDementia: false,
        hasInfection: false,
        diagnosis: '테스트용 환자',
        weight: 65,
        height: 168,
        medicalNotes: '관리자 테스트용',
      },
    });
  }
  console.log('✅ 관리자 환자 등록');

  // ==========================================
  // 3. 보호자 5명 + 환자
  // ==========================================
  const guardianPw = await bcrypt.hash('test1234!', 12);
  const guardianData = [
    { email: 'guardian1@test.com', name: '김민수', phone: '010-1111-0001', code: 'CM-G001' },
    { email: 'guardian2@test.com', name: '이영희', phone: '010-1111-0002', code: 'CM-G002' },
    { email: 'guardian3@test.com', name: '박준혁', phone: '010-1111-0003', code: 'CM-G003' },
    { email: 'guardian4@test.com', name: '최수진', phone: '010-1111-0004', code: 'CM-G004' },
    { email: 'guardian5@test.com', name: '정태영', phone: '010-1111-0005', code: 'CM-G005' },
  ];

  const guardians = [];
  for (const g of guardianData) {
    const user = await prisma.user.upsert({
      where: { email: g.email },
      update: {},
      create: {
        email: g.email,
        password: guardianPw,
        name: g.name,
        phone: g.phone,
        role: 'GUARDIAN',
        referralCode: g.code,
        points: Math.floor(Math.random() * 30000),
        guardian: { create: {} },
      },
      include: { guardian: true },
    });
    guardians.push(user);
  }
  console.log('✅ 보호자 5명');

  // 환자 데이터
  const patientData = [
    { name: '김할머니', gender: 'F', mobility: 'PARTIAL' as const, dementia: true, infection: false, diagnosis: '치매 초기', weight: 52, height: 155 },
    { name: '이할아버지', gender: 'M', mobility: 'DEPENDENT' as const, dementia: false, infection: false, diagnosis: '뇌졸중 후유증', weight: 68, height: 170 },
    { name: '박어르신', gender: 'F', mobility: 'INDEPENDENT' as const, dementia: false, infection: true, diagnosis: '폐렴 회복기', weight: 48, height: 150 },
    { name: '최할머니', gender: 'F', mobility: 'PARTIAL' as const, dementia: true, infection: false, diagnosis: '치매 중기', weight: 55, height: 158 },
    { name: '정할아버지', gender: 'M', mobility: 'DEPENDENT' as const, dementia: false, infection: false, diagnosis: '대퇴골 골절', weight: 72, height: 168 },
  ];

  const patients = [];
  for (let i = 0; i < patientData.length; i++) {
    const p = patientData[i];
    const patient = await prisma.patient.create({
      data: {
        guardianId: guardians[i].guardian!.id,
        name: p.name,
        birthDate: new Date(1940 + Math.floor(Math.random() * 20), Math.floor(Math.random() * 12), 1),
        gender: p.gender,
        mobilityStatus: p.mobility,
        hasDementia: p.dementia,
        hasInfection: p.infection,
        infectionDetail: p.infection ? '폐렴 후 감염 관리 필요' : null,
        diagnosis: p.diagnosis,
        weight: p.weight,
        height: p.height,
        medicalNotes: '특이사항 없음',
      },
    });
    patients.push(patient);
  }
  console.log('✅ 환자 5명');

  // ==========================================
  // 4. 간병인 10명 (다양한 상태)
  // ==========================================
  const cgPw = await bcrypt.hash('test1234!', 12);
  const caregiverData = [
    { email: 'cg1@test.com', name: '한미영', phone: '010-2222-0001', code: 'CM-C001', gender: 'F', nat: 'KR', exp: 8, status: 'APPROVED' as const, work: 'AVAILABLE' as const, rating: 4.8, matches: 25, rehire: 0.9, badge: true, regions: ['서울', '경기'] },
    { email: 'cg2@test.com', name: '오정숙', phone: '010-2222-0002', code: 'CM-C002', gender: 'F', nat: 'KR', exp: 5, status: 'APPROVED' as const, work: 'IMMEDIATE' as const, rating: 4.5, matches: 15, rehire: 0.8, badge: true, regions: ['서울'] },
    { email: 'cg3@test.com', name: '김동진', phone: '010-2222-0003', code: 'CM-C003', gender: 'M', nat: 'KR', exp: 3, status: 'APPROVED' as const, work: 'WORKING' as const, rating: 4.2, matches: 8, rehire: 0.7, badge: false, regions: ['경기', '인천'] },
    { email: 'cg4@test.com', name: '왕리', phone: '010-2222-0004', code: 'CM-C004', gender: 'F', nat: 'CN', exp: 4, status: 'APPROVED' as const, work: 'AVAILABLE' as const, rating: 4.0, matches: 10, rehire: 0.6, badge: true, regions: ['서울', '경기'] },
    { email: 'cg5@test.com', name: '응웬티', phone: '010-2222-0005', code: 'CM-C005', gender: 'F', nat: 'VN', exp: 2, status: 'APPROVED' as const, work: 'AVAILABLE' as const, rating: 4.3, matches: 5, rehire: 0.8, badge: false, regions: ['서울'] },
    { email: 'cg6@test.com', name: '이복순', phone: '010-2222-0006', code: 'CM-C006', gender: 'F', nat: 'KR', exp: 12, status: 'APPROVED' as const, work: 'AVAILABLE' as const, rating: 4.9, matches: 50, rehire: 0.95, badge: true, regions: ['서울', '경기', '인천'] },
    { email: 'cg7@test.com', name: '신입간병', phone: '010-2222-0007', code: 'CM-C007', gender: 'F', nat: 'KR', exp: 0, status: 'PENDING' as const, work: 'AVAILABLE' as const, rating: 0, matches: 0, rehire: 0, badge: false, regions: ['서울'] },
    { email: 'cg8@test.com', name: '대기간병', phone: '010-2222-0008', code: 'CM-C008', gender: 'M', nat: 'KR', exp: 1, status: 'PENDING' as const, work: 'AVAILABLE' as const, rating: 0, matches: 0, rehire: 0, badge: false, regions: ['부산'] },
    { email: 'cg9@test.com', name: '정지간병', phone: '010-2222-0009', code: 'CM-C009', gender: 'M', nat: 'KR', exp: 6, status: 'SUSPENDED' as const, work: 'AVAILABLE' as const, rating: 3.2, matches: 20, rehire: 0.3, badge: false, regions: ['대구'] },
    { email: 'cg10@test.com', name: '거절간병', phone: '010-2222-0010', code: 'CM-C010', gender: 'F', nat: 'KR', exp: 2, status: 'REJECTED' as const, work: 'AVAILABLE' as const, rating: 0, matches: 0, rehire: 0, badge: false, regions: ['광주'] },
  ];

  const caregivers = [];
  for (const c of caregiverData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        password: cgPw,
        name: c.name,
        phone: c.phone,
        role: 'CAREGIVER',
        referralCode: c.code,
        caregiver: {
          create: {
            status: c.status,
            workStatus: c.work,
            identityVerified: c.status === 'APPROVED',
            criminalCheckDone: c.status === 'APPROVED',
            gender: c.gender,
            nationality: c.nat,
            birthDate: new Date(1965 + Math.floor(Math.random() * 20), 0, 1),
            address: '서울시 강남구',
            latitude: 37.4979 + (Math.random() - 0.5) * 0.1,
            longitude: 127.0276 + (Math.random() - 0.5) * 0.1,
            experienceYears: c.exp,
            specialties: c.exp >= 5 ? ['치매', '중환자', '감염관리'] : ['일반 간병'],
            preferredRegions: c.regions,
            avgRating: c.rating,
            totalMatches: c.matches,
            rehireRate: c.rehire,
            cancellationRate: Math.random() * 0.1,
            noShowCount: c.status === 'SUSPENDED' ? 4 : 0,
            penaltyCount: c.status === 'SUSPENDED' ? 3 : 0,
            hasBadge: c.badge,
            badgeGrantedAt: c.badge ? new Date() : null,
          },
        },
      },
      include: { caregiver: true },
    });
    caregivers.push(user);
  }
  console.log('✅ 간병인 10명 (APPROVED 6, PENDING 2, SUSPENDED 1, REJECTED 1)');

  // 자격증 추가 (승인된 간병인에게)
  for (let i = 0; i < 6; i++) {
    await prisma.certificate.create({
      data: {
        caregiverId: caregivers[i].caregiver!.id,
        name: '요양보호사 자격증',
        issuer: '한국보건의료인국가시험원',
        issueDate: new Date(2018, 0, 1),
        imageUrl: '/uploads/cert-sample.jpg',
        verified: true,
      },
    });
  }
  console.log('✅ 자격증');

  // ==========================================
  // 5. 간병 요청 8건 (다양한 상태)
  // ==========================================
  const careRequests = [];
  const requestData = [
    { guardianIdx: 0, patientIdx: 0, status: 'OPEN' as const, type: 'INDIVIDUAL' as const, schedule: 'FULL_TIME' as const, loc: 'HOSPITAL' as const, hospital: '서울대병원', address: '서울 종로구 대학로 101', daily: 170000 },
    { guardianIdx: 1, patientIdx: 1, status: 'OPEN' as const, type: 'INDIVIDUAL' as const, schedule: 'FULL_TIME' as const, loc: 'HOME' as const, hospital: null, address: '서울 강남구 역삼동 123', daily: 180000 },
    { guardianIdx: 2, patientIdx: 2, status: 'MATCHING' as const, type: 'INDIVIDUAL' as const, schedule: 'PART_TIME' as const, loc: 'HOSPITAL' as const, hospital: '세브란스병원', address: '서울 서대문구 연세로 50', daily: 150000 },
    { guardianIdx: 0, patientIdx: 0, status: 'MATCHED' as const, type: 'INDIVIDUAL' as const, schedule: 'FULL_TIME' as const, loc: 'HOSPITAL' as const, hospital: '삼성서울병원', address: '서울 강남구 일원로 81', daily: 180000 },
    { guardianIdx: 1, patientIdx: 1, status: 'IN_PROGRESS' as const, type: 'INDIVIDUAL' as const, schedule: 'FULL_TIME' as const, loc: 'HOME' as const, hospital: null, address: '서울 송파구 잠실동 456', daily: 170000 },
    { guardianIdx: 3, patientIdx: 3, status: 'IN_PROGRESS' as const, type: 'FAMILY' as const, schedule: 'FULL_TIME' as const, loc: 'HOSPITAL' as const, hospital: '아산병원', address: '서울 송파구 올림픽로 43길', daily: 200000 },
    { guardianIdx: 4, patientIdx: 4, status: 'COMPLETED' as const, type: 'INDIVIDUAL' as const, schedule: 'FULL_TIME' as const, loc: 'HOSPITAL' as const, hospital: '서울아산병원', address: '서울 송파구 올림픽로 43길 88', daily: 160000 },
    { guardianIdx: 2, patientIdx: 2, status: 'CANCELLED' as const, type: 'INDIVIDUAL' as const, schedule: 'PART_TIME' as const, loc: 'HOME' as const, hospital: null, address: '경기 성남시 분당구', daily: 140000 },
  ];

  for (const r of requestData) {
    const cr: any = await prisma.careRequest.create({
      data: {
        guardianId: guardians[r.guardianIdx].guardian!.id,
        patientId: patients[r.patientIdx].id,
        careType: r.type,
        scheduleType: r.schedule,
        location: r.loc,
        hospitalName: r.hospital,
        address: r.address,
        latitude: 37.5665 + (Math.random() - 0.5) * 0.05,
        longitude: 126.978 + (Math.random() - 0.5) * 0.05,
        startDate: new Date(2026, 3, 15 + careRequests.length),
        endDate: new Date(2026, 4, 15 + careRequests.length),
        durationDays: 30,
        dailyRate: r.daily,
        status: r.status,
        medicalActAgreed: true,
        medicalActAgreedAt: new Date(),
      },
    });
    careRequests.push(cr);
  }
  console.log('✅ 간병 요청 8건');

  // ==========================================
  // 6. 지원 (OPEN/MATCHING 요청에 대해)
  // ==========================================
  const openRequests = careRequests.filter((_, i) => i <= 2);
  for (const cr of openRequests) {
    for (let i = 0; i < 4; i++) {
      if (caregivers[i].caregiver) {
        await prisma.careApplication.create({
          data: {
            careRequestId: cr.id,
            caregiverId: caregivers[i].caregiver!.id,
            status: 'PENDING',
            message: `안녕하세요, ${caregivers[i].name}입니다. 성심성의껏 간병하겠습니다.`,
            expectedEarning: cr.dailyRate ? cr.dailyRate * 30 : 5000000,
          },
        });
      }
    }
  }
  console.log('✅ 지원 12건');

  // ==========================================
  // 7. 계약 (MATCHED, IN_PROGRESS, COMPLETED)
  // ==========================================
  const contractRequests = careRequests.filter((_, i) => [3, 4, 5, 6].includes(i));
  const contracts = [];
  for (let i = 0; i < contractRequests.length; i++) {
    const cr = contractRequests[i];
    const cgIdx = i; // 0~3번 간병인 배정
    const status = i === 3 ? 'COMPLETED' : 'ACTIVE';
    const guardianIdx = requestData[[3, 4, 5, 6][i]].guardianIdx;

    const contract = await prisma.contract.create({
      data: {
        careRequestId: cr.id,
        guardianId: guardians[guardianIdx].guardian!.id,
        caregiverId: caregivers[cgIdx].caregiver!.id,
        startDate: cr.startDate,
        endDate: cr.endDate!,
        dailyRate: cr.dailyRate || 170000,
        totalAmount: (cr.dailyRate || 170000) * 30,
        platformFee: cr.careType === 'FAMILY' ? 15 : 10,
        taxRate: 3.3,
        status: status as any,
        medicalActClause: true,
      },
    });
    contracts.push(contract);
  }
  console.log('✅ 계약 4건 (ACTIVE 3, COMPLETED 1)');

  // ==========================================
  // 8. 결제
  // ==========================================
  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    const guardianIdx = requestData[[3, 4, 5, 6][i]].guardianIdx;
    const amount = c.totalAmount;
    const vatAmount = Math.round(amount / 11);

    await prisma.payment.create({
      data: {
        contractId: c.id,
        guardianId: guardians[guardianIdx].guardian!.id,
        amount,
        vatAmount,
        totalAmount: amount + vatAmount,
        method: i % 2 === 0 ? 'CARD' : 'BANK_TRANSFER',
        status: i === 3 ? 'COMPLETED' : 'ESCROW',
        tossOrderId: `ORDER-${Date.now()}-${i}`,
        paidAt: new Date(),
      },
    });
  }
  console.log('✅ 결제 4건');

  // ==========================================
  // 9. 간병 기록 (IN_PROGRESS 계약에 대해)
  // ==========================================
  for (let c = 1; c <= 2; c++) {
    const contract = contracts[c];
    for (let day = 0; day < 5; day++) {
      const date = new Date(2026, 3, 15 + day);
      await prisma.careRecord.create({
        data: {
          contractId: contract.id,
          caregiverId: caregivers[c].caregiver!.id,
          date,
          checkInTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8, 0),
          checkOutTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 20, 0),
          bodyTemp: 36.2 + Math.random() * 0.8,
          bloodPressure: `${120 + Math.floor(Math.random() * 20)}/${70 + Math.floor(Math.random() * 15)}`,
          pulse: 65 + Math.floor(Math.random() * 20),
          meals: '아침: 죽 1공기 / 점심: 밥 반공기, 국 / 저녁: 죽 1공기',
          medication: '혈압약 1정 (아침), 소화제 1정 (점심)',
          excretion: '대변 1회, 소변 정상',
          sleep: '수면 6시간, 중간 기상 1회',
          mobility: '보행 보조 2회, 휠체어 이동 3회',
          mentalState: '안정적, 대화 가능',
          skinState: '욕창 없음, 피부 양호',
          notes: '오늘 컨디션 양호',
          photos: [],
        },
      });
    }
  }
  console.log('✅ 간병 기록 10건');

  // ==========================================
  // 10. 리뷰 (완료된 계약에 대해)
  // ==========================================
  const completedContract = contracts[3];
  await prisma.review.create({
    data: {
      guardianId: guardians[4].guardian!.id,
      caregiverId: caregivers[0].caregiver!.id,
      contractId: completedContract.id,
      rating: 5,
      comment: '정말 친절하고 세심하게 돌봐주셨습니다. 어머니가 많이 좋아하셨어요.',
      wouldRehire: true,
    },
  });
  console.log('✅ 리뷰 1건');

  // ==========================================
  // 11. 정산 (완료된 계약)
  // ==========================================
  const totalPaid = completedContract.totalAmount;
  const platformFee = Math.round(totalPaid * (completedContract.platformFee / 100));
  const taxAmount = Math.round((totalPaid - platformFee) * (completedContract.taxRate / 100));

  await prisma.earning.create({
    data: {
      caregiverId: caregivers[0].caregiver!.id,
      contractId: completedContract.id,
      amount: totalPaid,
      platformFee,
      taxAmount,
      netAmount: totalPaid - platformFee - taxAmount,
      isPaid: true,
      paidAt: new Date(),
    },
  });
  console.log('✅ 정산 1건');

  // ==========================================
  // 12. 패널티
  // ==========================================
  await prisma.penalty.create({
    data: {
      caregiverId: caregivers[8].caregiver!.id, // SUSPENDED 간병인
      type: 'NO_SHOW',
      reason: '노쇼 3회 초과로 자동 활동 정지',
      isAutomatic: true,
    },
  });
  await prisma.penalty.create({
    data: {
      caregiverId: caregivers[8].caregiver!.id,
      type: 'COMPLAINT',
      reason: '보호자 민원 접수 - 불친절',
      isAutomatic: false,
    },
  });
  console.log('✅ 패널티 2건');

  // ==========================================
  // 13. 알림 (다양한 타입)
  // ==========================================
  const notifUsers = [guardians[0], guardians[1], caregivers[0], caregivers[1]];
  const notifTypes = [
    { type: 'MATCHING' as const, title: '새로운 간병 요청 매칭', body: '서울 종로구에서 24시간 간병인을 찾고 있습니다.' },
    { type: 'APPLICATION' as const, title: '새로운 지원자', body: '한미영 간병인이 지원했습니다.' },
    { type: 'CONTRACT' as const, title: '계약 체결 완료', body: '김할머니 환자의 간병 계약이 체결되었습니다.' },
    { type: 'PAYMENT' as const, title: '결제 완료', body: '5,100,000원 결제가 완료되었습니다.' },
    { type: 'CARE_RECORD' as const, title: '간병 일지 작성', body: '오늘의 간병 일지가 작성되었습니다.' },
    { type: 'SYSTEM' as const, title: '시스템 안내', body: '케어매치 서비스 업데이트 안내' },
  ];

  for (const user of notifUsers) {
    for (const n of notifTypes) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: n.type,
          title: n.title,
          body: n.body,
          isRead: Math.random() > 0.5,
          readAt: Math.random() > 0.5 ? new Date() : null,
        },
      });
    }
  }
  console.log('✅ 알림 24건');

  // ==========================================
  // 14. 상담 메모 (관리자)
  // ==========================================
  const admin = await prisma.user.findUnique({ where: { email: 'admin@carematch.kr' } });
  if (admin) {
    await prisma.consultMemo.create({
      data: {
        caregiverId: caregivers[0].caregiver!.id,
        adminId: admin.id,
        content: '매우 성실한 간병인. 보호자 만족도 높음. 우수 간병사 뱃지 유지.',
      },
    });
    await prisma.consultMemo.create({
      data: {
        caregiverId: caregivers[8].caregiver!.id,
        adminId: admin.id,
        content: '노쇼 3회 이상으로 활동 정지 처리. 본인 사유서 수령 후 복귀 심사 예정.',
      },
    });
  }
  console.log('✅ 상담 메모 2건');

  // ==========================================
  // 15. 교육 콘텐츠 + 수강 기록
  // ==========================================
  const educations = [
    { title: '기본 간병 교육', description: '간병의 기초를 배웁니다.', duration: 60, order: 1 },
    { title: '치매 환자 간병', description: '치매 환자 간병 시 유의사항', duration: 45, order: 2 },
    { title: '감염 예방 교육', description: '감염 예방 및 위생 관리', duration: 30, order: 3 },
    { title: '응급 상황 대처', description: '응급 상황 시 대처 방법', duration: 40, order: 4 },
    { title: '환자 커뮤니케이션', description: '환자 및 보호자와의 소통', duration: 35, order: 5 },
  ];

  for (const edu of educations) {
    await prisma.education.upsert({
      where: { id: `edu-${edu.order}` },
      update: {},
      create: { id: `edu-${edu.order}`, ...edu },
    });
  }

  // 수강 기록 (승인된 간병인 일부)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < educations.length; j++) {
      const progress = i === 0 ? 100 : Math.min(100, (j + 1) * 25);
      await prisma.educationRecord.upsert({
        where: {
          caregiverId_educationId: {
            caregiverId: caregivers[i].caregiver!.id,
            educationId: `edu-${j + 1}`,
          },
        },
        update: {},
        create: {
          caregiverId: caregivers[i].caregiver!.id,
          educationId: `edu-${j + 1}`,
          progress,
          completed: progress >= 80,
          completedAt: progress >= 80 ? new Date() : null,
        },
      });
    }
  }
  console.log('✅ 교육 5개 + 수강 기록 15건');

  // ==========================================
  // 16. 월별 통계
  // ==========================================
  for (let m = 1; m <= 3; m++) {
    await prisma.monthlyStats.upsert({
      where: { year_month: { year: 2026, month: m } },
      update: {},
      create: {
        year: 2026,
        month: m,
        totalRequests: 30 + m * 10,
        totalMatches: 20 + m * 8,
        totalRevenue: (5000000 + m * 2000000),
        totalPlatformFee: (500000 + m * 200000),
        activeCaregivers: 15 + m * 3,
        activeGuardians: 25 + m * 5,
        avgRating: 4.3 + m * 0.1,
      },
    });
  }
  console.log('✅ 월별 통계 3개월');

  // ==========================================
  // 17. 보험 서류 신청
  // ==========================================
  await prisma.insuranceDocRequest.create({
    data: {
      patientName: '김할머니',
      birthDate: '1945-03-15',
      carePeriod: '2026.04.15 ~ 2026.05.15',
      insuranceCompany: '삼성생명',
      documentType: '간병확인서',
      status: 'REQUESTED',
      requestedBy: guardians[0].id,
    },
  });
  console.log('✅ 보험 서류 1건');

  console.log('\n🎉 시드 데이터 삽입 완료!');
  console.log('─────────────────────────────');
  console.log('관리자 로그인: admin@carematch.kr / admin1234!');
  console.log('보호자 로그인: guardian1@test.com / test1234!');
  console.log('간병인 로그인: cg1@test.com / test1234!');
  console.log('─────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
