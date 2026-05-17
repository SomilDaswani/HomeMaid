import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, ActivityIndicator,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { getMaid, getMaidReviews } from '../services/api';

export default function MaidProfileScreen({ navigation, route }) {
  const { maidId, maid: initialMaid } = route.params || {};
  const [maid, setMaid]     = useState(initialMaid || null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(!initialMaid);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!maidId) return;
    Promise.all([getMaid(maidId), getMaidReviews(maidId)])
      .then(([m, r]) => { setMaid(m); setReviews(r?.reviews || []); })
      .catch(() => setError('Profile load nahi ho saki.'))
      .finally(() => setLoading(false));
  }, [maidId]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (error)   return <View style={styles.centered}><Text style={styles.errTxt}>{error}</Text></View>;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatar}><Text style={{ fontSize: 52 }}>🧹</Text></View>
          <Text style={styles.name}>{maid?.name}</Text>
          <Text style={styles.area}>{maid?.area_label}</Text>
          <Text style={styles.rating}>{maid?.avg_rating?.toFixed(1)} ★  ·  {maid?.total_reviews || 0} reviews</Text>
        </View>
        <View style={styles.statsRow}>
          {[
            { l: 'Experience', v: `${Math.floor((maid?.experience_months || 0) / 12)}y` },
            { l: 'Skill', v: maid?.skill_level || 'basic' },
            { l: 'Rate', v: `Rs.${maid?.rate_min}+` },
          ].map(s => (
            <View key={s.l} style={styles.statBox}>
              <Text style={styles.statV}>{s.v}</Text>
              <Text style={styles.statL}>{s.l}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.bookBtn} onPress={() => navigation.navigate('Booking', { maid })}>
          <Text style={styles.bookBtnTxt}>📅 Book This Maid</Text>
        </TouchableOpacity>
        <Text style={styles.sectionLabel}>Reviews ({reviews.length})</Text>
        {reviews.slice(0, 10).map((r, i) => (
          <View key={r.id || i} style={styles.reviewCard}>
            <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
            {r.comment ? <Text style={styles.reviewCmt}>{r.comment}</Text> : null}
          </View>
        ))}
        {!reviews.length && <Text style={styles.muted}>Abhi koi review nahi.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errTxt: { fontFamily: FontFamily.medium, fontSize: FontSize.md, color: Colors.error },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: Colors.primary },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.primary },
  content: { padding: Spacing.md, gap: Spacing.lg },
  hero: { alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', ...CardShadow },
  name: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.textPrimary },
  area: { fontFamily: FontFamily.regular, fontSize: FontSize.md, color: Colors.textMuted },
  rating: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.accent },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statBox: { flex: 1, backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: Colors.border, ...CardShadow },
  statV: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.primary },
  statL: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  bookBtn: { backgroundColor: Colors.accent, borderRadius: Layout.borderRadius.xl, paddingVertical: Spacing.md + 2, alignItems: 'center', ...CardShadow },
  bookBtnTxt: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.surface },
  sectionLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textPrimary },
  reviewCard: { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border, gap: 4 },
  reviewStars: { fontSize: FontSize.md, color: Colors.accent },
  reviewCmt: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textPrimary },
  muted: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted },
});
