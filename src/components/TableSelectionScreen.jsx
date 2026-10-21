import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { fetchTables } from '../services/api';

/**
 * TableSelectionScreen
 *
 * Displays a grid of restaurant tables with live occupancy indicators.
 * - Green border  → Vacant
 * - Amber border  → Reserved
 * - Red badge     → Occupied / has active order
 *
 * Props:
 *   onSelectTable(table)  — called when waiter taps a table
 *   tableOrders           — map of { tableId: [{customer, cartItems}] } from parent state
 *   activeRestaurant      — restaurant object { id, name }
 *   isBackendConnected    — boolean
 */
export const DEFAULT_TABLES = Array.from({ length: 15 }, (_, i) => ({
  id: `tb_${i + 1}`,
  table_number: `TB ${i + 1}`,
  capacity: 4,
  status: 'Vacant',
}));

export default function TableSelectionScreen({
  onSelectTable,
  tableOrders = {},
  activeRestaurant,
  isBackendConnected,
  loggedInUser,
}) {
  const targetRestaurantId = activeRestaurant?.id || loggedInUser?.restaurant_id;
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(null);

  const loadTables = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchTables(targetRestaurantId);
      if (data && data.length > 0) {
        setTables(data);
        setLastFetchTime(new Date());
      } else {
        const fallbacks = DEFAULT_TABLES.map(t => ({ ...t, restaurant_id: targetRestaurantId }));
        setTables(fallbacks);
      }
    } catch (err) {
      console.warn('[TableSelectionScreen] Failed to load tables from backend, using default tables:', err);
      const fallbacks = DEFAULT_TABLES.map(t => ({ ...t, restaurant_id: targetRestaurantId }));
      setTables(fallbacks);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetRestaurantId]);

  useEffect(() => {
    loadTables();
    // Poll every 30 seconds to keep occupancy fresh
    const interval = setInterval(() => loadTables(true), 30_000);
    return () => clearInterval(interval);
  }, [loadTables, targetRestaurantId]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTables(true);
  };

  const getTableLiveOrderInfo = (tableId) => {
    const customers = tableOrders[tableId] || [];
    const allOrders = [];
    customers.forEach(c => {
      (c.activeOrders || []).forEach(o => allOrders.push(o));
    });

    if (allOrders.length === 0) return null;

    if (allOrders.some(o => (o.status || '').toUpperCase() === 'READY')) {
      return { status: 'READY', label: 'READY TO SERVE', color: '#15803D', bg: '#DCFCE7', border: '#22C55E' };
    }
    if (allOrders.some(o => (o.status || '').toUpperCase() === 'PREPARING')) {
      return { status: 'PREPARING', label: 'PREPARING', color: '#B45309', bg: '#FEF3C7', border: '#F59E0B' };
    }
    if (allOrders.some(o => (o.status || '').toUpperCase() === 'PENDING' || (o.status || '').toUpperCase() === 'NEW')) {
      return { status: 'PENDING', label: 'KOT SENT', color: '#C2410C', bg: '#FFEDD5', border: '#FB923C' };
    }
    if (allOrders.every(o => (o.status || '').toUpperCase() === 'SERVED' || (o.status || '').toUpperCase() === 'COMPLETED')) {
      return { status: 'SERVED', label: 'SERVED', color: '#475569', bg: '#F1F5F9', border: '#94A3B8' };
    }
    return { status: 'OCCUPIED', label: 'OCCUPIED', color: COLORS.accentRed, bg: '#FEE2E2', border: COLORS.accentRed };
  };

  // Merge backend status with local in-progress orders
  const getTableStatus = (table) => {
    const localCustomers = tableOrders[table.id];
    const hasLocalOrder = localCustomers && localCustomers.length > 0;
    const backendOccupied =
      table.status === 'Occupied' || table.current_order_id != null;
    if (hasLocalOrder || backendOccupied) return 'occupied';
    if (table.status === 'Reserved') return 'reserved';
    return 'vacant';
  };

  const getLocalCustomerCount = (tableId) => {
    const customers = tableOrders[tableId];
    return customers ? customers.length : 0;
  };

  const renderTable = ({ item: table }) => {
    const status = getTableStatus(table);
    const localCount = getLocalCustomerCount(table.id);
    const liveInfo = getTableLiveOrderInfo(table.id);
    const isOccupied = status === 'occupied';
    const isReserved = status === 'reserved';
    const isReady = liveInfo?.status === 'READY';

    return (
      <TouchableOpacity
        style={[
          styles.tableCard,
          isOccupied && styles.tableCardOccupied,
          isReserved && styles.tableCardReserved,
          isReady && styles.tableCardReady,
        ]}
        onPress={() => onSelectTable(table)}
        activeOpacity={0.75}
        accessibilityLabel={`Table ${table.table_number}, ${liveInfo ? liveInfo.label : status}`}
      >
        {/* Status indicator dot */}
        <View style={[
          styles.statusDot,
          liveInfo
            ? { backgroundColor: liveInfo.color }
            : isOccupied ? styles.dotOccupied : isReserved ? styles.dotReserved : styles.dotVacant,
        ]} />

        {/* Table icon */}
        <MaterialCommunityIcons
          name={isReady ? "bell-ring-outline" : liveInfo?.status === 'PREPARING' ? "chef-hat" : "table-chair"}
          size={28}
          color={liveInfo ? liveInfo.color : isOccupied ? COLORS.accentRed : isReserved ? '#F59E0B' : COLORS.accentGreen}
          style={styles.tableIcon}
        />

        {/* Table number */}
        <Text style={styles.tableNumber}>{table.table_number}</Text>

        {/* Capacity */}
        <Text style={styles.tableCapacity}>
          <Ionicons name="people-outline" size={10} color={COLORS.textMuted} />
          {' '}{table.capacity || 4}
        </Text>

        {/* Status label */}
        <View style={[
          styles.statusBadge,
          liveInfo
            ? { backgroundColor: liveInfo.bg, borderColor: liveInfo.border, borderWidth: 1 }
            : isOccupied ? styles.badgeOccupied : isReserved ? styles.badgeReserved : styles.badgeVacant,
        ]}>
          <Text style={[
            styles.statusBadgeText,
            liveInfo
              ? { color: liveInfo.color, fontWeight: '800' }
              : isOccupied ? styles.badgeTextOccupied : isReserved ? styles.badgeTextReserved : styles.badgeTextVacant,
          ]}>
            {liveInfo ? liveInfo.label : isOccupied ? 'OCCUPIED' : isReserved ? 'RESERVED' : 'VACANT'}
          </Text>
        </View>

        {/* Local customer count badge */}
        {localCount > 0 && (
          <View style={styles.customerCountBadge}>
            <Text style={styles.customerCountText}>{localCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const vacantCount = tables.filter(t => getTableStatus(t) === 'vacant').length;
  const occupiedCount = tables.filter(t => getTableStatus(t) === 'occupied').length;

  return (
    <View style={styles.container}>
      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{tables.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: COLORS.accentGreen }]}>{vacantCount}</Text>
          <Text style={styles.summaryLabel}>Vacant</Text>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: COLORS.accentRed }]}>{occupiedCount}</Text>
          <Text style={styles.summaryLabel}>Occupied</Text>
        </View>
      </View>

      {loading && tables.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading tables...</Text>
        </View>
      ) : (
        <FlatList
          data={tables}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTable}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
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
              <MaterialCommunityIcons name="table-off" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No tables found</Text>
              <Text style={styles.emptyDesc}>
                {isBackendConnected
                  ? 'No tables configured for this restaurant.'
                  : 'Backend is offline. Connect to see tables.'}
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => loadTables()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            lastFetchTime ? (
              <Text style={styles.lastFetchText}>
                Updated {lastFetchTime.toLocaleTimeString()}
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
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  summaryNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  summarySep: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  gridContent: {
    padding: 12,
    paddingBottom: 32,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  tableCard: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    minHeight: 120,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  tableCardOccupied: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
  },
  tableCardReserved: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  tableCardReady: {
    borderColor: '#22C55E',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  statusDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotVacant: { backgroundColor: COLORS.accentGreen },
  dotOccupied: { backgroundColor: COLORS.accentRed },
  dotReserved: { backgroundColor: '#F59E0B' },
  tableIcon: {
    marginTop: 6,
    marginBottom: 4,
  },
  tableNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
  },
  tableCapacity: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeVacant: { backgroundColor: '#D1FAE5' },
  badgeOccupied: { backgroundColor: '#FEE2E2' },
  badgeReserved: { backgroundColor: '#FEF3C7' },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeTextVacant: { color: '#065F46' },
  badgeTextOccupied: { color: '#991B1B' },
  badgeTextReserved: { color: '#92400E' },
  customerCountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerCountText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMedium,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  lastFetchText: {
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.textMuted,
    paddingBottom: 8,
    fontWeight: '500',
  },
});
