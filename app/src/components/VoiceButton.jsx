import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Animated, Platform, Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { Spacing, CardShadow, Layout } from '../constants/spacing';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Expo Recording options.
 * iOS: Must use numeric constants for outputFormat, NOT string names.
 * Audio.RecordingOptionsPresets.HIGH_QUALITY uses these internally.
 * We override to get 16kHz mono for smaller uploads + Whisper compatibility.
 */
const RECORDING_OPTIONS = {
  isMeteringEnabled: false,
  android: {
    extension: '.m4a',
    outputFormat: 2, // MediaRecorder.OutputFormat.MPEG_4
    audioEncoder: 3, // MediaRecorder.AudioEncoder.AAC
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat?.MPEG4AAC ?? 'aac',
    audioQuality: Audio.IOSAudioQuality?.MAX ?? 127,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

export default function VoiceButton({ onIntentParsed, onProcessing, sessionId, gpsArea }) {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [statusText, setStatusText] = useState('Awaz sun raha hoon...');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordingRef = useRef(null);

  const PROCESSING_MESSAGES = [
    'Awaz sun raha hoon...',
    'Urdu samajh raha hoon...',
    'AI se intent nikal raha hoon...',
    'Market rate check kar raha hoon...',
    'Best maids dhundh raha hoon...',
  ];

  // Cycle status messages while processing
  useEffect(() => {
    if (!processing) return;
    setStatusText(PROCESSING_MESSAGES[0]);
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % PROCESSING_MESSAGES.length;
      setStatusText(PROCESSING_MESSAGES[i]);
    }, 1500);
    return () => clearInterval(interval);
  }, [processing]);

  // Pulse animation while recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setErrorMsg(null);
      setShowTextFallback(false);

      // 1. Request mic permission FIRST
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Microphone Permission',
          'Awaz record karne ke liye microphone permission chahiye.',
          [{ text: 'OK' }]
        );
        setShowTextFallback(true);
        return;
      }

      // 2. Configure audio session BEFORE preparing recording
      // This is the root cause of iOS error 1718449215 —
      // audio mode must be set to recording before createAsync
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // 3. Now create the recording
      const { recording: rec } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = rec;
      setRecording(rec);
      setIsRecording(true);
    } catch (err) {
      console.error('[VOICE] Start recording failed:', err);
      setErrorMsg('Recording nahi ho saki. Likhein please.');
      setShowTextFallback(true);

      // Reset audio mode on failure
      try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
    }
  };

  const stopAndProcess = async () => {
    if (!recordingRef.current) return;

    setIsRecording(false);
    setProcessing(true);
    onProcessing?.(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setRecording(null);

      // Reset audio mode back to playback after recording stops
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (!uri) throw new Error('No recording URI');

      // Read audio file as base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // POST to backend
      const response = await fetch(`${API_URL}/api/voice/transcribe-and-parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionId ? { 'x-session-id': sessionId } : {}),
        },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: 'audio/m4a',
          sessionId,
          gps_area: gpsArea,
        }),
      });

      const data = await response.json();

      if (data.success && data.intent) {
        onIntentParsed?.(data);
      } else {
        setErrorMsg(data.message || 'Awaz nahi samajh ayi, likhain please.');
        setShowTextFallback(true);
      }
    } catch (err) {
      console.error('[VOICE] Process failed:', err);
      setErrorMsg('Awaz nahi samajh ayi, likhain please.');
      setShowTextFallback(true);

      // Ensure audio mode is reset even on error
      try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
    } finally {
      setProcessing(false);
      onProcessing?.(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setProcessing(true);
    onProcessing?.(true);

    try {
      const response = await fetch(`${API_URL}/api/voice/extract-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionId ? { 'x-session-id': sessionId } : {}),
        },
        body: JSON.stringify({ transcript: textInput.trim(), gps_area: gpsArea }),
      });

      const data = await response.json();
      if (data.success && data.intent) {
        onIntentParsed?.(data);
        setTextInput('');
        setShowTextFallback(false);
      } else {
        setErrorMsg('Samajh nahi aaya. Dobara likhein.');
      }
    } catch {
      setErrorMsg('Network error. Dobara try karein.');
    } finally {
      setProcessing(false);
      onProcessing?.(false);
    }
  };

  if (processing) {
    return (
      <View style={st.container}>
        <View style={st.processingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={st.processingTxt}>{statusText}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={st.container}>
      {/* Main mic button */}
      <Animated.View style={[st.micWrap, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          style={[st.micBtn, isRecording && st.micBtnActive]}
          onPressIn={startRecording}
          onPressOut={stopAndProcess}
          activeOpacity={0.85}
        >
          <Text style={st.micIcon}>{isRecording ? '⏹' : '🎙️'}</Text>
        </TouchableOpacity>
      </Animated.View>
      <Text style={st.hint}>
        {isRecording ? 'Bol rahe hain... Chhorein jab ho jaye' : 'Dabayein aur bolein'}
      </Text>

      {/* Error message */}
      {errorMsg && <Text style={st.errorTxt}>{errorMsg}</Text>}

      {/* Text fallback */}
      {showTextFallback && (
        <View style={st.textFallback}>
          <TextInput
            style={st.textInput}
            placeholder="Yahan likhein... e.g. Kal subah safai chahiye DHA mein"
            placeholderTextColor={Colors.textMuted}
            value={textInput}
            onChangeText={setTextInput}
            multiline
          />
          <TouchableOpacity style={st.sendBtn} onPress={handleTextSubmit} disabled={!textInput.trim()}>
            <Text style={st.sendTxt}>Bhejein →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Always show text option */}
      {!showTextFallback && (
        <TouchableOpacity onPress={() => setShowTextFallback(true)} style={st.textToggle}>
          <Text style={st.textToggleTxt}>⌨️ Likhna chahte hain?</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  micWrap: {},
  micBtn: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    ...CardShadow,
  },
  micBtnActive: { backgroundColor: Colors.error },
  micIcon: { fontSize: 32 },
  hint: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },
  errorTxt: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.error, textAlign: 'center', paddingHorizontal: Spacing.md },
  processingBox: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  processingTxt: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.primary },
  textFallback: { width: '100%', paddingHorizontal: Spacing.md, gap: Spacing.sm },
  textInput: {
    backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.sm,
    fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textPrimary,
    minHeight: 60, textAlignVertical: 'top',
  },
  sendBtn: {
    backgroundColor: Colors.accent, borderRadius: Layout.borderRadius.md,
    paddingVertical: Spacing.sm, alignItems: 'center', ...CardShadow,
  },
  sendTxt: { fontFamily: FontFamily.semiBold, fontSize: FontSize.md, color: Colors.surface },
  textToggle: { paddingVertical: 4 },
  textToggleTxt: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: Colors.primary },
});
