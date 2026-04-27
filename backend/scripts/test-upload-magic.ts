/**
 * 업로드 매직넘버 검증 시나리오
 *  U1 정상 PNG 업로드 → 통과
 *  U2 .png 확장자 + JPEG 헤더 (위장) → 거절
 *  U3 .pdf 확장자 + 텍스트 내용 → 거절
 *  U4 .png 확장자 + 임의 텍스트 → 거절
 *  U5 .txt + 정상 텍스트 → 통과
 *  U6 .txt + 바이너리 (NULL 다수) → 거절
 *  U7 .docx 확장자 + ZIP 시그니처 → 통과
 *  U8 .docx 확장자 + 텍스트 내용 → 거절
 */
import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import os from 'os';

const API = 'http://localhost:4000/api';
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const failures: string[] = [];
const ok = (n: string) => { pass++; console.log(`  ✅ ${n}`); };
const bad = (n: string, m: string) => { fail++; failures.push(`${n}: ${m}`); console.log(`  ❌ ${n} — ${m}`); };

async function login(email: string, pw: string) {
  const r = await axios.post(`${API}/auth/login`, { email, password: pw });
  return r.data?.data?.access_token;
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

function tmpFile(name: string, content: Buffer | string): string {
  const p = path.join(os.tmpdir(), `cm-test-${Date.now()}-${name}`);
  fs.writeFileSync(p, typeof content === 'string' ? Buffer.from(content) : content);
  return p;
}

async function uploadAttachment(token: string, filePath: string, filename: string) {
  const fd = new FormData();
  fd.append('files', fs.createReadStream(filePath), filename);
  return axios.post(`${API}/admin/notices/upload-multi`, fd, {
    headers: { ...auth(token), ...fd.getHeaders() },
  });
}

const REAL_PNG = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR
  ...Array(100).fill(0x00),
]);
const JPEG_HEADER = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...Array(100).fill(0x00)]);
const ZIP_HEADER = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0x00)]);
const PDF_HEADER = Buffer.from('%PDF-1.4\n' + '\x00'.repeat(100));

async function expectFail(label: string, fn: () => Promise<any>, status: number) {
  try { await fn(); bad(label, `예상한 ${status} 안 옴`); }
  catch (e) {
    const c = (e as AxiosError).response?.status;
    if (c === status) ok(label);
    else bad(label, `status=${c}, body=${JSON.stringify((e as AxiosError).response?.data)}`);
  }
}

async function main() {
  console.log('━━━ Upload Magic Number 검증 ━━━');
  const adminToken = await login('admin', '1234');

  // U1: 정상 PNG
  let f = tmpFile('real.png', REAL_PNG);
  try {
    const r = await uploadAttachment(adminToken, f, 'real.png');
    if (r.data?.success) ok('U1 정상 PNG → 통과');
    else bad('U1', JSON.stringify(r.data));
  } catch (e: any) { bad('U1', `${e.response?.status} ${JSON.stringify(e.response?.data)}`); }
  finally { fs.unlinkSync(f); }

  // U2: .png + JPEG 헤더 (확장자 위장)
  f = tmpFile('fake.png', JPEG_HEADER);
  await expectFail('U2 .png + JPEG 헤더 거절', () => uploadAttachment(adminToken, f, 'fake.png'), 400);
  fs.unlinkSync(f);

  // U3: .pdf + 텍스트
  f = tmpFile('fake.pdf', 'this is not a pdf');
  await expectFail('U3 .pdf + 텍스트 거절', () => uploadAttachment(adminToken, f, 'fake.pdf'), 400);
  fs.unlinkSync(f);

  // U4: .png + 임의 텍스트
  f = tmpFile('fake2.png', 'random text data');
  await expectFail('U4 .png + 텍스트 거절', () => uploadAttachment(adminToken, f, 'fake2.png'), 400);
  fs.unlinkSync(f);

  // U5: .txt + 정상 텍스트
  f = tmpFile('hello.txt', '안녕하세요 일반 텍스트입니다.\n두 번째 줄');
  try {
    const r = await uploadAttachment(adminToken, f, 'hello.txt');
    if (r.data?.success) ok('U5 정상 TXT → 통과');
    else bad('U5', JSON.stringify(r.data));
  } catch (e: any) { bad('U5', `${e.response?.status} ${JSON.stringify(e.response?.data)}`); }
  finally { fs.unlinkSync(f); }

  // U6: .txt + 바이너리 (NULL 다수)
  f = tmpFile('binary.txt', Buffer.from(Array(100).fill(0x00)));
  await expectFail('U6 .txt + 바이너리 거절', () => uploadAttachment(adminToken, f, 'binary.txt'), 400);
  fs.unlinkSync(f);

  // U7: .docx + ZIP 시그니처
  f = tmpFile('real.docx', ZIP_HEADER);
  try {
    const r = await uploadAttachment(adminToken, f, 'real.docx');
    if (r.data?.success) ok('U7 정상 DOCX (ZIP 헤더) → 통과');
    else bad('U7', JSON.stringify(r.data));
  } catch (e: any) { bad('U7', `${e.response?.status} ${JSON.stringify(e.response?.data)}`); }
  finally { fs.unlinkSync(f); }

  // U8: .docx + 텍스트
  f = tmpFile('fake.docx', 'this is plain text');
  await expectFail('U8 .docx + 텍스트 거절', () => uploadAttachment(adminToken, f, 'fake.docx'), 400);
  fs.unlinkSync(f);

  console.log(`\n━━━ 결과: ${pass} 통과 / ${fail} 실패 ━━━`);
  await prisma.$disconnect();
  if (fail) {
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
