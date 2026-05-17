import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, SafeAreaView, StatusBar, ActivityIndicator, ScrollView,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { Strings } from '../constants/strings';
import { fileDispute } from '../services/api';
import { getOrCreateSession } from '../services/session';

const DISPUTE_TYPES = [
  { id: 'no_show',  label: Strings.dispute.noShowLabel,  icon: '🚫' },
  { id: 'quality',  label: Strings.dispute.qualityLabel, icon: '⚠️' },
];

export default function DisputeScreen({ navigation, route }) {
  const { requestId, maid = {}, type = 'quick_service' } = route.params || {};

  const [disputeType, setDisputeType] = useState('no_show');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [done, setDone]               = useState(false);
  const [error, setError]             = useState(null);

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Masla batana zaroori hai.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const sessionId = await getOrCreateSession();
      await fileDispute({
        session_id:     sessionId,
        maid_id:        maid.id,
        reference_id:   requestId,
        reference_type: type,
        dispute_type:   disputeType,
        description:    description.trim(),
      });
      setDone(true);
    } catch (err) {
      const code = err?.response?.data?.error;
      if (code === 'WINDOW_EXPIRED') {
        setError(Strings.dispute.windowExpired);
      } else if (code === 'TOO_EARLY') {
        setError(Strings.dispute.tooEarlyNoShow);
      } else {
        setError(Strings.common.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{Strings.dispute.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {done ? (
          <View style={styles.doneState}>
            <Text style={styles.doneIcon}>📋</Text>
            <Text style={styles.doneTitle}>Complaint darj ho gayi</Text>
            <Text style={styles.doneSub}>Hum jald review karenge.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.popToTop()}>
              <Text style={styles.primaryBtnText}>Wapas Jayein</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Dispute type */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{Strings.dispute.typeLabel}</Text>
              <View style={styles.typeRow}>
                {DISPUTE_TYPES.map(d => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.typeChip, disputeType === d.id && styles.typeChipActive]}
                    onPress={() => setDisputeType(d.id)}
                  >
                    <Text style={{ fontSize: 24 }}>{d.icon}</Text>
                    <Text style={[styles.typeLabel, disputeType === d.id && { color: Colors.error }]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Masle ki wazahat</Text>
              <TextInput
                style={styles.descInput}
                value={description}
                onChangeText={setDescription}
                placeholder={Strings.dispute.descriptionPlaceholder}
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={500}
              />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, styles.dangerBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={Colors.surface} />
                : <Text style={styles.primaryBtnText}>{Strings.dispute.submitButton}</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: Colors.primary },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.error },
  content: { padding: Spacing.md, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textPrimary },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeChip: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1.5, borderColor: Colors.border, ...CardShadow,
  },
  typeChipActive: { borderColor: Colors.error, backgroundColor: `${Colors.error}10` },
  typeLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  descInput: {
    backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.md,
    fontFamily: FontFamily.regular, fontSize: FontSize.md,
    color: Colors.textPrimary, minHeight: 120, textAlignVertical: 'top',
  },
  errorText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: Colors.accent, borderRadius: Layout.borderRadius.xl,
    paddingVertical: Spacing.md + 2, alignItems: 'center', ...CardShadow,
  },
  dangerBtn: { backgroundColor: Colors.error },
  primaryBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.surface },
  doneState: { alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.xxl },
  doneIcon: { fontSize: 64 },
  doneTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.textPrimary, textAlign: 'center' },
  doneSub: { fontFamily: FontFamily.regular, fontSize: FontSize.md, color: Colors.textMuted },
});
