import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, SafeAreaView, StatusBar, ScrollView,
} from 'react-native';
import { Colors, StatusColors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { Strings } from '../constants/strings';
import { updateQuickServiceStatus } from '../services/api';

// ── Safe haptics helper ──────────────────────────────────────────────────────
// expo-haptics is optional — if not installed, we silently no-op.
const haptics = (() => {
  try {
    // eslint-disable-next-line
    return require('expo-haptics');
  } catch {
    return {
      notificationAsync: () => {},
      impactAsync:       () => {},
      NotificationFeedbackType: { Success: 'success' },
      ImpactFeedbackStyle:      { Medium: 'medium' },
    };
  }
})();

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_STEPS = [
  {
    key:   'bid_selected',
    icon:  '✅',
    label: 'Maid chuni gayi',
    color: Colors.success,
    next:  'confirmed',
  },
  {
    key:   'confirmed',
    icon:  '🎉',
    label: Strings.bookingStatus.confirmed,
    color: Colors.success,
    next:  'en_route',
  },
  {
    key:   'en_route',
    icon:  '🚶‍♀️',
    label: Strings.bookingStatus.enRoute,
    color: Colors.info,
    next:  'in_progress',
  },
  {
    key:   'in_progress',
    icon:  '🧹',
    label: Strings.bookingStatus.inProgress,
    color: Colors.warning,
    next:  'completed',
  },
  {
    key:   'completed',
    icon:  '⭐',
    label: Strings.bookingStatus.completed,
    color: Colors.success,
    next:  null,
  },
];

function getStep(key) {
  return STATUS_STEPS.find(s => s.key === key) || STATUS_STEPS[0];
}

// ── Animated status icon ─────────────────────────────────────────────────────
function StatusIcon({ icon, color }) {
  const scale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue:  1,
      tension:  70,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [icon]);

  return (
    <Animated.View style={[styles.iconWrap, { borderColor: color, transform: [{ scale }] }]}>
      <Text style={styles.iconText}>{icon}</Text>
    </Animated.View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function BookingStatusScreen({ navigation, route }) {
  const {
    requestId,
    maid   = {},
    price  = 0,
    type   = 'quick_service',
  } = route.params || {};

  const [status, setStatus] = useState('bid_selected');
  const [advancing, setAdvancing] = useState(false);
  const confirmedRef = useRef(false);

  const step = getStep(status);

  // ── Auto-confirm after 15s ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!confirmedRef.current) {
        advanceStatus('confirmed', true);
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, []);




  // ── Advance status ────────────────────────────────────────────────────────
  const advanceStatus = useCallback(async (nextStatus, isAuto = false) => {
    if (advancing) return;
    setAdvancing(true);

    // Haptic feedback
    if (nextStatus === 'confirmed') {
      haptics.notificationAsync(haptics.NotificationFeedbackType.Success);
      confirmedRef.current = true;
    } else {
      haptics.impactAsync(haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      if (requestId && type === 'quick_service') {
        await updateQuickServiceStatus(requestId, nextStatus);
      }
    } catch {
      // Silently ignore — UI advances regardless for demo
    }

    setStatus(nextStatus);
    setAdvancing(false);
  }, [advancing, requestId, type]);

  // ── Navigate to review ────────────────────────────────────────────────────
  const goToReview = () => {
    navigation.replace('Review', { requestId, maid, type });
  };

  const isCompleted = status === 'completed';

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Status icon ── */}
        <StatusIcon icon={step.icon} color={step.color} />

        {/* ── Status label ── */}
        <Text style={[styles.statusLabel, { color: step.color }]}>{step.label}</Text>

        {/* ── Maid info card ── */}
        <View style={styles.maidCard}>
          <View style={styles.maidAvatar}>
            <Text style={styles.maidAvatarText}>🧹</Text>
          </View>
          <View style={styles.maidInfo}>
            <Text style={styles.maidName}>{maid?.name || 'Aapki Maid'}</Text>
            <Text style={styles.maidMeta}>
              {maid?.area_label || 'Karachi'}
              {maid?.avg_rating ? `  ·  ${maid.avg_rating.toFixed(1)} ★` : ''}
            </Text>
          </View>
          <View style={styles.priceChip}>
            <Text style={styles.priceText}>Rs. {price?.toLocaleString?.() || price}</Text>
          </View>
        </View>

        {/* ── Status timeline ── */}
        <View style={styles.timeline}>
          {STATUS_STEPS.filter(s => s.key !== 'bid_selected').map((s, i) => {
            const done    = STATUS_STEPS.findIndex(x => x.key === status) > STATUS_STEPS.findIndex(x => x.key === s.key);
            const current = s.key === status;
            return (
              <View key={s.key} style={styles.timelineRow}>
                <View style={[
                  styles.timelineDot,
                  current && { backgroundColor: s.color },
                  done    && { backgroundColor: Colors.success },
                ]} />
                {i < STATUS_STEPS.filter(x => x.key !== 'bid_selected').length - 1 && (
                  <View style={[styles.timelineLine, done && { backgroundColor: Colors.success }]} />
                )}
                <Text style={[
                  styles.timelineLabel,
                  current && { color: s.color, fontFamily: FontFamily.semiBold },
                  done    && { color: Colors.success },
                ]}>
                  {s.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Complete: Review button ── */}
        {isCompleted && (
          <TouchableOpacity style={styles.reviewBtn} onPress={goToReview} activeOpacity={0.88}>
            <Text style={styles.reviewBtnText}>⭐ Review Dein</Text>
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }} />

        {/* ── Demo Controls ── */}
        {!isCompleted && (
          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>[ Demo Controls ]</Text>
            {step.next && (
              <TouchableOpacity
                onPress={() => advanceStatus(step.next)}
                disabled={advancing}
                style={styles.demoBtn}
              >
                <Text style={styles.demoBtnText}>
                  {advancing ? '...' : `→ ${getStep(step.next).label}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    padding: Spacing.md,
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...CardShadow,
  },
  iconText: {
    fontSize: 52,
  },
  statusLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    textAlign: 'center',
  },
  maidCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...CardShadow,
  },
  maidAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maidAvatarText: { fontSize: 24 },
  maidInfo: { flex: 1 },
  maidName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  maidMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  priceChip: {
    backgroundColor: `${Colors.accent}20`,
    borderRadius: Layout.borderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  priceText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
  timeline: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...CardShadow,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.border,
    flexShrink: 0,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    width: 2,
    height: Spacing.md + 4,
    backgroundColor: Colors.border,
  },
  timelineLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    flex: 1,
  },
  reviewBtn: {
    width: '100%',
    backgroundColor: Colors.accent,
    borderRadius: Layout.borderRadius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...CardShadow,
  },
  reviewBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.surface,
  },
  // ── Demo controls — intentionally plain / dev-tool style ──
  demoSection: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  demoTitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  demoBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  demoBtnText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});
