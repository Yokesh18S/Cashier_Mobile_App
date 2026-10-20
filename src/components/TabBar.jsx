import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/theme';

export default function TabBar({ activeTab, setActiveTab, cartItemCount = 0 }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'items' && styles.activeTab]}
        onPress={() => setActiveTab('items')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, activeTab === 'items' && styles.activeTabText]}>
          Items
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'order' && styles.activeTab]}
        onPress={() => setActiveTab('order')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, activeTab === 'order' && styles.activeTabText]}>
          Current order ({cartItemCount})
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  activeTabText: {
    color: COLORS.textDark,
    fontWeight: '700',
  },
});
