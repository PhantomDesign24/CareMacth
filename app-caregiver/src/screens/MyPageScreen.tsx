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

interface PenaltyItem {
  id: string;
  reason: string;
  date: string;
  type: 'warning' | 'deduction';
  amount?: number;
}

interface ActivityItem {
  id: string;
  patientName: string;
  location: string;
  startDate: string;
  endDate: string;
  status: 'completed' | 'cancelled';
  earnings: number;
}

export default function MyPageScreen({ navigation }: any) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const profile = {
    name: '김간병',
    email: 'caregiver@example.com',
    phone: '010-9876-5432',
    status: 'approved' as const,
    hasBadge: true,
    monthlyEarning: 3250000,
    totalEarning: 28750000,
    totalMatches: 48,
    avgRating: 4.8,
    rehireRate: 0.92,
    penaltyCount: 1,
    referralCode: 'CG-KGB2026',
  };

  const certifications = [
    { name: '요양보호사 1급', issuedAt: '2020-05-15', status: 'verified' },
    { name: '간병사 자격증', issuedAt: '2019-08-20', status: 'verified' },
    { name: '응급처치 수료', issuedAt: '2024-01-10', status: 'pending' },
  ];

  const penalties: PenaltyItem[] = [
    {
      id: 'p1',
      reason: '무단 지각 (2회)',
      date: '2026-02-15',
      type: 'warning',
    },
  ];

  const activities: ActivityItem[] = [
    {
      id: 'a1',
      patientName: '홍길동',
      location: '서울대학교병원',
      startDate: '2026-03-01',
      endDate: '2026-03-15',
      status: 'completed',
      earnings: 2250000,
    },
    {
      id: 'a2',
      patientName: '이영희',
      location: '세브란스병원',
      startDate: '2026-01-10',
      endDate: '2026-01-25',
      status: 'completed',
      earnings: 2400000,
    },
  ];

  const handleShareReferral = async () => {
    try {
      await Share.share({
        message: `케어매치에서 간병인으로 활동해보세요!\n추천인 코드: ${profile.referralCode}\nhttps://cm.phantomdesign.kr/caregiver/invite/${profile.referralCode}`,
      });
    } catch {
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
        },
      },
    ]);
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return '활동 중';
      case 'pending': return '승인 대기';
      case 'suspended': return '활동 정지';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#2ECC71';
      case 'pending': return '#F5A623';
      case 'suspended': return '#E74C3C';
      default: return '#999';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.avatarText}>{profile.name[0]}</Text>
        </View>
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{profile.name}</Text>
            {profile.hasBadge && (
              <View style={styles.badgeTag}>
                <Ionicons name="star" size={10} color="#F5A623" />
                <Text style={styles.badgeTagText}>우수 간병사</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusTag, { backgroundColor: getStatusColor(profile.status) + '15' }]}>
            <Text style={[styles.statusTagText, { color: getStatusColor(profile.status) }]}>
              {getStatusLabel(profile.status)}
            </Text>
          </View>
          <Text style={styles.profileEmail}>{profile.email}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.totalMatches}</Text>
          <Text style={styles.statLabel}>총 매칭</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.avgRating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>평점</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{(profile.rehireRate * 100).toFixed(0)}%</Text>
          <Text style={styles.statLabel}>재고용률</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, profile.penaltyCount > 0 && { color: '#E74C3C' }]}>
            {profile.penaltyCount}
          </Text>
          <Text style={styles.statLabel}>패널티</Text>
        </View>
      </View>

      {/* Earnings Summary */}
      <View style={styles.earningsRow}>
        <View style={styles.earningCard}>
          <Text style={styles.earningLabel}>이번 달 수익</Text>
          <Text style={styles.earningValue}>{profile.monthlyEarning.toLocaleString()}원</Text>
        </View>
        <View style={styles.earningCard}>
          <Text style={styles.earningLabel}>총 수익</Text>
          <Text style={styles.earningValue}>{profile.totalEarning.toLocaleString()}원</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {/* Earnings Detail */}
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Earnings')}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="cash-outline" size={22} color="#2ECC71" />
            <Text style={styles.menuItemText}>수익 상세</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>

        {/* Penalty History */}
        <TouchableOpacity style={styles.menuItem} onPress={() => toggleSection('penalties')}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="alert-circle-outline" size={22} color="#E74C3C" />
            <Text style={styles.menuItemText}>패널티 이력</Text>
            {profile.penaltyCount > 0 && (
              <View style={styles.penaltyBadge}>
                <Text style={styles.penaltyBadgeText}>{profile.penaltyCount}</Text>
              </View>
            )}
          </View>
          <Ionicons
            name={activeSection === 'penalties' ? 'chevron-up' : 'chevron-down'}
            size={20} color="#CCC"
          />
        </TouchableOpacity>
        {activeSection === 'penalties' && (
          <View style={styles.expandedSection}>
            {penalties.length === 0 ? (
              <Text style={styles.emptyText}>패널티 이력이 없습니다</Text>
            ) : (
              penalties.map((penalty) => (
                <View key={penalty.id} style={styles.penaltyItem}>
                  <Ionicons
                    name={penalty.type === 'warning' ? 'warning-outline' : 'remove-circle-outline'}
                    size={18}
                    color={penalty.type === 'warning' ? '#F5A623' : '#E74C3C'}
                  />
                  <View style={styles.penaltyContent}>
                    <Text style={styles.penaltyReason}>{penalty.reason}</Text>
                    <Text style={styles.penaltyDate}>{penalty.date}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Activity History */}
        <TouchableOpacity style={styles.menuItem} onPress={() => toggleSection('activities')}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="time-outline" size={22} color="#4A90D9" />
            <Text style={styles.menuItemText}>활동 이력</Text>
          </View>
          <Ionicons
            name={activeSection === 'activities' ? 'chevron-up' : 'chevron-down'}
            size={20} color="#CCC"
          />
        </TouchableOpacity>
        {activeSection === 'activities' && (
          <View style={styles.expandedSection}>
            {activities.map((activity) => (
              <View key={activity.id} style={styles.activityItem}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityPatient}>{activity.patientName}</Text>
                  <Text style={styles.activityEarnings}>{activity.earnings.toLocaleString()}원</Text>
                </View>
                <Text style={styles.activityLocation}>{activity.location}</Text>
                <Text style={styles.activityDate}>
                  {activity.startDate} ~ {activity.endDate}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Certifications */}
        <TouchableOpacity style={styles.menuItem} onPress={() => toggleSection('certifications')}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="ribbon-outline" size={22} color="#F5A623" />
            <Text style={styles.menuItemText}>자격증 관리</Text>
          </View>
          <Ionicons
            name={activeSection === 'certifications' ? 'chevron-up' : 'chevron-down'}
            size={20} color="#CCC"
          />
        </TouchableOpacity>
        {activeSection === 'certifications' && (
          <View style={styles.expandedSection}>
            {certifications.map((cert, index) => (
              <View key={index} style={styles.certItem}>
                <View style={styles.certLeft}>
                  <Ionicons name="ribbon" size={18} color="#4A90D9" />
                  <View>
                    <Text style={styles.certName}>{cert.name}</Text>
                    <Text style={styles.certDate}>발급일: {cert.issuedAt}</Text>
                  </View>
                </View>
                <View style={[
                  styles.certStatusBadge,
                  { backgroundColor: cert.status === 'verified' ? '#E8F5E9' : '#FFF3E0' },
                ]}>
                  <Text style={[
                    styles.certStatusText,
                    { color: cert.status === 'verified' ? '#2ECC71' : '#F5A623' },
                  ]}>
                    {cert.status === 'verified' ? '인증완료' : '확인중'}
                  </Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addCertButton}>
              <Ionicons name="add-circle-outline" size={18} color="#2ECC71" />
              <Text style={styles.addCertText}>자격증 추가</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Education */}
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Education')}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="school-outline" size={22} color="#9B59B6" />
            <Text style={styles.menuItemText}>교육 / 수료증</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>

        {/* Profile Edit */}
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="create-outline" size={22} color="#999" />
            <Text style={styles.menuItemText}>프로필 수정</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>
      </View>

      {/* Referral */}
      <View style={styles.referralSection}>
        <Text style={styles.referralTitle}>추천인 코드</Text>
        <View style={styles.referralBox}>
          <Text style={styles.referralCode}>{profile.referralCode}</Text>
          <TouchableOpacity style={styles.shareButton} onPress={handleShareReferral}>
            <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>공유</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.referralHint}>
          추천인 코드를 공유하면 포인트 10,000원이 지급됩니다.
        </Text>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>케어매치 간병인 v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2ECC71',
    padding: 24, paddingTop: 16,
  },
  profileAvatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  avatarText: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold' },
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  badgeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF8E1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  badgeTagText: { color: '#F5A623', fontSize: 10, fontWeight: '600' },
  statusTag: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginTop: 6,
  },
  statusTagText: { fontSize: 11, fontWeight: '600' },
  profileEmail: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  statsSection: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: -12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#F0F0F0' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 4 },
  earningsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 16 },
  earningCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  earningLabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  earningValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  menuSection: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuItemText: { fontSize: 15, color: '#333', fontWeight: '500' },
  penaltyBadge: {
    backgroundColor: '#FFEBEE', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  penaltyBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#E74C3C' },
  expandedSection: {
    backgroundColor: '#FAFBFC', paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  emptyText: { fontSize: 13, color: '#BBB', textAlign: 'center', paddingVertical: 12 },
  penaltyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  penaltyContent: { flex: 1 },
  penaltyReason: { fontSize: 14, color: '#333', fontWeight: '500' },
  penaltyDate: { fontSize: 12, color: '#888', marginTop: 2 },
  activityItem: {
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 8,
  },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  activityPatient: { fontSize: 14, fontWeight: '600', color: '#333' },
  activityEarnings: { fontSize: 14, fontWeight: 'bold', color: '#2ECC71' },
  activityLocation: { fontSize: 13, color: '#888', marginBottom: 2 },
  activityDate: { fontSize: 12, color: '#BBB' },
  certItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  certLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  certName: { fontSize: 14, fontWeight: '500', color: '#333' },
  certDate: { fontSize: 11, color: '#BBB', marginTop: 2 },
  certStatusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  certStatusText: { fontSize: 11, fontWeight: '600' },
  addCertButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: '#2ECC71', borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 12, marginTop: 4,
  },
  addCertText: { fontSize: 13, color: '#2ECC71', fontWeight: '600' },
  referralSection: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
  },
  referralTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  referralBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA',
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  referralCode: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#2ECC71', letterSpacing: 1 },
  shareButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#2ECC71', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  shareButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  referralHint: { fontSize: 12, color: '#888' },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 16, paddingVertical: 14,
    borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FFE0E0',
  },
  logoutText: { fontSize: 15, color: '#E74C3C', fontWeight: '600' },
  versionText: { textAlign: 'center', fontSize: 12, color: '#CCC', marginTop: 12, marginBottom: 32 },
});
