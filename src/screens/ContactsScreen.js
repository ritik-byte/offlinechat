import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import {
  Search,
  Users,
  ArrowLeft,
  Sun,
  Moon,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import SocketService from '../services/SocketService';
import StorageService from '../services/StorageService';
import AudioService from '../services/AudioService';
import CallModal, { CALL_STATUS } from '../components/CallModal';

const GENERAL_CHAT = {
  deviceId: 'general',
  deviceName: 'General Chat',
  isGroup: true,
  online: true,
};

export default function ContactsScreen({ navigation, route }) {
  const { colors, isDark, toggleTheme, getAvatarColor, getInitials } = useTheme();
  const { mode, hostIp } = route.params || {};
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('Connected');
  const [refreshing, setRefreshing] = useState(false);
  const [myDeviceId, setMyDeviceId] = useState('');
  const [myDeviceName, setMyDeviceName] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});

  // Real-time voice call state on Contacts screen
  const [callStatus, setCallStatus] = useState(CALL_STATUS.IDLE);
  const [activeCallId, setActiveCallId] = useState(null);
  const [incomingCallerName, setIncomingCallerName] = useState('');
  const [activeCallPeerId, setActiveCallPeerId] = useState(null);
  const [activeCallPeerName, setActiveCallPeerName] = useState('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const callStatusRef = useRef(CALL_STATUS.IDLE);
  const activeCallPeerIdRef = useRef(null);
  const activeCallIdRef = useRef(null);

  const isFocused = useIsFocused();

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
    loadDeviceId();

    const handleUserList = (userList) => {
      setUsers(userList);
      StorageService.saveContacts(userList);
      loadLastMessages(userList);
    };

    const handleStatus = (st) => setStatus(st);

    const handleMessage = (msg) => {
      const peerId = msg.targetId === 'general' ? 'general' : msg.senderId;
      setLastMessages(prev => ({
        ...prev,
        [peerId]: msg,
      }));
      setUnreadCounts(prev => ({
        ...prev,
        [peerId]: (prev[peerId] || 0) + 1,
      }));
      const chatPeerId = msg.targetId === 'general' ? 'general' : 
        (msg.senderId === myDeviceId ? msg.targetId : msg.senderId);
      StorageService.addMessage(chatPeerId, msg);
    };

    const handleCallSignal = (signal) => {
      const { action, callId: incomingCallId, callerId, callerName, chunk } = signal;

      if (action === 'invite') {
        // Only reject with busy if user is actively talking on a DIFFERENT ongoing call
        if (callStatusRef.current === CALL_STATUS.CONNECTED && activeCallIdRef.current !== incomingCallId) {
          SocketService.sendCallSignal({
            action: 'busy',
            callId: incomingCallId,
            targetId: callerId,
          });
          return;
        }

        setActiveCallId(incomingCallId);
        setIncomingCallerName(callerName || 'Peer');
        setActiveCallPeerId(callerId);
        setActiveCallPeerName(callerName || 'Peer');
        setCallStatus(CALL_STATUS.INCOMING);

        // Synchronously set refs so accept button has the target caller ID
        activeCallIdRef.current = incomingCallId;
        activeCallPeerIdRef.current = callerId;
        callStatusRef.current = CALL_STATUS.INCOMING;
      } else if (action === 'accept') {
        if (callStatusRef.current === CALL_STATUS.OUTGOING) {
          setCallStatus(CALL_STATUS.CONNECTED);
          callStatusRef.current = CALL_STATUS.CONNECTED;
          if (callerId) {
            activeCallPeerIdRef.current = callerId;
            setActiveCallPeerId(callerId);
          }
          const targetPeerId = activeCallPeerIdRef.current;
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
        // Auto-promote to CONNECTED if audio chunk arrives while marked OUTGOING
        if (callStatusRef.current === CALL_STATUS.OUTGOING) {
          setCallStatus(CALL_STATUS.CONNECTED);
          callStatusRef.current = CALL_STATUS.CONNECTED;
          if (callerId) {
            activeCallPeerIdRef.current = callerId;
            setActiveCallPeerId(callerId);
          }
          const targetPeerId = activeCallPeerIdRef.current;
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
          alert(action === 'busy' ? 'User is busy on another call.' : 'Call was declined.');
        }
      } else if (action === 'end') {
        AudioService.stopCallStreaming();
        setCallStatus(CALL_STATUS.IDLE);
        callStatusRef.current = CALL_STATUS.IDLE;
        setActiveCallPeerId(null);
        activeCallPeerIdRef.current = null;
      }
    };

    SocketService.addUserListListener(handleUserList);
    SocketService.addStatusListener(handleStatus);
    SocketService.addMessageListener(handleMessage);
    SocketService.addCallListener(handleCallSignal);

    return () => {
      SocketService.removeUserListListener(handleUserList);
      SocketService.removeStatusListener(handleStatus);
      SocketService.removeMessageListener(handleMessage);
      SocketService.removeCallListener(handleCallSignal);
      AudioService.stopCallStreaming();
    };
  }, [myDeviceId]);

  const loadDeviceId = async () => {
    const id = await StorageService.getDeviceId();
    const name = await StorageService.getDeviceName();
    setMyDeviceId(id);
    setMyDeviceName(name || 'Me');
  };

  const loadLastMessages = async (userList) => {
    const msgs = {};
    const generalLast = await StorageService.getLastMessage('general');
    if (generalLast) msgs['general'] = generalLast;

    for (const user of userList) {
      if (user.deviceId !== myDeviceId) {
        const last = await StorageService.getLastMessage(user.deviceId);
        if (last) msgs[user.deviceId] = last;
      }
    }
    setLastMessages(prev => ({ ...prev, ...msgs }));
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleAcceptCall = async () => {
    const hasPermission = await AudioService.requestPermissions();
    if (!hasPermission) {
      alert('Microphone permission is required to answer calls.');
      return;
    }

    const targetPeerId = activeCallPeerIdRef.current;
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
    const targetPeerId = activeCallPeerIdRef.current;
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
  };

  const handleEndCall = () => {
    const targetPeerId = activeCallPeerIdRef.current;
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
  };

  const toggleMute = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    AudioService.setAudioMuted(next);
  };

  const toggleSpeaker = () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    AudioService.setSpeakerEnabled(next);
  };

  const openChat = (user) => {
    setUnreadCounts(prev => ({ ...prev, [user.deviceId]: 0 }));
    navigation.navigate('Chat', {
      peerId: user.deviceId,
      peerName: user.deviceName,
      peerAvatar: user.avatar || null,
      isGroup: user.isGroup || false,
      mode,
    });
  };

  const handleBack = () => {
    SocketService.disconnect();
    navigation.goBack();
  };

  const contactList = [
    GENERAL_CHAT,
    ...users.filter(u => u.deviceId !== myDeviceId),
  ];

  const filteredContacts = searchQuery.trim()
    ? contactList.filter(u =>
        u.deviceName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : contactList;

  const onlineCount = users.filter(u => u.online).length;

  const renderContact = ({ item }) => {
    const isGroup = item.isGroup;
    const lastMsg = lastMessages[item.deviceId];
    const unread = unreadCounts[item.deviceId] || 0;
    const avatarBg = isGroup ? colors.primaryDark : getAvatarColor(item.deviceName);
    const initials = isGroup ? null : getInitials(item.deviceName);

    return (
      <TouchableOpacity
        style={[styles.contactRow, { backgroundColor: colors.surface }]}
        onPress={() => openChat(item)}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: avatarBg, overflow: 'hidden' }]}>
          {isGroup ? (
            <Users color="#FFFFFF" size={22} strokeWidth={2} />
          ) : item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.contactAvatarImg} />
          ) : (
            <Text style={styles.avatarInitials}>{initials}</Text>
          )}
          {!isGroup && item.online && (
            <View style={[styles.onlineBadge, { borderColor: colors.surface, backgroundColor: colors.online }]} />
          )}
        </View>

        {/* Info */}
        <View style={styles.contactInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.contactName, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.deviceName}
            </Text>
            {lastMsg && (
              <Text style={[styles.messageTime, { color: colors.textMuted }]}>
                {formatTime(lastMsg.timestamp)}
              </Text>
            )}
          </View>

          <View style={styles.previewRow}>
            <Text
              style={[
                styles.lastMessage,
                { color: unread > 0 ? colors.textPrimary : colors.textSecondary },
                unread > 0 && styles.lastMessageUnread,
              ]}
              numberOfLines={1}
            >
              {lastMsg
                ? `${lastMsg.senderName === item.deviceName ? '' : 'You: '}${
                    lastMsg.text ||
                    (lastMsg.audio
                      ? `🎤 Voice note (${lastMsg.audioDuration ? `${lastMsg.audioDuration}s` : ''})`
                      : lastMsg.image
                      ? '📷 Photo'
                      : '')
                  }`
                : isGroup
                ? 'Group chat for everyone in room'
                : 'Tap to send a message'}
            </Text>
            {unread > 0 && (
              <View style={[styles.unreadPill, { backgroundColor: colors.unreadBadge }]}>
                <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      {/* Navigation Header */}
      <View style={[styles.navHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color={colors.textPrimary} size={22} />
        </TouchableOpacity>

        <View style={styles.navTitleBox}>
          <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Room Chats</Text>
          <View style={styles.navStatusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.online }]} />
            <Text style={[styles.navSubtitle, { color: colors.textSecondary }]}>
              {mode === 'host' ? 'Hosting Room' : 'Connected to Room'} • {onlineCount} online
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.themeBtn, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}
          onPress={toggleTheme}
          activeOpacity={0.7}
        >
          {isDark ? (
            <Sun color={colors.warning} size={17} />
          ) : (
            <Moon color={colors.primary} size={17} />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchSection, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceInput }]}>
          <Search color={colors.textMuted} size={17} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Chat List */}
      <FlatList
        data={filteredContacts}
        keyExtractor={item => item.deviceId}
        renderItem={renderContact}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />}
        ListEmptyComponent={
          filteredContacts.length === 0 && !searchQuery ? (
            <View style={styles.emptyState}>
              <Users color={colors.textMuted} size={36} strokeWidth={1.5} />
              <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>No Peers Connected</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {mode === 'host'
                  ? 'Connect nearby devices to your Wi-Fi or Hotspot to start chatting.'
                  : 'Waiting for peers to join this network room.'}
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      {/* Subnet bar */}
      {hostIp && (
        <View style={[styles.bottomStatus, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.bottomStatusText, { color: colors.textMuted }]}>
            Subnet Gateway: <Text style={[styles.bottomStatusHighlight, { color: colors.textSecondary }]}>{hostIp}</Text>
          </Text>
        </View>
      )}

      {/* Real-time Voice Call Modal */}
      <CallModal
        visible={isFocused && callStatus !== CALL_STATUS.IDLE}
        callStatus={callStatus}
        callerName={activeCallPeerName || incomingCallerName}
        peerAvatar={users.find(u => u.deviceId === activeCallPeerId)?.avatar || null}
        isAudioMuted={isAudioMuted}
        isSpeakerOn={isSpeakerOn}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
        onEndCall={handleEndCall}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
      />
    </SafeAreaView>
  );
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  navTitleBox: {
    flex: 1,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  navStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  navSubtitle: {
    fontSize: 12,
  },
  themeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 9,
  },
  listContainer: {
    flexGrow: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowDivider: {
    height: 1,
    marginLeft: 74,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  contactAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  messageTime: {
    fontSize: 12,
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
  },
  lastMessageUnread: {
    fontWeight: '600',
  },
  unreadPill: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyHeading: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  bottomStatus: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  bottomStatusText: {
    fontSize: 12,
  },
  bottomStatusHighlight: {
    fontWeight: '600',
  },
});
