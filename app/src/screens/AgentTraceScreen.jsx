import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, SafeAreaView, StatusBar, LayoutAnimation,
  UIManager, Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { getSessionTraces } from '../services/api';
import { getOrCreateSession } from '../services/session';
import * as Speech from 'expo-speech';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AGENT_COLORS = {
  IntentAgent:        { bg: '#EBF5FF', border: '#4A90D9', icon: '🧠' },
  MatchingAgent:      { bg: '#E8F7F0', border: '#4CAF82', icon: '🎯' },
  PricingAgent:       { bg: '#FFF8E6', border: '#F0A500', icon: '💰' },
  DisputeAgent:       { bg: '#FEECEC', border: '#E05252', icon: '⚖️' },
  ClarifyAgent:       { bg: '#F5F0EB', border: '#7C4A2D', icon: '❓' },
  VoiceAgent:         { bg: '#F3E8FF', border: '#9B59B6', icon: '🎙️' },
  NotificationAgent:  { bg: '#E6F4FF', border: '#4A90D9', icon: '📲' },
};

const DEFAULT_COLORS = { bg: '#F0F0F0', border: '#999', icon: '🤖' };
const AGENT_FILTERS = ['All', 'IntentAgent', 'VoiceAgent', 'MatchingAgent', 'PricingAgent', 'NotificationAgent'];

function TraceCard({ trace }) {
  const [expanded, setExpanded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const colors = AGENT_COLORS[trace.agent_name] || DEFAULT_COLORS;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(v => !v);
  };

  const speakTrace = async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    const text = `${trace.agent_name} says: ${trace.output_summary || 'No output'}`;
    setIsSpeaking(true);
    Speech.speak(text, {
      language: 'en',
      pitch: 1.0,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const meta = trace.full_output?._meta;
  const duration = trace.duration_ms;

  return (
    <TouchableOpacity style={[s.card, { borderLeftColor: colors.border, borderLeftWidth: 4 }]} onPress={toggle} activeOpacity={0.85}>
      <View style={s.cardHeader}>
        <View style={[s.iconBubble, { backgroundColor: colors.bg }]}>
          <Text style={s.iconTxt}>{colors.icon}</Text>
        </View>
        <View style={s.cardMeta}>
          <Text style={s.agentName}>{trace.agent_name || 'Agent'}</Text>
          <Text style={s.timestamp}>{formatTime(trace.created_at)}</Text>
        </View>
        <View style={s.rightMeta}>
          {duration != null && <Text style={s.durationTxt}>{duration}ms</Text>}
          {meta?.model && <Text style={s.modelBadge}>{meta.model}</Text>}
          {meta?.cached && <Text style={s.cacheBadge}>cached</Text>}
          {trace.error && <Text style={s.errorBadge}>error</Text>}
          <TouchableOpacity onPress={speakTrace} style={s.speakBtn}>
            <Text style={s.speakBtnTxt}>{isSpeaking ? '⏹' : '🔊'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsed: show output_summary */}
      <Text style={s.summaryTxt} numberOfLines={expanded ? 99 : 2}>
        {trace.output_summary || 'No output summary'}
      </Text>

      {expanded && (
        <View style={s.expandedBox}>
          {/* Input */}
          <Text style={s.sectionLabel}>Input</Text>
          <Text style={s.codeTxt} selectable>{trace.input_summary || '—'}</Text>

          {/* Full Input */}
          {trace.full_input && (
            <>
              <Text style={s.sectionLabel}>Full Input</Text>
              <Text style={s.codeTxt} selectable>{typeof trace.full_input === 'string' ? trace.full_input : JSON.stringify(trace.full_input, null, 2)}</Text>
            </>
          )}

          {/* Full Output */}
          {trace.full_output && (
            <>
              <Text style={s.sectionLabel}>Full Output</Text>
              <Text style={s.codeTxt} selectable>{typeof trace.full_output === 'string' ? trace.full_output : JSON.stringify(trace.full_output, null, 2)}</Text>
            </>
          )}

          {/* Error */}
          {trace.error && (
            <><Text style={s.sectionLabel}>Error</Text><Text style={[s.codeTxt, { color: Colors.error }]}>{trace.error}</Text></>
          )}

          {/* Meta */}
          {meta && (
            <View style={s.metaRow}>
              {meta.model && <Text style={s.metaChip}>Model: {meta.model}</Text>}
              {meta.attempts > 0 && <Text style={s.metaChip}>Retries: {meta.attempts - 1}</Text>}
              {meta.fallback && <Text style={[s.metaChip, { backgroundColor: '#FFF3E0' }]}>Fallback</Text>}
              {meta.cached && <Text style={[s.metaChip, { backgroundColor: '#E8F7F0' }]}>Cached</Text>}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AgentTraceScreen() {
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    getOrCreateSession().then(setSessionId).catch(() => {});
  }, []);

  const loadTraces = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await getSessionTraces(sessionId);
      // API returns { traces: [...] } — extract the array defensively
      const arr = Array.isArray(data) ? data
        : Array.isArray(data?.traces) ? data.traces
        : Array.isArray(data?.data) ? data.data
        : [];
      setTraces(arr);
    } catch {
      setTraces([]);
    }
    setLoading(false);
  }, [sessionId]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    loadTraces();
    const iv = setInterval(loadTraces, 5000);
    return () => clearInterval(iv);
  }, [loadTraces]);

  const safeTraces = Array.isArray(traces) ? traces : [];
  const filtered = filter === 'All' ? safeTraces : safeTraces.filter(t => t.agent_name === filter);

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={s.header}>
        <Text style={s.title}>🧠 Agent Traces</Text>
        <Text style={s.subtitle}>{safeTraces.length} traces • auto-refresh 5s</Text>
      </View>

      {/* Filter row */}
      <FlatList
        data={AGENT_FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={i => i}
        contentContainerStyle={s.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.filterChip, filter === item && s.filterActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[s.filterTxt, filter === item && s.filterTxtActive]}>
              {item === 'All' ? '📋 All' : (AGENT_COLORS[item]?.icon || '🤖') + ' ' + item.replace('Agent', '')}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48 }}>🕵️</Text>
          <Text style={s.emptyTitle}>Abhi koi trace nahi</Text>
          <Text style={s.emptySub}>Service use karein — har AI decision yahan dikhega.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={t => t.id}
          renderItem={({ item }) => <TraceCard trace={item} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xxl, color: Colors.primary },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Layout.borderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface, marginRight: 6 },
  filterActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}12` },
  filterTxt: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted },
  filterTxtActive: { color: Colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  emptySub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  card: { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md, gap: Spacing.xs, ...CardShadow },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 18 },
  cardMeta: { flex: 1, gap: 1 },
  agentName: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  timestamp: { fontFamily: FontFamily.regular, fontSize: 10, color: Colors.textMuted },
  rightMeta: { alignItems: 'flex-end', gap: 2 },
  durationTxt: { fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textMuted },
  modelBadge: { fontFamily: FontFamily.medium, fontSize: 9, color: Colors.info, backgroundColor: '#E6F4FF', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, overflow: 'hidden' },
  cacheBadge: { fontFamily: FontFamily.medium, fontSize: 9, color: Colors.success, backgroundColor: '#E8F7F0', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, overflow: 'hidden' },
  errorBadge: { fontFamily: FontFamily.medium, fontSize: 9, color: Colors.error, backgroundColor: '#FEECEC', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, overflow: 'hidden' },
  summaryTxt: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 20 },
  expandedBox: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, gap: Spacing.xs, marginTop: Spacing.xs },
  sectionLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.primary, marginTop: 4 },
  codeTxt: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: Colors.textPrimary, backgroundColor: '#F5F0EB', borderRadius: 6, padding: Spacing.sm, lineHeight: 16 },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  metaChip: { fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textMuted, backgroundColor: '#F0F0F0', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  speakBtn: { padding: 4 },
  speakBtnTxt: { fontSize: 16 },
});
