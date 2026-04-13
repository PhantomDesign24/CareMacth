import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { authService } from './auth';

const BASE_URL = 'https://api.carematch.co.kr/api/v1';

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
        if (error.response?.status === 401) {
          const refreshToken = await authService.getRefreshToken();
          if (refreshToken) {
            try {
              const res = await axios.post(`${BASE_URL}/auth/refresh`, {
                refreshToken,
              });
              await authService.setTokens(
                res.data.accessToken,
                res.data.refreshToken
              );
              if (error.config) {
                error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
                return this.client.request(error.config);
              }
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
  updateStatus: (status: string) =>
    apiClient.patch('/caregiver/status', { status }),
  uploadCertification: (formData: FormData) =>
    apiClient.post('/caregiver/certifications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Jobs
  getMatchedJobs: () =>
    apiClient.get('/caregiver/jobs/matched'),
  getJobDetail: (jobId: string) =>
    apiClient.get(`/caregiver/jobs/${jobId}`),
  applyForJob: (jobId: string) =>
    apiClient.post(`/caregiver/jobs/${jobId}/apply`),
  acceptJob: (jobId: string) =>
    apiClient.post(`/caregiver/jobs/${jobId}/accept`),
  rejectJob: (jobId: string) =>
    apiClient.post(`/caregiver/jobs/${jobId}/reject`),

  // Work
  checkIn: (careId: string, location?: { lat: number; lng: number }) =>
    apiClient.post(`/care/${careId}/check-in`, { location }),
  checkOut: (careId: string, location?: { lat: number; lng: number }) =>
    apiClient.post(`/care/${careId}/check-out`, { location }),
  submitCareLog: (careId: string, data: Record<string, unknown>) =>
    apiClient.post(`/care/${careId}/logs`, data),
  uploadPhoto: (careId: string, formData: FormData) =>
    apiClient.post(`/care/${careId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Earnings
  getEarnings: () =>
    apiClient.get('/caregiver/earnings'),
  getEarningDetails: (month: string) =>
    apiClient.get(`/caregiver/earnings/${month}`),
  getSettlementHistory: () =>
    apiClient.get('/caregiver/settlements'),

  // Education
  getCourses: () =>
    apiClient.get('/education/courses'),
  getCourseDetail: (courseId: string) =>
    apiClient.get(`/education/courses/${courseId}`),
  updateProgress: (courseId: string, progress: number) =>
    apiClient.post(`/education/courses/${courseId}/progress`, { progress }),
  requestCertificate: (courseId: string) =>
    apiClient.post(`/education/courses/${courseId}/certificate`),

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
