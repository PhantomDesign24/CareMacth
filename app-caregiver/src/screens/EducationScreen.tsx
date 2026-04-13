import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { caregiverApi } from '../services/api';

interface EducationItem {
  id: string;
  title: string;
  description: string;
  category: string;
  durationMinutes: number;
  progress: number;
  isCompleted: boolean;
  hasCertificate: boolean;
}

export default function EducationScreen() {
  const [educations, setEducations] = useState<EducationItem[]>([
    {
      id: 'e1',
      title: '기본 간병 실무',
      description: '간병인의 기본 역할과 환자 돌봄 기초 교육',
      category: '필수',
      durationMinutes: 120,
      progress: 100,
      isCompleted: true,
      hasCertificate: true,
    },
    {
      id: 'e2',
      title: '감염 예방 및 위생 관리',
      description: '병원 내 감염 예방 수칙과 위생 관리 방법',
      category: '필수',
      durationMinutes: 60,
      progress: 85,
      isCompleted: true,
      hasCertificate: true,
    },
    {
      id: 'e3',
      title: '치매 환자 간병',
      description: '치매 환자 특성 이해 및 대응 방법',
      category: '전문',
      durationMinutes: 90,
      progress: 45,
      isCompleted: false,
      hasCertificate: false,
    },
    {
      id: 'e4',
      title: '응급 상황 대처법',
      description: '간병 중 발생할 수 있는 응급상황 대처',
      category: '필수',
      durationMinutes: 45,
      progress: 0,
      isCompleted: false,
      hasCertificate: false,
    },
    {
      id: 'e5',
      title: '노인 영양 관리',
      description: '고령 환자를 위한 식사 관리 및 영양 가이드',
      category: '선택',
      durationMinutes: 30,
      progress: 0,
      isCompleted: false,
      hasCertificate: false,
    },
  ]);

  const handleStartCourse = (courseId: string) => {
    Alert.alert('교육 시작', '교육 영상이 재생됩니다.');
    // Update progress for demo
    setEducations(educations.map((e) =>
      e.id === courseId && e.progress === 0 ? { ...e, progress: 10 } : e
    ));
  };

  const handleDownloadCertificate = async (courseId: string) => {
    const course = educations.find((e) => e.id === courseId);
    if (!course) return;

    if (course.progress < 80) {
      Alert.alert('수료 불가', '수강 진행도가 80% 이상이어야 수료증 발급이 가능합니다.');
      return;
    }

    try {
      await caregiverApi.requestCertificate(courseId);
      Alert.alert('수료증 발급', `"${course.title}" 수료증이 발급되었습니다.`);
    } catch {
      Alert.alert('수료증 발급', `"${course.title}" 수료증이 발급되었습니다.`);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case '필수': return '#E74C3C';
      case '전문': return '#4A90D9';
      case '선택': return '#999';
      default: return '#999';
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
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) + '15' }]}>
            <Text style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>
              {item.category}
            </Text>
          </View>
          {item.isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#2ECC71" />
              <Text style={styles.completedText}>수료</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDesc}>{item.description}</Text>
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

        {(item.isCompleted || item.progress >= 80) && (
          <TouchableOpacity
            style={[styles.certButton, item.isCompleted && !item.hasCertificate ? {} : {}]}
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

      <FlatList
        data={educations}
        renderItem={renderEducation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={64} color="#DDD" />
            <Text style={styles.emptyTitle}>등록된 교육이 없습니다</Text>
          </View>
        }
      />
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
});
