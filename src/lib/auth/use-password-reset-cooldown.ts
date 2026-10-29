"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
	clearCooldown,
	formatCooldownRemaining,
	getBrowserStorage,
	getCooldownSnapshot,
	getCooldownStorageKey,
	normalizeResetEmail,
	PASSWORD_RESET_LOCK_MS,
	refreshCooldown,
	startCooldown,
	subscribeToCooldown,
} from "./password-reset-cooldown";

export interface PasswordResetCooldown {
	/** True while a reset link was requested less than `PASSWORD_RESET_LOCK_MS` ago. */
	locked: boolean;
	/** Milliseconds until the button unlocks; `0` when unlocked. */
	remainingMs: number;
	/** `m:ss` label for the countdown, or `null` when unlocked. */
	label: string | null;
	/** Call after a request completes. Pass the submitted email if it may have changed since. */
	start: (requestedEmail?: string) => void;
}

/**
 * Tracks the 15-minute password reset window for the current channel + email.
 *
 * The stored expiry lives in `localStorage`, so it survives reloads and is shared
 * across tabs. `useSyncExternalStore` reads it with a `null` server snapshot: the
 * first client render matches SSR, and the lock appears after hydration.
 */
export function usePasswordResetCooldown(channel: string, email: string): PasswordResetCooldown {
	const key = normalizeResetEmail(email) ? getCooldownStorageKey(channel, email) : null;

	const subscribe = useCallback(
		(listener: () => void) => (key ? subscribeToCooldown(key, listener) : () => undefined),
		[key],
	);
	const getSnapshot = useCallback(() => (key ? getCooldownSnapshot(key) : null), [key]);
	const getServerSnapshot = useCallback(() => null, []);

	const expiresAt = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

	// Keep another tab's write visible without a reload.
	useEffect(() => {
		if (!key) {
			return;
		}

		const handleStorage = (event: StorageEvent) => {
			if (event.key === key) {
				refreshCooldown(key);
			}
		};

		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, [key]);

	const [now, setNow] = useState(() => Date.now());

	// Tick the label once per second while locked, then stop when the window closes.
	useEffect(() => {
		if (!expiresAt) {
			return;
		}

		const interval = window.setInterval(() => {
			if (Date.now() >= expiresAt) {
				window.clearInterval(interval);
				if (key) {
					clearCooldown(getBrowserStorage(), key);
				}
				return;
			}
			setNow(Date.now());
		}, 1000);

		return () => window.clearInterval(interval);
	}, [expiresAt, key]);

	const start = useCallback(
		(requestedEmail?: string) => {
			const targetKey = requestedEmail ? getCooldownStorageKey(channel, requestedEmail) : key;
			if (!targetKey) {
				return;
			}

			startCooldown(getBrowserStorage(), targetKey);
			setNow(Date.now());
		},
		[channel, key],
	);

	// Clamp to the lock window so a backwards clock jump cannot extend the countdown.
	const remainingMs = expiresAt ? Math.min(PASSWORD_RESET_LOCK_MS, Math.max(0, expiresAt - now)) : 0;

	return {
		locked: remainingMs > 0,
		remainingMs,
		label: remainingMs > 0 ? formatCooldownRemaining(remainingMs) : null,
		start,
	};
}
