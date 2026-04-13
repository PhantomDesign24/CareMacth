import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CareRecordCard from '../components/CareRecordCard';
import { patientApi } from '../services/api';

interface CareRecord {
  id: string;
  date: string;
  temperature: string;
  bloodPressure: string;
  pulse: string;
  meal: string;
  medication: string;
  excretion: string;
  sleep: string;
  activity: string;
  mentalStatus: string;
  skinCondition: string;
  specialNotes: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'normal' | 'late' | 'absent';
}

export default function CareStatusScreen({ route, navigation }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'records' | 'attendance'>('status');

  // Mock data
  const careInfo = {
    id: 'care-001',
    status: 'active',
    patientName: '홍길동',
    caregiverName: '김간병',
    caregiverPhone: '010-1234-5678',
    location: '서울대학교병원 301호',
    startDate: '2026-04-05',
    endDate: '2026-04-15',
    dailyRate: 150000,
    daysRemaining: 6,
    canExtend: true,
  };

  const [careRecords] = useState<CareRecord[]>([
    {
      id: 'cr1',
      date: '2026-04-09',
      temperature: '36.5',
      bloodPressure: '120/80',
      pulse: '72',
      meal: '아침: 죽 1/2공기, 점심: 밥 1공기, 저녁: 밥 2/3공기',
      medication: '혈압약 1회, 진통제 2회',
      excretion: '소변 정상, 대변 1회',
      sleep: '22:00~06:00 (약 8시간)',
      activity: '보조 하에 병동 복도 산책 2회',
      mentalStatus: '안정적, 대화 원활',
      skinCondition: '욕창 없음',
      specialNotes: '오후에 가벼운 두통 호소, 간호사에게 보고함',
    },
    {
      id: 'cr2',
      date: '2026-04-08',
      temperature: '36.7',
      bloodPressure: '125/82',
      pulse: '74',
      meal: '아침: 죽 1공기, 점심: 밥 1공기, 저녁: 밥 1공기',
      medication: '혈압약 1회, 진통제 1회',
      excretion: '소변 정상, 대변 1회',
      sleep: '23:00~06:30 (약 7.5시간)',
      activity: '침상 안정, 앉은 자세 유지 연습',
      mentalStatus: '약간 우울함, 대화로 격려',
      skinCondition: '욕창 없음',
      specialNotes: '보호자 면회 시 기분이 좋아짐',
    },
  ]);

  const [attendanceRecords] = useState<AttendanceRecord[]>([
    { id: 'a1', date: '2026-04-09', checkIn: '07:00', checkOut: '-', status: 'normal' },
    { id: 'a2', date: '2026-04-08', checkIn: '07:05', checkOut: '19:00', status: 'normal' },
    { id: 'a3', date: '2026-04-07', checkIn: '07:00', checkOut: '19:00', status: 'normal' },
    { id: 'a4', date: '2026-04-06', checkIn: '07:15', checkOut: '19:10', status: 'late' },
    { id: 'a5', date: '2026-04-05', checkIn: '07:00', checkOut: '19:00', status: 'normal' },
  ]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh data
    setRefreshing(false);
  };

  const handleExtend = () => {
    if (!careInfo.canExtend) {
      Alert.alert('알림', '연장 요청은 종료 3일 전부터 가능합니다.');
      return;
    }
    Alert.alert(
      '간병 연장',
      '간병 기간을 연장하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '연장 요청',
          onPress: () => {
            Alert.alert('연장 요청 완료', '간병 연장 요청이 전달되었습니다.\n간병인의 수락을 기다려주세요.');
          },
        },
      ]
    );
  };

  const renderStatusTab = () => (
    <View>
      {/* Care Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.statusHeader}>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>간병중</Text>
          </View>
          <Text style={styles.daysRemaining}>
            남은 기간: {careInfo.daysRemaining}일
          </Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Ionicons name="person-outline" size={18} color="#888" />
            <Text style={styles.infoLabel}>환자</Text>
            <Text style={styles.infoValue}>{careInfo.patientName}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="medkit-outline" size={18} color="#888" />
            <Text style={styles.infoLabel}>간병인</Text>
            <Text style={styles.infoValue}>{careInfo.caregiverName}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={18} color="#888" />
            <Text style={styles.infoLabel}>위치</Text>
            <Text style={styles.infoValue}>{careInfo.location}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={18} color="#888" />
            <Text style={styles.infoLabel}>기간</Text>
            <Text style={styles.infoValue}>
              {careInfo.startDate} ~ {careInfo.endDate}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="cash-outline" size={18} color="#888" />
            <Text style={styles.infoLabel}>일당</Text>
            <Text style={styles.infoValue}>
              {careInfo.dailyRate.toLocaleString()}원
            </Text>
          </View>
        </View>
      </View>

      {/* Contact */}
      <View style={styles.contactCard}>
        <Text style={styles.contactTitle}>간병인 연락처</Text>
        <TouchableOpacity style={styles.contactButton}>
          <Ionicons name="call" size={20} color="#4A90D9" />
          <Text style={styles.contactButtonText}>{careInfo.caregiverPhone}</Text>
        </TouchableOpacity>
      </View>

      {/* Extend Button */}
      {careInfo.canExtend && (
        <TouchableOpacity style={styles.extendButton} onPress={handleExtend}>
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.extendButtonText}>간병 기간 연장 요청</Text>
        </TouchableOpacity>
      )}

      {/* Review Button (after completion) */}
      <TouchableOpacity
        style={styles.reviewButton}
        onPress={() =>
          navigation.navigate('Review', {
            careId: careInfo.id,
            caregiverName: careInfo.caregiverName,
          })
        }
      >
        <Ionicons name="star-outline" size={20} color="#4A90D9" />
        <Text style={styles.reviewButtonText}>리뷰 작성하기</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRecordsTab = () => (
    <View>
      {careRecords.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#DDD" />
          <Text style={styles.emptyStateText}>간병 일지가 없습니다</Text>
        </View>
      ) : (
        careRecords.map((record) => (
          <CareRecordCard key={record.id} record={record} />
        ))
      )}
    </View>
  );

  const renderAttendanceTab = () => (
    <View>
      <View style={styles.attendanceHeader}>
        <Text style={styles.attendanceHeaderText}>날짜</Text>
        <Text style={styles.attendanceHeaderText}>출근</Text>
        <Text style={styles.attendanceHeaderText}>퇴근</Text>
        <Text style={styles.attendanceHeaderText}>상태</Text>
      </View>
      {attendanceRecords.map((record) => (
        <View key={record.id} style={styles.attendanceRow}>
          <Text style={styles.attendanceDate}>{record.date}</Text>
          <Text style={styles.attendanceTime}>{record.checkIn}</Text>
          <Text style={styles.attendanceTime}>{record.checkOut}</Text>
          <View
            style={[
              styles.attendanceStatusBadge,
              {
                backgroundColor:
                  record.status === 'normal' ? '#E8F5E9' :
                  record.status === 'late' ? '#FFF3E0' : '#FFEBEE',
              },
            ]}
          >
            <Text
              style={[
                styles.attendanceStatusText,
                {
                  color:
                    record.status === 'normal' ? '#2ECC71' :
                    record.status === 'late' ? '#F5A623' : '#E74C3C',
                },
              ]}
            >
              {record.status === 'normal' ? '정상' : record.status === 'late' ? '지각' : '결근'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        {(['status', 'records', 'attendance'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
            >
              {tab === 'status' ? '간병 현황' : tab === 'records' ? '간병 일지' : '출퇴근 기록'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {activeTab === 'status' && renderStatusTab()}
        {activeTab === 'records' && renderRecordsTab()}
        {activeTab === 'attendance' && renderAttendanceTab()}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#4A90D9',
  },
  tabText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#4A90D9',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ECC71',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2ECC71',
  },
  daysRemaining: {
    fontSize: 13,
    color: '#F5A623',
    fontWeight: '600',
  },
  infoGrid: {
    gap: 14,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: '#888',
    width: 50,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F6FF',
    borderRadius: 12,
    padding: 14,
  },
  contactButtonText: {
    fontSize: 15,
    color: '#4A90D9',
    fontWeight: '600',
  },
  extendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5A623',
    borderRadius: 12,
    height: 50,
    marginBottom: 12,
  },
  extendButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 50,
    borderWidth: 1,
    borderColor: '#4A90D9',
  },
  reviewButtonText: {
    fontSize: 15,
    color: '#4A90D9',
    fontWeight: 'bold',
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
  attendanceHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  attendanceHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888',
    textAlign: 'center',
  },
  attendanceRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 4,
    alignItems: 'center',
  },
  attendanceDate: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  attendanceTime: {
    flex: 1,
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
  },
  attendanceStatusBadge: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 4,
  },
  attendanceStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
