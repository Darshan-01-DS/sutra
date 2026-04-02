import { checkAuth, type AuthResponse } from './api';

const USER_KEY = 'sutra_user';
const LAST_CHECK_KEY = 'sutra_last_check';
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export interface CachedAuthState extends AuthResponse {
  lastCheckedAt?: number;
}

export async function getCachedAuthState(): Promise<CachedAuthState> {
  const stored = await chrome.storage.local.get([USER_KEY, LAST_CHECK_KEY]);
  const user = stored[USER_KEY];
  const lastCheckedAt = typeof stored[LAST_CHECK_KEY] === 'number' ? stored[LAST_CHECK_KEY] : undefined;

  if (user && typeof user === 'object' && typeof user.name === 'string' && typeof user.email === 'string') {
    return {
      isLoggedIn: true,
      user: {
        name: user.name,
        email: user.email,
        avatar: typeof user.avatar === 'string' ? user.avatar : undefined
      },
      lastCheckedAt
    };
  }

  return { isLoggedIn: false, lastCheckedAt };
}

export async function cacheAuthState(state: AuthResponse): Promise<void> {
  if (state.isLoggedIn && state.user) {
    await chrome.storage.local.set({
      [USER_KEY]: state.user,
      [LAST_CHECK_KEY]: Date.now()
    });
    return;
  }

  await chrome.storage.local.remove(USER_KEY);
  await chrome.storage.local.set({ [LAST_CHECK_KEY]: Date.now() });
}

export async function ensureFreshAuth(force = false): Promise<CachedAuthState> {
  const cached = await getCachedAuthState();
  const lastCheckedAt = cached.lastCheckedAt ?? 0;
  const isStale = Date.now() - lastCheckedAt > THIRTY_MINUTES_MS;

  if (!force && !isStale && cached.isLoggedIn) {
    return cached;
  }

  try {
    const fresh = await checkAuth();
    await cacheAuthState(fresh);
    return { ...fresh, lastCheckedAt: Date.now() };
  } catch {
    return cached;
  }
}

export async function clearCachedAuthState(): Promise<void> {
  await chrome.storage.local.remove(USER_KEY);
  await chrome.storage.local.remove(LAST_CHECK_KEY);
}