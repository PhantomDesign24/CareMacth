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

type PaymentMethod = 'bank_transfer' | 'card' | 'direct';

export default function PaymentScreen({ route, navigation }: any) {
  const { requestId, amount } = route.params || {
    requestId: 'demo',
    amount: 1500000,
  };

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [usePoints, setUsePoints] = useState(false);
  const [pointAmount, setPointAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const availablePoints = 15000;
  const vatRate = 0.1;
  const serviceAmount = amount;
  const vatAmount = Math.round(serviceAmount * vatRate);
  const totalBeforePoints = serviceAmount + vatAmount;
  const pointsToUse = usePoints ? Math.min(parseInt(pointAmount || '0'), availablePoints, totalBeforePoints) : 0;
  const finalAmount = totalBeforePoints - pointsToUse;

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      await patientApi.createPayment({
        requestId,
        method: paymentMethod,
        amount: finalAmount,
        pointsUsed: pointsToUse,
      });

      if (paymentMethod === 'bank_transfer') {
        Alert.alert(
          '입금 안내',
          '아래 계좌로 입금해주세요.\n\n은행: 신한은행\n계좌번호: 110-123-456789\n예금주: (주)케어매치\n금액: ' +
            finalAmount.toLocaleString() +
            '원\n\n입금 확인 후 간병이 시작됩니다.',
          [{ text: '확인', onPress: () => navigation.navigate('Main') }]
        );
      } else if (paymentMethod === 'card') {
        Alert.alert('결제 완료', '카드 결제가 완료되었습니다.', [
          { text: '확인', onPress: () => navigation.navigate('Main') },
        ]);
      } else {
        Alert.alert(
          '직접결제 안내',
          '간병인과 직접 결제를 진행해주세요.\n\n* 직접결제 시 플랫폼의 에스크로 보호를 받을 수 없습니다.',
          [{ text: '확인', onPress: () => navigation.navigate('Main') }]
        );
      }
    } catch (error: any) {
      Alert.alert('결제 실패', '결제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        {/* Payment Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>결제 금액</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>간병 서비스 비용</Text>
            <Text style={styles.summaryValue}>{serviceAmount.toLocaleString()}원</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>부가세 (VAT 10%)</Text>
            <Text style={styles.summaryVat}>{vatAmount.toLocaleString()}원</Text>
          </View>
          <View style={styles.vatNotice}>
            <Ionicons name="information-circle-outline" size={14} color="#888" />
            <Text style={styles.vatNoticeText}>VAT 별도</Text>
          </View>
          {pointsToUse > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>포인트 할인</Text>
              <Text style={styles.pointsDiscount}>-{pointsToUse.toLocaleString()}원</Text>
            </View>
          )}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>총 결제 금액</Text>
            <Text style={styles.totalValue}>{finalAmount.toLocaleString()}원</Text>
          </View>
        </View>

        {/* Points Usage */}
        <View style={styles.pointsSection}>
          <View style={styles.pointsHeader}>
            <Text style={styles.sectionTitle}>포인트 사용</Text>
            <Text style={styles.availablePoints}>
              보유: {availablePoints.toLocaleString()}P
            </Text>
          </View>
          <TouchableOpacity
            style={styles.pointsToggle}
            onPress={() => {
              setUsePoints(!usePoints);
              if (!usePoints) {
                setPointAmount(availablePoints.toString());
              }
            }}
          >
            <Ionicons
              name={usePoints ? 'checkbox' : 'square-outline'}
              size={22}
              color={usePoints ? '#4A90D9' : '#CCC'}
            />
            <Text style={styles.pointsToggleText}>포인트 사용하기</Text>
          </TouchableOpacity>
          {usePoints && (
            <View style={styles.pointsInputContainer}>
              <TextInput
                style={styles.pointsInput}
                placeholder="사용할 포인트"
                placeholderTextColor="#B0B0B0"
                value={pointAmount}
                onChangeText={setPointAmount}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.pointsMaxButton}
                onPress={() => setPointAmount(availablePoints.toString())}
              >
                <Text style={styles.pointsMaxButtonText}>전액 사용</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Payment Method */}
        <View style={styles.methodSection}>
          <Text style={styles.sectionTitle}>결제 방식 선택</Text>

          <TouchableOpacity
            style={[
              styles.methodButton,
              paymentMethod === 'bank_transfer' && styles.methodButtonActive,
            ]}
            onPress={() => setPaymentMethod('bank_transfer')}
          >
            <Ionicons
              name="business-outline"
              size={24}
              color={paymentMethod === 'bank_transfer' ? '#4A90D9' : '#999'}
            />
            <View style={styles.methodInfo}>
              <Text
                style={[
                  styles.methodLabel,
                  paymentMethod === 'bank_transfer' && styles.methodLabelActive,
                ]}
              >
                무통장 입금
              </Text>
              <Text style={styles.methodDesc}>계좌 이체로 결제합니다</Text>
            </View>
            <Ionicons
              name={paymentMethod === 'bank_transfer' ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={paymentMethod === 'bank_transfer' ? '#4A90D9' : '#CCC'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodButton,
              paymentMethod === 'card' && styles.methodButtonActive,
            ]}
            onPress={() => setPaymentMethod('card')}
          >
            <Ionicons
              name="card-outline"
              size={24}
              color={paymentMethod === 'card' ? '#4A90D9' : '#999'}
            />
            <View style={styles.methodInfo}>
              <Text
                style={[
                  styles.methodLabel,
                  paymentMethod === 'card' && styles.methodLabelActive,
                ]}
              >
                카드 결제
              </Text>
              <Text style={styles.methodDesc}>신용카드/체크카드 결제</Text>
            </View>
            <Ionicons
              name={paymentMethod === 'card' ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={paymentMethod === 'card' ? '#4A90D9' : '#CCC'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodButton,
              paymentMethod === 'direct' && styles.methodButtonActive,
            ]}
            onPress={() => setPaymentMethod('direct')}
          >
            <Ionicons
              name="cash-outline"
              size={24}
              color={paymentMethod === 'direct' ? '#4A90D9' : '#999'}
            />
            <View style={styles.methodInfo}>
              <Text
                style={[
                  styles.methodLabel,
                  paymentMethod === 'direct' && styles.methodLabelActive,
                ]}
              >
                직접 결제
              </Text>
              <Text style={styles.methodDesc}>간병인에게 직접 결제</Text>
            </View>
            <Ionicons
              name={paymentMethod === 'direct' ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={paymentMethod === 'direct' ? '#4A90D9' : '#CCC'}
            />
          </TouchableOpacity>
        </View>

        {/* Escrow Notice */}
        {paymentMethod !== 'direct' && (
          <View style={styles.escrowNotice}>
            <Ionicons name="shield-checkmark" size={20} color="#2ECC71" />
            <View style={styles.escrowContent}>
              <Text style={styles.escrowTitle}>에스크로 결제 안내</Text>
              <Text style={styles.escrowText}>
                결제 금액은 에스크로 계좌에 안전하게 보관되며,{'\n'}
                간병 서비스가 정상적으로 완료된 후 간병인에게{'\n'}
                지급됩니다. 서비스에 문제가 있는 경우 환불이{'\n'}
                가능합니다.
              </Text>
            </View>
          </View>
        )}

        {paymentMethod === 'direct' && (
          <View style={styles.directWarning}>
            <Ionicons name="alert-circle" size={20} color="#F5A623" />
            <View style={styles.escrowContent}>
              <Text style={styles.directWarningTitle}>직접 결제 주의사항</Text>
              <Text style={styles.directWarningText}>
                직접 결제 시 플랫폼의 에스크로 보호를 받을 수{'\n'}
                없습니다. 서비스 분쟁 발생 시 해결이 어려울 수{'\n'}
                있으니 유의해주세요.
              </Text>
            </View>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.payButton}
          onPress={handlePayment}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.payButtonText}>
              {finalAmount.toLocaleString()}원 결제하기
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
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
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  summaryVat: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  vatNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  vatNoticeText: {
    fontSize: 12,
    color: '#888',
  },
  pointsDiscount: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4A90D9',
  },
  pointsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  availablePoints: {
    fontSize: 13,
    color: '#F5A623',
    fontWeight: '600',
  },
  pointsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pointsToggleText: {
    fontSize: 14,
    color: '#555',
  },
  pointsInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  pointsInput: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    color: '#333',
  },
  pointsMaxButton: {
    backgroundColor: '#F0F6FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    justifyContent: 'center',
  },
  pointsMaxButtonText: {
    fontSize: 13,
    color: '#4A90D9',
    fontWeight: '600',
  },
  methodSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F0F0F0',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    gap: 12,
  },
  methodButtonActive: {
    borderColor: '#4A90D9',
    backgroundColor: '#FAFCFF',
  },
  methodInfo: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
  },
  methodLabelActive: {
    color: '#4A90D9',
  },
  methodDesc: {
    fontSize: 12,
    color: '#BBB',
    marginTop: 2,
  },
  escrowNotice: {
    flexDirection: 'row',
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D4EDDA',
  },
  escrowContent: {
    flex: 1,
  },
  escrowTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2ECC71',
    marginBottom: 6,
  },
  escrowText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  directWarning: {
    flexDirection: 'row',
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  directWarningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F5A623',
    marginBottom: 6,
  },
  directWarningText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  payButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
