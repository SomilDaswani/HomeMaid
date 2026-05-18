import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';

export default function ConfirmationScreen({ navigation, route }) {
  const { maid, price, serviceType, details, status, type } = route.params || {};

  const statusLabel = {
    pending:       '⏳ Pending',
    bid_selected:  '✅ Bid Selected',
    confirmed:     '🎉 Confirmed',
    en_route:      '🚶‍♀️ En Route',
    in_progress:   '🔧 In Progress',
    completed:     '✅ Completed',
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Success icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.bigIcon}>🎉</Text>
        </View>

        <Text style={styles.heading}>
          {type === 'quick_service' ? 'Bid Accept Ho Gayi!' : 'Booking Confirm!'}
        </Text>
        <Text style={styles.subtitle}>
          Aap ki maid jaldi aayegi. Neeche details dekhein.
        </Text>

        {/* Maid card */}
        <View style={styles.card}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>👩</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.maidName}>{maid?.name || 'Maid'}</Text>
            <Text style={styles.maidMeta}>
              {(maid?.avg_rating || 0).toFixed?.(1) || maid?.avg_rating} ★  ·  {maid?.area_label || ''}
            </Text>
            {maid?.skill_level && (
              <Text style={styles.maidSkill}>{maid.skill_level}</Text>
            )}
          </View>
        </View>

        {/* Details card */}
        <View style={styles.detailCard}>
          <Row label="Qeemat" value={`Rs. ${(price || 0).toLocaleString()}`} highlight />
          {serviceType && <Row label="Kaam" value={serviceType} />}
          {details?.date && <Row label="Tarikh" value={details.date} />}
          {details?.time && <Row label="Waqt" value={details.time} />}
          <Row label="Status" value={statusLabel[status] || status || 'Confirmed'} />
        </View>

        {/* Contact card */}
        {maid?.phone && (
          <View style={styles.contactCard}>
            <Text style={styles.contactLabel}>📞 Maid ka number</Text>
            <Text style={styles.contactPhone}>{maid.phone}</Text>
          </View>
        )}

        {/* Done button */}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.popToTop()}
          activeOpacity={0.88}
        >
          <Text style={styles.doneBtnText}>✅ Done — Home Map</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, highlight }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && { color: Colors.primary, fontFamily: FontFamily.bold }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, alignItems: 'center', gap: Spacing.md },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${Colors.success}20`,
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  bigIcon: { fontSize: 40 },
  heading: {
    fontFamily: FontFamily.bold, fontSize: FontSize.xxl,
    color: Colors.textPrimary, textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm,
    color: Colors.textMuted, textAlign: 'center',
  },
  card: {
    width: '100%',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border,
    ...CardShadow,
  },
  avatarWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 28 },
  maidName: { fontFamily: FontFamily.semiBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  maidMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  maidSkill: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.primary, marginTop: 2 },
  detailCard: {
    width: '100%',
    backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.border,
    ...CardShadow,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted },
  rowValue: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textPrimary },
  contactCard: {
    width: '100%',
    backgroundColor: `${Colors.primary}08`, borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: `${Colors.primary}30`,
  },
  contactLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },
  contactPhone: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.primary },
  doneBtn: {
    width: '100%',
    backgroundColor: Colors.accent, borderRadius: Layout.borderRadius.xl,
    paddingVertical: Spacing.md + 2, alignItems: 'center',
    marginTop: Spacing.md,
    ...CardShadow,
  },
  doneBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.surface },
});
