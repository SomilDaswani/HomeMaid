import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { Strings } from '../constants/strings';
import VoiceButton from '../components/VoiceButton';
import { calculatePrice, createQuickServiceRequest, extractIntent } from '../services/api';
import { getOrCreateSession } from '../services/session';

const SERVICE_TYPES = [
  { id: 'cleaning',  label: 'Safai',     icon: '🧹' },
  { id: 'laundry',   label: 'Dhulai',    icon: '👕' },
  { id: 'cooking',   label: 'Khana',     icon: '🍳' },
  { id: 'childcare', label: 'Bachay',    icon: '👶' },
];

const ROOM_OPTIONS = [1, 2, 3, 4, 5];

export default function QuickServiceScreen({ navigation, route }) {
  const prefill = route?.params?.intent || {}; // from voice intent

  const [serviceType, setServiceType] = useState(prefill.service_type || 'cleaning');
  const [rooms, setRooms] = useState(prefill.rooms || 2);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [priceData, setPriceData] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [intentProcessing, setIntentProcessing] = useState(false);
  const [clarifyQuestion, setClarifyQuestion] = useState(null);

  // Fetch price whenever service/rooms changes
  const fetchPrice = useCallback(async (svc, r) => {
    setLoadingPrice(true);
    try {
      const data = await calculatePrice({
        service_types: [svc],
        complexity: { rooms: r, tasks: selectedTasks, duration_hours: Math.max(1, r * 0.7) },
      });
      setPriceData(data);
    } catch {
      setPriceData(null);
    } finally {
      setLoadingPrice(false);
    }
  }, [selectedTasks]);

  const handleServiceChange = (id) => {
    setServiceType(id);
    fetchPrice(id, rooms);
  };

  const handleRoomChange = (r) => {
    setRooms(r);
    fetchPrice(serviceType, r);
  };

  // Handle transcript from VoiceButton — extract intent and pre-fill form
  const handleTranscript = async (text) => {
    setIntentProcessing(true);
    setClarifyQuestion(null);
    try {
      const result = await extractIntent(text);
      if (result?.intent) {
        const intent = result.intent;
        if (intent.service_type) setServiceType(intent.service_type);
        if (intent.rooms) setRooms(intent.rooms);
        if (result.needs_clarification && result.clarifying_question) {
          setClarifyQuestion(result.clarifying_question);
        }
        fetchPrice(intent.service_type || serviceType, intent.rooms || rooms);
      }
    } catch {
      // Silently fall through — user can still fill form manually
    } finally {
      setIntentProcessing(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const sessionId = await getOrCreateSession();
      const request = await createQuickServiceRequest({
        session_id: sessionId,
        service_types: [serviceType],
        complexity: 'simple',
        tasks: selectedTasks,
        lat: 24.8650,  // replaced by real location from location service in production
        lng: 67.0650,
        area_label: 'Karachi',
        price_min: priceData?.price_min || 600,
        price_max: priceData?.price_max || 1400,
        estimated_price: priceData?.recommended_price || 900,
      });

      navigation.replace('BidList', { request });
    } catch (err) {
      alert('Request nahi bheji ja saki. Dobara try karein.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{Strings.quickService.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Voice input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bolen ya likhein</Text>
          <VoiceButton
            onTranscript={handleTranscript}
            onProcessing={setIntentProcessing}
            disabled={submitting}
          />
          {intentProcessing && (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.processingText}>Samajh raha hai...</Text>
            </View>
          )}
          {clarifyQuestion && (
            <View style={styles.clarifyBubble}>
              <Text style={styles.clarifyText}>🤖 {clarifyQuestion}</Text>
            </View>
          )}
        </View>

        {/* Service type picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{Strings.quickService.serviceLabel}</Text>
          <View style={styles.serviceRow}>
            {SERVICE_TYPES.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.serviceChip, serviceType === s.id && styles.serviceChipActive]}
                onPress={() => handleServiceChange(s.id)}
              >
                <Text style={styles.serviceIcon}>{s.icon}</Text>
                <Text style={[styles.serviceLabel, serviceType === s.id && styles.serviceLabelActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Room count */}
        {serviceType === 'cleaning' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Kitne kamre?</Text>
            <View style={styles.roomRow}>
              {ROOM_OPTIONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roomChip, rooms === r && styles.roomChipActive]}
                  onPress={() => handleRoomChange(r)}
                >
                  <Text style={[styles.roomText, rooms === r && styles.roomTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Price preview */}
        <View style={styles.priceCard}>
          {loadingPrice ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : priceData ? (
            <>
              <Text style={styles.priceLabel}>Takmini Qeemat</Text>
              <Text style={styles.priceValue}>
                Rs. {priceData.price_min?.toLocaleString()} – {priceData.price_max?.toLocaleString()}
              </Text>
              <Text style={styles.priceNote}>Final qeemat maid ki bid par hogi</Text>
            </>
          ) : (
            <TouchableOpacity onPress={() => fetchPrice(serviceType, rooms)}>
              <Text style={styles.priceFetchBtn}>Qeemat dekhein →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.88}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={styles.submitBtnText}>⚡ {Strings.quickService.submitButton}</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 24,
    color: Colors.primary,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.primary,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  serviceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  serviceChip: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 4,
    ...CardShadow,
  },
  serviceChipActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}12`,
  },
  serviceIcon: { fontSize: 24 },
  serviceLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  serviceLabelActive: {
    color: Colors.primary,
  },
  roomRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roomChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  roomChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  roomText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  roomTextActive: {
    color: Colors.surface,
  },
  priceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 80,
    justifyContent: 'center',
    ...CardShadow,
  },
  priceLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  priceValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    color: Colors.primary,
    marginTop: 4,
  },
  priceNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  priceFetchBtn: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Layout.borderRadius.xl,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    ...CardShadow,
    marginTop: Spacing.sm,
  },
  submitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.surface,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  processingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  clarifyBubble: {
    backgroundColor: `${Colors.primary}10`,
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  clarifyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
});
