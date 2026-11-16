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
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getConsolidatedItems } from './ActiveCustomerOrderScreen';
import {
  sendWhatsAppBill,
  openWhatsAppDirect,
  getWhatsAppConfig,
  formatBillReceiptText,
} from '../services/whatsapp';

export default function CustomerBillingModal({
  visible,
  onClose,
  table,
  customer,
  onConfirmSettlement,
  onSettlementSuccess,
  onOpenWhatsAppSettings,
}) {
  const [method, setMethod] = useState('Cash'); // 'Cash' | 'Upi' | 'Card'
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [step, setStep] = useState('review'); // 'review' | 'processing' | 'success'
  const [errorMessage, setErrorMessage] = useState('');

  // Customer phone & WhatsApp state
  const [phoneInput, setPhoneInput] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'failed'
  const [whatsappError, setWhatsappError] = useState('');
  const [whatsappDetails, setWhatsappDetails] = useState(null);
  const [lastBillData, setLastBillData] = useState(null);

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
      const initialPhone = customer?.phone ? String(customer.phone).replace(/\D/g, '') : '';
      setPhoneInput(initialPhone);
      setIsEditingPhone(false);
      setWhatsappStatus('idle');
      setWhatsappError('');
      setWhatsappDetails(null);
      setLastBillData(null);
    }
  }, [visible, totalAmount, customer]);

  const numericTendered = parseFloat(tenderedAmount) || 0;
  const changeDue = Math.max(0, numericTendered - totalAmount);

  const quickSuggestions = [
    totalAmount,
    Math.ceil(totalAmount / 10) * 10,
    Math.ceil(totalAmount / 50) * 50 === totalAmount ? totalAmount + 50 : Math.ceil(totalAmount / 50) * 50,
    Math.ceil(totalAmount / 100) * 100 === totalAmount ? totalAmount + 100 : Math.ceil(totalAmount / 100) * 100,
    500,
  ].filter((v, i, arr) => v >= totalAmount && arr.indexOf(v) === i).slice(0, 4);

  // Helper to build current bill data payload
  const buildBillData = (billNo = null, extraOrderId = null) => {
    const rawBillNo =
      billNo ||
      customer?.activeOrders?.[0]?.billNo ||
      customer?.activeOrders?.[0]?.bill_no ||
      customer?.activeOrders?.[0]?.dbOrderId ||
      '';
    const orderId =
      extraOrderId ||
      customer?.activeOrders?.[0]?.dbOrderId ||
      customer?.activeOrders?.[0]?.orderId ||
      customer?.activeOrders?.[0]?.id ||
      '';

    return {
      restaurantName: 'DATA UDIPI',
      tableNumber: table?.table_number || '',
      customerName: customer?.label || 'Guest',
      customerPhone: phoneInput.trim() || customer?.phone || '',
      billNo: rawBillNo,
      orderId: orderId,
      dbOrderId: orderId,
      items: consolidatedItems,
      subtotal: totalAmount,
      totalAmount: totalAmount,
      paymentMethod: method,
      date: new Date(),
    };
  };

  // Perform WhatsApp bill dispatch
  const triggerWhatsAppSend = async (billData, forceDirect = false) => {
    const phone = billData.customerPhone;
    if (!phone || String(phone).trim() === '' || String(phone) === '0000000000') {
      setWhatsappStatus('failed');
      setWhatsappError('No mobile number specified for customer.');
      return;
    }

    setWhatsappStatus('sending');
    setWhatsappError('');

    try {
      if (forceDirect) {
        const text = formatBillReceiptText(billData);
        await openWhatsAppDirect(phone, text);
        setWhatsappStatus('sent');
        setWhatsappDetails({ method: 'whatsapp_app', billText: text });
        return;
      }

      const res = await sendWhatsAppBill(billData);
      if (res.success) {
        setWhatsappStatus('sent');
        setWhatsappDetails(res);
      } else {
        setWhatsappStatus('failed');
        setWhatsappError(res.error || 'Failed to send WhatsApp message.');
        setWhatsappDetails(res);
      }
    } catch (err) {
      setWhatsappStatus('failed');
      setWhatsappError(err.message || 'WhatsApp sending failed');
      setWhatsappDetails({ canFallbackToDirect: true });
    }
  };

  const handleConfirmPress = async () => {
    if (method === 'Cash' && numericTendered < totalAmount) {
      Alert.alert(
        'Insufficient Amount',
        `Amount tendered (₹${numericTendered}) is less than total bill (₹${totalAmount.toFixed(2)}).`
      );
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
        const effectiveOrderId = result.order_id || result.id || customer?.activeOrders?.[0]?.dbOrderId || customer?.activeOrders?.[0]?.orderId || '';
        const billData = buildBillData(result.bill_no, effectiveOrderId);
        setLastBillData(billData);
        setStep('success');

        // Check if auto-send is enabled in config
        const config = await getWhatsAppConfig();
        const effectivePhone = (phoneInput.trim() || customer?.phone || '').replace(/\D/g, '');

        if (config.autoSend && effectivePhone && effectivePhone.length >= 10) {
          triggerWhatsAppSend(billData, false);
        }
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

  const handlePreviewWhatsApp = async () => {
    const effectivePhone = (phoneInput.trim() || customer?.phone || '').replace(/\D/g, '');
    if (!effectivePhone || effectivePhone.length < 10) {
      Alert.alert('Customer Phone Required', 'Please enter a valid 10-digit phone number to send WhatsApp bill.');
      setIsEditingPhone(true);
      return;
    }

    const billData = buildBillData();
    try {
      const text = formatBillReceiptText(billData);
      await openWhatsAppDirect(effectivePhone, text);
    } catch (err) {
      Alert.alert('Error Opening WhatsApp', err.message);
    }
  };

  const handleFinish = () => {
    onClose();
    if (onSettlementSuccess) {
      onSettlementSuccess(customer);
    }
  };

  const effectivePhoneDisplay = (phoneInput.trim() || customer?.phone || '').replace(/\D/g, '');

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
                {customer?.label} · {effectivePhoneDisplay ? `+91 ${effectivePhoneDisplay.slice(-10)}` : 'Guest'}
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
              {/* WhatsApp Delivery Pill Banner */}
              <View style={styles.waBannerBox}>
                <View style={styles.waBannerLeft}>
                  <View style={styles.waIconSmall}>
                    <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.waBannerTitle}>WhatsApp E-Bill Delivery</Text>
                    {isEditingPhone ? (
                      <View style={styles.waPhoneEditRow}>
                        <Text style={styles.waPrefix}>+91</Text>
                        <TextInput
                          style={styles.waPhoneInput}
                          value={phoneInput}
                          onChangeText={setPhoneInput}
                          placeholder="10-digit mobile"
                          placeholderTextColor={COLORS.textMuted}
                          keyboardType="phone-pad"
                          maxLength={10}
                          autoFocus
                        />
                        <TouchableOpacity
                          style={styles.waSavePhoneBtn}
                          onPress={() => setIsEditingPhone(false)}
                        >
                          <Text style={styles.waSavePhoneBtnText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.waBannerSub}>
                        {effectivePhoneDisplay && effectivePhoneDisplay.length >= 10
                          ? `Will be sent to +91 ${effectivePhoneDisplay.slice(-10)}`
                          : 'No phone number — tap edit to add'}
                      </Text>
                    )}
                  </View>
                </View>

                {!isEditingPhone && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.waEditBtn}
                      onPress={() => setIsEditingPhone(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={13} color="#15803D" />
                      <Text style={styles.waEditBtnText}>
                        {effectivePhoneDisplay ? 'Change' : '+ Add'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.waPreviewBtn}
                      onPress={handlePreviewWhatsApp}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="paper-plane-outline" size={13} color="#15803D" />
                      <Text style={styles.waEditBtnText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

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
                    <Text style={styles.receiptItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
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
              <Text style={styles.processingSub}>Updating orders to Paid & preparing WhatsApp bill</Text>
            </View>
          )}

          {/* STEP: SUCCESS */}
          {step === 'success' && (
            <ScrollView contentContainerStyle={styles.successScrollBox} showsVerticalScrollIndicator={false}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={38} color="#FFFFFF" />
              </View>
              <Text style={styles.successTitle}>Bill Settled Successfully!</Text>
              <Text style={styles.successSub}>
                Payment of ₹{totalAmount.toFixed(2)} received via {method.toUpperCase()}.
              </Text>
              <Text style={styles.successTable}>
                {customer?.label} at Table {table?.table_number} is completed.
              </Text>

              {/* WHATSAPP DELIVERY STATUS CARD */}
              <View style={styles.waResultCard}>
                <View style={styles.waResultHeader}>
                  <View style={styles.waResultIconBadge}>
                    <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.waResultTitle}>WhatsApp Bill Status</Text>
                    <Text style={styles.waResultSub}>
                      {effectivePhoneDisplay ? `+91 ${effectivePhoneDisplay.slice(-10)}` : 'No phone specified'}
                    </Text>
                  </View>
                  {whatsappStatus === 'sending' && (
                    <ActivityIndicator size="small" color="#25D366" />
                  )}
                  {whatsappStatus === 'sent' && (
                    <Ionicons name="checkmark-circle" size={22} color="#15803D" />
                  )}
                  {whatsappStatus === 'failed' && (
                    <Ionicons name="alert-circle" size={22} color="#DC2626" />
                  )}
                </View>

                {/* Status Messages */}
                {whatsappStatus === 'sending' && (
                  <Text style={styles.waStatusSendingText}>
                    Sending digital bill to customer via WhatsApp...
                  </Text>
                )}

                {whatsappStatus === 'sent' && (
                  <View style={styles.waSentBox}>
                    <Text style={styles.waSentText}>
                      {whatsappDetails?.documentSent || whatsappDetails?.pdfUrl
                        ? '✅ Tax Invoice PDF & Meta Template dispatched to customer!'
                        : '✅ Digital receipt dispatched via Meta API!'}
                    </Text>
                    {whatsappDetails?.messageId ? (
                      <Text style={styles.waMessageIdText}>Meta ID: {whatsappDetails.messageId}</Text>
                    ) : null}
                    {whatsappDetails?.pdfUrl ? (
                      <TouchableOpacity
                        style={styles.waViewPdfBtn}
                        onPress={() => Linking.openURL(whatsappDetails.pdfUrl)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="document-text-outline" size={14} color="#15803D" style={{ marginRight: 4 }} />
                        <Text style={styles.waViewPdfBtnText}>View / Print PDF Tax Invoice</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {whatsappStatus === 'failed' && (
                  <View style={styles.waFailedBox}>
                    <Text style={styles.waFailedText}>
                      {whatsappDetails?.isTokenExpired
                        ? 'Meta WhatsApp API token expired. Use direct WhatsApp app below.'
                        : whatsappError || 'Could not send automatically via Cloud API.'}
                    </Text>
                  </View>
                )}

                {/* WhatsApp Action Buttons */}
                <View style={styles.waActionsRow}>
                  {/* Direct WhatsApp App Button (1-tap fallback) */}
                  <TouchableOpacity
                    style={styles.waOpenAppBtn}
                    onPress={() => {
                      if (lastBillData) {
                        triggerWhatsAppSend(lastBillData, true);
                      } else {
                        handlePreviewWhatsApp();
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.waOpenAppBtnText}>
                      {whatsappStatus === 'sent' ? 'Open in WhatsApp' : 'Send via WhatsApp App'}
                    </Text>
                  </TouchableOpacity>

                  {/* Retry Cloud API if failed */}
                  {whatsappStatus === 'failed' && lastBillData && (
                    <TouchableOpacity
                      style={styles.waRetryBtn}
                      onPress={() => triggerWhatsAppSend(lastBillData, false)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="refresh" size={14} color="#15803D" style={{ marginRight: 4 }} />
                      <Text style={styles.waRetryBtnText}>Retry API</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Quick Add/Edit phone if missing */}
                {(!effectivePhoneDisplay || effectivePhoneDisplay.length < 10) && (
                  <View style={styles.waAddPhoneBox}>
                    <Text style={styles.waAddPhonePrompt}>Add customer WhatsApp number:</Text>
                    <View style={styles.waAddPhoneRow}>
                      <TextInput
                        style={styles.waInlinePhoneInput}
                        placeholder="10-digit number"
                        placeholderTextColor={COLORS.textMuted}
                        value={phoneInput}
                        onChangeText={setPhoneInput}
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                      <TouchableOpacity
                        style={styles.waInlineSendBtn}
                        onPress={() => {
                          const updatedBill = buildBillData();
                          setLastBillData(updatedBill);
                          triggerWhatsAppSend(updatedBill, false);
                        }}
                      >
                        <Text style={styles.waInlineSendBtnText}>Send Bill</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Complete & Next Button */}
              <TouchableOpacity style={styles.doneBtn} onPress={handleFinish} activeOpacity={0.8}>
                <Text style={styles.doneBtnText}>Complete & Next Table</Text>
              </TouchableOpacity>
            </ScrollView>
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
    maxHeight: '92%',
    minHeight: 480,
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
  waBannerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  waBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  waIconSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  waBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  waBannerSub: {
    fontSize: 11,
    color: '#15803D',
  },
  waPhoneEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  waPrefix: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  waPhoneInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 12,
    width: 110,
    color: COLORS.textDark,
  },
  waSavePhoneBtn: {
    backgroundColor: '#166534',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  waSavePhoneBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  waEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  waPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  waEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
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
  successScrollBox: {
    padding: 20,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  successSub: {
    fontSize: 13,
    color: COLORS.textMedium,
    marginTop: 4,
    textAlign: 'center',
  },
  successTable: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  waResultCard: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  waResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  waResultIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waResultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  waResultSub: {
    fontSize: 11,
    color: '#15803D',
  },
  waStatusSendingText: {
    fontSize: 12,
    color: '#15803D',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  waSentBox: {
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  waSentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  waMessageIdText: {
    fontSize: 10,
    color: '#15803D',
    marginTop: 3,
  },
  waViewPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  waViewPdfBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  waSentHintText: {
    fontSize: 10,
    color: '#166534',
    marginTop: 4,
    lineHeight: 14,
    fontStyle: 'italic',
  },
  waFailedBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  waFailedText: {
    fontSize: 11,
    color: '#991B1B',
    lineHeight: 15,
  },
  waActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  waOpenAppBtn: {
    flex: 1,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  waOpenAppBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  waRetryBtn: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  waRetryBtnText: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 12,
  },
  waAddPhoneBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#BBF7D0',
  },
  waAddPhonePrompt: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 6,
  },
  waAddPhoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  waInlinePhoneInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: COLORS.textDark,
  },
  waInlineSendBtn: {
    backgroundColor: '#166534',
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waInlineSendBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 36,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
