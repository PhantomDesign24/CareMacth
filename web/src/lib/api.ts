import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://cm.phantomdesign.kr/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach auth token + fix FormData content-type
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("cm_access_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // FormData를 보낼 때는 Content-Type을 지워야 axios가 boundary 포함해 자동 설정
      if (config.data instanceof FormData && config.headers) {
        delete config.headers["Content-Type"];
        delete (config.headers as any)["content-type"];
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor: handle 401 and token refresh
// 백엔드가 { success: true, data: ... } 래퍼를 일관적으로 사용하므로
// 성공 응답은 response.data를 실제 payload로 자동 언래핑한다.
// (호출부에서 res.data?.data 중복 작성 제거 목적)
api.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      "success" in body &&
      "data" in body
    ) {
      response.data = (body as { data: unknown }).data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("cm_refresh_token");
        if (!refreshToken) {
          logout();
          return Promise.reject(error);
        }

        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        // 백엔드 응답: { success, data: { access_token, refresh_token, token } }
        const payload = res.data?.data || res.data || {};
        const newAccess = payload.access_token || payload.token;
        const newRefresh = payload.refresh_token;
        if (!newAccess) {
          logout();
          return Promise.reject(error);
        }

        localStorage.setItem("cm_access_token", newAccess);
        if (newRefresh) localStorage.setItem("cm_refresh_token", newRefresh);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        }
        return api(originalRequest);
      } catch {
        logout();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Auth helpers
export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("cm_access_token", accessToken);
  localStorage.setItem("cm_refresh_token", refreshToken);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cm_access_token");
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

let loggingOut = false;
export function logout() {
  if (typeof window === "undefined") return;
  // 이미 로그아웃 중이면 중복 실행 방지 (401 무한루프 차단)
  if (loggingOut) return;
  loggingOut = true;
  localStorage.removeItem("cm_access_token");
  localStorage.removeItem("cm_refresh_token");
  localStorage.removeItem("user"); // 유저 상태도 함께 정리 (Header의 NotificationBell 등 재렌더 차단)
  // 이미 로그인 페이지면 이동 안함 (reload 루프 방지)
  if (!window.location.pathname.startsWith("/auth/login")) {
    window.location.href = "/auth/login?reason=session";
  }
}

// API endpoints
export const authAPI = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (data: Record<string, unknown>) =>
    api.post("/auth/register", data),
  kakaoLogin: (code: string) =>
    api.post("/auth/kakao", { code }),
  naverLogin: (code: string, state: string) =>
    api.post("/auth/naver", { code, state }),
  me: () => api.get("/auth/me"),
  deleteAccount: (password?: string, reason?: string) =>
    api.delete("/auth/me", { data: { password, reason } }),
  resetPassword: (email: string) =>
    api.post("/auth/reset-password", { email }),
};

export const regionStatsAPI = {
  get: () => api.get("/care-requests/region-stats"),
};

export const careRequestAPI = {
  create: (data: Record<string, unknown>) =>
    api.post("/care-requests", data),
  list: (params?: Record<string, unknown>) =>
    api.get("/care-requests", { params }),
  get: (id: string) =>
    api.get(`/care-requests/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/care-requests/${id}`, data),
  cancel: (id: string) =>
    api.delete(`/care-requests/${id}`),
  extend: (id: string, data: Record<string, unknown>) =>
    api.post(`/care-requests/${id}/extend`, data),
  raiseRate: (id: string, newDailyRate: number) =>
    api.post(`/care-requests/${id}/raise-rate`, { newDailyRate }),
  expandRegions: (id: string, regions: string[]) =>
    api.post(`/care-requests/${id}/expand-regions`, { regions }),
};

export const caregiverAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get("/caregiver/profile", { params }),
  get: (id: string) =>
    api.get(`/caregiver/profile`),
  updateStatus: (status: string) => {
    // Map frontend status values to Prisma CaregiverWorkStatus enum
    const statusMap: Record<string, string> = {
      working: 'WORKING', available: 'AVAILABLE', immediately: 'IMMEDIATE',
      WORKING: 'WORKING', AVAILABLE: 'AVAILABLE', IMMEDIATE: 'IMMEDIATE',
    };
    return api.put("/caregiver/work-status", { workStatus: statusMap[status] || status.toUpperCase() });
  },
  apply: (requestId: string) =>
    // 제시 금액 수락하고 지원 (isAccepted=true)
    api.post(`/care-requests/${requestId}/apply`, { isAccepted: true }),
  applyWithProposal: (requestId: string, data: { proposedRate?: number | null; isAccepted: boolean; message?: string }) =>
    api.post(`/care-requests/${requestId}/apply`, data),
  getEarnings: (params?: Record<string, unknown>) =>
    api.get("/caregiver/earnings", { params }),
  getPenalties: () =>
    api.get("/caregiver/penalties"),
  getActivity: (params?: Record<string, unknown>) =>
    api.get("/caregiver/activity", { params }),
  getMyApplications: () =>
    api.get("/caregiver/applications"),
  updateProfile: (data: Record<string, unknown>) =>
    api.put('/caregiver/profile', data),
  cancelApplication: (careRequestId: string) =>
    api.delete(`/care-requests/${careRequestId}/apply`),
};

export const paymentAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get("/payments/history", { params }),
  get: (id: string) =>
    api.get(`/payments/history`, { params: { id } }),
  create: (data: Record<string, unknown>) =>
    api.post("/payments", data),
  confirm: (data: Record<string, unknown>) =>
    api.post("/payments/confirm", data),
  refund: (id: string, reason: string, amount?: number) =>
    api.post(`/payments/${id}/refund`, { reason, ...(amount ? { amount } : {}) }),
  createAdditionalFee: (data: { contractId: string; amount: number; reason: string }) =>
    api.post("/payments/additional-fees", data),
  getAdditionalFees: () => api.get("/payments/additional-fees"),
  approveAdditionalFee: (id: string) => api.post(`/payments/additional-fees/${id}/approve`),
  rejectAdditionalFee: (id: string) => api.post(`/payments/additional-fees/${id}/reject`),
};

export const dashboardAPI = {
  guardianSummary: () =>
    api.get("/guardian").then((res) => res),
  caregiverSummary: () =>
    api.get("/caregiver/profile").then((res) => res),
};

export const guardianAPI = {
  getInfo: () => api.get("/guardian"),
  getPatients: () => api.get("/guardian/patients"),
  createPatient: (data: Record<string, unknown>) =>
    api.post("/guardian/patients", data),
  updatePatient: (id: string, data: Record<string, unknown>) =>
    api.put(`/guardian/patients/${id}`, data),
  getCareHistory: (params?: Record<string, unknown>) =>
    api.get("/guardian/care-history", { params }),
  getPayments: (params?: Record<string, unknown>) =>
    api.get("/guardian/payments", { params }),
};

export const documentAPI = {
  getProfile: () => api.get('/caregiver/profile'),
  updateProfile: (data: Record<string, unknown>) => api.put('/caregiver/profile', data),
  uploadCertificate: (formData: FormData) =>
    api.post('/caregiver/certificates', formData),
  uploadIdCard: (formData: FormData) =>
    api.post('/caregiver/id-card', formData),
  uploadCriminalCheck: (formData: FormData) =>
    api.post('/caregiver/criminal-check', formData),
};

export const careRecordAPI = {
  checkIn: (contractId: string, lat?: number, lng?: number) =>
    api.post('/care-records/check-in', { contractId, latitude: lat, longitude: lng }),
  checkOut: (contractId: string) =>
    api.post('/care-records/check-out', { contractId }),
  saveDailyLog: (data: Record<string, unknown>) =>
    api.post('/care-records/daily-log', data),
  uploadPhotos: (formData: FormData) =>
    // FormData는 axios가 boundary 포함한 Content-Type을 자동 설정 → 수동 지정 금지
    api.post('/care-records/photos', formData),
  list: (contractId: string, params?: Record<string, unknown>) =>
    api.get(`/care-records/${contractId}`, { params }),
};

export const extensionAPI = {
  extend: (contractId: string, data: { additionalDays: number; isNewCaregiver?: boolean }) =>
    api.post(`/contracts/${contractId}/extend`, data),
};

export const careRequestExtAPI = {
  raiseRate: (id: string, newDailyRate: number) =>
    api.post(`/care-requests/${id}/raise-rate`, { newDailyRate }),
  expandRegions: (id: string, regions: string[]) =>
    api.post(`/care-requests/${id}/expand-regions`, { regions }),
};

export const disputeAPI = {
  create: (data: {
    contractId?: string;
    category: string;
    title: string;
    description: string;
    evidence?: string[];
  }) => api.post("/disputes", data),
  list: () => api.get("/disputes"),
};

export const insuranceAPI = {
  create: (data: {
    patientName: string;
    birthDate: string;
    carePeriod: string;
    insuranceCompany: string;
    documentType: string;
  }) => api.post("/insurance", data),
  getStatus: (id: string) => api.get(`/insurance/${id}/status`),
  list: () => api.get("/insurance"),
};

export const notificationAPI = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put(`/notifications/all/read`),
  getPushSetting: () => api.get('/notifications/push-setting'),
  updatePushSetting: (enabled: boolean) =>
    api.put('/notifications/push-setting', { enabled }),
  updateCategoryPrefs: (prefs: Record<string, boolean>) =>
    api.put('/notifications/category-prefs', { prefs }),
};

export const contractAPI = {
  get: (id: string) => api.get(`/contracts/${id}`),
  cancel: (id: string, reason: string) =>
    api.post(`/contracts/${id}/cancel`, { reason }),
  updateCorporateName: (id: string, corporateName: string) =>
    api.patch(`/contracts/${id}/corporate-name`, { corporateName }),
  getPdfUrl: (id: string, token?: string) =>
    `/api/contracts/${id}/pdf?token=${encodeURIComponent(token || '')}`,
};

export const educationAPI = {
  list: () => api.get('/education'),
  heartbeat: (id: string, data: { videoTime: number; duration: number; playing: boolean }) =>
    api.post(`/education/${id}/heartbeat`, data),
  complete: (id: string) => api.post(`/education/${id}/complete`),
  updateProgress: (id: string, progress: number) =>
    api.post(`/education/${id}/progress`, { progress }),
  getCertificate: (id: string) => api.get(`/education/certificate/${id}`),
  getCertificatePdfUrl: (id: string, token?: string) =>
    `/api/education/certificate/${id}/pdf?token=${encodeURIComponent(token || '')}`,
};

export const applicantAPI = {
  getApplicants: (careRequestId: string) =>
    api.get(`/care-requests/${careRequestId}`),
  selectCaregiver: (careRequestId: string, caregiverId: string) =>
    api.post('/contracts', { careRequestId, caregiverId }),
};

export const reviewAPI = {
  create: (data: { contractId: string; rating: number; comment: string; wouldRehire: boolean }) =>
    api.post('/reviews', data),
  myReceived: () => api.get('/reviews/my'),
  myWritten: () => api.get('/reviews/written'),
  byCaregiver: (caregiverId: string) => api.get(`/reviews/caregiver/${caregiverId}`),
};

export const reportAPI = {
  create: (data: { targetType: string; targetId: string; reason: string; detail?: string }) =>
    api.post('/reports', data),
  myReports: () => api.get('/reports/my'),
  blockUser: (userId: string, reason?: string) =>
    api.post('/reports/blocks', { userId, reason }),
  unblockUser: (userId: string) =>
    api.delete(`/reports/blocks/${userId}`),
  myBlocks: () => api.get('/reports/blocks'),
};

export default api;
