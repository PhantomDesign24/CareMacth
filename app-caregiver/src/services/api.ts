import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { authService } from './auth';

// 도메인 중앙 관리 (shared/constants/index.ts 와 동일)
const DOMAIN = 'cm.phantomdesign.kr';
const BASE_URL = `https://${DOMAIN}/api`;

interface RetriableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      async (config) => {
        const token = await authService.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as RetriableRequestConfig | undefined;
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          const refreshToken = await authService.getRefreshToken();
          if (refreshToken) {
            try {
              const res = await axios.post(`${BASE_URL}/auth/refresh`, {
                refreshToken,
              });
              const tokenData = res.data?.data ?? res.data;
              const accessToken = tokenData?.accessToken ?? tokenData?.access_token ?? tokenData?.token;
              const nextRefreshToken = tokenData?.refreshToken ?? tokenData?.refresh_token ?? refreshToken;
              if (!accessToken) {
                throw new Error('No access token in refresh response');
              }
              await authService.setTokens(
                accessToken,
                nextRefreshToken
              );
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.client.request(originalRequest);
            } catch {
              await authService.logout();
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

// Caregiver API endpoints
export const caregiverApi = {
  // Auth
  login: (email: string, password: string) =>
    apiClient.post('/auth/caregiver/login', { email, password }),
  register: (data: Record<string, unknown>) =>
    apiClient.post('/auth/caregiver/register', data),
  kakaoLogin: (accessToken: string) =>
    apiClient.post('/auth/caregiver/kakao', { accessToken }),
  naverLogin: (accessToken: string) =>
    apiClient.post('/auth/caregiver/naver', { accessToken }),

  // Profile
  getProfile: () =>
    apiClient.get('/caregiver/profile'),
  updateProfile: (data: Record<string, unknown>) =>
    apiClient.put('/caregiver/profile', data),
  updateStatus: (workStatus: string) =>
    apiClient.put('/caregiver/work-status', { workStatus }),
  uploadCertification: (formData: FormData) =>
    apiClient.post('/caregiver/certifications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Jobs — 백엔드 /api/care-requests 라우트와 정합
  getMatchedJobs: () =>
    apiClient.get('/care-requests'),
  getJobDetail: (jobId: string) =>
    apiClient.get(`/care-requests/${jobId}`),
  applyForJob: (jobId: string, message?: string, proposedRate?: number) =>
    apiClient.post(`/care-requests/${jobId}/apply`, { message, proposedRate }),
  acceptJob: (jobId: string) =>
    apiClient.post(`/care-requests/${jobId}/apply`, { isAccepted: true }),
  rejectJob: (jobId: string) =>
    apiClient.delete(`/care-requests/${jobId}/apply`),

  // Work — 백엔드 라우트(/api/care-records/...) 와 정합
  checkIn: (contractId: string, location?: { latitude: number; longitude: number }) =>
    apiClient.post(`/care-records/check-in`, { contractId, ...(location || {}) }),
  checkOut: (contractId: string) =>
    apiClient.post(`/care-records/check-out`, { contractId }),
  submitCareLog: (contractId: string, data: Record<string, unknown>) =>
    apiClient.post(`/care-records/daily-log`, { contractId, ...data }),
  uploadPhoto: (formData: FormData) =>
    apiClient.post(`/care-records/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getCareRecords: (contractId: string) =>
    apiClient.get(`/care-records/${contractId}`),

  // Earnings
  getEarnings: () =>
    apiClient.get('/caregiver/earnings'),
  getEarningDetails: (month: string) =>
    apiClient.get(`/caregiver/earnings/${month}`),
  getSettlementHistory: () =>
    apiClient.get('/caregiver/settlements'),

  // Education — 백엔드 실제 라우트(/api/education) 와 매칭
  getCourses: () =>
    apiClient.get('/education'),
  updateProgress: (courseId: string, progress: number) =>
    apiClient.post(`/education/${courseId}/progress`, { progress }),
  heartbeat: (courseId: string, videoTime: number, duration: number, playing = true) =>
    apiClient.post(`/education/${courseId}/heartbeat`, { videoTime, duration, playing }),
  completeCourse: (courseId: string) =>
    apiClient.post(`/education/${courseId}/complete`),
  requestCertificate: (courseId: string) =>
    apiClient.get(`/education/certificate/${courseId}`),
  certificateDownloadUrl: (courseId: string) =>
    `/education/certificate/${courseId}/download`,

  // Penalties
  getPenalties: () =>
    apiClient.get('/caregiver/penalties'),

  // Activity History
  getActivityHistory: () =>
    apiClient.get('/caregiver/activity'),

  // Referral
  getReferralCode: () =>
    apiClient.get('/caregiver/referral-code'),
  applyReferralCode: (code: string) =>
    apiClient.post('/caregiver/referral', { code }),

  // Notifications
  getNotifications: () =>
    apiClient.get('/notifications'),
  markNotificationRead: (id: string) =>
    apiClient.put(`/notifications/${id}/read`),

  // FCM 토큰
  registerFcmToken: (fcmToken: string) =>
    apiClient.post('/notifications/fcm-token', { fcmToken }),
  removeFcmToken: () =>
    apiClient.delete('/notifications/fcm-token'),
};
