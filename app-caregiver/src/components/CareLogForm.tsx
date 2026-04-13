import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface CareLogFormProps {
  onSubmit: (logData: Record<string, any>) => void;
  isSubmitting?: boolean;
}

export default function CareLogForm({ onSubmit, isSubmitting = false }: CareLogFormProps) {
  const [temperature, setTemperature] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulse, setPulse] = useState('');
  const [meal, setMeal] = useState('');
  const [medication, setMedication] = useState('');
  const [excretion, setExcretion] = useState('');
  const [sleep, setSleep] = useState('');
  const [activity, setActivity] = useState('');
  const [mentalStatus, setMentalStatus] = useState('');
  const [skinCondition, setSkinCondition] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다. 설정에서 허용해주세요.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const launchGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다. 설정에서 허용해주세요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const handlePhotoUpload = () => {
    Alert.alert(
      '사진 업로드',
      '사진을 추가할 방법을 선택해주세요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '카메라', onPress: launchCamera },
        { text: '갤러리', onPress: launchGallery },
      ]
    );
  };

  const handleSubmit = () => {
    if (!temperature && !bloodPressure && !pulse && !meal) {
      Alert.alert('알림', '최소한 하나의 항목을 입력해주세요.');
      return;
    }

    const logData = {
      temperature,
      bloodPressure,
      pulse,
      meal,
      medication,
      excretion,
      sleep,
      activity,
      mentalStatus,
      skinCondition,
      specialNotes,
      photos,
    };

    onSubmit(logData);

    // Reset form
    setTemperature('');
    setBloodPressure('');
    setPulse('');
    setMeal('');
    setMedication('');
    setExcretion('');
    setSleep('');
    setActivity('');
    setMentalStatus('');
    setSkinCondition('');
    setSpecialNotes('');
    setPhotos([]);
  };

  const vitalFields = [
    {
      label: '체온',
      unit: '°C',
      value: temperature,
      setter: setTemperature,
      placeholder: '36.5',
      keyboardType: 'numeric' as const,
      icon: 'thermometer-outline' as const,
    },
    {
      label: '혈압',
      unit: 'mmHg',
      value: bloodPressure,
      setter: setBloodPressure,
      placeholder: '120/80',
      keyboardType: 'default' as const,
      icon: 'heart-outline' as const,
    },
    {
      label: '맥박',
      unit: 'bpm',
      value: pulse,
      setter: setPulse,
      placeholder: '72',
      keyboardType: 'numeric' as const,
      icon: 'pulse-outline' as const,
    },
  ];

  const textFields = [
    {
      label: '식사',
      value: meal,
      setter: setMeal,
      placeholder: '아침: / 점심: / 저녁: 식사량',
      icon: 'restaurant-outline' as const,
    },
    {
      label: '투약',
      value: medication,
      setter: setMedication,
      placeholder: '복용 약물 및 시간',
      icon: 'medkit-outline' as const,
    },
    {
      label: '배변/배뇨',
      value: excretion,
      setter: setExcretion,
      placeholder: '횟수 및 상태',
      icon: 'water-outline' as const,
    },
    {
      label: '수면',
      value: sleep,
      setter: setSleep,
      placeholder: '수면 시간 및 질',
      icon: 'moon-outline' as const,
    },
    {
      label: '활동/이동',
      value: activity,
      setter: setActivity,
      placeholder: '활동량 및 이동 보조 내용',
      icon: 'walk-outline' as const,
    },
    {
      label: '정서/정신상태',
      value: mentalStatus,
      setter: setMentalStatus,
      placeholder: '기분, 인지 상태, 정서 변화',
      icon: 'happy-outline' as const,
    },
    {
      label: '피부상태',
      value: skinCondition,
      setter: setSkinCondition,
      placeholder: '욕창, 발적, 부종 등',
      icon: 'body-outline' as const,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Vital Signs */}
      <Text style={styles.groupTitle}>활력 징후</Text>
      <View style={styles.vitalRow}>
        {vitalFields.map((field) => (
          <View key={field.label} style={styles.vitalField}>
            <View style={styles.vitalLabelRow}>
              <Ionicons name={field.icon} size={14} color="#2ECC71" />
              <Text style={styles.vitalLabel}>{field.label}</Text>
            </View>
            <View style={styles.vitalInputContainer}>
              <TextInput
                style={styles.vitalInput}
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                placeholderTextColor="#CCC"
                keyboardType={field.keyboardType}
              />
              <Text style={styles.vitalUnit}>{field.unit}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Text Fields */}
      <Text style={styles.groupTitle}>간병 기록</Text>
      {textFields.map((field) => (
        <View key={field.label} style={styles.textFieldContainer}>
          <View style={styles.textFieldLabelRow}>
            <Ionicons name={field.icon} size={15} color="#2ECC71" />
            <Text style={styles.textFieldLabel}>{field.label}</Text>
          </View>
          <TextInput
            style={styles.textInput}
            value={field.value}
            onChangeText={field.setter}
            placeholder={field.placeholder}
            placeholderTextColor="#CCC"
            multiline
          />
        </View>
      ))}

      {/* Special Notes */}
      <View style={styles.textFieldContainer}>
        <View style={styles.textFieldLabelRow}>
          <Ionicons name="alert-circle-outline" size={15} color="#F5A623" />
          <Text style={[styles.textFieldLabel, { color: '#F5A623' }]}>특이사항</Text>
        </View>
        <TextInput
          style={[styles.textInput, styles.specialNotesInput]}
          value={specialNotes}
          onChangeText={setSpecialNotes}
          placeholder="특이사항이 있으면 기록해주세요"
          placeholderTextColor="#CCC"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Photo Upload */}
      <View style={styles.photoSection}>
        <Text style={styles.groupTitle}>사진 첨부</Text>
        <TouchableOpacity style={styles.photoUploadButton} onPress={handlePhotoUpload}>
          <Ionicons name="camera-outline" size={24} color="#2ECC71" />
          <Text style={styles.photoUploadText}>사진 추가</Text>
        </TouchableOpacity>
        {photos.length > 0 && (
          <View style={styles.photoGrid}>
            {photos.map((uri, index) => (
              <View key={index} style={styles.photoItem}>
                <Image source={{ uri }} style={styles.photoThumb} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
                >
                  <Ionicons name="close-circle" size={20} color="#E74C3C" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <Ionicons name="save-outline" size={20} color="#FFFFFF" />
        <Text style={styles.submitButtonText}>
          {isSubmitting ? '저장 중...' : '간병 일지 저장'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  groupTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  vitalRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  vitalField: {
    flex: 1,
  },
  vitalLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  vitalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  vitalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 10,
    height: 42,
  },
  vitalInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
  },
  vitalUnit: {
    fontSize: 11,
    color: '#BBB',
  },
  textFieldContainer: {
    marginBottom: 14,
  },
  textFieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  textFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  textInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    minHeight: 42,
  },
  specialNotesInput: {
    minHeight: 80,
  },
  photoSection: {
    marginBottom: 20,
  },
  photoUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#2ECC71',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
  },
  photoUploadText: {
    color: '#2ECC71',
    fontSize: 14,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  photoItem: {
    position: 'relative',
  },
  photoThumb: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2ECC71',
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
