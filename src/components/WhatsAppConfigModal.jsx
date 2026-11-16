import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import {
  getWhatsAppConfig,
  saveWhatsAppConfig,
  openWhatsAppDirect,
  openTestNumberChat,
  sendWhatsAppTestTemplate,
  DEFAULT_PHONE_NUMBER_ID,
  DEFAULT_SENDER_NUMBER,
  DEFAULT_WABA_ID,
  DEFAULT_TEMPLATE_NAME,
} from '../services/whatsapp';
import { getActiveBaseUrl } from '../services/api';

export default function WhatsAppConfigModal({ visible, onClose, onConfigSaved }) {
  const [autoSend, setAutoSend] = useState(true);
  const [testPhone, setTestPhone] = useState('9360608877');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const loadCurrentConfig = async () => {
    const config = await getWhatsAppConfig();
    setAutoSend(config.autoSend !== false);
  };

  useEffect(() => {
    if (visible) {
      loadCurrentConfig();
      setTestResult(null);
    }
  }, [visible]);

  const handleSave = async () => {
    const saved = await saveWhatsAppConfig({
      autoSend,
    });

    if (saved) {
      Alert.alert('Settings Saved', 'WhatsApp configuration has been saved successfully.');
      if (onConfigSaved) onConfigSaved();
      onClose();
    } else {
      Alert.alert('Error', 'Failed to save WhatsApp configuration.');
    }
  };

  const handleSendTemplateTest = async () => {
    const cleanPhone = testPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number for test message.');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    const res = await sendWhatsAppTestTemplate(cleanPhone);

    setIsSendingTest(false);

    if (res && res.success) {
      const fullPdfUrl = res.pdf_url ? `${getActiveBaseUrl()}${res.pdf_url}` : null;
      setTestResult({
        success: true,
        message: `✅ Template "${DEFAULT_TEMPLATE_NAME}" with PDF invoice delivered! (Meta ID: ${res.message_id || 'Accepted'})`,
        pdfUrl: fullPdfUrl,
      });
      Alert.alert(
        'Invoice Delivered!',
        `Meta Template "${DEFAULT_TEMPLATE_NAME}" with attached Tax Invoice PDF delivered to +91 ${cleanPhone.slice(-10)}! Check your WhatsApp.`
      );
    } else {
      setTestResult({
        success: false,
        message: `❌ ${res?.error || 'Failed to send template'}`,
      });
    }
  };

  const handleTestDirectApp = async () => {
    const cleanPhone = testPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a 10-digit number to open in WhatsApp.');
      return;
    }

    try {
      await openWhatsAppDirect(
        cleanPhone,
        `🧾 *DATA UDIPI - DIRECT WHATSAPP TEST*\nTesting direct app billing delivery.`
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleOpenTestChat = async () => {
    await openTestNumberChat();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.waIconBadge}>
                <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.headerTitle}>WhatsApp Billing Settings</Text>
                <Text style={styles.headerSub}>Meta Utility Template & PDF Invoices</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textMedium} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Auto Send Toggle Banner */}
            <View style={styles.toggleCard}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.toggleTitle}>Auto-Send Bill on Settlement</Text>
                <Text style={styles.toggleSub}>
                  Automatically generate the PDF invoice and dispatch the Meta approved template with the attached PDF to customer&apos;s WhatsApp upon payment.
                </Text>
              </View>
              <Switch
                value={autoSend}
                onValueChange={setAutoSend}
                trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                thumbColor={autoSend ? '#15803D' : '#F1F5F9'}
              />
            </View>

            {/* Template & Security Badge */}
            <View style={styles.securityBox}>
              <View style={styles.securityRow}>
                <Ionicons name="shield-checkmark" size={18} color="#15803D" />
                <Text style={styles.securityTitle}>Secure Cloud Configuration</Text>
              </View>
              <Text style={styles.securityText}>
                • Template: <Text style={{ fontWeight: '700' }}>{DEFAULT_TEMPLATE_NAME}</Text> (Utility Category){'\n'}
                • Format: <Text style={{ fontWeight: '700' }}>DOCUMENT Header (PDF Invoice)</Text>{'\n'}
                • Sender: <Text style={{ fontWeight: '700' }}>{DEFAULT_SENDER_NUMBER}</Text> (ID: {DEFAULT_PHONE_NUMBER_ID}){'\n'}
                • Security: Meta tokens & keys are securely managed by backend environment variables (.env).
              </Text>
            </View>

            {/* Test Connection Box */}
            <View style={styles.testSection}>
              <Text style={styles.testSectionTitle}>TEST WHATSAPP TEMPLATE & PDF DELIVERY</Text>
              <Text style={styles.testSectionSub}>
                Send a real test invoice PDF attached to the approved template:
              </Text>

              <View style={styles.testInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor={COLORS.textMuted}
                  value={testPhone}
                  onChangeText={setTestPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={[styles.testBtn, isSendingTest && styles.testBtnDisabled]}
                  onPress={handleSendTemplateTest}
                  disabled={isSendingTest}
                  activeOpacity={0.8}
                >
                  {isSendingTest ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.testBtnText}>Send Test PDF</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Meta Sandbox 24h Window Helper */}
              <View style={styles.sandboxHelperBox}>
                <Ionicons name="information-circle" size={15} color="#0D9488" style={{ marginTop: 1 }} />
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.sandboxHelperTitle}>Meta 24-Hour Policy Notice</Text>
                  <Text style={styles.sandboxHelperText}>
                    If testing with Sandbox number ({DEFAULT_SENDER_NUMBER}), sending &quot;Hi&quot; opens the 24-hour delivery window.
                  </Text>
                  <TouchableOpacity
                    style={styles.activateWindowBtn}
                    onPress={handleOpenTestChat}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.activateWindowBtnText}>Send &quot;Hi&quot; to {DEFAULT_SENDER_NUMBER} (Opens WhatsApp)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.testActionsRow}>
                <TouchableOpacity
                  style={styles.directTestBtn}
                  onPress={handleTestDirectApp}
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-whatsapp" size={13} color="#15803D" style={{ marginRight: 4 }} />
                  <Text style={styles.directTestBtnText}>Test Direct App Opening</Text>
                </TouchableOpacity>
              </View>

              {testResult && (
                <View
                  style={[
                    styles.resultCard,
                    testResult.success ? styles.resultCardSuccess : styles.resultCardError,
                  ]}
                >
                  <Ionicons
                    name={testResult.success ? 'checkmark-circle' : 'alert-circle'}
                    size={16}
                    color={testResult.success ? '#15803D' : '#DC2626'}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.resultText,
                        testResult.success ? styles.resultTextSuccess : styles.resultTextError,
                      ]}
                    >
                      {testResult.message}
                    </Text>
                    {testResult.pdfUrl ? (
                      <TouchableOpacity
                        style={styles.viewTestPdfBtn}
                        onPress={() => Linking.openURL(testResult.pdfUrl)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="document-text-outline" size={13} color="#15803D" style={{ marginRight: 4 }} />
                        <Text style={styles.viewTestPdfBtnText}>View Generated PDF Invoice</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              )}
            </View>

            {/* Information Tips */}
            <View style={styles.tipsBox}>
              <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.tipsTitle}>Automated Delivery Resiliency</Text>
                <Text style={styles.tipsText}>
                  • The POS automatically generates the Tax Invoice PDF with items, totals, GST and brand styling.{'\n'}
                  • The PDF is uploaded to Meta and sent via the approved Utility Template ({DEFAULT_TEMPLATE_NAME}).{'\n'}
                  • Cashiers can always tap &quot;Send via WhatsApp App&quot; in the bill popup for 1-tap direct messaging.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>Save WhatsApp Configuration</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  waIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.textMedium,
  },
  closeBtn: {
    padding: 6,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  toggleSub: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
    lineHeight: 15,
  },
  securityBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  securityTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  securityText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  input: {
    backgroundColor: COLORS.bgLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.textDark,
  },
  testSection: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  testSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
    letterSpacing: 0.5,
  },
  testSectionSub: {
    fontSize: 11,
    color: COLORS.textMedium,
    marginTop: 2,
    marginBottom: 10,
  },
  testInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  testBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnDisabled: {
    opacity: 0.6,
  },
  testBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  sandboxHelperBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    flexDirection: 'row',
  },
  sandboxHelperTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
    marginBottom: 2,
  },
  sandboxHelperText: {
    fontSize: 10,
    color: '#115E59',
    lineHeight: 14,
    marginBottom: 6,
  },
  activateWindowBtn: {
    backgroundColor: '#0D9488',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  activateWindowBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  testActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  directTestBtn: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  directTestBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  resultCardSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  resultCardError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  resultText: {
    fontSize: 11,
    fontWeight: '600',
  },
  resultTextSuccess: {
    color: '#166534',
  },
  resultTextError: {
    color: '#991B1B',
  },
  viewTestPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  viewTestPdfBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  tipsBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    marginBottom: 2,
  },
  tipsText: {
    fontSize: 11,
    color: '#1E40AF',
    lineHeight: 16,
  },
  bottomActions: {
    marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
