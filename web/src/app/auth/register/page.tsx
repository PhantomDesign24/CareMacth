"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authAPI, setTokens, notifyAppLogin } from "@/lib/api";
import { AxiosError } from "axios";

type Role = "guardian" | "caregiver" | "hospital" | "";

// 생년월일 셀렉트 — value 는 'YYYY-MM-DD' 문자열 (documents 페이지와 동일 UI)
function BirthDateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [y, m, d] = (value || "").split("-");
  const year = y || "";
  const month = m || "";
  const day = d || "";

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr: string[] = [];
    for (let yy = currentYear; yy >= currentYear - 100; yy--) arr.push(String(yy));
    return arr;
  }, [currentYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")), []);
  const daysInMonth = useMemo(() => {
    if (!year || !month) return 31;
    return new Date(Number(year), Number(month), 0).getDate();
  }, [year, month]);
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0")),
    [daysInMonth],
  );

  const update = (ny: string, nm: string, nd: string) => {
    if (!ny || !nm || !nd) { onChange(""); return; }
    const maxDay = new Date(Number(ny), Number(nm), 0).getDate();
    const safeDay = Math.min(Number(nd), maxDay);
    onChange(`${ny}-${nm}-${String(safeDay).padStart(2, "0")}`);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <select className="input-field" value={year} onChange={(e) => update(e.target.value, month, day)}>
        <option value="">년</option>
        {years.map((yy) => <option key={yy} value={yy}>{yy}</option>)}
      </select>
      <select className="input-field" value={month} onChange={(e) => update(year, e.target.value, day)}>
        <option value="">월</option>
        {months.map((mm) => <option key={mm} value={mm}>{Number(mm)}</option>)}
      </select>
      <select className="input-field" value={day} onChange={(e) => update(year, month, e.target.value)}>
        <option value="">일</option>
        {days.map((dd) => <option key={dd} value={dd}>{Number(dd)}</option>)}
      </select>
    </div>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 소셜 가입 모드 — signupToken 은 URL 미사용, sessionStorage('cm_signup_payload') 만 신뢰
  const social = searchParams.get("social"); // 'kakao' | 'naver' | 'apple' | null
  const [signupToken, setSignupToken] = useState("");
  const [signupPrefill, setSignupPrefill] = useState<{ email?: string; name?: string; phone?: string }>({});
  const isSocialMode = !!signupToken && (social === "kakao" || social === "naver" || social === "apple");
  // 소셜 배너 라벨/스타일 (카카오/네이버/애플)
  const socialLabel = social === "kakao" ? "카카오" : social === "apple" ? "Apple" : "네이버";
  const socialBannerStyle =
    social === "kakao"
      ? { backgroundColor: "#FFF9D6", borderColor: "#F5DC00", color: "#191919" }
      : social === "apple"
        ? { backgroundColor: "#F2F2F2", borderColor: "#000000", color: "#111111" }
        : { backgroundColor: "#E8F8EE", borderColor: "#03C75A", color: "#0A4F2C" };

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

  // 소셜 모드: sessionStorage 에서 signupToken/프리필 로드 (URL 미사용)
  useEffect(() => {
    if (social !== 'kakao' && social !== 'naver' && social !== 'apple') return;
    try {
      const raw = sessionStorage.getItem('cm_signup_payload');
      if (!raw) return;
      const payload = JSON.parse(raw) as {
        provider?: string; signupToken?: string; email?: string; name?: string; phone?: string; ts?: number;
      };
      // 5분 만료
      if (!payload.ts || Date.now() - payload.ts > 5 * 60 * 1000) {
        sessionStorage.removeItem('cm_signup_payload');
        return;
      }
      if (payload.provider !== social) return;
      if (payload.signupToken) setSignupToken(payload.signupToken);
      if (payload.email) setEmail(payload.email);
      if (payload.name) setName(payload.name);
      if (payload.phone) setPhone(payload.phone);
      setSignupPrefill({ email: payload.email, name: payload.name, phone: payload.phone });
    } catch {}
  }, [social]);

  // void unused 경고 회피용
  void signupPrefill;

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

    if (!isSocialMode && password !== passwordConfirm) {
      setFieldErrors({ passwordConfirm: "비밀번호가 일치하지 않습니다" });
      return;
    }

    if (!isSocialMode) {
      const pwOk = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
      if (!pwOk) {
        setFieldErrors({ password: "비밀번호는 8자 이상, 영문·숫자·특수문자를 모두 포함해야 합니다." });
        return;
      }
    }

    setLoading(true);

    try {
      // Map frontend role to Prisma UserRole enum (GUARDIAN/CAREGIVER/HOSPITAL)
      const roleMap: Record<string, string> = { guardian: 'GUARDIAN', caregiver: 'CAREGIVER', hospital: 'HOSPITAL' };
      const resolvedRole = roleMap[role] || role.toUpperCase();

      // Map frontend gender to Prisma format (M/F)
      const genderMap: Record<string, string> = { male: 'M', female: 'F', '남성': 'M', '여성': 'F' };
      const resolvedGender = genderMap[gender?.toLowerCase()] || gender;

      // 소셜 가입: signupToken 으로 백엔드가 socialId/provider 를 신뢰. 비번 불필요.
      if (isSocialMode) {
        const socialPayload: Record<string, unknown> = {
          signupToken,
          role: resolvedRole,
          name,
          phone,
          referralCode: referralCode || undefined,
        };
        if (role === "caregiver") {
          socialPayload.birthDate = birthDate;
          socialPayload.gender = resolvedGender;
          socialPayload.experience = experience;
          socialPayload.nationality = nationality;
          socialPayload.certifications = certifications;
        }
        if (role === "hospital") {
          socialPayload.hospitalName = hospitalName;
          socialPayload.hospitalAddress = hospitalAddress;
          socialPayload.businessNumber = businessNumber;
        }
        const { data: socialData } = await authAPI.socialSignupComplete(socialPayload);
        if (socialData.access_token) {
          setTokens(socialData.access_token, socialData.refresh_token || "");
        }
        if (socialData.user) {
          // Header / 다른 컴포넌트가 읽는 'user' 키와 결제 페이지가 읽는 'cm_user' 키 둘 다 채움
          localStorage.setItem("user", JSON.stringify(socialData.user));
          localStorage.setItem("cm_user", JSON.stringify(socialData.user));
          notifyAppLogin(socialData.user, socialData.access_token);
        }
        router.push(`/auth/register/complete?role=${resolvedRole}&name=${encodeURIComponent(name)}`);
        return;
      }

      const payload: Record<string, unknown> = {
        name,
        email,
        phone,
        password,
        role: resolvedRole,
        referredBy: referralCode || undefined,
      };

      if (role === "caregiver") {
        payload.birthDate = birthDate || undefined;
        payload.gender = resolvedGender || undefined;
        payload.experienceYears = experience ? parseInt(experience) : undefined;
        payload.nationality = nationality || undefined;
        payload.specialties = Array.isArray(certifications) ? certifications : undefined;
      }

      if (role === "hospital") {
        payload.hospitalName = hospitalName;
        payload.address = hospitalAddress;
        payload.businessNumber = businessNumber || undefined;
      }

      payload.agreeTerms = agreeTerms;
      payload.agreePrivacy = agreePrivacy;

      const { data } = await authAPI.register(payload);

      // Store tokens and user info
      if (data.access_token) {
        setTokens(data.access_token, data.refresh_token || "");
      }
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("cm_user", JSON.stringify(data.user));
        notifyAppLogin(data.user, data.access_token);
      }

      // 가입 완료 페이지로 이동 (역할별 다음 액션 안내)
      router.push(`/auth/register/complete?role=${resolvedRole}&name=${encodeURIComponent(name)}`);
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response) {
        const respData = err.response.data;
        // 409 충돌 — 이미 가입된 소셜/이메일/전화번호. 사용자에게 안내하고 로그인 페이지로 자동 이동.
        if (err.response.status === 409) {
          const msg = respData?.message || '이미 가입된 계정입니다. 로그인 페이지로 이동합니다.';
          setErrorMessage(msg);
          // sessionStorage 의 stale signupToken/payload 정리 (재시도 루프 방지)
          try { sessionStorage.removeItem('cm_signup_payload'); } catch {}
          try { sessionStorage.removeItem('kakao_oauth_state'); } catch {}
          try { sessionStorage.removeItem('naver_oauth_state'); } catch {}
          setTimeout(() => router.push('/auth/login'), 1500);
          return;
        }
        // 입력 검증 오류 — express-validator(400, errors 배열) + 전통적 422(errors 객체) 둘 다 처리
        if ((err.response.status === 400 || err.response.status === 422) && respData?.errors) {
          const errors: Record<string, string> = {};
          if (Array.isArray(respData.errors)) {
            // express-validator: [{ path, msg, ... }, ...]
            for (const e of respData.errors) {
              const field = (e?.path || e?.param) as string | undefined;
              const msg = (e?.msg || e?.message) as string | undefined;
              if (field && msg && !errors[field]) errors[field] = msg;
            }
          } else if (typeof respData.errors === 'object') {
            // 422: { field: ['msg'] }
            for (const [field, messages] of Object.entries(respData.errors)) {
              errors[field] = Array.isArray(messages) ? messages[0] : String(messages);
            }
          }
          setFieldErrors(errors);
          // 첫 번째 오류 메시지를 상단에도 표시
          const firstMsg = Object.values(errors)[0];
          setErrorMessage(respData.message || firstMsg || "입력 정보를 확인해 주세요.");
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
      icon: "👪",
      title: "보호자",
      desc: "환자를 대신하여 간병 서비스를 요청합니다",
    },
    {
      value: "caregiver" as Role,
      icon: "🧑‍⚕️",
      title: "간병인",
      desc: "전문 간병 서비스를 제공합니다",
    },
    {
      value: "hospital" as Role,
      icon: "🏥",
      title: "병원 / 기관",
      desc: "소속 환자의 간병을 관리합니다",
    },
  ];

  const toggleCertification = (cert: string) => {
    setCertifications((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  };

  // 소셜 가입 시작: 콜백에서 다시 register 로 돌아오면 isSocialMode 가 true 가 됨
  const startKakaoSignup = () => {
    const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID || "";
    const redirectUri = `${window.location.origin}/auth/kakao/callback`;
    if (!clientId) {
      setErrorMessage("NEXT_PUBLIC_KAKAO_CLIENT_ID 환경변수가 설정되지 않았습니다.");
      return;
    }
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    const state = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('kakao_oauth_state', state);
    const url = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=account_email,profile_nickname&state=${state}`;
    window.location.href = url;
  };
  const startNaverSignup = () => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || "";
    const redirectUri = `${window.location.origin}/auth/naver/callback`;
    if (!clientId) {
      setErrorMessage("NEXT_PUBLIC_NAVER_CLIENT_ID 환경변수가 설정되지 않았습니다.");
      return;
    }
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    const state = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem("naver_oauth_state", state);
    const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    window.location.href = url;
  };

  // 애플 가입 시작 — JS SDK 팝업으로 id_token 획득 → /auth/apple → 신규면 가입 모드 진입
  const startAppleSignup = async () => {
    const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "";
    if (!clientId) {
      setErrorMessage("NEXT_PUBLIC_APPLE_CLIENT_ID 환경변수가 설정되지 않았습니다.");
      return;
    }
    try {
      const AppleID = await new Promise<any>((resolve, reject) => {
        const w = window as any;
        if (w.AppleID?.auth) return resolve(w.AppleID);
        const ex = document.getElementById("apple-signin-sdk");
        if (ex) { ex.addEventListener("load", () => resolve((window as any).AppleID)); ex.addEventListener("error", reject); return; }
        const s = document.createElement("script");
        s.id = "apple-signin-sdk";
        s.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
        s.async = true;
        s.onload = () => resolve((window as any).AppleID);
        s.onerror = reject;
        document.head.appendChild(s);
      });
      AppleID.auth.init({ clientId, scope: "name email", redirectURI: `${window.location.origin}/auth/login`, usePopup: true });
      const result = await AppleID.auth.signIn();
      const identityToken = result?.authorization?.id_token;
      if (!identityToken) { setErrorMessage("애플 인증 토큰을 받지 못했습니다."); return; }
      const u = result?.user;
      const appleName = u?.name ? `${u.name.lastName || ""}${u.name.firstName || ""}`.trim() || undefined : undefined;
      const res = await fetch("/api/auth/apple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityToken, name: appleName }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.code === "PROVIDER_CONFLICT") { setErrorMessage(data.message || "이미 다른 방식으로 가입된 계정입니다."); return; }
        setErrorMessage(data.message || "애플 로그인 처리에 실패했습니다.");
        return;
      }
      // 기존 사용자 → 바로 로그인
      if (data.data.access_token) {
        setTokens(data.data.access_token, data.data.refresh_token || "");
        if (data.data.user) {
          localStorage.setItem("user", JSON.stringify(data.data.user));
          localStorage.setItem("cm_user", JSON.stringify(data.data.user));
          notifyAppLogin(data.data.user, data.data.access_token);
        }
        const r = data.data.user?.role;
        window.location.href = r === "CAREGIVER" ? "/dashboard/caregiver" : "/dashboard/guardian";
        return;
      }
      // 신규 → 가입 모드 진입 (payload 저장 후 ?social=apple)
      if (data.data.isNew) {
        try {
          sessionStorage.setItem("cm_signup_payload", JSON.stringify({
            provider: "apple",
            signupToken: data.data.signupToken || "",
            email: data.data.email || "",
            name: data.data.name || appleName || "",
            phone: "",
            ts: Date.now(),
          }));
        } catch {}
        router.replace("/auth/register?social=apple");
        return;
      }
    } catch (err: any) {
      if (err?.error === "popup_closed_by_user" || err?.error === "user_cancelled_authorize") return;
      setErrorMessage("애플 로그인에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // Step 1: Role selection
  if (step === 1) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="w-full max-w-lg">
          {isSocialMode && (
            <div
              className="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm"
              style={socialBannerStyle}
            >
              <span className="font-semibold">{socialLabel} 계정으로 가입 진행 중</span>
            </div>
          )}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
            <p className="text-gray-500 mt-1">가입 유형을 선택해 주세요</p>
          </div>

          {/* 소셜 빠른 가입 (이메일 + 닉네임 자동 가져오기) */}
          {!isSocialMode && (
            <>
              <div className="space-y-3 mb-6">
                <button
                  type="button"
                  onClick={startKakaoSignup}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-medium transition-colors text-sm hover:opacity-90"
                  style={{ backgroundColor: "#FEE500", color: "#191919" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
                    <path d="M12 3C6.48 3 2 6.58 2 10.94c0 2.8 1.87 5.27 4.68 6.67-.2.77-.74 2.8-.85 3.24-.13.55.2.54.43.39.17-.12 2.77-1.88 3.89-2.65.59.09 1.2.13 1.85.13 5.52 0 10-3.58 10-7.78S17.52 3 12 3z" />
                  </svg>
                  카카오로 빠른 가입
                </button>
                <button
                  type="button"
                  onClick={startNaverSignup}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-medium transition-colors text-sm text-white hover:opacity-90"
                  style={{ backgroundColor: "#03C75A" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727z" />
                  </svg>
                  네이버로 빠른 가입
                </button>
                <button
                  type="button"
                  onClick={startAppleSignup}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-medium transition-colors text-sm text-white hover:opacity-90"
                  style={{ backgroundColor: "#000000" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.89-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.3 10.41.86 1.26 1.89 2.67 3.24 2.62 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.55.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.72-1.04-2.75-4.13zM14.53 4.42c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.08 3.18 1.15.09 2.32-.58 3.03-1.45z" />
                  </svg>
                  Apple로 빠른 가입
                </button>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">또는 이메일로 가입</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </>
          )}

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
                <span className="text-3xl sm:text-4xl flex-shrink-0">{opt.icon}</span>
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
        {isSocialMode && (
          <div
            className="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm"
            style={socialBannerStyle}
          >
            <span className="font-semibold">{socialLabel} 계정으로 가입 진행 중</span>
          </div>
        )}
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
            {isSocialMode && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                {socialLabel} 계정으로 가입합니다. 비밀번호 없이 다음에도 같은 계정으로 로그인할 수 있습니다.
              </div>
            )}

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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                이메일 {isSocialMode ? '' : '*'}
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={!isSocialMode}
                readOnly={isSocialMode && !!email}
              />
              {getFieldError("email")}
            </div>

            {!isSocialMode && (
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
            )}

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
                    <BirthDateSelect value={birthDate} onChange={setBirthDate} />
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
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">이용약관</a>에 동의합니다 (필수)
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
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">개인정보처리방침</a>에 동의합니다 (필수)
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

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    }>
      <RegisterPageInner />
    </Suspense>
  );
}
