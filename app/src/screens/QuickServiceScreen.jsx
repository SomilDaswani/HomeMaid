import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { Strings } from '../constants/strings';
import VoiceButton from '../components/VoiceButton';
import { calculatePrice, createQuickServiceRequest } from '../services/api';
import { getOrCreateSession } from '../services/session';

const SERVICE_TYPES = [
  { id: 'cleaning',          label: 'Safai',           icon: '🧹' },
  { id: 'laundry',           label: 'Dhulai',          icon: '👕' },
  { id: 'cooking',           label: 'Khana',           icon: '🍳' },
  { id: 'washing_dishes',    label: 'Bartan',          icon: '🍽️' },
  { id: 'cleaning_washroom', label: 'Washroom',        icon: '🚿' },
  { id: 'ironing_clothes',   label: 'Istri',           icon: '👔' },
];
const SERVICE_LABELS = {
  cleaning: 'Safai', laundry: 'Dhulai', cooking: 'Khana Pakana',
  washing_dishes: 'Bartan Dhona', cleaning_washroom: 'Washroom Safai', ironing_clothes: 'Istri Karna',
};
const ROOM_OPTIONS = [1, 2, 3, 4, 5];
const DURATION_OPTIONS = [
  { value: 1, label: '1 Ghanta' },
  { value: 2, label: '2 Ghante' },
  { value: 3, label: '3 Ghante' },
  { value: 4, label: '4 Ghante' },
  { value: 6, label: '6 Ghante' },
  { value: 8, label: 'Poora Din' },
];

function ConfidenceBadge({ score }) {
  const pct = Math.round((score || 0) * 100);
  let bg = '#E8F7F0', color = Colors.success; // green >= 0.7
  if (pct < 50) { bg = '#FEECEC'; color = Colors.error; }
  else if (pct < 70) { bg = '#FFF8E6'; color = Colors.warning; }
  return (
    <View style={[si.confBadge, { backgroundColor: bg }]}>
      <Text style={[si.confTxt, { color }]}>{pct}% confident</Text>
    </View>
  );
}

export default function QuickServiceScreen({ navigation, route }) {
  const prefill = route?.params?.intent || {};
  const [serviceType, setServiceType] = useState(prefill.service_type || 'cleaning');
  const [rooms, setRooms] = useState(prefill.rooms || 2);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [priceData, setPriceData] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [intentProcessing, setIntentProcessing] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [durationHours, setDurationHours] = useState(prefill.duration_hours || 2);

  // Intent confirmation state
  const [parsedIntent, setParsedIntent] = useState(null);
  const [intentConfirmed, setIntentConfirmed] = useState(false);
  const [clarifyQuestion, setClarifyQuestion] = useState(null);
  const [transcript, setTranscript] = useState(null);

  useEffect(() => { getOrCreateSession().then(setSessionId).catch(() => {}); }, []);

  const fetchPrice = useCallback(async (svc, r, dur) => {
    setLoadingPrice(true);
    try {
      const now = new Date();
      const data = await calculatePrice({
        service_types: [svc],
        complexity: { rooms: r, tasks: selectedTasks, duration_hours: dur || durationHours },
        scheduled_date: now.toISOString().split('T')[0],
        scheduled_start: now.toTimeString().slice(0, 5),
      });
      setPriceData(data);
    } catch { setPriceData(null); }
    setLoadingPrice(false);
  }, [selectedTasks, durationHours]);

  useEffect(() => { fetchPrice(serviceType, rooms, durationHours); }, []);

  const handleServiceChange = (id) => { setServiceType(id); fetchPrice(id, rooms, durationHours); };
  const handleRoomChange = (r) => { setRooms(r); fetchPrice(serviceType, r, durationHours); };
  const handleDurationChange = (dur) => { setDurationHours(dur); fetchPrice(serviceType, rooms, dur); };

  // Called by VoiceButton with full parsed response
  const handleIntentParsed = (data) => {
    const intent = data.intent;
    setTranscript(data.transcript || null);
    setParsedIntent(intent);
    setIntentConfirmed(false);

    if (data.needs_clarification && data.clarifying_question) {
      setClarifyQuestion(data.clarifying_question);
    } else {
      setClarifyQuestion(null);
    }

    // Pre-fill form but don't confirm yet
    if (intent.service_type) setServiceType(intent.service_type);
    if (intent.rooms) setRooms(intent.rooms);
    if (intent.duration_hours) setDurationHours(intent.duration_hours);
    fetchPrice(intent.service_type || serviceType, intent.rooms || rooms, intent.duration_hours || durationHours);
  };

  const confirmIntent = () => {
    setIntentConfirmed(true);
    setClarifyQuestion(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const sid = sessionId || await getOrCreateSession();
      const request = await createQuickServiceRequest({
        session_id: sid,
        service_types: [serviceType],
        complexity: 'simple',
        tasks: selectedTasks,
        lat: 24.8650,
        lng: 67.0650,
        area_label: parsedIntent?.area || 'Karachi',
        price_min: priceData?.price_min || 300,
        price_max: priceData?.price_max || 1200,
        estimated_price: priceData?.recommended_price || 500,
      });
      navigation.replace('BidList', { request });
    } catch {
      alert('Request nahi bheji ja saki. Dobara try karein.');
    }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={st.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Text style={st.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={st.title}>{Strings.quickService.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Voice / text input */}
        <View style={st.section}>
          <Text style={st.sectionLabel}>Bolen ya likhein</Text>
          <VoiceButton
            onIntentParsed={handleIntentParsed}
            onProcessing={setIntentProcessing}
            sessionId={sessionId}
          />
        </View>

        {/* Intent Confirmation Card */}
        {parsedIntent && !intentConfirmed && (
          <View style={si.intentCard}>
            <View style={si.intentHeader}>
              <Text style={si.intentTitle}>🧠 Samajh liya:</Text>
              <ConfidenceBadge score={parsedIntent.confidence} />
            </View>
            {transcript && <Text style={si.transcriptTxt}>"{transcript}"</Text>}
            <View style={si.intentFields}>
              <Text style={si.fieldTxt}>🧹 {SERVICE_LABELS[parsedIntent.service_type] || parsedIntent.service_type || '?'}</Text>
              {parsedIntent.area && <Text style={si.fieldTxt}>📍 {parsedIntent.area}</Text>}
              {parsedIntent.time_preference && <Text style={si.fieldTxt}>🕐 {parsedIntent.time_preference}</Text>}
              {parsedIntent.rooms && <Text style={si.fieldTxt}>🚪 {parsedIntent.rooms} kamre</Text>}
            </View>
            {clarifyQuestion && (
              <View style={si.clarifyBox}>
                <Text style={si.clarifyTxt}>🤖 {clarifyQuestion}</Text>
              </View>
            )}
            <View style={si.intentBtns}>
              <TouchableOpacity style={si.confirmBtn} onPress={confirmIntent}>
                <Text style={si.confirmTxt}>✓ Theek hai</Text>
              </TouchableOpacity>
              <TouchableOpacity style={si.retryBtn} onPress={() => { setParsedIntent(null); setTranscript(null); }}>
                <Text style={si.retryTxt}>↻ Dobara</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Service type picker */}
        <View style={st.section}>
          <Text style={st.sectionLabel}>{Strings.quickService.serviceLabel}</Text>
          <View style={st.serviceRow}>
            {SERVICE_TYPES.map(s => (
              <TouchableOpacity key={s.id} style={[st.serviceChip, serviceType === s.id && st.serviceActive]} onPress={() => handleServiceChange(s.id)}>
                <Text style={st.serviceIcon}>{s.icon}</Text>
                <Text style={[st.serviceLabel, serviceType === s.id && st.serviceLabelActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Room count */}
        {serviceType === 'cleaning' && (
          <View style={st.section}>
            <Text style={st.sectionLabel}>Kitne kamre?</Text>
            <View style={st.roomRow}>
              {ROOM_OPTIONS.map(r => (
                <TouchableOpacity key={r} style={[st.roomChip, rooms === r && st.roomActive]} onPress={() => handleRoomChange(r)}>
                  <Text style={[st.roomTxt, rooms === r && st.roomTxtActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Duration selector */}
        <View style={st.section}>
          <Text style={st.sectionLabel}>Kitni der ke liye?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.durationRow}>
            {DURATION_OPTIONS.map(d => (
              <TouchableOpacity key={d.value}
                style={[st.durationChip, durationHours === d.value && st.durationActive]}
                onPress={() => handleDurationChange(d.value)}>
                <Text style={[st.durationTxt, durationHours === d.value && st.durationTxtActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={st.durationNote}>Zyada waqt = zyada qeemat</Text>
        </View>

        {/* Price preview with breakdown */}
        <View style={st.priceCard}>
          {loadingPrice ? <ActivityIndicator size="small" color={Colors.primary} />
          : priceData ? (
            <>
              <Text style={st.priceLabel}>Takmini Qeemat</Text>
              <Text style={st.priceValue}>Rs. {priceData.recommended_price?.toLocaleString()}</Text>
              <Text style={st.priceRange}>Rs. {priceData.price_min?.toLocaleString()} – {priceData.price_max?.toLocaleString()}</Text>
              {priceData.breakdown && (
                <View style={st.breakdown}>
                  <View style={st.brkRow}><Text style={st.brkLabel}>Base rate</Text><Text style={st.brkVal}>Rs. {priceData.breakdown.subtotal}</Text></View>
                  {priceData.breakdown.tasks_extra > 0 && <View style={st.brkRow}><Text style={st.brkLabel}>+ Tasks</Text><Text style={st.brkVal}>Rs. {priceData.breakdown.tasks_extra}</Text></View>}
                  {priceData.breakdown.time_of_day_multiplier > 1 && <View style={st.brkRow}><Text style={st.brkLabel}>+ {priceData.breakdown.time_label}</Text><Text style={st.brkVal}>×{priceData.breakdown.time_of_day_multiplier}</Text></View>}
                  {priceData.breakdown.weekend_multiplier > 1 && <View style={st.brkRow}><Text style={st.brkLabel}>+ Weekend</Text><Text style={st.brkVal}>×{priceData.breakdown.weekend_multiplier}</Text></View>}
                  {priceData.breakdown.multiplier_capped && <Text style={st.capNote}>⚠ Multiplier capped at {priceData.breakdown.total_multiplier}x</Text>}
                </View>
              )}
              <Text style={st.priceNote}>Final qeemat maid ki bid par hogi</Text>
            </>
          ) : (
            <TouchableOpacity onPress={() => fetchPrice(serviceType, rooms)}>
              <Text style={st.priceFetchBtn}>Qeemat dekhein →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[st.submitBtn, (submitting || !priceData) && { opacity: 0.5 }]}
          onPress={handleSubmit} disabled={submitting || !priceData} activeOpacity={0.88}
        >
          {submitting ? <ActivityIndicator color={Colors.surface} /> : <Text style={st.submitTxt}>🔍 Maid Dhundein</Text>}
        </TouchableOpacity>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Intent confirmation card styles
const si = StyleSheet.create({
  intentCard: { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md, borderWidth: 2, borderColor: Colors.primary, gap: Spacing.sm, ...CardShadow },
  intentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  intentTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.primary },
  confBadge: { borderRadius: Layout.borderRadius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  confTxt: { fontFamily: FontFamily.semiBold, fontSize: 11 },
  transcriptTxt: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' },
  intentFields: { gap: 4 },
  fieldTxt: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textPrimary },
  clarifyBox: { backgroundColor: `${Colors.primary}10`, borderRadius: Layout.borderRadius.md, padding: Spacing.sm, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  clarifyTxt: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textPrimary },
  intentBtns: { flexDirection: 'row', gap: Spacing.sm },
  confirmBtn: { flex: 2, backgroundColor: Colors.success, borderRadius: Layout.borderRadius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  confirmTxt: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.surface },
  retryBtn: { flex: 1, backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.md, paddingVertical: Spacing.sm, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  retryTxt: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textMuted },
});

// Main styles
const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 24, color: Colors.primary },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.md },
  section: { gap: Spacing.sm },
  sectionLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textPrimary },
  serviceRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  serviceChip: { flex: 1, minWidth: '22%', backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.md, padding: Spacing.sm, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, gap: 4, ...CardShadow },
  serviceActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}12` },
  serviceIcon: { fontSize: 24 },
  serviceLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted },
  serviceLabelActive: { color: Colors.primary },
  roomRow: { flexDirection: 'row', gap: Spacing.sm },
  roomChip: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  roomActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  roomTxt: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textMuted },
  roomTxtActive: { color: Colors.surface },
  priceCard: { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, minHeight: 80, justifyContent: 'center', ...CardShadow },
  priceLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },
  priceValue: { fontFamily: FontFamily.bold, fontSize: FontSize.xxl, color: Colors.primary, marginTop: 4 },
  priceRange: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  priceNote: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  priceFetchBtn: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.primary },
  breakdown: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, width: '100%', gap: 4, marginTop: Spacing.sm },
  brkRow: { flexDirection: 'row', justifyContent: 'space-between' },
  brkLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  brkVal: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textPrimary },
  capNote: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.warning, marginTop: 2 },
  submitBtn: { backgroundColor: Colors.accent, borderRadius: Layout.borderRadius.xl, paddingVertical: Spacing.md + 2, alignItems: 'center', ...CardShadow, marginTop: Spacing.sm },
  submitTxt: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.surface },
  durationRow: { gap: Spacing.sm, paddingVertical: 4 },
  durationChip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Layout.borderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  durationActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}12` },
  durationTxt: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },
  durationTxtActive: { color: Colors.primary, fontFamily: FontFamily.semiBold },
  durationNote: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
});
