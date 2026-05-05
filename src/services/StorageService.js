import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  DEVICE_NAME: '@nexuschat_device_name',
  DEVICE_ID: '@nexuschat_device_id',
  CHAT_HISTORY: '@nexuschat_chat_',
  CONTACTS: '@nexuschat_contacts',
};

class StorageService {
  // ─── Device Identity ───────────────────────────────────────

  /**
   * Check if this is the first launch (no device name set)
   */
  async isFirstLaunch() {
    const name = await AsyncStorage.getItem(KEYS.DEVICE_NAME);
    return !name;
  }

  /**
   * Get saved device name
   */
  async getDeviceName() {
    return await AsyncStorage.getItem(KEYS.DEVICE_NAME);
  }

  /**
   * Save device name (set once on first launch)
   */
  async setDeviceName(name) {
    await AsyncStorage.setItem(KEYS.DEVICE_NAME, name.trim());
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
