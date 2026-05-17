import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  FlatList,
  ActivityIndicator,
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

export default function HomeMapScreen({ navigation }) {
  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [maids, setMaids] = useState([]);
  const [selectedMaid, setSelectedMaid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

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

      {/* Floating search bar */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
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

      {/* FABs */}
      <SafeAreaView style={styles.fabContainer} edges={['bottom']}>
        <TouchableOpacity
          style={styles.fabPrimary}
          onPress={() => navigation.navigate('QuickService')}
          activeOpacity={0.88}
        >
          <Text style={styles.fabPrimaryText}>⚡ {Strings.map.fabQuickService}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fabSecondary}
          onPress={() => navigation.navigate('Booking')}
          activeOpacity={0.88}
        >
          <Text style={styles.fabSecondaryText}>📅 {Strings.map.fabBookMaid}</Text>
        </TouchableOpacity>
      </SafeAreaView>
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
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  searchBar: {
    margin: Spacing.md,
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
  selectedMaidCard: {
    position: 'absolute',
    bottom: 120,
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
  fabContainer: {
    position: 'absolute',
    bottom: 0,
    right: Spacing.md,
    zIndex: 10,
    gap: Spacing.sm,
    alignItems: 'flex-end',
    paddingBottom: Spacing.sm,
  },
  fabPrimary: {
    backgroundColor: Colors.accent,
    borderRadius: Layout.borderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
    ...CardShadow,
  },
  fabPrimaryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.surface,
  },
  fabSecondary: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...CardShadow,
  },
  fabSecondaryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 180,
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
});
