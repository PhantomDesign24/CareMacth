import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  const counts = {
    user: await prisma.user.count(),
    guardian: await prisma.guardian.count(),
    caregiver: await prisma.caregiver.count(),
    patient: await prisma.patient.count(),
    careRequest: await prisma.careRequest.count(),
    contract: await prisma.contract.count(),
    payment: await prisma.payment.count(),
    earning: await prisma.earning.count(),
    careApplication: await prisma.careApplication.count(),
    review: await prisma.review.count(),
    dispute: await prisma.dispute.count(),
    notification: await prisma.notification.count(),
  };
  console.log('Counts:', JSON.stringify(counts, null, 2));
  const users = await prisma.user.findMany({
    select: { email: true, name: true, role: true, authProvider: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log('Users:');
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
})();
