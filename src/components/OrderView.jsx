import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function OrderView({
  cartItems,
  onUpdateQuantity,
  onClearOrder,
  onChargePress,
}) {
  const itemsList = Object.values(cartItems);
  const lineCount = itemsList.length;
  const itemCount = itemsList.reduce((sum, item) => sum + item.quantity, 0);

  const total = itemsList.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const subtotal = total;

  const handleClearWithConfirm = () => {
    if (itemsList.length === 0) return;
    Alert.alert(
      'Clear Order',
      'Are you sure you want to remove all items from the current order?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: onClearOrder },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Current order</Text>
          <Text style={styles.headerSub}>
            {lineCount} lines · {itemCount} items
          </Text>
        </View>

        {lineCount > 0 && (
          <TouchableOpacity onPress={handleClearWithConfirm} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.itemsScroll} 
        contentContainerStyle={styles.itemsContent}
        showsVerticalScrollIndicator={false}
      >
        {lineCount === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptyDesc}>
              Tap items from the Items tab or enter codes above to add items.
            </Text>
          </View>
        ) : (
          itemsList.map((item) => {
            const itemTotal = item.price * item.quantity;

            return (
              <View key={item.id} style={styles.orderItemCard}>
                <View style={styles.itemTopRow}>
                  <View style={styles.itemTitleCol}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCode}>{item.code}</Text>
                  </View>
                  <Text style={styles.unitPrice}>R.S.{item.price.toFixed(2)}</Text>
                </View>

                <View style={styles.stepperRow}>
                  <View style={styles.stepperControls}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={16} color={COLORS.textDark} />
                    </TouchableOpacity>

                    <Text style={styles.quantityText}>{item.quantity}</Text>

                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color={COLORS.textDark} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.trashBtn}
                      onPress={() => onUpdateQuantity(item.id, 0)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.itemTotalText}>
                    Total: R.S.{itemTotal.toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {lineCount > 0 && (
        <View style={styles.footerContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={styles.chargeButton}
            onPress={onChargePress}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="chef-hat" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.chargeButtonText}>
              Send to Kitchen (KOT) · ₹{total.toFixed(2)}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  itemsScroll: {
    flex: 1,
  },
  itemsContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  orderItemCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitleCol: {
    flex: 1,
    paddingRight: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  itemCode: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  unitPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBg,
  },
  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
    minWidth: 18,
    textAlign: 'center',
  },
  itemTotalText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  footerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  calcLabel: {
    fontSize: 12,
    color: COLORS.textMedium,
  },
  calcValue: {
    fontSize: 12,
    color: COLORS.textMedium,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  chargeButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chargeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
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
});
