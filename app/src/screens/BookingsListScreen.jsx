import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, StatusColors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { Strings } from '../constants/strings';
import { getHomeownerBookings } from '../services/api';
import { getOrCreateSession } from '../services/session';

// ── Single booking card ───────────────────────────────────────────────────────
function BookingCard({ booking, onPress }) {
  const status = booking.status || 'pending';
  const sc = StatusColors[status] || StatusColors.pending;

  const dateStr = booking.scheduled_date
    ? new Date(booking.scheduled_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const services = (booking.service_types || [])
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(', ');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {/* Top row: service + status badge */}
      <View style={styles.cardTop}>
        <Text style={styles.serviceText} numberOfLines={1}>{services || 'Service'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>
            {Strings.statusLabels[status] || status}
          </Text>
        </View>
      </View>

      {/* Maid name row */}
      <Text style={styles.maidName}>
        🧹 {booking.maid?.name || 'Maid'}
      </Text>

      {/* Date + price row */}
      <View style={styles.cardBottom}>
        <Text style={styles.dateText}>{dateStr}</Text>
        {booking.agreed_price != null && (
          <Text style={styles.priceText}>Rs. {booking.agreed_price.toLocaleString()}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>Koi booking nahi</Text>
      <Text style={styles.emptySubtitle}>
        Map se maid book karein ya Quick Service use karein.
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BookingsListScreen({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  // Reload every time the tab is focused
  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        setLoading(true);
        setError(null);
        try {
          const sessionId = await getOrCreateSession();
          const data = await getHomeownerBookings(sessionId);
          if (active) setBookings(data?.bookings || []);
        } catch {
          if (active) setError(Strings.common.error);
        } finally {
          if (active) setLoading(false);
        }
      };

      load();
      return () => { active = false; };
    }, [])
  );

  const handleCardPress = (booking) => {
    navigation.navigate('BookingStatus', {
      requestId: booking.id,
      maid:      booking.maid || {},
      price:     booking.agreed_price || 0,
      type:      'booking',
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Meri Bookings</Text>
        {bookings.length > 0 && (
          <Text style={styles.count}>{bookings.length}</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id || String(Math.random())}
          renderItem={({ item }) => (
            <BookingCard booking={item} onPress={() => handleCardPress(item)} />
          )}
          contentContainerStyle={[styles.list, !bookings.length && { flex: 1 }]}
          ListEmptyComponent={EmptyState}
          showsVerticalScrollIndicator={false}
          onRefresh={async () => {
            setLoading(true);
            try {
              const sessionId = await getOrCreateSession();
              const data = await getHomeownerBookings(sessionId);
              setBookings(data?.bookings || []);
            } catch {
              setError(Strings.common.error);
            } finally {
              setLoading(false);
            }
          }}
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: Colors.primary },
  count: {
    fontFamily: FontFamily.bold, fontSize: FontSize.sm,
    color: Colors.surface, backgroundColor: Colors.primary,
    borderRadius: 12, paddingHorizontal: Spacing.sm, paddingVertical: 2,
    minWidth: 24, textAlign: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: FontFamily.medium, fontSize: FontSize.md, color: Colors.error, textAlign: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.border,
    gap: Spacing.xs,
    ...CardShadow,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceText: {
    fontFamily: FontFamily.semiBold, fontSize: FontSize.md,
    color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm,
  },
  statusBadge: {
    borderRadius: Layout.borderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  statusText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.xs },
  maidName: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted },
  priceText: { fontFamily: FontFamily.bold, fontSize: FontSize.md, color: Colors.primary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.textPrimary },
  emptySubtitle: {
    fontFamily: FontFamily.regular, fontSize: FontSize.sm,
    color: Colors.textMuted, textAlign: 'center',
  },
});
