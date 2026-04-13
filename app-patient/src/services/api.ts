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

// Patient/Guardian API endpoints
export const patientApi = {
  // Auth
  login: (email: string, password: string) =>
    apiClient.post('/auth/patient/login', { email, password }),
  register: (data: Record<string, unknown>) =>
    apiClient.post('/auth/patient/register', data),
  kakaoLogin: (accessToken: string) =>
    apiClient.post('/auth/patient/kakao', { accessToken }),
  naverLogin: (accessToken: string) =>
    apiClient.post('/auth/patient/naver', { accessToken }),

  // Care Requests
  createCareRequest: (data: Record<string, unknown>) =>
    apiClient.post('/care-requests', data),
  getCareRequests: () =>
    apiClient.get('/care-requests/my'),
  getCareRequestDetail: (id: string) =>
    apiClient.get(`/care-requests/${id}`),
  cancelCareRequest: (id: string) =>
    apiClient.put(`/care-requests/${id}/cancel`),
  extendCareRequest: (id: string, data: Record<string, unknown>) =>
    apiClient.post(`/care-requests/${id}/extend`, data),

  // Caregivers
  getApplicants: (requestId: string) =>
    apiClient.get(`/care-requests/${requestId}/applicants`),
  getCaregiverProfile: (caregiverId: string) =>
    apiClient.get(`/caregivers/${caregiverId}/profile`),
  selectCaregiver: (requestId: string, caregiverId: string) =>
    apiClient.post(`/care-requests/${requestId}/select`, { caregiverId }),

  // Care Status
  getCareStatus: (careId: string) =>
    apiClient.get(`/care/${careId}/status`),
  getCareRecords: (careId: string) =>
    apiClient.get(`/care/${careId}/records`),
  getAttendanceRecords: (careId: string) =>
    apiClient.get(`/care/${careId}/attendance`),

  // Reviews
  createReview: (careId: string, data: Record<string, unknown>) =>
    apiClient.post(`/care/${careId}/review`, data),

  // Payments
  getPaymentMethods: () =>
    apiClient.get('/payments/methods'),
  createPayment: (data: Record<string, unknown>) =>
    apiClient.post('/payments', data),
  getPaymentHistory: () =>
    apiClient.get('/payments/history'),
  applyPoints: (paymentId: string, points: number) =>
    apiClient.post(`/payments/${paymentId}/points`, { points }),

  // My Page
  getProfile: () =>
    apiClient.get('/patient/profile'),
  updateProfile: (data: Record<string, unknown>) =>
    apiClient.put('/patient/profile', data),
  getCareHistory: () =>
    apiClient.get('/patient/care-history'),
  getPoints: () =>
    apiClient.get('/patient/points'),
  getReferralCode: () =>
    apiClient.get('/patient/referral-code'),
  applyReferralCode: (code: string) =>
    apiClient.post('/patient/referral', { code }),

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
