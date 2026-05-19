import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { Strings } from '../constants/strings';
import { getOrCreateSession } from '../services/session';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Web fallback for SecureStore
const storage = {
  get: async (key) => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  set: async (key, value) => {
    if (Platform.OS === 'web') return localStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
};

/**
 * Entry screen — homeowner or maid role selection.
 * Maid option is disabled (Coming Soon) for hackathon MVP.
 */
export default function RoleSelectScreen({ navigation }) {
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleHomeownerPress = () => {
    setShowPhoneModal(true);
  };

  const validateAndSubmit = async () => {
    setPhoneError(null);

    // Must be exactly 10 digits starting with 3
    const cleaned = phoneInput.replace(/\D/g, '');
    if (cleaned.length !== 10 || !cleaned.startsWith('3')) {
      setPhoneError('Sahi number likhein jaise 3001234567');
      return;
    }

    setSubmitting(true);
    try {
      // Normalize to +92 format
      const normalized = `+92${cleaned}`;

      // Get or create session
      const sessionId = await getOrCreateSession();

      // Register homeowner
      const res = await fetch(`${API_URL}/api/homeowners/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          phone_number: normalized,
        }),
      });

      const data = await res.json();

      if (data.success && data.homeowner) {
        // Save to secure storage
        await storage.set('homeowner_id', data.homeowner.id);
        await storage.set('homeowner_phone', normalized);
        console.log('[PHONE] Saved homeowner:', data.homeowner.id, normalized);
      } else {
        console.warn('[PHONE] Registration issue:', data.error);
      }

      setShowPhoneModal(false);
      navigation.replace('HomeMap');
    } catch (err) {
      console.error('[PHONE] Error:', err);
      setPhoneError('Server se connection nahi hua. Dobara try karein.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    setShowPhoneModal(false);
    navigation.replace('HomeMap');
  };

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
          onPress={handleHomeownerPress}
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

      {/* ── Phone Number Modal ─────────────────────────────────── */}
      <Modal
        visible={showPhoneModal}
        transparent
        animationType="slide"
        onRequestClose={handleSkip}
      >
        <KeyboardAvoidingView
          style={m.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={m.overlayBg} activeOpacity={1} onPress={handleSkip} />

          <View style={m.sheet}>
            {/* Phone emoji */}
            <Text style={m.emoji}>📱</Text>

            {/* Title */}
            <Text style={m.title}>Apna Number Dein</Text>

            {/* Subtitle */}
            <Text style={m.subtitle}>
              Booking confirm hone par maid ki details aur WhatsApp par confirmation message is number par bheja jayega.
            </Text>

            {/* Phone input row */}
            <View style={m.inputRow}>
              <View style={m.prefix}>
                <Text style={m.prefixTxt}>🇵🇰 +92</Text>
              </View>
              <TextInput
                style={m.input}
                placeholder="3001234567"
                placeholderTextColor={Colors.textMuted}
                value={phoneInput}
                onChangeText={(t) => {
                  setPhoneInput(t.replace(/\D/g, ''));
                  setPhoneError(null);
                }}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
              />
            </View>

            {/* Error */}
            {phoneError && (
              <Text style={m.error}>{phoneError}</Text>
            )}

            {/* Privacy note */}
            <Text style={m.note}>
              ✅ Sirf WhatsApp confirmation ke liye — koi spam nahi
            </Text>

            {/* Submit button */}
            <TouchableOpacity
              style={[m.submitBtn, submitting && m.submitBtnDisabled]}
              onPress={validateAndSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={m.submitTxt}>Aage Barhein →</Text>
              )}
            </TouchableOpacity>

            {/* Skip link */}
            <TouchableOpacity onPress={handleSkip} style={m.skipBtn}>
              <Text style={m.skipTxt}>Abhi nahi (notifications nahi milenge)</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Modal styles ──────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    alignItems: 'center',
    ...CardShadow,
  },
  emoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  prefix: {
    backgroundColor: Colors.background,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    height: 52,
  },
  prefixTxt: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 52,
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  error: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.error,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  note: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.success,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#2D6A4F',
    borderRadius: Layout.borderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: Spacing.md,
  },
  submitBtnDisabled: {
    backgroundColor: '#999',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitTxt: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: '#fff',
    letterSpacing: 0.3,
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
  },
  skipTxt: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});

// ── Main styles ───────────────────────────────────────────────────────────────
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
