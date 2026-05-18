import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, SafeAreaView, StatusBar, Animated,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { getQuickServiceBids, triggerMockBid, selectBid } from '../services/api';

function CountdownTimer({ expiresAt }) {
  const [remaining, setRemaining] = useState('');
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); setUrgent(true); return; }
      const m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, '0')}`);
      setUrgent(diff < 60000);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  if (!remaining) return null;
  return <Text style={[s.countdown, urgent && s.countdownUrgent]}>⏱ {remaining}</Text>;
}

function BidCard({ bid, onSelect, selecting }) {
  const slideY = useRef(new Animated.Value(60)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);
  const maid = bid.maids || {};
  const initials = (maid.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Animated.View style={{ transform: [{ translateY: slideY }], opacity: fade }}>
      <TouchableOpacity style={[s.bidCard, bid.is_best_value && s.bestCard]}
        onPress={() => onSelect(bid)} disabled={selecting || bid.status !== 'pending'} activeOpacity={0.85}>
        {bid.is_best_value && <View style={s.bestBadge}><Text style={s.bestText}>⭐ Best Value</Text></View>}
        <View style={s.bidRow}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{initials}</Text></View>
          <View style={s.bidInfo}>
            <Text style={s.maidName}>{maid.name || 'Maid'}</Text>
            <View style={s.ratingRow}>
              <Text style={s.star}>⭐ {parseFloat(maid.avg_rating||0).toFixed(1)}</Text>
              <Text style={s.dot}>•</Text>
              <Text style={s.meta}>{maid.jobs_completed||0} jobs</Text>
              <Text style={s.dot}>•</Text>
              <Text style={s.meta}>{maid.area_label||''}</Text>
            </View>
            {bid.bid_message && <Text style={s.msg} numberOfLines={2}>"{bid.bid_message}"</Text>}
          </View>
          <View style={s.priceCol}>
            <Text style={s.price}>Rs. {bid.offered_price?.toLocaleString()}</Text>
            {bid.eta_minutes && <Text style={s.eta}>{bid.eta_minutes} min</Text>}
            <CountdownTimer expiresAt={bid.expires_at} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function PulseIcon() {
  const p = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(p, { toValue: 1.15, duration: 800, useNativeDriver: true }),
      Animated.timing(p, { toValue: 1, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.Text style={[s.emptyIcon, { transform: [{ scale: p }] }]}>📡</Animated.Text>;
}

export default function BidListScreen({ navigation, route }) {
  const { request } = route.params || {};
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [sortBy, setSortBy] = useState('price');

  const loadBids = useCallback(async () => {
    if (!request?.id) return;
    try { const r = await getQuickServiceBids(request.id); setBids(r?.bids || []); } catch {}
    setLoading(false);
  }, [request?.id]);

  useEffect(() => { loadBids(); const iv = setInterval(loadBids, 3000); return () => clearInterval(iv); }, [loadBids]);

  useEffect(() => {
    if (!request?.id) return;
    const fire = async (d) => { await new Promise(r => setTimeout(r, d)); try { await triggerMockBid(request.id); } catch {} };
    fire(2000); fire(5000); fire(9000); fire(14000); fire(20000);
  }, [request?.id]);

  const handleSelect = async (bid) => {
    setSelecting(true);
    try {
      const res = await selectBid(request.id, bid.id);
      if (res.success || res.maid_id) {
        navigation.replace('Confirmation', {
          maid: bid.maids, price: bid.offered_price,
          service_type: request.service_types?.[0] || 'cleaning',
          booking_id: request.id, source: 'quick_service',
          bid_message: bid.bid_message, eta_minutes: bid.eta_minutes,
        });
      } else { alert(res.reason || 'Yeh bid ab available nahi hai.'); }
    } catch { alert('Bid select nahi ho saki.'); }
    setSelecting(false);
  };

  const sorted = [...bids].sort((a, b) => sortBy === 'rating'
    ? (b.maids?.avg_rating||0) - (a.maids?.avg_rating||0)
    : (a.offered_price||0) - (b.offered_price||0));

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <View><Text style={s.title}>Bids Aa Rahi Hain</Text><Text style={s.sub}>{bids.length} bid{bids.length !== 1 ? 's' : ''}</Text></View>
        <View style={{ width: 40 }} />
      </View>
      {bids.length > 0 && (
        <View style={s.sortRow}>
          <TouchableOpacity style={[s.sortChip, sortBy==='price' && s.sortAct]} onPress={() => setSortBy('price')}>
            <Text style={[s.sortTxt, sortBy==='price' && s.sortTxtAct]}>💰 Qeemat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.sortChip, sortBy==='rating' && s.sortAct]} onPress={() => setSortBy('rating')}>
            <Text style={[s.sortTxt, sortBy==='rating' && s.sortTxtAct]}>⭐ Rating</Text>
          </TouchableOpacity>
        </View>
      )}
      {loading ? <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
       : bids.length === 0 ? <View style={s.center}><PulseIcon /><Text style={s.emptyTitle}>Koi bid nahi aayi abhi...</Text><Text style={s.emptySub}>Nazdeeki maids ko request bhej di gayi. Thoda intezaar karein.</Text></View>
       : <FlatList data={sorted} keyExtractor={b => b.id} renderItem={({ item }) => <BidCard bid={item} onSelect={handleSelect} selecting={selecting} />} contentContainerStyle={s.list} showsVerticalScrollIndicator={false} />}
      {selecting && <View style={s.overlay}><ActivityIndicator size="large" color={Colors.surface} /><Text style={s.overlayTxt}>Bid select ho rahi hai...</Text></View>}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 24, color: Colors.primary },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.primary },
  sub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  sortRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sortChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Layout.borderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  sortAct: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}12` },
  sortTxt: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },
  sortTxtAct: { color: Colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  emptySub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  bidCard: { backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border, ...CardShadow },
  bestCard: { borderColor: Colors.accent, borderWidth: 2 },
  bestBadge: { position: 'absolute', top: -10, right: Spacing.md, backgroundColor: Colors.accent, borderRadius: Layout.borderRadius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  bestText: { fontFamily: FontFamily.semiBold, fontSize: 10, color: Colors.surface },
  bidRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.surface },
  bidInfo: { flex: 1, gap: 3 },
  maidName: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.textPrimary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  star: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.accent },
  dot: { color: Colors.textMuted, fontSize: FontSize.xs },
  meta: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted },
  msg: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  priceCol: { alignItems: 'flex-end', gap: 2 },
  price: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.primary },
  eta: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.success },
  countdown: { fontFamily: FontFamily.medium, fontSize: 10, color: Colors.textMuted },
  countdownUrgent: { color: Colors.error },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  overlayTxt: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.surface },
});
