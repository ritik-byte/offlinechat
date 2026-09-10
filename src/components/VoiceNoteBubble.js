import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Play, Pause, Mic } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import AudioService from '../services/AudioService';

// WhatsApp-style smooth waveform patterns (22 bars)
const WAVE_PATTERN = [
  8, 16, 10, 22, 28, 20, 14, 24, 30, 18,
  12, 26, 20, 10, 16, 24, 28, 18, 14, 22,
  16, 10,
];

export default function VoiceNoteBubble({
  messageId,
  audioData,
  audioDuration = 0,
  isMe = false,
  senderName = '',
}) {
  const { colors } = useTheme();

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0 to 1
  const [currentSeconds, setCurrentSeconds] = useState(0);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const togglePlayback = async () => {
    if (!audioData) return;

    try {
      if (isPlaying) {
        await AudioService.stopSound();
        setIsPlaying(false);
        return;
      }

      setIsPlaying(true);
      const result = await AudioService.playVoiceNote(
        messageId,
        audioData,
        (status) => {
          if (!isMountedRef.current) return;

          if (status.didJustFinish) {
            setIsPlaying(false);
            setPlaybackProgress(0);
            setCurrentSeconds(0);
          } else if (status.isPlaying) {
            setIsPlaying(true);
            const totalSec = Math.max(1, (status.durationMillis || (audioDuration * 1000)) / 1000);
            const curSec = (status.positionMillis || 0) / 1000;
            setCurrentSeconds(Math.round(curSec));
            if (totalSec > 0) {
              setPlaybackProgress(Math.min(1, curSec / totalSec));
            }
          }
        }
      );

      if (isMountedRef.current && result) {
        setIsPlaying(result.isPlaying);
        if (!result.isPlaying) {
          setPlaybackProgress(0);
          setCurrentSeconds(0);
        }
      }
    } catch (err) {
      console.warn('Playback error in bubble:', err);
      if (isMountedRef.current) setIsPlaying(false);
    }
  };

  const formatTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const totalDuration = audioDuration || 1;
  const timeDisplay = isPlaying
    ? formatTime(currentSeconds)
    : formatTime(totalDuration);

  // Professional bar colors:
  // For 'me': played bars are pure white, unplayed bars are subtle translucent white
  // For 'them': played bars are primary accent, unplayed bars are neutral slate
  const playedBarColor = isMe ? '#53BDEB' : colors.primaryLight;
  const unplayedBarColor = isMe ? 'rgba(233, 237, 239, 0.35)' : 'rgba(134, 150, 160, 0.4)';

  return (
    <View style={styles.container}>
      {/* Play / Pause Circular Button */}
      <TouchableOpacity
        style={[
          styles.playBtn,
          {
            backgroundColor: isMe ? 'rgba(255, 255, 255, 0.15)' : colors.surfaceActive,
          },
        ]}
        onPress={togglePlayback}
        activeOpacity={0.7}
      >
        {isPlaying ? (
          <Pause color={isMe ? '#FFFFFF' : colors.textPrimary} size={18} />
        ) : (
          <Play
            color={isMe ? '#FFFFFF' : colors.textPrimary}
            size={18}
            style={{ marginLeft: 2 }}
          />
        )}
      </TouchableOpacity>

      {/* Waveform & Scrubber Section */}
      <View style={styles.waveSection}>
        <View style={styles.waveBarsContainer}>
          {WAVE_PATTERN.map((height, i) => {
            const barProgress = i / WAVE_PATTERN.length;
            const isFilled = barProgress <= playbackProgress;
            return (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height,
                    backgroundColor: isFilled ? playedBarColor : unplayedBarColor,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Time label and mic icon */}
        <View style={styles.bottomRow}>
          <Text
            style={[
              styles.timeText,
              {
                color: isMe ? 'rgba(233, 237, 239, 0.75)' : colors.textSecondary,
              },
            ]}
          >
            {timeDisplay}
          </Text>
          <View style={styles.micTag}>
            <Mic
              color={isMe ? '#53BDEB' : colors.primaryLight}
              size={12}
            />
            <Text
              style={[
                styles.voiceNoteLabel,
                { color: isMe ? 'rgba(233, 237, 239, 0.75)' : colors.textMuted },
              ]}
            >
              Voice
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 210,
    maxWidth: 270,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveSection: {
    flex: 1,
    marginLeft: 10,
    marginRight: 2,
    justifyContent: 'center',
  },
  waveBarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  micTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  voiceNoteLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});
