import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, SafeAreaView, StatusBar, ActivityIndicator, ScrollView,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { Strings } from '../constants/strings';
import { submitReview } from '../services/api';
import { getOrCreateSession } from '../services/session';

const STARS = [1, 2, 3, 4, 5];

export default function ReviewScreen({ navigation, route }) {
  const { requestId, maid = {}, type = 'quick_service' } = route.params || {};

  const [rating, setRating]     = useState(0);
  const [comment, setComment]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState(null);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Rating dena zaroori hai.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const sessionId = await getOrCreateSession();
      await submitReview({
        session_id:  sessionId,
        maid_id:     maid.id,
        reference_id: requestId,
        reference_type: type,
        rating,
        comment:     comment.trim() || null,
      });
      setDone(true);
    } catch (err) {
      const code = err?.response?.data?.error;
      if (code === 'DUPLICATE') {
        setError(Strings.review.alreadyReviewed);
      } else if (code === 'NOT_COMPLETED') {
        setError(Strings.review.notCompletedError);
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
        <Text style={styles.title}>{Strings.review.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {done ? (
          <View style={styles.doneState}>
            <Text style={styles.doneIcon}>⭐</Text>
            <Text style={styles.doneTitle}>{Strings.review.successMessage}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.popToTop()}>
              <Text style={styles.primaryBtnText}>Wapas Jayein</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Maid info */}
            <View style={styles.maidRow}>
              <View style={styles.avatar}><Text style={{ fontSize: 28 }}>🧹</Text></View>
              <Text style={styles.maidName}>{maid?.name || 'Aapki Maid'}</Text>
            </View>

            {/* Star rating */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{Strings.review.ratingLabel}</Text>
              <View style={styles.starRow}>
                {STARS.map(s => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)} style={styles.starBtn}>
                    <Text style={[styles.star, s <= rating && styles.starActive]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Comment */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tajurba (ikhtiyari)</Text>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder={Strings.review.commentPlaceholder}
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={500}
              />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, (submitting || rating === 0) && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting || rating === 0}
            >
              {submitting
                ? <ActivityIndicator color={Colors.surface} />
                : <Text style={styles.primaryBtnText}>{Strings.review.submitButton}</Text>
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
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.primary },
  content: { padding: Spacing.md, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textPrimary },
  maidRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    ...CardShadow,
  },
  maidName: { fontFamily: FontFamily.semiBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  starRow: { flexDirection: 'row', gap: Spacing.sm },
  starBtn: { padding: Spacing.xs },
  star: { fontSize: 42, color: Colors.border },
  starActive: { color: Colors.accent },
  commentInput: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    padding: Spacing.md,
    fontFamily: FontFamily.regular, fontSize: FontSize.md,
    color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top',
  },
  errorText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: Colors.accent, borderRadius: Layout.borderRadius.xl,
    paddingVertical: Spacing.md + 2, alignItems: 'center', ...CardShadow,
  },
  primaryBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.surface },
  doneState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingTop: Spacing.xxl },
  doneIcon: { fontSize: 64 },
  doneTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.textPrimary, textAlign: 'center' },
});
