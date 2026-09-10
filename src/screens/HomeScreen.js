import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StatusBar,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Wifi,
  Radio,
  Search,
  ArrowRight,
  X,
  Server,
  RefreshCw,
  Sun,
  Moon,
  Camera,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  User,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../theme/ThemeContext';
import SocketService from '../services/SocketService';
import StorageService from '../services/StorageService';

export default function HomeScreen({ navigation }) {
  const { colors, isDark, toggleTheme, getAvatarColor, getInitials } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [avatarImage, setAvatarImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [foundHosts, setFoundHosts] = useState([]);
  const [activeTab, setActiveTab] = useState('join'); // 'join' or 'host'
  const [manualIp, setManualIp] = useState('');
  const [currentIp, setCurrentIp] = useState('');

  // Profile Edit State
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempImage, setTempImage] = useState(null);

  // User Manual Modal State
  const [showUserManual, setShowUserManual] = useState(false);

  useEffect(() => {
    loadProfile();
    loadCurrentIp();
  }, []);

  const loadProfile = async () => {
    const name = await StorageService.getDeviceName();
    const id = await StorageService.getDeviceId();
    let img = await StorageService.getAvatarImage();
    if (img && !img.startsWith('data:image')) {
      // Auto-migrate old file:// URI to compressed base64 thumbnail
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          img,
          [{ resize: { width: 140, height: 140 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        img = `data:image/jpeg;base64,${manipResult.base64}`;
        await StorageService.setAvatarImage(img);
      } catch (e) { }
    }
    setDeviceName(name || 'User');
    setDeviceId(id);
    setAvatarImage(img);
    SocketService.setAvatar(img);
  };

  const loadCurrentIp = async () => {
    const ip = await SocketService.getIpAddress();
    setCurrentIp(ip || 'Offline');
  };

  const handleOpenEditProfile = () => {
    setTempName(deviceName);
    setTempImage(avatarImage);
    setShowEditProfile(true);
  };

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 140, height: 140 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        const base64 = `data:image/jpeg;base64,${manipResult.base64}`;
        setTempImage(base64);
      }
    } catch (err) {
      console.error('Pick photo error:', err);
    }
  };

  const handleSaveProfile = async () => {
    const trimmed = tempName.trim();
    if (!trimmed) return;
    await StorageService.setDeviceName(trimmed);
    await StorageService.setAvatarImage(tempImage);
    setDeviceName(trimmed);
    setAvatarImage(tempImage);
    SocketService.setAvatar(tempImage);
    setShowEditProfile(false);
  };

  const handleStartHost = async () => {
    setLoading(true);
    setError(null);
    SocketService.disconnect();
    try {
      const ip = await SocketService.startServer(deviceName, deviceId, 'Active', 0, avatarImage);
      navigation.navigate('Contacts', { mode: 'host', hostIp: ip });
    } catch (err) {
      setError('Unable to start room. Turn on Wi-Fi or Mobile Hotspot and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setFoundHosts([]);
    setError(null);
    try {
      const hosts = await SocketService.scanNetwork();
      setFoundHosts(hosts);
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const connectToHost = async (hostIp) => {
    setLoading(true);
    setError(null);
    await new Promise(resolve => setTimeout(resolve, 800));
    try {
      await SocketService.connectToServer(hostIp, deviceName, deviceId, 'Active', avatarImage);
      navigation.navigate('Contacts', { mode: 'client', hostIp });
    } catch (err) {
      console.error('Connection failed:', err);
      setError(`Failed to connect to ${hostIp}. Ensure the host is active.`);
    } finally {
      setLoading(false);
    }
  };

  const handleManualConnect = () => {
    const ip = manualIp.trim();
    if (!ip) {
      setError('Enter a valid IP address (e.g. 192.168.43.1)');
      return;
    }
    connectToHost(ip);
  };

  const handleAutoConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await SocketService.connectToServer(null, deviceName, deviceId, 'Active');
      navigation.navigate('Contacts', { mode: 'client' });
    } catch (err) {
      setError('Gateway auto-connect timed out. Try scanning or enter IP manually.');
    } finally {
      setLoading(false);
    }
  };

  const avatarColor = getAvatarColor(deviceName);
  const initials = getInitials(deviceName);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Top App Bar */}
      <View style={[styles.appBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.userChip}
          onPress={handleOpenEditProfile}
          activeOpacity={0.7}
        >
          <View style={[styles.avatarSmall, { backgroundColor: avatarColor }]}>
            {avatarImage ? (
              <Image source={{ uri: avatarImage }} style={styles.avatarSmallPhoto} />
            ) : (
              <Text style={styles.avatarSmallText}>{initials}</Text>
            )}
          </View>
          <View>
            <Text style={[styles.userNameText, { color: colors.textPrimary }]} numberOfLines={1}>
              {deviceName}
            </Text>
            <Text style={[styles.editProfileHint, { color: colors.textMuted }]}>Edit profile</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.appBarRight}>
          {/* User Manual Button */}
          <TouchableOpacity
            style={[styles.topIconBtn, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}
            onPress={() => setShowUserManual(true)}
            activeOpacity={0.7}
          >
            <BookOpen color={colors.primary} size={17} />
          </TouchableOpacity>

          {/* Theme Toggle */}
          <TouchableOpacity
            style={[styles.topIconBtn, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            {isDark ? (
              <Sun color={colors.warning} size={17} />
            ) : (
              <Moon color={colors.primary} size={17} />
            )}
          </TouchableOpacity>

          {/* Network IP badge */}
          <View style={[styles.ipBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Wifi color={currentIp !== 'Offline' ? colors.online : colors.offline} size={14} />
            <Text style={[styles.ipBadgeText, { color: colors.textSecondary }]}>{currentIp}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.titleSection}>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>Offnet Chat</Text>
          <Text style={[styles.subheading, { color: colors.textSecondary }]}>
            Local offline messaging over Wi-Fi or Mobile Hotspot.
          </Text>
        </View>

        {/* Error banner */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.errorMuted, borderColor: colors.error }]}>
            <Text style={[styles.errorBannerText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Segmented Control */}
        <View style={[styles.segmentedControl, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'join' && { backgroundColor: colors.surfaceElevated, shadowColor: '#000', shadowOpacity: 0.1, elevation: 1 },
            ]}
            onPress={() => {
              setActiveTab('join');
              if (foundHosts.length === 0 && !scanning) {
                handleScan();
              }
            }}
            activeOpacity={0.8}
          >
            <Search color={activeTab === 'join' ? colors.primary : colors.textSecondary} size={16} />
            <Text style={[styles.segmentText, { color: activeTab === 'join' ? colors.textPrimary : colors.textSecondary }]}>
              Find Rooms
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'host' && { backgroundColor: colors.surfaceElevated, shadowColor: '#000', shadowOpacity: 0.1, elevation: 1 },
            ]}
            onPress={() => setActiveTab('host')}
            activeOpacity={0.8}
          >
            <Radio color={activeTab === 'host' ? colors.primary : colors.textSecondary} size={16} />
            <Text style={[styles.segmentText, { color: activeTab === 'host' ? colors.textPrimary : colors.textSecondary }]}>
              Host Room
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: Find Rooms */}
        {activeTab === 'join' && (
          <View style={styles.sectionContainer}>
            {/* Quick Auto-Connect */}
            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleAutoConnect}
              disabled={loading}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryMuted }]}>
                <Wifi color={colors.primary} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>Connect to Hotspot Host</Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                  Connect directly to the phone hosting the hotspot
                </Text>
              </View>
              <ArrowRight color={colors.textSecondary} size={18} />
            </TouchableOpacity>

            {/* Discovered Rooms List */}
            <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.listHeader}>
                <Text style={[styles.listTitle, { color: colors.textPrimary }]}>Discovered Rooms</Text>
                <TouchableOpacity
                  onPress={handleScan}
                  disabled={scanning}
                  style={styles.refreshButton}
                >
                  <RefreshCw
                    color={colors.primary}
                    size={14}
                    style={scanning ? { opacity: 0.5 } : undefined}
                  />
                  <Text style={[styles.refreshText, { color: colors.primary }]}>
                    {scanning ? 'Scanning...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
              </View>

              {scanning ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Scanning local network subnet...
                  </Text>
                </View>
              ) : foundHosts.length > 0 ? (
                foundHosts.map((host, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.hostRow, { borderTopColor: colors.border }]}
                    onPress={() => connectToHost(host.ip)}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.hostIcon, { backgroundColor: colors.primaryDark }]}>
                      <Server color="#FFFFFF" size={18} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.hostName, { color: colors.textPrimary }]}>{host.ip}</Text>
                      <Text style={[styles.hostDetails, { color: colors.textMuted }]}>Local Host • Port 12345</Text>
                    </View>
                    <View style={[styles.joinBadge, { backgroundColor: colors.primaryMuted }]}>
                      <Text style={[styles.joinBadgeText, { color: colors.primaryLight }]}>Join</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No rooms found</Text>
                  <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                    Make sure the host has launched a room on this Wi-Fi or Hotspot.
                  </Text>
                </View>
              )}
            </View>

            {/* Manual IP input */}
            <View style={[styles.manualCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.manualHeading, { color: colors.textPrimary }]}>Connect via IP</Text>
              <View style={styles.manualRow}>
                <TextInput
                  style={[styles.manualInput, { backgroundColor: colors.surfaceInput, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="e.g. 192.168.43.1"
                  placeholderTextColor={colors.textMuted}
                  value={manualIp}
                  onChangeText={setManualIp}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.manualButton, { backgroundColor: colors.primary }]}
                  onPress={handleManualConnect}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <ArrowRight color="#FFFFFF" size={18} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Tab 2: Host Room */}
        {activeTab === 'host' && (
          <View style={styles.sectionContainer}>
            <View style={[styles.hostCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.hostIconLarge, { backgroundColor: colors.primary }]}>
                <Radio color="#FFFFFF" size={32} />
              </View>
              <Text style={[styles.hostCardTitle, { color: colors.textPrimary }]}>Start Local Network Room</Text>
              <Text style={[styles.hostCardSubtitle, { color: colors.textSecondary }]}>
                Host an offline chat room. Nearby devices connected to your Wi-Fi or Mobile Hotspot can join and message in this room.
              </Text>

              <View style={[styles.networkInfoPill, { backgroundColor: colors.surfaceInput }]}>
                <Text style={[styles.networkInfoLabel, { color: colors.textMuted }]}>Host IP:</Text>
                <Text style={[styles.networkInfoValue, { color: colors.primaryLight }]}>{currentIp}</Text>
              </View>

              <TouchableOpacity
                style={[styles.startHostButton, { backgroundColor: colors.primary }]}
                onPress={handleStartHost}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.startHostButtonText}>Launch Room</Text>
                    <ArrowRight color="#FFFFFF" size={18} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* User Manual Guide Banner */}
        <TouchableOpacity
          style={[styles.guideBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowUserManual(true)}
          activeOpacity={0.8}
        >
          <View style={[styles.guideIconCircle, { backgroundColor: colors.primaryMuted }]}>
            <BookOpen color={colors.primary} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>User Manual & Instructions</Text>
            <Text style={[styles.guideSubtitle, { color: colors.textSecondary }]}>
              Step-by-step instructions on setting up offline rooms
            </Text>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>
      </ScrollView>

      {/* Profile Edit Modal */}
      <Modal visible={showEditProfile} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                <X color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            {/* Avatar Photo Edit */}
            <View style={styles.modalAvatarRow}>
              <TouchableOpacity
                style={[styles.modalAvatarCircle, { backgroundColor: avatarColor }]}
                onPress={handlePickPhoto}
                activeOpacity={0.8}
              >
                {tempImage ? (
                  <Image source={{ uri: tempImage }} style={styles.modalAvatarPhoto} />
                ) : initials !== '?' ? (
                  <Text style={styles.modalAvatarText}>{initials}</Text>
                ) : (
                  <User color="#FFFFFF" size={32} />
                )}
                <View style={[styles.modalCameraBadge, { backgroundColor: colors.primary }]}>
                  <Camera color="#FFFFFF" size={12} />
                </View>
              </TouchableOpacity>

              <View style={styles.modalPhotoActions}>
                <TouchableOpacity onPress={handlePickPhoto}>
                  <Text style={[styles.modalPhotoActionText, { color: colors.primary }]}>
                    {tempImage ? 'Change Photo' : 'Upload Photo'}
                  </Text>
                </TouchableOpacity>
                {tempImage && (
                  <TouchableOpacity onPress={() => setTempImage(null)} style={{ marginTop: 6 }}>
                    <Text style={[styles.modalPhotoActionText, { color: colors.error }]}>Remove Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <Text style={[styles.inputFieldLabel, { color: colors.textMuted }]}>DISPLAY NAME</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceInput, color: colors.textPrimary, borderColor: colors.border }]}
              value={tempName}
              onChangeText={setTempName}
              placeholder="Display Name"
              placeholderTextColor={colors.textMuted}
              maxLength={25}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowEditProfile(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: colors.primary }]}
                onPress={handleSaveProfile}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Complete User Manual Modal */}
      <Modal visible={showUserManual} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.manualModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.manualModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <BookOpen color={colors.primary} size={22} />
                <Text style={[styles.manualModalTitle, { color: colors.textPrimary }]}>User Manual</Text>
              </View>
              <TouchableOpacity onPress={() => setShowUserManual(false)} style={styles.manualCloseBtn}>
                <X color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.manualScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.manualIntro, { color: colors.textSecondary }]}>
                Follow these simple steps to chat offline with nearby friends and devices without using any internet data:
              </Text>

              {/* Step 1 */}
              <View style={[styles.stepCard, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Connect to the Same Network</Text>
                  <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                    All devices must be connected to the same local network:{'\n'}
                    • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Option A:</Text> Connect everyone to any common Wi-Fi router.{'\n'}
                    • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Option B:</Text> One person turns on their phone's <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Mobile Hotspot</Text>, and all other friends connect to that Hotspot Wi-Fi. (No cellular data is needed).
                  </Text>
                </View>
              </View>

              {/* Step 2 */}
              <View style={[styles.stepCard, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Host the Room</Text>
                  <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                    One person acts as the room host:{'\n'}
                    1. Open Offnet Chat and tap <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Host Room</Text>.{'\n'}
                    2. Tap <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Launch Room</Text>.{'\n'}
                    3. You will enter the room and your IP address will be displayed.
                  </Text>
                </View>
              </View>

              {/* Step 3 */}
              <View style={[styles.stepCard, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Join the Room</Text>
                  <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                    All other friends can now join the host:{'\n'}
                    1. Open Offnet Chat and stay on <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Find Rooms</Text>.{'\n'}
                    2. If connected to a friend's hotspot, tap <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Connect to Hotspot Host</Text> for instant connection.{'\n'}
                    3. Or tap <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Join</Text> next to the host's IP in the list.
                  </Text>
                </View>
              </View>

              {/* Step 4 */}
              <View style={[styles.stepCard, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>4</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Chat & Share Media</Text>
                  <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                    Once in the room:{'\n'}
                    • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>General Chat:</Text> Broadcast messages to all connected devices.{'\n'}
                    • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Direct Messages:</Text> Tap on any connected peer's name to start a private 1-on-1 chat.{'\n'}
                    • Send photos from your camera or photo gallery, and long-press any message to reply.
                  </Text>
                </View>
              </View>

              {/* Step 5 */}
              <View style={[styles.stepCard, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>5</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Voice Notes & Real-time Calls</Text>
                  <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                    Communicate hands-free with real-time audio:{'\n'}
                    • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>WhatsApp-Style Voice Notes:</Text> Tap the microphone button in any chat to record. Tap send to deliver the audio note immediately.{'\n'}
                    • <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Real-Time Voice Calls:</Text> In direct 1-on-1 chats, tap the phone call icon in the top header. Talk in real-time over the local network with live mute, speaker, and end call controls.
                  </Text>
                </View>
              </View>

              {/* Step 6 */}
              <View style={[styles.stepCard, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>6</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Troubleshooting Tips</Text>
                  <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                    • If room is not discovered, tap <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Refresh</Text> or enter the host's IP manually.{'\n'}
                    • Ensure Wi-Fi / Hotspot remains connected while chatting.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.manualDoneBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowUserManual(false)}
            >
              <Text style={styles.manualDoneBtnText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarSmallPhoto: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarSmallText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  userNameText: {
    fontSize: 15,
    fontWeight: '600',
  },
  editProfileHint: {
    fontSize: 11,
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  ipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  ipBadgeText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  titleSection: {
    marginBottom: 18,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorBannerText: {
    fontSize: 13,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 18,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionContainer: {
    gap: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  listCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  hostIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostName: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  hostDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  joinBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  joinBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  manualCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  manualHeading: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  manualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
  },
  manualButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostCard: {
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  hostIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  hostCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  hostCardSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  networkInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 20,
    gap: 6,
  },
  networkInfoLabel: {
    fontSize: 12,
  },
  networkInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  startHostButton: {
    width: '100%',
    height: 50,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  startHostButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  guideBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
    gap: 14,
  },
  guideIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  guideSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  modalAvatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  modalAvatarPhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  modalAvatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  modalCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  modalPhotoActions: {
    justifyContent: 'center',
  },
  modalPhotoActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  modalInput: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalSave: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  manualModalContent: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    maxHeight: '85%',
  },
  manualModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  manualModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  manualCloseBtn: {
    padding: 4,
  },
  manualScroll: {
    marginBottom: 14,
  },
  manualIntro: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  stepCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  manualDoneBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  manualDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
