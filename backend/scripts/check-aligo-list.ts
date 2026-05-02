import 'dotenv/config';
import { listAlimtalkTemplates, requestTemplateApproval } from '../src/services/aligoService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  const result = await listAlimtalkTemplates();
  if (!result.success) {
    console.error('list 실패:', result.reason);
    process.exit(1);
  }
  console.log('총 등록 템플릿:', result.list?.length);
  console.log('상태 요약:', result.info);
  console.log('\n샘플 1건:');
  if (result.list && result.list[0]) console.log(JSON.stringify(result.list[0], null, 2));

  console.log('\n전체 목록 (templtCode → templtName):');
  for (const t of result.list || []) {
    console.log(`  ${t.templtCode} | ${t.templtName} | inspStatus=${t.inspStatus} status=${t.status}`);
  }

  // 우리 키와 매핑
  const ourTemplates = await prisma.notificationTemplate.findMany({
    where: { channels: { has: 'ALIMTALK' } },
  });

  console.log('\n검수 요청 시도...');
  let ok = 0;
  for (const t of result.list || []) {
    const code = t.templtCode;
    const matched = ourTemplates.find((ot) => ot.title === t.templtName || ot.key === t.templtName);
    if (matched) {
      // DB의 alimtalkTemplateCode 갱신
      await prisma.notificationTemplate.update({
        where: { id: matched.id },
        data: { alimtalkTemplateCode: code },
      });
    }
    // REG 상태인 것만 검수 요청 가능
    if (t.inspStatus === 'REG') {
      const apr = await requestTemplateApproval(code);
      if (apr.success) {
        ok++;
        console.log(`  [APR OK] ${code} (${t.templtName})`);
      } else {
        console.log(`  [APR FAIL] ${code} (${t.templtName}): ${apr.reason}`);
      }
      await new Promise((r) => setTimeout(r, 500));
    } else {
      console.log(`  [SKIP]   ${code} (${t.templtName}) — inspStatus=${t.inspStatus}`);
    }
  }
  console.log(`\n검수 요청 성공: ${ok}건`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
