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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

/**
 * TableBillingModal
 *
 * Shows a consolidated bill across all customers at a table.
 * Allows the waiter to:
 *   1. Review each customer's line items
 *   2. Select a payment method per order (or one global method)
 *   3. Confirm payment → calls onConfirmTablePayment for each customer's order
 *   4. Shows a success screen with each order ID
 *
 * Props:
 *   visible             — boolean
 *   onClose()           — close without payment
 *   table               — { id, table_number }
 *   customers           — [{ id, phone, label, cartItems }]
 *   onConfirmTablePayment({ customers, globalMethod }) — async, returns [{ phone, orderId, success }]
 *   onPaymentSuccess()  — called after all orders placed, clears table
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
  const [results, setResults] = useState([]); // [{ phone, orderId, success, error }]

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
  const tableSubtotal = tableTotal;

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
      setResults(res || []);
      setStep('success');
    } catch (err) {
      console.warn('[TableBillingModal] Payment error:', err);
      setStep('success');
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
              <Text style={styles.processingTitle}>Sending orders to kitchen...</Text>
              <Text style={styles.processingDesc}>
                Placing {customersWithItems.length} order{customersWithItems.length !== 1 ? 's' : ''} via KOT
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

              <ScrollView style={styles.successScroll} showsVerticalScrollIndicator={false}>
                {results.map((r, i) => (
                  <View key={i} style={styles.resultRow}>
                    <Ionicons
                      name={r.success ? 'checkmark-circle' : 'alert-circle'}
                      size={16}
                      color={r.success ? COLORS.accentGreen : COLORS.accentRed}
                    />
                    <Text style={styles.resultPhone}>+91 {r.phone}</Text>
                    <Text style={styles.resultOrderId} numberOfLines={1}>
                      {r.orderId || (r.success ? '—' : 'Failed')}
                    </Text>
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
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="close" size={20} color={COLORS.textMedium} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
                      ...(customer.activeOrders || []).flatMap(o => (Array.isArray(o.items) ? o.items : Object.values(o.items || {}))),
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
                  <Text style={styles.confirmBtnText}>Confirm &amp; Send KOT</Text>
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
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
  noItemsBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  noItemsText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  customerBillCard: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  customerBillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  customerBillAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerBillAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
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
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  customerBillTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  billItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  billItemName: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textMedium,
    fontWeight: '500',
  },
  billItemQty: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginHorizontal: 8,
    fontWeight: '600',
  },
  billItemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
    minWidth: 50,
    textAlign: 'right',
  },
  customerBillFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  customerBillSubLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  tableTotalBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  tableTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableTotalLabel: {
    fontSize: 12,
    color: COLORS.textMedium,
    fontWeight: '500',
  },
  tableTotalValue: {
    fontSize: 12,
    color: COLORS.textMedium,
    fontWeight: '600',
  },
  tableTotalGrandRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tableTotalGrandLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: 0.3,
  },
  tableTotalGrandValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textDark,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
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
  confirmBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Processing
  processingContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  processingDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  // Success
  successContainer: {
    paddingHorizontal: 20,
    paddingVertical: 28,
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
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  successAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textDark,
    marginTop: 4,
    marginBottom: 18,
  },
  successScroll: {
    width: '100%',
    maxHeight: 180,
    backgroundColor: COLORS.chipBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  resultPhone: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMedium,
    flex: 1,
  },
  resultOrderId: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
    maxWidth: 120,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
