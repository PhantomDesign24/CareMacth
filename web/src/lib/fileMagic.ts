// 파일 매직 넘버 클라이언트 검증
// (서버에서도 검증하지만 UX 개선 + 사용자에게 즉시 피드백)

export type AllowedFileKind = 'image' | 'pdf' | 'document';

const MAGIC: Record<string, number[][]> = {
  // JPEG: FF D8 FF
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF only — WEBP 추가 검증은 8-12 byte
  // GIF: 47 49 46 38 (37|39) 61
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  // PDF: 25 50 44 46
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};

const KIND_MIMES: Record<AllowedFileKind, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  pdf: ['application/pdf'],
  document: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};

const matchesAny = (bytes: Uint8Array, signatures: number[][]): boolean => {
  return signatures.some((sig) => sig.every((byte, i) => bytes[i] === byte));
};

export interface MagicValidateResult {
  ok: boolean;
  detectedMime?: string;
  reason?: string;
}

export async function validateFileMagic(
  file: File,
  kind: AllowedFileKind,
  options?: { maxSizeMB?: number },
): Promise<MagicValidateResult> {
  const maxSize = (options?.maxSizeMB ?? 20) * 1024 * 1024;
  if (file.size > maxSize) {
    return { ok: false, reason: `파일 크기가 ${options?.maxSizeMB ?? 20}MB 를 초과했습니다.` };
  }

  const blob = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(blob);

  const allowedMimes = KIND_MIMES[kind];
  for (const mime of allowedMimes) {
    const sigs = MAGIC[mime];
    if (sigs && matchesAny(bytes, sigs)) {
      // WebP 추가 확인 (RIFF + WEBP)
      if (mime === 'image/webp') {
        let ascii = '';
        for (let i = 8; i < 12; i++) ascii += String.fromCharCode(bytes[i] || 0);
        if (ascii !== 'WEBP') continue;
      }
      return { ok: true, detectedMime: mime };
    }
  }
  return {
    ok: false,
    reason: '파일 형식이 올바르지 않거나 손상되었습니다. (JPEG/PNG/WebP/PDF만 허용)',
  };
}
