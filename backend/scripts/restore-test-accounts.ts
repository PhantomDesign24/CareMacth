import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

(async () => {
  const password = await bcrypt.hash('test1234', 12);

  // 보호자
  const g = await prisma.user.upsert({
    where: { email: 'g99@cm.kr' },
    update: {},
    create: {
      email: 'g99@cm.kr',
      password,
      name: '테스트보호자',
      phone: '010-9999-0001',
      role: 'GUARDIAN',
      authProvider: 'LOCAL',
      referralCode: 'GTEST99',
      guardian: { create: {} },
    },
    include: { guardian: true },
  });
  console.log('▶ 보호자 복원:', g.email, g.id);

  // 간병인 — APPROVED 상태로 만들어 활동 가능하게
  const c = await prisma.user.upsert({
    where: { email: 'c99@cm.kr' },
    update: {},
    create: {
      email: 'c99@cm.kr',
      password,
      name: '테스트간병인',
      phone: '010-9999-0002',
      role: 'CAREGIVER',
      authProvider: 'LOCAL',
      referralCode: 'CTEST99',
      caregiver: {
        create: {
          status: 'APPROVED',
          gender: 'F',
          experienceYears: 5,
        },
      },
    },
    include: { caregiver: true },
  });
  console.log('▶ 간병인 복원:', c.email, c.id);

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('❌', e);
  await prisma.$disconnect();
  process.exit(1);
});
