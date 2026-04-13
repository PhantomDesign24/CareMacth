import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CaregiverCard from '../components/CaregiverCard';
import { patientApi } from '../services/api';

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

interface Review {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export default function CaregiverListScreen({ route, navigation }: any) {
  const { requestId } = route.params || { requestId: 'demo' };
  const [caregivers, setCaregivers] = useState<Caregiver[]>([
    {
      id: '1',
      name: '김간병',
      age: 45,
      gender: '여성',
      experience: 8,
      rating: 4.8,
      reviewCount: 56,
      certifications: ['요양보호사 1급', '간병사 자격증'],
      isExcellent: true,
      nationality: '한국',
      introduction: '8년차 전문 간병인입니다. 환자분과 보호자님의 마음을 이해하며 정성을 다해 돌봐드립니다.',
      specialties: ['뇌졸중 환자', '치매 환자', '수술 후 간병'],
    },
    {
      id: '2',
      name: '이돌봄',
      age: 38,
      gender: '여성',
      experience: 5,
      rating: 4.5,
      reviewCount: 32,
      certifications: ['요양보호사 1급'],
      isExcellent: false,
      nationality: '한국',
      introduction: '꼼꼼하고 성실한 간병 서비스를 제공합니다.',
      specialties: ['정형외과 환자', '재가 간병'],
    },
    {
      id: '3',
      name: '박케어',
      age: 50,
      gender: '남성',
      experience: 12,
      rating: 4.9,
      reviewCount: 89,
      certifications: ['요양보호사 1급', '간병사 자격증', '응급처치 수료'],
      isExcellent: true,
      nationality: '한국',
      introduction: '12년 경력의 베테랑 간병인입니다. 남성 환자 간병 전문입니다.',
      specialties: ['남성 환자', '중환자', '거동불가 환자'],
    },
  ]);

  const [selectedCaregiver, setSelectedCaregiver] = useState<Caregiver | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const mockReviews: Review[] = [
    {
      id: 'r1',
      authorName: '김*호',
      rating: 5,
      comment: '정말 친절하고 꼼꼼하게 간병해주셔서 감사합니다.',
      createdAt: '2026-03-15',
    },
    {
      id: 'r2',
      authorName: '이*연',
      rating: 4,
      comment: '환자를 잘 돌봐주셨습니다. 전반적으로 만족합니다.',
      createdAt: '2026-02-20',
    },
    {
      id: 'r3',
      authorName: '박*수',
      rating: 5,
      comment: '다음에도 꼭 이 간병인을 요청하고 싶습니다.',
      createdAt: '2026-01-10',
    },
  ];

  const handleViewProfile = (caregiver: Caregiver) => {
    setSelectedCaregiver(caregiver);
    setShowProfile(true);
  };

  const handleSelectCaregiver = (caregiverId: string) => {
    Alert.alert(
      '간병인 선택',
      '이 간병인을 선택하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '선택',
          onPress: async () => {
            setIsLoading(true);
            try {
              await patientApi.selectCaregiver(requestId, caregiverId);
              Alert.alert('선택 완료', '간병인이 선택되었습니다.\n결제를 진행해주세요.', [
                {
                  text: '결제하기',
                  onPress: () =>
                    navigation.navigate('Payment', {
                      requestId,
                      amount: 150000,
                    }),
                },
              ]);
            } catch (error: any) {
              Alert.alert('오류', '간병인 선택에 실패했습니다.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= Math.floor(rating) ? 'star' : star <= rating + 0.5 ? 'star-half' : 'star-outline'}
            size={16}
            color="#F5A623"
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerInfo}>
        <Ionicons name="people" size={20} color="#4A90D9" />
        <Text style={styles.headerInfoText}>
          총 {caregivers.length}명의 간병인이 지원했습니다
        </Text>
      </View>

      <FlatList
        data={caregivers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <CaregiverCard
            caregiver={item}
            onViewProfile={() => handleViewProfile(item)}
            onSelect={() => handleSelectCaregiver(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="hourglass-outline" size={64} color="#DDD" />
            <Text style={styles.emptyStateTitle}>아직 지원한 간병인이 없습니다</Text>
            <Text style={styles.emptyStateDesc}>잠시만 기다려주세요.</Text>
          </View>
        }
      />

      {/* Profile Modal */}
      <Modal visible={showProfile} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>간병인 프로필</Text>
            <TouchableOpacity onPress={() => setShowProfile(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {selectedCaregiver && (
            <>
              {/* Profile Info */}
              <View style={styles.profileSection}>
                <View style={styles.profileAvatar}>
                  <Ionicons name="person" size={40} color="#FFFFFF" />
                </View>
                <Text style={styles.profileName}>
                  {selectedCaregiver.name}
                  {selectedCaregiver.isExcellent && (
                    <Text style={styles.excellentBadge}> ★ 우수 간병사</Text>
                  )}
                </Text>
                <Text style={styles.profileMeta}>
                  {selectedCaregiver.age}세 / {selectedCaregiver.gender} / {selectedCaregiver.nationality}
                </Text>

                <View style={styles.profileStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{selectedCaregiver.experience}년</Text>
                    <Text style={styles.statLabel}>경력</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.statValue}>{selectedCaregiver.rating}</Text>
                      <Ionicons name="star" size={14} color="#F5A623" />
                    </View>
                    <Text style={styles.statLabel}>평점</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{selectedCaregiver.reviewCount}</Text>
                    <Text style={styles.statLabel}>리뷰</Text>
                  </View>
                </View>
              </View>

              {/* Introduction */}
              <View style={styles.profileDetailSection}>
                <Text style={styles.detailTitle}>자기소개</Text>
                <Text style={styles.detailText}>{selectedCaregiver.introduction}</Text>
              </View>

              {/* Certifications */}
              <View style={styles.profileDetailSection}>
                <Text style={styles.detailTitle}>자격증</Text>
                {selectedCaregiver.certifications.map((cert, index) => (
                  <View key={index} style={styles.certItem}>
                    <Ionicons name="ribbon" size={16} color="#4A90D9" />
                    <Text style={styles.certText}>{cert}</Text>
                  </View>
                ))}
              </View>

              {/* Specialties */}
              <View style={styles.profileDetailSection}>
                <Text style={styles.detailTitle}>전문 분야</Text>
                <View style={styles.specialtyContainer}>
                  {selectedCaregiver.specialties.map((specialty, index) => (
                    <View key={index} style={styles.specialtyBadge}>
                      <Text style={styles.specialtyText}>{specialty}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Reviews */}
              <View style={styles.profileDetailSection}>
                <Text style={styles.detailTitle}>
                  리뷰 ({selectedCaregiver.reviewCount})
                </Text>
                {mockReviews.map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewAuthor}>{review.authorName}</Text>
                      {renderStars(review.rating)}
                    </View>
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                    <Text style={styles.reviewDate}>{review.createdAt}</Text>
                  </View>
                ))}
              </View>

              {/* Select Button */}
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => {
                  setShowProfile(false);
                  handleSelectCaregiver(selectedCaregiver.id);
                }}
              >
                <Text style={styles.selectButtonText}>이 간병인 선택하기</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F6FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  headerInfoText: {
    fontSize: 14,
    color: '#4A90D9',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptyStateDesc: {
    fontSize: 13,
    color: '#BBB',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 8,
    borderBottomColor: '#F5F6F8',
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  excellentBadge: {
    fontSize: 13,
    color: '#F5A623',
    fontWeight: '600',
  },
  profileMeta: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E8E8E8',
  },
  profileDetailSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  certItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  certText: {
    fontSize: 14,
    color: '#555',
  },
  specialtyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyBadge: {
    backgroundColor: '#F0F6FF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  specialtyText: {
    fontSize: 13,
    color: '#4A90D9',
    fontWeight: '500',
  },
  reviewItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  reviewComment: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },
  reviewDate: {
    fontSize: 11,
    color: '#BBB',
    marginTop: 8,
  },
  selectButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 24,
    marginBottom: 40,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
