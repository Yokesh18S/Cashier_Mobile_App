import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { COLORS } from '../constants/theme';

export default function CodeAddBar({ onAddByCode }) {
  const [code, setCode] = useState('');

  const handleAdd = () => {
    if (!code.trim()) return;
    const success = onAddByCode(code.trim().toUpperCase());
    if (success) {
      setCode('');
    } else {
      Alert.alert('Code Not Found', `No item found matching code "${code.trim()}". Try item codes like 301, 321, 28, etc.`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Enter item code (e.g. 301, 28)"
          placeholderTextColor={COLORS.textMuted}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
      </View>

      <TouchableOpacity 
        style={styles.addButton} 
        onPress={handleAdd}
        activeOpacity={0.8}
      >
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    height: 42,
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  input: {
    fontSize: 13,
    color: COLORS.textDark,
  },
  addButton: {
    height: 42,
    paddingHorizontal: 22,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
