import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  Image,
} from 'react-native';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  ShieldCheck,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import AudioService from '../services/AudioService';
import SocketService from '../services/SocketService';

export const CALL_STATUS = {
  IDLE: 'idle',
  OUTGOING: 'outgoing',
  INCOMING: 'incoming',
  CONNECTED: 'connected',
};

export default function CallModal({
  visible,
  callStatus, // 'idle' | 'outgoing' | 'incoming' | 'connected'
  peerId,
  peerName,
  callerName,
  peerAvatar = null,
  callId,
  onEndCall,
  onAcceptCall,
  onDeclineCall,
}) {
  const { colors, getAvatarColor, getInitials } = useTheme();

  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const wave1Anim = useRef(new Animated.Value(0.4)).current;
  const wave2Anim = useRef(new Animated.Value(0.7)).current;
  const wave3Anim = useRef(new Animated.Value(0.3)).current;
  const wave4Anim = useRef(new Animated.Value(0.9)).current;
  const wave5Anim = useRef(new Animated.Value(0.5)).current;

  const timerRef = useRef(null);

  // Pulse animation for avatar rings during ringing/active call
  useEffect(() => {
    if (callStatus === CALL_STATUS.OUTGOING || callStatus === CALL_STATUS.INCOMING) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [callStatus]);

  // Audio wave animation during connected call
  useEffect(() => {
    if (callStatus === CALL_STATUS.CONNECTED) {
      const animateWave = (anim, duration) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2,
              duration,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
      };

      const a1 = animateWave(wave1Anim, 350);
      const a2 = animateWave(wave2Anim, 450);
      const a3 = animateWave(wave3Anim, 280);
      const a4 = animateWave(wave4Anim, 500);
      const a5 = animateWave(wave5Anim, 320);

      a1.start();
      a2.start();
      a3.start();
      a4.start();
      a5.start();

      return () => {
        a1.stop();
        a2.stop();
        a3.stop();
        a4.stop();
        a5.stop();
      };
    }
  }, [callStatus]);

  // Call timer when connected
  useEffect(() => {
    if (callStatus === CALL_STATUS.CONNECTED) {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setCallDuration(0);
    }

    return () => clearInterval(timerRef.current);
  }, [callStatus]);

  // Mute toggle
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    AudioService.setMute(nextMuted);
  };

  // Speaker toggle
  const toggleSpeaker = () => {
    const nextSpeaker = !isSpeaker;
    setIsSpeaker(nextSpeaker);
    AudioService.setAudioMode(true, nextSpeaker);
  };

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const displayName = callStatus === CALL_STATUS.INCOMING ? (callerName || 'Unknown') : (peerName || 'User');
  const avatarColor = getAvatarColor(displayName);
  const initials = getInitials(displayName);

  if (!visible || callStatus === CALL_STATUS.IDLE) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.securityBadge}>
            <ShieldCheck color="#10B981" size={16} style={{ marginRight: 6 }} />
            <Text style={styles.securityText}>Offnet Voice Encrypted</Text>
          </View>
          <Text style={styles.networkSubtext}>Local Wi-Fi / Hotspot Direct</Text>
        </View>

        {/* Center Content */}
        <View style={styles.centerContent}>
          {/* Pulsing Avatar Area */}
          <View style={styles.avatarContainer}>
            {(callStatus === CALL_STATUS.OUTGOING || callStatus === CALL_STATUS.INCOMING) && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    borderColor: colors.primary,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
            )}

            <View style={[styles.avatarBox, { backgroundColor: avatarColor, overflow: 'hidden' }]}>
              {peerAvatar ? (
                <Image source={{ uri: peerAvatar }} style={styles.callAvatarImg} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
          </View>

          {/* User Name & Status */}
          <Text style={styles.callerNameText} numberOfLines={1}>
            {displayName}
          </Text>

          {callStatus === CALL_STATUS.OUTGOING && (
            <Text style={styles.statusSubtext}>Calling local device...</Text>
          )}

          {callStatus === CALL_STATUS.INCOMING && (
            <Text style={[styles.statusSubtext, { color: '#10B981' }]}>
              Incoming Voice Call
            </Text>
          )}

          {callStatus === CALL_STATUS.CONNECTED && (
            <View style={styles.connectedStatusContainer}>
              <Text style={styles.durationTimer}>{formatTimer(callDuration)}</Text>
              
              {/* Dynamic Soundwave Visualizer */}
              <View style={styles.waveVisualizer}>
                <Animated.View
                  style={[
                    styles.waveBar,
                    {
                      height: 28,
                      transform: [{ scaleY: wave1Anim }],
                      backgroundColor: colors.primaryLight,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.waveBar,
                    {
                      height: 38,
                      transform: [{ scaleY: wave2Anim }],
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.waveBar,
                    {
                      height: 48,
                      transform: [{ scaleY: wave3Anim }],
                      backgroundColor: colors.primaryLight,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.waveBar,
                    {
                      height: 38,
                      transform: [{ scaleY: wave4Anim }],
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.waveBar,
                    {
                      height: 24,
                      transform: [{ scaleY: wave5Anim }],
                      backgroundColor: colors.primaryLight,
                    },
                  ]}
                />
              </View>

              <Text style={styles.qualityLabel}>HD Voice • Real-time</Text>
            </View>
          )}
        </View>

        {/* Bottom Control Bar */}
        <View style={styles.bottomControls}>
          {callStatus === CALL_STATUS.INCOMING ? (
            /* Incoming Call Controls: Decline & Accept */
            <View style={styles.incomingButtonsRow}>
              <View style={styles.actionCol}>
                <TouchableOpacity
                  style={[styles.callActionBtn, styles.declineBtn]}
                  onPress={onDeclineCall}
                  activeOpacity={0.7}
                >
                  <PhoneOff color="#FFFFFF" size={32} />
                </TouchableOpacity>
                <Text style={styles.btnLabel}>Decline</Text>
              </View>

              <View style={styles.actionCol}>
                <TouchableOpacity
                  style={[styles.callActionBtn, styles.acceptBtn]}
                  onPress={onAcceptCall}
                  activeOpacity={0.7}
                >
                  <Phone color="#FFFFFF" size={32} />
                </TouchableOpacity>
                <Text style={[styles.btnLabel, { color: '#10B981' }]}>Accept</Text>
              </View>
            </View>
          ) : (
            /* Outgoing or Connected Call Controls */
            <View style={styles.connectedControlsArea}>
              {callStatus === CALL_STATUS.CONNECTED && (
                <View style={styles.inCallTogglesRow}>
                  {/* Mute Button */}
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      isMuted && styles.toggleBtnActive,
                    ]}
                    onPress={toggleMute}
                    activeOpacity={0.7}
                  >
                    {isMuted ? (
                      <MicOff color="#EF4444" size={24} />
                    ) : (
                      <Mic color="#FFFFFF" size={24} />
                    )}
                    <Text style={styles.toggleLabel}>{isMuted ? 'Muted' : 'Mute'}</Text>
                  </TouchableOpacity>

                  {/* Speaker Button */}
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      isSpeaker && styles.toggleBtnActive,
                    ]}
                    onPress={toggleSpeaker}
                    activeOpacity={0.7}
                  >
                    {isSpeaker ? (
                      <Volume2 color={colors.primaryLight} size={24} />
                    ) : (
                      <VolumeX color="#94A3B8" size={24} />
                    )}
                    <Text style={styles.toggleLabel}>{isSpeaker ? 'Speaker' : 'Earpiece'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* End Call Button */}
              <TouchableOpacity
                style={[styles.callActionBtn, styles.endCallBtn]}
                onPress={onEndCall}
                activeOpacity={0.8}
              >
                <PhoneOff color="#FFFFFF" size={32} />
              </TouchableOpacity>
              <Text style={styles.endCallLabel}>End Call</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'ios' ? 60 : 45,
    paddingHorizontal: 24,
  },
  topHeader: {
    alignItems: 'center',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  securityText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  networkSubtext: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 6,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 2,
    opacity: 0.6,
  },
  avatarBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '700',
  },
  callerNameText: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusSubtext: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500',
  },
  connectedStatusContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  durationTimer: {
    color: '#38BDF8',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1.2,
    fontVariant: ['tabular-nums'],
  },
  waveVisualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 60,
    marginVertical: 14,
  },
  waveBar: {
    width: 5,
    borderRadius: 3,
  },
  qualityLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  bottomControls: {
    alignItems: 'center',
    width: '100%',
  },
  incomingButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  connectedControlsArea: {
    alignItems: 'center',
    width: '100%',
  },
  inCallTogglesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
    marginBottom: 32,
  },
  toggleBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  toggleLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  callActionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  declineBtn: {
    backgroundColor: '#EF4444',
  },
  endCallBtn: {
    backgroundColor: '#EF4444',
  },
  btnLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  actionCol: {
    alignItems: 'center',
  },
  callAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 55,
  },
  endCallLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },
});
