import * as Location from 'expo-location';

// Demo fallback — PECHS, central Karachi where mock maids are clustered
const DEMO_CENTER = { lat: 24.8650, lng: 67.0650, isDemo: true };

// Minimum maids required at real location before using demo fallback
const MIN_MAIDS_THRESHOLD = 1;

/**
 * Requests location permission and returns current position.
 * Returns null if permission denied or location unavailable.
 */
export async function getCurrentLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      isDemo: false,
    };
  } catch {
    return null;
  }
}

/**
 * Returns effective location for the app.
 * If real GPS returns no nearby maids, snaps to DEMO_CENTER.
 * The `checkMaidsNearby` param is a function that returns count of nearby maids.
 */
export async function getEffectiveLocation(checkMaidsNearby) {
  const realLocation = await getCurrentLocation();

  if (!realLocation) {
    return DEMO_CENTER;
  }

  try {
    const count = await checkMaidsNearby(realLocation.lat, realLocation.lng);
    if (count < MIN_MAIDS_THRESHOLD) {
      return DEMO_CENTER;
    }
  } catch {
    // Network error — default to real location and let map handle empty state
  }

  return realLocation;
}

/**
 * Converts lat/lng to a human-readable area label.
 * Uses Expo's reverse geocoding — no extra API key needed.
 */
export async function getAreaLabel(lat, lng) {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results.length > 0) {
      const { district, subregion, city } = results[0];
      return district || subregion || city || 'Aapki location';
    }
  } catch {
    // Silently fall back
  }
  return 'Aapki location';
}
