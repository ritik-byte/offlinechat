import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  MessageCircle,
  Users,
  Wifi,
  WifiOff,
  ArrowLeft,
  Radio,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown, Layout } from 'react-native-reanimated';
import { colors, getInitials, getAvatarColor } from '../theme/colors';
import SocketService from '../services/SocketService';
import StorageService from '../services/StorageService';

const GENERAL_CHAT = {
  deviceId: 'general',
  deviceName: 'General Chat',
  isGroup: true,
  online: true,
};

export default function ContactsScreen({ navigation, route }) {
  const { mode, hostIp } = route.params || {};
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('Connecting...');
  const [refreshing, setRefreshing] = useState(false);
  const [myDeviceId, setMyDeviceId] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});

  useEffect(() => {
    loadDeviceId();

    const handleUserList = (userList) => {
      setUsers(userList);
      // Cache contacts
      StorageService.saveContacts(userList);
      // Load last messages for each user
      loadLastMessages(userList);
    };

    const handleStatus = (st) => setStatus(st);

    const handleMessage = (msg) => {
      // Update last message for this sender
      const peerId = msg.targetId === 'general' ? 'general' : msg.senderId;
      setLastMessages(prev => ({
        ...prev,
        [peerId]: msg,
      }));
      // Increment unread count (will be cleared when opening chat)
      setUnreadCounts(prev => ({
        ...prev,
        [peerId]: (prev[peerId] || 0) + 1,
      }));
      // Save message to history
      const chatPeerId = msg.targetId === 'general' ? 'general' : 
        (msg.senderId === myDeviceId ? msg.targetId : msg.senderId);
      StorageService.addMessage(chatPeerId, msg);
    };

    SocketService.addUserListListener(handleUserList);
    SocketService.addStatusListener(handleStatus);
    SocketService.addMessageListener(handleMessage);

    return () => {
      SocketService.removeUserListListener(handleUserList);
      SocketService.removeStatusListener(handleStatus);
      SocketService.removeMessageListener(handleMessage);
    };
  }, [myDeviceId]);

  const loadDeviceId = async () => {
    const id = await StorageService.getDeviceId();
    setMyDeviceId(id);
  };

  const loadLastMessages = async (userList) => {
    const msgs = {};
    // Load last message for general chat
    const generalLast = await StorageService.getLastMessage('general');
    if (generalLast) msgs['general'] = generalLast;

    // Load last message for each user
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
    // Re-trigger user list broadcast
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const openChat = (user) => {
    // Clear unread count for this user
    setUnreadCounts(prev => ({ ...prev, [user.deviceId]: 0 }));
    navigation.navigate('Chat', {
      peerId: user.deviceId,
      peerName: user.deviceName,
      isGroup: user.isGroup || false,
      mode,
    });
  };

  const handleBack = () => {
    SocketService.disconnect();
    navigation.goBack();
  };

  // Build contact list: General Chat + other users (excluding self)
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

  const renderContact = ({ item, index }) => {
    const isGroup = item.isGroup;
    const lastMsg = lastMessages[item.deviceId];
    const unread = unreadCounts[item.deviceId] || 0;
    const avatarBg = isGroup ? colors.primary : getAvatarColor(item.deviceName);
    const initials = isGroup ? null : getInitials(item.deviceName);

    return (
      <Animated.View
        entering={FadeInUp.duration(400).delay(index * 60)}
        layout={Layout.springify()}
      >
        <TouchableOpacity
          style={styles.contactItem}
          onPress={() => openChat(item)}
          activeOpacity={0.7}
        >
          {/* Avatar */}
          <View style={[styles.contactAvatar, { backgroundColor: avatarBg }]}>
            {isGroup ? (
              <Users color="#fff" size={22} />
            ) : (
              <Text style={styles.contactAvatarText}>{initials}</Text>
            )}
            {!isGroup && item.online && <View style={styles.onlineDot} />}
          </View>

          {/* Info */}
          <View style={styles.contactInfo}>
            <View style={styles.contactTopRow}>
              <Text style={styles.contactName} numberOfLines={1}>
                {item.deviceName}
              </Text>
              {lastMsg && (
                <Text style={styles.contactTime}>
                  {formatTime(lastMsg.timestamp)}
                </Text>
              )}
            </View>
            <View style={styles.contactBottomRow}>
              <Text style={styles.contactLastMsg} numberOfLines={1}>
                {lastMsg
                  ? `${lastMsg.senderName === item.deviceName ? '' : 'You: '}${lastMsg.text}`
                  : isGroup
                  ? 'Tap to chat with everyone'
                  : 'Tap to start chatting'}
              </Text>
              {unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Radio color={colors.textMuted} size={40} />
      </View>
      <Text style={styles.emptyTitle}>Waiting for users...</Text>
      <Text style={styles.emptySubtitle}>
        {mode === 'host'
          ? 'Ask others to connect to your hotspot and open NexusChat'
          : 'Other users will appear here when they connect'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface} />

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft color={colors.text} size={22} />
          </TouchableOpacity>
          <View style={styles.headerTitleArea}>
            <Text style={styles.headerTitle}>NexusChat</Text>
            <View style={styles.statusRow}>
              {status.includes('Error') || status.includes('Disconnect') ? (
                <WifiOff color={colors.error} size={12} />
              ) : (
                <Wifi color={colors.success} size={12} />
              )}
              <Text
                style={[
                  styles.statusText,
                  (status.includes('Error') || status.includes('Disconnect')) && {
                    color: colors.error,
                  },
                ]}
                numberOfLines={1}
              >
                {status}
              </Text>
            </View>
          </View>
          <View style={styles.userCountBadge}>
            <Users color={colors.primary} size={14} />
            <Text style={styles.userCountText}>{onlineCount}</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search color={colors.textMuted} size={18} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </Animated.View>

      {/* Contacts List */}
      <FlatList
        data={filteredContacts}
        keyExtractor={item => item.deviceId}
        renderItem={renderContact}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          filteredContacts.length === 0 && !searchQuery ? renderEmptyList : null
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

      {/* Connection Info Footer */}
      {mode === 'host' && hostIp && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Hosting on: <Text style={styles.footerIp}>{hostIp}:{12345}</Text>
          </Text>
        </View>
      )}
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
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleArea: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusText: {
    fontSize: 11,
    color: colors.success,
  },
  userCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryMuted,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  userCountText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.searchBar,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 10,
  },
  listContent: {
    paddingVertical: 4,
    flexGrow: 1,
  },
  // ─── Contact Item ───
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  contactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  contactAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.online,
    borderWidth: 2.5,
    borderColor: colors.background,
  },
  contactInfo: {
    flex: 1,
  },
  contactTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  contactTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  contactBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactLastMsg: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: colors.unreadBadge,
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  // ─── Empty State ───
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // ─── Footer ───
  footer: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  footerIp: {
    color: colors.primary,
    fontWeight: '600',
  },
});
