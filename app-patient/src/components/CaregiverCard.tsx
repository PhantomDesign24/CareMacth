import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Caregiver {
  id: string;
  name: string;
  age: number;
  gender: string;
  experience: number;
  rating: number;
  reviewCount: number;
  certifications: string[];
  isExcellent: boolean;
  nationality: string;
  introduction: string;
  specialties: string[];
  profileImage?: string;
}

interface CaregiverCardProps {
  caregiver: Caregiver;
  onViewProfile: () => void;
  onSelect: () => void;
}

export default function CaregiverCard({
  caregiver,
  onViewProfile,
  onSelect,
}: CaregiverCardProps) {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#FFFFFF" />
          </View>
          {caregiver.isExcellent && (
            <View style={styles.excellentBadge}>
              <Ionicons name="star" size={10} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{caregiver.name}</Text>
            {caregiver.isExcellent && (
              <View style={styles.excellentTag}>
                <Text style={styles.excellentTagText}>우수 간병사</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta}>
            {caregiver.age}세 / {caregiver.gender} / {caregiver.nationality}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#F5A623" />
            <Text style={styles.ratingText}>
              {caregiver.rating} ({caregiver.reviewCount}개 리뷰)
            </Text>
            <Text style={styles.experienceText}>
              경력 {caregiver.experience}년
            </Text>
          </View>
        </View>
      </View>

      {/* Introduction */}
      <Text style={styles.introduction} numberOfLines={2}>
        {caregiver.introduction}
      </Text>

      {/* Certifications */}
      <View style={styles.certContainer}>
        {caregiver.certifications.map((cert, index) => (
          <View key={index} style={styles.certBadge}>
            <Ionicons name="ribbon-outline" size={12} color="#4A90D9" />
            <Text style={styles.certText}>{cert}</Text>
          </View>
        ))}
      </View>

      {/* Specialties */}
      <View style={styles.specialtyContainer}>
        {caregiver.specialties.map((specialty, index) => (
          <View key={index} style={styles.specialtyBadge}>
            <Text style={styles.specialtyText}>{specialty}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.profileButton} onPress={onViewProfile}>
          <Ionicons name="person-circle-outline" size={18} color="#4A90D9" />
          <Text style={styles.profileButtonText}>프로필 보기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.selectButton} onPress={onSelect}>
          <Text style={styles.selectButtonText}>선택하기</Text>
        </TouchableOpacity>
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
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  excellentBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F5A623',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  excellentTag: {
    backgroundColor: '#FFF5E0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  excellentTagText: {
    fontSize: 10,
    color: '#F5A623',
    fontWeight: 'bold',
  },
  meta: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#F5A623',
    fontWeight: '500',
    marginRight: 8,
  },
  experienceText: {
    fontSize: 12,
    color: '#888',
  },
  introduction: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  certContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  certText: {
    fontSize: 11,
    color: '#4A90D9',
    fontWeight: '500',
  },
  specialtyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  specialtyBadge: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  specialtyText: {
    fontSize: 11,
    color: '#888',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 14,
  },
  profileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 10,
  },
  profileButtonText: {
    fontSize: 13,
    color: '#4A90D9',
    fontWeight: '600',
  },
  selectButton: {
    flex: 1,
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
