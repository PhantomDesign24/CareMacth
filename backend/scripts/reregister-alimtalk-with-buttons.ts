import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  registerAlimtalkTemplate,
  requestTemplateApproval,
  listAlimtalkTemplates,
  deleteAlimtalkTemplate,
} from '../src/services/aligoService';

const prisma = new PrismaClient();

function toAligoVarFormat(text: string): string {
  return (text || '').replace(/\{\{(\w+)\}\}/g, '#{$1}');
}

(async () => {
  // 1) 알리고에서 현재 등록된 템플릿 목록 가져오기
  const list = await listAlimtalkTemplates();
  if (!list.success) {
    console.error('알리고 list 실패:', list.reason);
    process.exit(1);
  }
  console.log(`현재 알리고 등록 ${list.list?.length}건`);

  // 2) DB의 25개 ALIMTALK 활성 템플릿
  const ours = await prisma.notificationTemplate.findMany({
    where: { channels: { has: 'ALIMTALK' } },
    orderBy: { key: 'asc' },
  });
  console.log(`DB의 ALIMTALK 활성 ${ours.length}건`);

  // 3) DB.alimtalkTemplateCode 가 가리키는 알리고 코드 — 삭제 (승인 안 된 것만)
  console.log('\n[1/3] 알리고에서 기존 등록 삭제...');
  let deleted = 0;
  for (const t of ours) {
    const code = t.alimtalkTemplateCode;
    if (!code || !code.startsWith('UH_')) continue;
    const aligoTpl = (list.list || []).find((x: any) => x.templtCode === code);
    if (!aligoTpl) {
      console.log(`  [SKIP] ${t.key} (${code}) — 알리고에 없음`);
      continue;
    }
    if (aligoTpl.inspStatus === 'APR') {
      console.log(`  [SKIP] ${t.key} (${code}) — 이미 승인 (APR), 삭제 불가`);
      continue;
    }
    const del = await deleteAlimtalkTemplate(code);
    if (del.success) {
      deleted++;
      console.log(`  [DEL]  ${t.key} (${code})`);
    } else {
      console.log(`  [FAIL] ${t.key} (${code}): ${del.reason}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`  → ${deleted}건 삭제 완료\n`);

  // 4) 버튼 포함하여 재등록
  console.log('[2/3] 버튼 포함하여 재등록...');
  let regOk = 0;
  const newCodeMap: Record<string, string> = {};
  for (const t of ours) {
    let buttons: any[] | undefined;
    if (t.alimtalkButtonsJson) {
      try {
        const parsed = JSON.parse(t.alimtalkButtonsJson);
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
      tplCode: t.key,
      tplName: (t.title || t.name || t.key).slice(0, 50),
      tplContent: toAligoVarFormat(t.body || ''),
      tplType: 'BA',
      tplEmType: 'NONE',
      buttons,
    });
    if (reg.success) {
      regOk++;
      console.log(`  [REG OK] ${t.key} — 버튼 ${buttons?.length || 0}개`);
    } else {
      console.log(`  [REG FAIL] ${t.key}: ${reg.reason}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`  → ${regOk}/${ours.length}건 등록 완료\n`);

  // 5) list 다시 가져와서 새 코드 매핑 + 검수 신청
  console.log('[3/3] 코드 매핑 + 검수 신청...');
  const list2 = await listAlimtalkTemplates();
  if (!list2.success) {
    console.error('list2 실패:', list2.reason);
    process.exit(1);
  }
  const titleToCode: Record<string, string[]> = {};
  for (const a of list2.list || []) {
    if (a.inspStatus === 'REG') {
      if (!titleToCode[a.templtName]) titleToCode[a.templtName] = [];
      titleToCode[a.templtName].push(a.templtCode);
    }
  }
  // 동명 title 우선순위: 키 알파벳 순으로 첫 매칭 → 다음 매칭
  let aprOk = 0;
  for (const t of ours) {
    const candidates = titleToCode[t.title] || [];
    if (candidates.length === 0) {
      console.log(`  [NOMATCH] ${t.key} (${t.title})`);
      continue;
    }
    const code = candidates.shift()!;
    newCodeMap[t.key] = code;

    await prisma.notificationTemplate.update({
      where: { id: t.id },
      data: { alimtalkTemplateCode: code },
    });

    const apr = await requestTemplateApproval(code);
    if (apr.success) {
      aprOk++;
      console.log(`  [APR OK] ${t.key} → ${code}`);
    } else {
      console.log(`  [APR FAIL] ${t.key} → ${code}: ${apr.reason}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\n========== 결과 ==========`);
  console.log(`삭제: ${deleted}`);
  console.log(`등록: ${regOk}/${ours.length}`);
  console.log(`검수 신청: ${aprOk}/${regOk}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
