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
import { patientApi } from '../services/api';

interface RegisterScreenProps {
  navigation: any;
}

type CareType = 'individual' | 'family';

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [careType, setCareType] = useState<CareType>('individual');
  const [referralCode, setReferralCode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('알림', '이름을 입력해주세요.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('알림', '이메일을 입력해주세요.');
      return;
    }
    if (!password.trim() || password.length < 8) {
      Alert.alert('알림', '비밀번호는 8자 이상 입력해주세요.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('알림', '비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('알림', '휴대폰 번호를 입력해주세요.');
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      Alert.alert('알림', '필수 약관에 동의해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await patientApi.register({
        name,
        email,
        password,
        phone,
        careType,
        referralCode: referralCode.trim() || undefined,
      });
      Alert.alert('회원가입 완료', '회원가입이 완료되었습니다. 로그인해주세요.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      const message = error.response?.data?.message || '회원가입에 실패했습니다.';
      Alert.alert('회원가입 실패', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>보호자 회원가입</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          {/* Name */}
          <Text style={styles.label}>이름 *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="이름을 입력해주세요"
              placeholderTextColor="#B0B0B0"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Email */}
          <Text style={styles.label}>이메일 *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="이메일을 입력해주세요"
              placeholderTextColor="#B0B0B0"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>비밀번호 * (8자 이상)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="비밀번호를 입력해주세요"
              placeholderTextColor="#B0B0B0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Confirm Password */}
          <Text style={styles.label}>비밀번호 확인 *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="비밀번호를 다시 입력해주세요"
              placeholderTextColor="#B0B0B0"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Phone */}
          <Text style={styles.label}>휴대폰 번호 *</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="010-0000-0000"
              placeholderTextColor="#B0B0B0"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* Care Type */}
          <Text style={styles.label}>간병 유형 선택 *</Text>
          <View style={styles.careTypeContainer}>
            <TouchableOpacity
              style={[
                styles.careTypeButton,
                careType === 'individual' && styles.careTypeActive,
              ]}
              onPress={() => setCareType('individual')}
            >
              <Ionicons
                name="person"
                size={24}
                color={careType === 'individual' ? '#4A90D9' : '#999'}
              />
              <Text
                style={[
                  styles.careTypeText,
                  careType === 'individual' && styles.careTypeTextActive,
                ]}
              >
                개인 간병
              </Text>
              <Text style={styles.careTypeDesc}>환자 1인 전담 간병</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.careTypeButton,
                careType === 'family' && styles.careTypeActive,
              ]}
              onPress={() => setCareType('family')}
            >
              <Ionicons
                name="people"
                size={24}
                color={careType === 'family' ? '#4A90D9' : '#999'}
              />
              <Text
                style={[
                  styles.careTypeText,
                  careType === 'family' && styles.careTypeTextActive,
                ]}
              >
                가족 간병
              </Text>
              <Text style={styles.careTypeDesc}>가정 내 간병 서비스</Text>
            </TouchableOpacity>
          </View>

          {/* Referral Code */}
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

          {/* Terms */}
          <View style={styles.termsSection}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgreeTerms(!agreeTerms)}
            >
              <Ionicons
                name={agreeTerms ? 'checkbox' : 'square-outline'}
                size={22}
                color={agreeTerms ? '#4A90D9' : '#999'}
              />
              <Text style={styles.checkboxText}>
                [필수] 서비스 이용약관에 동의합니다
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#CCC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgreePrivacy(!agreePrivacy)}
            >
              <Ionicons
                name={agreePrivacy ? 'checkbox' : 'square-outline'}
                size={22}
                color={agreePrivacy ? '#4A90D9' : '#999'}
              />
              <Text style={styles.checkboxText}>
                [필수] 개인정보 처리방침에 동의합니다
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#CCC" />
            </TouchableOpacity>
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerButton, (!agreeTerms || !agreePrivacy) && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading || !agreeTerms || !agreePrivacy}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.registerButtonText}>회원가입</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  formSection: {},
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  careTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  careTypeButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  careTypeActive: {
    borderColor: '#4A90D9',
    backgroundColor: '#F0F6FF',
  },
  careTypeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 8,
  },
  careTypeTextActive: {
    color: '#4A90D9',
  },
  careTypeDesc: {
    fontSize: 11,
    color: '#B0B0B0',
    marginTop: 4,
  },
  termsSection: {
    marginTop: 16,
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    color: '#555',
    marginLeft: 10,
  },
  registerButton: {
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
  registerButtonDisabled: {
    backgroundColor: '#B0C8E8',
    shadowOpacity: 0,
    elevation: 0,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
