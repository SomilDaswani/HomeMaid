import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import { Strings } from '../constants/strings';
import { getEffectiveLocation } from '../services/location';
import { getNearbyMaids } from '../services/api';
import MaidMapPin from '../components/MaidMapPin';
import MaidCard from '../components/MaidCard';
import NotificationBanner from '../components/NotificationBanner';

const INITIAL_RADIUS = 5000; // 5km

const NAV_ITEMS = [
  { label: 'Booking',       icon: '📅', screen: 'Booking' },
  { label: 'Quick Service', icon: '⚡', screen: 'QuickService' },
  { label: 'Booking List',  icon: '📋', screen: 'BookingsList' },
  { label: 'Traces',        icon: '🧾', screen: 'Traces' },
];

const BOTTOM_TABS = [
  { label: 'Map',           icon: '🗺️',  screen: null },
  { label: 'Bookings',      icon: '📋', screen: 'BookingsList' },
  { label: 'Book Maid',     icon: '📅', screen: 'Booking' },
  { label: 'Quick Service', icon: '⚡', screen: 'QuickService' },
];

export default function HomeMapScreen({ navigation }) {
  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [maids, setMaids] = useState([]);
  const [selectedMaid, setSelectedMaid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-260)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0.45, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(drawerAnim, { toValue: -260, duration: 240, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };

  const loadMaids = useCallback(async (lat, lng) => {
    try {
      setError(null);
      const data = await getNearbyMaids(lat, lng, INITIAL_RADIUS);
      setMaids(data.maids || []);
    } catch {
      setError(Strings.map.errorLoadingMaids);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const loc = await getEffectiveLocation(async (lat, lng) => {
        try {
          const data = await getNearbyMaids(lat, lng, INITIAL_RADIUS);
          return (data.maids || []).length;
        } catch {
          return 0;
        }
      });

      setLocation(loc);
      setIsDemo(loc.isDemo);

      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: loc.lat,
          longitude: loc.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 800);
      }

      await loadMaids(loc.lat, loc.lng);
      setLoading(false);
    })();
  }, [loadMaids]);

  const handlePinPress = (maid) => {
    setSelectedMaid(maid.id === selectedMaid?.id ? null : maid);
  };

  const handleMaidCardPress = (maid) => {
    navigation.navigate('MaidProfile', { maidId: maid.id });
  };

  const handleNavItem = (screen) => {
    closeDrawer();
    setTimeout(() => navigation.navigate(screen), 260);
  };

  const handleBottomTab = (screen) => {
    if (screen) navigation.navigate(screen);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: 24.8650,
          longitude: 67.0650,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={mapStyle}
      >
        {maids.map((maid) => (
          <Marker
            key={maid.id}
            coordinate={{ latitude: maid.lat, longitude: maid.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => handlePinPress(maid)}
          >
            <MaidMapPin
              maid={maid}
              selected={selectedMaid?.id === maid.id}
              onPress={() => handlePinPress(maid)}
            />
          </Marker>
        ))}
      </MapView>

      {/* Floating notification banner */}
      <NotificationBanner />

      {/* Demo mode banner */}
      {isDemo && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>{Strings.map.demoModeBanner}</Text>
        </View>
      )}

      {/* Top overlay: hamburger + search bar */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        <View style={styles.topRow}>
          {/* Hamburger button */}
          <TouchableOpacity style={styles.hamburger} onPress={openDrawer} activeOpacity={0.8}>
            <View style={styles.hambLine} />
            <View style={styles.hambLine} />
            <View style={styles.hambLine} />
          </TouchableOpacity>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Text style={styles.searchBarText} numberOfLines={1}>
              {isDemo ? 'Karachi, Pakistan' : (location ? 'Aapki location' : Strings.map.searchPlaceholder)}
            </Text>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <View style={styles.maidCountChip}>
                <Text style={styles.maidCountText}>
                  {maids.length > 0
                    ? Strings.map.maidsNearby(maids.length)
                    : Strings.map.noMaidsNearby}
                </Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Selected maid bottom card */}
      {selectedMaid && (
        <View style={styles.selectedMaidCard}>
          <MaidCard
            maid={selectedMaid}
            onPress={() => handleMaidCardPress(selectedMaid)}
            rightContent={
              <TouchableOpacity
                style={styles.bookNowBtn}
                onPress={() => navigation.navigate('Booking', { maidId: selectedMaid.id })}
                activeOpacity={0.85}
              >
                <Text style={styles.bookNowText}>Book</Text>
              </TouchableOpacity>
            }
          />
        </View>
      )}

      {/* Error state */}
      {error && !loading && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => location && loadMaids(location.lat, location.lng)}>
            <Text style={styles.retryText}>{Strings.common.retry}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Tab Bar */}
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        {BOTTOM_TABS.map((tab, i) => {
          const isActive = tab.screen === null; // Map tab is always "active"
          return (
            <TouchableOpacity
              key={i}
              style={styles.bottomTab}
              onPress={() => handleBottomTab(tab.screen)}
              activeOpacity={0.75}
            >
              <Text style={styles.bottomTabIcon}>{tab.icon}</Text>
              <Text style={[styles.bottomTabLabel, isActive && styles.bottomTabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.bottomTabDot} />}
            </TouchableOpacity>
          );
        })}
      </SafeAreaView>

      {/* Drawer overlay */}
      {drawerOpen && (
        <Pressable style={styles.drawerOverlay} onPress={closeDrawer}>
          <Animated.View style={[styles.drawerOverlayBg, { opacity: overlayAnim }]} />
        </Pressable>
      )}

      {/* Side Drawer */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
        <SafeAreaView style={styles.drawerInner} edges={['top', 'bottom']}>
          {/* Drawer header */}
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerAppName}>HomeMaid</Text>
            <TouchableOpacity onPress={closeDrawer} style={styles.drawerClose}>
              <Text style={styles.drawerCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.drawerDivider} />

          {/* Nav items */}
          {NAV_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.screen}
              style={styles.drawerItem}
              onPress={() => handleNavItem(item.screen)}
              activeOpacity={0.75}
            >
              <Text style={styles.drawerItemIcon}>{item.icon}</Text>
              <Text style={styles.drawerItemLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

// Subtle warm map style
const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f0eb' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9A8070' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dde8f0' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e8f0e0' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── Top overlay ──────────────────────────────────────────────────────────────
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  hamburger: {
    width: 44,
    height: 44,
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...CardShadow,
  },
  hambLine: {
    width: 20,
    height: 2.5,
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
  },
  searchBar: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...CardShadow,
  },
  searchBarText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    flex: 1,
  },
  maidCountChip: {
    backgroundColor: Colors.primary,
    borderRadius: Layout.borderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  maidCountText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.surface,
  },

  // ── Demo / error banners ─────────────────────────────────────────────────────
  demoBanner: {
    position: 'absolute',
    top: 110,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.accent,
    borderRadius: Layout.borderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    zIndex: 11,
    alignItems: 'center',
  },
  demoBannerText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.surface,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.error,
    borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.surface,
    flex: 1,
  },
  retryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.surface,
    marginLeft: Spacing.sm,
    textDecorationLine: 'underline',
  },

  // ── Selected maid card ────────────────────────────────────────────────────────
  selectedMaidCard: {
    position: 'absolute',
    bottom: 90,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
  },
  bookNowBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Layout.borderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bookNowText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.surface,
  },

  // ── Bottom tab bar ────────────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    zIndex: 20,
    ...CardShadow,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    position: 'relative',
  },
  bottomTabIcon: {
    fontSize: 22,
  },
  bottomTabLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  bottomTabLabelActive: {
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
  },
  bottomTabDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },

  // ── Drawer overlay ────────────────────────────────────────────────────────────
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  drawerOverlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },

  // ── Side Drawer ───────────────────────────────────────────────────────────────
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 260,
    backgroundColor: Colors.surface,
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 16,
  },
  drawerInner: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  drawerAppName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.primary,
  },
  drawerClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerCloseTxt: {
    fontSize: 18,
    color: Colors.textMuted,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Layout.borderRadius.md,
    paddingHorizontal: Spacing.sm,
  },
  drawerItemIcon: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  drawerItemLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
});

