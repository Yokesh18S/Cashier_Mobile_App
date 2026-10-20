import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { loginCashier, loginWaiter, registerWaiter, getActiveBaseUrl } from '../services/api';

/**
 * LoginScreen
 *
 * Supports both:
 * 1. Waiter Authentication (Phone + Password, Self-Registration, Approval Pending notification)
 * 2. Cashier Authentication (Email + Password) — fully backward compatible.
 *
 * Props:
 *   onLoginSuccess(token, user) — called after successful login
 *   isBackendConnected          — show server status pill
 *   backendUrl                  — shown in sub-label
 */
export default function LoginScreen({ onLoginSuccess, isBackendConnected, backendUrl }) {
  // Role tab: 'waiter' | 'cashier'
  const [roleTab, setRoleTab] = useState('waiter');
  // Waiter mode: 'login' | 'register'
  const [waiterMode, setWaiterMode] = useState('login');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingApprovalMsg, setPendingApprovalMsg] = useState('');
  const [registrationSuccessMsg, setRegistrationSuccessMsg] = useState('');

  const clearMessages = () => {
    setError('');
    setPendingApprovalMsg('');
    setRegistrationSuccessMsg('');
  };

  const handleRoleChange = (newRole) => {
    setRoleTab(newRole);
    clearMessages();
  };

  const handleWaiterModeChange = (newMode) => {
    setWaiterMode(newMode);
    clearMessages();
  };

  // ── CASHIER LOGIN ──────────────────────────────────────────────────────────
  const handleCashierLogin = async () => {
    const emailClean = email.trim().toLowerCase();
    if (!emailClean) { setError('Please enter your email address'); return; }
    if (!password)   { setError('Please enter your password');      return; }

    clearMessages();
    setLoading(true);

    try {
      const result = await loginCashier(emailClean, password);
      if (result.success) {
        onLoginSuccess(result.token, result.user);
      } else {
        setError(result.error || 'Login failed. Please check your credentials.');
      }
    } catch {
      setError('Unable to reach backend. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // ── WAITER LOGIN ───────────────────────────────────────────────────────────
  const handleWaiterLogin = async () => {
    const rawDigits = phone.replace(/\D/g, '');
    const cleanPhone = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;

    if (!cleanPhone || cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      const result = await loginWaiter(cleanPhone, password);
      if (result.success) {
        onLoginSuccess(result.token, result.user);
      } else if (result.isPendingApproval) {
        setPendingApprovalMsg(
          result.error ||
          'Account pending approval. An admin needs to assign you to a hotel before you can log in.'
        );
      } else {
        setError(result.error || 'Invalid phone number or password.');
      }
    } catch {
      setError('Unable to reach backend. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // ── WAITER REGISTRATION ───────────────────────────────────────────────────
  const handleWaiterRegister = async () => {
    const nameClean = name.trim();
    const rawDigits = phone.replace(/\D/g, '');
    const cleanPhone = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;

    if (!nameClean || nameClean.length < 2) {
      setError('Please enter your full name');
      return;
    }
    if (!cleanPhone || cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      const result = await registerWaiter(nameClean, cleanPhone, password, confirmPassword);
      if (result.success) {
        setRegistrationSuccessMsg(
          result.message ||
          'Registration submitted successfully! Your account is pending admin approval and hotel assignment.'
        );
        // Reset sensitive inputs and switch to login tab
        setPassword('');
        setConfirmPassword('');
        setWaiterMode('login');
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch {
      setError('Unable to reach backend. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoCircle}>
            <MaterialCommunityIcons
              name={roleTab === 'waiter' ? 'room-service-outline' : 'cash-register'}
              size={36}
              color="#FFFFFF"
            />
          </View>
          <Text style={styles.brandName}>Data Udipi</Text>
          <Text style={styles.brandSub}>
            {roleTab === 'waiter' ? 'Staff & Waiter Portal' : 'Cashier POS · Terminal 01'}
          </Text>

          {/* Backend connection status pill */}
          <View style={[styles.statusPill, isBackendConnected ? styles.pillOnline : styles.pillOffline]}>
            <View style={[styles.pillDot, isBackendConnected ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.pillText}>
              {isBackendConnected
                ? `Live · ${(backendUrl || getActiveBaseUrl()).replace(/^https?:\/\//, '')}`
                : 'Offline Mode'}
            </Text>
          </View>
        </View>

        {/* Main Card */}
        <View style={styles.card}>
          {/* Top Role Selector Tabs: Waiter vs Cashier */}
          <View style={styles.roleTabsContainer}>
            <TouchableOpacity
              style={[styles.roleTab, roleTab === 'waiter' && styles.roleTabActive]}
              onPress={() => handleRoleChange('waiter')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="room-service-outline"
                size={18}
                color={roleTab === 'waiter' ? COLORS.primary : COLORS.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.roleTabText, roleTab === 'waiter' && styles.roleTabTextActive]}>
                Waiter
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleTab, roleTab === 'cashier' && styles.roleTabActive]}
              onPress={() => handleRoleChange('cashier')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="cash-register"
                size={18}
                color={roleTab === 'cashier' ? COLORS.primary : COLORS.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.roleTabText, roleTab === 'cashier' && styles.roleTabTextActive]}>
                Cashier
              </Text>
            </TouchableOpacity>
          </View>

          {/* If Waiter selected: Sub-toggle for Sign In vs Register */}
          {roleTab === 'waiter' && (
            <View style={styles.subModeContainer}>
              <TouchableOpacity
                style={[styles.subModeBtn, waiterMode === 'login' && styles.subModeBtnActive]}
                onPress={() => handleWaiterModeChange('login')}
                activeOpacity={0.75}
              >
                <Text style={[styles.subModeText, waiterMode === 'login' && styles.subModeTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subModeBtn, waiterMode === 'register' && styles.subModeBtnActive]}
                onPress={() => handleWaiterModeChange('register')}
                activeOpacity={0.75}
              >
                <Text style={[styles.subModeText, waiterMode === 'register' && styles.subModeTextActive]}>
                  New Waiter Registration
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Card Headers */}
          <Text style={styles.cardTitle}>
            {roleTab === 'cashier'
              ? 'Cashier Sign In'
              : waiterMode === 'register'
              ? 'Create Waiter Profile'
              : 'Waiter Sign In'}
          </Text>
          <Text style={styles.cardSub}>
            {roleTab === 'cashier'
              ? 'Enter your cashier email credentials to continue'
              : waiterMode === 'register'
              ? 'Register with your phone number. Your account will be verified by hotel admin.'
              : 'Enter your registered phone number & password'}
          </Text>

          {/* Pending Approval Banner */}
          {pendingApprovalMsg ? (
            <View style={styles.pendingBanner}>
              <Ionicons name="time-outline" size={20} color="#B45309" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>Approval Pending</Text>
                <Text style={styles.pendingDesc}>{pendingApprovalMsg}</Text>
              </View>
            </View>
          ) : null}

          {/* Registration Success Banner */}
          {registrationSuccessMsg ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#15803D" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>Profile Created!</Text>
                <Text style={styles.successDesc}>{registrationSuccessMsg}</Text>
              </View>
            </View>
          ) : null}

          {/* ── FORM FIELDS ── */}

          {/* Waiter Register: Full Name */}
          {roleTab === 'waiter' && waiterMode === 'register' && (
            <>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  value={name}
                  onChangeText={(t) => { setName(t); clearMessages(); }}
                  returnKeyType="next"
                />
              </View>
            </>
          )}

          {/* Waiter (Login or Register): Phone Number */}
          {roleTab === 'waiter' && (
            <>
              <Text style={styles.fieldLabel}>MOBILE PHONE NUMBER</Text>
              <View style={styles.inputRow}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="98765 43210"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(t) => { setPhone(t); clearMessages(); }}
                  returnKeyType="next"
                />
              </View>
            </>
          )}

          {/* Cashier: Email */}
          {roleTab === 'cashier' && (
            <>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="manager1@dataudipi.com"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={(t) => { setEmail(t); clearMessages(); }}
                  returnKeyType="next"
                />
              </View>
            </>
          )}

          {/* Password */}
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(t) => { setPassword(t); clearMessages(); }}
              returnKeyType={roleTab === 'waiter' && waiterMode === 'register' ? 'next' : 'done'}
              onSubmitEditing={() => {
                if (roleTab === 'cashier') handleCashierLogin();
                else if (waiterMode === 'login') handleWaiterLogin();
              }}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(v => !v)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password (only for waiter register) */}
          {roleTab === 'waiter' && waiterMode === 'register' && (
            <>
              <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
              <View style={styles.inputRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); clearMessages(); }}
                  returnKeyType="done"
                  onSubmitEditing={handleWaiterRegister}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(v => !v)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Error message */}
          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.accentRed} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={() => {
              if (roleTab === 'cashier') handleCashierLogin();
              else if (waiterMode === 'register') handleWaiterRegister();
              else handleWaiterLogin();
            }}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons
                  name={
                    roleTab === 'waiter' && waiterMode === 'register'
                      ? 'person-add-outline'
                      : 'log-in-outline'
                  }
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.loginBtnText}>
                  {roleTab === 'cashier'
                    ? 'Sign In as Cashier'
                    : waiterMode === 'register'
                    ? 'Submit Registration'
                    : 'Sign In as Waiter'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Bottom helper card */}
          <View style={styles.infoFooter}>
            <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.textMuted} style={{ marginTop: 1 }} />
            <Text style={styles.infoText}>
              {roleTab === 'waiter'
                ? 'Waiters must be assigned to MGR Nagar or Mugalivakkam by hotel management before accessing orders.'
                : 'Cashier accounts are managed by hotel administration. Each cashier is bound to their hotel branch.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textDark,
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 3,
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillOnline: { backgroundColor: '#D1FAE5' },
  pillOffline: { backgroundColor: '#FEF3C7' },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOnline: { backgroundColor: COLORS.accentGreen },
  dotOffline: { backgroundColor: '#F59E0B' },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  roleTabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  roleTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  roleTabTextActive: {
    color: COLORS.textDark,
    fontWeight: '800',
  },
  subModeContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 16,
  },
  subModeBtn: {
    paddingVertical: 8,
    marginRight: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subModeBtnActive: {
    borderBottomColor: COLORS.primary,
  },
  subModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  subModeTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 18,
    fontWeight: '500',
    lineHeight: 17,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  pendingTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  pendingDesc: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 2,
  },
  successDesc: {
    fontSize: 12,
    color: '#14532D',
    lineHeight: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: COLORS.cardBg,
    marginBottom: 14,
  },
  countryCodeBadge: {
    paddingRight: 8,
    marginRight: 8,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textDark,
    fontWeight: '600',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 12,
    color: COLORS.accentRed,
    fontWeight: '600',
    flex: 1,
  },
  loginBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  loginBtnDisabled: {
    opacity: 0.65,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.chipBg,
    borderRadius: 8,
    padding: 10,
  },
  infoText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
});
