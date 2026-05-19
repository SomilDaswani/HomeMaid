import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, SafeAreaView, StatusBar, TextInput, Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { Strings } from '../constants/strings';
import VoiceButton from '../components/VoiceButton';
import { calculatePrice, rankMaids, createBooking, parseTextIntent } from '../services/api';
import { getOrCreateSession } from '../services/session';

const SERVICE_TYPES = [
  { id: 'cleaning',          label: 'Safai',     icon: '🧹' },
  { id: 'laundry',           label: 'Dhulai',    icon: '👕' },
  { id: 'cooking',           label: 'Khana',     icon: '🍳' },
  { id: 'washing_dishes',    label: 'Bartan',    icon: '🍽️' },
  { id: 'cleaning_washroom', label: 'Washroom',  icon: '🚿' },
  { id: 'ironing_clothes',   label: 'Istri',     icon: '👔' },
];

const SERVICE_LABELS = {
  cleaning: 'Safai', laundry: 'Dhulai', cooking: 'Khana Pakana',
  washing_dishes: 'Bartan Dhona', cleaning_washroom: 'Washroom Safai', ironing_clothes: 'Istri Karna',
};

// ── Simple date helpers ──────────────────────────────────────────────────────
function todayDateString() {
  return new Date().toISOString().split('T')[0]; // "2025-05-17"
}

function buildSlotISO(dateStr, hourStr) {
  return new Date(`${dateStr}T${hourStr}:00`).toISOString();
}

const HOUR_OPTIONS = [
  '07:00','08:00','09:00','10:00','11:00','12:00',
  '13:00','14:00','15:00','16:00','17:00','18:00','19:00',
];

// Bump a YYYY-MM-DD string by +/- N days, floor at today
function bumpDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) d.setTime(today.getTime());
  return d.toISOString().split('T')[0];
}

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

// ── Maid result card ─────────────────────────────────────────────────────────
function MaidResultCard({ maid, rank, onSelect, durationHours }) {
  const scorePercent = Math.round((maid.score || 0) * 100);
  const estimate = maid.base_rate ? (maid.base_rate * durationHours) : maid.rate_min;
  return (
    <TouchableOpacity style={styles.maidCard} onPress={() => onSelect(maid)} activeOpacity={0.88}>
      <View style={styles.maidRankBadge}>
        <Text style={styles.maidRankText}>#{rank}</Text>
      </View>
      <View style={styles.maidAvatar}>
        <Text style={{ fontSize: 24 }}>🧹</Text>
      </View>
      <View style={styles.maidCardInfo}>
        <Text style={styles.maidCardName} numberOfLines={1}>{maid.name}</Text>
        <Text style={styles.maidCardMeta}>
          {maid.avg_rating?.toFixed(1)} ★  ·  {maid.area_label}  ·  {maid.skill_level}
        </Text>
        <Text style={styles.maidCardRate}>
          Rs. {estimate ? estimate.toLocaleString() : '—'}
        </Text>
      </View>
      <View style={styles.maidScoreWrap}>
        <Text style={styles.maidScore}>{scorePercent}</Text>
        <Text style={styles.maidScoreLabel}>score</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function BookingScreen({ navigation }) {
  const [step, setStep] = useState('input'); // 'input' | 'intent' | 'form' | 'results' | 'confirm'

  // Location & Session State
  const [sessionId, setSessionId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userAddress, setUserAddress] = useState(null);

  // Intent Parsing State
  const [parsedIntent, setParsedIntent] = useState(null);
  const [intentConfirmed, setIntentConfirmed] = useState(false);
  const [clarifyQuestion, setClarifyQuestion] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const fullContext = useRef('');
  const clarificationRounds = useRef(0);
  const [clarificationLoading, setClarificationLoading] = useState(false);
  const [intentProcessing, setIntentProcessing] = useState(false);

  // Form state
  const [serviceType, setServiceType]   = useState('cleaning');
  const [date, setDate]                 = useState(todayDateString());
  const [startHour, setStartHour]       = useState('10:00');
  const [durationHours, setDurationHours] = useState(2);
  
  const endHourNum = parseInt(startHour.split(':')[0], 10) + durationHours;
  const endHour = `${Math.min(endHourNum, 23).toString().padStart(2, '0')}:00`;

  // Results state
  const [maids, setMaids]               = useState([]);
  const [explanation, setExplanation]   = useState(null);
  const [selectedMaid, setSelectedMaid] = useState(null);
  const [priceData, setPriceData]       = useState(null);

  // UI state
  const [loadingRank, setLoadingRank]   = useState(false);
  const [confirming, setConfirming]     = useState(false);
  const [error, setError]               = useState(null);

  // Initialize Session & Location
  useEffect(() => {
    getOrCreateSession().then(setSessionId).catch(() => {});
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });

        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        const area = address?.district ||
          address?.subregion ||
          address?.neighborhood ||
          address?.street ||
          address?.city ||
          'Karachi';
        setUserAddress(area);
      } catch (err) {
        console.warn('[GPS] Location error:', err.message);
      }
    })();
  }, []);

  // Fetch price when service changes
  useEffect(() => {
    calculatePrice({
      service_types: [serviceType],
      complexity: { duration_hours: durationHours },
      scheduled_date: date,
      scheduled_start: startHour,
    })
      .then(data => setPriceData(data))
      .catch(() => {});
  }, [serviceType, startHour, durationHours, date]);

  // Handle parsed intent from VoiceButton
  const handleIntentParsed = (data, isClarification = false) => {
    const intent = data?.intent;
    setTranscript(data?.transcript || null);
    if (!isClarification) {
      fullContext.current = data?.transcript || '';
      clarificationRounds.current = 0;
    }
    setParsedIntent(intent);
    setIntentConfirmed(false);
    setClarificationAnswer('');

    if (data?.needs_clarification && data?.clarifying_question) {
      setClarifyQuestion(data.clarifying_question);
    } else {
      setClarifyQuestion(null);
    }

    if (intent?.service_type) setServiceType(intent.service_type);

    if (intent?.duration_hours) {
       setDurationHours(intent.duration_hours);
    }

    if (intent?.time_preference) {
      const timeRangeMatch = intent.time_preference.match(/(\d{2}):\d{2}-(\d{2}):\d{2}/);
      if (timeRangeMatch) {
        setStartHour(`${timeRangeMatch[1]}:00`);
        const dur = parseInt(timeRangeMatch[2]) - parseInt(timeRangeMatch[1]);
        if (dur > 0 && dur <= 8) setDurationHours(dur);
      } else {
        // Basic heuristic for times if identified
        const timeLower = intent.time_preference.toLowerCase();
        if (timeLower.includes('subah') || timeLower.includes('morning')) setStartHour('09:00');
        else if (timeLower.includes('dopahar') || timeLower.includes('afternoon')) setStartHour('14:00');
        else if (timeLower.includes('shaam') || timeLower.includes('evening')) setStartHour('16:00');
      }
    }

    setStep('intent');
  };

  const handleClarificationSubmit = async () => {
    if (!clarificationAnswer.trim()) return;
    setClarificationLoading(true);
    clarificationRounds.current += 1;
    // Fallback to transcript state if ref is empty
    if (!fullContext.current && transcript) {
      fullContext.current = transcript;
    }
    
    // Accumulate BEFORE async parse
    fullContext.current = fullContext.current ? `${fullContext.current}. ${clarificationAnswer.trim()}` : clarificationAnswer.trim();
    const currentContext = fullContext.current;
    
    console.log('[CLARIF] fullContext value:', currentContext);
    
    setClarificationAnswer('');
    setIntentProcessing(true);
    try {
      const result = await parseTextIntent(currentContext, sessionId, userAddress);
      handleIntentParsed(result, true);
    } catch {
      setClarifyQuestion(null);
    } finally {
      setIntentProcessing(false);
      setClarificationLoading(false);
    }
  };

  const handleConfirmIntent = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIntentConfirmed(true);
    setStep('form');
  };

  // Validate slot before submitting
  const validateSlot = useCallback(() => {
    const now   = new Date();
    const start = new Date(`${date}T${startHour}:00`);

    if (start <= now) {
      setError(Strings.booking.pastDateError);
      return false;
    }
    return true;
  }, [date, startHour]);

  // Find matches
  const handleFindMatches = async () => {
    setError(null);
    if (!validateSlot()) return;

    setLoadingRank(true);
    setStep('form');

    try {
      const result = await rankMaids({
        service_types:   [serviceType],
        lat:             userLocation?.lat || 24.8650,
        lng:             userLocation?.lng || 67.0650,
        slot_start:      buildSlotISO(date, startHour),
        slot_end:        buildSlotISO(date, endHour),
        estimated_price: priceData?.recommended_price || 0,
        session_id:      sessionId,
      });

      if (!result.maids?.length) {
        setError(Strings.booking.noMatchesSubtitle);
        setMaids([]);
      } else {
        setMaids(result.maids);
        setExplanation(result.explanation);
        setStep('results');
      }
    } catch {
      setError(Strings.common.error);
    } finally {
      setLoadingRank(false);
    }
  };

  // Confirm booking with selected maid
  const handleConfirm = async () => {
    if (!selectedMaid) return;
    setConfirming(true);
    setError(null);

    try {
      const booking = await createBooking({
        session_id:      sessionId,
        maid_id:         selectedMaid.id,
        service_types:   [serviceType],
        scheduled_date:  date,
        scheduled_start: startHour,
        scheduled_end:   endHour,
        total_price:     priceData?.recommended_price || selectedMaid.rate_min,
      });

      navigation.replace('Confirmation', {
        maid:        selectedMaid,
        price:       booking.total_price || priceData?.recommended_price || selectedMaid.rate_min,
        serviceType: serviceType,
        details:     { date, time: `${startHour} – ${endHour}` },
        status:      'confirmed',
        type:        'booking',
      });
    } catch (err) {
      const msg = err?.response?.data?.error;
      if (msg === 'SLOT_CONFLICT') {
        setError(Strings.booking.slotConflictError);
      } else {
        setError(Strings.common.error);
      }
      setStep('results');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => step === 'results' ? setStep('form') : navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{Strings.booking.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {step === 'input' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Bolen ya likhein</Text>
            <VoiceButton 
              onIntentParsed={handleIntentParsed} 
              onProcessing={setIntentProcessing}
              sessionId={sessionId}
              gpsArea={userAddress}
            />
            <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => setStep('form')}>
              <Text style={{ color: Colors.primary, fontFamily: FontFamily.medium }}>Ya khud form bharein →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'intent' && parsedIntent && (
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
                {clarificationLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={{ marginLeft: 8, color: Colors.textMuted }}>Samajh raha hoon...</Text>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={si.clarifyInput}
                      placeholder="Yahan jawab likhein..."
                      placeholderTextColor="#999"
                      value={clarificationAnswer}
                      onChangeText={setClarificationAnswer}
                      returnKeyType="done"
                      onSubmitEditing={handleClarificationSubmit}
                    />
                    <TouchableOpacity
                      style={si.clarifySubmitBtn}
                      onPress={handleClarificationSubmit}
                      disabled={!clarificationAnswer.trim() || intentProcessing}
                    >
                      <Text style={si.clarifySubmitTxt}>Jawab Dein →</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
            <View style={si.intentBtns}>
              {parsedIntent && !parsedIntent.needs_clarification && (parsedIntent.confidence >= 0.7 || (clarificationRounds.current >= 2 && parsedIntent.service_type)) && (
                <TouchableOpacity
                  style={si.theekHaiBtn}
                  onPress={handleConfirmIntent}
                  activeOpacity={0.85}
                >
                  <View style={si.theekHaiBtnContent}>
                    <Text style={si.theekHaiBtnEmoji}>✓</Text>
                    <Text style={si.theekHaiBtnText}>Theek Hai</Text>
                    <Text style={si.theekHaiBtnArrow}>→</Text>
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={si.retryBtn} onPress={() => { setParsedIntent(null); setTranscript(null); setStep('input'); }}>
                <Text style={si.retryTxt}>↻ Dobara</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 'form' && (
          <>
            {/* Service type */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{Strings.quickService.serviceLabel}</Text>
                  <View style={styles.serviceRow}>
                    {SERVICE_TYPES.map(s => (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.serviceChip, serviceType === s.id && styles.serviceChipActive]}
                        onPress={() => setServiceType(s.id)}
                      >
                        <Text style={{ fontSize: 22 }}>{s.icon}</Text>
                        <Text style={[styles.serviceLabel, serviceType === s.id && { color: Colors.primary }]}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Date */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{Strings.booking.dateLabel}</Text>
                  <View style={styles.dateRow}>
                    <TouchableOpacity
                      style={styles.dateArrow}
                      onPress={() => setDate(d => bumpDate(d, -1))}
                    >
                      <Text style={styles.dateArrowText}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.dateValue}>{date}</Text>
                    <TouchableOpacity
                      style={styles.dateArrow}
                      onPress={() => setDate(d => bumpDate(d, 1))}
                    >
                      <Text style={styles.dateArrowText}>›</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Time slot */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Waqt (Start Time)</Text>
                  <View style={styles.timeRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
                      {HOUR_OPTIONS.map(h => (
                        <TouchableOpacity
                          key={`s${h}`}
                          style={[styles.hourChip, startHour === h && styles.hourChipActive]}
                          onPress={() => setStartHour(h)}
                        >
                          <Text style={[styles.hourText, startHour === h && styles.hourTextActive]}>{h}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <Text style={styles.toLabel}>
                    Duration: {durationHours} hours ({startHour} se {endHour} tak)
                  </Text>
                  <View style={styles.timeRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
                      {[1, 2, 3, 4, 5, 6, 8].map(h => (
                        <TouchableOpacity
                          key={`dur${h}`}
                          style={[styles.hourChip, durationHours === h && styles.hourChipActive]}
                          onPress={() => setDurationHours(h)}
                        >
                          <Text style={[styles.hourText, durationHours === h && styles.hourTextActive]}>{h} hrs</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                {/* Price preview */}
                {priceData && (
                  <View style={styles.priceCard}>
                    <Text style={styles.priceLabel}>Takmini Qeemat</Text>
                    <Text style={styles.priceValue}>
                      Rs. {priceData.price_min?.toLocaleString()} – {priceData.price_max?.toLocaleString()}
                    </Text>
                  </View>
                )}

                {/* Error */}
                {error && <Text style={styles.errorText}>{error}</Text>}

                {/* Find matches button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, loadingRank && { opacity: 0.7 }]}
                  onPress={handleFindMatches}
                  disabled={loadingRank}
                  activeOpacity={0.88}
                >
                  {loadingRank
                    ? <ActivityIndicator color={Colors.surface} />
                    : <Text style={styles.primaryBtnText}>🔍 {Strings.booking.findMatchesButton}</Text>
                  }
                </TouchableOpacity>
              </>
            )}

        {step === 'results' && (
          <>
            {/* Gemini explanation */}
            {explanation && (
              <View style={styles.explanationCard}>
                <Text style={styles.explanationIcon}>🤖</Text>
                <Text style={styles.explanationText}>{explanation}</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Top Matches</Text>

            {maids.map((maid, i) => (
              <MaidResultCard
                key={maid.id}
                maid={maid}
                rank={i + 1}
                durationHours={durationHours}
                onSelect={(m) => { setSelectedMaid(m); setStep('confirm'); }}
              />
            ))}

            {error && <Text style={styles.errorText}>{error}</Text>}
          </>
        )}

        {step === 'confirm' && selectedMaid && (
          <>
            <Text style={styles.sectionLabel}>Confirm Booking</Text>

            {/* Selected maid recap */}
            <View style={styles.maidCard}>
              <View style={styles.maidAvatar}>
                <Text style={{ fontSize: 24 }}>🧹</Text>
              </View>
              <View style={styles.maidCardInfo}>
                <Text style={styles.maidCardName}>{selectedMaid.name}</Text>
                <Text style={styles.maidCardMeta}>{selectedMaid.area_label}</Text>
              </View>
            </View>

            {/* Booking summary */}
            <View style={styles.summaryCard}>
              <SummaryRow label="Tarikh" value={date} />
              <SummaryRow label="Waqt" value={`${startHour} – ${endHour}`} />
              <SummaryRow label="Kaam" value={serviceType} />
              {priceData && (
                <SummaryRow
                  label="Qeemat"
                  value={`Rs. ${priceData.recommended_price?.toLocaleString()}`}
                  highlight
                />
              )}
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, confirming && { opacity: 0.7 }]}
              onPress={handleConfirm}
              disabled={confirming}
              activeOpacity={0.88}
            >
              {confirming
                ? <ActivityIndicator color={Colors.surface} />
                : <Text style={styles.primaryBtnText}>✅ {Strings.booking.confirmButton}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.ghostBtn} onPress={() => setStep('results')}>
              <Text style={styles.ghostBtnText}>← Dusri maid chunein</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, highlight }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && { color: Colors.primary, fontFamily: FontFamily.bold }]}>
        {value}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const si = StyleSheet.create({
  intentCard: { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md, borderWidth: 2, borderColor: Colors.primary, gap: Spacing.sm, ...CardShadow },
  intentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  intentTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.primary },
  confBadge: { borderRadius: Layout.borderRadius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  confTxt: { fontFamily: FontFamily.semiBold, fontSize: 11 },
  transcriptTxt: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' },
  intentFields: { gap: 4 },
  fieldTxt: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textPrimary },
  clarifyBox: { backgroundColor: `${Colors.primary}10`, borderRadius: Layout.borderRadius.md, padding: Spacing.sm, borderLeftWidth: 3, borderLeftColor: Colors.primary, gap: 8 },
  clarifyTxt: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textPrimary },
  clarifyInput: { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 8, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textPrimary },
  clarifySubmitBtn: { backgroundColor: Colors.primary, borderRadius: Layout.borderRadius.sm, paddingVertical: 8, alignItems: 'center' },
  clarifySubmitTxt: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.surface },
  intentBtns: { flexDirection: 'row', gap: Spacing.sm },
  theekHaiBtn: {
    flex: 2,
    backgroundColor: '#2D6A4F',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  theekHaiBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  theekHaiBtnText: { color: '#fff', fontSize: 16, fontFamily: FontFamily.bold, letterSpacing: 0.3 },
  theekHaiBtnEmoji: { color: '#fff', fontSize: 18, fontFamily: FontFamily.bold },
  theekHaiBtnArrow: { color: 'rgba(255,255,255,0.7)', fontSize: 18 },
  retryBtn: { flex: 1, backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.md, paddingVertical: Spacing.sm, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, justifyContent: 'center' },
  retryTxt: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textMuted },
});

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
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md },
  section: { gap: Spacing.sm },
  sectionLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textPrimary },
  serviceRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  serviceChip: {
    flex: 1, minWidth: '22%', backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.md, padding: Spacing.sm, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, gap: 4, ...CardShadow,
  },
  serviceChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}12` },
  serviceLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted },
  input: {
    backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md,
    height: Layout.inputHeight, fontFamily: FontFamily.regular, fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.md, borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden',
  },
  dateArrow: { width: 52, height: Layout.inputHeight, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  dateArrowText: { fontSize: 26, color: Colors.primary, lineHeight: 30 },
  dateValue: { flex: 1, textAlign: 'center', fontFamily: FontFamily.semiBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  timeRow: { marginBottom: 4 },
  hourScroll: { flexGrow: 0 },
  hourChip: {
    paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs,
    borderRadius: Layout.borderRadius.md, borderWidth: 1.5, borderColor: Colors.border,
    marginRight: Spacing.xs, backgroundColor: Colors.surface,
  },
  hourChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  hourText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },
  hourTextActive: { color: Colors.surface },
  toLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: 4 },
  priceCard: {
    backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, ...CardShadow,
  },
  priceLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },
  priceValue: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.primary, marginTop: 4 },
  errorText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: Colors.accent, borderRadius: Layout.borderRadius.xl,
    paddingVertical: Spacing.md + 2, alignItems: 'center', ...CardShadow,
  },
  primaryBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.surface },
  ghostBtn: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Layout.borderRadius.xl,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  ghostBtnText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.primary },
  explanationCard: {
    flexDirection: 'row', backgroundColor: `${Colors.primary}10`, borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md, gap: Spacing.sm, alignItems: 'flex-start', borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  explanationIcon: { fontSize: 20 },
  explanationText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textPrimary },
  maidCard: {
    backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1.5, borderColor: Colors.border, ...CardShadow,
  },
  maidRankBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  maidRankText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.surface },
  maidAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  maidCardInfo: { flex: 1 },
  maidCardName: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textPrimary },
  maidCardMeta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  maidCardRate: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.accent, marginTop: 2 },
  maidScoreWrap: { alignItems: 'center' },
  maidScore: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.primary },
  maidScoreLabel: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textMuted },
  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.border, gap: Spacing.sm, ...CardShadow,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted },
  summaryValue: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  muted: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted },
});
