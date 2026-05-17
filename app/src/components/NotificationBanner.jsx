import React, { useRef, useEffect } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, Layout, CardShadow } from '../constants/spacing';
import { useNotifications } from '../hooks/useNotifications';

/**
 * Sliding notification banner — appears at top of screen when unread in-app notifications exist.
 * Polls /api/notifications/pending every 15 seconds (n8n/Twilio fallback).
 */
export default function NotificationBanner() {
  const { notifications, dismiss } = useNotifications();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const visible = notifications.length > 0;
  const latest = notifications[0];

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -100,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [visible, slideAnim]);

  if (!latest) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
    >
      <View style={styles.leftBorder} />
      <View style={styles.content}>
        <Text style={styles.message} numberOfLines={2}>{latest.message}</Text>
      </View>
      <TouchableOpacity
        onPress={() => dismiss(latest.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.closeBtn}
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,         // below status bar + floating search bar
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 999,
    ...CardShadow,
  },
  leftBorder: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
  },
  message: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  closeBtn: {
    padding: Spacing.md,
  },
  closeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
