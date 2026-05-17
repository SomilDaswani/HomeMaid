import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

let recordingInstance = null;

/**
 * Request mic permission. Returns true if granted.
 */
export async function requestMicPermission() {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Start recording. Stores instance in module scope.
 * Caller must call stopRecording() to end.
 */
export async function startRecording() {
  if (recordingInstance) {
    try { await recordingInstance.stopAndUnloadAsync(); } catch {}
    recordingInstance = null;
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );

  recordingInstance = recording;
  return recording;
}

/**
 * Stop recording and return the local URI of the audio file.
 * Returns null if nothing was recording.
 */
export async function stopRecording() {
  if (!recordingInstance) return null;

  try {
    await recordingInstance.stopAndUnloadAsync();
    const uri = recordingInstance.getURI();
    recordingInstance = null;

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    return uri;
  } catch (err) {
    recordingInstance = null;
    return null;
  }
}

/**
 * Get recording status (metering level etc).
 * Returns null if not recording.
 */
export async function getRecordingStatus() {
  if (!recordingInstance) return null;
  try {
    return await recordingInstance.getStatusAsync();
  } catch {
    return null;
  }
}

/**
 * Play back a local audio URI.
 * Returns the Sound object so caller can unload it.
 */
export async function playAudio(uri) {
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
  return sound;
}
