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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ArrowLeft, Wifi, WifiOff, Users, ChevronDown, Camera, Image as ImageIcon, X, CornerUpRight } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown, Layout } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
  const [replyingTo, setReplyingTo] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

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
        console.error('Image processing failed:', e);
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      handleSend(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      handleSend(result.assets[0].uri);
    }
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

        <TouchableOpacity
          onLongPress={() => setReplyingTo(item)}
          activeOpacity={0.9}
        >
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

            {item.replyTo && (
              <View style={styles.replyBubble}>
                <View style={[styles.replyBar, { backgroundColor: isMe ? '#fff' : colors.primary }]} />
                <View style={styles.replyContent}>
                  <Text style={[styles.replyName, { color: isMe ? '#fff' : colors.primary }]}>
                    {item.replyTo.senderName}
                  </Text>
                  <Text style={styles.replyText} numberOfLines={1}>
                    {item.replyTo.text || 'Image'}
                  </Text>
                </View>
              </View>
            )}

            {item.image && (
              <Animated.Image
                source={{ uri: item.image }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            )}

            {item.text ? <Text style={styles.messageText}>{item.text}</Text> : null}
            
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
        </TouchableOpacity>
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

        {replyingTo && (
          <Animated.View entering={FadeInDown} style={styles.replyPreview}>
            <View style={[styles.replyBar, { backgroundColor: colors.primary }]} />
            <View style={styles.replyContent}>
              <Text style={[styles.replyName, { color: colors.primary }]}>
                Replying to {replyingTo.senderName}
              </Text>
              <Text style={styles.replyText} numberOfLines={1}>
                {replyingTo.text || 'Image'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.closeReply}>
              <X color={colors.textMuted} size={18} />
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.iconButton} onPress={pickImage} disabled={isProcessingImage}>
            <ImageIcon color={isProcessingImage ? colors.border : colors.textSecondary} size={22} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconButton} onPress={takePhoto} disabled={isProcessingImage}>
            <Camera color={isProcessingImage ? colors.border : colors.textSecondary} size={22} />
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={2000}
            />
          </View>

          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() && !isProcessingImage) && styles.sendButtonDisabled]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() && !isProcessingImage}
            activeOpacity={0.7}
          >
            {isProcessingImage ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Send
                color={inputText.trim() ? colors.background : colors.textMuted}
                size={18}
              />
            )}
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
  messageImage: {
    width: 240,
    height: 180,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: colors.border,
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
  // ─── Reply System UI ───
  replyBubble: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  replyPreview: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  replyBar: {
    width: 4,
    borderRadius: 2,
    height: '100%',
    marginRight: 10,
  },
  replyContent: {
    flex: 1,
  },
  replyName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  closeReply: {
    padding: 4,
  },
  // ─── Input Area ───
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  iconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.searchBar,
    borderRadius: 22,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 120,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    paddingTop: 8,
    paddingBottom: 8,
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
    opacity: 0.6,
  },
  // ─── Helpers ───
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyChatIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyChatInitials: {
    fontSize: 32,
    fontWeight: '700',
  },
  emptyChatTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptyChatSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  scrollBtn: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 4,
  },
});
