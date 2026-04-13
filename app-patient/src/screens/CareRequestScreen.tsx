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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientApi } from '../services/api';

type CareForm = 'hospital' | 'home' | 'facility';
type Gender = 'male' | 'female' | 'any';

export default function CareRequestScreen({ navigation }: any) {
  // Patient Info
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState<Gender>('any');
  const [diagnosis, setDiagnosis] = useState('');
  const [weight, setWeight] = useState('');
  const [mobility, setMobility] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');

  // Care Details
  const [careForm, setCareForm] = useState<CareForm>('hospital');
  const [location, setLocation] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState('');

  // Preferences
  const [preferredGender, setPreferredGender] = useState<Gender>('any');
  const [preferredNationality, setPreferredNationality] = useState('any');

  // Medical disclaimer
  const [medicalDisclaimer, setMedicalDisclaimer] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = ['환자 정보', '간병 형태', '선호 조건', '확인'];

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        if (!patientName.trim()) {
          Alert.alert('알림', '환자 이름을 입력해주세요.');
          return false;
        }
        if (!patientAge.trim()) {
          Alert.alert('알림', '환자 나이를 입력해주세요.');
          return false;
        }
        return true;
      case 1:
        if (!location.trim()) {
          Alert.alert('알림', '간병 위치를 입력해주세요.');
          return false;
        }
        if (!startDate.trim()) {
          Alert.alert('알림', '시작일을 입력해주세요.');
          return false;
        }
        if (!duration.trim()) {
          Alert.alert('알림', '간병 기간을 입력해주세요.');
          return false;
        }
        return true;
      case 2:
        return true;
      case 3:
        if (!medicalDisclaimer) {
          Alert.alert('알림', '의료행위 금지 동의를 확인해주세요.');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!medicalDisclaimer) {
      Alert.alert('알림', '의료행위 금지 동의를 확인해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await patientApi.createCareRequest({
        patient: {
          name: patientName,
          age: parseInt(patientAge),
          gender: patientGender,
          diagnosis,
          weight: weight ? parseFloat(weight) : undefined,
          mobility,
          specialNotes,
        },
        careForm,
        location,
        roomNumber,
        startDate,
        duration: parseInt(duration),
        preferences: {
          gender: preferredGender,
          nationality: preferredNationality,
        },
        medicalDisclaimerAgreed: true,
      });
      Alert.alert('간병 요청 완료', '간병 요청이 등록되었습니다.\n간병인의 지원을 기다려주세요.', [
        { text: '확인', onPress: () => navigation.navigate('홈') },
      ]);
    } catch (error: any) {
      const message = error.response?.data?.message || '간병 요청에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {steps.map((step, index) => (
        <View key={index} style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              index <= currentStep && styles.stepCircleActive,
              index < currentStep && styles.stepCircleCompleted,
            ]}
          >
            {index < currentStep ? (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.stepNumber,
                  index <= currentStep && styles.stepNumberActive,
                ]}
              >
                {index + 1}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.stepLabel,
              index <= currentStep && styles.stepLabelActive,
            ]}
          >
            {step}
          </Text>
          {index < steps.length - 1 && (
            <View
              style={[
                styles.stepLine,
                index < currentStep && styles.stepLineActive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderPatientInfo = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>환자 정보 입력</Text>

      <Text style={styles.label}>환자 이름 *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="환자 이름"
        placeholderTextColor="#B0B0B0"
        value={patientName}
        onChangeText={setPatientName}
      />

      <Text style={styles.label}>나이 *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="나이"
        placeholderTextColor="#B0B0B0"
        value={patientAge}
        onChangeText={setPatientAge}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>성별</Text>
      <View style={styles.optionRow}>
        {([
          { key: 'male' as Gender, label: '남성' },
          { key: 'female' as Gender, label: '여성' },
        ]).map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.optionButton,
              patientGender === option.key && styles.optionButtonActive,
            ]}
            onPress={() => setPatientGender(option.key)}
          >
            <Text
              style={[
                styles.optionButtonText,
                patientGender === option.key && styles.optionButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>진단명 / 질환</Text>
      <TextInput
        style={styles.textInput}
        placeholder="예: 뇌졸중, 치매, 골절 등"
        placeholderTextColor="#B0B0B0"
        value={diagnosis}
        onChangeText={setDiagnosis}
      />

      <Text style={styles.label}>체중 (kg)</Text>
      <TextInput
        style={styles.textInput}
        placeholder="체중"
        placeholderTextColor="#B0B0B0"
        value={weight}
        onChangeText={setWeight}
        keyboardType="numeric"
      />

      <Text style={styles.label}>거동 상태</Text>
      <TextInput
        style={styles.textInput}
        placeholder="예: 자력보행가능, 보조필요, 거동불가"
        placeholderTextColor="#B0B0B0"
        value={mobility}
        onChangeText={setMobility}
      />

      <Text style={styles.label}>특이사항</Text>
      <TextInput
        style={[styles.textInput, styles.textArea]}
        placeholder="추가 참고 사항을 입력해주세요"
        placeholderTextColor="#B0B0B0"
        value={specialNotes}
        onChangeText={setSpecialNotes}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
    </View>
  );

  const renderCareForm = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>간병 형태 선택</Text>

      <Text style={styles.label}>간병 형태 *</Text>
      <View style={styles.careFormContainer}>
        {([
          { key: 'hospital' as CareForm, label: '병원 간병', icon: 'business' as const, desc: '병원 입원 환자 간병' },
          { key: 'home' as CareForm, label: '재가 간병', icon: 'home' as const, desc: '자택에서의 간병' },
          { key: 'facility' as CareForm, label: '시설 간병', icon: 'medkit' as const, desc: '요양원/시설 간병' },
        ]).map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.careFormButton,
              careForm === option.key && styles.careFormButtonActive,
            ]}
            onPress={() => setCareForm(option.key)}
          >
            <Ionicons
              name={option.icon}
              size={24}
              color={careForm === option.key ? '#4A90D9' : '#999'}
            />
            <Text
              style={[
                styles.careFormLabel,
                careForm === option.key && styles.careFormLabelActive,
              ]}
            >
              {option.label}
            </Text>
            <Text style={styles.careFormDesc}>{option.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>간병 위치 *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="예: 서울대학교병원"
        placeholderTextColor="#B0B0B0"
        value={location}
        onChangeText={setLocation}
      />

      <Text style={styles.label}>병실/호실</Text>
      <TextInput
        style={styles.textInput}
        placeholder="예: 301호"
        placeholderTextColor="#B0B0B0"
        value={roomNumber}
        onChangeText={setRoomNumber}
      />

      <Text style={styles.label}>시작일 *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#B0B0B0"
        value={startDate}
        onChangeText={setStartDate}
      />

      <Text style={styles.label}>간병 기간 (일) *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="일수를 입력해주세요"
        placeholderTextColor="#B0B0B0"
        value={duration}
        onChangeText={setDuration}
        keyboardType="number-pad"
      />
    </View>
  );

  const renderPreferences = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>선호 조건</Text>

      <Text style={styles.label}>선호 성별</Text>
      <View style={styles.optionRow}>
        {([
          { key: 'any' as Gender, label: '무관' },
          { key: 'male' as Gender, label: '남성' },
          { key: 'female' as Gender, label: '여성' },
        ]).map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.optionButton,
              preferredGender === option.key && styles.optionButtonActive,
            ]}
            onPress={() => setPreferredGender(option.key)}
          >
            <Text
              style={[
                styles.optionButtonText,
                preferredGender === option.key && styles.optionButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>선호 국적</Text>
      <View style={styles.optionRow}>
        {[
          { key: 'any', label: '무관' },
          { key: 'korean', label: '내국인' },
          { key: 'foreign', label: '외국인' },
        ].map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.optionButton,
              preferredNationality === option.key && styles.optionButtonActive,
            ]}
            onPress={() => setPreferredNationality(option.key)}
          >
            <Text
              style={[
                styles.optionButtonText,
                preferredNationality === option.key && styles.optionButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>요청 내용 확인</Text>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>환자 정보</Text>
        <Text style={styles.summaryValue}>
          {patientName} / {patientAge}세 / {patientGender === 'male' ? '남' : '여'}
        </Text>
        {diagnosis ? (
          <>
            <Text style={styles.summaryLabel}>진단명</Text>
            <Text style={styles.summaryValue}>{diagnosis}</Text>
          </>
        ) : null}
        <Text style={styles.summaryLabel}>간병 형태</Text>
        <Text style={styles.summaryValue}>
          {careForm === 'hospital' ? '병원 간병' : careForm === 'home' ? '재가 간병' : '시설 간병'}
        </Text>
        <Text style={styles.summaryLabel}>위치</Text>
        <Text style={styles.summaryValue}>
          {location} {roomNumber ? `(${roomNumber})` : ''}
        </Text>
        <Text style={styles.summaryLabel}>기간</Text>
        <Text style={styles.summaryValue}>
          {startDate} 부터 {duration}일간
        </Text>
        <Text style={styles.summaryLabel}>선호 조건</Text>
        <Text style={styles.summaryValue}>
          성별: {preferredGender === 'any' ? '무관' : preferredGender === 'male' ? '남성' : '여성'} /
          국적: {preferredNationality === 'any' ? '무관' : preferredNationality === 'korean' ? '내국인' : '외국인'}
        </Text>
      </View>

      {/* Medical Disclaimer - MUST HAVE */}
      <View style={styles.disclaimerContainer}>
        <View style={styles.disclaimerHeader}>
          <Ionicons name="warning" size={20} color="#E74C3C" />
          <Text style={styles.disclaimerTitle}>의료행위 금지 안내</Text>
        </View>
        <Text style={styles.disclaimerText}>
          본 플랫폼의 간병사는 「의료법」상 의료인이 아니므로 의료행위를 수행할 수 없습니다.
          간병사는 환자의 일상생활 보조(식사, 위생, 이동 등)만 가능하며, 투약, 주사, 의료적 처치 등은
          반드시 의료인(의사, 간호사 등)에게 요청하셔야 합니다.
          간병사에게 의료행위를 요구하거나, 간병사가 무단으로 의료행위를 수행할 경우 관련 법령에 따라
          책임을 질 수 있습니다.
        </Text>

        <TouchableOpacity
          style={styles.disclaimerCheckbox}
          onPress={() => setMedicalDisclaimer(!medicalDisclaimer)}
        >
          <Ionicons
            name={medicalDisclaimer ? 'checkbox' : 'square-outline'}
            size={24}
            color={medicalDisclaimer ? '#4A90D9' : '#999'}
          />
          <Text style={styles.disclaimerCheckboxText}>
            의료행위는 간병사가 수행할 수 없음을 확인했습니다.
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderPatientInfo();
      case 1:
        return renderCareForm();
      case 2:
        return renderPreferences();
      case 3:
        return renderConfirmation();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepIndicator()}
        {renderCurrentStep()}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {currentStep > 0 && (
          <TouchableOpacity style={styles.prevButton} onPress={handlePrevious}>
            <Ionicons name="arrow-back" size={20} color="#666" />
            <Text style={styles.prevButtonText}>이전</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {currentStep < steps.length - 1 ? (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>다음</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, !medicalDisclaimer && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading || !medicalDisclaimer}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>간병 요청하기</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#4A90D9',
  },
  stepCircleCompleted: {
    backgroundColor: '#2ECC71',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 10,
    color: '#999',
    marginLeft: 4,
    marginRight: 4,
  },
  stepLabelActive: {
    color: '#4A90D9',
    fontWeight: '600',
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: '#E8E8E8',
    marginHorizontal: 2,
  },
  stepLineActive: {
    backgroundColor: '#2ECC71',
  },
  stepContent: {
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    color: '#333',
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  optionButtonActive: {
    borderColor: '#4A90D9',
    backgroundColor: '#F0F6FF',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  optionButtonTextActive: {
    color: '#4A90D9',
    fontWeight: 'bold',
  },
  careFormContainer: {
    gap: 10,
  },
  careFormButton: {
    borderWidth: 2,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  careFormButtonActive: {
    borderColor: '#4A90D9',
    backgroundColor: '#F0F6FF',
  },
  careFormLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#999',
  },
  careFormLabelActive: {
    color: '#4A90D9',
  },
  careFormDesc: {
    fontSize: 12,
    color: '#BBB',
    flex: 1,
    textAlign: 'right',
  },
  summaryCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 12,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  disclaimerContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCCCC',
    padding: 20,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  disclaimerText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  disclaimerCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFE0E0',
  },
  disclaimerCheckboxText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD',
    gap: 6,
  },
  prevButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90D9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 6,
  },
  nextButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#B0C8E8',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
