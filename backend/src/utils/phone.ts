// 전화번호 정규화/후보 유틸 — 저장 형식(하이픈 포함/숫자만)이 혼재된 레거시 데이터 대응

// 숫자만 남긴 정규화 형태 (신규 저장 표준)
export const normalizePhone = (p: unknown): string => String(p ?? '').replace(/[^0-9]/g, '');

// 중복 조회용 후보 목록 — 같은 번호가 하이픈/숫자 어느 형태로 저장돼 있어도 매칭되도록
export const phoneVariants = (raw: unknown): string[] => {
  const digits = normalizePhone(raw);
  const set = new Set<string>();
  if (digits) set.add(digits);
  if (raw) set.add(String(raw).trim());
  if (digits.length === 11) set.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
  else if (digits.length === 10) set.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
  return [...set].filter(Boolean);
};
