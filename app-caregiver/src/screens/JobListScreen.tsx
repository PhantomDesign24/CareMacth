import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import JobCard from '../components/JobCard';
import { caregiverApi } from '../services/api';

interface JobItem {
  id: string;
  address: string;
  scheduleType: 'full_time' | 'part_time';
  careType: 'individual' | 'family';
  startDate: string;
  endDate: string;
  dailyRate: number;
  patient: {
    name: string;
    age: number;
    gender: string;
    diagnosis: string;
    mobilityStatus: string;
  };
  matchScore: number;
  applicationStatus: 'none' | 'applied' | 'accepted' | 'rejected';
}

export default function JobListScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const res: any = await caregiverApi.getMatchedJobs();
      const body = res?.data ?? res;
      const list = body?.data?.careRequests ?? body?.careRequests ?? body?.data ?? [];
      const careTypeMap: Record<string, 'individual' | 'family'> = { INDIVIDUAL: 'individual', FAMILY: 'family' };
      const scheduleMap: Record<string, 'full_time' | 'part_time'> = { FULL_TIME: 'full_time', PART_TIME: 'part_time' };
      const mobilityMap: Record<string, string> = { INDEPENDENT: '독립가능', PARTIAL: '부분도움', DEPENDENT: '거동불가' };
      const mapped: JobItem[] = (Array.isArray(list) ? list : []).map((j: any) => ({
        id: j.id,
        address: j.location === 'HOSPITAL' ? (j.hospitalName || j.address || '-') : (j.address || '-'),
        scheduleType: scheduleMap[j.scheduleType] || 'full_time',
        careType: careTypeMap[j.careType] || 'individual',
        startDate: j.startDate,
        endDate: j.endDate,
        dailyRate: j.dailyRate || 0,
        patient: {
          name: j.patient?.name || j.patientName || '환자',
          age: j.patient?.ageBucket || (j.patient?.birthDate ? new Date().getFullYear() - new Date(j.patient.birthDate).getFullYear() : 0),
          gender: j.patient?.gender === 'M' ? '남성' : j.patient?.gender === 'F' ? '여성' : '-',
          diagnosis: j.patient?.diagnosis || '-',
          mobilityStatus: mobilityMap[j.patient?.mobilityStatus] || '-',
        },
        matchScore: j.matchScore?.total || 0,
        applicationStatus: j.myApplicationStatus === 'PENDING' ? 'applied'
          : j.myApplicationStatus === 'ACCEPTED' ? 'accepted'
          : j.myApplicationStatus === 'REJECTED' ? 'rejected'
          : 'none',
      }));
      setJobs(mapped);
    } catch (err: any) {
      console.error('[JobList] 공고 목록 조회 실패', err?.message);
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const handleApply = async (jobId: string) => {
    try {
      await caregiverApi.applyForJob(jobId);
      setJobs(jobs.map((j) =>
        j.id === jobId ? { ...j, applicationStatus: 'applied' as const } : j
      ));
      Alert.alert('지원 완료', '지원이 완료되었습니다.\n보호자의 선택을 기다려주세요.');
    } catch (err: any) {
      Alert.alert('지원 실패', err?.response?.data?.message || '지원 중 오류가 발생했습니다.');
    }
  };

  const handleAccept = async (jobId: string) => {
    try {
      await caregiverApi.acceptJob(jobId);
      setJobs(jobs.map((j) =>
        j.id === jobId ? { ...j, applicationStatus: 'accepted' as const } : j
      ));
      Alert.alert('수락 완료', '간병을 수락하였습니다.');
    } catch {
      Alert.alert('오류', '수락에 실패했습니다.');
    }
  };

  const handleRejectConfirm = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedJobId) return;
    setShowRejectModal(false);
    try {
      await caregiverApi.rejectJob(selectedJobId);
      setJobs(jobs.filter((j) => j.id !== selectedJobId));
    } catch {
      setJobs(jobs.filter((j) => j.id !== selectedJobId));
    }
    setSelectedJobId(null);
  };

  const calculateExpectedEarnings = (job: JobItem) => {
    const startDate = new Date(job.startDate);
    const endDate = new Date(job.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return job.dailyRate * days;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Text style={styles.title}>간병 공고</Text>
        <Text style={styles.count}>{jobs.length}건</Text>
      </View>

      {loading && jobs.length === 0 ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#2ECC71" />
          <Text style={styles.emptyDesc}>공고를 불러오는 중...</Text>
        </View>
      ) : (
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2ECC71" />
        }
        renderItem={({ item }) => (
          <JobCard
            job={item}
            expectedEarnings={calculateExpectedEarnings(item)}
            onApply={() => handleApply(item.id)}
            onAccept={() => handleAccept(item.id)}
            onReject={() => handleRejectConfirm(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color="#DDD" />
            <Text style={styles.emptyTitle}>매칭 가능한 공고가 없습니다</Text>
            <Text style={styles.emptyDesc}>새로운 공고가 등록되면 알려드립니다</Text>
          </View>
        }
      />
      )}

      {/* Reject Penalty Warning Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="warning" size={40} color="#F5A623" />
            </View>
            <Text style={styles.modalTitle}>거절 확인</Text>
            <Text style={styles.modalMessage}>
              거절 시 패널티가 부여될 수 있습니다.{'\n'}
              거절하시겠습니까?
            </Text>
            <Text style={styles.modalWarning}>
              * 반복적인 거절은 매칭 점수에 영향을 줄 수 있습니다.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowRejectModal(false);
                  setSelectedJobId(null);
                }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalRejectButton}
                onPress={handleReject}
              >
                <Text style={styles.modalRejectText}>거절하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  count: { fontSize: 14, color: '#2ECC71', fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 16 },
  emptyDesc: { fontSize: 13, color: '#BBB', marginTop: 4 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  modalContent: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 28, width: '100%',
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF8E1',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  modalMessage: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  modalWarning: { fontSize: 12, color: '#E74C3C', textAlign: 'center', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelButton: {
    flex: 1, borderWidth: 1, borderColor: '#DDD', borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, color: '#666', fontWeight: '600' },
  modalRejectButton: {
    flex: 1, backgroundColor: '#E74C3C', borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  modalRejectText: { fontSize: 15, color: '#FFFFFF', fontWeight: 'bold' },
});
