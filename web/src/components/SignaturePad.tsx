"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface SignaturePadProps {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onSubmit: (signatureDataUrl: string) => Promise<void> | void;
  signerName?: string; // 표시용
}

export default function SignaturePad({
  open,
  title = "계약서 서명",
  description,
  onClose,
  onSubmit,
  signerName,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 캔버스 초기화 (DPR 대응)
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#111827";
    // 배경 흰색
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  useEffect(() => {
    if (!open) return;
    // 다음 프레임에서 측정 (모달이 마운트된 후)
    const t = setTimeout(setupCanvas, 0);
    setIsEmpty(true);
    setError("");
    return () => clearTimeout(t);
  }, [open, setupCanvas]);

  useEffect(() => {
    if (!open) return;
    const handler = () => setupCanvas();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [open, setupCanvas]);

  // 좌표 추출 (mouse/touch 공통)
  const getPoint = (
    e: React.MouseEvent | React.TouchEvent,
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0] || e.changedTouches[0];
      if (!t) return null;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const p = getPoint(e);
    if (!p) return;
    drawingRef.current = true;
    lastPointRef.current = p;
  };

  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const p = getPoint(e);
    const last = lastPointRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!p || !last || !ctx) return;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    if (isEmpty) setIsEmpty(false);
  };

  const endDraw = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const clear = () => {
    setupCanvas();
    setIsEmpty(true);
  };

  const handleSubmit = async () => {
    if (isEmpty) {
      setError("서명을 먼저 입력해주세요.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(dataUrl);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "서명 저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3 sm:p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            {signerName && (
              <p className="text-xs text-gray-500 mt-0.5">서명자: {signerName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {description && (
            <p className="text-xs text-gray-600 mb-3">{description}</p>
          )}

          {/* Canvas */}
          <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full bg-white border-2 border-dashed border-gray-300 rounded-xl touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={moveDraw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={moveDraw}
              onTouchEnd={endDraw}
            />
            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-sm text-gray-400">이 영역에 서명해주세요</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 mt-2">
            마우스 또는 손가락으로 위 박스 안에 서명을 입력하세요. 서명 즉시 계약서에 기록됩니다.
          </p>

          {error && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={clear}
              disabled={submitting}
              className="py-3 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              지우고 다시
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || isEmpty}
              className="py-3 rounded-xl text-sm font-bold text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "처리 중..." : "서명 완료"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
