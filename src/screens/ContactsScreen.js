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
  deviceName: 'STRAT OPS',
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
          <View style={[styles.contactAvatar, { backgroundColor: isGroup ? '#000000' : avatarBg }]}>
            {isGroup ? (
              <Users color="#FFFFFF" size={22} />
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
      <Text style={styles.emptyTitle}>Awaiting personnel...</Text>
      <Text style={styles.emptySubtitle}>
        {mode === 'host'
          ? 'Direct troops to connect to your network and open the app'
          : 'Other personnel will appear here when they join the network'}
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
            <Text style={styles.headerTitle}>14 Grenadiers</Text>
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
            tintColor="#4ADE80"
            colors={["#4ADE80"]}
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
    backgroundColor: '#000000',
  },
  header: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
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
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusText: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  userCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  userCountText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 2,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 10,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  listContent: {
    paddingVertical: 4,
    flexGrow: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#333',
  },
  contactAvatarText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: '#000000',
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
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
    fontFamily: 'monospace',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  contactTime: {
    fontSize: 10,
    color: '#444',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  contactBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactLastMsg: {
    fontSize: 12,
    color: '#555',
    flex: 1,
    marginRight: 8,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  unreadBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
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
    borderRadius: 4,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'monospace',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#444',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  footer: {
    backgroundColor: '#0A0A0A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#444',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  footerIp: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});

