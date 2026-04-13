import { prisma } from '../app';

// 엑셀 다운로드용 데이터 조회
export async function getCaregiverExportData() {
  const caregivers = await prisma.caregiver.findMany({
    include: {
      user: true,
      penalties: true,
      contracts: true,
      consultMemos: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return caregivers.map((cg) => ({
    이름: cg.user.name,
    상태: getStatusLabel(cg.status),
    이메일: cg.user.email,
    전화번호: cg.user.phone,
    성별: cg.gender === 'M' ? '남성' : '여성',
    국적: cg.nationality || '-',
    경력: `${cg.experienceYears}년`,
    협회비: cg.associationFee,
    매칭횟수: cg.totalMatches,
    평점: cg.avgRating,
    재고용률: `${(cg.rehireRate * 100).toFixed(1)}%`,
    취소율: `${(cg.cancellationRate * 100).toFixed(1)}%`,
    패널티누계: cg.penaltyCount,
    노쇼횟수: cg.noShowCount,
    우수간병사: cg.hasBadge ? 'O' : 'X',
    최근상담메모: cg.consultMemos[0]?.content || '-',
    가입일: cg.createdAt.toISOString().split('T')[0],
  }));
}

export async function getPatientExportData() {
  const patients = await prisma.patient.findMany({
    include: {
      guardian: { include: { user: true } },
      careRequests: {
        include: {
          contract: {
            include: {
              payments: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return patients.map((p) => {
    const totalCareCount = p.careRequests.length;
    const totalCareFee = p.careRequests.reduce((sum, cr) => {
      return sum + (cr.contract?.totalAmount || 0);
    }, 0);
    const totalPlatformFee = p.careRequests.reduce((sum, cr) => {
      if (!cr.contract) return sum;
      return sum + Math.round(cr.contract.totalAmount * (cr.contract.platformFee / 100));
    }, 0);

    return {
      환자명: p.name,
      생년월일: p.birthDate.toISOString().split('T')[0],
      성별: p.gender === 'M' ? '남성' : '여성',
      보호자: p.guardian.user.name,
      보호자연락처: p.guardian.user.phone,
      거동상태: p.mobilityStatus,
      치매여부: p.hasDementia ? 'O' : 'X',
      감염여부: p.hasInfection ? 'O' : 'X',
      간병횟수: totalCareCount,
      총간병비: totalCareFee,
      총수수료: totalPlatformFee,
      등록일: p.createdAt.toISOString().split('T')[0],
    };
  });
}

export async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    todayRequests,
    todayMatches,
    pendingCaregivers,
    activeCaregivers,
    totalGuardians,
    activeContracts,
    todayRevenue,
    recentDisputes,
  ] = await Promise.all([
    prisma.careRequest.count({
      where: { createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.contract.count({
      where: { createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.caregiver.count({
      where: { status: 'PENDING' },
    }),
    prisma.caregiver.count({
      where: { status: 'APPROVED' },
    }),
    prisma.guardian.count(),
    prisma.contract.count({
      where: { status: 'ACTIVE' },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: today, lt: tomorrow }, status: { in: ['ESCROW', 'COMPLETED'] } },
      _sum: { totalAmount: true },
    }),
    prisma.contract.findMany({
      where: { status: 'CANCELLED', cancelledAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      include: {
        guardian: { include: { user: true } },
        caregiver: { include: { user: true } },
      },
      take: 10,
      orderBy: { cancelledAt: 'desc' },
    }),
  ]);

  return {
    todayRequests,
    todayMatches,
    pendingCaregivers,
    activeCaregivers,
    totalGuardians,
    activeContracts,
    todayRevenue: todayRevenue._sum.totalAmount || 0,
    recentDisputes,
  };
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: '승인 대기',
    APPROVED: '활동 중',
    REJECTED: '승인 거절',
    SUSPENDED: '활동 정지',
    BLACKLISTED: '블랙리스트',
  };
  return labels[status] || status;
}
