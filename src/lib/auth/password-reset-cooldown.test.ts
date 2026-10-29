import { afterEach, describe, it, expect, vi } from "vitest";
import {
	clearCooldown,
	formatCooldownRemaining,
	getCooldownStorageKey,
	normalizeResetEmail,
	PASSWORD_RESET_LOCK_MS,
	getCooldownSnapshot,
	readCooldownExpiry,
	refreshCooldown,
	startCooldown,
	subscribeToCooldown,
	writeCooldownExpiry,
	type CooldownStorage,
} from "./password-reset-cooldown";

const NOW = 1_700_000_000_000;

const createStorage = (initial: Record<string, string> = {}) => {
	const data = new Map(Object.entries(initial));

	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		},
		removeItem: (key: string) => {
			data.delete(key);
		},
		has: (key: string) => data.has(key),
		value: (key: string) => data.get(key),
	};
};

const noopStorage: CooldownStorage = {
	getItem: () => null,
	setItem: () => undefined,
	removeItem: () => undefined,
};

describe("normalizeResetEmail", () => {
	it("trims and lowercases", () => {
		expect(normalizeResetEmail("  Shopper@Example.COM ")).toBe("shopper@example.com");
	});
});

describe("getCooldownStorageKey", () => {
	it("is stable across casing and surrounding whitespace", () => {
		expect(getCooldownStorageKey("in", "  Shopper@Example.COM ")).toBe(
			getCooldownStorageKey("in", "shopper@example.com"),
		);
	});

	it("separates channels", () => {
		expect(getCooldownStorageKey("in", "shopper@example.com")).not.toBe(
			getCooldownStorageKey("us", "shopper@example.com"),
		);
	});

	it("separates email addresses", () => {
		expect(getCooldownStorageKey("in", "a@example.com")).not.toBe(
			getCooldownStorageKey("in", "b@example.com"),
		);
	});
});

describe("formatCooldownRemaining", () => {
	it("formats a full window as m:ss", () => {
		expect(formatCooldownRemaining(PASSWORD_RESET_LOCK_MS)).toBe("15:00");
	});

	it("zero-pads seconds", () => {
		expect(formatCooldownRemaining(61_000)).toBe("1:01");
		expect(formatCooldownRemaining(59_000)).toBe("0:59");
	});

	it("rounds up so a locked button never reads 0:00", () => {
		expect(formatCooldownRemaining(999)).toBe("0:01");
		expect(formatCooldownRemaining(1)).toBe("0:01");
	});

	it("floors at zero", () => {
		expect(formatCooldownRemaining(0)).toBe("0:00");
		expect(formatCooldownRemaining(-5_000)).toBe("0:00");
	});

	it("handles the last second of a long window", () => {
		expect(formatCooldownRemaining(3_599_000)).toBe("59:59");
	});
});

describe("readCooldownExpiry", () => {
	const key = getCooldownStorageKey("in", "shopper@example.com");

	it("returns a stored future expiry", () => {
		const storage = createStorage({ [key]: String(NOW + 60_000) });

		expect(readCooldownExpiry(storage, key, NOW)).toBe(NOW + 60_000);
	});

	it("drops an expired entry and returns null", () => {
		const storage = createStorage({ [key]: String(NOW - 1) });

		expect(readCooldownExpiry(storage, key, NOW)).toBeNull();
		expect(storage.has(key)).toBe(false);
	});

	it("treats a missing entry as unlocked", () => {
		expect(readCooldownExpiry(createStorage(), key, NOW)).toBeNull();
	});

	it("ignores malformed values", () => {
		expect(readCooldownExpiry(createStorage({ [key]: "not-a-number" }), key, NOW)).toBeNull();
		expect(readCooldownExpiry(createStorage({ [key]: "0" }), key, NOW)).toBeNull();
		expect(readCooldownExpiry(createStorage({ [key]: "-100" }), key, NOW)).toBeNull();
	});

	it("degrades to unlocked when storage throws", () => {
		const broken: CooldownStorage = {
			getItem: () => {
				throw new Error("storage disabled");
			},
			setItem: () => undefined,
			removeItem: () => undefined,
		};

		expect(readCooldownExpiry(broken, key, NOW)).toBeNull();
	});

	it("returns null without storage", () => {
		expect(readCooldownExpiry(null, key, NOW)).toBeNull();
	});
});

describe("startCooldown", () => {
	const key = getCooldownStorageKey("in", "shopper@example.com");

	it("writes a 15 minute window and returns the expiry", () => {
		const storage = createStorage();

		const expiresAt = startCooldown(storage, key, NOW);

		expect(expiresAt).toBe(NOW + 15 * 60 * 1000);
		expect(storage.value(key)).toBe(String(expiresAt));
	});

	it("still returns an expiry when persistence is unavailable", () => {
		expect(startCooldown(null, key, NOW)).toBe(NOW + PASSWORD_RESET_LOCK_MS);
	});

	it("does not throw when storage rejects the write", () => {
		const full: CooldownStorage = {
			getItem: () => null,
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
			removeItem: () => undefined,
		};

		expect(() => startCooldown(full, key, NOW)).not.toThrow();
	});

	it("keeps cooldowns for different emails independent", () => {
		const storage = createStorage();
		const otherKey = getCooldownStorageKey("in", "other@example.com");

		startCooldown(storage, key, NOW);

		expect(readCooldownExpiry(storage, key, NOW)).toBe(NOW + PASSWORD_RESET_LOCK_MS);
		expect(readCooldownExpiry(storage, otherKey, NOW)).toBeNull();
	});
});

describe("clearCooldown", () => {
	const key = getCooldownStorageKey("in", "shopper@example.com");

	it("removes the stored window", () => {
		const storage = createStorage({ [key]: String(NOW + 60_000) });

		clearCooldown(storage, key);

		expect(storage.has(key)).toBe(false);
	});

	it("is a no-op without storage", () => {
		expect(() => clearCooldown(null, key)).not.toThrow();
	});

	it("swallows storage errors", () => {
		const broken: CooldownStorage = {
			getItem: () => null,
			setItem: () => undefined,
			removeItem: () => {
				throw new Error("storage disabled");
			},
		};

		expect(() => clearCooldown(broken, key)).not.toThrow();
	});
});

describe("writeCooldownExpiry", () => {
	it("no-ops without storage", () => {
		expect(() => writeCooldownExpiry(null, "key", NOW)).not.toThrow();
		expect(() => writeCooldownExpiry(noopStorage, "key", NOW)).not.toThrow();
	});
});

describe("subscriptions", () => {
	const key = getCooldownStorageKey("in", "shopper@example.com");

	it("notifies subscribers when a cooldown starts", () => {
		const listener = vi.fn();
		const unsubscribe = subscribeToCooldown(key, listener);

		startCooldown(createStorage(), key, NOW);

		expect(listener).toHaveBeenCalledTimes(1);
		unsubscribe();
	});

	it("stops notifying after unsubscribe", () => {
		const listener = vi.fn();
		const unsubscribe = subscribeToCooldown(key, listener);

		unsubscribe();
		startCooldown(createStorage(), key, NOW);

		expect(listener).not.toHaveBeenCalled();
	});

	it("refreshes listeners after an out-of-band write", () => {
		const listener = vi.fn();
		const unsubscribe = subscribeToCooldown(key, listener);

		refreshCooldown(key);

		expect(listener).toHaveBeenCalledTimes(1);
		unsubscribe();
	});

	it("keeps listeners for different keys isolated", () => {
		const listener = vi.fn();
		const otherKey = getCooldownStorageKey("in", "other@example.com");
		const unsubscribe = subscribeToCooldown(otherKey, listener);

		startCooldown(createStorage(), key, NOW);

		expect(listener).not.toHaveBeenCalled();
		unsubscribe();
	});
});

describe("getCooldownSnapshot", () => {
	const key = getCooldownStorageKey("in", "shopper@example.com");

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns null when there is no browser storage", () => {
		expect(getCooldownSnapshot(key)).toBeNull();
	});

	it("reads the stored expiry through window.localStorage", () => {
		const future = Date.now() + 60_000;
		const storage = createStorage({ [key]: String(future) });
		vi.stubGlobal("window", { localStorage: storage });

		expect(getCooldownSnapshot(key)).toBe(future);
	});

	it("returns null for an expired window", () => {
		const storage = createStorage({ [key]: String(Date.now() - 1) });
		vi.stubGlobal("window", { localStorage: storage });

		expect(getCooldownSnapshot(key)).toBeNull();
	});
});
