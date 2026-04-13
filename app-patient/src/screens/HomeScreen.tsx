import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientApi } from '../services/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'match' | 'payment' | 'care';
  isRead: boolean;
  createdAt: string;
}

interface CareStatus {
  id: string;
  status: 'pending' | 'matched' | 'active' | 'completed';
  patientName: string;
  caregiverName?: string;
  startDate: string;
  endDate: string;
  location: string;
}

export default function HomeScreen({ navigation }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentCare, setCurrentCare] = useState<CareStatus | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [notifResponse, careResponse]: any[] = await Promise.allSettled([
        patientApi.getNotifications(),
        patientApi.getCareRequests(),
      ]);

      // Process notifications
      if (notifResponse.status === 'fulfilled') {
        const notifData = notifResponse.value?.data || notifResponse.value || [];
        const notifList = Array.isArray(notifData) ? notifData : notifData?.notifications || [];
        setNotifications(
          notifList.map((n: any) => ({
            id: n.id,
            title: n.title || '알림',
            message: n.message || n.body || '',
            type: n.type || 'info',
            isRead: n.isRead ?? false,
            createdAt: n.createdAt,
          }))
        );
      }

      // Process care requests - find the active one
      if (careResponse.status === 'fulfilled') {
        const careData = careResponse.value?.data || careResponse.value || [];
        const careList = Array.isArray(careData) ? careData : careData?.careRequests || [];
        // Find the most recent active or matched care request
        const activeCare = careList.find(
          (c: any) =>
            c.status === 'MATCHED' ||
            c.status === 'ACTIVE' ||
            c.status === 'IN_PROGRESS'
        ) || careList.find((c: any) => c.status === 'OPEN' || c.status === 'PENDING');

        if (activeCare) {
          setCurrentCare({
            id: activeCare.id,
            status: (activeCare.status || 'pending').toLowerCase() as CareStatus['status'],
            patientName: activeCare.patient?.name || activeCare.patientName || '환자',
            caregiverName: activeCare.caregiver?.user?.name || activeCare.caregiverName || undefined,
            startDate: activeCare.startDate
              ? new Date(activeCare.startDate).toISOString().split('T')[0]
              : '',
            endDate: activeCare.endDate
              ? new Date(activeCare.endDate).toISOString().split('T')[0]
              : '',
            location:
              activeCare.address ||
              activeCare.hospitalName ||
              '위치 정보 없음',
          });
        } else {
          setCurrentCare(null);
        }
      }
    } catch {
      // Silently handle - data will just remain empty
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsInitialLoading(true);
      await fetchData();
      setIsInitialLoading(false);
    };
    loadInitialData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '대기중';
      case 'matched': return '매칭완료';
      case 'active': return '간병중';
      case 'completed': return '완료';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F5A623';
      case 'matched': return '#4A90D9';
      case 'active': return '#2ECC71';
      case 'completed': return '#999';
      default: return '#999';
    }
  };

  const getNotificationIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'match': return 'people';
      case 'payment': return 'card';
      case 'care': return 'document-text';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'match': return '#4A90D9';
      case 'payment': return '#2ECC71';
      case 'care': return '#F5A623';
      default: return '#999';
    }
  };

  if (isInitialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.loadingText}>데이터를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A90D9" />
      }
    >
      {/* Greeting */}
      <View style={styles.greetingSection}>
        <View>
          <Text style={styles.greetingText}>안녕하세요,</Text>
          <Text style={styles.greetingName}>보호자님</Text>
        </View>
        <TouchableOpacity style={styles.notificationBell}>
          <Ionicons name="notifications-outline" size={24} color="#333" />
          {notifications.some((n) => !n.isRead) && (
            <View style={styles.notificationBadge} />
          )}
        </TouchableOpacity>
      </View>

      {/* Current Care Status */}
      {currentCare && (
        <TouchableOpacity
          style={styles.careStatusCard}
          onPress={() => navigation.navigate('CareStatus', { careId: currentCare.id })}
        >
          <View style={styles.careStatusHeader}>
            <Text style={styles.careStatusTitle}>현재 간병 상태</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(currentCare.status) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: getStatusColor(currentCare.status) },
                ]}
              >
                {getStatusLabel(currentCare.status)}
              </Text>
            </View>
          </View>

          <View style={styles.careStatusBody}>
            <View style={styles.careInfoRow}>
              <Ionicons name="person-outline" size={16} color="#666" />
              <Text style={styles.careInfoLabel}>환자</Text>
              <Text style={styles.careInfoValue}>{currentCare.patientName}</Text>
            </View>
            {currentCare.caregiverName && (
              <View style={styles.careInfoRow}>
                <Ionicons name="medkit-outline" size={16} color="#666" />
                <Text style={styles.careInfoLabel}>간병인</Text>
                <Text style={styles.careInfoValue}>{currentCare.caregiverName}</Text>
              </View>
            )}
            <View style={styles.careInfoRow}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.careInfoLabel}>위치</Text>
              <Text style={styles.careInfoValue}>{currentCare.location}</Text>
            </View>
            <View style={styles.careInfoRow}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.careInfoLabel}>기간</Text>
              <Text style={styles.careInfoValue}>
                {currentCare.startDate} ~ {currentCare.endDate}
              </Text>
            </View>
          </View>

          <View style={styles.careStatusFooter}>
            <Text style={styles.viewDetailsText}>상세보기</Text>
            <Ionicons name="chevron-forward" size={16} color="#4A90D9" />
          </View>
        </TouchableOpacity>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('간병요청')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#F0F6FF' }]}>
            <Ionicons name="add-circle" size={28} color="#4A90D9" />
          </View>
          <Text style={styles.quickActionText}>간병 요청</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('내간병')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#F0FFF4' }]}>
            <Ionicons name="heart" size={28} color="#2ECC71" />
          </View>
          <Text style={styles.quickActionText}>내 간병</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('마이페이지')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#FFF8F0' }]}>
            <Ionicons name="receipt" size={28} color="#F5A623" />
          </View>
          <Text style={styles.quickActionText}>결제 내역</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <View style={styles.notificationSection}>
        <Text style={styles.sectionTitle}>알림</Text>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color="#DDD" />
            <Text style={styles.emptyStateText}>알림이 없습니다</Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationItem,
                !notification.isRead && styles.notificationUnread,
              ]}
            >
              <View
                style={[
                  styles.notificationIconContainer,
                  { backgroundColor: getNotificationColor(notification.type) + '15' },
                ]}
              >
                <Ionicons
                  name={getNotificationIcon(notification.type)}
                  size={20}
                  color={getNotificationColor(notification.type)}
                />
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                <Text style={styles.notificationTime}>
                  {new Date(notification.createdAt).toLocaleDateString('ko-KR')}
                </Text>
              </View>
              {!notification.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8',
  },
  loadingText: { fontSize: 13, color: '#BBB', marginTop: 12 },
  greetingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
  },
  greetingText: {
    fontSize: 14,
    color: '#888',
  },
  greetingName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  notificationBell: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
  },
  careStatusCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  careStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  careStatusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  careStatusBody: {
    gap: 10,
  },
  careInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  careInfoLabel: {
    fontSize: 13,
    color: '#888',
    width: 45,
  },
  careInfoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  careStatusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  viewDetailsText: {
    fontSize: 13,
    color: '#4A90D9',
    fontWeight: '600',
    marginRight: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  quickActionButton: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  notificationSection: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  notificationUnread: {
    backgroundColor: '#FAFCFF',
    borderWidth: 1,
    borderColor: '#E8F0FE',
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: '#BBB',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4A90D9',
    marginLeft: 8,
  },
});
