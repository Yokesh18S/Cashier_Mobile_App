import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

/**
 * Consolidates all ordered items across all KOT submissions for this customer.
 * Groups by item ID or name + price so e.g. Round 1 Coffee (1) + Round 3 Coffee (1) => Coffee x 2.
 */
export function getConsolidatedItems(customer) {
  const map = {};
  const orders = customer?.activeOrders || [];
  const multipleOrders = orders.length > 1;

  orders.forEach((ord, roundIdx) => {
    const isOrdCancelled = (ord.status || '').toUpperCase() === 'CANCELLED';
    (ord.items || []).forEach((item) => {
      const isItemCancelled = isOrdCancelled || (item.status || '').toUpperCase() === 'CANCELLED';
      // Group by item + price + orderId + cancellation status so cancelling targets the specific order item
      const key = `${item.id || item.name}_${item.price}_${ord.dbOrderId || ord.orderId}_${isItemCancelled ? 'cancelled' : 'active'}`;
      if (!map[key]) {
        map[key] = {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          totalPrice: isItemCancelled ? 0 : item.price * item.quantity,
          status: isItemCancelled ? 'CANCELLED' : (item.status || ord.status || 'PENDING'),
          orderId: ord.dbOrderId || ord.orderId,
          roundLabel: multipleOrders ? `Round #${roundIdx + 1}` : null,
          isCancelled: isItemCancelled,
        };
      } else {
        map[key].quantity += item.quantity;
        if (!isItemCancelled) {
          map[key].totalPrice += item.price * item.quantity;
        }
      }
    });
  });

  return Object.values(map);
}

/**
 * Maps raw backend/order status to badge colors and label.
 */
function getStatusDetails(status = 'PENDING') {
  const s = String(status).toUpperCase();
  switch (s) {
    case 'CANCELLED':
      return {
        label: 'KOT Cancelled',
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FECACA',
        icon: 'close-circle-outline',
        hint: 'Orders for this customer have been cancelled in the kitchen.',
      };
    case 'READY':
      return {
        label: 'Ready to Serve',
        color: '#059669',
        bg: '#ECFDF5',
        border: '#A7F3D0',
        icon: 'bell-ring-outline',
        hint: 'Kitchen has finished preparing. Food is ready for pickup!',
      };
    case 'PREPARING':
      return {
        label: 'Kitchen is Preparing',
        color: '#2563EB',
        bg: '#EFF6FF',
        border: '#BFDBFE',
        icon: 'chef-hat',
        hint: 'Chef is cooking the items right now.',
      };
    case 'SERVED':
      return {
        label: 'Food Served to Table',
        color: '#4B5563',
        bg: '#F3F4F6',
        border: '#E5E7EB',
        icon: 'silverware-fork-knife',
        hint: 'All items have been served to the customer.',
      };
    case 'PENDING':
    default:
      return {
        label: 'Sent to Kitchen (KOT)',
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
        icon: 'clock-outline',
        hint: 'Order is active in kitchen queue (New Orders).',
      };
  }
}

export default function ActiveCustomerOrderScreen({
  table,
  customer,
  onAddMoreItems,
  onSendBill,
  onBack,
  onCancelItem,
  onCancelOrder,
}) {
  const [showRounds, setShowRounds] = useState(false);

  const activeOrders = customer?.activeOrders || [];
  const consolidatedItems = getConsolidatedItems(customer);

  const totalAmount = activeOrders.reduce(
    (sum, ord) => {
      if ((ord.status || '').toUpperCase() === 'CANCELLED') return sum;
      return sum + (ord.totalAmount || 0);
    },
    0
  );
  const totalItemCount = consolidatedItems
    .filter(item => !item.isCancelled)
    .reduce((sum, item) => sum + item.quantity, 0);

  // Overall KOT status
  const nonCancelledOrders = activeOrders.filter(
    (o) => (o.status || '').toUpperCase() !== 'CANCELLED'
  );
  const hasReady = nonCancelledOrders.some(
    (o) => (o.status || '').toUpperCase() === 'READY'
  );
  const hasPreparing = nonCancelledOrders.some(
    (o) => (o.status || '').toUpperCase() === 'PREPARING'
  );
  const allServed =
    nonCancelledOrders.length > 0 &&
    nonCancelledOrders.every((o) => (o.status || '').toUpperCase() === 'SERVED');

  const overallStatus = nonCancelledOrders.length === 0 && activeOrders.length > 0
    ? 'CANCELLED'
    : hasReady
    ? 'READY'
    : hasPreparing
    ? 'PREPARING'
    : allServed
    ? 'SERVED'
    : 'PENDING';
  const statusInfo = getStatusDetails(overallStatus);

  const handleConfirmCancelItem = (item) => {
    Alert.alert(
      'Cancel KOT Item',
      `Customer wants to remove or change "${item.name}"?\n\nThis will remove it from the running bill and indicate as cancelled in the Kitchen KOT.`,
      [
        { text: 'Keep Item', style: 'cancel' },
        {
          text: 'Cancel Item',
          style: 'destructive',
          onPress: () => onCancelItem && onCancelItem(item),
        },
      ]
    );
  };

  const handleConfirmCancelRound = (ord, roundNumber) => {
    Alert.alert(
      `Cancel KOT Round #${roundNumber}`,
      `Are you sure you want to cancel the entire KOT Round #${roundNumber} (${ord.orderId || `#${ord.dbOrderId}`})?\n\nThis will cancel all items in this submission in the kitchen.`,
      [
        { text: 'Keep KOT', style: 'cancel' },
        {
          text: 'Cancel KOT',
          style: 'destructive',
          onPress: () => onCancelOrder && onCancelOrder(ord.dbOrderId || ord.orderId),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.titleRow}>
            <View style={styles.tableBadge}>
              <Text style={styles.tableBadgeText}>Table {table?.table_number}</Text>
            </View>
            <Text style={styles.customerTitle} numberOfLines={1}>
              {customer?.label || 'Customer'}
            </Text>
          </View>
          <Text style={styles.phoneSub}>
            +91 {customer?.phone || 'Guest'} · Running Bill Open
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* KOT Status Card */}
        <View style={[styles.statusCard, { borderColor: statusInfo.border, backgroundColor: statusInfo.bg }]}>
          <View style={styles.statusHeader}>
            <View style={styles.statusTitleGroup}>
              <MaterialCommunityIcons name={statusInfo.icon} size={20} color={statusInfo.color} />
              <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
            <View style={[styles.pulseDot, { backgroundColor: statusInfo.color }]} />
          </View>
          <Text style={styles.statusHint}>{statusInfo.hint}</Text>
          <View style={styles.kotCountRow}>
            <Text style={styles.kotCountText}>
              {activeOrders.length} KOT Submission{activeOrders.length !== 1 ? 's' : ''} to Kitchen
            </Text>
            <TouchableOpacity onPress={() => setShowRounds(!showRounds)} activeOpacity={0.7}>
              <Text style={styles.toggleRoundsText}>
                {showRounds ? 'Hide KOT Tickets' : 'View KOT Tickets'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Collapsible KOT rounds */}
          {showRounds && (
            <View style={styles.roundsContainer}>
              {activeOrders.map((ord, idx) => {
                const isOrdCancelled = (ord.status || '').toUpperCase() === 'CANCELLED';
                return (
                  <View key={ord.dbOrderId || ord.orderId || idx} style={[styles.roundItem, isOrdCancelled && styles.roundItemCancelled]}>
                    <View style={styles.roundTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.roundTag, isOrdCancelled && styles.roundTagCancelled]}>KOT Round #{idx + 1}</Text>
                        <Text style={styles.roundOrderId}>{ord.orderId || `#${ord.dbOrderId}`}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.roundStatusBadge, isOrdCancelled && styles.roundStatusBadgeCancelled]}>
                          {(ord.status || 'PENDING').toUpperCase()}
                        </Text>
                        {!isOrdCancelled && (
                          <TouchableOpacity
                            style={styles.cancelRoundBtn}
                            onPress={() => handleConfirmCancelRound(ord, idx + 1)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={13} color="#DC2626" />
                            <Text style={styles.cancelRoundBtnText}>Cancel</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.roundItemsText, isOrdCancelled && styles.roundItemsTextCancelled]}>
                      {(ord.items || []).map((i) => {
                        const isICancelled = isOrdCancelled || (i.status || '').toUpperCase() === 'CANCELLED';
                        return `${i.name} × ${i.quantity}${isICancelled ? ' (Cancelled)' : ''}`;
                      }).join(', ')}
                    </Text>
                    <Text style={[styles.roundSubtotal, isOrdCancelled && styles.roundSubtotalCancelled]}>
                      {isOrdCancelled ? 'CANCELLED' : `₹${(ord.totalAmount || 0).toFixed(2)}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Waiter Dining Check / Question Banner */}
        <View style={styles.questionBanner}>
          <View style={styles.questionIconBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#2563EB" />
          </View>
          <View style={styles.questionTextCol}>
            <Text style={styles.questionTitle}>Customer Still Dining?</Text>
            <Text style={styles.questionSub}>
              Ask customer if they want anything extra (more idly, dosa, coffee) or if they would like to close the bill.
            </Text>
          </View>
        </View>

        {/* Running Bill / Accumulated Items List */}
        <View style={styles.billSection}>
          <View style={styles.billSectionHeader}>
            <Text style={styles.billSectionTitle}>Accumulated Bill Items</Text>
            <Text style={styles.itemCountText}>
              {totalItemCount} item{totalItemCount !== 1 ? 's' : ''} total
            </Text>
          </View>

          {consolidatedItems.length === 0 ? (
            <View style={styles.emptyItemsBox}>
              <MaterialCommunityIcons name="silverware" size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyItemsText}>No items sent to kitchen yet.</Text>
            </View>
          ) : (
            <View style={styles.itemsTable}>
              {consolidatedItems.map((item, idx) => (
                <View key={item.id || idx} style={[styles.itemRow, item.isCancelled && styles.itemRowCancelled]}>
                  <View style={[styles.qtyBadge, item.isCancelled && styles.qtyBadgeCancelled]}>
                    <Text style={[styles.qtyBadgeText, item.isCancelled && styles.qtyBadgeTextCancelled]}>
                      {item.quantity}×
                    </Text>
                  </View>
                  <View style={styles.itemInfoCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.itemName, item.isCancelled && styles.itemNameCancelled]}>
                        {item.name}
                      </Text>
                      {item.roundLabel && (
                        <View style={styles.roundItemBadge}>
                          <Text style={styles.roundItemBadgeText}>{item.roundLabel}</Text>
                        </View>
                      )}
                      {item.isCancelled && (
                        <View style={styles.cancelledBadge}>
                          <Text style={styles.cancelledBadgeText}>CANCELLED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.itemUnit, item.isCancelled && styles.itemUnitCancelled]}>
                      @ ₹{item.price.toFixed(2)} each
                    </Text>
                  </View>
                  <Text style={[styles.itemTotal, item.isCancelled && styles.itemTotalCancelled]}>
                    {item.isCancelled ? '₹0.00' : `₹${item.totalPrice.toFixed(2)}`}
                  </Text>
                  {!item.isCancelled && (
                    <TouchableOpacity
                      style={styles.cancelItemBtn}
                      onPress={() => handleConfirmCancelItem(item)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Running Total Box */}
          <View style={styles.runningTotalBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>₹{totalAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax (0%)</Text>
              <Text style={styles.totalValue}>₹0.00</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <View>
                <Text style={styles.grandTotalLabel}>Running Bill Total</Text>
                <Text style={styles.sameBillSubtext}>Same bill · Single payment at end</Text>
              </View>
              <Text style={styles.grandTotalValue}>₹{totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Two Clear Actions at the Bottom */}
      <View style={styles.bottomBar}>
        {/* Button 1: Add More Items */}
        <TouchableOpacity
          style={styles.addMoreBtn}
          onPress={onAddMoreItems}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
          <View>
            <Text style={styles.addMoreBtnText}>+ Add More Items</Text>
            <Text style={styles.btnSubtext}>Appends to this bill</Text>
          </View>
        </TouchableOpacity>

        {/* Button 2: Send Bill */}
        <TouchableOpacity
          style={[styles.sendBillBtn, totalAmount <= 0 && styles.sendBillDisabled]}
          onPress={onSendBill}
          disabled={totalAmount <= 0}
          activeOpacity={0.8}
        >
          <Ionicons name="receipt-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
          <View>
            <Text style={styles.sendBillBtnText}>Send Bill</Text>
            <Text style={styles.btnSubtext}>₹{totalAmount.toFixed(0)} · Checkout</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerCenter: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableBadge: {
    backgroundColor: COLORS.chipActive,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tableBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  customerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  phoneSub: {
    fontSize: 11,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 14,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusHint: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginTop: 6,
    lineHeight: 16,
  },
  kotCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  kotCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  toggleRoundsText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },
  roundsContainer: {
    marginTop: 8,
    gap: 6,
  },
  roundItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roundTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roundTag: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  roundOrderId: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  roundStatusBadge: {
    fontSize: 9.5,
    fontWeight: '700',
    color: COLORS.accent,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roundItemsText: {
    fontSize: 11,
    color: COLORS.textMedium,
  },
  roundSubtotal: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
    textAlign: 'right',
    marginTop: 2,
  },
  roundItemCancelled: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    opacity: 0.8,
  },
  roundTagCancelled: {
    color: '#991B1B',
    textDecorationLine: 'line-through',
  },
  roundStatusBadgeCancelled: {
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  cancelRoundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cancelRoundBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  roundItemsTextCancelled: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  roundSubtotalCancelled: {
    color: '#DC2626',
    fontWeight: '800',
  },
  questionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  questionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  questionTextCol: {
    flex: 1,
  },
  questionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  questionSub: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
    lineHeight: 15,
  },
  billSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  billSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  billSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  itemCountText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyItemsBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyItemsText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  itemsTable: {
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  qtyBadge: {
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 10,
  },
  qtyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  itemInfoCol: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  itemUnit: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  itemRowCancelled: {
    opacity: 0.65,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    paddingHorizontal: 6,
    marginVertical: 2,
    borderBottomWidth: 0,
  },
  qtyBadgeCancelled: {
    backgroundColor: '#FEE2E2',
  },
  qtyBadgeTextCancelled: {
    color: '#991B1B',
    textDecorationLine: 'line-through',
  },
  itemNameCancelled: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  itemUnitCancelled: {
    color: '#9CA3AF',
  },
  itemTotalCancelled: {
    color: '#DC2626',
    textDecorationLine: 'line-through',
  },
  cancelledBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cancelledBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  roundItemBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  roundItemBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563EB',
  },
  cancelItemBtn: {
    padding: 6,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runningTotalBox: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 12,
    color: COLORS.textMedium,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    marginTop: 6,
    marginBottom: 0,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  sameBillSubtext: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    gap: 10,
  },
  addMoreBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sendBillBtn: {
    flex: 1,
    backgroundColor: '#059669', // Emerald green
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBillDisabled: {
    backgroundColor: '#9CA3AF',
  },
  sendBillBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
  },
});
