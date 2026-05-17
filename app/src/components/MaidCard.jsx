import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import StatusBadge from './StatusBadge';

/**
 * Reusable maid card — used in match lists, bid lists, and profile previews.
 */
export default function MaidCard({ maid, onPress, showStatus = false, rightContent }) {
  const distanceText = maid.distance_km != null
    ? `${maid.distance_km.toFixed(1)} km`
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.card}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarInitial}>
          {maid.name ? maid.name[0].toUpperCase() : '?'}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{maid.name}</Text>
          {showStatus && maid.status && (
            <StatusBadge status={maid.status} />
          )}
        </View>

        {/* Skill badge + area */}
        <View style={styles.metaRow}>
          <View style={styles.skillBadge}>
            <Text style={styles.skillText}>{maid.skill_level}</Text>
          </View>
          {maid.area_label && (
            <Text style={styles.area} numberOfLines={1}>{maid.area_label}</Text>
          )}
        </View>

        {/* Rating + distance */}
        <View style={styles.bottomRow}>
          <View style={styles.ratingRow}>
            <Text style={styles.star}>★</Text>
            <Text style={styles.rating}>
              {maid.avg_rating ? maid.avg_rating.toFixed(1) : 'New'}
            </Text>
            {maid.total_reviews > 0 && (
              <Text style={styles.reviewCount}>({maid.total_reviews})</Text>
            )}
          </View>
          {distanceText && (
            <Text style={styles.distance}>{distanceText}</Text>
          )}
        </View>
      </View>

      {/* Right slot — price, select button, etc. */}
      {rightContent && (
        <View style={styles.rightSlot}>{rightContent}</View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    ...CardShadow,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.surface,
  },
  info: {
    flex: 1,
    gap: Spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  skillBadge: {
    backgroundColor: Colors.background,
    borderRadius: Layout.borderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  skillText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
    textTransform: 'capitalize',
  },
  area: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  star: {
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
  rating: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  reviewCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  distance: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  rightSlot: {
    marginLeft: Spacing.sm,
    alignItems: 'flex-end',
  },
});
