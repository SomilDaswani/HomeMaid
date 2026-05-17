import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

// We cannot use react-native-reanimated in Expo Go (SDK 54) — NativeWorklets crash.
// Instead, we drive the SVG ring via a JS-side Animated.Value + addListener.

const SIZE = 120;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * CountdownTimer — SVG ring countdown using React Native Animated (no Reanimated).
 * Props:
 *   secondsLeft  (number)  — current seconds remaining
 *   totalSeconds (number)  — initial total (default 90)
 *   isExpired    (boolean) — shows red ring when true
 */
export default function CountdownTimer({ secondsLeft = 90, totalSeconds = 90, isExpired = false }) {
  const animValue = useRef(new Animated.Value(secondsLeft / totalSeconds)).current;
  const circleRef  = useRef(null);

  useEffect(() => {
    const ratio = Math.max(0, Math.min(1, secondsLeft / totalSeconds));

    // Update the SVG circle directly via listener — avoids Reanimated entirely
    const id = animValue.addListener(({ value }) => {
      if (circleRef.current) {
        circleRef.current.setNativeProps({
          strokeDashoffset: CIRCUMFERENCE * (1 - value),
        });
      }
    });

    Animated.timing(animValue, {
      toValue:         ratio,
      duration:        1100,
      useNativeDriver: false, // SVG props can't use native driver
    }).start();

    return () => animValue.removeListener(id);
  }, [secondsLeft, totalSeconds]);

  const ringColor = isExpired
    ? Colors.error
    : secondsLeft <= 15
      ? Colors.warning
      : Colors.accent;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        {/* Background track */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={Colors.border}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Progress ring — driven by animValue listener */}
        <Circle
          ref={circleRef}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={ringColor}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - (secondsLeft / totalSeconds))}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>

      {/* Center text */}
      <View style={styles.center}>
        {isExpired ? (
          <Text style={[styles.label, { color: Colors.error }]}>Waqt{'\n'}Khatam</Text>
        ) : (
          <>
            <Text style={[styles.time, { color: ringColor }]}>{mm}:{ss}</Text>
            <Text style={styles.subLabel}>baqi hai</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    letterSpacing: 1,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
  subLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
