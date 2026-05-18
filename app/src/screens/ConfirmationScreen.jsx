import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, StatusBar, Linking, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { sendBookingConfirmationNotification, sendMaidEnRouteNotification } from '../lib/notifications';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SERVICE_LABELS = {
  cleaning: 'Safai', laundry: 'Dhulai', cooking: 'Khana Pakana',
  washing_dishes: 'Bartan Dhona', cleaning_washroom: 'Washroom Safai', ironing_clothes: 'Istri Karna',
};

export default function ConfirmationScreen({ navigation, route }) {
  const { maid = {}, price, service_type, booking_id, source, bid_message, eta_minutes, breakdown, matchExplanation } = route.params || {};
  const [showTrace, setShowTrace] = useState(false);

  // Fire push notifications on mount
  useEffect(() => {
    sendBookingConfirmationNotification(maid, { id: booking_id });
    if (eta_minutes) {
      sendMaidEnRouteNotification(maid);
    }
  }, []);

  const initials = (maid.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const shortId = (booking_id || '').slice(0, 8).toUpperCase();
  const phone = (maid.phone || '').replace(/^\+?/, '');
  const waLink = `whatsapp://send?phone=${phone}&text=Salam! Main ne HomeMaid se aap ko book kiya hai. Booking ID: ${shortId}`;

  const toggleTrace = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowTrace(v => !v);
  };

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Success header */}
        <View style={s.successHeader}>
          <Text style={s.checkmark}>✅</Text>
          <Text style={s.successTitle}>Booking Confirmed!</Text>
          <View style={s.statusBadge}><Text style={s.statusText}>Confirmed ✓</Text></View>
          <Text style={s.bookingId}>Booking ID: {shortId || '—'}</Text>
        </View>

        {/* Maid card */}
        <View style={s.card}>
          <View style={s.maidRow}>
            <View style={s.avatar}><Text style={s.avatarTxt}>{initials}</Text></View>
            <View style={s.maidInfo}>
              <Text style={s.maidName}>{maid.name || 'Maid'}</Text>
              <View style={s.ratingRow}>
                <Text style={s.starTxt}>⭐ {parseFloat(maid.avg_rating || 0).toFixed(1)}</Text>
                <Text style={s.dotSep}>•</Text>
                <Text style={s.metaTxt}>{maid.jobs_completed || maid.total_reviews || 0} jobs</Text>
                <Text style={s.dotSep}>•</Text>
                <Text style={s.metaTxt}>{maid.skill_level || 'intermediate'}</Text>
              </View>
              <Text style={s.areaTxt}>📍 {maid.area_label || 'Karachi'}</Text>
            </View>
          </View>

          {bid_message && <Text style={s.bidMsg}>"{bid_message}"</Text>}
          {eta_minutes && <Text style={s.etaTxt}>🕐 Estimated arrival: {eta_minutes} minutes</Text>}
        </View>

        {/* Service details */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Service Details</Text>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Service</Text>
            <Text style={s.detailValue}>{SERVICE_LABELS[service_type] || service_type}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Source</Text>
            <Text style={s.detailValue}>{source === 'quick_service' ? 'Quick Service' : 'Standard Booking'}</Text>
          </View>
        </View>

        {/* Price */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Price</Text>
          <Text style={s.priceMain}>Rs. {(price || 0).toLocaleString()}</Text>
          {breakdown && (
            <View style={s.breakdownBox}>
              <View style={s.detailRow}><Text style={s.brkLabel}>Base rate</Text><Text style={s.brkVal}>Rs. {breakdown.subtotal || '—'}</Text></View>
              {breakdown.tasks_extra > 0 && <View style={s.detailRow}><Text style={s.brkLabel}>+ Tasks</Text><Text style={s.brkVal}>Rs. {breakdown.tasks_extra}</Text></View>}
              {breakdown.time_of_day_multiplier > 1 && <View style={s.detailRow}><Text style={s.brkLabel}>+ {breakdown.time_label}</Text><Text style={s.brkVal}>×{breakdown.time_of_day_multiplier}</Text></View>}
              {breakdown.weekend_multiplier > 1 && <View style={s.detailRow}><Text style={s.brkLabel}>+ Weekend</Text><Text style={s.brkVal}>×{breakdown.weekend_multiplier}</Text></View>}
            </View>
          )}
        </View>

        {/* Contact buttons */}
        <View style={s.contactRow}>
          {phone ? (
            <TouchableOpacity style={s.waBtn} onPress={() => Linking.openURL(waLink).catch(() => {})} activeOpacity={0.85}>
              <Text style={s.waBtnTxt}>💬 WhatsApp pe Contact</Text>
            </TouchableOpacity>
          ) : null}
          {maid.phone ? (
            <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${maid.phone}`).catch(() => {})} activeOpacity={0.85}>
              <Text style={s.callBtnTxt}>📞 Call</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* AI Reasoning (collapsible) */}
        <TouchableOpacity style={s.traceToggle} onPress={toggleTrace} activeOpacity={0.85}>
          <Text style={s.traceToggleTxt}>🧠 AI Reasoning {showTrace ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showTrace && (
          <View style={s.traceBox}>
            {matchExplanation ? (
              <><Text style={s.traceLabel}>Why this maid?</Text><Text style={s.traceContent}>{matchExplanation}</Text></>
            ) : (
              <Text style={s.traceContent}>AI ne is maid ko aap ke liye best match kiya — rating, distance, aur reliability ke basis par.</Text>
            )}
            <TouchableOpacity style={s.viewTraceBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Traces' })} activeOpacity={0.85}>
              <Text style={s.viewTraceTxt}>📋 View Full Trace →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Go home */}
        <TouchableOpacity style={s.homeBtn} onPress={goHome} activeOpacity={0.85}>
          <Text style={s.homeBtnTxt}>🏠 Home Screen</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  successHeader: { alignItems: 'center', gap: 6, paddingVertical: Spacing.md },
  checkmark: { fontSize: 52 },
  successTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xxl, color: Colors.primary },
  statusBadge: { backgroundColor: '#E8F7F0', borderRadius: Layout.borderRadius.sm, paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.success },
  bookingId: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted },
  card: { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border, gap: Spacing.sm, ...CardShadow },
  cardTitle: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textPrimary },
  maidRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.surface },
  maidInfo: { flex: 1, gap: 3 },
  maidName: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starTxt: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.accent },
  dotSep: { color: Colors.textMuted, fontSize: FontSize.xs },
  metaTxt: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  areaTxt: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  bidMsg: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' },
  etaTxt: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.success },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted },
  detailValue: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  priceMain: { fontFamily: FontFamily.bold, fontSize: 32, color: Colors.primary, textAlign: 'center' },
  breakdownBox: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, gap: 4 },
  brkLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  brkVal: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textPrimary },
  contactRow: { flexDirection: 'row', gap: Spacing.sm },
  waBtn: { flex: 2, backgroundColor: '#25D366', borderRadius: Layout.borderRadius.md, paddingVertical: Spacing.sm + 4, alignItems: 'center', ...CardShadow },
  waBtnTxt: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.surface },
  callBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Layout.borderRadius.md, paddingVertical: Spacing.sm + 4, alignItems: 'center', ...CardShadow },
  callBtnTxt: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.surface },
  traceToggle: { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.md, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', ...CardShadow },
  traceToggleTxt: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.primary },
  traceBox: { backgroundColor: '#F5F0EB', borderRadius: Layout.borderRadius.md, padding: Spacing.md, gap: Spacing.sm },
  traceLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  traceContent: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 20 },
  viewTraceBtn: { alignSelf: 'flex-end', paddingVertical: 4 },
  viewTraceTxt: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.primary },
  homeBtn: { backgroundColor: Colors.accent, borderRadius: Layout.borderRadius.xl, paddingVertical: Spacing.md + 2, alignItems: 'center', ...CardShadow },
  homeBtnTxt: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.surface },
});
