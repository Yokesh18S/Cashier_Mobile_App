/**
 * Secure Session Storage for Cashier & Waiter Mobile App
 *
 * Persists JWT token and user profile securely across:
 * - App closing / force quit
 * - Phone screen lock / unlock
 * - Device restarts
 * - Temporary network drops
 *
 * Uses expo-secure-store (backed by iOS Keychain / Android Keystore).
 * Gracefully falls back to localStorage/in-memory for web or test environments.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'cashier_app_auth_token';
const USER_KEY = 'cashier_app_auth_user';

// In-memory fallback
const memoryStorage = {};

async function isSecureStoreAvailable() {
  if (Platform.OS === 'web') return false;
  try {
    if (typeof SecureStore.isAvailableAsync === 'function') {
      return await SecureStore.isAvailableAsync();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Save authentication session (token and user profile).
 * @param {string} token - JWT access token
 * @param {object} user - User profile object
 */
export async function saveAuthSession(token, user) {
  try {
    const isAvailable = await isSecureStoreAvailable();
    const userStr = JSON.stringify(user);

    if (isAvailable) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, userStr);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(TOKEN_KEY, token);
      window.localStorage.setItem(USER_KEY, userStr);
    } else {
      memoryStorage[TOKEN_KEY] = token;
      memoryStorage[USER_KEY] = userStr;
    }
    return true;
  } catch (err) {
    console.warn('[Storage] Failed to save auth session:', err);
    memoryStorage[TOKEN_KEY] = token;
    memoryStorage[USER_KEY] = JSON.stringify(user);
    return false;
  }
}

/**
 * Retrieve persisted session.
 * @returns {Promise<{ token: string, user: object } | null>}
 */
export async function getAuthSession() {
  try {
    const isAvailable = await isSecureStoreAvailable();
    let token = null;
    let userStr = null;

    if (isAvailable) {
      token = await SecureStore.getItemAsync(TOKEN_KEY);
      userStr = await SecureStore.getItemAsync(USER_KEY);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      token = window.localStorage.getItem(TOKEN_KEY);
      userStr = window.localStorage.getItem(USER_KEY);
    } else {
      token = memoryStorage[TOKEN_KEY] || null;
      userStr = memoryStorage[USER_KEY] || null;
    }

    if (token && userStr) {
      const user = JSON.parse(userStr);
      return { token, user };
    }
  } catch (err) {
    console.warn('[Storage] Failed to read auth session:', err);
  }
  return null;
}

/**
 * Clear stored session on explicit logout.
 */
export async function clearAuthSession() {
  try {
    const isAvailable = await isSecureStoreAvailable();
    if (isAvailable) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
  } catch (err) {
    console.warn('[Storage] Failed to clear auth session:', err);
  } finally {
    delete memoryStorage[TOKEN_KEY];
    delete memoryStorage[USER_KEY];
  }
}
