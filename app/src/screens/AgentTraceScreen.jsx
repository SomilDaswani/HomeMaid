import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, SafeAreaView, StatusBar, Alert,
  Share, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { getSessionTraces } from '../services/api';
import { getOrCreateSession } from '../services/session';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Agent color coding ────────────────────────────────────────────────────────
const AGENT_COLORS = {
  IntentAgent:    { bg: '#E8F4FF', border: '#4A90D9', text: '#1A5A9A' },
  ClarifyAgent:   { bg: '#FFF8E6', border: '#D4A853', text: '#7A5A10' },
  MatchingAgent:  { bg: '#E8F7F0', border: '#4CAF82', text: '#1A6A40' },
  PricingAgent:   { bg: '#F7F0E8', border: '#7C4A2D', text: '#4A2010' },
  DisputeAgent:   { bg: '#FEECEC', border: '#E05252', text: '#8A1010' },
};

function agentStyle(name) {
  for (const key of Object.keys(AGENT_COLORS)) {
    if (name?.includes(key.replace('Agent', ''))) return AGENT_COLORS[key];
  }
  return { bg: '#F0F0F0', border: '#AAAAAA', text: '#555555' };
}

// ── Single trace card ─────────────────────────────────────────────────────────
function TraceCard({ trace }) {
  const [expanded, setExpanded] = useState(false);
  const color = agentStyle(trace.agent_name);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(v => !v);
  };

  const latencyMs = trace.latency_ms != null ? `${trace.latency_ms}ms` : '—';
  const ts = new Date(trace.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: color.border }]}
      onPress={toggleExpand}
      activeOpacity={0.88}
    >
      {/* Card header row */}
      <View style={styles.cardHeader}>
        <View style={[styles.agentBadge, { backgroundColor: color.bg, borderColor: color.border }]}>
          <Text style={[styles.agentName, { color: color.text }]}>{trace.agent_name}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>{latencyMs}</Text>
          <Text style={styles.metaText}>{ts}</Text>
          {trace.error && <Text style={styles.errorDot}>⚠</Text>}
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>

      {/* Session type label */}
      <Text style={styles.sessionType}>{trace.session_type}</Text>

      {/* Expanded: show prompt + output */}
      {expanded && (
        <View style={styles.expandedContent}>
          {/* Output */}
          <Text style={styles.expandLabel}>Output</Text>
          <View style={[styles.codeBlock, { backgroundColor: color.bg }]}>
            <Text style={styles.codeText}>
              {trace.output != null
                ? JSON.stringify(trace.output, null, 2)
                : trace.error || '(no output)'}
            </Text>
          </View>

          {/* Prompt — collapsed behind another toggle to keep it clean */}
          <Text style={styles.expandLabel}>Prompt (first 300 chars)</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText} numberOfLines={8}>
              {(trace.prompt || '').slice(0, 300)}{trace.prompt?.length > 300 ? '…' : ''}
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AgentTraceScreen({ navigation }) {
  const [traces, setTraces]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const loadTraces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionId = await getOrCreateSession();
      const data = await getSessionTraces(sessionId);
      setTraces(data?.traces || []);
    } catch {
      setError('Traces load nahi hui.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTraces(); }, []);

  const handleExport = async () => {
    if (!traces.length) {
      Alert.alert('Koi trace nahi', 'Abhi koi agent call nahi hui.');
      return;
    }
    try {
      await Share.share({
        message: JSON.stringify(traces, null, 2),
        title:   'HomeMaid Agent Traces',
      });
    } catch {
      // Silently ignore share cancellation
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
        <View>
          <Text style={styles.title}>Agent Traces</Text>
          <Text style={styles.subtitle}>{traces.length} calls this session</Text>
        </View>
        <TouchableOpacity onPress={handleExport} style={styles.exportBtn}>
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Filter legend */}
      <View style={styles.legend}>
        {Object.entries(AGENT_COLORS).map(([name, c]) => (
          <View key={name} style={[styles.legendChip, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Text style={[styles.legendText, { color: c.text }]}>{name.replace('Agent', '')}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadTraces} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : traces.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🤖</Text>
          <Text style={styles.emptyTitle}>Koi trace nahi mili</Text>
          <Text style={styles.emptySubtitle}>
            Quick Service ya Booking use karein to Gemini agent calls yahan dikhein gi.
          </Text>
          <TouchableOpacity onPress={loadTraces} style={styles.retryBtn}>
            <Text style={styles.retryText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={traces}
          keyExtractor={(t, i) => t.id || String(i)}
          renderItem={({ item }) => <TraceCard trace={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={loadTraces}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  exportBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Layout.borderRadius.md, borderWidth: 1.5, borderColor: Colors.primary,
  },
  exportText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.sm, color: Colors.primary },
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  legendChip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Layout.borderRadius.sm, borderWidth: 1,
  },
  legendText: { fontFamily: FontFamily.medium, fontSize: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  errorText: { fontFamily: FontFamily.medium, fontSize: FontSize.md, color: Colors.error, textAlign: 'center' },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  emptySubtitle: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm,
    color: Colors.textMuted, textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Layout.borderRadius.md, backgroundColor: Colors.primary,
  },
  retryText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.surface },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: {
    backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border,
    borderLeftWidth: 4, gap: 6, ...CardShadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  agentBadge: {
    borderRadius: Layout.borderRadius.sm, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  agentName: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs },
  cardMeta: { flex: 1, flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  metaText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  errorDot: { fontSize: FontSize.sm, color: Colors.error },
  chevron: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.textMuted },
  sessionType: {
    fontFamily: FontFamily.regular, fontSize: FontSize.xs,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  expandedContent: { marginTop: Spacing.sm, gap: Spacing.sm },
  expandLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase' },
  codeBlock: {
    backgroundColor: '#F5F5F5', borderRadius: Layout.borderRadius.sm,
    padding: Spacing.sm,
  },
  codeText: { fontFamily: 'monospace', fontSize: 11, color: Colors.textPrimary },
});
