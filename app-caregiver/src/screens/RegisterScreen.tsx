import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { caregiverApi } from '../services/api';

interface RegisterScreenProps {
  navigation: any;
}

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [nationality, setNationality] = useState('KR');

  // Step 2: Verification & Certs
  const [identityVerified, setIdentityVerified] = useState(false);
  const [criminalCheckAcknowledged, setCriminalCheckAcknowledged] = useState(false);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [newCertification, setNewCertification] = useState('');

  // Step 3: Terms
  const [referralCode, setReferralCode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  const steps = ['기본 정보', '인증 / 자격', '약관 동의'];

  const addCertification = () => {
    if (newCertification.trim()) {
      setCertifications([...certifications, newCertification.trim()]);
      setNewCertification('');
    }
  };

  const removeCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        if (!name.trim()) { Alert.alert('알림', '이름을 입력해주세요.'); return false; }
        if (!email.trim()) { Alert.alert('알림', '이메일을 입력해주세요.'); return false; }
        if (!password || password.length < 8) { Alert.alert('알림', '비밀번호는 8자 이상 입력해주세요.'); return false; }
        if (password !== confirmPassword) { Alert.alert('알림', '비밀번호가 일치하지 않습니다.'); return false; }
        if (!phone.trim()) { Alert.alert('알림', '휴대폰 번호를 입력해주세요.'); return false; }
        if (!gender) { Alert.alert('알림', '성별을 선택해주세요.'); return false; }
        return true;
      case 1:
        return true;
      case 2:
        if (!agreeTerms || !agreePrivacy) { Alert.alert('알림', '필수 약관에 동의해주세요.'); return false; }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep) && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRegister = async () => {
    if (!validateStep(2)) return;

    setIsLoading(true);
    try {
      await caregiverApi.register({
        name,
        email,
        password,
        phone,
        gender,
        nationality,
        certifications,
        referralCode: referralCode.trim() || undefined,
      });
      Alert.alert(
        '회원가입 완료',
        '회원가입이 완료되었습니다.\n\n관리자 승인 후 활동이 가능합니다.\n신원 인증, 범죄 이력 조회, 자격증 등록을 완료해주세요.',
        [{ text: '확인', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      const message = error.response?.data?.message || '회원가입에 실패했습니다.';
      Alert.alert('회원가입 실패', message);
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
              <Text style={[styles.stepNumber, index <= currentStep && styles.stepNumberActive]}>
                {index + 1}
              </Text>
            )}
          </View>
          <Text style={[styles.stepLabel, index <= currentStep && styles.stepLabelActive]}>
            {step}
          </Text>
          {index < steps.length - 1 && (
            <View style={[styles.stepLine, index < currentStep && styles.stepLineActive]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View>
      <Text style={styles.sectionTitle}>기본 정보 입력</Text>

      <Text style={styles.label}>이름 *</Text>
      <View style={styles.inputContainer}>
        <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="이름" placeholderTextColor="#B0B0B0"
          value={name} onChangeText={setName} />
      </View>

      <Text style={styles.label}>이메일 *</Text>
      <View style={styles.inputContainer}>
        <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="이메일" placeholderTextColor="#B0B0B0"
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </View>

      <Text style={styles.label}>비밀번호 * (8자 이상)</Text>
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="비밀번호" placeholderTextColor="#B0B0B0"
          value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
      </View>

      <Text style={styles.label}>비밀번호 확인 *</Text>
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="비밀번호 확인" placeholderTextColor="#B0B0B0"
          value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
      </View>

      <Text style={styles.label}>휴대폰 번호 *</Text>
      <View style={styles.inputContainer}>
        <Ionicons name="call-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput style={styles.input} placeholder="010-0000-0000" placeholderTextColor="#B0B0B0"
          value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </View>

      <Text style={styles.label}>성별 *</Text>
      <View style={styles.optionRow}>
        {([
          { key: 'male' as const, label: '남성' },
          { key: 'female' as const, label: '여성' },
        ]).map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.optionButton, gender === option.key && styles.optionButtonActive]}
            onPress={() => setGender(option.key)}
          >
            <Text style={[styles.optionButtonText, gender === option.key && styles.optionButtonTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>국적</Text>
      <View style={styles.optionRow}>
        {[
          { key: 'KR', label: '한국' },
          { key: 'CN', label: '중국' },
          { key: 'VN', label: '베트남' },
          { key: 'OTHER', label: '기타' },
        ].map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.optionButtonSmall, nationality === option.key && styles.optionButtonActive]}
            onPress={() => setNationality(option.key)}
          >
            <Text style={[styles.optionButtonText, nationality === option.key && styles.optionButtonTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text style={styles.sectionTitle}>인증 및 자격증</Text>

      {/* Identity Verification */}
      <View style={styles.verificationCard}>
        <View style={styles.verificationHeader}>
          <Ionicons name="id-card-outline" size={24} color="#2ECC71" />
          <Text style={styles.verificationTitle}>신원 인증</Text>
        </View>
        <Text style={styles.verificationDesc}>
          신분증(주민등록증 또는 여권)을 제출하여 본인 확인을 진행합니다.
        </Text>
        <TouchableOpacity
          style={[styles.verificationButton, identityVerified && styles.verificationButtonDone]}
          onPress={() => {
            setIdentityVerified(true);
            Alert.alert('신원 인증', '신원 인증 서류가 접수되었습니다.\n관리자 확인 후 승인됩니다.');
          }}
        >
          <Ionicons
            name={identityVerified ? 'checkmark-circle' : 'cloud-upload-outline'}
            size={18}
            color={identityVerified ? '#2ECC71' : '#FFFFFF'}
          />
          <Text style={[styles.verificationButtonText, identityVerified && styles.verificationButtonTextDone]}>
            {identityVerified ? '제출 완료' : '신분증 제출'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Criminal Check */}
      <View style={styles.verificationCard}>
        <View style={styles.verificationHeader}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#F5A623" />
          <Text style={styles.verificationTitle}>범죄 이력 조회</Text>
        </View>
        <Text style={styles.verificationDesc}>
          경찰청에서 발급한 범죄경력회보서를 제출해주세요.{'\n'}
          범죄 이력 조회는 보호자의 안전을 위해 필수적으로 진행됩니다.
        </Text>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setCriminalCheckAcknowledged(!criminalCheckAcknowledged)}
        >
          <Ionicons
            name={criminalCheckAcknowledged ? 'checkbox' : 'square-outline'}
            size={22}
            color={criminalCheckAcknowledged ? '#2ECC71' : '#999'}
          />
          <Text style={styles.checkboxText}>범죄 이력 조회에 동의합니다</Text>
        </TouchableOpacity>
      </View>

      {/* Certifications */}
      <View style={styles.verificationCard}>
        <View style={styles.verificationHeader}>
          <Ionicons name="ribbon-outline" size={24} color="#4A90D9" />
          <Text style={styles.verificationTitle}>자격증 등록</Text>
        </View>
        <Text style={styles.verificationDesc}>
          보유한 자격증을 등록해주세요. (예: 요양보호사, 간병사 등)
        </Text>
        <View style={styles.certInputRow}>
          <TextInput
            style={styles.certInput}
            placeholder="자격증 이름"
            placeholderTextColor="#B0B0B0"
            value={newCertification}
            onChangeText={setNewCertification}
          />
          <TouchableOpacity style={styles.certAddButton} onPress={addCertification}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        {certifications.map((cert, index) => (
          <View key={index} style={styles.certItem}>
            <Ionicons name="ribbon" size={16} color="#4A90D9" />
            <Text style={styles.certItemText}>{cert}</Text>
            <TouchableOpacity onPress={() => removeCertification(index)}>
              <Ionicons name="close-circle" size={18} color="#CCC" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Admin Approval Notice */}
      <View style={styles.approvalNotice}>
        <Ionicons name="information-circle" size={20} color="#4A90D9" />
        <View style={styles.approvalNoticeContent}>
          <Text style={styles.approvalNoticeTitle}>관리자 승인 안내</Text>
          <Text style={styles.approvalNoticeText}>
            회원가입 후 관리자 승인이 완료되어야 활동이 가능합니다.{'\n'}
            신원 인증, 범죄 이력 조회, 자격증 확인 후 승인됩니다.{'\n'}
            승인까지 영업일 기준 1~3일 소요됩니다.
          </Text>
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text style={styles.sectionTitle}>약관 동의 및 추천인</Text>

      <Text style={styles.label}>추천인 코드 (선택)</Text>
      <View style={styles.inputContainer}>
        <Ionicons name="gift-outline" size={20} color="#999" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="추천인 코드가 있다면 입력해주세요"
          placeholderTextColor="#B0B0B0"
          value={referralCode}
          onChangeText={setReferralCode}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.termsSection}>
        <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreeTerms(!agreeTerms)}>
          <Ionicons
            name={agreeTerms ? 'checkbox' : 'square-outline'}
            size={22}
            color={agreeTerms ? '#2ECC71' : '#999'}
          />
          <Text style={styles.checkboxText}>[필수] 서비스 이용약관에 동의합니다</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreePrivacy(!agreePrivacy)}>
          <Ionicons
            name={agreePrivacy ? 'checkbox' : 'square-outline'}
            size={22}
            color={agreePrivacy ? '#2ECC71' : '#999'}
          />
          <Text style={styles.checkboxText}>[필수] 개인정보 처리방침에 동의합니다</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCC" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>간병인 회원가입</Text>
          <View style={styles.placeholder} />
        </View>

        {renderStepIndicator()}

        <View style={styles.stepContent}>
          {currentStep === 0 && renderStep1()}
          {currentStep === 1 && renderStep2()}
          {currentStep === 2 && renderStep3()}
        </View>
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
            style={[styles.submitButton, (!agreeTerms || !agreePrivacy) && styles.submitButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading || !agreeTerms || !agreePrivacy}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>가입하기</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 100 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  placeholder: { width: 40 },
  stepIndicator: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, marginBottom: 16,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#E8E8E8',
    justifyContent: 'center', alignItems: 'center',
  },
  stepCircleActive: { backgroundColor: '#2ECC71' },
  stepCircleCompleted: { backgroundColor: '#27AE60' },
  stepNumber: { fontSize: 12, fontWeight: 'bold', color: '#999' },
  stepNumberActive: { color: '#FFFFFF' },
  stepLabel: { fontSize: 11, color: '#999', marginLeft: 4, marginRight: 4 },
  stepLabelActive: { color: '#2ECC71', fontWeight: '600' },
  stepLine: { width: 24, height: 2, backgroundColor: '#E8E8E8', marginHorizontal: 2 },
  stepLineActive: { backgroundColor: '#27AE60' },
  stepContent: {},
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 4 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA',
    borderRadius: 12, borderWidth: 1, borderColor: '#E8E8E8', marginBottom: 12, paddingHorizontal: 16, height: 48,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: '#333' },
  optionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  optionButton: {
    flex: 1, borderWidth: 2, borderColor: '#E8E8E8', borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  optionButtonSmall: {
    paddingHorizontal: 16, borderWidth: 2, borderColor: '#E8E8E8', borderRadius: 12, paddingVertical: 10,
  },
  optionButtonActive: { borderColor: '#2ECC71', backgroundColor: '#F0FFF4' },
  optionButtonText: { fontSize: 14, color: '#999', fontWeight: '500' },
  optionButtonTextActive: { color: '#2ECC71', fontWeight: 'bold' },
  verificationCard: {
    backgroundColor: '#FAFBFC', borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  verificationHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  verificationTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  verificationDesc: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 14 },
  verificationButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2ECC71', borderRadius: 10, paddingVertical: 12, gap: 6,
  },
  verificationButtonDone: { backgroundColor: '#F0FFF4', borderWidth: 1, borderColor: '#2ECC71' },
  verificationButtonText: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' },
  verificationButtonTextDone: { color: '#2ECC71' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  checkboxText: { flex: 1, fontSize: 13, color: '#555', marginLeft: 10 },
  certInputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  certInput: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E8E8E8',
    paddingHorizontal: 14, height: 44, fontSize: 14, color: '#333',
  },
  certAddButton: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#2ECC71',
    justifyContent: 'center', alignItems: 'center',
  },
  certItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 8, padding: 10, marginBottom: 6,
  },
  certItemText: { flex: 1, fontSize: 14, color: '#333' },
  approvalNotice: {
    flexDirection: 'row', backgroundColor: '#F0F6FF', borderRadius: 12, padding: 16,
    gap: 10, borderWidth: 1, borderColor: '#D6E4F7',
  },
  approvalNoticeContent: { flex: 1 },
  approvalNoticeTitle: { fontSize: 14, fontWeight: 'bold', color: '#4A90D9', marginBottom: 6 },
  approvalNoticeText: { fontSize: 12, color: '#666', lineHeight: 18 },
  termsSection: { marginTop: 16, marginBottom: 24 },
  bottomNav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  prevButton: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 12, borderWidth: 1, borderColor: '#DDD', gap: 6,
  },
  prevButtonText: { fontSize: 14, color: '#666', fontWeight: '600' },
  nextButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2ECC71',
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, gap: 6,
  },
  nextButtonText: { fontSize: 14, color: '#FFFFFF', fontWeight: 'bold' },
  submitButton: { backgroundColor: '#2ECC71', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  submitButtonDisabled: { backgroundColor: '#A8E6CF' },
  submitButtonText: { fontSize: 16, color: '#FFFFFF', fontWeight: 'bold' },
});
