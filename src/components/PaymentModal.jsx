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

export default function PaymentModal({
  visible,
  onClose,
  totalAmount,
  customerPhone,
  onConfirmPayment,
  onPaymentSuccess,
  isBackendConnected = false,
}) {
  const [method, setMethod] = useState('Cash'); // 'Cash' | 'Upi' | 'Card' | 'Split'
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [step, setStep] = useState('input'); // 'input' | 'processing' | 'success'
  const [orderReceiptId, setOrderReceiptId] = useState('');
  const [backendOrderId, setBackendOrderId] = useState('');
  const [processingStatus, setProcessingStatus] = useState('Processing payment...');

  useEffect(() => {
    if (visible) {
      setMethod('Cash');
      setTenderedAmount(totalAmount.toFixed(2));
      setStep('input');
      const randomToken = Math.floor(1000 + Math.random() * 9000);
      setOrderReceiptId(`POS-4402-${randomToken}`);
      setBackendOrderId('');
      setProcessingStatus('Processing payment...');
    }
  }, [visible, totalAmount]);

  const numericTendered = parseFloat(tenderedAmount) || 0;
  const changeDue = Math.max(0, numericTendered - totalAmount);

  // Quick denomination suggestions
  const quickSuggestions = [
    totalAmount,
    Math.ceil(totalAmount / 5) * 5 === totalAmount ? totalAmount + 5 : Math.ceil(totalAmount / 5) * 5,
    Math.ceil(totalAmount / 10) * 10 === totalAmount ? totalAmount + 10 : Math.ceil(totalAmount / 10) * 10,
    50.00 > totalAmount ? 50.00 : 100.00,
  ].filter((val, index, self) => self.indexOf(val) === index && val >= totalAmount);

  const handleConfirmPayment = async () => {
    if (method === 'Cash' && numericTendered < totalAmount) {
      Alert.alert('Insufficient Cash', 'Amount tendered cannot be less than total amount due.');
      return;
    }

    setStep('processing');
    setProcessingStatus('Sending order to kitchen backend...');

    try {
      if (onConfirmPayment) {
        const result = await onConfirmPayment({
          method,
          tenderedAmount: numericTendered,
          changeDue,
          totalAmount,
          customerPhone,
        });

        if (result && result.orderId) {
          setBackendOrderId(result.orderId);
          setOrderReceiptId(result.orderId);
        }
      }
      setStep('success');
    } catch (err) {
      console.warn('Backend order placement error, falling back to local receipt:', err);
      setStep('success');
    }
  };

  const handleFinishNewOrder = () => {
    setStep('input');
    onPaymentSuccess({
      receiptId: backendOrderId || orderReceiptId,
      method,
      amount: totalAmount,
      customerPhone,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={step === 'processing' ? () => {} : onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Header */}
          {step !== 'processing' && (
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Payment</Text>
              <TouchableOpacity 
                onPress={onClose} 
                style={styles.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={20} color={COLORS.textMedium} />
              </TouchableOpacity>
            </View>
          )}

          {step === 'processing' && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.processingTitle}>Processing payment...</Text>
              <Text style={styles.processingAmount}>R.S.{totalAmount.toFixed(2)}</Text>
              <Text style={styles.processingWait}>Please wait</Text>
            </View>
          )}

          {step === 'success' && (
            <View style={styles.successContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={36} color="#FFFFFF" />
              </View>

              <Text style={styles.successTitle}>Payment Successful!</Text>
              <Text style={styles.successAmount}>R.S.{totalAmount.toFixed(2)}</Text>

              <View style={styles.receiptCard}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Receipt Token</Text>
                  <Text style={styles.receiptValue}>{orderReceiptId}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Payment Method</Text>
                  <Text style={styles.receiptValue}>{method.toUpperCase()}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Customer Phone</Text>
                  <Text style={styles.receiptValue}>+91 {customerPhone}</Text>
                </View>
                {method === 'Cash' && changeDue > 0 && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Change Returned</Text>
                    <Text style={[styles.receiptValue, { color: COLORS.accentGreen }]}>
                      R.S.{changeDue.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.smsNotice}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.accentGreen} />
                <Text style={styles.smsNoticeText}>
                  Digital e-receipt & KOT token sent to +91 {customerPhone}
                </Text>
              </View>

              <View style={styles.successActionButtons}>
                <TouchableOpacity
                  style={styles.printButton}
                  onPress={() => Alert.alert('Printing', `Printing thermal receipt for token ${orderReceiptId}`)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="print-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.printButtonText}>Print Bill</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.newOrderButton}
                  onPress={handleFinishNewOrder}
                  activeOpacity={0.8}
                >
                  <Text style={styles.newOrderButtonText}>New Order</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'input' && (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.contentScroll}
            >
              {/* Customer Phone Header Pill */}
              <View style={styles.phoneNoticePill}>
                <Ionicons name="person-circle-outline" size={16} color={COLORS.textMedium} />
                <Text style={styles.phoneNoticeText}>
                  Billed to: <Text style={{ fontWeight: '700' }}>+91 {customerPhone}</Text>
                </Text>
              </View>

              {/* Amount Due Card */}
              <View style={styles.amountCard}>
                <Text style={styles.amountLabel}>AMOUNT DUE</Text>
                <Text style={styles.amountValue}>R.S.{totalAmount.toFixed(2)}</Text>
              </View>

              {/* Payment Methods */}
              <View style={styles.methodsRow}>
                {['Cash', 'Upi', 'Card'].map((m) => {
                  const isSelected = method === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.methodBtn, isSelected && styles.methodBtnActive]}
                      onPress={() => setMethod(m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.methodBtnText, isSelected && styles.methodBtnTextActive]}>
                        {m === 'Upi' ? 'UPI' : m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Cash specific controls */}
              {method === 'Cash' && (
                <View style={styles.cashSection}>
                  <Text style={styles.fieldLabel}>AMOUNT TENDERED</Text>
                  <View style={styles.tenderInputBox}>
                    <Text style={styles.currencyPrefix}>R.S.</Text>
                    <TextInput
                      style={styles.tenderInput}
                      keyboardType="decimal-pad"
                      value={tenderedAmount}
                      onChangeText={setTenderedAmount}
                      selectTextOnFocus
                    />
                  </View>

                  {/* Quick Chips */}
                  <View style={styles.chipsRow}>
                    {quickSuggestions.map((val) => (
                      <TouchableOpacity
                        key={val}
                        style={styles.chip}
                        onPress={() => setTenderedAmount(val.toFixed(2))}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.chipText}>R.S.{val.toFixed(2)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Change display */}
                  <View style={styles.changeRow}>
                    <Text style={styles.changeLabel}>Change</Text>
                    <Text style={[styles.changeValue, changeDue > 0 && styles.changeValuePositive]}>
                      R.S.{changeDue.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              {/* UPI specific controls */}
              {method === 'Upi' && (
                <View style={styles.upiSection}>
                  <View style={styles.qrMockBox}>
                    <MaterialCommunityIcons name="qrcode-scan" size={80} color={COLORS.primary} />
                    <Text style={styles.qrTitle}>Scan to pay R.S.{totalAmount.toFixed(2)}</Text>
                    <Text style={styles.qrSub}>UPI ID: cashier.udipi@icici</Text>
                  </View>
                  <View style={styles.upiLogos}>
                    <Text style={styles.upiAppName}>GPay</Text>
                    <Text style={styles.upiAppName}>PhonePe</Text>
                    <Text style={styles.upiAppName}>Paytm</Text>
                    <Text style={styles.upiAppName}>BHIM</Text>
                  </View>
                </View>
              )}

              {/* Card specific controls */}
              {method === 'Card' && (
                <View style={styles.cardSection}>
                  <MaterialCommunityIcons name="credit-card-wireless-outline" size={56} color={COLORS.primary} />
                  <Text style={styles.cardPromptTitle}>Ready on POS Terminal 01</Text>
                  <Text style={styles.cardPromptSub}>
                    Ask customer to tap or insert card for R.S.{totalAmount.toFixed(2)}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleConfirmPayment}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  closeBtn: {
    padding: 4,
  },
  contentScroll: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  phoneNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
  },
  phoneNoticeText: {
    fontSize: 12,
    color: COLORS.textMedium,
  },
  amountCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.textDark,
    letterSpacing: -0.5,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBg,
  },
  methodBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  methodBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  methodBtnTextActive: {
    color: '#FFFFFF',
  },
  cashSection: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tenderInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 52,
    backgroundColor: COLORS.cardBg,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    marginRight: 6,
  },
  tenderInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.chipBg,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  changeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  changeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  changeValuePositive: {
    color: COLORS.accentGreen,
    fontSize: 16,
  },
  upiSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  qrMockBox: {
    alignItems: 'center',
    padding: 18,
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
  },
  qrTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
    marginTop: 8,
  },
  qrSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  upiLogos: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 14,
  },
  upiAppName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMedium,
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cardSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  cardPromptTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
    marginTop: 10,
  },
  cardPromptSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  processingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textDark,
    marginTop: 20,
  },
  processingAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textDark,
    marginTop: 6,
  },
  processingWait: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  successContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  successAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textDark,
    marginTop: 4,
    marginBottom: 16,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: COLORS.chipBg,
    borderRadius: 10,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontSize: 12,
    color: COLORS.textMedium,
  },
  receiptValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  smsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  smsNoticeText: {
    fontSize: 11,
    color: COLORS.textMedium,
    fontWeight: '500',
  },
  successActionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  printButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.cardBg,
  },
  printButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  newOrderButton: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newOrderButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
