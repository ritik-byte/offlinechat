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
import { ArrowRight, User, Wifi } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import StorageService from '../services/StorageService';

export default function SetupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
            <Wifi color={colors.primary} size={40} />
          </RNAnimated.View>
          <Text style={styles.brandTitle}>NexusChat</Text>
          <Text style={styles.brandTagline}>Offline Communication System</Text>
        </Animated.View>

        {/* Setup Form */}
        <Animated.View entering={FadeInUp.duration(800).delay(400)} style={styles.formCard}>
          <View style={styles.formHeader}>
            <User color={colors.primary} size={24} />
            <Text style={styles.formTitle}>What's your name?</Text>
          </View>
          <Text style={styles.formSubtitle}>
            This will be shown to other users when they connect to your device.
            You only need to set this once.
          </Text>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="e.g., Alex, My Phone..."
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (error) setError('');
              }}
              autoFocus
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Text style={styles.charCount}>{name.length}/30</Text>
          </View>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.submitButton,
              !name.trim() && styles.submitButtonDisabled,
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
            Your name is stored only on this device.{'\n'}
            No internet required. 100% private.
          </Text>
        </Animated.View>
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
    borderRadius: 40,
    backgroundColor: colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    letterSpacing: 1,
  },
  brandTagline: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  formSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 18,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  charCount: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    fontSize: 12,
    color: colors.textMuted,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 4,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: colors.border,
  },
  submitText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: '700',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
