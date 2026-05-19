import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, SafeAreaView, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { fileDispute } from '../services/api';
import { getOrCreateSession } from '../services/session';

const DISPUTE_TYPES = [
  { id: 'price_dispute',       label: '💰 Qeemat Zyada Thi',     desc: 'Price was too high' },
  { id: 'quality_complaint',   label: '👎 Kaam Theek Nahi Tha',  desc: 'Work quality was poor' },
  { id: 'no_show',             label: '🚫 Maid Nahi Aayi',        desc: 'Maid did not show up' },
  { id: 'other',               label: '📝 Kuch Aur',              desc: 'Something else' },
];

const RESOLUTION_LABELS = {
  refund_full:      { label: '✅ Pura Refund', color: '#22c55e' },
  refund_partial:   { label: '🔁 Aadha Refund', color: '#f59e0b' },
  discount_next:    { label: '🎟 Agla Discount', color: '#8b5cf6' },
  no_action:        { label: '❌ Koi Action Nahi', color: '#ef4444' },
  escalate_human:   { label: '🧑‍💼 Insaan Se Baat', color: '#3b82f6' },
};

export default function DisputeScreen({ navigation, route }) {
  const { booking = {} } = route.params || {};

  const [disputeType, setDisputeType]     = useState(null);
  const [description, setDescription]     = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [resolution, setResolution]       = useState(null);
  const [accepted, setAccepted]           = useState(false);

  const canSubmit = disputeType && !submitting && !resolution;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setSubmitting(true);
    try {
      const sessionId = await getOrCreateSession();
      const payload = {
        booking_id:   booking.id || booking.booking_id,
        session_id:   sessionId,
        dispute_type: disputeType,
        description:  description.trim() || '—',
      };
      console.log('[DISPUTE] Submitting payload:', JSON.stringify(payload));
      const data = await fileDispute(payload);
      setResolution(data.resolution || {
        resolution: 'escalate_human',
        message_to_user: 'Aap ki shikayat darj ho gayi hai. Hamara team 24 ghante mein aap se rabita karega.',
        refund_percentage: 0,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Error', 'Shikayat darj nahi ho saki. Dobara koshish karein.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAccepted(true);
    setTimeout(() => navigation.goBack(), 1500);
  };

  const handleEscalate = () => {
    Alert.alert(
      'Insaan Se Baat Karein',
      'Hamara support team aap ki madad karega. WhatsApp: +92-300-1234567',
      [{ text: 'Theek Hai' }]
    );
  };

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backTxt}>← Wapas</Text>
        </TouchableOpacity>
        <Text style={s.title}>⚖️ Masla Report Karein</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Booking Summary */}
        <View style={s.bookingSummary}>
          <Text style={s.summaryTitle}>Booking #{(booking.id || '').slice(0, 8).toUpperCase()}</Text>
          <Text style={s.summaryDetail}>
            🧹 {booking.maids?.name || booking.maid?.name || 'Maid'} · Rs. {(booking.agreed_price || booking.total_price || 0).toLocaleString()}
          </Text>
        </View>

        {!resolution ? (
          <>
            {/* Dispute type selection */}
            <Text style={s.sectionLabel}>Kya masla tha?</Text>
            <View style={s.typeGrid}>
              {DISPUTE_TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.typeChip, disputeType === t.id && s.typeChipActive]}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    setDisputeType(t.id);
                  }}
                >
                  <Text style={[s.typeLabel, disputeType === t.id && s.typeLabelActive]}>{t.label}</Text>
                  <Text style={s.typeDesc}>{t.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={s.sectionLabel}>Thori detail bataein (optional)</Text>
            <TextInput
              style={s.input}
              placeholder="Maslan: maid ne poora ghar saaf nahi kiya, sirf ek kamra kiya..."
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, !canSubmit && s.submitDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitTxt}>AI Resolution Maangein ✨</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          /* AI Resolution Card */
          <View style={s.resolutionCard}>
            <Text style={s.resolutionHeader}>🤖 AI Faisla</Text>

            {/* Resolution type badge */}
            {RESOLUTION_LABELS[resolution.resolution] && (
              <View style={[s.resBadge, { backgroundColor: RESOLUTION_LABELS[resolution.resolution].color + '22' }]}>
                <Text style={[s.resBadgeTxt, { color: RESOLUTION_LABELS[resolution.resolution].color }]}>
                  {RESOLUTION_LABELS[resolution.resolution].label}
                </Text>
              </View>
            )}

            {/* Refund percentage */}
            {resolution.refund_percentage > 0 && (
              <Text style={s.refundTxt}>💵 {resolution.refund_percentage}% refund aap ke account mein jayega</Text>
            )}

            {/* Message */}
            <Text style={s.resolutionMsg}>{resolution.message_to_user || resolution.assessment}</Text>

            {!accepted ? (
              <View style={s.actionRow}>
                <TouchableOpacity style={s.acceptBtn} onPress={handleAccept}>
                  <Text style={s.acceptTxt}>✅ Theek Hai, Manzoor Hai</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.escalateBtn} onPress={handleEscalate}>
                  <Text style={s.escalateTxt}>🧑‍💼 Insaan Se Baat Karni Hai</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={s.acceptedTxt}>✅ Shukria! Aap ki request process ho rahi hai.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: Colors.background },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  backBtn:        { paddingRight: Spacing.sm },
  backTxt:        { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.primary },
  title:          { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  scroll:         { padding: Spacing.md, gap: Spacing.md },
  bookingSummary: { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...CardShadow },
  summaryTitle:   { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.textPrimary },
  summaryDetail:  { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
  sectionLabel:   { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  typeGrid:       { gap: Spacing.sm },
  typeChip:       { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.md, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border, ...CardShadow },
  typeChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  typeLabel:      { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  typeLabelActive:{ color: Colors.primary },
  typeDesc:       { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  input:          { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.md, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.md, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top' },
  submitBtn:      { backgroundColor: Colors.primary, borderRadius: Layout.borderRadius.lg, paddingVertical: Spacing.md, alignItems: 'center', ...CardShadow },
  submitDisabled: { opacity: 0.45 },
  submitTxt:      { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: '#fff' },
  resolutionCard: { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary + '40', gap: Spacing.sm, ...CardShadow },
  resolutionHeader:{ fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  resBadge:       { alignSelf: 'flex-start', borderRadius: Layout.borderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  resBadgeTxt:    { fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  refundTxt:      { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: '#22c55e' },
  resolutionMsg:  { fontFamily: FontFamily.regular, fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22 },
  actionRow:      { gap: Spacing.sm },
  acceptBtn:      { backgroundColor: '#22c55e', borderRadius: Layout.borderRadius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  acceptTxt:      { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: '#fff' },
  escalateBtn:    { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  escalateTxt:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  acceptedTxt:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: '#22c55e', textAlign: 'center', paddingVertical: Spacing.sm },
});
