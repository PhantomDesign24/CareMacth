import { sendNotification } from './notificationService';
import { prisma } from '../app';

interface CreateContractParams {
  careRequestId: string;
  guardianId: string;
  caregiverId: string;
  startDate: Date;
  endDate: Date;
  dailyRate: number;
}

// 계약 생성
export async function createContract(params: CreateContractParams) {
  const { careRequestId, guardianId, caregiverId, startDate, endDate, dailyRate } = params;

  const careRequest = await prisma.careRequest.findUnique({
    where: { id: careRequestId },
    include: { patient: true },
  });

  if (!careRequest) {
    throw new Error('간병 요청을 찾을 수 없습니다.');
  }

  // 플랫폼 수수료 조회
  const platformConfig = await prisma.platformConfig.findUnique({
    where: { id: 'default' },
  });

  const feePercent = careRequest.careType === 'INDIVIDUAL'
    ? (platformConfig?.individualFeePercent || 10)
    : (platformConfig?.familyFeePercent || 15);

  const durationDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalAmount = dailyRate * durationDays;

  const contract = await prisma.contract.create({
    data: {
      careRequestId,
      guardianId,
      caregiverId,
      startDate,
      endDate,
      dailyRate,
      totalAmount,
      platformFee: feePercent,
      taxRate: platformConfig?.taxRate || 3.3,
      medicalActClause: true,
    },
  });

  // 간병 요청 상태 업데이트
  await prisma.careRequest.update({
    where: { id: careRequestId },
    data: { status: 'MATCHED' },
  });

  // 간병인 상태 업데이트
  await prisma.caregiver.update({
    where: { id: caregiverId },
    data: {
      workStatus: 'WORKING',
      totalMatches: { increment: 1 },
    },
  });

  // 다른 지원자들에게 거절 알림
  const otherApplications = await prisma.careApplication.findMany({
    where: {
      careRequestId,
      caregiverId: { not: caregiverId },
      status: 'PENDING',
    },
    include: { caregiver: true },
  });

  for (const app of otherApplications) {
    await prisma.careApplication.update({
      where: { id: app.id },
      data: { status: 'REJECTED' },
    });

    await sendNotification({
      userId: app.caregiver.userId,
      type: 'APPLICATION',
      title: '지원 결과 안내',
      body: `${careRequest.patient.name} 환자의 간병 지원이 다른 간병인으로 매칭되었습니다.`,
    });
  }

  // 선택된 간병인에게 알림
  const selectedCaregiver = await prisma.caregiver.findUnique({
    where: { id: caregiverId },
  });

  if (selectedCaregiver) {
    await sendNotification({
      userId: selectedCaregiver.userId,
      type: 'CONTRACT',
      title: '매칭 확정',
      body: `${careRequest.patient.name} 환자의 간병이 확정되었습니다. 계약 내용을 확인해주세요.`,
      data: { contractId: contract.id },
    });
  }

  return contract;
}

// 연장 요청
export async function requestExtension(
  contractId: string,
  newEndDate: Date,
  requestNewCaregiver: boolean = false
) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { careRequest: true },
  });

  if (!contract) {
    throw new Error('계약을 찾을 수 없습니다.');
  }

  const additionalDays = Math.ceil(
    (newEndDate.getTime() - contract.endDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const additionalAmount = contract.dailyRate * additionalDays;

  if (requestNewCaregiver) {
    // 새 간병인 요청: 새로운 공고 생성과 동일
    const extension = await prisma.contractExtension.create({
      data: {
        contractId,
        newEndDate,
        additionalDays,
        additionalAmount,
        isNewCaregiver: true,
      },
    });

    // 기존 계약 종료 처리
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'COMPLETED' },
    });

    // 새로운 간병 요청 생성 (기존 요청 복제)
    await prisma.careRequest.create({
      data: {
        guardianId: contract.guardianId,
        patientId: contract.careRequest.patientId,
        careType: contract.careRequest.careType,
        scheduleType: contract.careRequest.scheduleType,
        location: contract.careRequest.location,
        hospitalName: contract.careRequest.hospitalName,
        address: contract.careRequest.address,
        latitude: contract.careRequest.latitude,
        longitude: contract.careRequest.longitude,
        startDate: contract.endDate,
        endDate: newEndDate,
        preferredGender: contract.careRequest.preferredGender,
        preferredNationality: contract.careRequest.preferredNationality,
        specialRequirements: contract.careRequest.specialRequirements,
        medicalActAgreed: true,
        medicalActAgreedAt: new Date(),
        dailyRate: contract.dailyRate,
        status: 'OPEN',
      },
    });

    return extension;
  } else {
    // 기존 간병인 연장 요청
    const extension = await prisma.contractExtension.create({
      data: {
        contractId,
        newEndDate,
        additionalDays,
        additionalAmount,
        isNewCaregiver: false,
      },
    });

    // 간병인에게 연장 요청 알림
    const caregiver = await prisma.caregiver.findUnique({
      where: { id: contract.caregiverId },
    });

    if (caregiver) {
      await sendNotification({
        userId: caregiver.userId,
        type: 'EXTENSION',
        title: '간병 연장 요청',
        body: `${additionalDays}일 연장 요청이 있습니다. 수락 여부를 확인해주세요.`,
        data: { contractId, extensionId: extension.id },
      });
    }

    return extension;
  }
}

// 연장 수락 + 자동 결제 생성
export async function acceptExtension(extensionId: string) {
  const extension = await prisma.contractExtension.findUnique({
    where: { id: extensionId },
    include: { contract: { include: { guardian: true, caregiver: true } } },
  });

  if (!extension) {
    throw new Error('연장 요청을 찾을 수 없습니다.');
  }

  const contract = extension.contract;
  const additionalAmount = extension.additionalAmount;
  const vatAmount = Math.round(additionalAmount / 11);
  const totalAmount = additionalAmount;

  // 기존 Payment 중 가장 최근 것에서 결제 방법 승계
  const lastPayment = await prisma.payment.findFirst({
    where: { contractId: contract.id, status: { in: ['COMPLETED', 'ESCROW', 'PARTIAL_REFUND'] } },
    orderBy: { createdAt: 'desc' },
  });
  const method = lastPayment?.method || 'BANK_TRANSFER';
  const isDirect = method === 'DIRECT';

  const platformFeeAmount = Math.round(additionalAmount * (contract.platformFee / 100));
  const taxAmount = Math.round(additionalAmount * (contract.taxRate / 100));
  const netAmount = additionalAmount - platformFeeAmount - taxAmount;

  await prisma.$transaction(async (tx) => {
    await tx.contractExtension.update({
      where: { id: extensionId },
      data: { approvedByCaregiver: true },
    });

    await tx.contract.update({
      where: { id: contract.id },
      data: {
        endDate: extension.newEndDate,
        totalAmount: contract.totalAmount + additionalAmount,
        status: 'EXTENDED',
      },
    });

    // 연장 금액에 대한 자동 결제 생성
    const extensionPayment = await tx.payment.create({
      data: {
        contractId: contract.id,
        guardianId: contract.guardianId,
        amount: additionalAmount,
        vatAmount,
        totalAmount,
        method,
        status: isDirect ? 'COMPLETED' : 'PENDING',
        ...(isDirect && { paidAt: new Date() }),
      },
    });

    // 직접결제면 Earning 즉시 생성
    if (isDirect) {
      await tx.earning.create({
        data: {
          caregiverId: contract.caregiverId,
          contractId: contract.id,
          amount: additionalAmount,
          platformFee: platformFeeAmount,
          taxAmount,
          netAmount,
        },
      });
    }

    // 알림: 결제 필요 시 보호자에게, 직접결제면 양쪽 모두 연장 확정 알림
    if (!isDirect) {
      await tx.notification.create({
        data: {
          userId: contract.guardian.userId,
          type: 'PAYMENT',
          title: '연장 결제 필요',
          body: `${additionalAmount.toLocaleString()}원의 연장 결제가 생성되었습니다. 결제를 완료해주세요.`,
          data: { paymentId: extensionPayment.id, contractId: contract.id, extensionId } as any,
        },
      });
    } else {
      await tx.notification.createMany({
        data: [
          {
            userId: contract.guardian.userId,
            type: 'PAYMENT',
            title: '연장 결제 완료 (직접결제)',
            body: `${additionalAmount.toLocaleString()}원 연장 결제가 기록되었습니다.`,
            data: { paymentId: extensionPayment.id, contractId: contract.id } as any,
          },
          {
            userId: contract.caregiver.userId,
            type: 'EXTENSION',
            title: '연장 확정',
            body: `계약이 연장되었습니다. 정산 예정 금액: ${netAmount.toLocaleString()}원`,
            data: { contractId: contract.id } as any,
          },
        ],
      });
    }
  });

  return extension;
}
