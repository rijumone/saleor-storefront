"use client";

import { useEffect } from "react";

const RELOAD_MARKER = "stale-build-reload-at";
const RELOAD_COOLDOWN_MS = 30_000;

/**
 * Reload once when the tab is running a bundle from a previous deployment.
 *
 * Every deploy replaces the hashed `/_next/static` chunks. A tab that was open
 * during the deploy keeps its old bundle, so the next client-side navigation
 * requests files that no longer exist (404), and clicks appear to do nothing
 * until the user hard-refreshes. Detecting the failed chunk and reloading once
 * turns that into an automatic, invisible recovery.
 */
function reloadOnce() {
	try {
		const last = Number(sessionStorage.getItem(RELOAD_MARKER) ?? 0);
		// Guard against reload loops if the newest build is genuinely broken.
		if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
		sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
	} catch {
		// Storage unavailable (private mode): still reload once per session attempt.
	}
	window.location.reload();
}

export function StaleBuildRecovery() {
	useEffect(() => {
		const isNextAsset = (url: string) => url.includes("/_next/static/");

		// Script/link load failures only surface on the capture phase.
		const onResourceError = (event: Event) => {
			const target = event.target;
			if (target instanceof HTMLScriptElement && isNextAsset(target.src)) {
				reloadOnce();
			}
		};

		// Failed dynamic imports surface as unhandled promise rejections.
		const onUnhandledRejection = (event: PromiseRejectionEvent) => {
			const reason = event.reason;
			const message = typeof reason === "string" ? reason : String(reason?.message ?? "");
			if (
				/ChunkLoadError|Failed to fetch dynamically imported module|Loading chunk \S+ failed/i.test(message)
			) {
				reloadOnce();
			}
		};

		window.addEventListener("error", onResourceError, true);
		window.addEventListener("unhandledrejection", onUnhandledRejection);

		return () => {
			window.removeEventListener("error", onResourceError, true);
			window.removeEventListener("unhandledrejection", onUnhandledRejection);
		};
	}, []);

	return null;
}
