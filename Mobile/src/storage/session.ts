import { Platform } from 'react-native';
import { getItem, removeItem, setItem } from './kv';

const TOKEN_KEY = 'taskmanagement_access_token';
const USER_KEY = 'taskmanagement_user';
const DEVICE_KEY = 'taskmanagement_device_id';
const THEME_KEY = 'taskmanagement_theme_v2';

export type StoredUser = {
  userId: number;
  fullName: string;
  email: string;
  expiresAt: string;
  sessionId: number;
};

export async function getToken(): Promise<string | null> {
  return getItem(TOKEN_KEY);
}

export async function setSession(token: string, user: StoredUser): Promise<void> {
  await setItem(TOKEN_KEY, token);
  await setItem(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<StoredUser | null> {
  const raw = await getItem(USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await removeItem(TOKEN_KEY);
  await removeItem(USER_KEY);
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getItem(DEVICE_KEY);

  if (existing) {
    return existing;
  }

  const created =
    globalThis.crypto?.randomUUID?.() ??
    `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  await setItem(DEVICE_KEY, created);
  return created;
}

export function getDeviceName(): string {
  if (Platform.OS === 'web') {
    return 'TaskManagement Web';
  }

  if (Platform.OS === 'ios') {
    return 'iPhone';
  }

  return 'Android Mobile';
}

export async function getThemeName(): Promise<'light' | 'dark'> {
  const value = await getItem(THEME_KEY);
  return value === 'light' ? 'light' : 'dark';
}

export async function setThemeName(theme: 'light' | 'dark'): Promise<void> {
  await setItem(THEME_KEY, theme);
}
