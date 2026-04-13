import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/auth';

interface CareHistory {
  id: string;
  patientName: string;
  caregiverName: string;
  startDate: string;
  endDate: string;
  status: 'completed' | 'cancelled';
  totalAmount: number;
}

interface PaymentHistory {
  id: string;
  date: string;
  description: string;
  amount: number;
  method: string;
  status: 'completed' | 'pending' | 'refunded';
}

export default function MyPageScreen({ navigation }: any) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const userInfo = {
    name: '홍보호',
    email: 'guardian@example.com',
    phone: '010-1234-5678',
    type: '개인 간병',
    referralCode: 'CARE-HBH2026',
    points: 15000,
  };

  const patientInfo = {
    name: '홍길동',
    age: 72,
    gender: '남성',
    diagnosis: '뇌졸중',
  };

  const careHistories: CareHistory[] = [
    {
      id: '1',
      patientName: '홍길동',
      caregiverName: '김간병',
      startDate: '2026-03-01',
      endDate: '2026-03-15',
      status: 'completed',
      totalAmount: 2250000,
    },
    {
      id: '2',
      patientName: '홍길동',
      caregiverName: '이돌봄',
      startDate: '2026-01-10',
      endDate: '2026-01-20',
      status: 'completed',
      totalAmount: 1650000,
    },
  ];

  const paymentHistories: PaymentHistory[] = [
    {
      id: 'p1',
      date: '2026-04-05',
      description: '간병 서비스 (김간병)',
      amount: 1500000,
      method: '카드결제',
      status: 'completed',
    },
    {
      id: 'p2',
      date: '2026-03-01',
      description: '간병 서비스 (김간병)',
      amount: 2250000,
      method: '무통장입금',
      status: 'completed',
    },
  ];

  const handleShareReferral = async () => {
    try {
      await Share.share({
        message: `케어매치에서 간병 서비스를 이용해보세요!\n추천인 코드: ${userInfo.referralCode}\nhttps://cm.phantomdesign.kr/invite/${userInfo.referralCode}`,
      });
    } catch (error) {
      // handle error
    }
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          // Navigation will be handled by auth state change
        },
      },
    ]);
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <ScrollView style={styles.container}>
      {/* User Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Ionicons name="person" size={32} color="#FFFFFF" />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{userInfo.name}</Text>
          <Text style={styles.profileEmail}>{userInfo.email}</Text>
          <Text style={styles.profileType}>{userInfo.type}</Text>
        </View>
      </View>

      {/* Points & Referral */}
      <View style={styles.pointsRow}>
        <View style={styles.pointsCard}>
          <Ionicons name="gift" size={24} color="#F5A623" />
          <Text style={styles.pointsLabel}>보유 포인트</Text>
          <Text style={styles.pointsValue}>
            {userInfo.points.toLocaleString()}P
          </Text>
        </View>
        <TouchableOpacity style={styles.referralCard} onPress={handleShareReferral}>
          <Ionicons name="share-social" size={24} color="#4A90D9" />
          <Text style={styles.referralLabel}>추천인 코드</Text>
          <Text style={styles.referralCode}>{userInfo.referralCode}</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {/* Care History */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => toggleSection('careHistory')}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name="time-outline" size={22} color="#4A90D9" />
            <Text style={styles.menuItemText}>간병 이력</Text>
          </View>
          <Ionicons
            name={activeSection === 'careHistory' ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#CCC"
          />
        </TouchableOpacity>
        {activeSection === 'careHistory' && (
          <View style={styles.expandedSection}>
            {careHistories.map((history) => (
              <View key={history.id} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyPatient}>
                    {history.patientName} - {history.caregiverName}
                  </Text>
                  <View
                    style={[
                      styles.historyBadge,
                      {
                        backgroundColor:
                          history.status === 'completed' ? '#E8F5E9' : '#FFEBEE',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.historyBadgeText,
                        {
                          color:
                            history.status === 'completed' ? '#2ECC71' : '#E74C3C',
                        },
                      ]}
                    >
                      {history.status === 'completed' ? '완료' : '취소'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.historyDate}>
                  {history.startDate} ~ {history.endDate}
                </Text>
                <Text style={styles.historyAmount}>
                  {history.totalAmount.toLocaleString()}원
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Payment History */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => toggleSection('paymentHistory')}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name="card-outline" size={22} color="#2ECC71" />
            <Text style={styles.menuItemText}>결제 내역</Text>
          </View>
          <Ionicons
            name={activeSection === 'paymentHistory' ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#CCC"
          />
        </TouchableOpacity>
        {activeSection === 'paymentHistory' && (
          <View style={styles.expandedSection}>
            {paymentHistories.map((payment) => (
              <View key={payment.id} style={styles.paymentItem}>
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentDesc}>{payment.description}</Text>
                  <Text style={styles.paymentAmount}>
                    {payment.amount.toLocaleString()}원
                  </Text>
                </View>
                <View style={styles.paymentFooter}>
                  <Text style={styles.paymentDate}>{payment.date}</Text>
                  <Text style={styles.paymentMethod}>{payment.method}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Patient Info */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => toggleSection('patientInfo')}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name="medical-outline" size={22} color="#F5A623" />
            <Text style={styles.menuItemText}>환자 정보</Text>
          </View>
          <Ionicons
            name={activeSection === 'patientInfo' ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#CCC"
          />
        </TouchableOpacity>
        {activeSection === 'patientInfo' && (
          <View style={styles.expandedSection}>
            <View style={styles.patientInfoCard}>
              <View style={styles.patientInfoRow}>
                <Text style={styles.patientInfoLabel}>이름</Text>
                <Text style={styles.patientInfoValue}>{patientInfo.name}</Text>
              </View>
              <View style={styles.patientInfoRow}>
                <Text style={styles.patientInfoLabel}>나이</Text>
                <Text style={styles.patientInfoValue}>{patientInfo.age}세</Text>
              </View>
              <View style={styles.patientInfoRow}>
                <Text style={styles.patientInfoLabel}>성별</Text>
                <Text style={styles.patientInfoValue}>{patientInfo.gender}</Text>
              </View>
              <View style={styles.patientInfoRow}>
                <Text style={styles.patientInfoLabel}>진단명</Text>
                <Text style={styles.patientInfoValue}>{patientInfo.diagnosis}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Settings */}
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="notifications-outline" size={22} color="#999" />
            <Text style={styles.menuItemText}>알림 설정</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="help-circle-outline" size={22} color="#999" />
            <Text style={styles.menuItemText}>고객센터</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="document-text-outline" size={22} color="#999" />
            <Text style={styles.menuItemText}>이용약관</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#999" />
            <Text style={styles.menuItemText}>개인정보처리방침</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>케어매치 v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90D9',
    padding: 24,
    paddingTop: 16,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  profileType: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  pointsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: -20,
    marginBottom: 16,
  },
  pointsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  pointsLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
  pointsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F5A623',
    marginTop: 4,
  },
  referralCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  referralLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
  referralCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4A90D9',
    marginTop: 4,
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuItemText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  expandedSection: {
    backgroundColor: '#FAFBFC',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  historyItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyPatient: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historyBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  historyDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4A90D9',
  },
  paymentItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentDate: {
    fontSize: 12,
    color: '#888',
  },
  paymentMethod: {
    fontSize: 12,
    color: '#4A90D9',
  },
  patientInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  patientInfoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  patientInfoLabel: {
    fontSize: 13,
    color: '#888',
    width: 60,
  },
  patientInfoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFE0E0',
    marginBottom: 12,
  },
  logoutText: {
    fontSize: 15,
    color: '#E74C3C',
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#CCC',
    marginBottom: 32,
  },
});
