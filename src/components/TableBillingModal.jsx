import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import {
  sendWhatsAppBill,
  openWhatsAppDirect,
  getWhatsAppConfig,
  formatBillReceiptText,
} from '../services/whatsapp';

/**
 * TableBillingModal
 *
 * Shows a consolidated bill across all customers at a table.
 * Automatically sends WhatsApp e-bills to all customers upon settlement.
 */
export default function TableBillingModal({
  visible,
  onClose,
  table,
  customers = [],
  onConfirmTablePayment,
  onPaymentSuccess,
}) {
  const [globalMethod, setGlobalMethod] = useState('Cash');
  const [step, setStep] = useState('review'); // 'review' | 'processing' | 'success'
  const [results, setResults] = useState([]); // [{ phone, orderId, success, error, waStatus, waError, billData }]

  // Reset when modal opens
  React.useEffect(() => {
    if (visible) {
      setGlobalMethod('Cash');
      setStep('review');
      setResults([]);
    }
  }, [visible]);

  const getCustomerTotal = (customer) => {
    const unplacedSub = Object.values(customer.cartItems || {}).reduce(
      (s, item) => s + item.price * item.quantity,
      0
    );
    const activeOrdersTotal = (customer.activeOrders || []).reduce(
      (s, o) => s + (o.totalAmount || 0),
      0
    );
    return unplacedSub + activeOrdersTotal;
  };

  const tableTotal = customers.reduce((s, c) => s + getCustomerTotal(c), 0);

  const customersWithItems = customers.filter(
    (c) =>
      Object.keys(c.cartItems || {}).length > 0 ||
      ((c.activeOrders || []).length > 0)
  );

  const handleConfirm = async () => {
    if (customersWithItems.length === 0) {
      Alert.alert('No Items', 'There are no items to bill at this table.');
      return;
    }

    setStep('processing');
    try {
      const res = await onConfirmTablePayment({
        customers: customersWithItems,
        globalMethod,
      });

      const config = await getWhatsAppConfig();

      // Dispatch WhatsApp bills for all settled customers
      const enhancedResults = await Promise.all(
        (res || []).map(async (r) => {
          const customer = customersWithItems.find((c) => c.phone === r.phone);
          if (!customer || !r.success) {
            return { ...r, waStatus: 'skipped' };
          }

          const items = [
            ...Object.values(customer.cartItems || {}),
            ...(customer.activeOrders || []).flatMap((o) =>
              Array.isArray(o.items) ? o.items : Object.values(o.items || {})
            ),
          ];
          const custTotal = getCustomerTotal(customer);
          const billData = {
            restaurantName: 'DATA UDIPI',
            tableNumber: table?.table_number,
            customerName: customer.label || 'Guest',
            customerPhone: customer.phone,
            billNo: r.orderId,
            items,
            subtotal: custTotal,
            totalAmount: custTotal,
            paymentMethod: globalMethod,
            date: new Date(),
          };

          const cleanPhone = String(customer.phone).replace(/\D/g, '');
          if (config.autoSend && cleanPhone.length >= 10) {
            try {
              const waRes = await sendWhatsAppBill(billData);
              return {
                ...r,
                billData,
                waStatus: waRes.success ? 'sent' : 'failed',
                waError: waRes.error,
                isTokenExpired: waRes.isTokenExpired,
              };
            } catch (waErr) {
              return {
                ...r,
                billData,
                waStatus: 'failed',
                waError: waErr.message,
              };
            }
          }

          return { ...r, billData, waStatus: 'idle' };
        })
      );

      setResults(enhancedResults);
      setStep('success');
    } catch (err) {
      console.warn('[TableBillingModal] Payment error:', err);
      setStep('success');
    }
  };

  const handleDirectWhatsAppSend = async (row) => {
    if (!row.billData && !row.phone) return;
    try {
      const customer = customersWithItems.find((c) => c.phone === row.phone);
      const items = customer
        ? [
            ...Object.values(customer.cartItems || {}),
            ...(customer.activeOrders || []).flatMap((o) =>
              Array.isArray(o.items) ? o.items : Object.values(o.items || {})
            ),
          ]
        : [];
      const custTotal = customer ? getCustomerTotal(customer) : 0;
      const billData = row.billData || {
        restaurantName: 'DATA UDIPI',
        tableNumber: table?.table_number,
        customerName: customer?.label || 'Guest',
        customerPhone: row.phone,
        billNo: row.orderId,
        items,
        totalAmount: custTotal,
        paymentMethod: globalMethod,
        date: new Date(),
      };

      const text = formatBillReceiptText(billData);
      await openWhatsAppDirect(row.phone, text);
      // Mark as sent
      setResults((prev) =>
        prev.map((item) =>
          item.phone === row.phone ? { ...item, waStatus: 'sent' } : item
        )
      );
    } catch (err) {
      Alert.alert('WhatsApp Error', err.message);
    }
  };

  const handleDone = () => {
    onPaymentSuccess();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={step === 'processing' ? () => {} : onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* ---- PROCESSING ---- */}
          {step === 'processing' && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.processingTitle}>Settling table & kitchen KOT...</Text>
              <Text style={styles.processingDesc}>
                Processing {customersWithItems.length} customer order{customersWithItems.length !== 1 ? 's' : ''} & sending WhatsApp bills
              </Text>
            </View>
          )}

          {/* ---- SUCCESS ---- */}
          {step === 'success' && (
            <View style={styles.successContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={36} color="#FFFFFF" />
              </View>
              <Text style={styles.successTitle}>Table Settled!</Text>
              <Text style={styles.successAmount}>₹{tableTotal.toFixed(2)}</Text>

              <View style={styles.waBatchHeader}>
                <Ionicons name="logo-whatsapp" size={16} color="#15803D" />
                <Text style={styles.waBatchHeaderText}>Customer WhatsApp Delivery</Text>
              </View>

              <ScrollView style={styles.successScroll} showsVerticalScrollIndicator={false}>
                {results.map((r, i) => (
                  <View key={i} style={styles.resultRow}>
                    <View style={styles.resultLeft}>
                      <Ionicons
                        name={r.success ? 'checkmark-circle' : 'alert-circle'}
                        size={16}
                        color={r.success ? COLORS.accentGreen : COLORS.accentRed}
                      />
                      <View>
                        <Text style={styles.resultPhone}>+91 {r.phone}</Text>
                        <Text style={styles.resultOrderId} numberOfLines={1}>
                          {r.orderId || (r.success ? 'Settled' : 'Failed')}
                        </Text>
                      </View>
                    </View>

                    {/* WhatsApp Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.waRowBtn,
                        r.waStatus === 'sent' && styles.waRowBtnSent,
                      ]}
                      onPress={() => handleDirectWhatsAppSend(r)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="logo-whatsapp"
                        size={13}
                        color={r.waStatus === 'sent' ? '#15803D' : '#FFFFFF'}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.waRowBtnText,
                          r.waStatus === 'sent' && styles.waRowBtnTextSent,
                        ]}
                      >
                        {r.waStatus === 'sent' ? 'Sent ✅' : 'Open WhatsApp'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.8}>
                <Text style={styles.doneBtnText}>Table Complete · New Order</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ---- REVIEW ---- */}
          {step === 'review' && (
            <>
              {/* Header */}
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.headerTitle}>Table {table?.table_number} · Bill</Text>
                  <Text style={styles.headerSub}>
                    {customersWithItems.length} customer{customersWithItems.length !== 1 ? 's' : ''} · ₹{tableTotal.toFixed(2)} total
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={20} color={COLORS.textMedium} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* WhatsApp Notice Banner */}
                <View style={styles.waNoticeBanner}>
                  <Ionicons name="logo-whatsapp" size={16} color="#15803D" style={{ marginRight: 8 }} />
                  <Text style={styles.waNoticeText}>
                    All customer bills will be dispatched via WhatsApp automatically upon payment.
                  </Text>
                </View>

                {/* Payment method selection */}
                <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
                <View style={styles.methodsRow}>
                  {['Cash', 'Upi', 'Card'].map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.methodBtn, globalMethod === m && styles.methodBtnActive]}
                      onPress={() => setGlobalMethod(m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.methodBtnText, globalMethod === m && styles.methodBtnTextActive]}>
                        {m === 'Upi' ? 'UPI' : m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Per-customer breakdown */}
                <Text style={styles.sectionLabel}>ORDER BREAKDOWN</Text>
                {customersWithItems.length === 0 ? (
                  <View style={styles.noItemsBox}>
                    <Text style={styles.noItemsText}>No items have been ordered at this table yet.</Text>
                  </View>
                ) : (
                  customersWithItems.map((customer, index) => {
                    const custTotal = getCustomerTotal(customer);
                    const items = [
                      ...Object.values(customer.cartItems || {}),
                      ...(customer.activeOrders || []).flatMap((o) =>
                        Array.isArray(o.items) ? o.items : Object.values(o.items || {})
                      ),
                    ];

                    return (
                      <View key={customer.id} style={styles.customerBillCard}>
                        <View style={styles.customerBillHeader}>
                          <View style={styles.customerBillAvatar}>
                            <Text style={styles.customerBillAvatarText}>C{index + 1}</Text>
                          </View>
                          <View style={styles.customerBillInfo}>
                            <Text style={styles.customerBillName}>
                              {customer.label || `Customer ${index + 1}`}
                            </Text>
                            <Text style={styles.customerBillPhone}>+91 {customer.phone}</Text>
                          </View>
                          <Text style={styles.customerBillTotal}>₹{custTotal.toFixed(0)}</Text>
                        </View>

                        {items.map((item, itemIdx) => (
                          <View key={item.id || itemIdx} style={styles.billItemRow}>
                            <Text style={styles.billItemName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={styles.billItemQty}>×{item.quantity}</Text>
                            <Text style={styles.billItemPrice}>
                              ₹{(item.price * item.quantity).toFixed(0)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  })
                )}

                {/* Table Total */}
                {customersWithItems.length > 0 && (
                  <View style={styles.tableTotalBox}>
                    <View style={[styles.tableTotalRow, styles.tableTotalGrandRow]}>
                      <Text style={styles.tableTotalGrandLabel}>TABLE TOTAL</Text>
                      <Text style={styles.tableTotalGrandValue}>₹{tableTotal.toFixed(2)}</Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Confirm */}
              <View style={styles.footerActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, customersWithItems.length === 0 && styles.confirmBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={customersWithItems.length === 0}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmBtnText}>Settle & Send Bills</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingBottom: 28,
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
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  waNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  waNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#15803D',
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chipBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  customerBillCard: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customerBillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  customerBillAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.chipActive,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  customerBillAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  customerBillInfo: {
    flex: 1,
  },
  customerBillName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  customerBillPhone: {
    fontSize: 11,
    color: COLORS.textMedium,
  },
  customerBillTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.accentGreen,
  },
  billItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  billItemName: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textDark,
  },
  billItemQty: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginHorizontal: 12,
  },
  billItemPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  tableTotalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tableTotalGrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableTotalGrandLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  tableTotalGrandValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chipBg,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 8,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  processingContainer: {
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
  processingDesc: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginTop: 4,
    textAlign: 'center',
  },
  successContainer: {
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
  successAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#059669',
    marginTop: 2,
    marginBottom: 14,
  },
  waBatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  waBatchHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  successScroll: {
    width: '100%',
    maxHeight: 220,
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.chipBg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  resultPhone: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  resultOrderId: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  waRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  waRowBtnSent: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  waRowBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  waRowBtnTextSent: {
    color: '#15803D',
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  noItemsBox: {
    padding: 24,
    alignItems: 'center',
  },
  noItemsText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});
