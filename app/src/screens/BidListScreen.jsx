import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { Strings } from '../constants/strings';
import CountdownTimer from '../components/CountdownTimer';
import BidCard from '../components/BidCard';
import { useCountdown } from '../hooks/useCountdown';
import { useRealtimeTable } from '../hooks/useRealtime';
import {
  triggerMockBid, selectBid, timeoutQuickService, getQuickServiceBids,
} from '../services/api';

// Staggered mock-bid timings (ms from screen mount)
const MOCK_BID_DELAYS = [4000, 11000, 19000];

export default function BidListScreen({ navigation, route }) {
  const { request } = route.params;

  const [bids, setBids] = useState([]);
  const [selectedBidId, setSelectedBidId] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState(null);
  const [timedOut, setTimedOut] = useState(false);

  const mockBidTimers = useRef([]);
  const didTimeout = useRef(false);

  // ─── 90s countdown ────────────────────────────────────────────────────────
  const { secondsLeft, isExpired } = useCountdown(request.timeout_at, async () => {
    if (didTimeout.current) return;
    didTimeout.current = true;
    setTimedOut(true);
    try { await timeoutQuickService(request.id); } catch {}
  });

  // ─── Supabase Realtime: append new bids without full re-render ──────────
  // NOTE: Realtime INSERT payloads are raw rows with no maid join.
  // We fetch the full bid (with maid name/rating) from the API after each INSERT.
  useRealtimeTable('bids', 'request_id', request.id, async (payload) => {
    if (payload.eventType === 'INSERT' && payload.new) {
      const newId = payload.new.id;
      // Skip if already added by mock-bid timer
      setBids(prev => {
        if (prev.some(b => b.id === newId)) return prev;
        return prev; // hold off until we fetch full data below
      });
      try {
        const data = await getQuickServiceBids(request.id);
        const fullBid = (data?.bids || []).find(b => b.id === newId);
        if (fullBid) {
          setBids(prev => {
            if (prev.some(b => b.id === fullBid.id)) return prev;
            return [...prev, fullBid];
          });
        }
      } catch {
        // Realtime fetch failed — mock-bid timer is the fallback source
      }
    }
  }, !timedOut && !selectedBidId);

  // ─── Staggered mock bids ──────────────────────────────────────────────────
  useEffect(() => {
    if (timedOut) return;

    MOCK_BID_DELAYS.forEach(delay => {
      const t = setTimeout(async () => {
        if (didTimeout.current || selectedBidId) return;
        try {
          const bid = await triggerMockBid(request.id);
          // Realtime will add it — but add directly as fallback if Realtime is slow
          if (bid) {
            setBids(prev => {
              if (prev.some(b => b.id === bid.id)) return prev;
              return [...prev, bid];
            });
          }
        } catch {
          // Silently ignore — if all 3 fail, user sees no-bids empty state
        }
      }, delay);
      mockBidTimers.current.push(t);
    });

    return () => mockBidTimers.current.forEach(clearTimeout);
  }, []); // run once on mount

  // ─── Select a bid ─────────────────────────────────────────────────────────
  const handleSelectBid = useCallback(async (bid) => {
    if (selecting || selectedBidId) return;
    setError(null);
    setSelecting(true);

    try {
      const result = await selectBid(request.id, bid.id);

      if (!result.success) {
        const msg = result.reason === 'maid_already_busy'
          ? Strings.bidList.busyError
          : Strings.bidList.conflictError;
        setError(msg);
        setSelecting(false);
        return;
      }

      setSelectedBidId(bid.id);

      // 400ms pause before navigating (per spec)
      setTimeout(() => {
        navigation.replace('BookingStatus', {
          requestId: request.id,
          maidId: result.maid_id,
          price: result.price,
          maid: bid.maids || bid.maid,
          type: 'quick_service',
        });
      }, 400);
    } catch {
      setError(Strings.errorMessages?.SERVER_ERROR || 'Server mein masla hua.');
      setSelecting(false);
    }
  }, [selecting, selectedBidId, request.id, navigation]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{Strings.bidList.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Countdown + status row */}
      <View style={styles.topRow}>
        <CountdownTimer
          secondsLeft={secondsLeft}
          totalSeconds={90}
          isExpired={timedOut}
        />
        <View style={styles.topInfo}>
          <Text style={styles.topInfoTitle}>
            {timedOut
              ? Strings.bidList.noBids
              : selectedBidId
                ? 'Maid chuni gayi ✓'
                : Strings.bidList.waitingForBids}
          </Text>
          <Text style={styles.topInfoSub}>
            {bids.length > 0 ? `${bids.length} bid${bids.length > 1 ? 's' : ''} aayi` : 'Maids bid kar rahi hain...'}
          </Text>
          {!timedOut && !selectedBidId && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Bid list */}
      {bids.length > 0 ? (
        <FlatList
          data={bids}
          keyExtractor={b => b.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <BidCard
              bid={item}
              index={index}
              selected={item.id === selectedBidId}
              faded={selectedBidId !== null && item.id !== selectedBidId}
              onSelect={handleSelectBid}
            />
          )}
        />
      ) : timedOut ? (
        /* ── Timeout empty state ── */
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⏰</Text>
          <Text style={styles.emptyTitle}>Waqt khatam ho gaya</Text>
          <Text style={styles.emptySubtitle}>Koi bid nahi aayi. Dobara try karein.</Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => navigation.replace('QuickService')}
            >
              <Text style={styles.retryBtnText}>Dobara Try Karein</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.textBtn}
              onPress={() => navigation.navigate('Booking')}
            >
              <Text style={styles.textBtnText}>Booking Schedule Karein</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ── Waiting for bids ── */
        <View style={styles.waitingState}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.waitingText}>Maids bid kar rahi hain...</Text>
          <Text style={styles.waitingSubtext}>Pehli bid aayi wali hai</Text>
        </View>
      )}

      {/* Selecting overlay */}
      {selecting && (
        <View style={styles.selectingOverlay}>
          <ActivityIndicator size="large" color={Colors.surface} />
          <Text style={styles.selectingText}>Choose ho raha hai...</Text>
        </View>
      )}
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
  backText: { fontSize: 24, color: Colors.primary },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.primary,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...CardShadow,
  },
  topInfo: {
    flex: 1,
    gap: 4,
  },
  topInfoTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  topInfoSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: `${Colors.error}15`,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    marginTop: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  liveText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.error,
    letterSpacing: 0.5,
  },
  errorBanner: {
    backgroundColor: `${Colors.error}18`,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
    margin: Spacing.md,
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.sm + 2,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.error,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  waitingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  waitingText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  waitingSubtext: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptyActions: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Layout.borderRadius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...CardShadow,
  },
  retryBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.surface,
  },
  textBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  textBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  selectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  selectingText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.lg,
    color: Colors.surface,
  },
});
