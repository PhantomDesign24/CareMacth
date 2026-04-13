"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { documentAPI } from "@/lib/api";
import { formatDate } from "@/lib/format";

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

    setUploading(true);
    setError("");
    setSuccessMsg("");
    try {
      const formData = new FormData();
      formData.append("name", certName);
      formData.append("issuer", certIssuer);
      formData.append("issueDate", certIssueDate);
      formData.append("image", certFile);

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

            {/* Birth Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label>
              <input
                type="date"
                className="input-field"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
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

        {/* Document Status Section */}
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-6">서류 현황</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-700">신원 인증</span>
              {profile?.idCardImage ? (
                <span className="text-green-600 font-medium">&#10003; 완료</span>
              ) : (
                <span className="text-red-500 font-medium">&#10005; 미등록</span>
              )}
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-700">범죄이력 조회</span>
              {profile?.backgroundCheck ? (
                <span className="text-green-600 font-medium">&#10003; 완료</span>
              ) : (
                <span className="text-red-500 font-medium">&#10005; 미등록</span>
              )}
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-700">자격증</span>
              <span className="text-gray-900 font-medium">
                {certificates.length}개 등록 ({verifiedCount}개 검증됨)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
