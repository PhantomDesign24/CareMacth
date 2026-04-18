// 공용 이미지 업로드 최적화
// - 이미지 파일만 처리 (PDF 등 비이미지는 원본 그대로 반환)
// - 최대 변 길이 제한 + JPEG 재인코딩으로 용량 절감
// - EXIF 메타데이터 제거 (캔버스 경유 시 자동 탈락)

export interface CompressOptions {
  maxWidth?: number;        // 기본 1920
  maxHeight?: number;       // 기본 1920
  quality?: number;         // 0~1, 기본 0.82
  maxSizeMB?: number;       // 이 크기 미만이면 스킵, 기본 1.5MB
  convertToJpeg?: boolean;  // 모든 이미지를 JPEG로 변환, 기본 true (PNG 투명도 필요 시 false)
}

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.82,
  maxSizeMB: 1.5,
  convertToJpeg: true,
};

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const opts = { ...DEFAULTS, ...options };

  // 브라우저 외 환경 (SSR) 방어
  if (typeof window === 'undefined' || typeof document === 'undefined') return file;

  // 이미지가 아니면 원본 반환 (PDF 등)
  if (!file.type.startsWith('image/')) return file;

  // GIF는 애니메이션 프레임 보존 불가 — 원본 유지
  if (file.type === 'image/gif') return file;

  // 이미 충분히 작으면 스킵 (EXIF 제거가 필요하면 이 조건을 제거해도 됨)
  if (file.size <= opts.maxSizeMB * 1024 * 1024) {
    // 단, 해상도가 매우 크면 그래도 리사이즈
    // → 간단화를 위해 여기선 바로 반환
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file).catch(() => null);
    let width: number, height: number;
    let source: CanvasImageSource;

    if (bitmap) {
      width = bitmap.width;
      height = bitmap.height;
      source = bitmap;
    } else {
      // Fallback: HTMLImageElement
      const img = await loadImageElement(file);
      width = img.naturalWidth;
      height = img.naturalHeight;
      source = img;
    }

    // 축소 비율 계산
    const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height, 1);
    const targetW = Math.round(width * ratio);
    const targetH = Math.round(height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(source, 0, 0, targetW, targetH);

    const outputType = opts.convertToJpeg ? 'image/jpeg' : file.type;
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outputType, opts.quality)
    );

    if (!blob) return file;

    // 압축 결과가 오히려 크면 원본 반환
    if (blob.size >= file.size) return file;

    const newName = opts.convertToJpeg
      ? file.name.replace(/\.[^.]+$/, '.jpg')
      : file.name;

    return new File([blob], newName, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    // 실패 시 원본 업로드
    return file;
  }
}

export async function compressImages(
  files: File[] | FileList,
  options: CompressOptions = {}
): Promise<File[]> {
  const arr = Array.from(files);
  return Promise.all(arr.map((f) => compressImage(f, options)));
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
