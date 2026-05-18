import { registerRootComponent } from 'expo';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';

import { Colors } from './src/constants/colors';
import { FontFamily, FontSize } from './src/constants/typography';
import { Spacing, Layout } from './src/constants/spacing';
import { Strings } from './src/constants/strings';
import { getOrCreateSession } from './src/services/session';
import { requestNotificationPermission } from './src/lib/notifications';

// Screens
import RoleSelectScreen from './src/screens/RoleSelectScreen';
import HomeMapScreen from './src/screens/HomeMapScreen';
import QuickServiceScreen from './src/screens/QuickServiceScreen';
import BidListScreen from './src/screens/BidListScreen';
import BookingStatusScreen from './src/screens/BookingStatusScreen';
import BookingScreen from './src/screens/BookingScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import DisputeScreen from './src/screens/DisputeScreen';
import MaidProfileScreen from './src/screens/MaidProfileScreen';
import AgentTraceScreen from './src/screens/AgentTraceScreen';
import BookingsListScreen from './src/screens/BookingsListScreen';
import ConfirmationScreen from './src/screens/ConfirmationScreen';

// Placeholder screens for Day 2+ (prevents navigation errors)
const PlaceholderScreen = ({ route }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
    <Text style={{ fontFamily: FontFamily.semiBold, fontSize: FontSize.lg, color: Colors.textMuted }}>
      {route.name} — Coming Day 2
    </Text>
  </View>
);

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

SplashScreen.preventAutoHideAsync().catch(() => {});

// ─── Tab icon renderer ─────────────────────────────────────────────────────────
function TabIcon({ name, focused }) {
  const icons = { Map: '📍', Bookings: '📅', Traces: '🧠' };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{icons[name]}</Text>
  );
}

// ─── Tab navigator ─────────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarLabel: ({ focused }) => (
          <Text style={[
            tabStyles.label,
            { color: focused ? Colors.primary : Colors.textMuted },
          ]}>
            {Strings.tabs[route.name.toLowerCase()] || route.name}
          </Text>
        ),
        tabBarStyle: tabStyles.bar,
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      })}
    >
      <Tab.Screen name="Map" component={HomeMapScreen} />
      <Tab.Screen name="Bookings" component={BookingsListScreen} />
      <Tab.Screen name="Traces" component={AgentTraceScreen} />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 0,
    height: Layout.tabBarHeight,
    paddingBottom: Spacing.sm,
    paddingTop: Spacing.xs,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
});

// ─── Toast config ──────────────────────────────────────────────────────────────
const toastConfig = {
  success: ({ text1 }) => (
    <View style={[toastStyles.toast, { borderLeftColor: Colors.success }]}>
      <Text style={toastStyles.text}>{text1}</Text>
    </View>
  ),
  error: ({ text1 }) => (
    <View style={[toastStyles.toast, { borderLeftColor: Colors.error }]}>
      <Text style={toastStyles.text}>{text1}</Text>
    </View>
  ),
  info: ({ text1 }) => (
    <View style={[toastStyles.toast, { borderLeftColor: Colors.primary }]}>
      <Text style={toastStyles.text}>{text1}</Text>
    </View>
  ),
};

const toastStyles = StyleSheet.create({
  toast: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 4,
    borderRadius: Layout.borderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    marginHorizontal: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
    minWidth: '80%',
  },
  text: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
});

// ─── Root navigator ────────────────────────────────────────────────────────────
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    // Initialize session and request notification permissions on app start
    getOrCreateSession().catch(() => {});
    requestNotificationPermission().catch(() => {});
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="RoleSelect"
            screenOptions={{ headerShown: false, animationEnabled: true }}
          >
            <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
            <Stack.Screen name="MainTabs" component={MainTabs} />

            {/* Modals — pushed on top of tabs */}
            <Stack.Screen name="QuickService" component={QuickServiceScreen}
              options={{ presentation: 'modal' }} />
            <Stack.Screen name="BidList" component={BidListScreen}
              options={{ presentation: 'modal' }} />
            <Stack.Screen name="Booking" component={BookingScreen}
              options={{ presentation: 'modal' }} />
            <Stack.Screen name="MaidProfile" component={MaidProfileScreen}
              options={{ presentation: 'modal' }} />
            <Stack.Screen name="BookingStatus" component={BookingStatusScreen}
              options={{ presentation: 'modal' }} />
            <Stack.Screen name="Review" component={ReviewScreen}
              options={{ presentation: 'modal' }} />
            <Stack.Screen name="Dispute" component={DisputeScreen}
              options={{ presentation: 'modal' }} />
            <Stack.Screen name="Confirmation" component={ConfirmationScreen}
              options={{ presentation: 'modal' }} />
          </Stack.Navigator>
        </NavigationContainer>
        <Toast config={toastConfig} position="top" topOffset={60} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Ensure the root component is properly registered for Expo
registerRootComponent(App);
