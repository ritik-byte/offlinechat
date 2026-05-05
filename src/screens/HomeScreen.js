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
import { Wifi, Users, Search, ArrowRight, Settings } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { colors, getInitials, getAvatarColor } from '../theme/colors';
import SocketService from '../services/SocketService';
import StorageService from '../services/StorageService';

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceName, setDeviceName] = useState('');
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
    const id = await StorageService.getDeviceId();
    setDeviceName(name || 'User');
    setDeviceId(id);
  };

  const loadCurrentIp = async () => {
    const ip = await SocketService.getIpAddress();
    setCurrentIp(ip || 'Not connected');
  };

  const handleHost = async () => {
    setLoading(true);
    setError(null);
    try {
      const ip = await SocketService.startServer(deviceName, deviceId);
      navigation.navigate('Contacts', { mode: 'host', hostIp: ip });
    } catch (err) {
      setError('Failed to start server. Make sure hotspot is active and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
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
    try {
      await SocketService.connectToServer(hostIp, deviceName, deviceId);
      navigation.navigate('Contacts', { mode: 'client', hostIp });
    } catch (err) {
      setError('Failed to connect. Make sure you\'re on the host\'s Wi-Fi network.');
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
      await SocketService.connectToServer(null, deviceName, deviceId);
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
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{deviceName}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Logo */}
      <Animated.View entering={FadeInDown.duration(800).delay(100)} style={styles.logoArea}>
        <View style={styles.logoCircle}>
          <Wifi color={colors.primary} size={36} />
        </View>
        <Text style={styles.title}>NexusChat</Text>
        <Text style={styles.subtitle}>Offline Communication System</Text>
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
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loaderText}>Connecting...</Text>
          </View>
        ) : !showJoinOptions ? (
          <Animated.View entering={FadeInUp.duration(800).delay(300)} style={styles.cardsContainer}>
            {/* Host Card */}
            <TouchableOpacity style={styles.card} onPress={handleHost} activeOpacity={0.8}>
              <View style={styles.cardRow}>
                <View style={styles.cardIconBox}>
                  <Wifi color={colors.background} size={24} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Host Network</Text>
                  <Text style={styles.cardDesc}>Create a chat room on your hotspot</Text>
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
                  <Text style={[styles.cardTitle, styles.textPrimary]}>Join Network</Text>
                  <Text style={styles.cardDescLight}>Connect to a host's hotspot</Text>
                </View>
                <ArrowRight color={colors.primary} size={20} />
              </View>
            </TouchableOpacity>
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
                  <ActivityIndicator size="small" color={colors.primary} />
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
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  logoArea: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  ipContainer: {
    marginTop: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ipText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 51, 102, 0.1)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    fontSize: 13,
  },
  loaderContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loaderText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  cardOutline: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconOutline: {
    backgroundColor: colors.primaryMuted,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.background,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.5)',
  },
  cardDescLight: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  textPrimary: {
    color: colors.primary,
  },
  // ─── Join Options ───
  joinSection: {
    gap: 16,
  },
  joinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  joinTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  cancelText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  autoConnectBtn: {
    backgroundColor: colors.primaryMuted,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  autoConnectText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  scanSection: {
    backgroundColor: colors.surface,
    borderRadius: 14,
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  scanBtn: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  scanLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  scanText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  hostItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  hostDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.online,
  },
  hostIp: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  noHostsText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  manualSection: {
    backgroundColor: colors.surface,
    borderRadius: 14,
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
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
