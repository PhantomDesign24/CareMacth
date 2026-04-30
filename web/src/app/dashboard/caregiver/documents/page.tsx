"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { documentAPI } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";
import { formatDate } from "@/lib/format";

// 생년월일 셀렉트 — value 는 'YYYY-MM-DD' 문자열
function BirthDateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [y, m, d] = (value || '').split('-');
  const year = y || '';
  const month = m || '';
  const day = d || '';

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr: string[] = [];
    for (let yy = currentYear; yy >= currentYear - 100; yy--) arr.push(String(yy));
    return arr;
  }, [currentYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')), []);

  // 선택된 년/월에 맞는 일수 계산
  const daysInMonth = useMemo(() => {
    if (!year || !month) return 31;
    return new Date(Number(year), Number(month), 0).getDate();
  }, [year, month]);
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0')),
    [daysInMonth],
  );

  const update = (ny: string, nm: string, nd: string) => {
    if (!ny || !nm || !nd) {
      onChange('');
      return;
    }
    // 일이 새 월의 최대를 초과하면 마지막 날로 보정
    const maxDay = new Date(Number(ny), Number(nm), 0).getDate();
    const safeDay = Math.min(Number(nd), maxDay);
    onChange(`${ny}-${nm}-${String(safeDay).padStart(2, '0')}`);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        className="input-field"
        value={year}
        onChange={(e) => update(e.target.value, month, day)}
      >
        <option value="">년</option>
        {years.map((yy) => (
          <option key={yy} value={yy}>{yy}</option>
        ))}
      </select>
      <select
        className="input-field"
        value={month}
        onChange={(e) => update(year, e.target.value, day)}
      >
        <option value="">월</option>
        {months.map((mm) => (
          <option key={mm} value={mm}>{Number(mm)}</option>
        ))}
      </select>
      <select
        className="input-field"
        value={day}
        onChange={(e) => update(year, month, e.target.value)}
      >
        <option value="">일</option>
        {days.map((dd) => (
          <option key={dd} value={dd}>{Number(dd)}</option>
        ))}
      </select>
    </div>
  );
}

interface Certificate {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  imageUrl: string;
  verified: boolean;
}

interface CaregiverProfile {
  id: string;
  status: string;
  gender: string | null;
  birthDate: string | null;
  address: string | null;
  experienceYears: number | null;
  specialties: string[];
  preferredRegions: string[];
  idCardImage: string | null;
  identityVerified: boolean;
  criminalCheckDone: boolean;
  criminalCheckDoc: string | null;
  backgroundCheck: boolean;
  certificates: Certificate[];
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

const SPECIALTIES = ["치매", "감염관리", "중환자", "재활", "일반간병"];
const REGIONS = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

export default function CaregiverDocumentsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [profile, setProfile] = useState<CaregiverProfile | null>(null);

  // Profile form state
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [experienceYears, setExperienceYears] = useState<number>(0);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [preferredRegions, setPreferredRegions] = useState<string[]>([]);

  // Certificate form state
  const [certName, setCertName] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certIssueDate, setCertIssueDate] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);

  // 신분증 / 범죄이력 upload
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [criminalFile, setCriminalFile] = useState<File | null>(null);
  const [idCardUploading, setIdCardUploading] = useState(false);
  const [criminalUploading, setCriminalUploading] = useState(false);

  const handleIdCardUpload = async () => {
    if (!idCardFile) { setError("신분증 파일을 선택해주세요."); return; }
    setIdCardUploading(true);
    setError(""); setSuccessMsg("");
    try {
      const fd = new FormData();
      const optimized = await compressImage(idCardFile);
      fd.append("image", optimized);
      await documentAPI.uploadIdCard(fd);
      setSuccessMsg("신분증이 등록되었습니다. 관리자 검토 후 인증 완료됩니다.");
      setIdCardFile(null);
      const fi = document.getElementById("id-card-input") as HTMLInputElement;
      if (fi) fi.value = "";
      await fetchProfile();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || "신분증 업로드 실패");
    } finally {
      setIdCardUploading(false);
    }
  };

  const handleCriminalUpload = async () => {
    if (!criminalFile) { setError("범죄이력 조회서 파일을 선택해주세요."); return; }
    setCriminalUploading(true);
    setError(""); setSuccessMsg("");
    try {
      const fd = new FormData();
      const optimized = await compressImage(criminalFile);
      // 백엔드 multer는 'document' 필드명을 기대함
      fd.append("document", optimized);
      await documentAPI.uploadCriminalCheck(fd);
      setSuccessMsg("범죄이력 조회서가 등록되었습니다.");
      setCriminalFile(null);
      const fi = document.getElementById("criminal-input") as HTMLInputElement;
      if (fi) fi.value = "";
      await fetchProfile();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || "업로드 실패");
    } finally {
      setCriminalUploading(false);
    }
  };

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await documentAPI.getProfile();
      const data = res.data?.data || res.data;
      setProfile(data);

      // Populate form
      setGender(data.gender || "");
      setBirthDate(data.birthDate ? data.birthDate.split("T")[0] : "");
      setAddress(data.address || "");
      setExperienceYears(data.experienceYears || 0);
      setSpecialties(data.specialties || []);
      setPreferredRegions(data.preferredRegions || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "프로필을 불러오는 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSpecialtyToggle = (specialty: string) => {
    setSpecialties((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty]
    );
  };

  const handleRegionToggle = (region: string) => {
    setPreferredRegions((prev) =>
      prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region]
    );
  };

  const handleProfileSave = async () => {
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const payload: Record<string, unknown> = {
        gender,
        birthDate: birthDate || undefined,
        address,
        experienceYears,
        specialties,
        preferredRegions,
      };
      const res = await documentAPI.updateProfile(payload);
      const data = res.data?.data || res.data;
      setProfile(data);
      setSuccessMsg("프로필이 저장되었습니다.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "프로필 저장 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCertificateUpload = async () => {
    if (!certName || !certIssuer || !certIssueDate) {
      setError("자격증 정보를 모두 입력해주세요.");
      return;
    }
    if (!certFile) {
      setError("자격증 이미지를 선택해주세요.");
      return;
    }

    // 매직넘버 클라이언트 검증 (서버에서도 검증되지만 즉시 피드백)
    const { validateFileMagic } = await import('@/lib/fileMagic');
    const check = await validateFileMagic(certFile, 'document', { maxSizeMB: 10 });
    if (!check.ok) {
      setError(check.reason || '파일 형식이 올바르지 않습니다.');
      return;
    }

    setUploading(true);
    setError("");
    setSuccessMsg("");
    try {
      const formData = new FormData();
      formData.append("name", certName);
      formData.append("issuer", certIssuer);
      formData.append("issueDate", certIssueDate);
      // PDF 는 압축 안 함, 이미지만 압축
      const isImage = check.detectedMime !== 'application/pdf';
      const optimized = isImage ? await compressImage(certFile) : certFile;
      formData.append("image", optimized);

      await documentAPI.uploadCertificate(formData);

      // Reset form
      setCertName("");
      setCertIssuer("");
      setCertIssueDate("");
      setCertFile(null);

      // Reset file input
      const fileInput = document.getElementById("cert-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      setSuccessMsg("자격증이 등록되었습니다.");
      setTimeout(() => setSuccessMsg(""), 3000);

      // Refresh profile to show new certificate
      await fetchProfile();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "자격증 업로드 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const status = profile?.status || "PENDING";
  const certificates = profile?.certificates || [];
  const verifiedCount = certificates.filter((c) => c.verified).length;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-primary-500 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500">서류 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">서류 관리</h1>
            <p className="text-gray-500 mt-1">프로필 정보와 자격증을 관리합니다.</p>
          </div>
          <Link href="/dashboard/caregiver" className="btn-secondary text-sm px-4 py-2">
            대시보드로 돌아가기
          </Link>
        </div>

        {/* Status Banner */}
        {status === "PENDING" && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
            관리자 승인 대기 중입니다. 서류를 등록하면 빠른 승인이 가능합니다.
          </div>
        )}
        {status === "APPROVED" && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
            승인이 완료되었습니다.
          </div>
        )}
        {status === "REJECTED" && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
            승인이 거절되었습니다. 서류를 확인해주세요.
          </div>
        )}
        {status === "SUSPENDED" && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
            활동이 정지되었습니다.
          </div>
        )}

        {/* Success / Error Messages */}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
            {successMsg}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
            <button type="button" className="ml-2 underline" onClick={() => setError("")}>닫기</button>
          </div>
        )}

        {/* Profile Section */}
        <div className="card mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">프로필 정보</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
              <select
                className="input-field"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">선택</option>
                <option value="M">남성</option>
                <option value="F">여성</option>
              </select>
            </div>

            {/* Birth Date — 년/월/일 셀렉트 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label>
              <BirthDateSelect value={birthDate} onChange={setBirthDate} />
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
              <input
                type="text"
                className="input-field"
                placeholder="주소를 입력해주세요"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {/* Experience */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">경력 (년)</label>
              <input
                type="number"
                className="input-field"
                min={0}
                max={50}
                value={experienceYears}
                onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Specialties */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">전문분야</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSpecialtyToggle(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    specialties.includes(s)
                      ? "bg-primary-500 text-white border-primary-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Preferred Regions */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">희망 근무 지역</label>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRegionToggle(r)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    preferredRegions.includes(r)
                      ? "bg-primary-500 text-white border-primary-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleProfileSave}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>

        {/* Certificates Section */}
        <div className="card mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">자격증 관리</h2>

          {/* Existing certificates */}
          {certificates.length > 0 && (
            <div className="mb-6 space-y-3">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{cert.name}</span>
                      {cert.verified ? (
                        <span className="badge-green">검증됨</span>
                      ) : (
                        <span className="badge-yellow">검증 대기</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {cert.issuer} | 발급일: {formatDate(cert.issueDate)}
                    </div>
                  </div>
                  {cert.imageUrl && (
                    <a
                      href={cert.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700 underline shrink-0"
                    >
                      이미지 보기
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {certificates.length === 0 && (
            <div className="mb-6 p-8 text-center text-gray-400 bg-gray-50 rounded-xl">
              등록된 자격증이 없습니다.
            </div>
          )}

          {/* Add certificate form */}
          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">자격증 추가</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">자격증명</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="예: 요양보호사"
                  value={certName}
                  onChange={(e) => setCertName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">발급기관</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="예: 한국보건의료인국가시험원"
                  value={certIssuer}
                  onChange={(e) => setCertIssuer(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">발급일</label>
                <input
                  type="date"
                  className="input-field"
                  value={certIssueDate}
                  onChange={(e) => setCertIssueDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이미지</label>
                <input
                  id="cert-file-input"
                  type="file"
                  accept="image/*,.pdf"
                  className="input-field text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100"
                  onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleCertificateUpload}
              disabled={uploading}
            >
              {uploading ? "업로드 중..." : "자격증 추가"}
            </button>
          </div>
        </div>

        {/* 신분증 */}
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-2">신분증 등록</h2>
          <p className="text-sm text-gray-500 mb-4">
            주민등록증·운전면허증 등 본인 확인용 신분증을 업로드해주세요. 관리자 검토 후 인증 완료되며, 인증 완료 전까지는 지원이 제한됩니다.
          </p>
          {profile?.idCardImage ? (
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="w-full sm:w-40 h-28 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <img src={profile.idCardImage} alt="신분증" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="text-gray-500">상태:</span>{" "}
                  <span className={profile.identityVerified ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
                    {profile.identityVerified ? "✓ 본인 확인 완료" : "⏳ 관리자 검토 중"}
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-1">재등록 시 아래에서 새 파일을 선택하세요.</p>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠ 아직 신분증이 등록되지 않았습니다. 등록 후 승인까지 지원이 제한됩니다.
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="id-card-input"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
              className="flex-1 text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:font-semibold hover:file:bg-primary-100"
            />
            <button
              type="button"
              className="btn-primary px-6"
              onClick={handleIdCardUpload}
              disabled={idCardUploading || !idCardFile}
            >
              {idCardUploading ? "업로드 중..." : "등록"}
            </button>
          </div>
        </div>

        {/* 범죄이력 조회서 */}
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-2">범죄이력 조회서 등록</h2>
          <p className="text-sm text-gray-500 mb-4">
            정부24 또는 경찰서에서 발급받은 범죄경력회보서(성범죄/아동학대 포함)를 업로드해주세요. 간병 활동 필수 서류입니다.
          </p>
          {profile?.criminalCheckDoc ? (
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="w-full sm:w-40 h-28 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <img src={profile.criminalCheckDoc} alt="범죄이력 조회서" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="text-gray-500">상태:</span>{" "}
                  <span className={profile.criminalCheckDone ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
                    {profile.criminalCheckDone ? "✓ 조회 완료" : "⏳ 관리자 검토 중"}
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-1">재등록 시 아래에서 새 파일을 선택하세요.</p>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠ 아직 범죄이력 조회서가 등록되지 않았습니다. 등록 후 승인까지 지원이 제한됩니다.
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="criminal-input"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setCriminalFile(e.target.files?.[0] || null)}
              className="flex-1 text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:font-semibold hover:file:bg-primary-100"
            />
            <button
              type="button"
              className="btn-primary px-6"
              onClick={handleCriminalUpload}
              disabled={criminalUploading || !criminalFile}
            >
              {criminalUploading ? "업로드 중..." : "등록"}
            </button>
          </div>
        </div>

        {/* Document Status Section */}
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-6">서류 현황</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-700">신원 인증</span>
              {profile?.identityVerified ? (
                <span className="text-green-600 font-medium">✓ 완료</span>
              ) : profile?.idCardImage ? (
                <span className="text-amber-600 font-medium">⏳ 검토중</span>
              ) : (
                <span className="text-red-500 font-medium">✕ 미등록</span>
              )}
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-700">범죄이력 조회</span>
              {profile?.criminalCheckDone ? (
                <span className="text-green-600 font-medium">✓ 완료</span>
              ) : profile?.criminalCheckDoc ? (
                <span className="text-amber-600 font-medium">⏳ 검토중</span>
              ) : (
                <span className="text-red-500 font-medium">✕ 미등록</span>
              )}
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-700">자격증</span>
              <span className="text-gray-900 font-medium">
                {certificates.length}개 등록 ({verifiedCount}개 검증됨)
              </span>
            </div>
          </div>
          {(!profile?.identityVerified || !profile?.criminalCheckDone) && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              ⚠ 신원 인증 + 범죄이력 조회가 모두 완료되지 않으면 간병 지원이 제한됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
