import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ArrowLeft, Wifi, WifiOff, Users, ChevronDown } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown, Layout } from 'react-native-reanimated';
import { colors, getInitials, getAvatarColor } from '../theme/colors';
import SocketService from '../services/SocketService';
import StorageService from '../services/StorageService';

export default function ChatScreen({ navigation, route }) {
  const { peerId, peerName, isGroup, mode } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [myDeviceId, setMyDeviceId] = useState('');
  const [myDeviceName, setMyDeviceName] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [typingUser, setTypingUser] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const flatListRef = useRef();
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    init();
    return () => {
      // Clean up — don't disconnect, just remove listeners
    };
  }, []);

  const init = async () => {
    const id = await StorageService.getDeviceId();
    const name = await StorageService.getDeviceName();
    setMyDeviceId(id);
    setMyDeviceName(name || 'Me');

    // Load chat history
    const history = await StorageService.getChatHistory(peerId);
    setMessages(history);

    // Register message listener
    const handleMessage = (msg) => {
      // Only accept messages for this conversation
      const isForThisChat =
        (isGroup && msg.targetId === 'general') ||
        (!isGroup && (msg.senderId === peerId || msg.targetId === peerId));

      if (isForThisChat) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.find(m => m.id === msg.id)) return prev;
          const updated = [...prev, msg];
          // Save to storage
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

      if (isForThisChat && data.senderId !== id) {
        setTypingUser(data.senderName);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 3000);
      }
    };

    const handleUserList = (userList) => {
      if (!isGroup) {
        const peer = userList.find(u => u.deviceId === peerId);
        setIsOnline(peer ? peer.online : false);
      }
    };

    SocketService.addMessageListener(handleMessage);
    SocketService.addTypingListener(handleTyping);
    SocketService.addUserListListener(handleUserList);

    return () => {
      SocketService.removeMessageListener(handleMessage);
      SocketService.removeTypingListener(handleTyping);
      SocketService.removeUserListListener(handleUserList);
      clearTimeout(typingTimeoutRef.current);
    };
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    SocketService.sendMessage(inputText.trim(), peerId);
    setInputText('');
    setTypingUser(null);
  };

  const handleTextChange = (text) => {
    setInputText(text);
    // Send typing indicator (throttled to once per 2s)
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000 && text.trim()) {
      SocketService.sendTyping(peerId);
      lastTypingSentRef.current = now;
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollBtn(false);
  };

  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollBtn(distanceFromBottom > 100);
  };

  // Group messages by date for date separators
  const getDateLabel = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], {
      weekday: 'long',
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

    return (
      <View>
        {showDateSep && (
          <View style={styles.dateSeparator}>
            <View style={styles.datePill}>
              <Text style={styles.dateText}>{getDateLabel(item.timestamp)}</Text>
            </View>
          </View>
        )}

        <Animated.View
          entering={FadeInUp.duration(250)}
          style={[
            styles.messageBubble,
            isMe ? styles.messageMe : styles.messageThem,
          ]}
        >
          {showSenderName && (
            <Text style={[styles.messageSender, { color: senderColor }]}>
              {item.senderName}
            </Text>
          )}
          <Text style={styles.messageText}>{item.text}</Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {isMe && (
              <Text style={styles.messageTick}>✓✓</Text>
            )}
          </View>
        </Animated.View>
      </View>
    );
  };

  const avatarBg = isGroup ? colors.primary : getAvatarColor(peerName);
  const initials = isGroup ? null : getInitials(peerName);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={colors.text} size={22} />
        </TouchableOpacity>

        <View style={[styles.headerAvatar, { backgroundColor: avatarBg }]}>
          {isGroup ? (
            <Users color="#fff" size={18} />
          ) : (
            <Text style={styles.headerAvatarText}>{initials}</Text>
          )}
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{peerName}</Text>
          <View style={styles.headerSubRow}>
            {typingUser ? (
              <Text style={styles.typingText}>
                {isGroup ? `${typingUser} is typing...` : 'typing...'}
              </Text>
            ) : isGroup ? (
              <Text style={styles.headerSubtext}>
                {SocketService.getConnectedUsers().length} members
              </Text>
            ) : (
              <View style={styles.onlineRow}>
                <View
                  style={[
                    styles.miniDot,
                    { backgroundColor: isOnline ? colors.online : colors.offline },
                  ]}
                />
                <Text
                  style={[
                    styles.headerSubtext,
                    isOnline && { color: colors.online },
                  ]}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        onContentSizeChange={() => {
          if (!showScrollBtn) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={[styles.emptyChatIcon, { backgroundColor: avatarBg + '22' }]}>
              {isGroup ? (
                <Users color={avatarBg} size={32} />
              ) : (
                <Text style={[styles.emptyChatInitials, { color: avatarBg }]}>
                  {initials}
                </Text>
              )}
            </View>
            <Text style={styles.emptyChatTitle}>{peerName}</Text>
            <Text style={styles.emptyChatSubtitle}>
              {isGroup
                ? 'Send a message to chat with everyone connected'
                : `Start your conversation with ${peerName}`}
            </Text>
          </View>
        }
      />

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <TouchableOpacity style={styles.scrollBtn} onPress={scrollToBottom}>
          <ChevronDown color={colors.text} size={20} />
        </TouchableOpacity>
      )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Send
              color={inputText.trim() ? colors.background : colors.textMuted}
              size={18}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  backButton: {
    padding: 6,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubRow: {
    marginTop: 1,
  },
  headerSubtext: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  miniDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  typingText: {
    color: colors.primary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  // ─── Messages ───
  messagesContainer: {
    padding: 12,
    paddingBottom: 4,
    flexGrow: 1,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 12,
  },
  datePill: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    borderRadius: 16,
    marginBottom: 3,
  },
  messageMe: {
    alignSelf: 'flex-end',
    backgroundColor: colors.messageMe,
    borderBottomRightRadius: 4,
  },
  messageThem: {
    alignSelf: 'flex-start',
    backgroundColor: colors.messageThem,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  messageText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    marginBottom: 2,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
  },
  messageTick: {
    color: colors.primary,
    fontSize: 10,
  },
  // ─── Empty Chat ───
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyChatIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyChatInitials: {
    fontSize: 24,
    fontWeight: '700',
  },
  emptyChatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  emptyChatSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // ─── Scroll Button ───
  scrollBtn: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  // ─── Input ───
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 0 : 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    minHeight: 44,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
});
