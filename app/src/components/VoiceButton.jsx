import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, TextInput,
} from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';
import {
  requestMicPermission, startRecording, stopRecording,
} from '../services/voice';

/**
 * VoiceButton — always shows a text input for Roman Urdu / English service requests.
 * If mic permission is granted, also shows a mic button for recording (animations work
 * but STT is not available — stopping auto-focuses text box so user types).
 *
 * Props:
 *   onTranscript(text)  — called with the typed/submitted text
 *   onProcessing(bool)  — called when processing starts/ends
 *   disabled            — disables all interaction
 */
export default function VoiceButton({ onTranscript, onProcessing, disabled }) {
  const [textInput, setTextInput]     = useState('');
  const [recording, setRecording]     = useState(false);
  const [permGranted, setPermGranted] = useState(false);

  const pulse    = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    requestMicPermission().then(setPermGranted);
  }, []);

  // Pulse animation while recording
  useEffect(() => {
    if (recording) {
      pulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 550, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 550, useNativeDriver: true }),
        ])
      );
      pulseAnim.current.start();
    } else {
      pulseAnim.current?.stop();
      pulse.setValue(1);
    }
  }, [recording]);

  const handleMic = async () => {
    if (disabled) return;
    if (!recording) {
      try {
        await startRecording();
        setRecording(true);
      } catch {
        // mic unavailable — just focus text box
        inputRef.current?.focus();
      }
    } else {
      setRecording(false);
      await stopRecording(); // audio discarded — no STT available
      // Focus text box so user types what they said
      inputRef.current?.focus();
    }
  };

  const handleSubmit = () => {
    const text = textInput.trim();
    if (!text) return;
    onProcessing?.(true);
    onTranscript?.(text);
    setTextInput('');
    // onProcessing(false) is called by parent after extractIntent resolves
  };

  return (
    <View style={styles.container}>

      {/* Always-visible text input */}
      <View style={styles.inputBox}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={textInput}
          onChangeText={setTextInput}
          placeholder={"Likhein: 'Kal subah 2 kamre saaf karwane hain DHA mein...'"}
          placeholderTextColor={Colors.textMuted}
          multiline
          editable={!disabled}
          returnKeyType="done"
        />
      </View>

      {/* Action row: mic + process button */}
      <View style={styles.actionRow}>

        {/* Mic button — shows if permission granted */}
        {permGranted && (
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <TouchableOpacity
              style={[styles.micBtn, recording && styles.micBtnActive]}
              onPress={handleMic}
              disabled={disabled}
              activeOpacity={0.85}
            >
              <Text style={styles.micIcon}>{recording ? '⏹' : '🎙'}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Process button */}
        <TouchableOpacity
          style={[styles.submitBtn, (!textInput.trim() || disabled) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!textInput.trim() || disabled}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>
            {recording ? '⏺ Ruk ke likhein →' : 'Process →'}
          </Text>
        </TouchableOpacity>
      </View>

      {recording && (
        <Text style={styles.recordingNote}>
          🔴 Recording... ruk ke text box mein likhein aur Process dabayein
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  inputBox: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...CardShadow,
  },
  input: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...CardShadow,
  },
  micBtnActive: {
    backgroundColor: Colors.error,
  },
  micIcon: { fontSize: 22 },
  submitBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: Layout.borderRadius.md,
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
    ...CardShadow,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.surface,
  },
  recordingNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.error,
    textAlign: 'center',
  },
});
