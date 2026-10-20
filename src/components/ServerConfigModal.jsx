import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import {
  BACKEND_ENDPOINTS,
  getActiveBaseUrl,
  setActiveBaseUrl,
  getActiveRestaurantId,
  setActiveRestaurantId,
  checkBackendHealth,
} from '../services/api';

export default function ServerConfigModal({
  visible,
  onClose,
  isBackendConnected,
  activeRestaurant,
  onConfigUpdated,
}) {
  const [currentUrl, setCurrentUrl] = useState(getActiveBaseUrl());
  const [customUrl, setCustomUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleSelectEndpoint = (url) => {
    setCurrentUrl(url);
    setActiveBaseUrl(url);
  };

  const handleTestAndSave = async () => {
    const targetUrl = (customUrl.trim() || currentUrl).replace(/\/$/, '');
    setActiveBaseUrl(targetUrl);
    setIsTesting(true);
    setStatusMessage('Checking backend health...');

    try {
      const health = await checkBackendHealth();
      setIsTesting(false);
      if (health.connected) {
        setStatusMessage(`Connected! Restaurant: ${health.activeRestaurant?.name || 'Data Udipi'}`);
        Alert.alert('Connection Success', `Successfully reached backend at ${health.url}`);
        if (onConfigUpdated) {
          onConfigUpdated(health);
        }
        onClose();
      } else {
        setStatusMessage('Could not connect. Please check port 8001 or network.');
        Alert.alert('Connection Failed', 'Could not reach backend on this URL. Ensure backend is running.');
      }
    } catch (err) {
      setIsTesting(false);
      setStatusMessage('Error connecting: ' + err.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="server-outline" size={20} color={COLORS.primary} />
              <Text style={styles.headerTitle}>Backend Server Configuration</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textMedium} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.statusBox}>
              <View style={[styles.statusDot, isBackendConnected ? styles.dotGreen : styles.dotOrange]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>
                  {isBackendConnected ? 'Connected to Food Ordering Backend' : 'Offline / Standalone Mode'}
                </Text>
                <Text style={styles.statusSub}>
                  Active URL: {getActiveBaseUrl()}
                </Text>
                {activeRestaurant ? (
                  <Text style={styles.statusRest}>
                    Outlet: {activeRestaurant.name} (ID: {getActiveRestaurantId()})
                  </Text>
                ) : null}
              </View>
            </View>

            <Text style={styles.sectionLabel}>PRESET ENDPOINTS</Text>
            <View style={styles.presetsList}>
              {BACKEND_ENDPOINTS.map((ep) => {
                const isSelected = currentUrl === ep.url;
                return (
                  <TouchableOpacity
                    key={ep.url}
                    style={[styles.presetItem, isSelected && styles.presetItemActive]}
                    onPress={() => handleSelectEndpoint(ep.url)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.presetTextCol}>
                      <Text style={[styles.presetLabel, isSelected && styles.presetLabelActive]}>
                        {ep.label}
                      </Text>
                      <Text style={styles.presetUrl}>{ep.url}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>CUSTOM BACKEND URL</Text>
            <TextInput
              style={styles.urlInput}
              placeholder="http://192.168.1.XX:8001"
              placeholderTextColor={COLORS.textMuted}
              value={customUrl}
              onChangeText={setCustomUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {statusMessage ? (
              <Text style={styles.statusFeedback}>{statusMessage}</Text>
            ) : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.testBtn}
                onPress={handleTestAndSave}
                disabled={isTesting}
                activeOpacity={0.8}
              >
                {isTesting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.testBtnText}>Test & Connect</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.chipBg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: '#10B981',
  },
  dotOrange: {
    backgroundColor: '#F59E0B',
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  statusSub: {
    fontSize: 11,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  statusRest: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetsList: {
    gap: 8,
    marginBottom: 14,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  presetItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F1F5F9',
  },
  presetTextCol: {
    flex: 1,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  presetLabelActive: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  presetUrl: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  urlInput: {
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: COLORS.textDark,
    backgroundColor: COLORS.cardBg,
    marginBottom: 10,
  },
  statusFeedback: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  actionsRow: {
    marginTop: 6,
  },
  testBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
