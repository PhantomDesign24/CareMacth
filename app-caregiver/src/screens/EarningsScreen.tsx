import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { caregiverApi } from '../services/api';

interface EarningItem {
  id: string;
  amount: number;
  platformFee: number;
  taxAmount: number;
  netAmount: number;
  isPaid: boolean;
  paidAt?: string;
  contractId?: string;
  createdAt: string;
}

interface EarningsSummary {
  totalAmount: number;
  totalPlatformFee: number;
  totalTax: number;
  totalNetAmount: number;
  unpaidAmount: number;
}

export default function EarningsScreen() {
  const [earnings, setEarnings] = useState<EarningItem[]>([]);
  const [summary, setSummary] = useState<EarningsSummary>({
    totalAmount: 0,
    totalPlatformFee: 0,
    totalTax: 0,
    totalNetAmount: 0,
    unpaidAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchEarnings = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response: any = await caregiverApi.getEarnings();
      const data = response?.data || response;
      setEarnings(data?.earnings || []);
      if (data?.summary) {
        setSummary({
          totalAmount: data.summary.totalAmount || 0,
          totalPlatformFee: data.summary.totalPlatformFee || 0,
          totalTax: data.summary.totalTax || 0,
          totalNetAmount: data.summary.totalNetAmount || 0,
          unpaidAmount: data.summary.unpaidAmount || 0,
        });
      }
    } catch {
      setFetchError('수익 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const totalGross = summary.totalAmount;
  const totalFees = summary.totalPlatformFee;
  const totalTax = summary.totalTax;
  const totalNet = summary.totalNetAmount;

  const renderEarning = ({ item }: { item: EarningItem }) => (
    <View style={styles.earningCard}>
      <View style={styles.earningHeader}>
        <View>
          <Text style={styles.earningPatient}>정산 #{item.id.slice(0, 8)}</Text>
          <Text style={styles.earningPeriod}>
            {new Date(item.createdAt).toLocaleDateString('ko-KR')}
          </Text>
        </View>
        <View
          style={[
            styles.statusTag,
            { backgroundColor: item.isPaid ? '#E8F5E9' : '#FFF8E1' },
          ]}
        >
          <Text
            style={[
              styles.statusTagText,
              { color: item.isPaid ? '#2ECC71' : '#F5A623' },
            ]}
          >
            {item.isPaid ? '지급완료' : '정산 대기'}
          </Text>
        </View>
      </View>

      <View style={styles.earningDetails}>
        <View style={styles.earningRow}>
          <Text style={styles.earningLabel}>간병비</Text>
          <Text style={styles.earningAmount}>{item.amount.toLocaleString()}원</Text>
        </View>
        <View style={styles.earningRow}>
          <Text style={styles.deductLabel}>플랫폼 수수료</Text>
          <Text style={styles.deductAmount}>-{item.platformFee.toLocaleString()}원</Text>
        </View>
        <View style={styles.earningRow}>
          <Text style={styles.deductLabel}>세금 (3.3%)</Text>
          <Text style={styles.deductAmount}>-{item.taxAmount.toLocaleString()}원</Text>
        </View>
        <View style={styles.earningDivider} />
        <View style={styles.earningRow}>
          <Text style={styles.netLabel}>실수령액</Text>
          <Text style={styles.netAmount}>{item.netAmount.toLocaleString()}원</Text>
        </View>
      </View>

      {item.isPaid && item.paidAt && (
        <View style={styles.paidInfo}>
          <Ionicons name="checkmark-circle-outline" size={14} color="#2ECC71" />
          <Text style={styles.paidInfoText}>
            {new Date(item.paidAt).toLocaleDateString('ko-KR')} 지급 완료
          </Text>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2ECC71" />
        <Text style={styles.loadingText}>수익 정보를 불러오는 중...</Text>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#E74C3C" />
        <Text style={styles.errorTitle}>{fetchError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchEarnings}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summarySection}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>총 간병비</Text>
            <Text style={styles.summaryValue}>{totalGross.toLocaleString()}원</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>수수료</Text>
            <Text style={[styles.summaryValue, { color: '#E74C3C' }]}>
              -{totalFees.toLocaleString()}원
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>세금</Text>
            <Text style={[styles.summaryValue, { color: '#E74C3C' }]}>
              -{totalTax.toLocaleString()}원
            </Text>
          </View>
        </View>

        <View style={styles.netSummaryCard}>
          <View style={styles.netSummaryLeft}>
            <Ionicons name="wallet-outline" size={24} color="#2ECC71" />
            <View>
              <Text style={styles.netSummaryLabel}>실수령 총액</Text>
              <Text style={styles.netSummaryValue}>{totalNet.toLocaleString()}원</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Earnings List */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>정산 내역</Text>
        <Text style={styles.listCount}>{earnings.length}건</Text>
      </View>

      <FlatList
        data={earnings}
        renderItem={renderEarning}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cash-outline" size={64} color="#DDD" />
            <Text style={styles.emptyTitle}>정산 내역이 없습니다</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  summarySection: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  summaryGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryCard: {
    flex: 1, backgroundColor: '#F8F9FA', borderRadius: 12, padding: 12,
  },
  summaryLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  summaryValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  netSummaryCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F0FFF4', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#D4EDDA',
  },
  netSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  netSummaryLabel: { fontSize: 13, color: '#888' },
  netSummaryValue: { fontSize: 22, fontWeight: 'bold', color: '#2ECC71' },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  listCount: { fontSize: 13, color: '#888' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  earningCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  earningHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16,
  },
  earningPatient: { fontSize: 15, fontWeight: '600', color: '#333' },
  earningPeriod: { fontSize: 12, color: '#888', marginTop: 4 },
  statusTag: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusTagText: { fontSize: 11, fontWeight: '600' },
  earningDetails: {},
  earningRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  earningLabel: { fontSize: 14, color: '#333' },
  earningAmount: { fontSize: 14, color: '#333', fontWeight: '500' },
  deductLabel: { fontSize: 13, color: '#999' },
  deductAmount: { fontSize: 13, color: '#E74C3C' },
  earningDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 },
  netLabel: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  netAmount: { fontSize: 16, fontWeight: 'bold', color: '#2ECC71' },
  paidInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5',
  },
  paidInfoText: { fontSize: 12, color: '#2ECC71' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 16 },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8',
  },
  loadingText: { fontSize: 13, color: '#BBB', marginTop: 12 },
  errorTitle: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 16 },
  retryButton: {
    marginTop: 16, backgroundColor: '#2ECC71', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
