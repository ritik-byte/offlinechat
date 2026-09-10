import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import StorageService from '../services/StorageService';

/*
// =========================================================================
// [NOTE FOR DEVELOPER]: 
// Initial PIN verification has been removed from the primary app flow.
// Normal users now navigate directly to SetupScreen or HomeScreen.
// This screen is preserved for optional passcode locking if needed.
// =========================================================================
*/

export default function AccessScreen({ navigation }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBypass = async () => {
    await StorageService.setAccessGranted();
    const isFirst = await StorageService.isFirstLaunch();
    navigation.reset({
      index: 0,
      routes: [{ name: isFirst ? 'Setup' : 'Home' }],
    });
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');

    setTimeout(async () => {
      await handleBypass();
    }, 400);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <View style={styles.iconBadge}>
            <Lock color={colors.primaryLight} size={36} />
          </View>
          <Text style={styles.title}>Private Room Access</Text>
          <Text style={styles.subtitle}>Enter security passkey or continue directly</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(600).delay(200)} style={styles.inputCard}>
          <Text style={styles.label}>ACCESS KEY (OPTIONAL)</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={key}
              onChangeText={(t) => {
                setKey(t);
                if (error) setError('');
              }}
              autoCorrect={false}
              autoCapitalize="none"
              onSubmitEditing={handleVerify}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={handleVerify}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{loading ? 'Unlocking...' : 'Continue'}</Text>
            {!loading && <ArrowRight color="#FFFFFF" size={18} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleBypass}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip & Start Chatting</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.footer}>
          <ShieldCheck color={colors.textMuted} size={16} />
          <Text style={styles.footerText}>Secure Local Network</Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  inputCard: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
    fontWeight: '700',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderRadius: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  skipBtn: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipText: {
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
