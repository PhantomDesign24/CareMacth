import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientApi } from '../services/api';

export default function ReviewScreen({ route, navigation }: any) {
  const { careId, caregiverName } = route.params || {
    careId: 'demo',
    caregiverName: '김간병',
  };

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [rehire, setRehire] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const ratingLabels = ['', '매우 불만족', '불만족', '보통', '만족', '매우 만족'];

  const handleSubmitReview = async () => {
    if (rating === 0) {
      Alert.alert('알림', '별점을 선택해주세요.');
      return;
    }
    if (!reviewText.trim()) {
      Alert.alert('알림', '리뷰 내용을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await patientApi.createReview(careId, {
        rating,
        comment: reviewText,
        rehire,
      });
      Alert.alert('리뷰 등록 완료', '리뷰가 등록되었습니다. 감사합니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('오류', '리뷰 등록에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        {/* Caregiver Info */}
        <View style={styles.caregiverInfo}>
          <View style={styles.caregiverAvatar}>
            <Ionicons name="person" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.caregiverName}>{caregiverName} 간병인</Text>
          <Text style={styles.subtitle}>간병 서비스는 어떠셨나요?</Text>
        </View>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>별점 평가</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                style={styles.starButton}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={40}
                  color={star <= rating ? '#F5A623' : '#DDD'}
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingLabel}>{ratingLabels[rating]}</Text>
          )}
        </View>

        {/* Review Text */}
        <View style={styles.reviewSection}>
          <Text style={styles.sectionTitle}>리뷰 작성</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder="간병 서비스에 대한 솔직한 후기를 남겨주세요.&#10;다른 보호자님들에게 도움이 됩니다."
            placeholderTextColor="#B0B0B0"
            value={reviewText}
            onChangeText={setReviewText}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{reviewText.length}/500</Text>
        </View>

        {/* Rehire */}
        <View style={styles.rehireSection}>
          <Text style={styles.sectionTitle}>재고용 의사</Text>
          <Text style={styles.rehireDesc}>
            다음에도 이 간병인에게 간병을 맡기시겠습니까?
          </Text>
          <View style={styles.rehireOptions}>
            <TouchableOpacity
              style={[
                styles.rehireButton,
                rehire === true && styles.rehireButtonActive,
              ]}
              onPress={() => setRehire(true)}
            >
              <Ionicons
                name="thumbs-up"
                size={24}
                color={rehire === true ? '#2ECC71' : '#CCC'}
              />
              <Text
                style={[
                  styles.rehireButtonText,
                  rehire === true && styles.rehireButtonTextActive,
                ]}
              >
                네, 다시 맡기고 싶어요
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.rehireButton,
                rehire === false && styles.rehireButtonNegative,
              ]}
              onPress={() => setRehire(false)}
            >
              <Ionicons
                name="thumbs-down"
                size={24}
                color={rehire === false ? '#E74C3C' : '#CCC'}
              />
              <Text
                style={[
                  styles.rehireButtonText,
                  rehire === false && styles.rehireButtonTextNegative,
                ]}
              >
                아니요
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmitReview}
          disabled={isLoading || rating === 0}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>리뷰 등록</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  caregiverInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  caregiverAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  caregiverName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 15,
    color: '#F5A623',
    fontWeight: '600',
    marginTop: 12,
  },
  reviewSection: {
    marginBottom: 32,
  },
  reviewInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 16,
    fontSize: 15,
    color: '#333',
    height: 150,
    lineHeight: 22,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#BBB',
    marginTop: 8,
  },
  rehireSection: {
    marginBottom: 32,
  },
  rehireDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    marginTop: -8,
  },
  rehireOptions: {
    gap: 12,
  },
  rehireButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 16,
  },
  rehireButtonActive: {
    borderColor: '#2ECC71',
    backgroundColor: '#F0FFF4',
  },
  rehireButtonNegative: {
    borderColor: '#E74C3C',
    backgroundColor: '#FFF5F5',
  },
  rehireButtonText: {
    fontSize: 15,
    color: '#999',
    fontWeight: '500',
  },
  rehireButtonTextActive: {
    color: '#2ECC71',
    fontWeight: 'bold',
  },
  rehireButtonTextNegative: {
    color: '#E74C3C',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#B0C8E8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
