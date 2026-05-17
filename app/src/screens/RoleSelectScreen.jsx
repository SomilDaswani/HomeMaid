import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { Strings } from '../constants/strings';

/**
 * Entry screen — homeowner or maid role selection.
 * Maid option is disabled (Coming Soon) for hackathon MVP.
 */
export default function RoleSelectScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Logo / wordmark */}
      <View style={styles.header}>
        <View style={styles.logoMark}>
          <Text style={styles.logoIcon}>🏠</Text>
        </View>
        <Text style={styles.title}>{Strings.roleSelect.title}</Text>
        <Text style={styles.subtitle}>{Strings.roleSelect.subtitle}</Text>
      </View>

      {/* Role cards */}
      <View style={styles.cardsContainer}>
        {/* Homeowner card — active */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.replace('MainTabs')}
          activeOpacity={0.88}
        >
          <View style={styles.cardIconContainer}>
            <Text style={styles.cardIcon}>🏡</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{Strings.roleSelect.homeownerLabel}</Text>
            <Text style={styles.cardSubtitle}>{Strings.roleSelect.homeownerSubtitle}</Text>
          </View>
          <View style={styles.cardArrow}>
            <Text style={styles.arrowText}>→</Text>
          </View>
        </TouchableOpacity>

        {/* Maid card — disabled / coming soon */}
        <View style={[styles.card, styles.cardDisabled]}>
          <View style={styles.cardIconContainer}>
            <Text style={styles.cardIcon}>🧹</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, styles.disabledText]}>
              {Strings.roleSelect.maidLabel}
            </Text>
            <Text style={[styles.cardSubtitle, styles.disabledSubtext]}>
              {Strings.roleSelect.maidSubtitle}
            </Text>
          </View>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>{Strings.roleSelect.maidComingSoon}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Layout.screenHorizontalPadding,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...CardShadow,
  },
  logoIcon: {
    fontSize: 38,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.hero,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  cardsContainer: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg + 4,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...CardShadow,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  disabledText: {
    color: Colors.textMuted,
  },
  disabledSubtext: {
    color: Colors.border,
  },
  cardArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: Colors.surface,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semiBold,
  },
  comingSoonBadge: {
    backgroundColor: Colors.border,
    borderRadius: Layout.borderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  comingSoonText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
