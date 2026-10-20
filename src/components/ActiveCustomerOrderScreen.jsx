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
  (customer?.activeOrders || []).forEach((ord) => {
    (ord.items || []).forEach((item) => {
      const key = `${item.id || item.name}_${item.price}`;
      if (!map[key]) {
        map[key] = {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          totalPrice: item.price * item.quantity,
        };
      } else {
        map[key].quantity += item.quantity;
        map[key].totalPrice += item.price * item.quantity;
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
}) {
  const [showRounds, setShowRounds] = useState(false);

  const activeOrders = customer?.activeOrders || [];
  const consolidatedItems = getConsolidatedItems(customer);

  const totalAmount = activeOrders.reduce(
    (sum, ord) => sum + (ord.totalAmount || 0),
    0
  );
  const totalItemCount = consolidatedItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // Overall KOT status: if any is PREPARING -> PREPARING, if all READY -> READY, etc.
  const hasReady = activeOrders.some(
    (o) => (o.status || '').toUpperCase() === 'READY'
  );
  const hasPreparing = activeOrders.some(
    (o) => (o.status || '').toUpperCase() === 'PREPARING'
  );
  const allServed =
    activeOrders.length > 0 &&
    activeOrders.every((o) => (o.status || '').toUpperCase() === 'SERVED');

  const overallStatus = hasReady
    ? 'READY'
    : hasPreparing
    ? 'PREPARING'
    : allServed
    ? 'SERVED'
    : 'PENDING';
  const statusInfo = getStatusDetails(overallStatus);

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
              {activeOrders.map((ord, idx) => (
                <View key={ord.dbOrderId || ord.orderId || idx} style={styles.roundItem}>
                  <View style={styles.roundTop}>
                    <Text style={styles.roundTag}>KOT Round #{idx + 1}</Text>
                    <Text style={styles.roundOrderId}>{ord.orderId || `#${ord.dbOrderId}`}</Text>
                    <Text style={styles.roundStatusBadge}>{(ord.status || 'PENDING').toUpperCase()}</Text>
                  </View>
                  <Text style={styles.roundItemsText}>
                    {(ord.items || []).map((i) => `${i.name} × ${i.quantity}`).join(', ')}
                  </Text>
                  <Text style={styles.roundSubtotal}>₹{(ord.totalAmount || 0).toFixed(2)}</Text>
                </View>
              ))}
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
                <View key={item.id || idx} style={styles.itemRow}>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyBadgeText}>{item.quantity}×</Text>
                  </View>
                  <View style={styles.itemInfoCol}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemUnit}>@ ₹{item.price.toFixed(2)} each</Text>
                  </View>
                  <Text style={styles.itemTotal}>₹{item.totalPrice.toFixed(2)}</Text>
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
