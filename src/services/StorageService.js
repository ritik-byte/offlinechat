import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  DEVICE_NAME: '@nexuschat_device_name',
  DEVICE_RANK: '@nexuschat_device_rank', // Kept for protocol compatibility (stores user status / bio)
  DEVICE_ID: '@nexuschat_device_id',
  DEVICE_AVATAR_COLOR: '@nexuschat_device_avatar_color',
  DEVICE_AVATAR_IMAGE: '@nexuschat_device_avatar_image',
  ACCESS_GRANTED: '@nexuschat_access_granted',
  CHAT_HISTORY: '@nexuschat_chat_',
  CONTACTS: '@nexuschat_contacts',
};

/*
// ============================================================================
// [REMOVED FOR NORMAL USERS] - Tactical Access Key / PIN
// ============================================================================
// Previously used for military/tactical access verification:
// const _ENCRYPTED_KEY = 'UkFNMjIxNDA1'; 
// const _tacticalDecode = (encoded) => { ... };
// ============================================================================
*/

class StorageService {
  // ─── Device Identity (Normal Consumer Profile) ───────────────

  /**
   * Check if this is the first launch (no device name set yet)
   */
  async isFirstLaunch() {
    const name = await AsyncStorage.getItem(KEYS.DEVICE_NAME);
    return !name || name.trim().length === 0;
  }

  /**
   * Get saved user display name
   */
  async getDeviceName() {
    return await AsyncStorage.getItem(KEYS.DEVICE_NAME);
  }

  /**
   * Save user display name (set during initial registration)
   */
  async setDeviceName(name) {
    await AsyncStorage.setItem(KEYS.DEVICE_NAME, name.trim());
  }

  /**
   * User status / bio (Replaced the military rank system)
   * Kept backwards-compatible with socket protocol.
   */
  async getDeviceRank() {
    // Return friendly default for normal users
    const rank = await AsyncStorage.getItem(KEYS.DEVICE_RANK);
    return rank || 'Active';
  }

  /**
   * Save user status / bio
   */
  async setDeviceRank(status) {
    await AsyncStorage.setItem(KEYS.DEVICE_RANK, status ? status.trim() : 'Active');
  }

  /**
   * Optional custom avatar color preference
   */
  async getAvatarColor() {
    return await AsyncStorage.getItem(KEYS.DEVICE_AVATAR_COLOR);
  }

  async setAvatarColor(color) {
    if (color) {
      await AsyncStorage.setItem(KEYS.DEVICE_AVATAR_COLOR, color);
    }
  }

  /**
   * User profile picture (local file URI or base64)
   */
  async getAvatarImage() {
    return await AsyncStorage.getItem(KEYS.DEVICE_AVATAR_IMAGE);
  }

  async setAvatarImage(uri) {
    if (uri) {
      await AsyncStorage.setItem(KEYS.DEVICE_AVATAR_IMAGE, uri);
    } else {
      await AsyncStorage.removeItem(KEYS.DEVICE_AVATAR_IMAGE);
    }
  }

  /**
   * Get or generate a unique device ID
   */
  async getDeviceId() {
    let id = await AsyncStorage.getItem(KEYS.DEVICE_ID);
    if (!id) {
      id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(KEYS.DEVICE_ID, id);
    }
    return id;
  }

  // ─── Chat History ──────────────────────────────────────────

  /**
   * Get chat history for a specific peer
   * @param {string} peerId - The peer's device ID or 'general' for group chat
   * @returns {Array} Array of message objects
   */
  async getChatHistory(peerId) {
    try {
      const key = KEYS.CHAT_HISTORY + peerId;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading chat history:', error);
      return [];
    }
  }

  /**
   * Save a single message to chat history
   * @param {string} peerId - The peer's device ID or 'general' for group
   * @param {object} message - Message object
   */
  async addMessage(peerId, message) {
    try {
      const key = KEYS.CHAT_HISTORY + peerId;
      const existing = await this.getChatHistory(peerId);
      // Prevent duplicates
      if (existing.find(m => m.id === message.id)) return;
      existing.push(message);
      // Keep last 1000 messages per conversation
      const trimmed = existing.slice(-1000);
      await AsyncStorage.setItem(key, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Error saving message:', error);
    }
  }

  /**
   * Save entire chat history for a peer (bulk)
   */
  async saveChatHistory(peerId, messages) {
    try {
      const key = KEYS.CHAT_HISTORY + peerId;
      await AsyncStorage.setItem(key, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  }

  /**
   * Get the last message for a conversation (used in contact list)
   */
  async getLastMessage(peerId) {
    const history = await this.getChatHistory(peerId);
    return history.length > 0 ? history[history.length - 1] : null;
  }

  // ─── Contacts / Known Users ────────────────────────────────

  /**
   * Save the known contacts list
   */
  async saveContacts(contacts) {
    try {
      await AsyncStorage.setItem(KEYS.CONTACTS, JSON.stringify(contacts));
    } catch (error) {
      console.error('Error saving contacts:', error);
    }
  }

  /**
   * Get known contacts from local storage
   */
  async getContacts() {
    try {
      const data = await AsyncStorage.getItem(KEYS.CONTACTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading contacts:', error);
      return [];
    }
  }

  // ─── Access Control (Bypassed for Normal Users) ─────────────

  /**
   * Check if access is granted.
   * NOTE: Initial PIN / access key has been removed for normal users.
   * Always returns true so users go directly to Registration or Home.
   */
  async isAccessGranted() {
    // Commented out the old PIN verification check for normal consumer user flow:
    // const granted = await AsyncStorage.getItem(KEYS.ACCESS_GRANTED);
    // return granted === 'true';
    return true;
  }

  /**
   * Save access grant status (kept as harmless no-op)
   */
  async setAccessGranted() {
    await AsyncStorage.setItem(KEYS.ACCESS_GRANTED, 'true');
  }

  /**
   * Verify a key against the master key
   * NOTE: Initial PIN check has been removed. Always returns true if called.
   */
  verifyKey(key) {
    /*
    // Old tactical PIN verification commented out:
    try {
      const decoded = _tacticalDecode(_ENCRYPTED_KEY);
      return key === decoded;
    } catch (e) {
      return false;
    }
    */
    return true;
  }

  // ─── Utilities ─────────────────────────────────────────────

  /**
   * Clear all app data (for debugging/reset)
   */
  async clearAll() {
    const keys = await AsyncStorage.getAllKeys();
    const appKeys = keys.filter(k => k.startsWith('@nexuschat_'));
    await AsyncStorage.multiRemove(appKeys);
  }
}

export default new StorageService();
