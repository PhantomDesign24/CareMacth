import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  const userIds = (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id);
  const userIdSet = new Set(userIds);

  const orphanGuardians = await prisma.guardian.findMany();
  const orphanGdToDel = orphanGuardians.filter((g) => !userIdSet.has(g.userId));
  for (const g of orphanGdToDel) {
    await prisma.guardian.delete({ where: { id: g.id } });
    console.log(`orphan guardian deleted: ${g.id}`);
  }

  const orphanCaregivers = await prisma.caregiver.findMany();
  const orphanCgToDel = orphanCaregivers.filter((c) => !userIdSet.has(c.userId));
  for (const c of orphanCgToDel) {
    await prisma.certificate.deleteMany({ where: { caregiverId: c.id } });
    await prisma.caregiver.delete({ where: { id: c.id } });
    console.log(`orphan caregiver deleted: ${c.id}`);
  }

  console.log(`\n최종: guardian=${await prisma.guardian.count()}, caregiver=${await prisma.caregiver.count()}`);
  await prisma.$disconnect();
})();
