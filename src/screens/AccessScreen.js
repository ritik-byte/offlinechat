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
import { Lock, Shield, ArrowRight } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import StorageService from '../services/StorageService';

export default function AccessScreen({ navigation }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!key.trim()) {
      setError('ACCESS KEY REQUIRED');
      return;
    }

    setLoading(true);
    setError('');

    // Simulate a bit of processing for "tactical" feel
    setTimeout(async () => {
      if (StorageService.verifyKey(key.trim())) {
        await StorageService.setAccessGranted();
        const isFirst = await StorageService.isFirstLaunch();
        navigation.reset({
          index: 0,
          routes: [{ name: isFirst ? 'Setup' : 'Home' }],
        });
      } else {
        setError('INVALID ACCESS KEY - PERMISSION DENIED');
        setLoading(false);
      }
    }, 800);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Animated.View entering={FadeInDown.duration(800)} style={styles.header}>
          <View style={styles.iconCircle}>
            <Lock color="#4ADE80" size={40} />
          </View>
          <Text style={styles.title}>RESTRICTED ACCESS</Text>
          <Text style={styles.subtitle}>MILITARY PROTOCOL ENFORCED</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(800).delay(400)} style={styles.inputArea}>
          <Text style={styles.label}>ENTER SECURITY KEY</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              placeholderTextColor="#333"
              secureTextEntry
              value={key}
              onChangeText={(t) => {
                setKey(t);
                if (error) setError('');
              }}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              onSubmitEditing={handleVerify}
            />
          </View>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <TouchableOpacity 
            style={[styles.button, (!key.trim() || loading) && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={!key.trim() || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{loading ? 'VERIFYING...' : 'AUTHORIZE'}</Text>
            {!loading && <ArrowRight color="#000" size={20} />}
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.footer}>
          <Shield color="#222" size={20} />
          <Text style={styles.footerText}>SECURE TERMINAL V1.0</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#0A0A0A',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    color: '#444',
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginTop: 8,
    textAlign: 'center',
  },
  inputArea: {
    backgroundColor: '#0A0A0A',
    padding: 24,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  label: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 12,
    fontWeight: '900',
  },
  inputWrapper: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#333',
    color: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: 'monospace',
    letterSpacing: 4,
    borderRadius: 2,
  },
  errorText: {
    color: '#FF3333',
    fontSize: 10,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
  },
  button: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 2,
    gap: 10,
  },
  buttonDisabled: {
    backgroundColor: '#1A1A1A',
    opacity: 0.5,
  },
  buttonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: '#222',
    fontSize: 9,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
});
