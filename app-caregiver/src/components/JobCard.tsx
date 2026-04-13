import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

interface JobCardProps {
  job: JobItem;
  expectedEarnings: number;
  onApply: () => void;
  onAccept: () => void;
  onReject: () => void;
}

export default function JobCard({
  job,
  expectedEarnings,
  onApply,
  onAccept,
  onReject,
}: JobCardProps) {
  const getScheduleLabel = (type: string) =>
    type === 'full_time' ? '24시간' : '시간제';

  const getCareTypeLabel = (type: string) =>
    type === 'individual' ? '개인 간병' : '가족 간병';

  const getMobilityLabel = (status: string) => {
    switch (status) {
      case '독립가능': return '독립 가능';
      case '부분도움': return '부분 도움';
      case '거동불가': return '완전 의존';
      default: return status;
    }
  };

  const getMobilityColor = (status: string) => {
    switch (status) {
      case '독립가능': return '#2ECC71';
      case '부분도움': return '#F5A623';
      case '거동불가': return '#E74C3C';
      default: return '#888';
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return '#2ECC71';
    if (score >= 70) return '#F5A623';
    return '#999';
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tagRow}>
          <View style={styles.tagPrimary}>
            <Text style={styles.tagPrimaryText}>{getScheduleLabel(job.scheduleType)}</Text>
          </View>
          <View style={styles.tagSecondary}>
            <Text style={styles.tagSecondaryText}>{getCareTypeLabel(job.careType)}</Text>
          </View>
        </View>
        <View style={[styles.matchBadge, { backgroundColor: getMatchScoreColor(job.matchScore) + '15' }]}>
          <Text style={[styles.matchText, { color: getMatchScoreColor(job.matchScore) }]}>
            매칭 {job.matchScore}점
          </Text>
        </View>
      </View>

      {/* Location */}
      <View style={styles.locationRow}>
        <Ionicons name="location" size={16} color="#4A90D9" />
        <Text style={styles.address}>{job.address}</Text>
      </View>

      {/* Patient Info */}
      <View style={styles.patientSection}>
        <View style={styles.patientRow}>
          <Ionicons name="person-outline" size={14} color="#888" />
          <Text style={styles.patientText}>
            {job.patient.name} / {job.patient.age}세 / {job.patient.gender}
          </Text>
        </View>
        <View style={styles.patientRow}>
          <Ionicons name="medical-outline" size={14} color="#888" />
          <Text style={styles.patientText}>{job.patient.diagnosis}</Text>
        </View>
        <View style={styles.patientRow}>
          <Ionicons name="walk-outline" size={14} color={getMobilityColor(job.patient.mobilityStatus)} />
          <Text style={[styles.patientText, { color: getMobilityColor(job.patient.mobilityStatus) }]}>
            거동: {getMobilityLabel(job.patient.mobilityStatus)}
          </Text>
        </View>
      </View>

      {/* Schedule & Earnings */}
      <View style={styles.detailsSection}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={14} color="#888" />
          <Text style={styles.detailText}>
            {job.startDate} ~ {job.endDate}
          </Text>
        </View>
        <View style={styles.earningsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="cash-outline" size={14} color="#888" />
            <Text style={styles.detailText}>
              일당 {job.dailyRate.toLocaleString()}원
            </Text>
          </View>
          <View style={styles.expectedEarnings}>
            <Text style={styles.expectedEarningsLabel}>예상 수익</Text>
            <Text style={styles.expectedEarningsValue}>
              {expectedEarnings.toLocaleString()}원
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        {job.applicationStatus === 'applied' ? (
          <View style={styles.appliedBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#2ECC71" />
            <Text style={styles.appliedText}>지원 완료</Text>
          </View>
        ) : job.applicationStatus === 'accepted' ? (
          <View style={styles.acceptedBadge}>
            <Ionicons name="star" size={18} color="#F5A623" />
            <Text style={styles.acceptedText}>매칭 확정</Text>
          </View>
        ) : (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.rejectButton} onPress={onReject}>
              <Ionicons name="close" size={18} color="#E74C3C" />
              <Text style={styles.rejectButtonText}>거절</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={onApply}>
              <Text style={styles.applyButtonText}>지원하기</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagPrimary: {
    backgroundColor: '#F0F6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagPrimaryText: {
    color: '#4A90D9',
    fontSize: 11,
    fontWeight: '600',
  },
  tagSecondary: {
    backgroundColor: '#F0FFF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagSecondaryText: {
    color: '#2ECC71',
    fontSize: 11,
    fontWeight: '600',
  },
  matchBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  matchText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  address: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  patientSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 12,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  patientText: {
    fontSize: 13,
    color: '#555',
  },
  detailsSection: {
    marginBottom: 16,
    gap: 6,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#888',
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expectedEarnings: {
    alignItems: 'flex-end',
  },
  expectedEarningsLabel: {
    fontSize: 10,
    color: '#BBB',
  },
  expectedEarningsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  actionsSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FFCCCC',
    borderRadius: 12,
    paddingVertical: 12,
  },
  rejectButtonText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    backgroundColor: '#2ECC71',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    paddingVertical: 12,
  },
  appliedText: {
    color: '#2ECC71',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    paddingVertical: 12,
  },
  acceptedText: {
    color: '#F5A623',
    fontSize: 14,
    fontWeight: '600',
  },
});
