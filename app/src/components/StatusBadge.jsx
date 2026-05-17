import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, StatusColors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Strings } from '../constants/strings';
import { Layout, Spacing } from '../constants/spacing';

/**
 * Pill-shaped status badge with color-coded background.
 * Uses StatusColors map from colors.js for consistent theming.
 */
export default function StatusBadge({ status, style }) {
  const colors = StatusColors[status] || { bg: '#F0F0F0', text: '#6B6B6B' };
  const label = Strings.statusLabels[status] || status;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Layout.borderRadius.sm,
    paddingHorizontal: Spacing.sm + 4,   // 12px
    paddingVertical: Spacing.xs + 2,      // 6px
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
});
