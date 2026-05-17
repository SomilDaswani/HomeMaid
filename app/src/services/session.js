import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_KEY = 'homemaid_session_id';

// Generates a UUID v4 — works without crypto module in RN
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Web fallback using localStorage (for Expo Web)
const webStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

export async function getOrCreateSession() {
  try {
    let sessionId;
    if (Platform.OS === 'web') {
      sessionId = webStorage.getItem(SESSION_KEY);
      if (!sessionId) {
        sessionId = generateUUID();
        webStorage.setItem(SESSION_KEY, sessionId);
      }
    } else {
      sessionId = await SecureStore.getItemAsync(SESSION_KEY);
      if (!sessionId) {
        sessionId = generateUUID();
        await SecureStore.setItemAsync(SESSION_KEY, sessionId);
      }
    }
    return sessionId;
  } catch {
    // If SecureStore fails, return ephemeral ID (won't persist across restarts)
    return generateUUID();
  }
}

export async function getSession() {
  try {
    if (Platform.OS === 'web') return webStorage.getItem(SESSION_KEY);
    return await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function clearSession() {
  try {
    if (Platform.OS === 'web') {
      webStorage.setItem(SESSION_KEY, '');
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  } catch {
    // Silently fail — session will just be recreated on next open
  }
}
