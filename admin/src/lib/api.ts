const API_BASE_URL = "/api";

const TOKEN_KEY = "token"; // 홈페이지와 동일한 키 사용

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("user");
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, params } = options;

  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  const token = getToken();
  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.reload();
    }
    throw new ApiError(401, "인증이 만료되었습니다. 다시 로그인해주세요.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorData.message || "요청 처리 중 오류가 발생했습니다.");
  }

  // Handle empty responses (204 No Content, etc.)
  const text = await response.text();
  if (!text) return {} as T;
  const json = JSON.parse(text);
  // 백엔드가 { success, data } 래퍼를 사용하므로 data만 반환
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

async function apiDownload(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<Blob> {
  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const requestHeaders: Record<string, string> = {};
  const token = getToken();
  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers: requestHeaders });

  if (response.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.reload();
    }
    throw new ApiError(401, "인증이 만료되었습니다.");
  }

  if (!response.ok) {
    throw new ApiError(response.status, "다운로드 중 오류가 발생했습니다.");
  }

  return response.blob();
}

// ─── Auth ─────────────────────────────────────────────
export async function login(email: string, password: string) {
  const res = await apiRequest<{ success: boolean; data: { token: string; user: any } }>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return res.data || res;
}

// ─── Dashboard ────────────────────────────────────────
export async function getDashboard() {
  return apiRequest<DashboardData>("/admin/dashboard");
}

// ─── Caregivers ───────────────────────────────────────
export async function getCaregivers(params?: { status?: string; search?: string; page?: number; limit?: number; region?: string; minExp?: number; maxExp?: number; workStatus?: string }) {
  return apiRequest<PaginatedResponse<Caregiver>>("/admin/caregivers", {
    params: params as Record<string, string | number>,
  });
}

export async function getCaregiver(id: string) {
  return apiRequest<CaregiverDetail>(`/admin/caregivers/${id}`);
}

export async function approveCaregiver(id: string) {
  return apiRequest(`/admin/caregivers/${id}/approve`, { method: "PUT" });
}

export async function rejectCaregiver(id: string) {
  return apiRequest(`/admin/caregivers/${id}/reject`, { method: "PUT" });
}

export async function blacklistCaregiver(id: string) {
  return apiRequest(`/admin/caregivers/${id}/blacklist`, { method: "PUT" });
}

export async function toggleBadge(id: string) {
  return apiRequest(`/admin/caregivers/${id}/badge`, { method: "PUT" });
}

export async function addPenalty(id: string, data: { type: string; reason: string }) {
  return apiRequest(`/admin/caregivers/${id}/penalty`, { method: "POST", body: data });
}

export async function addMemo(id: string, content: string) {
  return apiRequest(`/admin/caregivers/${id}/memo`, { method: "POST", body: { content } });
}

export async function verifyCertificate(caregiverId: string, certId: string) {
  return apiRequest(`/admin/caregivers/${caregiverId}/certificates/${certId}/verify`, { method: "PUT" });
}

// ─── Notifications ───────────────────────────────────
export async function getAdminNotifications(params?: { type?: string; page?: number; limit?: number }) {
  return apiRequest<AdminNotificationsResponse>("/admin/notifications", {
    params: params as Record<string, string | number>,
  });
}

export async function sendAdminNotification(data: { target: string; userId?: string; title: string; body: string; type?: string }) {
  return apiRequest("/admin/notifications/send", { method: "POST", body: data });
}

export async function deleteUnsentNotifications() {
  return apiRequest("/admin/notifications/unsent", { method: "DELETE" });
}

// ─── Patients ─────────────────────────────────────────
export async function getPatients(params?: { search?: string; status?: string; page?: number; limit?: number; gender?: string; mobilityStatus?: string }) {
  return apiRequest<PaginatedResponse<Patient>>("/admin/patients", {
    params: params as Record<string, string | number>,
  });
}

// ─── Stats ────────────────────────────────────────────
export async function getStats(params?: { year?: string | number }) {
  return apiRequest<StatsData>("/admin/stats", {
    params: params as Record<string, string | number>,
  });
}

export async function exportCaregivers() {
  return apiDownload("/admin/stats/export/caregivers");
}

// ─── Disputes ─────────────────────────────────────────
export async function getDisputes(params?: { status?: string; priority?: string; page?: number; limit?: number }) {
  return apiRequest<PaginatedResponse<Dispute>>("/admin/disputes", {
    params: params as Record<string, string | number>,
  });
}

export async function emergencyRematch(contractId: string) {
  return apiRequest(`/admin/emergency-rematch/${contractId}`, { method: "POST" });
}

// ─── Platform Config ──────────────────────────────────
export async function getPlatformConfig() {
  const raw = await apiRequest<PlatformSettings>("/admin/platform-config");
  // Normalize API field names to frontend field names
  return {
    ...raw,
    oneOnOneFeePercentage: raw.oneOnOneFeePercentage ?? raw.individualFeePercent,
    oneOnOneFeeFixed: raw.oneOnOneFeeFixed ?? raw.individualFeeFixed,
    familyCareFeePercentage: raw.familyCareFeePercentage ?? raw.familyFeePercent,
    familyCareFeeFixed: raw.familyCareFeeFixed ?? raw.familyFeeFixed,
    referralPointAmount: raw.referralPointAmount ?? raw.referralPoints,
    excellentBadgeThreshold: raw.excellentBadgeThreshold ?? raw.badgeThreshold,
  } as PlatformSettings;
}

export async function updatePlatformConfig(data: Partial<PlatformSettings>) {
  // Send both frontend and API field names for compatibility
  const payload = {
    ...data,
    individualFeePercent: data.oneOnOneFeePercentage ?? data.individualFeePercent,
    individualFeeFixed: data.oneOnOneFeeFixed ?? data.individualFeeFixed,
    familyFeePercent: data.familyCareFeePercentage ?? data.familyFeePercent,
    familyFeeFixed: data.familyCareFeeFixed ?? data.familyFeeFixed,
    referralPoints: data.referralPointAmount ?? data.referralPoints,
    badgeThreshold: data.excellentBadgeThreshold ?? data.badgeThreshold,
  };
  return apiRequest("/admin/platform-config", { method: "PUT", body: payload });
}

// ─── Promotions ───────────────────────────────────────
export async function getPromotions() {
  const raw = await apiRequest<PromotionsData>("/admin/promotions");
  // Normalize API field names (currentPromotions -> promotions)
  return {
    ...raw,
    promotions: raw.promotions || (raw as any).currentPromotions || [],
    referralPoints: raw.referralPoints,
    referralAutoApply: raw.referralAutoApply,
  } as PromotionsData;
}

export async function updatePromotions(data: PromotionsData) {
  return apiRequest("/admin/promotions", { method: "PUT", body: data });
}

// ─── Education (Admin) ───────────────────────────────
export async function getAdminEducations() {
  return apiRequest<AdminEducationResponse>("/admin/education");
}

export async function createEducation(data: { title: string; description?: string; videoUrl?: string; duration: number; order?: number }) {
  return apiRequest<EducationCourse>("/admin/education", { method: "POST", body: data });
}

export async function updateEducation(id: string, data: { title?: string; description?: string; videoUrl?: string; duration?: number; order?: number; isActive?: boolean }) {
  return apiRequest<EducationCourse>(`/admin/education/${id}`, { method: "PUT", body: data });
}

export async function deleteEducation(id: string) {
  return apiRequest(`/admin/education/${id}`, { method: "DELETE" });
}

// ─── Payments / Settlements ──────────────────────────
export async function getAdminPayments(params?: { status?: string; startDate?: string; endDate?: string; search?: string; page?: number; limit?: number }) {
  return apiRequest<AdminPaymentsResponse>("/admin/payments", {
    params: params as Record<string, string | number>,
  });
}

export async function getAdminSettlements(params?: { status?: string; period?: string; page?: number; limit?: number }) {
  return apiRequest<AdminSettlementsResponse>("/admin/settlements", {
    params: params as Record<string, string | number>,
  });
}

export async function exportPayments(params?: { startDate?: string; endDate?: string; status?: string }) {
  return apiDownload("/admin/stats/export", params as Record<string, string>);
}

// ─── Types ────────────────────────────────────────────

export interface DashboardData {
  newRequests?: number;
  matchesCompleted?: number;
  revenue?: number;
  activeCaregivers?: number;
  pendingApprovals?: number;
  activeDisputes?: number;
  newRequestsDelta?: number;
  matchesDelta?: number;
  revenueDelta?: number;
  monthlyRevenue?: number;
  monthlyRevenueDelta?: number;
  pendingCaregivers?: Caregiver[];
  recentDisputes?: Dispute[];
  [key: string]: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Caregiver {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status: string;
  associationFee?: number;
  associationFeePaid?: boolean;
  totalMatchings?: number;
  period?: string;
  penaltyCount?: number;
  penaltyTotal?: number;
  rating?: number;
  hasBadge?: boolean;
  createdAt?: string;
  lastMemo?: string;
  appliedAt?: string;
  certificates?: number;
  [key: string]: unknown;
}

export interface CaregiverDetail extends Caregiver {
  profileImage?: string;
  address?: string;
  birthDate?: string;
  gender?: string;
  introduction?: string;
  specialties?: string[];
  reviews?: Review[];
  penalties?: Penalty[];
  memos?: CounselingMemo[];
}

export interface Review {
  id: string;
  rating: number;
  content: string;
  patientName: string;
  createdAt: string;
}

export interface Penalty {
  id: string;
  type: string;
  reason: string;
  amount: number;
  createdAt: string;
  createdBy: string;
}

export interface CounselingMemo {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export interface Patient {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  condition?: string;
  careType?: string;
  totalMatchings?: number;
  totalSpent?: number;
  totalFees?: number;
  registeredAt?: string;
  status?: string;
  [key: string]: unknown;
}

export interface Dispute {
  id: string;
  matchingId?: string;
  contractId?: string;
  patientName?: string;
  caregiverName?: string;
  type?: string;
  description?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
  resolvedAt?: string;
  resolution?: string;
  [key: string]: unknown;
}

export interface StatsData {
  period?: string;
  totalMatchings?: number;
  totalRevenue?: number;
  totalFees?: number;
  newCaregivers?: number;
  newPatients?: number;
  averageRating?: number;
  disputeRate?: number;
  monthlyData?: MonthlyStats[];
  [key: string]: unknown;
}

export interface MonthlyStats {
  month: string;
  matchings: number;
  revenue: number;
  fees: number;
  disputes: number;
  newCaregivers?: number;
  newPatients?: number;
  [key: string]: unknown;
}

export interface PlatformSettings {
  oneOnOneFeePercentage?: number;
  oneOnOneFeeFixed?: number;
  familyCareFeePercentage?: number;
  familyCareFeeFixed?: number;
  taxRate?: number;
  referralPointAmount?: number;
  noShowPenaltyThreshold?: number;
  excellentBadgeThreshold?: number;
  // API field aliases
  individualFeePercent?: number;
  individualFeeFixed?: number;
  familyFeePercent?: number;
  familyFeeFixed?: number;
  referralPoints?: number;
  badgeThreshold?: number;
  [key: string]: unknown;
}

export interface Promotion {
  id: string;
  code: string;
  description: string;
  type: string;
  value: number;
  isActive: boolean;
  autoApply: boolean;
  usageCount: number;
  maxUsage: number;
  startDate: string;
  endDate: string;
  [key: string]: unknown;
}

export interface PromotionsData {
  promotions?: Promotion[];
  referralPoints?: number;
  referralAutoApply?: boolean;
  [key: string]: unknown;
}

export interface AdminPayment {
  id: string;
  contractId: string | null;
  patientName: string;
  caregiverName: string;
  guardianName: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  method: string;
  paidAt: string | null;
  createdAt: string;
  refundAmount: number | null;
  refundedAt: string | null;
}

export interface PaymentsSummary {
  monthlyTotal: number;
  monthlyFees: number;
  pendingSettlements: number;
  monthlyRefunds: number;
}

export interface AdminPaymentsResponse {
  payments: AdminPayment[];
  summary: PaymentsSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminSettlement {
  id: string;
  caregiverName: string;
  caregiverId: string;
  contractId: string | null;
  amount: number;
  platformFee: number;
  taxAmount: number;
  netAmount: number;
  isPaid: boolean;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminSettlementsResponse {
  settlements: AdminSettlement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EducationCourse {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  duration: number;
  order: number;
  isActive: boolean;
  enrolledCount: number;
  completedCount: number;
  completionRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface EducationSummary {
  totalCourses: number;
  totalCompleted: number;
  averageCompletionRate: number;
}

export interface AdminEducationResponse {
  courses: EducationCourse[];
  summary: EducationSummary;
}

export interface AdminNotification {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface AdminNotificationsResponse {
  notifications: AdminNotification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export { ApiError };
