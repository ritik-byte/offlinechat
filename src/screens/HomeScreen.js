import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Users, Search, ArrowRight, Wifi, Radio } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { colors, getInitials, getAvatarColor } from '../theme/colors';
import SocketService from '../services/SocketService';
import StorageService from '../services/StorageService';

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [deviceRank, setDeviceRank] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [foundHosts, setFoundHosts] = useState([]);
  const [showJoinOptions, setShowJoinOptions] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [currentIp, setCurrentIp] = useState('');

  useEffect(() => {
    loadDeviceInfo();
    loadCurrentIp();
  }, []);

  const loadDeviceInfo = async () => {
    const name = await StorageService.getDeviceName();
    const rank = await StorageService.getDeviceRank();
    const id = await StorageService.getDeviceId();
    setDeviceName(name || 'User');
    setDeviceRank(rank || 'Soldier');
    setDeviceId(id);
  };

  const loadCurrentIp = async () => {
    const ip = await SocketService.getIpAddress();
    setCurrentIp(ip || 'Not connected');
  };

  const handleHost = async () => {
    setLoading(true);
    setError(null);
    SocketService.disconnect(); // Clean up first
    try {
      const ip = await SocketService.startServer(deviceName, deviceId, deviceRank);
      navigation.navigate('Contacts', { mode: 'host', hostIp: ip });
    } catch (err) {
      setError('Failed to start server. Make sure hotspot is active and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    SocketService.disconnect(); // Clean up first
    setShowJoinOptions(true);
    handleScan();
  };

  const handleScan = async () => {
    setScanning(true);
    setFoundHosts([]);
    try {
      const hosts = await SocketService.scanNetwork();
      console.log(`HOME: Found ${hosts.length} hosts`);
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
    // Give the OS/router time to cleanup scan sockets before real connection
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      await SocketService.connectToServer(hostIp, deviceName, deviceId, deviceRank);
      navigation.navigate('Contacts', { mode: 'client', hostIp });
    } catch (err) {
      console.error('Connection failed:', err);
      setError(`Failed to connect to ${hostIp}. Ensure the host is active and try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleManualConnect = () => {
    const ip = manualIp.trim();
    if (!ip) {
      setError('Please enter a valid IP address');
      return;
    }
    connectToHost(ip);
  };

  const handleAutoConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await SocketService.connectToServer(null, deviceName, deviceId, deviceRank);
      navigation.navigate('Contacts', { mode: 'client' });
    } catch (err) {
      setError('Failed to auto-connect. Try scanning or entering IP manually.');
    } finally {
      setLoading(false);
    }
  };

  const avatarColor = getAvatarColor(deviceName);
  const initials = getInitials(deviceName);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* User Info Header */}
      <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>{deviceRank},</Text>
            <Text style={styles.userName}>{deviceName}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Logo */}
      <Animated.View entering={FadeInDown.duration(800).delay(100)} style={styles.logoArea}>
        <View style={styles.logoCircle}>
          <Shield color="#4ADE80" size={36} />
        </View>
        <Text style={styles.title}>14 CHATS</Text>
        <Text style={styles.slogan}>⚔ EK AUR CHAR ⚔</Text>
        <Text style={styles.subtitle}>Tactical Comms Network</Text>
        <View style={styles.ipContainer}>
          <Text style={styles.ipText}>IP: {currentIp}</Text>
        </View>
      </Animated.View>

      <View style={styles.content}>
        {error && (
          <Animated.View entering={FadeInDown} style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#4ADE80" />
            <Text style={styles.loaderText}>Connecting...</Text>
          </View>
        ) : !showJoinOptions ? (
          <Animated.View entering={FadeInUp.duration(800).delay(300)} style={styles.cardsContainer}>
            {/* Host Card */}
            <TouchableOpacity style={styles.card} onPress={handleHost} activeOpacity={0.8}>
              <View style={styles.cardRow}>
                <View style={styles.cardIconBox}>
                  <Radio color={colors.background} size={24} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Deploy Command Post</Text>
                  <Text style={styles.cardDesc}>Establish tactical comm channel</Text>
                </View>
                <ArrowRight color={colors.background} size={20} />
              </View>
            </TouchableOpacity>

            {/* Join Card */}
            <TouchableOpacity style={styles.cardOutline} onPress={handleJoin} activeOpacity={0.8}>
              <View style={styles.cardRow}>
                <View style={[styles.cardIconBox, styles.cardIconOutline]}>
                  <Users color={colors.primary} size={24} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, styles.textPrimary]}>Join Operations</Text>
                  <Text style={styles.cardDescLight}>Connect to an active command post</Text>
                </View>
                <ArrowRight color={colors.primary} size={20} />
              </View>
            </TouchableOpacity>
            {/* Tips */}
            <View style={styles.tipsContainer}>
              <Text style={styles.tipsTitle}>⚡ Comms Intel</Text>
              <Text style={styles.tipsText}>
                Connect all devices to the same network (hotspot or router). One soldier deploys the command post, others join operations.
              </Text>
            </View>
          </Animated.View>
        ) : (
          /* Join Options - Scan Results */
          <Animated.View entering={FadeInUp.duration(600)} style={styles.joinSection}>
            <View style={styles.joinHeader}>
              <Text style={styles.joinTitle}>Find a Host</Text>
              <TouchableOpacity onPress={() => setShowJoinOptions(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {/* Auto Connect */}
            <TouchableOpacity style={styles.autoConnectBtn} onPress={handleAutoConnect} activeOpacity={0.8}>
              <Wifi color={colors.primary} size={18} />
              <Text style={styles.autoConnectText}>Auto Connect (Gateway)</Text>
            </TouchableOpacity>

            {/* Scan Results */}
            <View style={styles.scanSection}>
              <View style={styles.scanHeader}>
                <Text style={styles.scanLabel}>Available Hosts</Text>
                <TouchableOpacity onPress={handleScan} disabled={scanning}>
                  <Text style={[styles.scanBtn, scanning && { opacity: 0.5 }]}>
                    {scanning ? 'Scanning...' : 'Scan Again'}
                  </Text>
                </TouchableOpacity>
              </View>

              {scanning ? (
                <View style={styles.scanLoader}>
                  <ActivityIndicator size="small" color="#4ADE80" />
                  <Text style={styles.scanText}>Scanning local network...</Text>
                </View>
              ) : foundHosts.length > 0 ? (
                foundHosts.map((host, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.hostItem}
                    onPress={() => connectToHost(host.ip)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.hostDot} />
                    <Text style={styles.hostIp}>{host.ip}</Text>
                    <ArrowRight color={colors.textSecondary} size={16} />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noHostsText}>No hosts found. Try scanning again.</Text>
              )}
            </View>

            {/* Manual IP */}
            <View style={styles.manualSection}>
              <Text style={styles.scanLabel}>Manual Connect</Text>
              <View style={styles.manualRow}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="192.168.43.1"
                  placeholderTextColor={colors.textMuted}
                  value={manualIp}
                  onChangeText={setManualIp}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.manualBtn} onPress={handleManualConnect}>
                  <ArrowRight color={colors.background} size={18} />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  avatarText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: 'monospace',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    fontFamily: 'monospace',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  logoArea: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 28,
  },
  logoCircle: {
    width: 70,
    height: 70,
    borderRadius: 4,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
    fontFamily: 'monospace',
  },
  subtitle: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 6,
    letterSpacing: 4,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  slogan: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 8,
    letterSpacing: 6,
    fontFamily: 'monospace',
  },
  ipContainer: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#333',
  },
  ipText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: 'monospace',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  errorContainer: {
    backgroundColor: 'rgba(255,51,51,0.05)',
    padding: 14,
    borderRadius: 2,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  loaderContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loaderText: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  cardsContainer: {
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  cardOutline: {
    backgroundColor: 'transparent',
    borderRadius: 2,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconOutline: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: '#333',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 3,
    fontFamily: 'monospace',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  cardDesc: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.4)',
    fontFamily: 'monospace',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardDescLight: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: 'monospace',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  joinSection: { gap: 14 },
  joinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  joinTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  cancelText: {
    color: colors.error,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  autoConnectBtn: {
    backgroundColor: 'transparent',
    borderRadius: 2,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  autoConnectText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  scanSection: {
    backgroundColor: colors.surface,
    borderRadius: 2,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 8,
    fontFamily: 'monospace',
    letterSpacing: 3,
  },
  scanBtn: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  scanLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  scanText: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  hostItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hostDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  hostIp: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  noHostsText: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 12,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  manualSection: {
    borderRadius: 2,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualRow: {
    flexDirection: 'row',
    gap: 10,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#000',
    color: '#FFF',
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  manualBtn: {
    width: 48,
    height: 48,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipsContainer: {
    marginTop: 18,
    padding: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#222',
  },
  tipsTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#555',
    marginBottom: 4,
    fontFamily: 'monospace',
    letterSpacing: 3,
  },
  tipsText: {
    fontSize: 10,
    color: '#333',
    lineHeight: 16,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});

