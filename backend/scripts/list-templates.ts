import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const tpls = await prisma.notificationTemplate.findMany({
    select: { key: true, name: true, type: true, enabled: true },
    orderBy: { key: 'asc' },
  });
  console.log(`총 ${tpls.length}개`);
  tpls.forEach((t) => console.log(`${t.enabled ? '✓' : '✗'} ${t.key} (${t.type}) — ${t.name}`));
  await prisma.$disconnect();
})();
