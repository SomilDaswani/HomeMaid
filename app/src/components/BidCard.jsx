import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';

/**
 * BidCard — animates in with slide-up + fade spring on mount.
 * selected: shows green overlay + checkmark
 * faded: dims to 50% opacity (other cards when one is selected)
 */
export default function BidCard({ bid, selected, faded, onSelect, index = 0 }) {
  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  // Slide-up + fade entrance, staggered by index
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        delay: index * 80,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        delay: index * 80,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Fade out non-selected cards to 50%
  useEffect(() => {
    Animated.timing(cardOpacity, {
      toValue: faded ? 0.5 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [faded]);

  const maid = bid.maids || bid.maid || {};
  const stars = maid.avg_rating ? '⭐'.repeat(Math.round(maid.avg_rating)) : '';

  return (
    <Animated.View style={[
      styles.wrapper,
      { transform: [{ translateY }], opacity: Animated.multiply(opacity, cardOpacity) },
    ]}>
      <TouchableOpacity
        style={[styles.card, selected && styles.cardSelected]}
        onPress={() => !selected && onSelect(bid)}
        activeOpacity={0.88}
      >
        {/* Left: maid info */}
        <View style={styles.left}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>🧹</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{maid.name || 'Maid'}</Text>
            <Text style={styles.meta}>
              {maid.avg_rating ? `${maid.avg_rating.toFixed(1)} ★` : ''}{maid.avg_rating && maid.area_label ? '  ·  ' : ''}{maid.area_label || ''}
            </Text>
            <View style={styles.skillBadge}>
              <Text style={styles.skillText}>{maid.skill_level || 'basic'}</Text>
            </View>
          </View>
        </View>

        {/* Right: price + select */}
        <View style={styles.right}>
          <Text style={styles.price}>Rs. {bid.offered_price?.toLocaleString()}</Text>
          {selected ? (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedText}>✓ Selected</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.selectBtn} onPress={() => onSelect(bid)} activeOpacity={0.85}>
              <Text style={styles.selectBtnText}>Select</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Selected overlay */}
        {selected && <View style={styles.selectedOverlay} pointerEvents="none" />}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...CardShadow,
  },
  cardSelected: {
    borderColor: Colors.success,
    borderWidth: 2,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  avatarText: {
    fontSize: 24,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  meta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  skillBadge: {
    marginTop: 4,
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  skillText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.primary,
    textTransform: 'capitalize',
  },
  right: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  price: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  selectBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Layout.borderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  selectBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.surface,
  },
  selectedBadge: {
    backgroundColor: Colors.success,
    borderRadius: Layout.borderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  selectedText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.surface,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Layout.borderRadius.lg,
    backgroundColor: `${Colors.success}12`,
  },
});
