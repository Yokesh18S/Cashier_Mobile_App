import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

/**
 * CustomerListScreen
 *
 * Shows the list of customers currently at a table.
 * Each customer has their own order (cartItems).
 * Actions:
 *   - "+ Add Customer" → opens a small phone-number prompt modal
 *   - Tap customer row → navigate to that customer's ordering screen
 *   - "View Bill" → opens the table billing summary
 *
 * Props:
 *   table           — { id, table_number, capacity, status }
 *   customers       — array of { id, phone, label, cartItems }
 *   onAddCustomer(phone) — called with a 10-digit phone number
 *   onSelectCustomer(customerId) — navigate into that customer's order
 *   onViewBill()    — open the table billing modal
 *   onBack()        — go back to table selection
 */
export default function CustomerListScreen({
  table,
  customers = [],
  onAddCustomer,
  onSelectCustomer,
  onAddMoreItems,
  onSendCustomerBill,
  onViewBill,
  onBack,
}) {
  const [addPhoneModal, setAddPhoneModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const getOrderStatusBadge = (status) => {
    const norm = (status || 'PENDING').toUpperCase();
    switch (norm) {
      case 'PENDING':
      case 'NEW':
        return { label: 'KOT Sent', color: '#C2410C', bg: '#FFEDD5', border: '#FB923C', icon: 'clock-outline' };
      case 'PREPARING':
        return { label: 'Kitchen Preparing', color: '#B45309', bg: '#FEF3C7', border: '#F59E0B', icon: 'chef-hat' };
      case 'READY':
      case 'READY_TO_SERVE':
        return { label: 'Ready to Serve 🔔', color: '#15803D', bg: '#DCFCE7', border: '#22C55E', icon: 'bell-ring-outline', isReady: true };
      case 'SERVED':
      case 'COMPLETED':
        return { label: 'Served', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1', icon: 'check-circle-outline' };
      default:
        return { label: norm, color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', icon: 'information-outline' };
    }
  };

  const getCustomerItemCount = (customer) => {
    const cartCount = Object.values(customer.cartItems || {}).reduce((s, i) => s + i.quantity, 0);
    const ordersCount = (customer.activeOrders || []).reduce(
      (s, o) => s + (o.items ? (Array.isArray(o.items) ? o.items.reduce((q, item) => q + (item.quantity || 1), 0) : Object.values(o.items).reduce((q, item) => q + item.quantity, 0)) : 0),
      0
    );
    return cartCount + ordersCount;
  };

  const getCustomerTotal = (customer) => {
    const unplacedSub = Object.values(customer.cartItems || {}).reduce(
      (s, i) => s + i.price * i.quantity,
      0
    );
    const unplacedTotal = unplacedSub;
    const activeOrdersTotal = (customer.activeOrders || []).reduce(
      (s, o) => s + (o.totalAmount || 0),
      0
    );
    return unplacedTotal + activeOrdersTotal;
  };

  const totalItems = customers.reduce((sum, c) => sum + getCustomerItemCount(c), 0);
  const totalAmount = customers.reduce((sum, c) => sum + getCustomerTotal(c), 0);

  const handleAddPress = () => {
    setNewPhone('');
    setPhoneError('');
    setAddPhoneModal(true);
  };

  const handleConfirmAdd = () => {
    const clean = newPhone.trim().replace(/\D/g, '');
    if (clean.length !== 10) {
      setPhoneError('Please enter a valid 10-digit mobile number');
      return;
    }
    // Check for duplicates at this table
    if (customers.some((c) => c.phone === clean)) {
      setPhoneError('This phone number is already added at this table');
      return;
    }
    setAddPhoneModal(false);
    onAddCustomer(clean);
  };

  return (
    <View style={styles.container}>
      {/* Back bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Table {table.table_number}</Text>
          <Text style={styles.topBarSub}>
            {customers.length} customer{customers.length !== 1 ? 's' : ''} · {totalItems} items
          </Text>
        </View>

        {/* View Bill button */}
        {customers.length > 0 && (
          <TouchableOpacity style={styles.viewBillBtn} onPress={onViewBill} activeOpacity={0.8}>
            <Ionicons name="receipt-outline" size={14} color="#FFFFFF" />
            <Text style={styles.viewBillText}>Bill</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {/* Add Customer CTA */}
        <TouchableOpacity style={styles.addCustomerCard} onPress={handleAddPress} activeOpacity={0.8}>
          <View style={styles.addIconCircle}>
            <Ionicons name="add" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.addTextCol}>
            <Text style={styles.addTitle}>+ Add Customer</Text>
            <Text style={styles.addSub}>Enter phone number to start a new order seat</Text>
          </View>
        </TouchableOpacity>

        {/* Customer rows */}
        {customers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="account-plus-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No customers yet</Text>
            <Text style={styles.emptyDesc}>
              Tap &quot;+ Add Customer&quot; above to seat the first customer at this table.
            </Text>
          </View>
        ) : (
          customers.map((customer, index) => {
            const itemCount = getCustomerItemCount(customer);
            const custTotal = getCustomerTotal(customer);
            const unplacedCount = Object.values(customer.cartItems || {}).reduce((s, i) => s + i.quantity, 0);
            const activeOrders = customer.activeOrders || [];
            const hasReadyOrder = activeOrders.some(o => (o.status || '').toUpperCase() === 'READY');

            return (
              <View
                key={customer.id}
                style={[
                  styles.customerCard,
                  hasReadyOrder && styles.customerCardReady,
                ]}
              >
                <TouchableOpacity
                  style={styles.customerCardHeader}
                  onPress={() => onSelectCustomer(customer.id)}
                  activeOpacity={0.75}
                >
                  {/* Avatar */}
                  <View style={[styles.avatar, (itemCount > 0) && styles.avatarActive, hasReadyOrder && styles.avatarReady]}>
                    <Text style={[styles.avatarText, (itemCount > 0) && styles.avatarTextActive]}>
                      C{index + 1}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerLabel}>{customer.label || `Customer ${index + 1}`}</Text>
                    <Text style={styles.customerPhone}>+91 {customer.phone}</Text>
                  </View>

                  {/* Total + chevron */}
                  <View style={styles.customerRight}>
                    {custTotal > 0 && (
                      <Text style={styles.customerTotal}>₹{custTotal.toFixed(0)}</Text>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                  </View>
                </TouchableOpacity>

                {/* Live orders placed to Kitchen / KOT */}
                {activeOrders.length > 0 && (
                  <View style={styles.ordersListSection}>
                    {activeOrders.map((ord, ordIdx) => {
                      const badge = getOrderStatusBadge(ord.status);
                      const itemsStr = Array.isArray(ord.items)
                        ? ord.items.map(i => `${i.name || 'Item'} (x${i.quantity || 1})`).join(', ')
                        : Object.values(ord.items || {}).map(i => `${i.name} (x${i.quantity})`).join(', ');

                      return (
                        <View
                          key={ord.dbOrderId || ord.orderId || ordIdx}
                          style={[
                            styles.orderRow,
                            badge.isReady && styles.orderRowReady,
                          ]}
                        >
                          <View style={styles.orderRowHeader}>
                            <Text style={styles.orderIdText}>
                              {ord.orderId || `#${ord.dbOrderId}`}
                            </Text>
                            <View style={[styles.orderStatusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                              <MaterialCommunityIcons name={badge.icon} size={12} color={badge.color} style={{ marginRight: 3 }} />
                              <Text style={[styles.orderStatusText, { color: badge.color }]}>
                                {badge.label}
                              </Text>
                            </View>
                          </View>
                          {Boolean(itemsStr) && (
                            <Text style={styles.orderItemsSnippet} numberOfLines={1}>
                              {itemsStr}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Unplaced cart items banner */}
                {unplacedCount > 0 && (
                  <TouchableOpacity
                    style={styles.unplacedCartBanner}
                    onPress={() => onSelectCustomer(customer.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="cart-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.unplacedCartText}>
                      {unplacedCount} new item{unplacedCount !== 1 ? 's' : ''} in cart · Tap to Send to KOT
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Action buttons: Add More Items & Send Bill */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={[styles.orderMoreBtn, custTotal > 0 && styles.orderMoreBtnHalf]}
                    onPress={() => onAddMoreItems ? onAddMoreItems(customer.id) : onSelectCustomer(customer.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle-outline" size={15} color={COLORS.primary} />
                    <Text style={styles.orderMoreText}>
                      {itemCount === 0 ? 'Start Order' : '+ Add More Items'}
                    </Text>
                  </TouchableOpacity>

                  {custTotal > 0 && onSendCustomerBill ? (
                    <TouchableOpacity
                      style={styles.sendBillCardBtn}
                      onPress={() => onSendCustomerBill(customer)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="receipt-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.sendBillCardText}>Send Bill</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {/* Table total summary */}
        {customers.length > 0 && (
          <View style={styles.tableTotalCard}>
            <Text style={styles.tableTotalLabel}>Table Total</Text>
            <Text style={styles.tableTotalValue}>₹{totalAmount.toFixed(2)}</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Customer Modal */}
      <Modal
        visible={addPhoneModal}
        animationType="fade"
        transparent
        onRequestClose={() => setAddPhoneModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Customer</Text>
            <Text style={styles.modalSub}>Table {table.table_number}</Text>

            <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
            <TextInput
              style={[styles.phoneInput, phoneError ? styles.phoneInputError : null]}
              placeholder="Enter 10-digit number"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
              value={newPhone}
              onChangeText={(t) => {
                setNewPhone(t.replace(/\D/g, ''));
                setPhoneError('');
              }}
              autoFocus
            />
            {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAddPhoneModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmAdd}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  topBarSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  viewBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  viewBillText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  listContent: {
    padding: 14,
    gap: 10,
    paddingBottom: 32,
  },
  addCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    gap: 12,
    marginBottom: 4,
  },
  addIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addTextCol: {
    flex: 1,
  },
  addTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  addSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  emptyDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 18,
  },
  customerCard: {
    flexDirection: 'column',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  customerCardReady: {
    borderColor: '#22C55E',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  customerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  avatarActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  avatarReady: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
  },
  ordersListSection: {
    width: '100%',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  orderRow: {
    backgroundColor: COLORS.bgLight,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderRowReady: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  orderRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  orderStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  orderItemsSnippet: {
    fontSize: 11,
    color: COLORS.textMedium,
  },
  unplacedCartBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: '100%',
  },
  unplacedCartText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginTop: 4,
  },
  orderMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: COLORS.chipBg,
    width: '100%',
  },
  orderMoreBtnHalf: {
    flex: 1,
    width: undefined,
  },
  orderMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sendBillCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#059669', // Emerald green
  },
  sendBillCardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMedium,
  },
  avatarTextActive: {
    color: '#FFFFFF',
  },
  customerInfo: {
    flex: 1,
  },
  customerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  customerPhone: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  customerOrderSummary: {
    fontSize: 11,
    color: COLORS.textMedium,
    marginTop: 3,
    fontStyle: 'italic',
  },
  customerOrderEmpty: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
    fontStyle: 'italic',
  },
  customerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  customerTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  tableTotalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  tableTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.85,
  },
  tableTotalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  phoneInput: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    backgroundColor: COLORS.cardBg,
  },
  phoneInputError: {
    borderColor: COLORS.accentRed,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.accentRed,
    marginTop: 5,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
