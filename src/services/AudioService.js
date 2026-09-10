import {
  AudioModule,
  createAudioPlayer,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

// High-clarity 16kHz mono AAC preset with hardware VoIP echo cancellation & noise suppression
const CALL_AUDIO_OPTIONS = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: false,
  outputFormat: 'mpeg4',
  audioEncoder: 'aac',
  audioSource: 'voice_communication', // Android DSP hardware Echo Cancellation (AEC) + Noise Suppression (NS)
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    audioSource: 'voice_communication',
  },
  ios: {
    extension: '.m4a',
    outputFormat: 'aac ',
    audioQuality: 32,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
  },
};

// Voice notes: standard 44.1kHz AAC preset with crisp speech capture
const VOICE_NOTE_OPTIONS = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: false,
  outputFormat: 'mpeg4',
  audioEncoder: 'aac',
  audioSource: 'mic',
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    audioSource: 'mic',
  },
  ios: {
    extension: '.m4a',
    outputFormat: 'aac ',
    audioQuality: 96,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
  },
};

class AudioService {
  constructor() {
    this.currentRecording = null;
    this.currentPlayer = null;
    this.currentlyPlayingId = null;
    this.recordingStartTime = 0;
    this.isRecording = false;

    // Active call streaming state
    this.isCallActive = false;
    this.isMuted = false;
    this.callRecording = null;
    this.callChunkIndex = 0;
    this.callChunkTimer = null;
    this.onCallChunkCallback = null;
    this.playQueue = [];
    this.isPlayingQueue = false;
    this.callPlayer = null;
  }

  /**
   * Request microphone permissions
   */
  async requestPermissions() {
    try {
      const response = await requestRecordingPermissionsAsync();
      return response.granted === true || response.status === 'granted';
    } catch (e) {
      console.error('Audio permission request failed:', e);
      return false;
    }
  }

  /**
   * Configure audio mode for messaging & calls
   * Uses 'mixWithOthers' so playback and recording can run simultaneously in full-duplex
   */
  async setAudioMode(isCall = false, speakerOn = true) {
    try {
      await setAudioModeAsync({
        allowsRecording: isCall,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: isCall && !speakerOn,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        allowsBackgroundRecording: false,
      });
    } catch (e) {
      console.warn('Set audio mode warning:', e);
    }
  }

  // ─── Voice Notes (WhatsApp style) ──────────────────────────

  /**
   * Start recording a voice note
   */
  async startVoiceRecording(onStatusUpdate = null) {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Microphone permission not granted');
    }

    // Stop any active playback
    await this.stopSound();
    await this.setAudioMode(false);

    try {
      const recorder = new AudioModule.AudioRecorder(VOICE_NOTE_OPTIONS);
      await recorder.prepareToRecordAsync(VOICE_NOTE_OPTIONS);

      if (onStatusUpdate) {
        recorder.addListener('recordingStatusUpdate', (status) => {
          onStatusUpdate({
            isRecording: status.isRecording,
            durationMillis: (status.currentTime || 0) * 1000,
          });
        });
      }

      recorder.record();
      this.currentRecording = recorder;
      this.recordingStartTime = Date.now();
      this.isRecording = true;
      return true;
    } catch (error) {
      console.error('Failed to start voice recording:', error);
      this.currentRecording = null;
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Stop recording voice note and return base64 payload & duration
   */
  async stopVoiceRecording() {
    if (!this.currentRecording) return null;

    try {
      const durationSec = Math.max(1, Math.round((Date.now() - this.recordingStartTime) / 1000));
      const preUri = this.currentRecording.uri;
      await this.currentRecording.stop();
      const finalUri = preUri || this.currentRecording.uri;
      this.currentRecording = null;
      this.isRecording = false;

      if (!finalUri) {
        console.warn('No recording URI returned');
        return null;
      }

      // Read audio file as base64 string using legacy filesystem API
      const base64 = await FileSystem.readAsStringAsync(finalUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Cleanup local recording cache
      try {
        await FileSystem.deleteAsync(finalUri, { idempotent: true });
      } catch (e) { }

      return {
        uri: finalUri,
        base64: `data:audio/m4a;base64,${base64}`,
        duration: durationSec,
      };
    } catch (error) {
      console.error('Failed to stop voice recording:', error);
      this.currentRecording = null;
      this.isRecording = false;
      return null;
    }
  }

  /**
   * Discard/cancel current recording without saving
   */
  async cancelVoiceRecording() {
    if (!this.currentRecording) return;
    try {
      const uri = this.currentRecording.uri;
      await this.currentRecording.stop();
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch (e) { }
    this.currentRecording = null;
    this.isRecording = false;
  }

  // ─── Voice Note Playback ───────────────────────────────────

  /**
   * Play or resume a voice note
   */
  async playVoiceNote(id, audioData, onPlaybackStatusUpdate) {
    // If already playing this voice note, toggle pause/play
    if (this.currentlyPlayingId === id && this.currentPlayer) {
      if (this.currentPlayer.playing) {
        this.currentPlayer.pause();
        return { isPlaying: false };
      } else {
        this.currentPlayer.play();
        return { isPlaying: true };
      }
    }

    // Stop whatever else is playing
    await this.stopSound();

    let playUri = audioData;

    // If it's a base64 data string, write to a temp cache file for smooth playback
    if (audioData.startsWith('data:audio') || !audioData.startsWith('file://')) {
      try {
        const rawBase64 = audioData.includes('base64,') ? audioData.split('base64,')[1] : audioData;
        const cacheFile = `${FileSystem.cacheDirectory}vn_${id.replace(/[^a-zA-Z0-9]/g, '_')}.m4a`;
        await FileSystem.writeAsStringAsync(cacheFile, rawBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        playUri = cacheFile;
      } catch (err) {
        console.warn('Failed to write audio cache file, using raw data:', err);
      }
    }

    try {
      await this.setAudioMode(false);
      const player = createAudioPlayer(playUri);
      player.play();

      player.addListener('playbackStatusUpdate', (status) => {
        if (onPlaybackStatusUpdate) {
          onPlaybackStatusUpdate({
            isLoaded: status.isLoaded,
            isPlaying: status.playing,
            durationMillis: (status.duration || 0) * 1000,
            positionMillis: (status.currentTime || 0) * 1000,
            didJustFinish: status.didJustFinish,
          });
        }
        if (status.didJustFinish) {
          this.currentlyPlayingId = null;
        }
      });

      this.currentPlayer = player;
      this.currentlyPlayingId = id;
      return { isPlaying: true };
    } catch (error) {
      console.error('Error playing sound:', error);
      this.currentlyPlayingId = null;
      return { isPlaying: false };
    }
  }

  /**
   * Stop active playback
   */
  async stopSound() {
    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause();
        this.currentPlayer.remove();
      } catch (e) { }
      this.currentPlayer = null;
      this.currentlyPlayingId = null;
    }
  }

  // ─── Real-Time Voice Calling (Low-Latency & Anti-Feedback) ─

  /**
   * Start call audio session: continuous micro-chunk transmitter
   */
  async startCallStreaming(onChunkReady, speakerOn = true) {
    this.isCallActive = true;
    this.onCallChunkCallback = onChunkReady;
    this.callChunkIndex = 0;
    this.playChunkIndex = 0;
    this.playQueue = [];
    this.isPlayingQueue = false;

    // Enable VoIP mode with hardware echo cancellation (AEC) and loudspeaker default
    await this.setAudioMode(true, speakerOn);

    try {
      this.callRecording = new AudioModule.AudioRecorder(CALL_AUDIO_OPTIONS);
    } catch (e) {
      console.warn('Error creating call recording instance:', e);
    }

    try {
      this.callPlayer = createAudioPlayer(null);
    } catch (e) {
      console.warn('Error creating call player instance:', e);
    }

    console.log('[AudioService] Call audio streaming started (speakerOn =', speakerOn, ')');
    this.cycleCallRecordingChunk();
  }

  /**
   * Continuous 1000ms speech slice cycle for clear real-time VoIP voice
   * Hardware voice_communication DSP provides echo cancellation & noise suppression
   */
  async cycleCallRecordingChunk() {
    if (!this.isCallActive) return;

    if (this.isMuted) {
      this.callChunkTimer = setTimeout(() => {
        this.cycleCallRecordingChunk();
      }, 500);
      return;
    }

    try {
      if (!this.callRecording) {
        this.callRecording = new AudioModule.AudioRecorder(CALL_AUDIO_OPTIONS);
      }
      const rec = this.callRecording;
      await rec.prepareToRecordAsync(CALL_AUDIO_OPTIONS);
      rec.record();

      // 1000ms chunk interval ensures words and sentences stay intact without rapid start/stop clipping
      this.callChunkTimer = setTimeout(async () => {
        if (!this.isCallActive) return;
        try {
          const preUri = rec.uri;
          await rec.stop();
          const finalUri = preUri || rec.uri;

          if (finalUri && this.onCallChunkCallback && !this.isMuted) {
            const base64 = await FileSystem.readAsStringAsync(finalUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            this.callChunkIndex += 1;
            console.log(`[AudioService] Sending mic chunk #${this.callChunkIndex} (bytes: ${base64.length})`);
            this.onCallChunkCallback(base64, this.callChunkIndex);

            // Clean up temporary chunk file
            try {
              await FileSystem.deleteAsync(finalUri, { idempotent: true });
            } catch (delErr) { }
          }
        } catch (err) {
          console.warn('Error closing call recording chunk:', err);
          try { await rec.stop(); } catch (e) { }
          this.callRecording = null;
        }

        // Trigger next chunk slice immediately
        if (this.isCallActive) {
          this.cycleCallRecordingChunk();
        }
      }, 1000);
    } catch (e) {
      console.warn('Call recording chunk error:', e);
      this.callRecording = null;
      if (this.isCallActive) {
        this.callChunkTimer = setTimeout(() => this.cycleCallRecordingChunk(), 600);
      }
    }
  }

  /**
   * Receive and queue incoming live voice chunk from peer over TCP
   * Allows up to 4 chunks in buffer so Wi-Fi bursts don't drop words
   */
  async enqueueCallAudioChunk(base64Chunk) {
    if (!this.isCallActive) {
      console.log('[AudioService] Dropped chunk: call not active');
      return;
    }

    this.playQueue.push(base64Chunk);
    console.log(`[AudioService] Enqueued peer audio chunk, buffer length: ${this.playQueue.length}`);

    while (this.playQueue.length > 4) {
      this.playQueue.shift();
    }

    if (!this.isPlayingQueue) {
      this.playNextCallChunk();
    }
  }

  async playNextCallChunk() {
    if (!this.isCallActive || this.playQueue.length === 0) {
      this.isPlayingQueue = false;
      return;
    }

    this.isPlayingQueue = true;
    const chunk = this.playQueue.shift();

    try {
      // Rotating 5-slot RX buffer prevents writing while ExoPlayer is decoding
      this.playChunkIndex = ((this.playChunkIndex || 0) + 1) % 5;
      const tempPath = `${FileSystem.cacheDirectory}call_rx_${this.playChunkIndex}.m4a`;
      await FileSystem.writeAsStringAsync(tempPath, chunk, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!this.callPlayer) {
        this.callPlayer = createAudioPlayer(tempPath);
      } else {
        try {
          this.callPlayer.replace(tempPath);
        } catch (repErr) {
          try { this.callPlayer.remove(); } catch (e) { }
          this.callPlayer = createAudioPlayer(tempPath);
        }
      }
      this.callPlayer.play();

      let isCleanedUp = false;
      const cleanupAndNext = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        clearTimeout(safetyTimeout);
        try {
          if (this.callPlayerSub) {
            this.callPlayerSub.remove();
            this.callPlayerSub = null;
          }
        } catch (e) { }
        this.playNextCallChunk();
      };

      // 1800ms safety timeout (since chunk is 1000ms) prevents clipping speech mid-word
      const safetyTimeout = setTimeout(() => {
        cleanupAndNext();
      }, 1800);

      this.callPlayerSub = this.callPlayer.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          cleanupAndNext();
        }
      });
    } catch (e) {
      console.warn('Error playing incoming call chunk:', e);
      this.isPlayingQueue = false;
      this.playNextCallChunk();
    }
  }

  /**
   * Toggle mute
   */
  setMute(isMuted) {
    this.isMuted = isMuted;
  }

  setAudioMuted(isMuted) {
    this.isMuted = isMuted;
  }

  async setSpeakerEnabled(speakerOn) {
    await this.setAudioMode(this.isCallActive, speakerOn);
  }

  /**
   * Stop active call audio session
   */
  async stopCallStreaming() {
    this.isCallActive = false;
    clearTimeout(this.callChunkTimer);

    if (this.callPlayerSub) {
      try { this.callPlayerSub.remove(); } catch (e) { }
      this.callPlayerSub = null;
    }

    if (this.callRecording) {
      try {
        await this.callRecording.stop();
      } catch (e) { }
      this.callRecording = null;
    }

    if (this.callPlayer) {
      try {
        this.callPlayer.pause();
        this.callPlayer.remove();
      } catch (e) { }
      this.callPlayer = null;
    }

    this.playQueue = [];
    this.isPlayingQueue = false;
    this.onCallChunkCallback = null;
    await this.setAudioMode(false);
  }
}

export default new AudioService();
