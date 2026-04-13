// ==========================================
// CareMatch 공유 타입 정의
// ==========================================

// 사용자 역할
export type UserRole = 'GUARDIAN' | 'CAREGIVER' | 'HOSPITAL' | 'ADMIN';
export type AuthProvider = 'LOCAL' | 'KAKAO' | 'NAVER';

// 간병인 상태
export type CaregiverStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'BLACKLISTED';
export type CaregiverWorkStatus = 'WORKING' | 'AVAILABLE' | 'IMMEDIATE';

// 환자 거동 상태
export type MobilityStatus = 'INDEPENDENT' | 'PARTIAL' | 'DEPENDENT';

// 간병 관련
export type CareType = 'INDIVIDUAL' | 'FAMILY';
export type CareScheduleType = 'FULL_TIME' | 'PART_TIME';
export type CareLocation = 'HOSPITAL' | 'HOME';
export type CareRequestStatus = 'OPEN' | 'MATCHING' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// 지원 상태
export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

// 계약 상태
export type ContractStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXTENDED';

// 결제 관련
export type PaymentMethod = 'BANK_TRANSFER' | 'CARD' | 'DIRECT';
export type PaymentStatus = 'PENDING' | 'ESCROW' | 'COMPLETED' | 'REFUNDED' | 'PARTIAL_REFUND' | 'FAILED';

// 알림 타입
export type NotificationType = 'MATCHING' | 'APPLICATION' | 'CONTRACT' | 'PAYMENT' | 'CARE_RECORD' | 'EXTENSION' | 'PENALTY' | 'SYSTEM';

// 패널티 타입
export type PenaltyType = 'NO_SHOW' | 'CANCELLATION' | 'COMPLAINT' | 'MANUAL';

// ==========================================
// API Response 타입
// ==========================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==========================================
// 엔티티 타입
// ==========================================

export interface User {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: UserRole;
  authProvider: AuthProvider;
  profileImage?: string;
  isActive: boolean;
  referralCode: string;
  points: number;
  createdAt: string;
}

export interface Guardian {
  id: string;
  userId: string;
  user: User;
}

export interface Caregiver {
  id: string;
  userId: string;
  user: User;
  status: CaregiverStatus;
  workStatus: CaregiverWorkStatus;
  identityVerified: boolean;
  criminalCheckDone: boolean;
  certificates: Certificate[];
  gender?: string;
  nationality?: string;
  birthDate?: string;
  address?: string;
  preferredRegions: string[];
  experienceYears: number;
  specialties: string[];
  totalMatches: number;
  avgRating: number;
  rehireRate: number;
  cancellationRate: number;
  penaltyCount: number;
  noShowCount: number;
  hasBadge: boolean;
  associationFee: number;
  educationCompleted: boolean;
}

export interface Certificate {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  imageUrl: string;
  verified: boolean;
}

export interface Patient {
  id: string;
  guardianId: string;
  name: string;
  birthDate: string;
  gender: string;
  mobilityStatus: MobilityStatus;
  hasDementia: boolean;
  hasInfection: boolean;
  infectionDetail?: string;
  medicalNotes?: string;
  weight?: number;
  height?: number;
  diagnosis?: string;
}

export interface CareRequest {
  id: string;
  guardianId: string;
  patientId: string;
  patient: Patient;
  careType: CareType;
  scheduleType: CareScheduleType;
  location: CareLocation;
  hospitalName?: string;
  address: string;
  startDate: string;
  endDate?: string;
  durationDays?: number;
  preferredGender?: string;
  preferredNationality?: string;
  specialRequirements?: string;
  medicalActAgreed: boolean;
  dailyRate?: number;
  hourlyRate?: number;
  status: CareRequestStatus;
}

export interface MatchScore {
  id: string;
  careRequestId: string;
  caregiverId: string;
  score: number;
  distanceScore: number;
  experienceScore: number;
  reviewScore: number;
  rehireScore: number;
  cancelPenalty: number;
}

export interface CareApplication {
  id: string;
  careRequestId: string;
  caregiverId: string;
  caregiver: Caregiver;
  status: ApplicationStatus;
  message?: string;
  expectedEarning?: number;
}

export interface Contract {
  id: string;
  careRequestId: string;
  guardianId: string;
  caregiverId: string;
  startDate: string;
  endDate: string;
  dailyRate: number;
  totalAmount: number;
  platformFee: number;
  taxRate: number;
  status: ContractStatus;
}

export interface Payment {
  id: string;
  contractId?: string;
  guardianId: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  pointsUsed: number;
  paidAt?: string;
}

export interface CareRecord {
  id: string;
  contractId: string;
  caregiverId: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  bodyTemp?: number;
  bloodPressure?: string;
  pulse?: number;
  meals?: string;
  medication?: string;
  excretion?: string;
  sleep?: string;
  mobility?: string;
  mentalState?: string;
  skinState?: string;
  notes?: string;
  photos: string[];
}

export interface Review {
  id: string;
  guardianId: string;
  caregiverId: string;
  contractId: string;
  rating: number;
  comment?: string;
  wouldRehire: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface PlatformConfig {
  individualFeePercent: number;
  individualFeeFixed: number;
  familyFeePercent: number;
  familyFeeFixed: number;
  taxRate: number;
  referralPoints: number;
  noShowPenaltyThreshold: number;
  badgeThreshold: number;
}

export interface MonthlyStats {
  year: number;
  month: number;
  totalRequests: number;
  totalMatches: number;
  totalRevenue: number;
  totalPlatformFee: number;
  activeCaregivers: number;
  activeGuardians: number;
  avgRating: number;
}
