import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, User, Shield, ChevronDown } from 'lucide-react-native';
import { Modal, FlatList } from 'react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import StorageService from '../services/StorageService';

export default function SetupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [rank, setRank] = useState('Soldier');
  const [customRank, setCustomRank] = useState('');
  const [isCustomRank, setIsCustomRank] = useState(false);
  const [showRankPicker, setShowRankPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const RANKS = [
    'Soldier','Sepoy', 'Lance Naik', 'Naik', 'Havildar', 'Naib Subedar', 
    'Subedar', 'Subedar Major', 'Lieutenant', 'Captain', 'Major', 
    'Lieutenant Colonel', 'Colonel', 'Brigadier', 'Major General', 
    'Lieutenant General', 'General', 'OTHER / CUSTOM...'
  ];
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    // Subtle pulse animation on the icon
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1500,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name');
      return;
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await StorageService.setDeviceName(trimmed);
      const finalRank = isCustomRank ? (customRank.trim() || 'Soldier') : rank;
      await StorageService.setDeviceRank(finalRank);
      await StorageService.getDeviceId(); // Generate device ID
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (e) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Top Branding */}
        <Animated.View entering={FadeInDown.duration(800)} style={styles.brandArea}>
          <RNAnimated.View style={[styles.iconCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Shield color={colors.primary} size={40} />
          </RNAnimated.View>
          <Text style={styles.brandTitle}>14 GRENADIERS</Text>
          <Text style={styles.brandTagline}>⚔ EK AUR CHAR ⚔</Text>
        </Animated.View>

        {/* Setup Form */}
        <Animated.View entering={FadeInUp.duration(800).delay(400)} style={styles.formCard}>
          <View style={styles.formHeader}>
            <User color={colors.primary} size={24} />
            <Text style={styles.formTitle}>Identify Yourself, Soldier</Text>
          </View>
          <Text style={styles.formSubtitle}>
            Your callsign will be visible to other personnel on the network.
            Set this once — it stays on your device.
          </Text>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Callsign (e.g. ALPHA-1)"
              placeholderTextColor="#333"
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (error) setError('');
              }}
              autoFocus
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Text style={styles.charCount}>{name.length}/20</Text>
          </View>

          <Text style={styles.inputLabel}>OFFICIAL RANK</Text>
          <TouchableOpacity 
            style={styles.rankPicker} 
            onPress={() => setShowRankPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.rankText}>{isCustomRank ? (customRank || 'ENTER CUSTOM...') : rank}</Text>
            <ChevronDown color="#FFFFFF" size={20} />
          </TouchableOpacity>

          {isCustomRank && (
            <Animated.View entering={FadeInDown} style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter custom rank..."
                placeholderTextColor="#333"
                value={customRank}
                onChangeText={setCustomRank}
                maxLength={20}
              />
            </Animated.View>
          )}

          <Modal visible={showRankPicker} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>OFFICIAL RANKS</Text>
                <FlatList
                  data={RANKS}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={[styles.rankItem, (isCustomRank ? item === 'OTHER / CUSTOM...' : rank === item) && styles.rankItemActive]}
                      onPress={() => {
                        if (item === 'OTHER / CUSTOM...') {
                          setIsCustomRank(true);
                        } else {
                          setIsCustomRank(false);
                          setRank(item);
                        }
                        setShowRankPicker(false);
                      }}
                    >
                      <Text style={[styles.rankItemText, (isCustomRank ? item === 'OTHER / CUSTOM...' : rank === item) && styles.rankItemTextActive]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                />
                <TouchableOpacity 
                  style={styles.modalClose} 
                  onPress={() => setShowRankPicker(false)}
                >
                  <Text style={styles.modalCloseText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!name.trim() || saving) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={saving || !name.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.submitText}>
              {saving ? 'Saving...' : 'Get Started'}
            </Text>
            {!saving && <ArrowRight color={colors.background} size={20} />}
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(800).delay(800)} style={styles.footer}>
          <Text style={styles.footerText}>
            Your identity is stored only on this device.{'\n'}
            No internet required. Fully encrypted. 100% tactical.
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
    fontFamily: 'monospace',
  },
  brandTagline: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 8,
    letterSpacing: 6,
    fontFamily: 'monospace',
  },
  formCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 2,
    padding: 24,
    borderWidth: 1,
    borderColor: '#222',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  formSubtitle: {
    fontSize: 11,
    color: '#555',
    lineHeight: 18,
    marginBottom: 20,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#000000',
    color: '#FFFFFF',
    fontSize: 16,
    borderRadius: 2,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#333',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  charCount: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    fontSize: 10,
    color: '#333',
    fontFamily: 'monospace',
  },
  errorText: {
    color: '#FF3333',
    fontSize: 11,
    marginBottom: 12,
    marginLeft: 4,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  submitButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#1A1A1A',
  },
  submitText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    color: '#333',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 16,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  inputLabel: {
    fontSize: 10,
    color: '#555',
    marginBottom: 8,
    marginTop: 8,
    fontFamily: 'monospace',
    letterSpacing: 2,
    fontWeight: '900',
  },
  rankPicker: {
    backgroundColor: '#000000',
    borderRadius: 2,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rankText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 2,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#333',
    maxHeight: '80%',
    padding: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  rankItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  rankItemActive: {
    backgroundColor: '#111',
  },
  rankItemText: {
    color: '#555',
    fontSize: 13,
    fontFamily: 'monospace',
    letterSpacing: 2,
    textAlign: 'center',
  },
  rankItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  modalClose: {
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
  },
  modalCloseText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: 3,
    fontWeight: '900',
  },
});

