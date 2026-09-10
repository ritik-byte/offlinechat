import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Send,
  ArrowLeft,
  Users,
  Camera,
  Image as ImageIcon,
  X,
  ChevronDown,
  CheckCheck,
  Mic,
  Trash2,
  Phone,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../theme/ThemeContext';
import SocketService from '../services/SocketService';
import StorageService from '../services/StorageService';
import AudioService from '../services/AudioService';
import VoiceNoteBubble from '../components/VoiceNoteBubble';
import CallModal, { CALL_STATUS } from '../components/CallModal';

export default function ChatScreen({ navigation, route }) {
  const { colors, isDark, getAvatarColor, getInitials } = useTheme();
  const { peerId, peerName, isGroup, peerAvatar: initialPeerAvatar } = route.params || {};

  const [peerAvatar, setPeerAvatar] = useState(initialPeerAvatar || null);
  const [activeCallPeerAvatar, setActiveCallPeerAvatar] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [myDeviceId, setMyDeviceId] = useState('');
  const [myDeviceName, setMyDeviceName] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [typingUser, setTypingUser] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Voice Note Recording State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDurationSec, setRecordingDurationSec] = useState(0);
  const recordingTimerRef = useRef(null);

  // Voice Calling State
  const [callStatus, setCallStatus] = useState(CALL_STATUS.IDLE);
  const [activeCallId, setActiveCallId] = useState(null);
  const [incomingCallerName, setIncomingCallerName] = useState('');
  const [activeCallPeerId, setActiveCallPeerId] = useState(null);
  const [activeCallPeerName, setActiveCallPeerName] = useState('');
  const callStatusRef = useRef(CALL_STATUS.IDLE);
  const activeCallIdRef = useRef(null);
  const activeCallPeerIdRef = useRef(null);
  const activeCallPeerNameRef = useRef('');

  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    activeCallIdRef.current = activeCallId;
  }, [activeCallId]);

  useEffect(() => {
    activeCallPeerIdRef.current = activeCallPeerId;
  }, [activeCallPeerId]);

  useEffect(() => {
    activeCallPeerNameRef.current = activeCallPeerName;
  }, [activeCallPeerName]);

  // Auto-scroll on keyboard show (like WhatsApp)
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    return () => showSub.remove();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const handleMessage = (msg) => {
      const isForThisChat =
        (isGroup && msg.targetId === 'general') ||
        (!isGroup && (msg.senderId === peerId || msg.targetId === peerId));

      if (isForThisChat) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          const updated = [...prev, msg];
          StorageService.addMessage(peerId, msg);
          return updated;
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    const handleTyping = (data) => {
      const isForThisChat =
        (isGroup && data.targetId === 'general') ||
        (!isGroup && data.senderId === peerId);

      if (isForThisChat && data.senderId !== myDeviceId) {
        setTypingUser(data.senderName);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 2500);
      }
    };

    const handleUserList = (userList) => {
      if (!isGroup) {
        const peer = userList.find(u => u.deviceId === peerId);
        setIsOnline(peer ? peer.online : false);
        if (peer && peer.avatar) {
          setPeerAvatar(peer.avatar);
        }
      }
    };

    // Real-time call signaling handler: receives incoming calls even in room chat!
    const handleCallSignal = (signal) => {
      const { action, callId: incomingCallId, callerId, callerName, callerAvatar, chunk } = signal;

      if (action === 'invite') {
        // Only send busy if actively CONNECTED to another call with a different ID
        if (callStatusRef.current === CALL_STATUS.CONNECTED && activeCallIdRef.current !== incomingCallId) {
          SocketService.sendCallSignal({
            action: 'busy',
            callId: incomingCallId,
            targetId: callerId,
          });
          return;
        }

        // Otherwise accept invitation prompt seamlessly
        setActiveCallId(incomingCallId);
        setIncomingCallerName(callerName || 'Peer');
        setActiveCallPeerId(callerId);
        setActiveCallPeerName(callerName || 'Peer');
        if (callerAvatar) {
          setActiveCallPeerAvatar(callerAvatar);
        }
        setCallStatus(CALL_STATUS.INCOMING);

        // Synchronously update all refs
        activeCallIdRef.current = incomingCallId;
        activeCallPeerIdRef.current = callerId;
        activeCallPeerNameRef.current = callerName || 'Peer';
        callStatusRef.current = CALL_STATUS.INCOMING;
      } else if (action === 'accept') {
        if (callStatusRef.current === CALL_STATUS.OUTGOING) {
          setCallStatus(CALL_STATUS.CONNECTED);
          callStatusRef.current = CALL_STATUS.CONNECTED;
          if (callerId) {
            activeCallPeerIdRef.current = callerId;
            setActiveCallPeerId(callerId);
          }
          if (callerAvatar) {
            setActiveCallPeerAvatar(callerAvatar);
          }
          const targetPeerId = activeCallPeerIdRef.current || (peerId !== 'general' ? peerId : callerId);
          AudioService.startCallStreaming((chunkData) => {
            SocketService.sendCallSignal({
              action: 'audio_chunk',
              callId: incomingCallId || activeCallIdRef.current,
              targetId: targetPeerId,
              chunk: chunkData,
            });
          });
        }
      } else if (action === 'audio_chunk') {
        // Auto-promote to CONNECTED if receiving audio
        if (callStatusRef.current === CALL_STATUS.OUTGOING) {
          setCallStatus(CALL_STATUS.CONNECTED);
          callStatusRef.current = CALL_STATUS.CONNECTED;
          if (callerId) {
            activeCallPeerIdRef.current = callerId;
            setActiveCallPeerId(callerId);
          }
          const targetPeerId = activeCallPeerIdRef.current || (peerId !== 'general' ? peerId : callerId);
          AudioService.startCallStreaming((chunkData) => {
            SocketService.sendCallSignal({
              action: 'audio_chunk',
              callId: incomingCallId || activeCallIdRef.current,
              targetId: targetPeerId,
              chunk: chunkData,
            });
          });
        }
        if (callStatusRef.current === CALL_STATUS.CONNECTED && chunk) {
          AudioService.enqueueCallAudioChunk(chunk);
        }
      } else if (action === 'decline' || action === 'busy') {
        if (callStatusRef.current === CALL_STATUS.OUTGOING || callStatusRef.current === CALL_STATUS.CONNECTED) {
          AudioService.stopCallStreaming();
          setCallStatus(CALL_STATUS.IDLE);
          callStatusRef.current = CALL_STATUS.IDLE;
          setActiveCallPeerId(null);
          activeCallPeerIdRef.current = null;
          setActiveCallPeerAvatar(null);
          alert(action === 'busy' ? 'User is busy on another call.' : 'Call was declined.');
        }
      } else if (action === 'end') {
        AudioService.stopCallStreaming();
        setCallStatus(CALL_STATUS.IDLE);
        callStatusRef.current = CALL_STATUS.IDLE;
        setActiveCallPeerId(null);
        activeCallPeerIdRef.current = null;
        setActiveCallPeerAvatar(null);
      }
    };

    const init = async () => {
      const id = await StorageService.getDeviceId();
      const name = await StorageService.getDeviceName();
      if (!isMounted) return;
      setMyDeviceId(id);
      setMyDeviceName(name || 'Me');

      const history = await StorageService.getChatHistory(peerId);
      if (!isMounted) return;
      setMessages(history);

      SocketService.addMessageListener(handleMessage);
      SocketService.addTypingListener(handleTyping);
      SocketService.addUserListListener(handleUserList);
      SocketService.addCallListener(handleCallSignal);
    };

    init();

    return () => {
      isMounted = false;
      clearTimeout(typingTimeoutRef.current);
      clearInterval(recordingTimerRef.current);
      AudioService.stopSound();
      AudioService.stopCallStreaming();
      SocketService.removeMessageListener(handleMessage);
      SocketService.removeTypingListener(handleTyping);
      SocketService.removeUserListListener(handleUserList);
      SocketService.removeCallListener(handleCallSignal);
    };
  }, [peerId, isGroup]);

  // ─── Sending Text & Images ─────────────────────────────────

  const handleSend = async (imageUri = null) => {
    if (!inputText.trim() && !imageUri) return;

    let base64Image = null;
    if (imageUri) {
      setIsProcessingImage(true);
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 800 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        base64Image = `data:image/jpeg;base64,${manipResult.base64}`;
      } catch (e) {
        console.error('Image compression error:', e);
      } finally {
        setIsProcessingImage(false);
      }
    }

    const replyData = replyingTo ? {
      id: replyingTo.id,
      senderName: replyingTo.senderName,
      text: replyingTo.text,
    } : null;

    SocketService.sendMessage(inputText.trim(), peerId, base64Image, replyData);
    setInputText('');
    setReplyingTo(null);
    setTypingUser(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      handleSend(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      handleSend(result.assets[0].uri);
    }
  };

  const handleTextChange = (text) => {
    setInputText(text);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000 && text.trim()) {
      SocketService.sendTyping(peerId);
      lastTypingSentRef.current = now;
    }
  };

  // ─── Voice Notes (WhatsApp style) ──────────────────────────

  const startVoiceRecording = async () => {
    try {
      setRecordingDurationSec(0);
      await AudioService.startVoiceRecording();
      setIsRecordingVoice(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDurationSec(prev => prev + 1);
      }, 1000);
    } catch (e) {
      alert('Microphone permission is required to record voice notes.');
    }
  };

  const cancelVoiceRecording = async () => {
    clearInterval(recordingTimerRef.current);
    setIsRecordingVoice(false);
    setRecordingDurationSec(0);
    await AudioService.cancelVoiceRecording();
  };

  const finishAndSendVoiceNote = async () => {
    clearInterval(recordingTimerRef.current);
    setIsRecordingVoice(false);
    const audioResult = await AudioService.stopVoiceRecording();
    setRecordingDurationSec(0);

    if (audioResult && audioResult.base64) {
      const replyData = replyingTo ? {
        id: replyingTo.id,
        senderName: replyingTo.senderName,
        text: replyingTo.text || 'Voice note',
      } : null;

      SocketService.sendMessage(
        '', // empty text
        peerId,
        null, // image
        replyData,
        audioResult.base64,
        audioResult.duration
      );
      setReplyingTo(null);
    }
  };

  // ─── Real-Time Voice Calls ─────────────────────────────────

  const startOutgoingCall = async () => {
    const hasPermission = await AudioService.requestPermissions();
    if (!hasPermission) {
      alert('Microphone permission is required to make calls.');
      return;
    }

    const newCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setActiveCallId(newCallId);
    activeCallIdRef.current = newCallId;
    setActiveCallPeerId(peerId);
    setActiveCallPeerName(peerName);
    activeCallPeerIdRef.current = peerId;
    activeCallPeerNameRef.current = peerName;
    setCallStatus(CALL_STATUS.OUTGOING);
    callStatusRef.current = CALL_STATUS.OUTGOING;

    SocketService.sendCallSignal({
      action: 'invite',
      callId: newCallId,
      targetId: peerId,
      callerId: myDeviceId,
      callerName: myDeviceName,
    });
  };

  const handleAcceptCall = async () => {
    const hasPermission = await AudioService.requestPermissions();
    if (!hasPermission) {
      alert('Microphone permission is required to answer calls.');
      return;
    }

    const targetPeerId = activeCallPeerIdRef.current || (peerId !== 'general' ? peerId : null);
    if (!targetPeerId) {
      console.warn('Cannot accept call: unknown target peer ID');
      return;
    }

    setCallStatus(CALL_STATUS.CONNECTED);
    callStatusRef.current = CALL_STATUS.CONNECTED;

    SocketService.sendCallSignal({
      action: 'accept',
      callId: activeCallIdRef.current,
      targetId: targetPeerId,
      callerId: myDeviceId,
      callerName: myDeviceName,
    });

    AudioService.startCallStreaming((chunkData) => {
      SocketService.sendCallSignal({
        action: 'audio_chunk',
        callId: activeCallIdRef.current,
        targetId: targetPeerId,
        chunk: chunkData,
      });
    });
  };

  const handleDeclineCall = () => {
    const targetPeerId = activeCallPeerIdRef.current || (peerId !== 'general' ? peerId : null);
    if (targetPeerId) {
      SocketService.sendCallSignal({
        action: 'decline',
        callId: activeCallIdRef.current,
        targetId: targetPeerId,
      });
    }
    setCallStatus(CALL_STATUS.IDLE);
    callStatusRef.current = CALL_STATUS.IDLE;
    setActiveCallPeerId(null);
    setActiveCallPeerName('');
    activeCallPeerIdRef.current = null;
    activeCallPeerNameRef.current = '';
  };

  const handleEndCall = () => {
    const targetPeerId = activeCallPeerIdRef.current || (peerId !== 'general' ? peerId : null);
    AudioService.stopCallStreaming();
    if (targetPeerId) {
      SocketService.sendCallSignal({
        action: 'end',
        callId: activeCallIdRef.current,
        targetId: targetPeerId,
      });
    }
    setCallStatus(CALL_STATUS.IDLE);
    callStatusRef.current = CALL_STATUS.IDLE;
    setActiveCallPeerId(null);
    setActiveCallPeerName('');
    activeCallPeerIdRef.current = null;
    activeCallPeerNameRef.current = '';
  };

  // ─── Rendering Helpers ─────────────────────────────────────

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollBtn(false);
  };

  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollBtn(distanceFromBottom > 120);
  };

  const getDateLabel = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.senderId === myDeviceId;
    const showDateSep =
      index === 0 ||
      getDateLabel(item.timestamp) !== getDateLabel(messages[index - 1]?.timestamp);

    const showSenderName = isGroup && !isMe && (
      index === 0 || messages[index - 1]?.senderId !== item.senderId
    );

    const senderColor = getAvatarColor(item.senderName || 'Unknown');
    const senderInitials = getInitials(item.senderName || 'User');

    return (
      <View>
        {showDateSep && (
          <View style={styles.dateSeparator}>
            <View style={[styles.dateBadge, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.dateBadgeText, { color: colors.textSecondary }]}>
                {getDateLabel(item.timestamp)}
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
          {/* In group/room chat, show sender avatar next to their messages */}
          {isGroup && !isMe && (
            <View style={styles.msgAvatarWrapper}>
              {showSenderName ? (
                item.senderAvatar ? (
                  <Image source={{ uri: item.senderAvatar }} style={styles.msgAvatarImg} />
                ) : (
                  <View style={[styles.msgAvatarCircle, { backgroundColor: senderColor }]}>
                    <Text style={styles.msgAvatarInitials}>{senderInitials}</Text>
                  </View>
                )
              ) : (
                <View style={styles.msgAvatarSpacer} />
              )}
            </View>
          )}

          <TouchableOpacity
            onLongPress={() => setReplyingTo(item)}
            activeOpacity={0.9}
            style={{ maxWidth: isGroup && !isMe ? '78%' : '82%' }}
          >
            <View
              style={[
                styles.bubble,
                isMe
                  ? [styles.bubbleMe, { backgroundColor: colors.messageMe }]
                  : [styles.bubbleThem, { backgroundColor: colors.messageThem }],
              ]}
            >
              {showSenderName && (
                <Text style={[styles.senderLabel, { color: senderColor }]}>
                  {item.senderName}
                </Text>
              )}

              {/* Quoted Reply Banner */}
              {item.replyTo && (
                <View
                  style={[
                    styles.quoteCard,
                    isMe
                      ? { backgroundColor: 'rgba(0,0,0,0.18)' }
                      : { backgroundColor: colors.surfaceInput },
                  ]}
                >
                  <View
                    style={[
                      styles.quoteLine,
                      { backgroundColor: isMe ? '#FFFFFF' : colors.primary },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.quoteAuthor,
                        { color: isMe ? '#FFFFFF' : colors.primaryLight },
                      ]}
                    >
                      {item.replyTo.senderName}
                    </Text>
                    <Text
                      style={[
                        styles.quoteSnippet,
                        { color: isMe ? 'rgba(255,255,255,0.8)' : colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.replyTo.text || 'Photo / Voice'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Attached Photo */}
              {item.image && (
                <Image
                  source={{ uri: item.image }}
                  style={styles.bubbleImage}
                  resizeMode="cover"
                />
              )}

              {/* Voice Note Player (WhatsApp style) */}
              {item.audio && (
                <VoiceNoteBubble
                  messageId={item.id}
                  audioData={item.audio}
                  audioDuration={item.audioDuration}
                  isMe={isMe}
                  senderName={item.senderName}
                />
              )}

              {/* Text Message Body */}
              {item.text ? (
                <Text
                  style={[
                    styles.bubbleText,
                    { color: isMe ? colors.messageMeText : colors.messageThemText },
                  ]}
                >
                  {item.text}
                </Text>
              ) : null}

              {/* Timestamp & Status */}
              <View style={styles.metaRow}>
                <Text
                  style={[
                    styles.metaTime,
                    { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted },
                  ]}
                >
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                {isMe && (
                  <CheckCheck
                    color="rgba(255,255,255,0.85)"
                    size={14}
                    style={{ marginLeft: 2 }}
                  />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const avatarBg = isGroup ? colors.primaryDark : getAvatarColor(peerName);
  const initials = isGroup ? null : getInitials(peerName);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn} activeOpacity={0.7}>
          <ArrowLeft color={colors.textPrimary} size={22} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfileArea}
          activeOpacity={0.8}
        >
          <View style={[styles.headerAvatar, { backgroundColor: avatarBg }]}>
            {isGroup ? (
              <Users color="#FFFFFF" size={18} />
            ) : peerAvatar ? (
              <Image source={{ uri: peerAvatar }} style={styles.headerAvatarImg} />
            ) : (
              <Text style={styles.headerAvatarText}>{initials}</Text>
            )}
          </View>

          <View style={styles.headerTitleArea}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {peerName}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                { color: isOnline ? colors.online : colors.offline },
                typingUser && { color: colors.primaryLight },
              ]}
              numberOfLines={1}
            >
              {typingUser
                ? `${typingUser} is typing...`
                : isGroup
                ? 'tap here for group info'
                : isOnline
                ? 'online'
                : 'offline'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Real-Time Call Button (For 1-on-1 chats) */}
        {!isGroup && (
          <TouchableOpacity
            style={styles.headerCallBtn}
            onPress={startOutgoingCall}
            activeOpacity={0.7}
          >
            <Phone color={colors.textPrimary} size={21} />
          </TouchableOpacity>
        )}
      </View>

      {/* Chat Messages Body */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatBody}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 25}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <View style={[styles.emptyAvatar, { backgroundColor: avatarBg }]}>
                {isGroup ? <Users color="#FFFFFF" size={28} /> : <Text style={styles.emptyAvatarText}>{initials}</Text>}
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {isGroup ? 'General Chat' : peerName}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {isGroup
                  ? 'Messages sent here are broadcast to all connected devices in this room.'
                  : 'Start a direct conversation, voice note, or call on this local network.'}
              </Text>
            </View>
          }
        />

        {/* Scroll To Bottom Button */}
        {showScrollBtn && (
          <TouchableOpacity
            style={[styles.scrollBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onPress={scrollToBottom}
            activeOpacity={0.8}
          >
            <ChevronDown color={colors.textPrimary} size={20} />
          </TouchableOpacity>
        )}

        {/* Replying Preview Bar */}
        {replyingTo && (
          <View style={[styles.replyPreview, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={[styles.replyPreviewLine, { backgroundColor: colors.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyPreviewAuthor, { color: colors.primaryLight }]}>
                {replyingTo.senderName}
              </Text>
              <Text style={[styles.replyPreviewText, { color: colors.textSecondary }]} numberOfLines={1}>
                {replyingTo.text || 'Media'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyCloseBtn}>
              <X color={colors.textSecondary} size={18} />
            </TouchableOpacity>
          </View>
        )}

        {/* Image upload indicator */}
        {isProcessingImage && (
          <View style={[styles.imageProcessingBar, { backgroundColor: colors.surfaceInput }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.imageProcessingText, { color: colors.textSecondary }]}>
              Compressing image...
            </Text>
          </View>
        )}

        {/* Input Bar / Voice Recording Bar */}
        {isRecordingVoice ? (
          /* WhatsApp Style Voice Recording Bar */
          <View style={[styles.recordingBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={cancelVoiceRecording} style={styles.cancelRecBtn}>
              <Trash2 color="#EF4444" size={22} />
            </TouchableOpacity>

            <View style={styles.recordingTimerArea}>
              <View style={styles.recordingDot} />
              <Text style={[styles.recordingDurationText, { color: colors.textPrimary }]}>
                {Math.floor(recordingDurationSec / 60)}:
                {(recordingDurationSec % 60) < 10 ? '0' : ''}
                {recordingDurationSec % 60}
              </Text>
              <Text style={[styles.recordingHint, { color: colors.textSecondary }]}>
                Recording voice note...
              </Text>
            </View>

            <TouchableOpacity
              onPress={finishAndSendVoiceNote}
              style={[styles.sendVoiceBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Send color="#FFFFFF" size={18} />
            </TouchableOpacity>
          </View>
        ) : (
          /* Standard Input Bar (WhatsApp-style floating pill) */
          <View style={[styles.inputBar, { backgroundColor: colors.background }]}>
            <TouchableOpacity onPress={pickImage} style={styles.attachBtn} activeOpacity={0.7}>
              <ImageIcon color={colors.textSecondary} size={22} />
            </TouchableOpacity>

            <TouchableOpacity onPress={takePhoto} style={styles.attachBtn} activeOpacity={0.7}>
              <Camera color={colors.textSecondary} size={22} />
            </TouchableOpacity>

            <View style={[styles.inputContainer, { backgroundColor: colors.surfaceInput }]}>
              <TextInput
                style={[styles.textInput, { color: colors.textPrimary }]}
                placeholder="Message"
                placeholderTextColor={colors.textMuted}
                value={inputText}
                onChangeText={handleTextChange}
                onFocus={() => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 150);
                }}
                multiline
                maxLength={1000}
              />
            </View>

            {inputText.trim() ? (
              <TouchableOpacity
                style={[styles.actionCircleBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleSend()}
                activeOpacity={0.8}
              >
                <Send color="#FFFFFF" size={17} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionCircleBtn, { backgroundColor: colors.primary }]}
                onPress={startVoiceRecording}
                activeOpacity={0.8}
              >
                <Mic color="#FFFFFF" size={20} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Real-time Voice Call Overlay Modal */}
      <CallModal
        visible={callStatus !== CALL_STATUS.IDLE}
        callStatus={callStatus}
        peerId={activeCallPeerId || peerId}
        peerName={activeCallPeerName || incomingCallerName || peerName}
        peerAvatar={activeCallPeerAvatar || (activeCallPeerId === peerId ? peerAvatar : null)}
        callerName={incomingCallerName}
        callId={activeCallId}
        onEndCall={handleEndCall}
        onAcceptCall={handleAcceptCall}
        onDeclineCall={handleDeclineCall}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBackBtn: {
    padding: 8,
    marginRight: 2,
    marginLeft: -4,
  },
  headerProfileArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  headerAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitleArea: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  headerCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBody: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowThem: {
    justifyContent: 'flex-start',
  },
  msgAvatarWrapper: {
    width: 32,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  msgAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  msgAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  msgAvatarSpacer: {
    width: 28,
    height: 28,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 14,
  },
  dateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  bubble: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 1.5,
    elevation: 1,
  },
  bubbleMe: {
    borderTopRightRadius: 2,
  },
  bubbleThem: {
    borderTopLeftRadius: 2,
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  quoteCard: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 6,
    marginBottom: 6,
    gap: 8,
  },
  quoteLine: {
    width: 3,
    borderRadius: 1.5,
  },
  quoteAuthor: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 1,
  },
  quoteSnippet: {
    fontSize: 12,
  },
  bubbleImage: {
    width: 230,
    height: 170,
    borderRadius: 10,
    marginBottom: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
    paddingRight: 24, // Prevents text from colliding with bottom-right timestamp
    paddingBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 1,
    gap: 3,
  },
  metaTime: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyAvatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  scrollBtn: {
    position: 'absolute',
    bottom: 74,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  replyPreviewLine: {
    width: 3,
    height: 24,
    borderRadius: 1.5,
  },
  replyPreviewAuthor: {
    fontSize: 12,
    fontWeight: '600',
  },
  replyPreviewText: {
    fontSize: 12,
  },
  replyCloseBtn: {
    padding: 6,
  },
  imageProcessingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  imageProcessingText: {
    fontSize: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  attachBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    minHeight: 44,
    maxHeight: 110,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  actionCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelRecBtn: {
    padding: 8,
  },
  recordingTimerArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingDurationText: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  recordingHint: {
    fontSize: 13,
    fontWeight: '500',
  },
  sendVoiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
