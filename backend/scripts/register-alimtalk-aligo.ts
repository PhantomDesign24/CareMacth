import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { registerAlimtalkTemplate, requestTemplateApproval } from '../src/services/aligoService';

const prisma = new PrismaClient();

function toAligoVarFormat(text: string): string {
  return (text || '').replace(/\{\{(\w+)\}\}/g, '#{$1}');
}

(async () => {
  const templates = await prisma.notificationTemplate.findMany({
    where: { channels: { has: 'ALIMTALK' } },
    orderBy: { key: 'asc' },
  });
  console.log(`총 ${templates.length}개 템플릿 알리고 등록 시작...\n`);

  let regOk = 0;
  let regFail = 0;
  let approvalOk = 0;
  const failures: { key: string; reason?: string }[] = [];

  for (const tpl of templates) {
    const tplContent = toAligoVarFormat(tpl.body || '');
    const tplName = (tpl.title || tpl.name || tpl.key).slice(0, 50);

    let buttons: any[] | undefined;
    if (tpl.alimtalkButtonsJson) {
      try {
        const parsed = JSON.parse(tpl.alimtalkButtonsJson);
        const arr = Array.isArray(parsed) ? parsed : (parsed as any)?.button;
        buttons = (Array.isArray(arr) ? arr : []).map((b: any) => ({
          name: b.name,
          linkType: b.linkType,
          ...(b.linkMo && { linkMo: toAligoVarFormat(b.linkMo) }),
          ...(b.linkPc && { linkPc: toAligoVarFormat(b.linkPc) }),
          ...(b.schemeIos && { schemeIos: toAligoVarFormat(b.schemeIos) }),
          ...(b.schemeAndroid && { schemeAndroid: toAligoVarFormat(b.schemeAndroid) }),
        }));
      } catch {}
    }

    const reg = await registerAlimtalkTemplate({
      tplCode: tpl.key,
      tplName,
      tplContent,
      tplType: 'BA',
      tplEmType: 'NONE',
      buttons,
    });

    if (reg.success) {
      regOk++;
      console.log(`  [REG OK]  ${tpl.key}`);

      const apr = await requestTemplateApproval(tpl.key);
      if (apr.success) {
        approvalOk++;
        console.log(`  [APR OK]  ${tpl.key}  → 검수 요청 완료 (4-5일 대기)`);
      } else {
        console.log(`  [APR FAIL] ${tpl.key}: ${apr.reason}`);
      }

      await prisma.notificationTemplate.update({
        where: { key: tpl.key },
        data: { alimtalkTemplateCode: tpl.key },
      });
    } else {
      regFail++;
      console.log(`  [REG FAIL] ${tpl.key}: ${reg.reason}`);
      failures.push({ key: tpl.key, reason: reg.reason });
    }

    // 알리고 rate limit 회피용
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n========== 결과 ==========`);
  console.log(`등록 성공: ${regOk}/${templates.length}`);
  console.log(`검수 신청 성공: ${approvalOk}/${regOk}`);
  if (failures.length > 0) {
    console.log(`\n실패 목록:`);
    failures.forEach((f) => console.log(`  - ${f.key}: ${f.reason}`));
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
