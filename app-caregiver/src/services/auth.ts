import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'carematch_cg_access_token';
const REFRESH_TOKEN_KEY = 'carematch_cg_refresh_token';
const USER_DATA_KEY = 'carematch_cg_user_data';

export interface CaregiverData {
  id: string;
  email: string;
  name: string;
  phone: string;
  status: 'working' | 'available' | 'immediate';
  isApproved: boolean;
  rating: number;
  reviewCount: number;
  experience: number;
  certifications: string[];
  referralCode: string;
  createdAt: string;
}

class AuthService {
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }

  async setUserData(userData: CaregiverData): Promise<void> {
    await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(userData));
  }

  async getUserData(): Promise<CaregiverData | null> {
    try {
      const data = await SecureStore.getItemAsync(USER_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_DATA_KEY);
  }
}

export const authService = new AuthService();
