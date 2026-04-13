"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authAPI, setTokens } from "@/lib/api";
import { AxiosError } from "axios";

type Role = "guardian" | "caregiver" | "hospital" | "";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("");
  const [step, setStep] = useState(1); // 1 = role select, 2 = form
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Common fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  // Caregiver fields
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [experience, setExperience] = useState("");
  const [nationality, setNationality] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);

  // Hospital fields
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setFieldErrors({});

    if (password !== passwordConfirm) {
      setFieldErrors({ passwordConfirm: "비밀번호가 일치하지 않습니다" });
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        name,
        email,
        phone,
        password,
        password_confirmation: passwordConfirm,
        role,
        referral_code: referralCode || undefined,
      };

      if (role === "caregiver") {
        payload.birth_date = birthDate;
        payload.gender = gender;
        payload.experience = experience;
        payload.nationality = nationality;
        payload.certifications = certifications;
      }

      if (role === "hospital") {
        payload.hospital_name = hospitalName;
        payload.hospital_address = hospitalAddress;
        payload.business_number = businessNumber;
      }

      const { data } = await authAPI.register(payload);

      // Store tokens and user info
      if (data.access_token) {
        setTokens(data.access_token, data.refresh_token || "");
      }
      if (data.user) {
        localStorage.setItem("cm_user", JSON.stringify(data.user));
      }

      // Redirect based on role
      const redirectPath =
        role === "caregiver"
          ? "/dashboard/caregiver"
          : role === "hospital"
            ? "/dashboard/hospital"
            : "/dashboard/guardian";
      router.push(redirectPath);
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response) {
        const respData = err.response.data;
        // Handle validation errors (422)
        if (err.response.status === 422 && respData?.errors) {
          const errors: Record<string, string> = {};
          for (const [field, messages] of Object.entries(respData.errors)) {
            errors[field] = Array.isArray(messages) ? messages[0] : String(messages);
          }
          setFieldErrors(errors);
          setErrorMessage(respData.message || "입력 정보를 확인해 주세요.");
        } else {
          setErrorMessage(
            respData?.message || respData?.error || "회원가입 중 오류가 발생했습니다."
          );
        }
      } else {
        setErrorMessage("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getFieldError = (field: string) => {
    return fieldErrors[field] ? (
      <p className="text-xs text-red-500 mt-1">{fieldErrors[field]}</p>
    ) : null;
  };

  const roleOptions = [
    {
      value: "guardian" as Role,
      icon: "&#128106;",
      title: "보호자",
      desc: "환자를 대신하여 간병 서비스를 요청합니다",
    },
    {
      value: "caregiver" as Role,
      icon: "&#129657;",
      title: "간병인",
      desc: "전문 간병 서비스를 제공합니다",
    },
    {
      value: "hospital" as Role,
      icon: "&#127973;",
      title: "병원 / 기관",
      desc: "소속 환자의 간병을 관리합니다",
    },
  ];

  const toggleCertification = (cert: string) => {
    setCertifications((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  };

  // Step 1: Role selection
  if (step === 1) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
            <p className="text-gray-500 mt-1">가입 유형을 선택해 주세요</p>
          </div>

          <div className="space-y-4">
            {roleOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setRole(opt.value);
                  setStep(2);
                }}
                className={`w-full flex items-center gap-3 sm:gap-5 p-4 sm:p-6 rounded-2xl border-2 text-left transition-all hover:shadow-md ${
                  role === opt.value
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span
                  className="text-3xl sm:text-4xl flex-shrink-0"
                  dangerouslySetInnerHTML={{ __html: opt.icon }}
                />
                <div className="min-w-0">
                  <div className="font-bold text-gray-900 text-base sm:text-lg">{opt.title}</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-0.5">{opt.desc}</div>
                </div>
                <svg className="ml-auto shrink-0 text-gray-300" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            이미 회원이신가요?{" "}
            <Link href="/auth/login" className="text-primary-600 font-semibold hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Registration form
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-12 px-4">
      <div className="w-full max-w-2xl mx-auto">
        {/* Back button & header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors mb-4"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            유형 다시 선택
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {role === "guardian" && "보호자 회원가입"}
            {role === "caregiver" && "간병인 회원가입"}
            {role === "hospital" && "병원/기관 회원가입"}
          </h1>
          <p className="text-gray-500 mt-1">필수 정보를 입력해 주세요</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-8">
          {/* Global error message */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Common fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이름 *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="이름 입력"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                {getFieldError("name")}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">휴대폰 번호 *</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="010-0000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
                {getFieldError("phone")}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일 *</label>
              <input
                type="email"
                className="input-field"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {getFieldError("email")}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 *</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="8자 이상, 영문+숫자+특수문자"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                {getFieldError("password")}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 확인 *</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="비밀번호 재입력"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
                {passwordConfirm && password !== passwordConfirm && (
                  <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다</p>
                )}
                {getFieldError("password_confirmation")}
              </div>
            </div>

            {/* Hospital-specific fields */}
            {role === "hospital" && (
              <>
                <hr className="border-gray-100" />
                <h3 className="text-lg font-bold text-gray-900">기관 정보</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">기관명 *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="병원/기관 이름"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    required
                  />
                  {getFieldError("hospital_name")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">기관 주소 *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="주소 입력"
                    value={hospitalAddress}
                    onChange={(e) => setHospitalAddress(e.target.value)}
                    required
                  />
                  {getFieldError("hospital_address")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">사업자등록번호 *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="000-00-00000"
                    value={businessNumber}
                    onChange={(e) => setBusinessNumber(e.target.value)}
                    required
                  />
                  {getFieldError("business_number")}
                </div>
              </>
            )}

            {/* Caregiver-specific fields */}
            {role === "caregiver" && (
              <>
                <hr className="border-gray-100" />
                <h3 className="text-lg font-bold text-gray-900">간병인 정보</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">생년월일 *</label>
                    <input
                      type="date"
                      className="input-field"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      required
                    />
                    {getFieldError("birth_date")}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">성별 *</label>
                    <select
                      className="input-field"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      required
                    >
                      <option value="">선택하세요</option>
                      <option value="male">남성</option>
                      <option value="female">여성</option>
                    </select>
                    {getFieldError("gender")}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">국적 *</label>
                    <select
                      className="input-field"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      required
                    >
                      <option value="">선택하세요</option>
                      <option value="korean">한국</option>
                      <option value="chinese">중국 (조선족)</option>
                      <option value="other">기타</option>
                    </select>
                    {getFieldError("nationality")}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">경력 (년) *</label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="경력 년수"
                      min="0"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      required
                    />
                    {getFieldError("experience")}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">보유 자격증</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "요양보호사",
                      "간호조무사",
                      "사회복지사",
                      "물리치료사",
                      "작업치료사",
                      "간병사 교육 이수증",
                    ].map((cert) => (
                      <button
                        key={cert}
                        type="button"
                        onClick={() => toggleCertification(cert)}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border-2 transition-all ${
                          certifications.includes(cert)
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {certifications.includes(cert) && (
                          <span className="mr-1">&#10003;</span>
                        )}
                        {cert}
                      </button>
                    ))}
                  </div>
                  {getFieldError("certifications")}
                </div>

                {/* Verification notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                  <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    가입 후 인증이 필요합니다
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-blue-400">&#8226;</span>
                      <span><strong>신원 인증</strong>: 본인인증 및 신분증 확인</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-blue-400">&#8226;</span>
                      <span><strong>범죄 이력 조회</strong>: 범죄경력회보서 제출</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-blue-400">&#8226;</span>
                      <span><strong>자격증 등록</strong>: 관련 자격증 사본 업로드</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-blue-400">&#8226;</span>
                      <span><strong>건강검진</strong>: 최근 6개월 이내 건강검진 결과서</span>
                    </li>
                  </ul>
                  <p className="text-xs text-blue-600 mt-3">
                    모든 인증이 완료된 후에 간병 활동이 가능합니다.
                  </p>
                </div>
              </>
            )}

            {/* Referral code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">추천인 코드 (선택)</label>
              <input
                type="text"
                className="input-field"
                placeholder="추천인 코드 입력"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
              />
              {getFieldError("referral_code")}
            </div>

            {/* Terms */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-primary-500 border-gray-300 rounded focus:ring-primary-400"
                  required
                />
                <span className="text-sm text-gray-700">
                  <Link href="/terms" className="text-primary-600 underline">이용약관</Link>에 동의합니다 (필수)
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-primary-500 border-gray-300 rounded focus:ring-primary-400"
                  required
                />
                <span className="text-sm text-gray-700">
                  <Link href="/privacy" className="text-primary-600 underline">개인정보처리방침</Link>에 동의합니다 (필수)
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !agreeTerms || !agreePrivacy}
              className="btn-primary w-full py-3.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  가입 처리 중...
                </span>
              ) : (
                "회원가입"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          이미 회원이신가요?{" "}
          <Link href="/auth/login" className="text-primary-600 font-semibold hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
