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

// Request interceptor: attach auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("cm_access_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor: handle 401 and token refresh
api.interceptors.response.use(
  (response) => response,
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

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        localStorage.setItem("cm_access_token", data.access_token);
        localStorage.setItem("cm_refresh_token", data.refresh_token);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
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

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("cm_access_token");
    localStorage.removeItem("cm_refresh_token");
    window.location.href = "/auth/login";
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
    api.post('/caregiver/certificates', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadIdCard: (formData: FormData) =>
    api.post('/caregiver/id-card', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadCriminalCheck: (formData: FormData) =>
    api.post('/caregiver/criminal-check', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const careRecordAPI = {
  checkIn: (contractId: string, lat?: number, lng?: number) =>
    api.post('/care-records/check-in', { contractId, latitude: lat, longitude: lng }),
  checkOut: (contractId: string) =>
    api.post('/care-records/check-out', { contractId }),
  saveDailyLog: (data: Record<string, unknown>) =>
    api.post('/care-records/daily-log', data),
  uploadPhotos: (formData: FormData) =>
    api.post('/care-records/photos', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list: (contractId: string, params?: Record<string, unknown>) =>
    api.get(`/care-records/${contractId}`, { params }),
};

export const extensionAPI = {
  extend: (contractId: string, data: { newEndDate: string; isNewCaregiver?: boolean; additionalAmount?: number }) =>
    api.post(`/contracts/${contractId}/extend`, data),
};

export const careRequestExtAPI = {
  raiseRate: (id: string, newDailyRate: number) =>
    api.post(`/care-requests/${id}/raise-rate`, { newDailyRate }),
  expandRegions: (id: string, regions: string[]) =>
    api.post(`/care-requests/${id}/expand-regions`, { regions }),
};

export const contractAPI = {
  get: (id: string) => api.get(`/contracts/${id}`),
  cancel: (id: string, reason: string) =>
    api.post(`/contracts/${id}/cancel`, { reason }),
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
