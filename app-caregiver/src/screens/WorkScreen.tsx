import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CareLogForm from '../components/CareLogForm';
import { caregiverApi } from '../services/api';

interface ActiveContract {
  id: string;
  patientName: string;
  location: string;
  startDate: string;
  endDate: string;
}

export default function WorkScreen() {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeContract, setActiveContract] = useState<ActiveContract | null>(null);
  const [isFetchingContract, setIsFetchingContract] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchActiveContract = useCallback(async () => {
    setIsFetchingContract(true);
    setFetchError(null);
    try {
      const response: any = await caregiverApi.getActivityHistory();
      const contracts = response?.data?.contracts || [];
      const active = contracts.find(
        (c: any) => c.status === 'ACTIVE' || c.status === 'EXTENDED'
      );
      if (active) {
        const patientName =
          active.careRequest?.patient?.name || '환자';
        const location =
          active.careRequest?.address ||
          active.careRequest?.hospitalName ||
          '위치 정보 없음';
        const startDate = active.startDate
          ? new Date(active.startDate).toISOString().split('T')[0]
          : '';
        const endDate = active.endDate
          ? new Date(active.endDate).toISOString().split('T')[0]
          : '';
        setActiveContract({
          id: active.id,
          patientName,
          location,
          startDate,
          endDate,
        });
      } else {
        setActiveContract(null);
      }
    } catch {
      setFetchError('계약 정보를 불러오지 못했습니다.');
      setActiveContract(null);
    } finally {
      setIsFetchingContract(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveContract();
  }, [fetchActiveContract]);

  const handleCheckIn = async () => {
    if (!activeContract) return;
    setIsLoading(true);
    try {
      await caregiverApi.checkIn(activeContract.id);
      const now = new Date();
      setCheckInTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
      setIsCheckedIn(true);
      Alert.alert('출근 완료', '출근 체크가 완료되었습니다.');
    } catch {
      Alert.alert('오류', '출근 체크에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeContract) return;
    Alert.alert('퇴근 확인', '퇴근 처리하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '퇴근',
        onPress: async () => {
          setIsLoading(true);
          try {
            await caregiverApi.checkOut(activeContract.id);
            setIsCheckedIn(false);
            setCheckInTime(null);
            Alert.alert('퇴근 완료', '퇴근 체크가 완료되었습니다.\n수고하셨습니다.');
          } catch {
            Alert.alert('오류', '퇴근 체크에 실패했습니다. 다시 시도해주세요.');
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  const handleCareLogSubmit = async (logData: Record<string, any>) => {
    if (!activeContract) return;
    setIsSubmittingLog(true);
    try {
      const { photos, ...textData } = logData;
      const result = await caregiverApi.submitCareLog(activeContract.id, textData);

      if (photos && photos.length > 0) {
        const formData = new FormData();
        formData.append('contractId', activeContract.id);
        formData.append('recordId', (result as any)?.data?.id || '');
        photos.forEach((uri: string, index: number) => {
          formData.append('photos', {
            uri,
            name: `care-photo-${index}.jpg`,
            type: 'image/jpeg',
          } as any);
        });
        await caregiverApi.uploadPhoto(activeContract.id, formData);
      }

      Alert.alert('저장 완료', '간병 일지가 저장되었습니다.');
    } catch {
      Alert.alert('오류', '간병 일지 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmittingLog(false);
    }
  };

  if (isFetchingContract) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#2ECC71" />
        <Text style={styles.emptyDesc}>계약 정보를 불러오는 중...</Text>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#E74C3C" />
        <Text style={styles.emptyTitle}>{fetchError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchActiveContract}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!activeContract) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="clipboard-outline" size={64} color="#DDD" />
        <Text style={styles.emptyTitle}>현재 진행 중인 간병이 없습니다</Text>
        <Text style={styles.emptyDesc}>공고 탭에서 간병을 지원해보세요</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Contract Info */}
      <View style={styles.contractCard}>
        <View style={styles.contractHeader}>
          <View style={styles.contractBadge}>
            <View style={styles.contractDot} />
            <Text style={styles.contractBadgeText}>진행중</Text>
          </View>
        </View>
        <Text style={styles.contractPatient}>{activeContract.patientName} 환자</Text>
        <View style={styles.contractInfoRow}>
          <Ionicons name="location-outline" size={14} color="#888" />
          <Text style={styles.contractInfoText}>{activeContract.location}</Text>
        </View>
        <View style={styles.contractInfoRow}>
          <Ionicons name="calendar-outline" size={14} color="#888" />
          <Text style={styles.contractInfoText}>
            {activeContract.startDate} ~ {activeContract.endDate}
          </Text>
        </View>
      </View>

      {/* Check-in/Check-out */}
      <View style={styles.checkSection}>
        <Text style={styles.sectionTitle}>출퇴근 체크</Text>
        {checkInTime && (
          <View style={styles.checkTimeInfo}>
            <Ionicons name="time-outline" size={16} color="#2ECC71" />
            <Text style={styles.checkTimeText}>출근 시간: {checkInTime}</Text>
          </View>
        )}
        <View style={styles.checkButtonRow}>
          <TouchableOpacity
            style={[styles.checkInButton, isCheckedIn && styles.checkButtonDisabled]}
            onPress={handleCheckIn}
            disabled={isCheckedIn || isLoading}
          >
            {isLoading && !isCheckedIn ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name={isCheckedIn ? 'checkmark-circle' : 'log-in-outline'}
                  size={22}
                  color={isCheckedIn ? '#A8E6CF' : '#FFFFFF'}
                />
                <Text style={[styles.checkButtonText, isCheckedIn && { color: '#A8E6CF' }]}>
                  {isCheckedIn ? '출근 완료' : '출근'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.checkOutButton, !isCheckedIn && styles.checkButtonDisabled]}
            onPress={handleCheckOut}
            disabled={!isCheckedIn || isLoading}
          >
            <Ionicons
              name="log-out-outline"
              size={22}
              color={!isCheckedIn ? '#CCC' : '#FFFFFF'}
            />
            <Text style={[styles.checkButtonText, !isCheckedIn && { color: '#CCC' }]}>
              퇴근
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.gpsNote}>
          <Ionicons name="navigate-outline" size={14} color="#BBB" />
          <Text style={styles.gpsNoteText}>GPS 위치 기록은 선택사항입니다</Text>
        </View>
      </View>

      {/* Care Log Form */}
      <View style={styles.careLogSection}>
        <Text style={styles.sectionTitle}>간병 일지 작성</Text>
        <CareLogForm onSubmit={handleCareLogSubmit} isSubmitting={isSubmittingLog} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8',
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 16 },
  emptyDesc: { fontSize: 13, color: '#BBB', marginTop: 4 },
  retryButton: {
    marginTop: 16, backgroundColor: '#2ECC71', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  contractCard: {
    backgroundColor: '#FFFFFF', margin: 16, borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  contractHeader: { marginBottom: 12 },
  contractBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 6,
  },
  contractDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2ECC71' },
  contractBadgeText: { fontSize: 12, fontWeight: '600', color: '#2ECC71' },
  contractPatient: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  contractInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  contractInfoText: { fontSize: 13, color: '#888' },
  checkSection: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16, padding: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  checkTimeInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12,
    backgroundColor: '#F0FFF4', borderRadius: 10, padding: 10,
  },
  checkTimeText: { fontSize: 14, color: '#2ECC71', fontWeight: '500' },
  checkButtonRow: { flexDirection: 'row', gap: 12 },
  checkInButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 16, gap: 8,
  },
  checkOutButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#95A5A6', borderRadius: 12, paddingVertical: 16, gap: 8,
  },
  checkButtonDisabled: { opacity: 0.4 },
  checkButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  gpsNote: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'center',
  },
  gpsNoteText: { fontSize: 11, color: '#BBB' },
  careLogSection: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16, padding: 20,
    marginBottom: 32,
  },
});
