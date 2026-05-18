import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions (must be called on real device).
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermission() {
  if (!Device.isDevice) {
    console.log('[NOTIF] Not a real device, skipping permission request');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

/**
 * Show a local push notification when booking is confirmed.
 */
export async function sendBookingConfirmationNotification(maid, booking) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Booking Confirmed!',
        body: `${maid?.name || 'Maid'} aap ke ghar aa rahi hain. ${maid?.phone ? `Contact: ${maid.phone}` : ''}`,
        data: { bookingId: booking?.id, screen: 'Confirmation' },
        sound: true,
      },
      trigger: null, // fire immediately
    });
  } catch (err) {
    console.warn('[NOTIF] Failed to send booking confirmation:', err.message);
  }
}

/**
 * Show a local notification when maid is en route.
 */
export async function sendMaidEnRouteNotification(maid) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚗 Maid Raaste Mein Hai!',
        body: `${maid?.name || 'Maid'} aap ke ghar ki taraf aa rahi hain.`,
        sound: true,
      },
      trigger: { seconds: 2 }, // slight delay for realism
    });
  } catch (err) {
    console.warn('[NOTIF] Failed to send en-route notification:', err.message);
  }
}
