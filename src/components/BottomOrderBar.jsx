import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function BottomOrderBar({
  cartItems,
  onChargePress,
  onViewOrderPress,
}) {
  const lineCount = Object.keys(cartItems).length;
  const itemCount = Object.values(cartItems).reduce((sum, item) => sum + item.quantity, 0);
  
  const total = Object.values(cartItems).reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const hasItems = itemCount > 0;

  return (
    <View style={styles.card}>
      <TouchableOpacity 
        style={styles.headerRow}
        onPress={onViewOrderPress}
        activeOpacity={0.7}
      >
        <Text style={styles.headerTitle}>Current order</Text>
        <Text style={styles.headerSub}>
          {lineCount} lines · {itemCount} items
        </Text>
      </TouchableOpacity>

      {!hasItems ? (
        <View style={styles.emptyHintRow}>
          <MaterialCommunityIcons name="barcode-scan" size={24} color={COLORS.textMuted} />
          <Text style={styles.emptyHintText}>
            Scan a code or tap items to start an order.
          </Text>
        </View>
      ) : (
        <TouchableOpacity onPress={onViewOrderPress} style={styles.itemsPreviewRow}>
          <Text style={styles.itemsPreviewText}>
            {Object.values(cartItems).slice(0, 2).map(i => `${i.name} (x${i.quantity})`).join(', ')}
            {lineCount > 2 ? ` +${lineCount - 2} more` : ''}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
      </View>

      <TouchableOpacity
        style={[styles.chargeButton, !hasItems && styles.chargeButtonDisabled]}
        onPress={onChargePress}
        disabled={!hasItems}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="chef-hat" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.chargeButtonText}>
          Send to Kitchen (KOT) · ₹{total.toFixed(2)}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  emptyHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  emptyHintText: {
    fontSize: 11,
    color: COLORS.textMuted,
    flex: 1,
  },
  itemsPreviewRow: {
    paddingVertical: 6,
  },
  itemsPreviewText: {
    fontSize: 11,
    color: COLORS.textMedium,
    fontStyle: 'italic',
  },
  calcSection: {
    paddingVertical: 4,
    gap: 2,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  calcLabel: {
    fontSize: 11,
    color: COLORS.textMedium,
  },
  calcValue: {
    fontSize: 11,
    color: COLORS.textMedium,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 10,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  chargeButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chargeButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  chargeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
