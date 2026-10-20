import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getConsolidatedItems } from './ActiveCustomerOrderScreen';

export default function CustomerBillingModal({
  visible,
  onClose,
  table,
  customer,
  onConfirmSettlement,
  onSettlementSuccess,
}) {
  const [method, setMethod] = useState('Cash'); // 'Cash' | 'Upi' | 'Card'
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [step, setStep] = useState('review'); // 'review' | 'processing' | 'success'
  const [errorMessage, setErrorMessage] = useState('');

  const consolidatedItems = getConsolidatedItems(customer);
  const totalAmount = (customer?.activeOrders || []).reduce(
    (sum, o) => sum + (o.totalAmount || 0),
    0
  );

  useEffect(() => {
    if (visible) {
      setMethod('Cash');
      setTenderedAmount(totalAmount.toFixed(2));
      setStep('review');
      setErrorMessage('');
    }
  }, [visible, totalAmount]);

  const numericTendered = parseFloat(tenderedAmount) || 0;
  const changeDue = Math.max(0, numericTendered - totalAmount);

  const quickSuggestions = [
    totalAmount,
    Math.ceil(totalAmount / 10) * 10,
    Math.ceil(totalAmount / 50) * 50 === totalAmount ? totalAmount + 50 : Math.ceil(totalAmount / 50) * 50,
    Math.ceil(totalAmount / 100) * 100 === totalAmount ? totalAmount + 100 : Math.ceil(totalAmount / 100) * 100,
    500,
  ].filter((v, i, arr) => v >= totalAmount && arr.indexOf(v) === i).slice(0, 4);

  const handleConfirmPress = async () => {
    if (method === 'Cash' && numericTendered < totalAmount) {
      Alert.alert('Insufficient Amount', `Amount tendered (₹${numericTendered}) is less than total bill (₹${totalAmount.toFixed(2)}).`);
      return;
    }

    setStep('processing');
    setErrorMessage('');

    try {
      const result = await onConfirmSettlement({
        customer,
        method,
        amountPaid: totalAmount,
      });

      if (result && result.success) {
        setStep('success');
      } else {
        setErrorMessage(result?.error || 'Failed to settle bill on server');
        setStep('review');
        Alert.alert('Payment Error', result?.error || 'Unable to settle payment on backend. Please retry.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Payment settlement failed');
      setStep('review');
      Alert.alert('Error', err.message || 'Settlement failed');
    }
  };

  const handleFinish = () => {
    onClose();
    if (onSettlementSuccess) {
      onSettlementSuccess(customer);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Final Customer Bill</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Table {table?.table_number}</Text>
                </View>
              </View>
              <Text style={styles.subTitle}>
                {customer?.label} · +91 {customer?.phone || 'Guest'}
              </Text>
            </View>
            {step !== 'processing' && (
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={COLORS.textMedium} />
              </TouchableOpacity>
            )}
          </View>

          {/* STEP: REVIEW & PAYMENT */}
          {step === 'review' && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {/* Itemized bill receipt box */}
              <View style={styles.receiptBox}>
                <View style={styles.receiptTop}>
                  <Text style={styles.receiptBrand}>DATA UDIPI · DINE-IN</Text>
                  <Text style={styles.receiptMeta}>
                    {new Date().toLocaleDateString('en-GB')} · All KOT Orders Combined
                  </Text>
                </View>

                <View style={styles.itemsDivider} />

                {/* Items */}
                {consolidatedItems.map((item, idx) => (
                  <View key={item.id || idx} style={styles.receiptItemRow}>
                    <Text style={styles.receiptItemQty}>{item.quantity}×</Text>
                    <Text style={styles.receiptItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.receiptItemPrice}>₹{item.totalPrice.toFixed(2)}</Text>
                  </View>
                ))}

                <View style={styles.itemsDivider} />

                {/* Totals */}
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptSubtext}>Subtotal</Text>
                  <Text style={styles.receiptSubval}>₹{totalAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptSubtext}>Taxes</Text>
                  <Text style={styles.receiptSubval}>₹0.00</Text>
                </View>
                <View style={[styles.receiptTotalRow, styles.receiptGrandRow]}>
                  <Text style={styles.receiptGrandLabel}>Total Payable</Text>
                  <Text style={styles.receiptGrandVal}>₹{totalAmount.toFixed(2)}</Text>
                </View>
              </View>

              {/* Payment Method Selector */}
              <Text style={styles.sectionHeader}>Select Payment Method</Text>
              <View style={styles.methodTabs}>
                {['Cash', 'Upi', 'Card'].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodTab, method === m && styles.methodTabActive]}
                    onPress={() => setMethod(m)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name={m === 'Cash' ? 'cash' : m === 'Upi' ? 'qrcode-scan' : 'credit-card-outline'}
                      size={18}
                      color={method === m ? '#FFFFFF' : COLORS.textDark}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.methodTabText, method === m && styles.methodTabTextActive]}>
                      {m === 'Upi' ? 'UPI / QR' : m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* CASH INPUT */}
              {method === 'Cash' && (
                <View style={styles.cashBox}>
                  <Text style={styles.inputLabel}>Cash Tendered from Customer</Text>
                  <View style={styles.inputWrap}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="numeric"
                      value={tenderedAmount}
                      onChangeText={setTenderedAmount}
                      selectTextOnFocus
                    />
                  </View>

                  {/* Quick pills */}
                  <View style={styles.pillRow}>
                    {quickSuggestions.map((amt) => (
                      <TouchableOpacity
                        key={amt}
                        style={styles.quickPill}
                        onPress={() => setTenderedAmount(String(amt))}
                      >
                        <Text style={styles.quickPillText}>₹{amt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Change due */}
                  <View style={styles.changeRow}>
                    <Text style={styles.changeLabel}>Change to Return:</Text>
                    <Text style={[styles.changeVal, changeDue > 0 && styles.changeValGreen]}>
                      ₹{changeDue.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              {/* UPI */}
              {method === 'Upi' && (
                <View style={styles.upiBox}>
                  <MaterialCommunityIcons name="qrcode-scan" size={64} color={COLORS.primary} />
                  <Text style={styles.upiTitle}>Show QR code or accept via UPI App</Text>
                  <Text style={styles.upiSub}>Amount: ₹{totalAmount.toFixed(2)}</Text>
                </View>
              )}

              {/* CARD */}
              {method === 'Card' && (
                <View style={styles.cardBox}>
                  <MaterialCommunityIcons name="credit-card-wireless-outline" size={54} color={COLORS.primary} />
                  <Text style={styles.cardTitle}>Swipe or Tap Card on POS EDC Machine</Text>
                  <Text style={styles.cardSub}>Charge ₹{totalAmount.toFixed(2)}</Text>
                </View>
              )}

              {/* Confirm Settle Button */}
              <TouchableOpacity
                style={styles.settleBtn}
                onPress={handleConfirmPress}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.settleBtnText}>
                  Confirm Payment & Close Bill (₹{totalAmount.toFixed(2)})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* STEP: PROCESSING */}
          {step === 'processing' && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.processingTitle}>Settling Bill on Backend...</Text>
              <Text style={styles.processingSub}>Updating orders to Paid & clearing table session</Text>
            </View>
          )}

          {/* STEP: SUCCESS */}
          {step === 'success' && (
            <View style={styles.centerBox}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={38} color="#FFFFFF" />
              </View>
              <Text style={styles.successTitle}>Bill Settled Successfully!</Text>
              <Text style={styles.successSub}>
                Payment of ₹{totalAmount.toFixed(2)} received via {method}.
              </Text>
              <Text style={styles.successTable}>
                {customer?.label} at Table {table?.table_number} is completed.
              </Text>

              <TouchableOpacity style={styles.doneBtn} onPress={handleFinish} activeOpacity={0.8}>
                <Text style={styles.doneBtnText}>Complete & Next</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: 450,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  badge: {
    backgroundColor: COLORS.chipActive,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subTitle: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 16,
  },
  receiptBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  receiptTop: {
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptBrand: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.textDark,
  },
  receiptMeta: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  itemsDivider: {
    height: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 8,
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  receiptItemQty: {
    width: 30,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  receiptItemName: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textDark,
  },
  receiptItemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  receiptSubtext: {
    fontSize: 12,
    color: COLORS.textMedium,
  },
  receiptSubval: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  receiptGrandRow: {
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
  },
  receiptGrandLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  receiptGrandVal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#059669',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  methodTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chipBg,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  methodTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  methodTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  methodTabTextActive: {
    color: '#FFFFFF',
  },
  cashBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMedium,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    height: 42,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  quickPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  quickPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  changeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  changeVal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  changeValGreen: {
    color: '#059669',
  },
  upiBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  upiTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
    marginTop: 10,
  },
  upiSub: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginTop: 4,
  },
  cardBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
    marginTop: 10,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginTop: 4,
  },
  settleBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  settleBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
    marginTop: 16,
  },
  processingSub: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginTop: 4,
    textAlign: 'center',
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  successSub: {
    fontSize: 13,
    color: COLORS.textMedium,
    marginTop: 6,
    textAlign: 'center',
  },
  successTable: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 24,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
