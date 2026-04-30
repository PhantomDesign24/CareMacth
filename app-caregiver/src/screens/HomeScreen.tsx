import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { caregiverApi } from '../services/api';

type WorkStatus = 'working' | 'available' | 'immediate';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'job' | 'payment' | 'system';
  isRead: boolean;
  createdAt: string;
}

interface TodaySchedule {
  id: string;
  patientName: string;
  location: string;
  time: string;
  status: 'upcoming' | 'active' | 'completed';
}

const STATUS_OPTIONS: { value: WorkStatus; label: string; color: string }[] = [
  { value: 'working', label: '근무중', color: '#E74C3C' },
  { value: 'available', label: '근무가능', color: '#4A90D9' },
  { value: 'immediate', label: '즉시가능', color: '#2ECC71' },
];

const isCurrentMonth = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

export default function HomeScreen({ navigation }: any) {
  const [workStatus, setWorkStatus] = useState<WorkStatus>('available');
  const [refreshing, setRefreshing] = useState(false);
  const [todaySchedule, setTodaySchedule] = useState<TodaySchedule[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [monthlyEarnings, setMonthlyEarnings] = useState<number>(0);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [rating, setRating] = useState<number>(0);

  const fetchHome = React.useCallback(async () => {
    try {
      const [profileRes, earningsRes, activityRes, notifRes] = await Promise.allSettled([
        caregiverApi.getProfile(),
        caregiverApi.getEarnings(),
        caregiverApi.getActivityHistory(),
        caregiverApi.getNotifications(),
      ]);

      // 프로필 — 활성 계약(오늘 일정), 매칭 횟수, 평점, 근무 상태
      if (profileRes.status === 'fulfilled') {
        const body: any = (profileRes.value as any)?.data ?? profileRes.value;
        const data = body?.data ?? body;
        const ws = data?.workStatus;
        if (ws === 'WORKING') setWorkStatus('working');
        else if (ws === 'IMMEDIATE') setWorkStatus('immediate');
        else setWorkStatus('available');
        setTotalMatches(Number(data?.totalMatches || 0));
        setRating(Number(data?.avgRating || 0));
        const active = data?.activeContract;
        if (active) {
          setTodaySchedule([{
            id: active.id,
            patientName: active.patient?.name || active.careRequest?.patient?.name || '환자',
            location: active.careRequest?.hospitalName || active.careRequest?.address || '-',
            time: '07:00 ~ 19:00',
            status: 'active',
          }]);
        } else {
          setTodaySchedule([]);
        }
      }

      if (activityRes.status === 'fulfilled') {
        const body: any = (activityRes.value as any)?.data ?? activityRes.value;
        const data = body?.data ?? body;
        const contracts = Array.isArray(data?.contracts) ? data.contracts : [];
        const active = contracts.find((c: any) => ['ACTIVE', 'EXTENDED', 'PENDING_SIGNATURE'].includes(c.status));
        if (active) {
          setTodaySchedule([{
            id: active.id,
            patientName: active.careRequest?.patient?.name || active.patientName || '환자',
            location: active.careRequest?.hospitalName || active.careRequest?.address || '-',
            time: '07:00 ~ 19:00',
            status: 'active',
          }]);
        }
      }

      // 이번 달 수익
      if (earningsRes.status === 'fulfilled') {
        const body: any = (earningsRes.value as any)?.data ?? earningsRes.value;
        const data = body?.data ?? body;
        const earnings = Array.isArray(data?.earnings) ? data.earnings : [];
        const additionalFees = Array.isArray(data?.additionalFees) ? data.additionalFees : [];
        const monthly =
          data?.monthlyTotal ??
          data?.thisMonth ??
          earnings
            .filter((e: any) => isCurrentMonth(e.paidAt || e.createdAt))
            .reduce((sum: number, e: any) => sum + Number(e.netAmount || 0), 0) +
            additionalFees
              .filter((f: any) => f.approvedByGuardian && isCurrentMonth(f.createdAt))
              .reduce((sum: number, f: any) => sum + Number(f.netAmount || 0), 0);
        setMonthlyEarnings(Number(monthly));
      }

      // 알림 (최근 5개)
      if (notifRes.status === 'fulfilled') {
        const body: any = (notifRes.value as any)?.data ?? notifRes.value;
        const list = body?.data?.notifications ?? body?.notifications ?? body?.data ?? [];
        const top = (Array.isArray(list) ? list : []).slice(0, 5).map((n: any) => ({
          id: String(n.id),
          title: n.title || '',
          message: n.body || n.message || '',
          type: (String(n.type || '').toLowerCase().includes('match')
            ? 'job'
            : String(n.type || '').toLowerCase().includes('pay')
              ? 'payment'
              : 'system') as Notification['type'],
          isRead: !!n.isRead,
          createdAt: n.createdAt || new Date().toISOString(),
        }));
        setNotifications(top);
      }
    } catch (err: any) {
      console.error('[HomeScreen] fetchHome 실패', err?.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchHome(); }, [fetchHome]);

  const handleStatusChange = async (status: WorkStatus) => {
    const enumStatus = status === 'working' ? 'WORKING' : status === 'immediate' ? 'IMMEDIATE' : 'AVAILABLE';
    try {
      await caregiverApi.updateStatus(enumStatus);
      setWorkStatus(status);
    } catch (err: any) {
      Alert.alert('상태 변경 실패', err?.response?.data?.message || '상태 변경 중 오류가 발생했습니다.');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHome();
  };

  const getNotificationIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'job': return 'briefcase';
      case 'payment': return 'card';
      case 'system': return 'information-circle';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'job': return '#4A90D9';
      case 'payment': return '#2ECC71';
      case 'system': return '#F5A623';
      default: return '#999';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2ECC71" />}
    >
      {/* Greeting */}
      <View style={styles.greetingSection}>
        <View>
          <Text style={styles.greetingText}>안녕하세요,</Text>
          <Text style={styles.greetingName}>간병인님</Text>
        </View>
        <TouchableOpacity style={styles.notificationBell}>
          <Ionicons name="notifications-outline" size={24} color="#333" />
          {notifications.some((n) => !n.isRead) && <View style={styles.notificationBadge} />}
        </TouchableOpacity>
      </View>

      {/* Work Status Toggle */}
      <View style={styles.statusSection}>
        <Text style={styles.statusTitle}>현재 상태</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.statusButton,
                workStatus === option.value && {
                  backgroundColor: option.color,
                  borderColor: option.color,
                },
              ]}
              onPress={() => handleStatusChange(option.value)}
            >
              {workStatus === option.value && (
                <View style={styles.statusDot} />
              )}
              <Text
                style={[
                  styles.statusButtonText,
                  workStatus === option.value && styles.statusButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <Ionicons name="cash-outline" size={22} color="#2ECC71" />
          <Text style={styles.statLabel}>이번 달 수익</Text>
          <Text style={styles.statValue}>{monthlyEarnings.toLocaleString()}원</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="people-outline" size={22} color="#4A90D9" />
          <Text style={styles.statLabel}>총 매칭</Text>
          <Text style={styles.statValue}>{totalMatches}회</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="star-outline" size={22} color="#F5A623" />
          <Text style={styles.statLabel}>평점</Text>
          <Text style={styles.statValue}>{rating}</Text>
        </View>
      </View>

      {/* Today Schedule */}
      <View style={styles.scheduleSection}>
        <Text style={styles.sectionTitle}>오늘 일정</Text>
        {todaySchedule.length === 0 ? (
          <View style={styles.emptySchedule}>
            <Ionicons name="calendar-outline" size={40} color="#DDD" />
            <Text style={styles.emptyText}>오늘 예정된 일정이 없습니다</Text>
          </View>
        ) : (
          todaySchedule.map((schedule) => (
            <View key={schedule.id} style={styles.scheduleCard}>
              <View style={styles.scheduleHeader}>
                <View style={[
                  styles.scheduleBadge,
                  { backgroundColor: schedule.status === 'active' ? '#E8F5E9' : '#F0F6FF' },
                ]}>
                  <View style={[
                    styles.scheduleStatusDot,
                    { backgroundColor: schedule.status === 'active' ? '#2ECC71' : '#4A90D9' },
                  ]} />
                  <Text style={[
                    styles.scheduleBadgeText,
                    { color: schedule.status === 'active' ? '#2ECC71' : '#4A90D9' },
                  ]}>
                    {schedule.status === 'active' ? '진행중' : schedule.status === 'upcoming' ? '예정' : '완료'}
                  </Text>
                </View>
                <Text style={styles.scheduleTime}>{schedule.time}</Text>
              </View>
              <Text style={styles.schedulePatient}>{schedule.patientName} 환자</Text>
              <View style={styles.scheduleLocationRow}>
                <Ionicons name="location-outline" size={14} color="#888" />
                <Text style={styles.scheduleLocation}>{schedule.location}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Quick Menu */}
      <View style={styles.quickMenu}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('공고')}>
          <View style={[styles.menuIconContainer, { backgroundColor: '#F0F6FF' }]}>
            <Ionicons name="briefcase" size={24} color="#4A90D9" />
          </View>
          <Text style={styles.menuLabel}>공고 확인</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('근무')}>
          <View style={[styles.menuIconContainer, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#2ECC71" />
          </View>
          <Text style={styles.menuLabel}>출퇴근</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Earnings')}>
          <View style={[styles.menuIconContainer, { backgroundColor: '#FFF8E1' }]}>
            <Ionicons name="cash" size={24} color="#F5A623" />
          </View>
          <Text style={styles.menuLabel}>수익</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Education')}>
          <View style={[styles.menuIconContainer, { backgroundColor: '#FCE4EC' }]}>
            <Ionicons name="school" size={24} color="#E91E63" />
          </View>
          <Text style={styles.menuLabel}>교육</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <View style={styles.notificationSection}>
        <Text style={styles.sectionTitle}>알림</Text>
        {notifications.map((notif) => (
          <TouchableOpacity
            key={notif.id}
            style={[styles.notificationItem, !notif.isRead && styles.notificationUnread]}
          >
            <View style={[
              styles.notificationIconContainer,
              { backgroundColor: getNotificationColor(notif.type) + '15' },
            ]}>
              <Ionicons
                name={getNotificationIcon(notif.type)}
                size={20}
                color={getNotificationColor(notif.type)}
              />
            </View>
            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>{notif.title}</Text>
              <Text style={styles.notificationMessage}>{notif.message}</Text>
              <Text style={styles.notificationTime}>
                {new Date(notif.createdAt).toLocaleDateString('ko-KR')}
              </Text>
            </View>
            {!notif.isRead && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  greetingSection: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 16, backgroundColor: '#FFFFFF',
  },
  greetingText: { fontSize: 14, color: '#888' },
  greetingName: { fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 2 },
  notificationBell: { position: 'relative', padding: 8 },
  notificationBadge: {
    position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30',
  },
  statusSection: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  statusTitle: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 12 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#E8E8E8', borderRadius: 12, paddingVertical: 12, gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  statusButtonText: { fontSize: 13, fontWeight: '600', color: '#999' },
  statusButtonTextActive: { color: '#FFFFFF' },
  statsSection: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 16 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statLabel: { fontSize: 11, color: '#888', marginTop: 6 },
  statValue: { fontSize: 15, fontWeight: 'bold', color: '#333', marginTop: 2 },
  scheduleSection: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  emptySchedule: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { fontSize: 14, color: '#BBB', marginTop: 8 },
  scheduleCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scheduleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  scheduleStatusDot: { width: 6, height: 6, borderRadius: 3 },
  scheduleBadgeText: { fontSize: 12, fontWeight: '600' },
  scheduleTime: { fontSize: 13, color: '#888' },
  schedulePatient: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 6 },
  scheduleLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scheduleLocation: { fontSize: 13, color: '#888' },
  quickMenu: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 20 },
  menuButton: { flex: 1, alignItems: 'center' },
  menuIconContainer: {
    width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  menuLabel: { fontSize: 11, color: '#555', fontWeight: '500' },
  notificationSection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  notificationItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, padding: 16, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  notificationUnread: { backgroundColor: '#FAFFF5', borderWidth: 1, borderColor: '#E8F5E9' },
  notificationIconContainer: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  notificationContent: { flex: 1 },
  notificationTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2 },
  notificationMessage: { fontSize: 12, color: '#888', marginBottom: 4 },
  notificationTime: { fontSize: 11, color: '#BBB' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC71', marginLeft: 8 },
});
