import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CATEGORIES } from '../data/mockData';
import { COLORS } from '../constants/theme';

export default function CategoryChips({ 
  categories = CATEGORIES, 
  selectedCategory, 
  onSelectCategory 
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.container}
    >
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat;
        return (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, isSelected && styles.chipActive]}
            onPress={() => onSelectCategory(cat)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 46,
    marginVertical: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.chipActive,
    borderColor: COLORS.chipActive,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
