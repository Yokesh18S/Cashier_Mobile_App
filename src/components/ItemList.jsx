import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function ItemList({
  items,
  onAddToCart,
  onUpdateQuantity,
  onRemoveItem,
  cartItems = {},
}) {
  const renderItem = ({ item }) => {
    const qtyInCart = cartItems[item.id]?.quantity || 0;

    return (
      <View style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <View style={styles.nameRow}>
            <View style={[styles.dietDot, item.isVeg ? styles.vegDot : styles.nonVegDot]} />
            <Text style={styles.itemName}>{item.name}</Text>
          </View>
          <Text style={styles.itemCode}>{item.code}</Text>
        </View>

        <View style={styles.priceActionCol}>
          <Text style={styles.itemPrice}>R.S. {item.price.toFixed(2)}</Text>
          {qtyInCart > 0 ? (
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepBtnMinus}
                onPress={() => onUpdateQuantity && onUpdateQuantity(item.id, qtyInCart - 1)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="remove" size={14} color="#FFFFFF" />
              </TouchableOpacity>

              <Text style={styles.qtyText}>{qtyInCart}</Text>

              <TouchableOpacity
                style={styles.stepBtnPlus}
                onPress={() => onAddToCart && onAddToCart(item)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="add" size={14} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.trashBtn}
                onPress={() => onRemoveItem ? onRemoveItem(item.id) : (onUpdateQuantity && onUpdateQuantity(item.id, 0))}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="trash-outline" size={15} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => onAddToCart(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={COLORS.textDark} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tableHeader}>
        <Text style={styles.tableHeaderText}>ITEM / CODE</Text>
        <Text style={styles.tableHeaderText}>PRICE</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.bgLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 160, // Space for bottom cart sheet
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dietDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  vegDot: {
    backgroundColor: '#16A34A',
  },
  nonVegDot: {
    backgroundColor: '#DC2626',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  itemCode: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  priceActionCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBg,
  },
  addButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepBtnMinus: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPlus: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
    minWidth: 18,
    textAlign: 'center',
  },
  trashBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  qtyBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});
