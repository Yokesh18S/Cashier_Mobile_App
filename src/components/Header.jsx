import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function Header({ 
  terminalName = 'Counter – Cashier · Terminal 01', 
  sessionCode = 'POS-4402', 
  itemCount = 0,
  isBackendConnected = false,
  backendUrl = '',
  onLogout,
  onPressStatus,
  currentView,
  onChangeView,
}) {
  const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY

  const handleLogoutPress = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            if (onLogout) onLogout();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.avatarBox}>
          <Ionicons name="storefront" size={18} color={COLORS.primary} />
        </View>

        <View style={styles.infoCol}>
          <View style={styles.terminalRow}>
            <Text style={styles.terminalText} numberOfLines={1}>
              {terminalName}
            </Text>
          </View>
          <View style={styles.statusAndSessionRow}>
            <Text style={styles.sessionText}>
              Session: <Text style={styles.sessionBold}>{sessionCode}</Text>
            </Text>
            <TouchableOpacity 
              style={styles.connectionBadge} 
              onPress={onPressStatus}
              activeOpacity={0.7}
            >
              <View style={[styles.statusDot, isBackendConnected ? styles.dotOnline : styles.dotOffline]} />
              <Text style={styles.connectionText}>
                {isBackendConnected ? 'Live' : 'Offline'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {onLogout ? (
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogoutPress}
            activeOpacity={0.7}
            accessibilityLabel="Sign Out"
          >
            <Ionicons name="log-out-outline" size={19} color={COLORS.accentRed} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Navigation switcher between Tables and Live Orders */}
      {onChangeView ? (
        <View style={styles.navToggleRow}>
          <TouchableOpacity
            style={[styles.navTab, currentView === 'tables' && styles.navTabActive]}
            onPress={() => onChangeView('tables')}
            activeOpacity={0.75}
          >
            <Ionicons
              name="grid-outline"
              size={13}
              color={currentView === 'tables' ? COLORS.primary : COLORS.textMuted}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.navTabText, currentView === 'tables' && styles.navTabTextActive]}>
              Tables
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, currentView === 'live_orders' && styles.navTabActive]}
            onPress={() => onChangeView('live_orders')}
            activeOpacity={0.75}
          >
            <Ionicons
              name="time-outline"
              size={13}
              color={currentView === 'live_orders' ? COLORS.primary : COLORS.textMuted}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.navTabText, currentView === 'live_orders' && styles.navTabTextActive]}>
              Live Orders
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {today} · Cart: {itemCount} items
        </Text>
        {backendUrl ? (
          <TouchableOpacity onPress={onPressStatus} activeOpacity={0.7}>
            <Text style={styles.backendUrlText} numberOfLines={1}>
              {backendUrl.replace(/^https?:\/\//, '')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoCol: {
    flex: 1,
  },
  terminalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  terminalText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
    letterSpacing: -0.2,
  },
  statusAndSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  sessionText: {
    fontSize: 11,
    color: COLORS.textMedium,
  },
  sessionBold: {
    fontWeight: '600',
    color: COLORS.textDark,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOnline: {
    backgroundColor: '#10B981',
  },
  dotOffline: {
    backgroundColor: '#F59E0B',
  },
  connectionText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: COLORS.textMedium,
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  navToggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.chipBg,
    borderRadius: 8,
    padding: 3,
    marginTop: 8,
  },
  navTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
  },
  navTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  navTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  navTabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  backendUrlText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
