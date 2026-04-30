import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Linking,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { caregiverApi } from '../services/api';

interface EducationItem {
  id: string;
  title: string;
  description: string;
  videoUrl: string | null;
  durationMinutes: number;
  progress: number;
  isCompleted: boolean;
  hasCertificate: boolean;
}

export default function EducationScreen() {
  const [educations, setEducations] = useState<EducationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await caregiverApi.getCourses();
      const list = res?.data?.data?.educations || [];
      const mapped: EducationItem[] = list.map((e: any) => ({
        id: e.id,
        title: e.title,
        description: e.description || '',
        videoUrl: e.videoUrl || null,
        durationMinutes: e.duration || 0,
        progress: typeof e.progress === 'number' ? Math.round(e.progress) : 0,
        isCompleted: !!e.completed,
        hasCertificate: !!e.certificateUrl,
      }));
      setEducations(mapped);
    } catch (err: any) {
      Alert.alert('교육 목록 오류', err?.response?.data?.message || '교육 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleStartCourse = async (courseId: string) => {
    const course = educations.find((c) => c.id === courseId);
    if (!course) return;
    if (!course.videoUrl) {
      Alert.alert('영상 없음', '영상 URL이 등록되지 않은 과정입니다.');
      return;
    }
    try {
      const ok = await Linking.canOpenURL(course.videoUrl);
      if (!ok) {
        Alert.alert('열기 실패', '영상을 열 수 없습니다.');
        return;
      }
      await Linking.openURL(course.videoUrl);
    } catch {
      Alert.alert('열기 실패', '영상을 여는 중 오류가 발생했습니다.');
    }
  };

  const handleMarkComplete = async (courseId: string) => {
    const course = educations.find((c) => c.id === courseId);
    if (!course) return;
    if (course.progress < 80) {
      Alert.alert('수료 불가', '수강 진행도가 80% 이상이어야 수료 처리가 가능합니다. 영상 시청 후 다시 시도해주세요.');
      return;
    }
    try {
      await caregiverApi.completeCourse(courseId);
      Alert.alert('수료 완료', `"${course.title}" 수료가 완료되었습니다.`);
      fetchData();
    } catch (err: any) {
      Alert.alert('수료 실패', err?.response?.data?.message || '수료 처리 중 오류가 발생했습니다.');
    }
  };

  const handleDownloadCertificate = async (courseId: string) => {
    const course = educations.find((e) => e.id === courseId);
    if (!course) return;
    if (!course.isCompleted) {
      Alert.alert('수료증 없음', '먼저 과정을 수료해주세요.');
      return;
    }
    try {
      const res: any = await caregiverApi.requestCertificate(courseId);
      const certUrl = res?.data?.data?.certificateUrl || res?.data?.certificateUrl;
      if (certUrl) {
        await Linking.openURL(certUrl);
      } else {
        Alert.alert('수료증 발급', `"${course.title}" 수료증이 발급되었습니다. 마이페이지에서 확인해주세요.`);
      }
    } catch (err: any) {
      Alert.alert('수료증 발급 실패', err?.response?.data?.message || '발급 중 오류가 발생했습니다.');
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return '#2ECC71';
    if (progress >= 40) return '#F5A623';
    return '#E8E8E8';
  };

  const renderEducation = ({ item }: { item: EducationItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.categoryBadge, { backgroundColor: '#4A90D9' + '15' }]}>
            <Text style={[styles.categoryText, { color: '#4A90D9' }]}>교육</Text>
          </View>
          {item.isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#2ECC71" />
              <Text style={styles.completedText}>수료</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
        <View style={styles.durationRow}>
          <Ionicons name="time-outline" size={14} color="#888" />
          <Text style={styles.durationText}>{item.durationMinutes}분</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${item.progress}%`,
                backgroundColor: getProgressColor(item.progress),
              },
            ]}
          />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            수강 진행도: {item.progress}%
          </Text>
          {item.progress >= 80 && !item.isCompleted && (
            <Text style={styles.certAvailable}>수료 가능</Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        {!item.isCompleted ? (
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => handleStartCourse(item.id)}
          >
            <Ionicons
              name={item.progress > 0 ? 'play-circle' : 'play'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.startButtonText}>
              {item.progress > 0 ? '이어서 수강' : '수강 시작'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!item.isCompleted && item.progress >= 80 && (
          <TouchableOpacity
            style={styles.certButton}
            onPress={() => handleMarkComplete(item.id)}
          >
            <Ionicons name="checkmark-done-circle" size={18} color="#2ECC71" />
            <Text style={styles.certButtonText}>수료 처리</Text>
          </TouchableOpacity>
        )}

        {item.isCompleted && (
          <TouchableOpacity
            style={styles.certButton}
            onPress={() => handleDownloadCertificate(item.id)}
          >
            <Ionicons name="document-text-outline" size={18} color="#2ECC71" />
            <Text style={styles.certButtonText}>수료증 발급</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const completedCount = educations.filter((e) => e.isCompleted).length;
  const totalCount = educations.length;

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>수강 현황</Text>
          <Text style={styles.summaryValue}>
            {completedCount} / {totalCount}
          </Text>
          <Text style={styles.summaryDesc}>과정 수료</Text>
        </View>
        <View style={styles.summaryNotice}>
          <Ionicons name="information-circle" size={16} color="#4A90D9" />
          <Text style={styles.summaryNoticeText}>
            수강 80% 이상 시 수료증 발급이 가능합니다.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#2ECC71" />
          <Text style={styles.loadingText}>교육 목록을 불러오는 중...</Text>
        </View>
      ) : (
        <FlatList
          data={educations}
          renderItem={renderEducation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={64} color="#DDD" />
              <Text style={styles.emptyTitle}>등록된 교육이 없습니다</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  summarySection: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  summaryCard: { alignItems: 'center', marginBottom: 12 },
  summaryLabel: { fontSize: 13, color: '#888' },
  summaryValue: { fontSize: 28, fontWeight: 'bold', color: '#2ECC71', marginTop: 4 },
  summaryDesc: { fontSize: 12, color: '#BBB' },
  summaryNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0F6FF', borderRadius: 8, padding: 10,
  },
  summaryNoticeText: { fontSize: 12, color: '#4A90D9', flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { marginBottom: 16 },
  cardTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  categoryBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  categoryText: { fontSize: 11, fontWeight: '600' },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  completedText: { fontSize: 12, color: '#2ECC71', fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#888', lineHeight: 20, marginBottom: 8 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  durationText: { fontSize: 12, color: '#888' },
  progressSection: { marginBottom: 16 },
  progressBar: {
    height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden', marginBottom: 6,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { fontSize: 12, color: '#888' },
  certAvailable: { fontSize: 12, color: '#2ECC71', fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 10 },
  startButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 12, gap: 6,
  },
  startButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  certButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2ECC71', borderRadius: 12, paddingVertical: 12, gap: 6,
  },
  certButtonText: { color: '#2ECC71', fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 16 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#888' },
});
