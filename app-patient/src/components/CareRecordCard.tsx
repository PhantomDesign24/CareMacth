import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

interface CareRecordCardProps {
  record: CareRecord;
}

export default function CareRecordCard({ record }: CareRecordCardProps) {
  const [expanded, setExpanded] = useState(false);

  const recordItems = [
    { icon: 'thermometer-outline' as const, label: '체온', value: record.temperature + '°C' },
    { icon: 'heart-outline' as const, label: '혈압', value: record.bloodPressure + ' mmHg' },
    { icon: 'pulse-outline' as const, label: '맥박', value: record.pulse + ' bpm' },
    { icon: 'restaurant-outline' as const, label: '식사', value: record.meal },
    { icon: 'medkit-outline' as const, label: '투약', value: record.medication },
    { icon: 'water-outline' as const, label: '배변/배뇨', value: record.excretion },
    { icon: 'moon-outline' as const, label: '수면', value: record.sleep },
    { icon: 'walk-outline' as const, label: '활동/이동', value: record.activity },
    { icon: 'happy-outline' as const, label: '정서/정신상태', value: record.mentalStatus },
    { icon: 'body-outline' as const, label: '피부상태', value: record.skinCondition },
  ];

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="document-text" size={20} color="#4A90D9" />
          <Text style={styles.dateText}>{record.date} 간병 일지</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#999"
        />
      </TouchableOpacity>

      {!expanded && (
        <View style={styles.preview}>
          <View style={styles.previewRow}>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>체온</Text>
              <Text style={styles.previewValue}>{record.temperature}°C</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>혈압</Text>
              <Text style={styles.previewValue}>{record.bloodPressure}</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>맥박</Text>
              <Text style={styles.previewValue}>{record.pulse}</Text>
            </View>
          </View>
        </View>
      )}

      {expanded && (
        <View style={styles.details}>
          {recordItems.map((item, index) => (
            <View key={index} style={styles.detailItem}>
              <View style={styles.detailLabelRow}>
                <Ionicons name={item.icon} size={16} color="#4A90D9" />
                <Text style={styles.detailLabel}>{item.label}</Text>
              </View>
              <Text style={styles.detailValue}>{item.value}</Text>
            </View>
          ))}

          {/* Special Notes */}
          {record.specialNotes && (
            <View style={styles.specialNotesContainer}>
              <View style={styles.detailLabelRow}>
                <Ionicons name="alert-circle-outline" size={16} color="#F5A623" />
                <Text style={[styles.detailLabel, { color: '#F5A623' }]}>
                  특이사항
                </Text>
              </View>
              <Text style={styles.specialNotesText}>{record.specialNotes}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  preview: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 12,
  },
  previewItem: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  details: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  detailItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A90D9',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    paddingLeft: 22,
  },
  specialNotesContainer: {
    backgroundColor: '#FFF8F0',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  specialNotesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    paddingLeft: 22,
  },
});
