import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

/**
 * Custom map marker for a maid.
 * - Online: brown circle with white person icon + gold dot
 * - Selected: larger circle + gold ring
 */
export default function MaidMapPin({ maid, selected = false, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.wrapper, selected && styles.wrapperSelected]}
    >
      {/* Gold ring on selected */}
      {selected && <View style={styles.selectedRing} />}

      {/* Main pin circle */}
      <View style={[styles.pin, selected && styles.pinSelected]}>
        {/* Person icon — inline SVG-like shape using Views */}
        <View style={styles.headIcon} />
        <View style={styles.bodyIcon} />
      </View>

      {/* Online indicator dot */}
      {maid.is_online && (
        <View style={styles.onlineDot} />
      )}
    </TouchableOpacity>
  );
}

const PIN_SIZE = 40;
const PIN_SIZE_SELECTED = 50;

const styles = StyleSheet.create({
  wrapper: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapperSelected: {
    width: PIN_SIZE_SELECTED,
    height: PIN_SIZE_SELECTED,
  },
  selectedRing: {
    position: 'absolute',
    width: PIN_SIZE_SELECTED,
    height: PIN_SIZE_SELECTED,
    borderRadius: PIN_SIZE_SELECTED / 2,
    borderWidth: 3,
    borderColor: Colors.accent,
    backgroundColor: 'transparent',
  },
  pin: {
    width: PIN_SIZE - 4,
    height: PIN_SIZE - 4,
    borderRadius: (PIN_SIZE - 4) / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  pinSelected: {
    width: PIN_SIZE_SELECTED - 6,
    height: PIN_SIZE_SELECTED - 6,
    borderRadius: (PIN_SIZE_SELECTED - 6) / 2,
  },
  // Simple person silhouette using nested Views
  headIcon: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginBottom: 2,
  },
  bodyIcon: {
    width: 14,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
});
