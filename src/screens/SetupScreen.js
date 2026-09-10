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
  TouchableWithoutFeedback,
  Keyboard,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, ArrowRight, Sun, Moon, Camera, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../theme/ThemeContext';
import StorageService from '../services/StorageService';

export default function SetupScreen({ navigation }) {
  const { colors, isDark, toggleTheme, getAvatarColor, getInitials } = useTheme();
  const [name, setName] = useState('');
  const [avatarImage, setAvatarImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const avatarColor = getAvatarColor(name || 'User');
  const initials = getInitials(name || '');

  const pickProfilePicture = async () => {
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
        setAvatarImage(`data:image/jpeg;base64,${manipResult.base64}`);
      }
    } catch (err) {
      console.error('Image picker error:', err);
    }
  };

  const removeProfilePicture = () => {
    setAvatarImage(null);
  };

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
      await StorageService.setDeviceRank('Active');
      await StorageService.setAvatarColor(avatarColor);
      await StorageService.setAvatarImage(avatarImage);
      await StorageService.getDeviceId();
      await StorageService.setAccessGranted();

      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (e) {
      setError('Unable to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.innerContainer}
        >
          {/* Top Bar with Theme Toggle */}
          <View style={styles.topBar}>
            <View style={{ width: 36 }} />
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Offnet Chat</Text>
            <TouchableOpacity
              style={[styles.themeToggle, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}
              onPress={toggleTheme}
              activeOpacity={0.7}
            >
              {isDark ? (
                <Sun color={colors.warning} size={18} />
              ) : (
                <Moon color={colors.primary} size={18} />
              )}
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <View style={styles.topSection}>
            <Text style={[styles.screenHeading, { color: colors.textPrimary }]}>Create Your Profile</Text>
            <Text style={[styles.screenDescription, { color: colors.textSecondary }]}>
              Add a photo and choose your display name to start chatting with nearby devices.
            </Text>

            {/* Profile Picture / Avatar */}
            <View style={styles.avatarWrapper}>
              <TouchableOpacity
                onPress={pickProfilePicture}
                activeOpacity={0.8}
                style={[
                  styles.avatarCircle,
                  { backgroundColor: avatarColor, borderColor: colors.border },
                ]}
              >
                {avatarImage ? (
                  <Image source={{ uri: avatarImage }} style={styles.avatarPhoto} />
                ) : initials !== '?' && initials.length > 0 ? (
                  <Text style={styles.avatarText}>{initials}</Text>
                ) : (
                  <User color="#FFFFFF" size={44} strokeWidth={1.5} />
                )}

                {/* Camera Badge */}
                <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                  <Camera color="#FFFFFF" size={15} />
                </View>
              </TouchableOpacity>

              {/* Photo Action Links */}
              <View style={styles.photoActionsRow}>
                <TouchableOpacity onPress={pickProfilePicture} activeOpacity={0.7}>
                  <Text style={[styles.photoActionText, { color: colors.primary }]}>
                    {avatarImage ? 'Change Photo' : 'Add Photo'}
                  </Text>
                </TouchableOpacity>
                {avatarImage && (
                  <TouchableOpacity onPress={removeProfilePicture} activeOpacity={0.7} style={{ marginLeft: 12 }}>
                    <Text style={[styles.photoActionText, { color: colors.error }]}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Input Card */}
            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>DISPLAY NAME</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                placeholder="e.g. Alex Morgan"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (error) setError('');
                }}
                autoFocus
                autoCorrect={false}
                maxLength={25}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <View style={styles.inputFooter}>
                {error ? (
                  <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                ) : (
                  <Text style={[styles.hintText, { color: colors.textMuted }]}>
                    Visible to other devices on the network
                  </Text>
                )}
                <Text style={[styles.counterText, { color: colors.textMuted }]}>{name.length}/25</Text>
              </View>
            </View>
          </View>

          {/* Bottom Action Section */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
                (!name.trim() || saving) && { backgroundColor: colors.surfaceElevated, opacity: 0.6 },
              ]}
              onPress={handleSubmit}
              disabled={!name.trim() || saving}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? 'Setting up...' : 'Get Started'}
              </Text>
              {!saving && <ArrowRight color="#FFFFFF" size={18} />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  topSection: {
    alignItems: 'center',
  },
  screenHeading: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  screenDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: 24,
  },
  avatarWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    position: 'relative',
    overflow: 'visible',
  },
  avatarPhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  photoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputCard: {
    width: '100%',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    fontSize: 18,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  hintText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
  },
  counterText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
