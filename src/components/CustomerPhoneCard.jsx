import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function CustomerPhoneCard({
  phoneNumber,
  setPhoneNumber,
  error,
  setError,
}) {
  const handleChange = (text) => {
    // Only allow numeric characters, max 10 digits
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
    setPhoneNumber(cleaned);
    if (error && cleaned.length === 10) {
      setError('');
    }
  };

  const handleClear = () => {
    setPhoneNumber('');
    setError('');
  };

  const isValid = phoneNumber && phoneNumber.length === 10;

  return (
    <View style={[styles.card, error ? styles.cardError : null]}>
      <View style={styles.titleRow}>
        <View style={styles.labelGroup}>
          <Ionicons 
            name="call-outline" 
            size={14} 
            color={error ? COLORS.accentRed : isValid ? COLORS.accentGreen : COLORS.primary} 
          />
          <Text style={styles.titleText}>Customer Phone Number</Text>
          <View style={styles.mandatoryBadge}>
            <Text style={styles.mandatoryText}>MANDATORY *</Text>
          </View>
        </View>

        {isValid && (
          <View style={styles.validBadge}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.accentGreen} />
            <Text style={styles.validText}>Verified</Text>
          </View>
        )}
      </View>

      <View style={[styles.inputContainer, error ? styles.inputError : null]}>
        <View style={styles.prefixBox}>
          <Text style={styles.prefixText}>+91</Text>
        </View>
        <TextInput
          style={styles.textInput}
          placeholder="Enter 10-digit mobile number"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={handleChange}
          maxLength={10}
        />
        {phoneNumber.length > 0 && (
          <TouchableOpacity 
            onPress={handleClear} 
            style={styles.clearBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={13} color={COLORS.accentRed} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <Text style={styles.helperText}>
          Required for digital bill generation, SMS receipt & kitchen order token
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardError: {
    borderColor: COLORS.accentRed,
    backgroundColor: '#FEF2F2',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  mandatoryBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mandatoryText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.accentRed,
    letterSpacing: 0.5,
  },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  validText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.accentGreen,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    height: 42,
    overflow: 'hidden',
  },
  inputError: {
    borderColor: COLORS.accentRed,
    backgroundColor: '#FFFFFF',
  },
  prefixBox: {
    paddingHorizontal: 12,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    backgroundColor: COLORS.chipBg,
  },
  prefixText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  textInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textDark,
  },
  clearBtn: {
    paddingRight: 10,
  },
  helperText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.accentRed,
    fontWeight: '600',
  },
});
