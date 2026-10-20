import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { fetchLiveOrders } from '../services/api';

/**
 * LiveOrdersScreen (Waiter Dashboard)
 *
 * Displays real-time orders strictly isolated to the waiter's assigned hotel.
 * Shows:
 * - Hotel Name & Staff Name
 * - Order Number / Bill No
 * - Table / Takeaway / Delivery indicator
 * - Ordered Items & Quantities
 * - Order Status (PENDING, PREPARING, READY, SERVED)
 * - Auto-polling with graceful network retry
 * - Pull to refresh
 */
export default function LiveOrdersScreen({
  loggedInUser,
  activeRestaurant,
  onGoToTables,
  onSelectOrder,
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [lastUpdated, setLastUpdated] = useState(null);
  const isMounted = useRef(true);

  const restaurantId = loggedInUser?.restaurant_id || activeRestaurant?.id || 1;

  const loadOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await fetchLiveOrders(restaurantId);
      if (isMounted.current) {
        setOrders(Array.isArray(data) ? data : []);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.warn('[LiveOrdersScreen] Error loading orders:', err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [restaurantId]);

  useEffect(() => {
    isMounted.current = true;
    let timer;

    async function initialLoad() {
      try {
        const data = await fetchLiveOrders(restaurantId);
        if (isMounted.current) {
          setOrders(Array.isArray(data) ? data : []);
          setLastUpdated(new Date());
          setLoading(false);
        }
      } catch (err) {
        console.warn('[LiveOrdersScreen] Initial load error:', err);
        if (isMounted.current) setLoading(false);
      }
      timer = setInterval(() => {
        loadOrders(true);
      }, 8000);
    }

    initialLoad();

    return () => {
      isMounted.current = false;
      if (timer) clearInterval(timer);
    };
  }, [loadOrders, restaurantId]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders(true);
  };

  // Filter logic
  const filteredOrders = orders.filter((o) => {
    const status = (o.status || '').toUpperCase();
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'READY') return status === 'READY';
    if (selectedFilter === 'PREPARING') return status === 'PREPARING';
    if (selectedFilter === 'PENDING') return status === 'PENDING' || status === 'CONFIRMED' || status === 'NEW';
    if (selectedFilter === 'SERVED') return status === 'SERVED' || status === 'COMPLETED';
    return true;
  });

  const getStatusBadgeStyle = (rawStatus) => {
    const s = (rawStatus || '').toUpperCase();
    if (s === 'READY') {
      return { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC', label: 'READY TO SERVE' };
    }
    if (s === 'PREPARING') {
      return { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A', label: 'IN KITCHEN' };
    }
    if (s === 'PENDING' || s === 'CONFIRMED' || s === 'NEW') {
      return { bg: '#FFEDD5', text: '#C2410C', border: '#FDBA74', label: 'NEW / KOT' };
    }
    if (s === 'SERVED' || s === 'COMPLETED') {
      return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', label: 'SERVED' };
    }
    return { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB', label: s || 'ACTIVE' };
  };

  const pendingCount = orders.filter(o => ['PENDING', 'CONFIRMED', 'NEW'].includes((o.status || '').toUpperCase())).length;
  const preparingCount = orders.filter(o => (o.status || '').toUpperCase() === 'PREPARING').length;
  const readyCount = orders.filter(o => (o.status || '').toUpperCase() === 'READY').length;

  const renderOrderItem = ({ item: order }) => {
    const badge = getStatusBadgeStyle(order.status);
    const orderItems = order.items || [];
    const tableLabel = order.table_number || (order.table_id ? `Table ${order.table_id}` : null);
    const isDineIn = (order.order_type || '').toUpperCase() === 'DINE_IN';
    const isTakeaway = (order.order_type || '').toUpperCase() === 'TAKEAWAY';

    // Format local time
    let timeDisplay = '';
    if (order.created_at) {
      try {
        const d = new Date(order.created_at);
        timeDisplay = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        timeDisplay = '';
      }
    }

    return (
      <View style={styles.orderCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.orderNumberBox}>
            <Text style={styles.orderIdText}>
              {order.branch_order_id ? `#${order.branch_order_id}` : `ORD-${order.order_id || order.id}`}
            </Text>
            {timeDisplay ? (
              <Text style={styles.orderTimeText}>{timeDisplay}</Text>
            ) : null}
          </View>

          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <View style={[styles.statusDot, { backgroundColor: badge.text }]} />
            <Text style={[styles.statusText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Order Details: Table / Type */}
        <View style={styles.metaRow}>
          <View style={styles.typeTag}>
            <Ionicons
              name={isDineIn ? 'restaurant-outline' : isTakeaway ? 'bag-handle-outline' : 'bicycle-outline'}
              size={13}
              color={COLORS.textDark}
            />
            <Text style={styles.typeTagText}>
              {isDineIn ? (tableLabel || 'Dine-In') : isTakeaway ? 'Takeaway' : 'Delivery'}
            </Text>
          </View>

          {order.placed_by_name ? (
            <View style={styles.placedByTag}>
              <Ionicons name="person-circle-outline" size={13} color={COLORS.primary} />
              <Text style={styles.placedByText}>Waiter: {order.placed_by_name}</Text>
            </View>
          ) : null}

          {order.customer_phone ? (
            <View style={styles.phoneTag}>
              <Ionicons name="call-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.phoneTagText}>{order.customer_phone}</Text>
            </View>
          ) : null}
        </View>

        {/* Item List */}
        <View style={styles.itemsContainer}>
          {orderItems.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemQuantity}>{it.quantity || 1}×</Text>
              <Text style={styles.itemName} numberOfLines={1}>{it.name || 'Menu Item'}</Text>
              <Text style={styles.itemPrice}>
                ₹{((it.quantity || 1) * (parseFloat(it.price) || 0)).toFixed(0)}
              </Text>
            </View>
          ))}
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.itemsSummary}>
            {orderItems.length} item{orderItems.length === 1 ? '' : 's'}
          </Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalAmount}>₹{parseFloat(order.total_amount || 0).toFixed(0)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Waiter & Hotel Overview Strip */}
      <View style={styles.hotelStrip}>
        <View style={styles.hotelInfo}>
          <Text style={styles.hotelName} numberOfLines={1}>
            {loggedInUser?.restaurant_name || activeRestaurant?.name || 'Assigned Hotel'}
          </Text>
          <Text style={styles.staffGreeting}>
            Logged in as <Text style={styles.staffBold}>{loggedInUser?.name || 'Staff'}</Text>
            {loggedInUser?.phone ? ` (${loggedInUser.phone})` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.newOrderBtn} onPress={onGoToTables} activeOpacity={0.8}>
          <Ionicons name="add-circle" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.newOrderBtnText}>Take Order</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Stat Counters */}
      <View style={styles.statsStrip}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{orders.length}</Text>
          <Text style={styles.statLabel}>Active Orders</Text>
        </View>
        <View style={styles.statSep} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#B45309' }]}>{preparingCount}</Text>
          <Text style={styles.statLabel}>In Kitchen</Text>
        </View>
        <View style={styles.statSep} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#15803D' }]}>{readyCount}</Text>
          <Text style={styles.statLabel}>Ready</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {[
          { key: 'ALL', label: 'All Orders' },
          { key: 'READY', label: `Ready to Serve (${readyCount})` },
          { key: 'PREPARING', label: `In Kitchen (${preparingCount})` },
          { key: 'PENDING', label: `KOT Sent (${pendingCount})` },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, selectedFilter === f.key && styles.filterChipActive]}
            onPress={() => setSelectedFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, selectedFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Main Order List */}
      {loading && orders.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Fetching live hotel orders...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.order_id || item.id)}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={54} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No active orders</Text>
              <Text style={styles.emptyDesc}>
                New dine-in and takeaway orders placed for this hotel will appear here in real time.
              </Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={() => loadOrders()}>
                <Ionicons name="refresh" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            lastUpdated ? (
              <Text style={styles.lastUpdatedText}>
                Live auto-refresh · Last synced {lastUpdated.toLocaleTimeString()}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  hotelStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  hotelInfo: {
    flex: 1,
    marginRight: 12,
  },
  hotelName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  staffGreeting: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  staffBold: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  newOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newOrderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 1,
  },
  statSep: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.chipBg,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  orderCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderNumberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  orderTimeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  placedByTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  placedByText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  phoneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  phoneTagText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  itemsContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  itemQuantity: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    width: 26,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textDark,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  itemsSummary: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  totalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  refreshBtnText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },
  lastUpdatedText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
});
