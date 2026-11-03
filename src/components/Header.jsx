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
