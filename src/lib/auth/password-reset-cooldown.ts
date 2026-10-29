/**
 * Cooldown bookkeeping for "forgot password" requests.
 *
 * Saleor already enforces this window server-side: `requestPasswordReset` silently
 * skips sending a new email when `last_password_reset_request` is younger than
 * `RESET_PASSWORD_LOCK_TIME` (15 minutes), and returns success with no errors.
 * Because there is no error to react to, the storefront mirrors the window itself
 * so the button stops firing redundant requests and tells the user when to retry.
 */

/** Must match Saleor's default `RESET_PASSWORD_LOCK_TIME` (15 minutes). */
export const PASSWORD_RESET_LOCK_MS = 15 * 60 * 1000;

const STORAGE_KEY_PREFIX = "pw-reset-cooldown:v1";

/** Minimal subset of `Storage` needed here, so tests can pass a stub. */
export interface CooldownStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export const normalizeResetEmail = (email: string): string => email.trim().toLowerCase();

/**
 * One key per channel + email, so switching the email field gives that address its
 * own countdown and returning to a previously used address restores its remaining time.
 */
export const getCooldownStorageKey = (channel: string, email: string): string =>
	`${STORAGE_KEY_PREFIX}:${channel}:${normalizeResetEmail(email)}`;

/**
 * `localStorage` access can throw (privacy modes, disabled storage), so every
 * read/write is defensive. When it is unavailable the hook keeps the cooldown in
 * React state only, which still blocks repeat clicks for the current tab.
 */
export const getBrowserStorage = (): CooldownStorage | null => {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		return window.localStorage;
	} catch {
		return null;
	}
};

const parseExpiry = (raw: string | null): number | null => {
	if (!raw) {
		return null;
	}

	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** Returns the stored expiry in epoch ms, dropping stale or malformed entries. */
export const readCooldownExpiry = (
	storage: CooldownStorage | null,
	key: string,
	now: number = Date.now(),
): number | null => {
	if (!storage) {
		return null;
	}

	try {
		const expiresAt = parseExpiry(storage.getItem(key));
		if (expiresAt === null) {
			return null;
		}

		if (expiresAt <= now) {
			storage.removeItem(key);
			return null;
		}

		return expiresAt;
	} catch {
		return null;
	}
};

export const writeCooldownExpiry = (
	storage: CooldownStorage | null,
	key: string,
	expiresAt: number,
): void => {
	if (!storage) {
		return;
	}

	try {
		storage.setItem(key, String(expiresAt));
	} catch {
		// Storage full or disabled - the in-memory cooldown still applies.
	}
};

export const clearCooldown = (storage: CooldownStorage | null, key: string): void => {
	if (!storage) {
		return;
	}

	try {
		storage.removeItem(key);
	} catch {
		// Nothing to recover from.
	}

	refreshCooldown(key);
};

/** Records a fresh lock window and returns the expiry in epoch ms. */
export const startCooldown = (
	storage: CooldownStorage | null,
	key: string,
	now: number = Date.now(),
): number => {
	const expiresAt = now + PASSWORD_RESET_LOCK_MS;
	writeCooldownExpiry(storage, key, expiresAt);
	refreshCooldown(key);
	return expiresAt;
};

type CooldownListener = () => void;

const cooldownListeners = new Map<string, Set<CooldownListener>>();

const getCooldownListeners = (key: string): Set<CooldownListener> => {
	let listeners = cooldownListeners.get(key);
	if (!listeners) {
		listeners = new Set();
		cooldownListeners.set(key, listeners);
	}
	return listeners;
};

/** Subscribe to window changes for one channel + email key. */
export const subscribeToCooldown = (key: string, listener: CooldownListener): (() => void) => {
	const listeners = getCooldownListeners(key);
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			cooldownListeners.delete(key);
		}
	};
};

/** Re-read the key and notify subscribers (used for cross-tab `storage` events). */
export const refreshCooldown = (key: string): void => {
	cooldownListeners.get(key)?.forEach((listener) => listener());
};

/**
 * Current expiry for a key, or `null` when unlocked. Safe to call during render:
 * it only reads `localStorage` and returns a primitive, so snapshots stay stable.
 */
export const getCooldownSnapshot = (key: string): number | null =>
	readCooldownExpiry(getBrowserStorage(), key);

/** `m:ss` countdown label, rounded up so it never shows `0:00` while still locked. */
export const formatCooldownRemaining = (remainingMs: number): string => {
	const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
